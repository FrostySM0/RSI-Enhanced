# Default Theme Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Custom palette editor with six additional built-in themes while keeping saved settings safe and readable.

**Architecture:** Extend the existing `PALETTES` and `THEME_NAMES` maps. Remove custom-palette state and controls, leaving the independent accent override. Existing settings normalization will map the legacy `custom` theme ID to the default preset.

**Tech Stack:** TypeScript, browser extension popup HTML/CSS, Node test runner, pnpm build.

**Spec:** `docs/superpowers/specs/2026-10-26-theme-presets.md`

## Global Constraints

- Keep the current lightweight MV3, TypeScript, CSS, and Vite architecture.
- Keep Spectrum and RSI module switches independent and apply palettes through existing variables.
- Keep only `chrome.storage.local` and the existing storage key.
- Run only settings-focused checks and the production build.

## Review Focus

- Existing saved `theme: "custom"` values must normalize to Spectrum Enhanced without losing other preferences or a valid accent.
- All 13 built-in palettes must contain valid colours and meet the 4.5:1 text/accent contrast checks across all four surfaces.
- The settings picker must no longer expose or render custom palette controls.

---

### Task 1: Add and validate built-in theme presets

**Files:**
- Modify: `src/themes/palettes.ts`
- Modify: `src/shared/settings.ts`
- Modify: `src/popup/index.html`
- Modify: `src/popup/index.ts`
- Modify: `src/popup/popup.css`
- Modify: `README.md`
- Modify: `src/themes/README.md`
- Modify: `docs/settings.md`
- Test: `tests/settings.test.mjs`

**Interfaces:**
- Keep the existing `Palette`, `Settings`, `PALETTES`, `THEME_NAMES`, `normalizeSettings`, and `paletteFor` interfaces, with `ThemeId` restricted to built-in theme IDs.
- Add IDs and labels `drake`, `crusader`, `rsi`, `nebula`, `aurora`, and `eclipse`.
- Remove custom palette storage from normalized `Settings`; continue accepting older stored records by ignoring their extra `custom` field and falling back from the legacy `custom` theme ID.

- [x] **Step 1: Update focused tests first**
  - Assert the six new theme IDs exist and `custom` is not a theme ID.
  - Assert 13 built-in palettes resolve to eight valid colour tokens each.
  - Assert a legacy `custom` setting falls back to `enhanced` while retaining a valid accent and unrelated settings.
  - Assert every built-in palette maintains 4.5:1 contrast on the four existing surfaces.
- [x] **Step 2: Run `node --test tests/settings.test.mjs` and confirm it fails on the old theme count and custom-theme behavior.**
- [x] **Step 3: Implement the six palettes, remove Custom palette controls/state, and update theme documentation.** Keep the separate accent override and existing preview behavior.
- [x] **Step 4: Run `pnpm build` and `pnpm check:settings`.** Both must pass.

**Completion:** The packaged popup lists 13 default themes, has no Custom palette editor, applies each palette through the existing system, and legacy Custom settings normalize safely.
