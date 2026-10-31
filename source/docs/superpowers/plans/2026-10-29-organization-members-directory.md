# Organization Members Directory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved members-page mockup to every organization while preserving RSI search, filters, profile links, and scroll-loaded entries.

**Architecture:** Keep RSI's native member form and `<ul id="members-data">` as the source of truth. This is a CSS-only redesign in the Organizations stylesheet; selectors target direct `#members-data > .member-item` entries so RSI's existing scroll loader can append members unchanged.

**Tech Stack:** Scoped CSS, Node.js feature test, Vite extension build.

**Spec:** `docs/mockups/organizations-itcn-members.html` and the user's approved screenshot; live structure supplied as outerHTML for `.search-members`, `.listing-members`, `#members-data`, and `.member-item`.

## Global Constraints

- Keep selectors below `#bodyWrapper`; do not touch the shared RSI header.
- Preserve native search/reset actions, radio inputs, member anchors, privacy restrictions, and the `#members-data` list so RSI's scroll loader continues to append entries.
- Chromium desktop only; do not add dependencies or member-specific mobile rules.
- Run only Organizations/member-page checks and the required build/package steps.
- Do not push or publish.

## Review Focus

- Newly appended entries match the direct `#members-data > .member-item` selector, so no reinitialization is needed; verify that selector in the focused source test.
- RSI's search, reset, radio filters, member anchors, and loader remain in place because implementation is CSS-only.
- Keep `.member-visibility-restriction` above its entry and leave the native restricted-row markup intact.
- Scope selectors to the member route under `#bodyWrapper` and use no organization-specific identifiers.
- Keep the existing two-column breakpoint at 1040px; no visual browser-width check was performed in this turn.

---

### Task 1: Redesign the native member directory

**Files:**
- Modify: `src/styles/rsi/organizations.css`
- Modify: `src/content/index.ts` and add a focused enhancer only if layout labels cannot be achieved with CSS
- Create: `tests/organization-members.test.mjs`
- Modify: `docs/rsi-inspection.md`
- Modify: extension/package version and matching `release/` tester package

**Interfaces:**
- Consumes: RSI's native `.search-members.legacy-form`, `.filter-members`, `.listing-members`, `#members-data > .member-item`, and `.membercard` markup.
- Produces: a three-column, full-width roster using the approved mockup; native-loaded member entries inherit the card styling automatically.

- [x] Write focused failing tests for native controls, direct-list card layout, organization-generic scope, and package inclusion; run the focused test and confirm the new contract fails before CSS implementation.
- [x] Implement the CSS-only redesign. RSI keeps ownership of native search/filter controls, profile anchors, privacy restrictions, list entries and scroll loader.
- [x] Update the inspection note and create the matching developer tester release for the new version.
- [x] Run the focused member test, `pnpm build`, and `node scripts/check-release.mjs`; inspect the packaged CSS and manifest version.
