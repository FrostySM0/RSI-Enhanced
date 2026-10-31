# Spectrum Home Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Style only the Spectrum Star Citizen community landing page to match the supplied, user-approved mockup while preserving native content and behavior.

**Architecture:** Add an exact-path helper and route marker in the existing content route refresh. Package one new Spectrum theme stylesheet whose selectors are limited to that marker and the verified landing-page containers.

**Tech Stack:** TypeScript, CSS, Vite, Node's built-in test runner.

**Spec:** `docs/superpowers/specs/2026-10-30-spectrum-home-redesign-design.md`

## Global constraints

- Preserve native React markup, links and controls.
- Scope all new visual rules to `/spectrum/community/SC` only.
- Use the existing `theme` module guard and local CSS packaging.
- Bump version to 0.12.97 and preserve earlier tester releases.
- Run focused Spectrum-home checks, production build and release artifact validation only.
- This workspace is not a Git repository; keep the change isolated for manual removal.

## Review focus

- Locale-prefixed and trailing-slash paths must activate the redesign; forum, lobby and other routes must not.
- Route changes must remove the marker before leaving the home page.
- Grid layout must use documented or user-supplied native selectors and must not replace native controls.
- The stylesheet must be absent from output when the Spectrum theme module is disabled.

---

### Task 1: Exact home-route marker

**Files:** `src/shared/site-sections.ts`, `src/content/index.ts`, `tests/rsi-sections.test.mjs`

- [x] Add failing checks for localized and trailing-slash landing paths, and for forum/lobby lookalikes.
- [x] Run `node --test tests/rsi-sections.test.mjs`; confirm the new helper is missing.
- [x] Add `isSpectrumHome(path)` and update the root marker during route refresh.
- [x] Re-run the focused route test.

### Task 2: Home-only visual layer

**Files:** create `src/styles/spectrum-home.css`; update `scripts/build.mjs`; create a small native-structure fixture and `tests/spectrum-home.test.mjs`; update `docs/spectrum-inspection.md`.

- [x] Use only selectors confirmed in the user-provided home-page DOM structure and the existing inspection record.
- [x] Add failing package/scope checks for the dedicated stylesheet and its route guard.
- [x] Implement the visual layer to match the approved mockup while retaining RSI's native elements.
- [x] Run `node --test tests/spectrum-home.test.mjs` and the affected route test.

### Task 3: Versioned tester package

**Files:** `package.json`, `extension/manifest.json`, `src/popup/index.html`, `docs/release-validation.md`, and new `release/RSI-Enhanced-v0.12.97/` plus its developer-mode ZIP.

- [x] Bump displayed/package versions, build, and run `node scripts/check-release.mjs`.
- [x] Package current `dist/` with version-matched tester instructions and cumulative patch notes; verify archive contents and checksums.

**Execution note:** This workspace has no `.git` directory, so no temporary Git worktree or commit-based rollback was possible. The redesign remains isolated in `src/styles/spectrum-home.css`, its single build-list entry, and the exact-route marker; those can be removed without touching the existing forum/chat styles.
