// Configuration loading and per-module definitions.
//
// Replaces the `init()` function and the scattered per-module paths from
// common.sh with a single source of truth.

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';

export const rootDir = path.resolve(fileURLToPath(import.meta.url), '../../..');

/** Build a `gold_<version>_<timestamp>` base name (local time, like `date '+%Y-%m-%d_%H-%M-%S'`). */
function buildFileName(version) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_` +
    `${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
  return `gold_${version}_${ts}`;
}

/**
 * Load `.env` then `.env.local` (override), read the extension version from the
 * manifest, and return the resolved config plus the three module descriptors.
 */
export function loadConfig() {
  // Source `.env` first, then let `.env.local` override — same order the old
  // `for f in .env*; do source $f; done` produced.
  dotenv.config({ path: path.join(rootDir, '.env') });
  dotenv.config({ path: path.join(rootDir, '.env.local'), override: true });

  const manifest = JSON.parse(
    fs.readFileSync(path.join(rootDir, 'public', 'manifest.json'), 'utf8'),
  );
  const version = manifest.version;
  const fileName = buildFileName(version);

  const env = {
    POPUP_BRANCH: process.env.POPUP_BRANCH,
    POPUP_CONF: process.env.POPUP_CONF,
    BACKGROUND_BRANCH: process.env.BACKGROUND_BRANCH,
    BACKGROUND_CONF: process.env.BACKGROUND_CONF,
    CONTENT_BRANCH: process.env.CONTENT_BRANCH,
    CONTENT_CONF: process.env.CONTENT_CONF,
  };

  const tmp = (name) => path.join(rootDir, 'temp', name);
  const out = (name) => path.join(rootDir, 'build', name);

  const modules = [
    {
      key: 'popup',
      repo: 'git@github.com:Happykiller/gold_extension_popup.git',
      branch: env.POPUP_BRANCH,
      conf: env.POPUP_CONF,
      // Applied config file in this repo, copied verbatim into the clone root.
      configSrc: path.join(rootDir, 'config', 'popup', env.POPUP_CONF ?? ''),
      cloneDir: tmp('gold_extension_popup'),
      confDest: tmp(path.join('gold_extension_popup', env.POPUP_CONF ?? '')),
      install: ['install', '--force'],
      // Vite output: copy the whole dist/ tree into build/popup/.
      copy: { type: 'dir', from: tmp('gold_extension_popup/dist'), to: out('popup') },
      // Rewrite absolute asset paths so index.html works under chrome-extension://.
      rewriteIndexHtml: out('popup/index.html'),
      // buildInfo sources.
      defaultConf: tmp('gold_extension_popup/.env'),
      appliedConf: path.join(rootDir, 'config', 'popup', '.env.local'),
    },
    {
      key: 'background',
      repo: 'git@github.com:Happykiller/gold_extension_background.git',
      branch: env.BACKGROUND_BRANCH,
      conf: env.BACKGROUND_CONF,
      configSrc: path.join(rootDir, 'config', 'background', env.BACKGROUND_CONF ?? ''),
      cloneDir: tmp('gold_extension_background'),
      confDest: tmp(path.join('gold_extension_background', 'src', 'config', env.BACKGROUND_CONF ?? '')),
      install: ['install'],
      copy: { type: 'file', from: tmp('gold_extension_background/build/background.js'), to: out('background/background.js') },
      defaultConf: tmp('gold_extension_background/src/config/defaults.ts'),
      appliedConf: path.join(rootDir, 'config', 'background', env.BACKGROUND_CONF ?? ''),
    },
    {
      key: 'content',
      repo: 'git@github.com:Happykiller/gold_extension_content.git',
      branch: env.CONTENT_BRANCH,
      conf: env.CONTENT_CONF,
      configSrc: path.join(rootDir, 'config', 'content', env.CONTENT_CONF ?? ''),
      cloneDir: tmp('gold_extension_content'),
      confDest: tmp(path.join('gold_extension_content', env.CONTENT_CONF ?? '')),
      install: ['install'],
      // CRA output: pick the hashed main.*.js bundle and flatten it to content.js.
      copy: { type: 'glob', fromDir: tmp('gold_extension_content/build/static/js'), match: /^main\..*\.js$/, to: out('content/content.js') },
      defaultConf: tmp('gold_extension_content/.env'),
      appliedConf: path.join(rootDir, 'config', 'content', '.env.local'),
    },
  ];

  return {
    rootDir,
    version,
    fileName,
    env,
    modules,
    paths: {
      build: path.join(rootDir, 'build'),
      temp: path.join(rootDir, 'temp'),
      public: path.join(rootDir, 'public'),
      archives: path.join(rootDir, 'archives'),
    },
  };
}
