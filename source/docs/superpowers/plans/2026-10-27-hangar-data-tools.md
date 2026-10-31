# Hangar Data Tools Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with the existing Hangar modules and focused regression tests.

**Goal:** Add reusable Hangar pledge metadata, filters, local caching, and CSV/Hangar Transfer Format exports.

**Architecture:** Extend the existing sequential Hangar page index into one normalized pledge dataset, then use it for display, filtering and downloads. Store normalized records locally with expiry and a current-page fingerprint; preserve native card nodes and actions.

**Tech Stack:** TypeScript content scripts, `chrome.storage.local`, existing Node test fixtures and Vite build.

**Spec:** `docs/superpowers/specs/2026-10-27-hangar-data-tools-design.md`

## Global Constraints

- Keep the feature inside the existing Hangar module and exact verified My Gear route.
- Fetch only same-origin Hangar pagination pages sequentially; use no additional API or permission.
- Persist only normalized local Hangar records under a dedicated key; never clear unrelated storage.
- Do not run broad tests or type checks; run the smallest tests for changed Hangar behavior.

## Review Focus

- Missing or changed native value fields must stay unknown rather than become `$0`.
- Account/page fingerprint changes must invalidate old cached records.
- CSV/JSON exports must escape text and flag ship codes that could not be resolved against the catalogue.
- Partial or failed scans must be clearly reported and must not overwrite a complete cache.
- Disabling Hangar must restore cards, controls and native pagination.

---

### Task 1: Normalized pledge data

**Files:** Create `src/content/hangar-data.ts`; modify `src/content/hangar-search.ts`; test `tests/hangar-data.test.mjs` and affected search tests.

- [x] Add failing tests for normalized fields, status/type parsing, unknown values, cache validity and CSV escaping.
- [x] Run only the new Hangar data test and confirm the expected failures.
- [x] Implement normalized data, cache validation, and CSV/transfer serializers.
- [x] Run the focused data and search tests.

### Task 2: Pledge details, filters and exports

**Files:** Modify `src/content/hangar-search.ts`, `src/styles/rsi/hangar.css`, and `tests/hangar-search-runtime.test.mjs`.

- [x] Add runtime tests for cross-page indexing, cache hits and background preload behavior.
- [x] Run the focused runtime test while developing the controls and cache.
- [x] Wire the controls to the shared index; retain native card nodes and native pager restoration.
- [x] Run focused Hangar runtime/data tests.

### Task 3: Local cache

**Files:** Modify `src/content/hangar-search.ts`; test `tests/hangar-search-runtime.test.mjs`.

- [x] Add tests for valid cache hits, expiry and fingerprint mismatch.
- [x] Implement a versioned local-storage cache with a short expiry and a bounded record count.
- [x] Run the focused cache/runtime tests.

### Task 4: Preload measurement

**Files:** Modify Hangar test fixtures/runtime test only unless evidence supports production changes.

- [x] Verify deferred background indexing and a warm search that performs no pagination fetches.
- [x] Enable preloading after a 1.5-second delay; search stays usable while it runs, and completed scans are cached for repeat searches.
- [x] Document that real RSI timing remains unmeasured; the fixture proves request reuse, not account-network performance.

### Task 5: Feature-scoped verification and docs

**Files:** Update `docs/hangar-workspace.md` and `README.md`.

- [x] Run the focused Hangar tests, scoped TypeScript check and production build.
- [x] Inspect the final source and document exact checks plus the limits of synthetic/live verification.
