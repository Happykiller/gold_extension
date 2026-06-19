#!/usr/bin/env node
// Full build: clone + build each module, assemble build/, then package the zip + report.

import { loadConfig } from './lib/config.mjs';
import { print, separator, statistic } from './lib/log.mjs';
import {
  checkPrerequisites, init, setup, cloneAndBuild, copyArtifact,
  copyPublic, packageZip, buildInfo,
} from './lib/steps.mjs';

async function main() {
  const start = Date.now();
  const cfg = loadConfig();

  separator();
  await checkPrerequisites();
  init(cfg);
  await setup(cfg, { withTemp: true });

  for (const mod of cfg.modules) {
    await cloneAndBuild(cfg, mod);
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
