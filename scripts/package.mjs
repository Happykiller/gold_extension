#!/usr/bin/env node
// Re-zip an existing build/ (and regenerate the report) without rebuilding.

import fs from 'node:fs';
import { loadConfig } from './lib/config.mjs';
import { print, separator, statistic } from './lib/log.mjs';
import { packageZip, buildInfo } from './lib/steps.mjs';

async function main() {
  const start = Date.now();
  const cfg = loadConfig();

  if (!fs.existsSync(cfg.paths.build)) {
    throw new Error('No build/ directory to package. Run `npm run build` first.');
  }

  separator();
  await packageZip(cfg);
  await buildInfo(cfg);

  statistic(start);
}

main().catch((e) => {
  print(`ERROR: ${e.message}`);
  process.exitCode = 1;
});
