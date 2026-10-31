# Saved Forum Threads Implementation Plan

> **For agentic workers:** Execute inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reversible, extension-local saved forum threads with a title-only sidebar list, a small per-row save control, and a setting that hides the feature without erasing saved data.

**Architecture:** Store thread records under an independent `chrome.storage.local` key. A route-scoped content module adds controls to observed thread-list rows and a title-only sidebar group, including a remove button for each saved entry. On thread pages, new favorites route into the local list; a click on a matching legacy native bookmark removes that native entry and any duplicate local entry. A module setting hides the UI while preserving saved data and restoring the native control.

**Tech Stack:** TypeScript, Manifest V3 content script, CSS custom properties, Node test runner.

**Spec:** User-approved saved-thread mockup and follow-up requirements in the current conversation; existing contracts in `docs/spectrum-inspection.md`.

## Global Constraints

- Preserve native Spectrum navigation and behavior; no guessed mutation/API calls.
- Do not inspect the user's browser; use the supplied DOM contracts and local fixtures.
- Store saved threads separately from appearance settings so Reset and disabling the feature preserve them.
- Validate same-origin Spectrum thread URLs and render stored titles with `textContent`.
- Run only settings, saved-thread, and directly affected packaging checks.

## Review Focus

- Malformed or cross-origin saved URLs must not create unsafe links.
- Unrelated native bookmarks must never be changed.
- A fresh thread-page favorite click is captured into Saved Threads. If the exact thread already has legacy native bookmark state, an explicit click may reach Spectrum only to remove that matching entry.
- Dynamic forum rows and sidebar mounts must receive controls without observer loops.
- Turning the setting off hides controls but retains saved data.
- Removing an extension save does not silently remove an unrelated or non-matching native bookmark.

---

### Task 1: Settings toggle

**Files:** Modify `src/shared/settings.ts`, `src/content/apply-settings.ts`, `src/popup/index.html`, `src/popup/index.ts`; test `tests/settings.test.mjs`.

- [x] Add a failing test for default-on `modules.savedThreads`, false preservation, and the root attribute.
- [x] Run the focused settings test to confirm the missing setting fails.
- [x] Add a Saved forum threads module checkbox and settings mapping; document that disabling hides UI but retains saves.
- [x] Run the focused settings test.

### Task 2: Saved-thread data contract

**Files:** Create `src/shared/saved-threads.ts`; test `tests/spectrum-saved-threads.test.mjs`.

- [x] Test same-origin thread URL validation, title sanitization, de-duplication, and toggling without touching settings storage.
- [x] Run the focused test to confirm the missing contract fails.
- [x] Implement a bounded normalized record store and `rsiEnhanced.savedThreads` key.
- [x] Run the focused test.

### Task 3: Forum and sidebar UI

**Files:** Create `src/content/spectrum-saved-threads.ts`, `src/styles/spectrum-saved-threads.css`; modify `src/content/index.ts`, `scripts/build.mjs`, `tests/fixtures/spectrum-forums.html`, and `docs/spectrum-inspection.md`; test `tests/spectrum-saved-threads.test.mjs` and Spectrum packaging.

- [x] Add failing runtime tests for row save controls, title-only sidebar links, local sidebar removal, dynamic content, and hidden-but-retained state.
- [x] Run the focused tests to confirm the runtime behavior is absent.
- [x] Implement route-scoped local-only UI and a guarded stylesheet; leave sidebar bookmarks and online-user/chat DOM unchanged.
- [x] Run the focused saved-thread tests, build, and saved-thread CSS packaging check.
- [x] Record validation limits and the local-only save behavior in `docs/spectrum-inspection.md`.

### Follow-up: route thread-page favorites into Saved Threads

- [x] Reproduce native thread-favorite activation and prove the native bookmark action currently runs.
- [x] Capture a fresh thread-page favorite before Spectrum's delegated click handler and persist it in `rsiEnhanced.savedThreads`; preserve Spectrum's native removal path for an already-bookmarked legacy thread.
- [x] Cover save/remove, storage-read startup delay, and restoration of the native control when the setting is disabled.
- [x] Update the inspection record and release patch notes; live authenticated behavior remains unverified.

### Follow-up: recover legacy thread bookmarks and polluted titles

- [x] Reproduce the tester's dual-bookmark state and hidden notification text in the focused fixture.
- [x] Let a click on an already-native-bookmarked thread remove only that matching legacy bookmark; clear a duplicate local save at the same time.
- [x] Extract heading text after removing interactive notification/subscription controls, and normalize old records with known appended notification labels.
- [x] Recover if a legacy native unbookmark click does not complete: restore its active state after a bounded timeout so the user can retry.
- [x] Verify the saved-thread feature test, build and version-matched tester release; authenticated live behavior remains unverified.
