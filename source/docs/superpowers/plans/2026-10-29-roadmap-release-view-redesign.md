# Roadmap Release View Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Release View mockup to the extension while keeping RSI's global header, live release data, native cards, card artwork, navigation and interactions intact.

**Architecture:** Build on the independently guarded Roadmap stylesheet and style the observed RSI page structure in place. Keep native anchors and `figure[media]` artwork, avoid static mock data or replacement controls, and scope layout changes to the Release View page. No new runtime code or dependencies unless the verified DOM requires a narrowly scoped route marker.

**Tech Stack:** Manifest V3 extension, route-scoped CSS, existing Node test runner and Vite packaging.

**Spec:** User-approved mockup in `docs/mockups/roadmap-release-view/` and the pasted Roadmap redesign brief.

## Global Constraints

- Preserve RSI's global navigation/header unchanged.
- Keep native release titles, status labels, descriptions, media backgrounds, detail links and controls.
- Retain image viewing/source-link behavior from `src/content/roadmap-images.ts`.
- Keep styling inside the existing Roadmap module guard; do not add dependencies, permissions, polling or observers.
- Use actual RSI-provided release data only; exclude preview-only copy and fabricated metadata.
- Run only Roadmap-focused checks and the required build.

## Review Focus

- The global RSI navigation must remain untouched; verify the fixture's header retains its base computed layout.
- Native image backgrounds and links must survive card restyling; verify image source and href on the live-structure fixture.
- Cards inserted by RSI after initial render must inherit styling automatically; verify a late native card in the fixture.
- Long titles and descriptions must not overlap or clip; verify wrapping and overflow at desktop and narrower desktop widths.
- Roadmap detail routes and disabled-module state must not inherit Release View layout; verify the route/module scoping output.

---

### Task 1: Restyle the native Release View

**Files:**
- Modify: `src/styles/rsi/roadmap.css`
- Modify: `src/content/index.ts` and `src/shared/site-sections.ts` only if an exact Release View route marker is required
- Modify: `tests/fixtures/roadmap-release.html`
- Test: Roadmap-specific CSS/fixture assertions
- Test: `tests/roadmap-images.test.mjs`

**Interfaces:**
- Existing Roadmap image viewer and `/roadmap/release-view` settings guard remain unchanged.
- Native Roadmap elements stay RSI-owned; extension behavior is applied as CSS and any required route marker only.

- [x] **Step 1: Add a focused failing fixture assertion** for the verified native header/content/column/card structure, artwork, status and detail links.
- [x] **Step 2: Run the targeted assertion** and confirm it fails because the production layout styles are absent.
- [x] **Step 3: Implement the approved visual layout** with existing project tokens, preserving native global navigation and card image backgrounds.
- [ ] **Step 4: Verify Roadmap layout and image behavior** at desktop and narrower desktop widths, including a dynamically appended native card and unchanged detail navigation.
- [x] **Step 5: Run `pnpm build` and Roadmap-only tests**; confirm the Roadmap CSS remains independently guarded and the image viewer still works.

Desktop follow-up: the live page was visually rechecked at 1249 CSS pixels after both the flex-layout and native left-padding corrections; the first release column, expanded card artwork, navigation, and controls were visible. Narrower desktop and dynamically appended-card visual checks remain open.
