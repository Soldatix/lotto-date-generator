# Date Lotto Generator

Standalone browser application for generating deterministic lottery combinations from a selected date.

## Features
- Client-only Vite application with production offline support.
- Date-based deterministic number generation.
- Presets: 6, 6+1, 7, 5+2, 5+1, 6+2, plus fully custom configuration.
- Configurable main and extra-number ranges (supports 1–60, 1–15 and wider custom ranges).
- Languages: English, Croatian, Italian, German, Spanish.
- Light/dark theme.
- Fullscreen mode.
- Copy generated combinations.
- Save up to 30 combinations locally in the browser using `localStorage`.
- Optional personal key to create a different repeatable combination for the same date.

## Usage
1. Run `npm install`, then `npm run dev`; for production run `npm run build` and serve `dist` over HTTPS (or localhost with `npm run preview`).
2. Select a date.
3. Choose a Lotto preset or set a custom number count/range.
4. Optionally enter a personal key.
5. Click **Generate numbers**.
6. Copy or save the generated combination.

## Important
The generator is intended for entertainment. Lottery drawings are random, and date-based generation does not increase the mathematical chance of winning.

## Production offline / PWA

`vite-plugin-pwa` generates `dist/sw.js` and its Workbox runtime during the build.
The precache includes the final hashed JS/CSS, HTML, existing web manifest and PNG
icons. No generated asset filenames are maintained in source code. All application
features are local; external payment and portal links still require the internet.

Registration runs only in production on secure HTTP(S) contexts with service-worker
support. Development and `file:` URLs do not register a worker. Relative build URLs
support deployment at the origin root or a subdirectory. Deploy the complete `dist`
directory together, and serve `sw.js` with revalidation (`Cache-Control: no-cache`);
hashed assets may use immutable caching. Registration also bypasses the HTTP cache
when checking the worker and its imports (`updateViaCache: 'none'`).

After the first online visit has finished installing the worker and precache,
navigation in its scope falls back to cached `index.html`, including offline reloads.
Clearing site data/browser eviction removes this offline copy and requires another
online visit.

Updates use the normal service-worker waiting lifecycle. Existing tabs keep working
without automatic reloads. Close **all** app tabs/windows, then reopen to use the
installed update. A reload alone is not guaranteed to activate it while old clients
remain. Activation removes obsolete precache entries and incompatible old Workbox
precaches in this scope. No code clears localStorage; History, Language, Theme and
other stored values survive updates. The app's explicit Reset remains separate.

## Checks

Run `npm run build`, `npm test`, and `git diff --check`. The Node tests include 120
Lotto regression combinations against HEAD, registration guards and built precache /
manifest / icon validation; build before running them.

`npm run test:pwa` is an optional real Chromium integration check. It needs an
externally available `playwright` package and installed Chrome, without adding a
browser test framework to this project's dependencies. If the package is outside
normal module resolution, set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path.
Set `PWA_BROWSER=msedge` to use installed Edge instead of Chrome.
The script serves production output at `/app/`, exercises offline reopen/reload,
all languages/presets, History, Theme, Info, Backup v1/Restore/Reset, then builds a
temporary second version. It checks waiting across multiple tabs, activation, cache
cleanup, preserved localStorage, and offline reopening of the new version. Temporary
builds and the isolated browser context are removed afterwards.

`npm run test:history` uses the same optional Playwright/Chrome setup (including
`PLAYWRIGHT_MODULE` and `PWA_BROWSER`). It checks the Astra mobile History overflow
regression at 320, 360, 390, 768 and 1280 px in all five languages, using one and
multiple saved entries, long personal keys and maximum-length 20+10 results.
It verifies document/card/content widths, readable untruncated text, mobile touch
targets and working History Copy/Delete controls.

<!-- diagnostic build touch: no application code changes -->
