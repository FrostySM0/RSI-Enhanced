# Roadmap Release View Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore colour to Star Citizen Release View card images and let users view and open each card's source image.

**Architecture:** Add a strict `roadmap` route and independent RSI settings switch. A small roadmap content module reads the observed `figure[media]` URL and opens it in a native dialog with one source link. Delegated mouse and keyboard handling supports React-rendered cards without rewriting RSI's native card markup. Independently guarded CSS removes grayscale only from Release View card thumbnails.

**Tech Stack:** TypeScript content script, scoped CSS, existing Node test runner and Vite packaging.

**Spec:** `docs/superpowers/specs/2026-10-26-roadmap-release-images-design.md`

## Global Constraints

- Preserve native Release View card content, React ownership, status and detail navigation.
- Limit behavior and styling to `/roadmap/release-view` and its card thumbnails.
- Use the card's `media` attribute first and its `background-image` URL only as fallback. For RSI media-host URLs ending in `product_thumb_large.<format>`, replace that rendition with `source.<same format>`; preserve other URLs.
- Add no permissions, dependencies, background worker, polling or MutationObserver.
- Keep the Roadmap module independently switchable and default it on for existing settings.
- Run only Roadmap, settings and directly affected packaging checks.

## Review Focus

- Similar or nested routes must not activate the new module; test locale prefixes, exact view root and release-card paths in Task 1.
- Existing saved settings without `roadmap` must normalize to enabled, while explicit false remains off; test in Task 1.
- Invalid or unsafe image URLs must not enter the dialog or source link; test in Task 2.
- Source and thumbnail URLs can differ or include query strings; test media precedence and CSS URL fallback in Task 2.
- Dialog close, focus return, and native card navigation must remain usable; cover event handling in the local roadmap fixture in Task 3.

---

### Task 1: Roadmap route and independent setting

**Files:**
- Modify: `src/shared/site-sections.ts`
- Modify: `src/shared/settings.ts`
- Test: `tests/rsi-sections.test.mjs`
- Test: `tests/settings.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Produces `sectionForPath(path) === 'roadmap'` for the observed Release View route and descendants only.
- Produces `RSI_SECTIONS.roadmap === 'Roadmap'` and `Settings.rsi.roadmap` with a default of `true`.

- [x] **Step 1: Add failing route and settings assertions** for `/roadmap/release-view`, a localized release-card route, neighboring invalid paths, default enablement, and explicit saved `false`.
- [x] **Step 2: Run the focused tests** with `node --test tests/rsi-sections.test.mjs tests/settings.test.mjs`; confirm the new assertions fail because the route and setting do not exist.
- [x] **Step 3: Implement the strict route and setting** by adding the Roadmap entry to `RSI_SECTIONS`, recognizing only `/roadmap/release-view` and descendants, and adding `roadmap: true` to defaults. Existing normalization already derives keys from `RSI_SECTIONS`.
- [x] **Step 4: Rerun the focused tests** and confirm route isolation and settings migration pass.

### Task 2: Safe source-image handling and viewer runtime

**Files:**
- Create: `src/content/roadmap-images.ts`
- Modify: `src/content/index.ts`
- Test: `tests/roadmap-images.test.mjs`

**Interfaces:**
- `roadmapImageUrl(media: string, background: string, base: string): string | null` returns a validated HTTP(S) URL, preferring `media`.
- `installRoadmapImageViewer(enabled, win, doc): () => void` returns a route/settings refresh function and uses delegated click/keyboard events so current and later React cards work without polling or observers.

- [x] **Step 1: Add failing tests** for media precedence, background fallback, query preservation, unsafe URL rejection, and filename sanitization.
- [x] **Step 2: Run `node --test tests/roadmap-images.test.mjs`** and confirm the new exports are missing.
- [x] **Step 3: Implement the URL helper and delegated accessible image viewer.** Use `figure[media]` within `/roadmap/release-view/` cards; image clicks and Space on the focused card open the viewer, while Enter and card-detail clicks outside the image retain native navigation. Provide Close and Open source image controls; saving is available through the browser context menu on the source tab.
- [x] **Step 4: Integrate the viewer with the existing content entry**, gated by `activeSection === 'roadmap' && settings.rsi.roadmap`, and refresh it on route/settings changes.
- [x] **Step 5: Rerun `node --test tests/roadmap-images.test.mjs`** and confirm all helper cases pass.

### Task 3: Roadmap image styling, fixture and packaging verification

**Files:**
- Create: `src/styles/rsi/roadmap.css`
- Modify: `scripts/build.mjs`
- Create: `tests/fixtures/roadmap-release.html`
- Modify: `tests/preview-theme.mjs`
- Modify: `tests/rsi-sections.test.mjs`
- Test: `tests/roadmap-images.test.mjs`
- Modify: `docs/rsi-inspection.md`
- Modify: `docs/settings.md`

**Interfaces:**
- Packaged Roadmap styles are guarded by `@scope (:root[data-rsi-section="roadmap"]:not([data-rsi-roadmap="off"]))`.
- Release cards keep their native `<a>` targets; the fixture includes the supplied `Card__StyledNavLink` and `figure[media]` structure.

- [x] **Step 1: Add failing packaging/fixture assertions** that Roadmap CSS is packaged behind its route and module guard, thumbnails have no grayscale filter, and the fixture contains two native cards with distinct media URLs and intact detail links.
- [x] **Step 2: Run the targeted Roadmap and route tests** and confirm they fail on missing packaging and fixture behavior.
- [x] **Step 3: Add Roadmap thumbnail/dialog styles and package the stylesheet** as an independent RSI module. Wire `/roadmap/release-view` to the local fixture server, document the supplied card structure in `docs/rsi-inspection.md`, and update README/settings module lists.
- [x] **Step 4: Run `pnpm build`, `pnpm check:settings`, and `node --test tests/rsi-sections.test.mjs tests/settings.test.mjs tests/roadmap-images.test.mjs`.** Confirm the build, settings TypeScript/tests, exact route/module guards, and all Roadmap checks pass.

