# Three Spectrum Palettes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Xi’an Jade, Pyro Ember, and Terra Frontier as selectable Spectrum presets.

**Architecture:** Extend the existing palette and name registries; the popup already creates options from `THEME_NAMES`. Add a `highlight` token for the warm preview color and use it for the existing developer-thread marker, preserving its current color for all existing presets. The background and the other eight palette concepts remain aligned with the preview.

**Tech Stack:** TypeScript, CSS custom properties, Node built-in tests, Vite packaging.

**Spec:** `docs/superpowers/specs/2026-10-30-spectrum-palettes.md`.

## Global Constraints

- Keep `chrome.storage.local` as the only extension storage API and preserve version-1 settings compatibility.
- Keep the home banner, native Forum/Chat surfaces, and sidebar unchanged.
- For the version bump, refresh the matching tester folder and ZIP from `dist/` with one top-level ZIP folder; preserve previous tester releases.
- Run only settings and theme checks tied to the modified behavior.

## Review Focus

- Existing presets retain their current color values and developer marker: test the legacy `highlight` token value.
- New theme IDs resolve after normalization and appear in the popup registry: test exact names and key ordering.
- Saved settings apply new palette values at runtime: test root `--rsi-*` values and `data-rsi-preset`.
- Accent overrides do not replace warm highlights: test `paletteFor` on a new preset with a custom accent.
- Text, muted, accent, and highlight maintain contrast on every surface: extend the existing palette contrast test.

---

### Task 1: Palette tests and tokens

**Files:**
- Modify: `tests/settings.test.mjs`
- Modify: `tests/settings-runtime.test.mjs`
- Modify: `tests/spectrum-theme.test.mjs` only if a packaging assertion needs the new token.

**Interfaces:**
- Consumes: `PALETTES`, `THEME_NAMES`, `COLOR_KEYS`, `paletteFor`, and packaged content runtime.
- Produces: red tests pinning the 16 preset names, the three palette values, `--rsi-highlight`, runtime selection, and contrast.

- [x] Add exact-value assertions for `xianJade`, `pyroEmber`, and `terraFrontier`; update total preset count to 16; assert all palettes have nine valid tokens and all foreground tokens meet contrast.
- [x] Assert a custom accent only overrides `accent`, and `applySettings` applies the new `--rsi-highlight` value.
- [x] Assert the bundled runtime updates to a new preset and applies its background and highlight when saved settings change.
- [x] Run the focused settings tests and confirm they fail because the three presets and highlight token are missing.

### Task 2: Register and apply the palettes

**Files:**
- Modify: `src/themes/palettes.ts`
- Modify: `src/themes/tokens.css`
- Modify: `src/content/apply-settings.ts` only if `COLOR_KEYS` does not cover the new token.
- Modify: `src/styles/spectrum-forums.css`
- Modify: `src/themes/README.md`

**Interfaces:**
- Consumes: Task 1’s exact palette and runtime assertions.
- Produces: three registered presets and the applied `--rsi-highlight` token.

- [x] Add the exact nine-token values from the spec and names `Xi’an Jade`, `Pyro Ember`, and `Terra Frontier`.
- [x] Add `highlight` to palette typing, `COLOR_KEYS`, and default tokens; set existing presets’ highlight to `#bfa739` to preserve the current developer marker.
- [x] Replace only the fixed developer-thread marker color with `var(--rsi-highlight)`.
- [x] Update theme documentation from thirteen to sixteen built-in presets.
- [x] Run the focused settings tests and require all tests to pass.

### Task 3: Build and package 0.13.25

**Files:**
- Modify: `package.json`, `extension/manifest.json`, `src/popup/index.html`.
- Modify: `docs/release-validation.md`.
- Create: `release/RSI-Enhanced-v0.13.25/TESTER-INSTRUCTIONS.txt`, `PATCH-NOTES.txt`, and `release/RSI-Enhanced-v0.13.25.zip`.

**Interfaces:**
- Consumes: Task 2’s built-in presets and successful feature-scoped tests.
- Produces: version-matched distributable tester package.

- [x] Bump all three version declarations to `0.13.25`.
- [x] Run `pnpm build`, `pnpm check:settings`, and `pnpm check:theme`; run the release artifact audit. The build, theme check, and audit passed; `pnpm check:settings` stopped at two existing Roadmap TypeScript errors.
- [x] Copy the current `dist/` into a new version-matched tester folder, document the palette choices, and create a ZIP with one top-level folder.
- [x] Verify the tester folder and ZIP contain matching generated files by SHA-256; inspect the ZIP root and document count.
- [x] Record actual check results and that live browser rendering was not inspected.
