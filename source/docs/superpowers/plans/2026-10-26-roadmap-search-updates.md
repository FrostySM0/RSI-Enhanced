# Roadmap Search and Update Markers Implementation Plan

**Current scope update:** The user asked to remove Roadmap search because it was not working. Search UI and matching logic have been removed; the independent setting and persistent New/Changed marker feature remain. The current user-facing setting label is **Roadmap Updates**.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dynamic Release View search and persistent New/Changed card markers, controlled by an independent extension setting.

**Architecture:** Normalize a separate `roadmapTools` setting and expose it in the popup. A Roadmap-only content module will read native cards, derive search and change state from their live text, persist a stable baseline separately, and update an extension-owned toolbar as the native card list changes. Its CSS will have its own route/setting guard, independent of the existing Roadmap appearance and image viewer module.

**Tech Stack:** TypeScript content script, CSS, Chrome MV3 `storage.local`, Node built-in test runner, Vite build.

**Spec:** `docs/superpowers/specs/2026-10-26-roadmap-search-updates-design.md`

## Global Constraints

- Read only cards RSI has rendered into Release View; do not call an unverified endpoint or maintain a copied card catalogue.
- Search title, status, patch/version text, and description; results link to the native card detail route.
- Baseline the initially rendered cards after the list settles; keep subsequent New/Changed markers until **Mark all seen** updates the baseline.
- `roadmapTools` is independent of `rsi.roadmap`; disabling the tool removes its UI/observer but preserves stored update history.
- Use only `chrome.storage.local`; add no permissions, polling, framework, or network request.
- Keep selectors based on the supplied native card structure and extension-owned UI; render dynamic text with `textContent`.

## Review Focus

- Initial cards are not mislabeled New while the client-rendered card list is still filling — baseline only after a non-empty settled list; test a delayed initial insertion.
- Patch search works even when version text is in the description rather than title — assert both extraction locations.
- A card keeps a stable identity if its slug/query changes — assert normalized stable numeric ID and path fallback.
- Updates survive a route visit and remain pending until explicitly cleared — assert storage-backed marker behavior and clear rebasing.
- Turning off Roadmap appearance does not disable the separate tools or their UI styling — assert independent root guards and route/setting runtime gating.

---

### Task 1: Add the independent Roadmap tools preference

**Files:**
- Modify: `src/shared/settings.ts`
- Modify: `src/content/apply-settings.ts`
- Modify: `src/popup/index.html`
- Modify: `src/popup/index.ts`
- Test: `tests/settings.test.mjs`
- Test: `tests/settings-storage.test.mjs`
- Test: `tests/settings-runtime.test.mjs`
- Test: `tests/popup-settings-runtime.test.mjs`

**Interfaces:**
- Produces `Settings.roadmapTools: boolean`, default `true`, normalized from stored input with the default for older records.
- Exposes `data-rsi-roadmap-tools="on|off"` on the document root and a separate checkbox with id `roadmap-tools` and label **Roadmap Search & Updates**.

- [x] **Step 1: Add failing preference, storage, and popup tests**

Assert that defaults and legacy records enable `roadmapTools`, explicit `false` is preserved, `applySettings` writes the new root attribute, settings storage round-trips `false`, and the packaged popup’s independent labeled checkbox can be changed and saved as `false`.

- [x] **Step 2: Run only the new preference assertions and confirm failure**

Run: `node --test --test-name-pattern='Roadmap tools preference' tests/settings.test.mjs tests/settings-storage.test.mjs tests/settings-runtime.test.mjs` and `node --test tests/popup-settings-runtime.test.mjs`

Expected: the new assertions fail because the preference and checkbox are not implemented.

- [x] **Step 3: Implement preference normalization and popup persistence**

Add the boolean to `Settings` and `DEFAULT_SETTINGS`; normalize it independently of `rsi.roadmap`; add the checkbox under the RSI website controls; include it in `draft()` and `render()`; expose its state through `applySettings()`.

- [x] **Step 4: Run focused settings checks**

Run: `pnpm build` followed by `pnpm check:settings`

Expected: scoped settings TypeScript and settings-only tests pass.

### Task 2: Build Roadmap card indexing and marker helpers

**Files:**
- Create: `src/content/roadmap-updates.ts`
- Test: `tests/roadmap-updates.test.mjs`

**Interfaces:**
- `RoadmapCardSnapshot = { id: string; href: string; title: string; status: string; patch: string; description: string }`.
- `snapshotRoadmapCard(card: HTMLAnchorElement, baseUrl: string): RoadmapCardSnapshot | null` reads the supplied native card structure and resolves only same-origin Release View detail links.
- `searchRoadmapCards(cards: RoadmapCardSnapshot[], query: string): RoadmapCardSnapshot[]` matches title, status, patch, and description while preserving card order.
- `roadmapCardMarkers(baseline: Record<string, RoadmapCardSnapshot>, current: RoadmapCardSnapshot[]): Map<string, 'new' | 'changed'>` compares title, status, patch, and description by stable ID.
- `ROADMAP_UPDATES_STORAGE_KEY = 'rsiEnhanced.roadmapUpdates'` stores `{ version: 1, baseline, pending }` separately from settings; pending marker IDs remain until the user clears them.

- [x] **Step 1: Add failing helper tests**

Cover native card extraction, same-origin route validation, numeric card identity with normalized-path fallback, patch detection in title and description, all four searchable fields, and New/Changed/no-change comparisons.

- [x] **Step 2: Run the helper tests and confirm failure**

Run: `node --test tests/roadmap-updates.test.mjs`

Expected: fail because the helper module is not implemented.

- [x] **Step 3: Implement the pure card and marker helpers**

Read title from `h3`, status from the supplied `StatusBar` element, description from the supplied description paragraph, and patch from a general dotted-version pattern in title/description. Normalize the card URL, preferring its stable numeric ID when present.

- [x] **Step 4: Run the helper tests**

Run: `node --test tests/roadmap-updates.test.mjs`

Expected: all helper assertions pass.

### Task 3: Integrate the live Roadmap tools and independent styling

**Files:**
- Create: `src/content/roadmap-tools.ts`
- Create: `src/styles/rsi/roadmap-tools.css`
- Modify: `src/content/index.ts`
- Modify: `scripts/build.mjs`
- Modify: `tests/fixtures/roadmap-release.html`
- Test: `tests/roadmap-tools-runtime.test.mjs`
- Test: `tests/roadmap-images.test.mjs`

**Interfaces:**
- `installRoadmapTools(enabled: () => boolean, win?: Window, doc?: Document): () => void` installs one toolbar on enabled Release View routes and returns a refresh/teardown function, matching existing content-module lifecycle conventions.
- The module uses `snapshotRoadmapCard`, `searchRoadmapCards`, `roadmapCardMarkers`, and `ROADMAP_UPDATES_STORAGE_KEY` from Task 2.
- The content entry enables the module only when `activeSection === 'roadmap' && settings.roadmapTools`; existing Roadmap styling/image-viewer gating remains `settings.rsi.roadmap`.

- [x] **Step 1: Add failing runtime tests against the native fixture**

Test a second initial card inserted before the settle window expires (neither initial card should be New), query results with patch/status, direct native detail links, live card insertion and edits after baseline, sticky New/Changed markers including reversion and route/setting teardown, **Mark all seen** rebasing, and operation while `rsi.roadmap` appearance is disabled.

- [x] **Step 2: Run the runtime tests and confirm failure**

Run: `node --test tests/roadmap-tools-runtime.test.mjs`

Expected: fail because the Roadmap tools runtime is not implemented.

- [x] **Step 3: Implement the Roadmap-only runtime and user controls**

Insert an extension-owned search/update toolbar immediately below the visible Release View heading, across heading levels, even before any native cards render. If no heading is available, place it inside a safe page content container and never prepend it above global navigation; reposition once the heading appears. After a non-empty initial collection has no card-list mutations for a short debounce window, save its baseline silently. Search current rendered cards; observe the card collection for later card/content changes; persist its baseline and pending marker IDs in `chrome.storage.local`; clear markers only when the user activates **Mark all seen**. Remove the toolbar and observer when disabled or leaving the Roadmap route without deleting persisted state.

- [x] **Step 4: Package the independent tools stylesheet**

Add a separate CSS input to `scripts/build.mjs`, guarded by Roadmap route and `data-rsi-roadmap-tools`, not `data-rsi-roadmap`. Style only extension-owned toolbar, result, and marker classes so disabling Roadmap appearance leaves the tools usable.

- [x] **Step 5: Run Roadmap runtime and viewer regression checks**

Run: `node --test tests/roadmap-tools-runtime.test.mjs tests/roadmap-updates.test.mjs tests/roadmap-images.test.mjs`

Expected: search/marker lifecycle assertions and existing source-image viewer tests pass.

### Task 4: Verify packaged integration

**Files:**
- Verify: `dist/content.js`
- Verify: `dist/rsi.css`
- Test: `tests/roadmap-tools-packaging.test.mjs`
- Test: `tests/settings-runtime.test.mjs`

- [x] **Step 1: Build the extension**

Run: `pnpm build`

Expected: the popup, content script, and independent Roadmap tools stylesheet package successfully.

- [x] **Step 2: Run scoped settings checks after the build**

Run: `pnpm check:settings`

Expected: the new setting survives packaged runtime updates and all settings-only checks pass.

- [x] **Step 3: Verify the independent stylesheet package**

Run: `node --test tests/roadmap-tools-packaging.test.mjs`

Expected: generated Roadmap tools selectors are route- and feature-scoped, and are not guarded by `data-rsi-roadmap`.

- [x] **Step 4: Inspect generated CSS guards and extension diff**

Confirm `dist/rsi.css` contains the route/`roadmapTools` guard and no dependency on `data-rsi-roadmap`; confirm no manifest permissions or unrelated source files changed.
