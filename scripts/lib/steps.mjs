// Build steps — the JS port of the functions that lived in common.sh.

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { createWriteStream } from 'node:fs';
import archiver from 'archiver';
import { execa } from 'execa';
import { header, print } from './log.mjs';

/** Verify the external tools we shell out to are available. */
export async function checkPrerequisites() {
  header('prerequisites');
  for (const tool of ['git', 'npm']) {
    try {
      await execa(tool, ['--version'], { stdio: 'ignore' });
    } catch {
      throw new Error(`Required tool not found on PATH: \`${tool}\``);
    }
  }
}

/** Echo the resolved branches/configs, like the old `init`. */
export function init(cfg) {
  header('init');
  for (const [k, v] of Object.entries(cfg.env)) print(`${k}:${v ?? ''}`);
}

/** Wipe and recreate build/ (and temp/ on a full build). */
export async function setup(cfg, { withTemp }) {
  header('setup');
  await fsp.rm(cfg.paths.build, { recursive: true, force: true });
  for (const dir of ['popup', 'background', 'content']) {
    await fsp.mkdir(path.join(cfg.paths.build, dir), { recursive: true });
  }
  if (withTemp) {
    await fsp.rm(cfg.paths.temp, { recursive: true, force: true });
    await fsp.mkdir(cfg.paths.temp, { recursive: true });
  }
}

/** Clone a module at its branch, inject its config, install deps and build it. */
export async function cloneAndBuild(cfg, mod) {
  header(`generate_${mod.key}`);

  // Fail early and per-module if the config file is missing (the old bash checked
  // the wrong `$FILE` variable for background/content, so this never fired).
  if (!mod.conf) throw new Error(`No config name set for ${mod.key} (check .env)`);
  if (!fs.existsSync(mod.configSrc)) {
    throw new Error(`No such config file for ${mod.key} => ${mod.configSrc}`);
  }

  await fsp.rm(mod.cloneDir, { recursive: true, force: true });
  await execa('git', [
    'clone', '--single-branch', '--branch', mod.branch, mod.repo, mod.cloneDir,
  ], { stdio: 'inherit' });

  await fsp.mkdir(path.dirname(mod.confDest), { recursive: true });
  await fsp.cp(mod.configSrc, mod.confDest, { recursive: true });

  // Use `npm ci` when a lockfile is present (reproducible), else fall back to the
  // module's install flags (popup needs --force for its peer-dep resolution).
  const hasLock = fs.existsSync(path.join(mod.cloneDir, 'package-lock.json'));
  const installArgs = hasLock && !mod.install.includes('--force') ? ['ci'] : mod.install;
  await execa('npm', installArgs, { cwd: mod.cloneDir, stdio: 'inherit' });
  await execa('npm', ['run', 'build'], { cwd: mod.cloneDir, stdio: 'inherit' });
}

/** Copy a built module's artifact out of temp/ into build/. */
export async function copyArtifact(cfg, mod) {
  header(`copy_${mod.key}`);
  const { copy } = mod;

  // The artifact comes from temp/, produced by `npm run build`. If it's missing
  // (e.g. `npm run dev` was run before any build), fail with an actionable message
  // instead of a raw ENOENT stack trace.
  const sourcePath = copy.type === 'glob' ? copy.fromDir : copy.from;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(
      `Missing build artifact for ${mod.key} (${sourcePath}). Run \`npm run build\` first.`,
    );
  }

  if (copy.type === 'dir') {
    await fsp.cp(copy.from, copy.to, { recursive: true });
  } else if (copy.type === 'file') {
    await fsp.mkdir(path.dirname(copy.to), { recursive: true });
    await fsp.cp(copy.from, copy.to);
  } else if (copy.type === 'glob') {
    const entries = await fsp.readdir(copy.fromDir);
    const found = entries.find((f) => copy.match.test(f));
    if (!found) throw new Error(`No file matching ${copy.match} in ${copy.fromDir}`);
    await fsp.mkdir(path.dirname(copy.to), { recursive: true });
    await fsp.cp(path.join(copy.fromDir, found), copy.to);
  }

  // Rewrite absolute asset URLs (="/ -> ="./) so the popup loads as an extension page.
  if (mod.rewriteIndexHtml) {
    const html = await fsp.readFile(mod.rewriteIndexHtml, 'utf8');
    await fsp.writeFile(mod.rewriteIndexHtml, html.replaceAll('="/', '="./'));
  }
}

/** Copy public/ (manifest, medias, robots.txt) verbatim into build/. */
export async function copyPublic(cfg) {
  header('copy_public');
  await fsp.cp(cfg.paths.public, cfg.paths.build, { recursive: true });
}

/** Zip the assembled build/ into archives/<fileName>.zip. */
export async function packageZip(cfg) {
  header('package');
  await fsp.mkdir(cfg.paths.archives, { recursive: true });
  const zipPath = path.join(cfg.paths.archives, `${cfg.fileName}.zip`);

  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    // Same set the old `zip -r` packaged, relative to build/.
    for (const dir of ['content', 'medias', 'background', 'popup']) {
      archive.directory(path.join(cfg.paths.build, dir), dir);
    }
    archive.file(path.join(cfg.paths.build, 'manifest.json'), { name: 'manifest.json' });
    archive.finalize();
  });

  print(`archive: ${zipPath}`);
}

const readOr = (p, fallback = '') => {
  try { return fs.readFileSync(p, 'utf8'); } catch { return fallback; }
};

const versionOf = (cloneDir) => {
  try {
    return JSON.parse(readOr(path.join(cloneDir, 'package.json'), '{}')).version ?? '';
  } catch { return ''; }
};

/** Write the archives/<fileName>.md build report. */
export async function buildInfo(cfg) {
  header('buildInfo');
  const sections = cfg.modules.map((mod) => `
# ${mod.key.toUpperCase()}

## Branch
* \`${mod.branch}\`

## Version
* \`${versionOf(mod.cloneDir)}\`

## Default config:
\`\`\`
${readOr(mod.defaultConf)}
\`\`\`

## Main config:
\`\`\`
${readOr(mod.appliedConf)}
\`\`\`
`).join('\n');

  const mdPath = path.join(cfg.paths.archives, `${cfg.fileName}.md`);
  await fsp.mkdir(cfg.paths.archives, { recursive: true });
  await fsp.writeFile(mdPath, sections);
  print(`report: ${mdPath}`);
}
