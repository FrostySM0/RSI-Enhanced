# RSI Enhanced developer guide

This guide is for contributors working on the extension source. The project is a Manifest V3 browser extension for desktop Chromium browsers. It uses TypeScript, CSS, Vite for bundling, and Node's built-in test runner; there is no UI framework or runtime package dependency.

For feature behavior, see the project [README](../README.md). For the test commands and browser fixtures, see [Testing](testing.md). Focused implementation notes are linked from the `docs/` directory.

## Set up a development checkout

Install Node.js 22.18 or later and pnpm 11 (the repository pins pnpm 11.25.0). From the repository root:

```sh
pnpm install
pnpm build
```

To try the built extension, open `chrome://extensions` in Chrome, `brave://extensions` in Brave, or `edge://extensions` in Edge. Turn on Developer mode, select **Load unpacked**, and choose the repository's `dist/` folder. After changing source files, rebuild, click **Reload** on the extension card, and refresh the RSI page. `pnpm dev` watches source files and rebuilds `dist/`; it does not provide hot module replacement in the browser.

The extension targets desktop Chromium 118 and later. Its content scripts run on `https://robertsspaceindustries.com/`; the funding-history worker also makes a fixed request to the public Google Sheet described in the privacy policy.

## Where code lives

| Path | Responsibility |
| --- | --- |
| `extension/manifest.json` | Source Manifest V3 configuration, entry points, host matches, permissions, and extension icons. |
| `src/content/index.ts` | Consent and settings startup, route detection, and activation of page-feature controllers. |
| `src/content/` | Small page-specific behavior modules for Spectrum, Hangar, Roadmap, Funding Goals, Dev Tracker, Organizations, and Comm-Link. |
| `src/shared/` | Route contracts, validated settings, storage helpers, palettes, saved threads, hidden users, Hangar favourites, funding data, and consent state. Keep these helpers independent of page DOM where practical. |
| `src/styles/` | Spectrum styles and the independent stylesheets under `src/styles/rsi/`; `avatar-shapes.css` contains shared avatar styling. |
| `src/themes/` | Spectrum design tokens, theme mapping, palette definitions, and the Chris Roberts preset. |
| `src/popup/` | Settings interface, previews, privacy notice, and settings persistence. |
| `src/background/funding-history.ts` | Narrow service worker entry for the public funding-history requests. |
| `scripts/build.mjs` | Builds the popup, content script, worker, manifest, icons, and generated CSS into `dist/`. |
| `tests/` | Focused unit and integration tests plus synthetic page fixtures. Tests use local fixtures and mocks rather than live RSI requests. |
| `docs/` | Inspection evidence, subsystem notes, release validation, and testing instructions. |
| `dist/` | Generated unpacked extension output. Do not edit it by hand. |
| `website/` | Public project website source; it is separate from the extension build. |

## How the extension starts

The manifest injects the bundled `content.js` on RSI pages and CSS on Spectrum and other supported RSI pages. `src/content/index.ts` waits for the user's privacy consent before activating features. Once active, it watches validated settings and recognizes in-site navigation using the Navigation API and `popstate`; it then enables the controllers for the current route and settings.

Route classification lives in `src/shared/site-sections.ts`. Spectrum and each RSI section have separate module settings. Keep a feature's route check, setting check, and cleanup behavior together so it stops acting when consent is withdrawn, its setting is disabled, or navigation leaves its supported section. Avoid polling; use narrowly scoped observers only when the site renders the needed UI dynamically, and disconnect them when the feature is inactive.

The build script creates separate bundles for the popup, classic content script, and funding worker. It also copies the source manifest and local assets, then assembles CSS in a deliberate order. The content script must remain self-contained because it runs as a classic script. Extension pages use a self-only content security policy; do not add remotely hosted executable code.

## Adding or changing a feature

Before writing selectors, inspect the relevant markup and existing inspection notes. Record newly verified selectors or important limitations in the corresponding `docs/` note, and make a sanitized fixture that captures the structure the code depends on.

For a page behavior change, follow the nearest module pattern in `src/content/`: keep the feature in its own file, gate it on consent, route, and its setting, and make it safe to refresh or disable. Register the controller with `src/content/index.ts` so route changes and consent changes reach it. Keep native site links, controls, navigation, and content working unless the feature explicitly adds an alternative.

For a style change, edit the source stylesheet, not generated output. Spectrum styles are registered in the `spectrumStyles` list in `scripts/build.mjs`; RSI styles are registered in `rsiStyles`. Preserve their route and module scopes so disabling one feature does not disable another. Prefer CSS for visual changes and use extension-owned custom properties and `data-rsi-*` attributes rather than assuming the site reads extension settings.

For a settings change, update the settings type, defaults, and validation in `src/shared/settings.ts`, then wire the control and save behavior in the popup. Keep independent module switches independent, and store new data under a narrowly named key in `chrome.storage.local`. Do not clear the whole storage area when resetting a setting.

If a feature changes stored data, permissions, host access, or network requests, update the privacy notice and relevant privacy documentation as well as the manifest and store disclosures. Keep requests limited to the data and fixed origins needed by the feature. Treat page content as untrusted input; render text as text and validate URLs before using them.

## Build and verify changes

Use the smallest relevant check while developing. The available package scripts are:

```sh
pnpm build
pnpm check:scaffold
pnpm check:theme
pnpm check:settings
pnpm check:release
pnpm test
pnpm verify
```

`pnpm check:release` checks the already-built package, so run `pnpm build` first after source changes. `pnpm test` builds and runs the full Node test suite. `pnpm verify` adds the release artifact check. For a focused feature, run its test directly, for example:

```sh
node --test tests/hangar-search.test.mjs
```

Use the matching test and fixture for the changed behavior; `docs/testing.md` lists the feature test groups and local browser routes. Fixtures verify the contracts represented in their HTML and CSS; they do not prove that RSI's live pages still use the same markup. Report fixture results and live browser validation separately.

## Project conventions

- Keep modules independent and changes narrowly scoped. Read the relevant subsystem note and nearby tests before changing an established contract.
- Preserve desktop full-width layouts and native site functionality. Mobile-specific work is outside the current product scope.
- Keep settings normalized through the shared helpers and listen for storage changes instead of relying on stale popup state.
- Request only the permissions and host access required by a feature. The current API permission is `storage`; `docs.google.com` access is limited to funding history.
- Do not add analytics, telemetry, arbitrary remote code, or unbounded network behavior.
- Add regression coverage for meaningful behavior changes. Keep tests local and deterministic; do not make them depend on a signed-in browser or an external service.
- Update user-facing documentation when visible behavior, settings, privacy practices, or supported pages change.

## Further reading

- [Testing and browser fixtures](testing.md)
- [Spectrum inspection notes](spectrum-inspection.md)
- [RSI inspection notes](rsi-inspection.md)
- [Hangar workspace](hangar-workspace.md)
- [Settings architecture and verification](settings.md)
- [Release validation](release-validation.md)
