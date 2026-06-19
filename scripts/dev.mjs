#!/usr/bin/env node
// Fast re-assemble: skip clone/build, just re-copy already-built temp/ output into
// build/ and re-package. Run `npm run build` at least once first.

import { loadConfig } from './lib/config.mjs';
import { print, separator, statistic } from './lib/log.mjs';
import {
  init, setup, copyArtifact, copyPublic, packageZip, buildInfo,
} from './lib/steps.mjs';

async function main() {
  const start = Date.now();
  const cfg = loadConfig();

  separator();
  init(cfg);
  await setup(cfg, { withTemp: false });

  for (const mod of cfg.modules) {
    await copyArtifact(cfg, mod);
  }

  await copyPublic(cfg);
  await packageZip(cfg);
  await buildInfo(cfg);

  statistic(start);
}

main().catch((e) => {
  print(`ERROR: ${e.message}`);
  process.exitCode = 1;
});
