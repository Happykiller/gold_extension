# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is **not** the source of the extension's code — it is the **build orchestrator** for the "Gold" Chrome extension (Manifest V3). The actual application code lives in three separate GitHub repos that this repo clones, builds, configures, and assembles into a single loadable/packaged extension:

- `Happykiller/gold_extension_popup` → the toolbar popup UI (React/Vite, produces `dist/`)
- `Happykiller/gold_extension_background` → the service worker (produces `build/background.js`)
- `Happykiller/gold_extension_content` → the content script (CRA, produces `build/static/js/main.*.js`)

The assembled output lands in `build/` (loadable as an unpacked extension) and a versioned `.zip` + `.md` build report in `archives/`.

## Commands

Run `npm install` once at the repo root to get the build tooling (`execa`, `archiver`, `dotenv`).

```bash
npm run build    # Full build: clone all 3 repos into temp/, install + build each,
                 # assemble into build/, then zip into archives/gold_<version>_<timestamp>.zip
npm run dev      # Fast re-assemble: skips clone/build, re-copies already-built temp/ output
                 # into build/ and re-packages. Run `npm run build` at least once first.
npm run package  # Re-zip an existing build/ and regenerate the report, no rebuild.
npm run clean    # Remove build/ and temp/.
```

There is no lint/test/build step for actual extension code **in this repo** — those run inside each sub-repo during `npm run build`. To work on extension code, clone and run the relevant sub-repo directly.

The build tooling lives in `scripts/` (ESM, Node >= 18): `scripts/build.mjs`, `dev.mjs`, `package.mjs`, `clean.mjs` are the entrypoints; `scripts/lib/` holds the shared logic.

## Build pipeline (scripts/)

`scripts/lib/config.mjs` is the single source of truth: it loads `.env` then `.env.local` (override) via `dotenv`, reads the version from `public/manifest.json`, computes `fileName = gold_<version>_<timestamp>`, and defines the three module descriptors (repo, branch, config paths, artifact copy rules).

`scripts/lib/steps.mjs` holds the steps, called by `build.mjs` in order: `checkPrerequisites` → `init` → `setup` → per-module (`cloneAndBuild` + `copyArtifact`) → `copyPublic` → `packageZip` → `buildInfo`.

- `cloneAndBuild` clones the module's repo at the configured branch, **validates its config file exists** (per-module — fixing a latent bug in the old bash that checked the wrong variable), copies the config from `config/<module>/` into the clone, then installs (`npm ci` when a lockfile is present, else the module's install flags — popup needs `--force`) and `npm run build`.
- `copyArtifact` pulls the build artifact out of `temp/` into `build/<module>/`. For popup it also rewrites absolute asset paths (`="/` → `="./`) in `index.html` so it works as a `chrome-extension://` page. Content's hashed `main.*.js` is flattened to `content/content.js`.
- `copyPublic` copies `public/` verbatim into `build/`.
- `packageZip` zips `content/ medias/ background/ popup/ manifest.json` from `build/` into `archives/` (via `archiver`, no system `zip` needed).
- `buildInfo` writes a `.md` report capturing each module's branch, version, default config, and applied config.

The output filename (`gold_<version>_<timestamp>`) derives `<version>` from the `"version"` field in `public/manifest.json`.

## Configuration

Build behavior is driven entirely by env vars, read from `.env` then overridden by `.env.local` (gitignored). Defined in `.env`:

- `POPUP_BRANCH` / `BACKGROUND_BRANCH` / `CONTENT_BRANCH` — git branch to clone for each module
- `POPUP_CONF` / `BACKGROUND_CONF` / `CONTENT_CONF` — filename under `config/<module>/` to inject as that module's config

The `config/<module>/` directories hold the per-module config files copied into each clone:
- `config/background/<BACKGROUND_CONF>` (e.g. `production.ts`) → copied to the background repo's `src/config/` (gitignored — `production.ts` is not committed)
- `config/popup/<POPUP_CONF>` (e.g. `.env.local`) and `config/content/<CONTENT_CONF>` → copied to those repos' roots

The `.notEmpty` files in each `config/` dir exist only to keep the directories tracked in git.

## Releasing a new version

Bump `"version"` in `public/manifest.json` before building — this is the single source of truth for the extension version and the archive filename. `public/` (manifest, `medias/`, `robots.txt`) is copied verbatim into `build/` by `copy_public`.

## Loading / reloading

Load `build/` as an unpacked extension at `chrome://extensions` (Developer Mode on). After rebuilding, click the refresh icon on the extension card to pick up changes.

## Notes for editing

- Cloning uses `git@github.com:` (SSH) — building requires SSH access to the Happykiller org repos.
- `temp/` and `build/` are scratch dirs wiped on every run; never put source there.
- The popup repo builds with Vite (`dist/`), background with a plain `build/background.js`, and content with Create React App (`build/static/js/main.*.js`) — when changing the per-module `copy` rules in `scripts/lib/config.mjs`, match each module's actual output layout.
- All per-module divergence (config destinations, install flags, artifact paths) is centralized in the `modules` array in `scripts/lib/config.mjs` — edit there rather than in the step functions.
