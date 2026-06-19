#!/usr/bin/env node
// Remove the scratch build/ and temp/ directories.

import fsp from 'node:fs/promises';
import { loadConfig } from './lib/config.mjs';
import { header, print, separator } from './lib/log.mjs';

async function main() {
  const cfg = loadConfig();

  separator();
  header('clean');
  await fsp.rm(cfg.paths.build, { recursive: true, force: true });
  await fsp.rm(cfg.paths.temp, { recursive: true, force: true });
}

main().catch((e) => {
  print(`ERROR: ${e.message}`);
  process.exitCode = 1;
});
