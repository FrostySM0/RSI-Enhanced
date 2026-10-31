# Roadmap Modal Tint and Image Viewer Restoration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the cyan wash behind the native Roadmap detail popup and restore a separate image viewer for card artwork.

**Architecture:** Clear the background and visual filters on RSI's full-screen `.Modal` layer while preserving its native detail modal. Restore a route- and setting-gated delegated artwork viewer using a native `<dialog>` and validated card media URLs; clicks outside artwork continue through the native detail link.

**Tech Stack:** TypeScript content script, scoped CSS, Node test runner, Vite build.

**Spec:** Current Roadmap modal screenshots and `docs/rsi-inspection.md`.

## Global Constraints

- Preserve native Roadmap detail activation, controls, and card artwork.
- Keep styling and viewer behavior inside the Roadmap route and setting guard.
- Use only validated HTTP(S) card media URLs and no new permissions or dependencies.
- Bump the extension version and create a version-matched tester package without replacing prior releases.

## Review Focus

- The native full-screen `.Modal` layer can tint the page independently of its wrapper and close target; clear all three layers.
- Only card artwork clicks open the image viewer; card-title/detail clicks retain native behavior.
- Invalid or unsafe media URLs must not open a viewer.
- Closing the viewer returns focus to the originating card.

---

### Task 1: Pin the modal and viewer behavior

**Files:**
- Modify: `tests/rsi-sections.test.mjs`
- Modify: `tests/roadmap-removal.test.mjs`
- Create: `tests/roadmap-image-viewer.test.mjs`

- [x] Add failing checks for a transparent `.Modal-sc-` layer, secure media resolution, artwork-only viewer activation, native detail clicks, and packaged viewer runtime.
- [x] Run the focused checks and confirm they fail because the modal-layer rule and viewer module are missing.

### Task 2: Restore source behavior

**Files:**
- Modify: `src/styles/rsi/roadmap.css`
- Create: `src/content/roadmap-image-viewer.ts`
- Modify: `src/content/index.ts`
- Modify: `docs/rsi-inspection.md`

- [x] Clear background, image, filter, and backdrop effects on the native wrapper, `.Modal`, and close target.
- [x] Restore a delegated, route/setting-gated image dialog while preserving native card detail clicks.
- [x] Rerun the Roadmap-specific tests.

### Task 3: Package and verify

**Files:**
- Modify: `package.json`
- Modify: `extension/manifest.json`
- Create: `release/RSI-Enhanced-v<version>/`
- Create: `release/RSI-Enhanced-v<version>-developer-mode.zip`

- [x] Build and run the focused Roadmap tests plus the release artifact check.
- [x] Create and inspect the tester package for the matching manifest version.
