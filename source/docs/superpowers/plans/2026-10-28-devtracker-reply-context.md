# Dev Tracker Reply Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Show each Dev Tracker entry's actual parent Spectrum post, author name and avatar, in the approved inline context design.

**Architecture:** Extract the reply ID from each native Dev Tracker link. Use a small same-origin API helper to validate the target and retrieve only its immediate parent (or the original post), then render the author and text into a theme-aware inset panel. A route- and setting-gated content module handles current and Auto Loaded cards and aborts outstanding reads on cleanup.

**Tech Stack:** TypeScript, existing Manifest V3 content bundle, CSS custom properties, Node built-in test runner.

**Spec:** `docs/devtracker-reply-context.md` and the user-approved mockup in the conversation.

## Global Constraints

- Target desktop Chromium 118+; keep the API permission set unchanged.
- Keep reads same-origin and read-only; use DOM text nodes and validated URLs.
- Preserve native Dev Tracker thread anchors, Spectrum navigation and Auto Load.
- Use the active RSI theme and selected font; do not access the user's browser.
- Bump the extension version for this update and verify only affected behavior.

## Review Focus

- Parent selection resolves the direct parent rather than the thread topic or developer reply — API helper tests.
- Root-level replies display the original thread post and its author — root fallback test.
- Missing, erased, malformed and cross-thread data never creates guessed or unsafe content — validation tests.
- Native Auto Load cards receive context and module/route cleanup aborts in-flight work — fixture/runtime checks.
- Selected font and theme remain applied and the new panel stays readable — packaged CSS assertions.

---

### Task 1: Resolve and normalize the direct parent

**Files:**
- Modify: `src/content/spectrum-conversation.ts`
- Test: `tests/spectrum-conversation.test.mjs`

- [x] Add tests first for a direct reply parent, original-thread fallback, cross-thread rejection, deleted parent and plain-text extraction.
- [x] Run the focused Spectrum conversation tests and confirm the new cases fail.
- [x] Implement a narrow `loadReplyParent` helper using the verified same-origin reply/nested endpoints; validate IDs and thread membership.
- [x] Run the focused tests and confirm they pass.

### Task 2: Render context on Dev Tracker cards

**Files:**
- Create: `src/content/devtracker-context.ts`
- Modify: `src/content/index.ts`
- Modify: `tests/fixtures/devtracker.html`
- Create: `tests/devtracker-context.test.mjs`

- [x] Add focused tests for reply URL extraction, context rendering contracts and route/setting gating.
- [x] Run the new tests and confirm they fail before implementation.
- [x] Add bounded card processing, safe parent author/avatar/text rendering, Auto Load handling and abortable cleanup.
- [x] Wire the module to the existing route and settings refresh lifecycle.
- [x] Run the focused tests and confirm they pass.

### Task 3: Match the approved design and selected font

**Files:**
- Modify: `src/styles/rsi/devtracker.css`
- Modify: `tests/rsi-sections.test.mjs`
- Modify: `docs/rsi-inspection.md`
- Modify: `README.md`

- [x] Assert the inset context panel, response label, theme variables and selected-font usage.
- [x] Style parent metadata and quote for readability while retaining the existing card layout and hover treatment.
- [x] Document the verified reply-parent data contract and constraints.

### Task 4: Package and verify

**Files:**
- Modify: `package.json`, `extension/manifest.json`, `src/popup/index.html`, `README.md`

- [x] Bump all extension version surfaces once.
- [x] Run `pnpm build` and only the Dev Tracker, Spectrum conversation and affected runtime/package tests.
- [ ] Verify generated bundle assets and version values.
