# Roadmap Update Tracking Removal Implementation Plan

> **For agentic workers:** Execute inline with the approved design; use test-driven development.

**Goal:** Remove Roadmap New/Changed tracking and its controls while keeping image viewing and colour restoration.

**Architecture:** Remove the update tracker from settings, popup, runtime, and CSS packaging. Preserve the separate Roadmap image module and its styles.

**Tech Stack:** TypeScript, CSS, Node test runner, Vite.

**Spec:** `docs/superpowers/specs/2026-10-26-roadmap-updates-removal-design.md`

## Global Constraints

- Preserve native Roadmap cards and navigation.
- Keep the Roadmap source-image viewer and full-colour artwork behavior.
- Do not read or delete the retired update-history storage key.

## Review Focus

- Retired tracker strings and CSS must not remain in the generated extension.
- Image viewer runtime and colour-restoration styling must remain in the generated extension.
- Removing the independent setting must not alter other RSI module settings.

### Task 1: Retire Roadmap update tracking

**Files:** Settings and popup modules, `src/content/index.ts`, `scripts/build.mjs`, and fixture copy; remove tracker source/CSS/tests; add a focused retirement/package test.

- [x] Write a failing test asserting the built runtime and CSS contain no update tracker and retain the image viewer and colour restoration.
- [x] Run that test to confirm it fails against the current package.
- [x] Remove tracker wiring, setting, popup control, generated CSS, and stale tracker tests; update the fixture copy.
- [x] Build and run the Roadmap image/retirement and settings checks.
