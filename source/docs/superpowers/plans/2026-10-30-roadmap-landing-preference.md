# Roadmap Landing Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users choose which view opens from the main Roadmap navigation entry while preserving the native in-page view switcher.

**Architecture:** Extend the existing version-1 settings contract with a validated `roadmapLandingView` choice that defaults to `release-view`. Add a select in the RSI website settings panel and a small content runtime that reroutes only top-level Roadmap navigation; internal Roadmap links and direct URLs remain native.

**Tech Stack:** TypeScript content script, settings popup HTML/TypeScript, `chrome.storage.local`, Node's built-in test runner, Vite build.

**Spec:** `docs/superpowers/specs/2026-10-30-roadmap-landing-preference-design.md`

## Global Constraints

- Preserve schema version 1 and `rsiEnhanced.settings`; missing/invalid landing values normalize to `release-view`.
- Offer only Release View and Progress Tracker; default to Release View.
- Keep routing preference independent from the Roadmap appearance module switch.
- Preserve native internal view links and direct Roadmap URLs; add no permission, dependency, polling, or broad observer.
- Inspect the current top-level Roadmap link before adding DOM selectors; do not reuse the inner Roadmap tab as the entry point.
- Bump the extension version and refresh the tester folder, version-matched instructions, cumulative patch notes, and one-root ZIP from `dist/`.
- Run only settings, Roadmap landing, build, and release-artifact checks.

## Review Focus

- The RSI top-level link may use a locale prefix or a canonical `/roadmap` path; test both accepted Roadmap destinations and preserve locale.
- In-page view links may share Roadmap URL patterns; only links outside the Roadmap app root may use the saved preference.
- Missing or malformed stored preference must preserve the existing Release View default.
- The async settings read must not route an early click using the fallback when a saved Progress Tracker preference is still loading.
- Disabling Roadmap styling must not disable the navigation preference.

---

### Task 1: Settings contract and popup control

**Files:**
- Modify: `src/shared/settings.ts`
- Modify: `src/popup/index.html`
- Modify: `src/popup/index.ts`
- Test: `tests/settings.test.mjs`
- Test: `tests/popup-settings-runtime.test.mjs`

**Interfaces:**
- Add `Settings.roadmapLandingView: 'release-view' | 'progress-tracker'`.
- Normalize absent or invalid values to `'release-view'`.
- Add a labeled select with id `roadmap-landing-view`; save and restore its value through the existing draft/render flow.

- [x] **Step 1: Write failing settings tests** for the default, valid Progress Tracker value, invalid-value fallback, and popup save/restore.
- [x] **Step 2: Run the focused settings and popup tests** and confirm they fail because the new field/control is absent.
- [x] **Step 3: Implement the validated setting and RSI website select**, using existing popup control styling and explicit Save/Reset behavior.
- [x] **Step 4: Run the focused settings and popup tests** and confirm default, normalization, save, restore, and reset behavior passes.

### Task 2: Main-entry Roadmap routing

**Files:**
- Create: `src/content/roadmap-landing.ts`
- Modify: `src/content/index.ts`
- Create: `tests/roadmap-landing.test.mjs`
- Modify if live inspection reveals a stable contract: `tests/fixtures/roadmap-release.html`
- Modify if selector evidence changes project knowledge: `docs/rsi-inspection.md`

**Interfaces:**
- Export a path helper that maps the selected view to `/roadmap/release-view` or `/roadmap/progress-tracker/teams`, retaining an existing locale prefix.
- Export an installer that intercepts only same-origin top-level Roadmap link activation outside `#root`; it must ignore links inside the Roadmap app and leave direct URL loads untouched.
- Read the current preference from the content entry's live settings state and wait for its first settings load before rerouting an early click.

- [x] **Step 1: Inspect the current public top-level Roadmap anchor and confirm the Roadmap app-root boundary**; record only stable, relevant evidence and do not inspect a signed-in user browser.
- [x] **Step 2: Add failing routing tests** for both destinations, `/roadmap` and locale-prefixed paths, top-level main-entry rerouting, in-app tab preservation, unrelated links, a click before settings finish loading, and routing while Roadmap styling is disabled.
- [x] **Step 3: Run `node --test tests/roadmap-landing.test.mjs`** and confirm the tests fail because the routing helper is missing.
- [x] **Step 4: Implement the route helper and installer**, then wire the installer into `src/content/index.ts` so preference changes are read from the existing settings watcher.
- [x] **Step 5: Run the Roadmap landing and popup runtime tests** and confirm only top-level Roadmap entry activation follows the preference.

### Task 3: Versioned release

**Files:**
- Modify: `package.json`
- Modify: `extension/manifest.json`
- Modify: `src/popup/index.html` version fallback
- Modify: `docs/settings.md`
- Modify: `docs/release-validation.md`
- Create: `release/RSI-Enhanced-v0.12.90/` from the current `dist/`
- Create: `release/RSI-Enhanced-v0.12.90-developer-mode.zip`

- [x] **Step 1: Bump all displayed/package versions to 0.12.90** and document the new setting and focused verification.
- [x] **Step 2: Run `pnpm check:settings`, `node --test tests/roadmap-landing.test.mjs tests/popup-settings-runtime.test.mjs`, and `pnpm build`.**
- [x] **Step 3: Run `node scripts/check-release.mjs` after the build.**
- [x] **Step 4: Build the version-matched tester folder with updated tester instructions and cumulative patch notes, then ZIP it from `dist/`; verify its eight generated assets match by SHA-256, its manifest is 0.12.90, and the ZIP has one top-level folder.**
