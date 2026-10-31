# Website Font Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users select a readable font across Spectrum and RSI while preserving each area’s existing typeface under “Site default.”

**Architecture:** Add a validated `fontFamily` setting to the existing saved settings model and Appearance popup. `applySettings` sets one shared CSS variable only for explicit selections; the default removes it so existing per-area fallbacks remain active. Existing CSS declarations will reference that variable with their current family stack as fallback.

**Tech Stack:** TypeScript, CSS custom properties, Vite, Node test runner.

**Spec:** `docs/font-selector-design.md`

## Global Constraints

- Target Chromium desktop browsers, including Brave, Chrome and Edge (118+).
- Settings use only `chrome.storage.local` at `rsiEnhanced.settings`; preserve explicit Save/Reset behavior.
- Keep runtime dependencies minimal and leave the extension popup’s own typography unchanged.
- Do not change monospaced code blocks or page modules whose styling is disabled.

## Review Focus

- Missing legacy `fontFamily` values must normalize to `default` and keep current site fonts.
- Invalid stored values must safely fall back to `default`.
- Every supported explicit selection must map to a valid local CSS family stack.
- Returning to `default` must remove the shared override, not leave the prior choice applied.
- The dropdown must load, save, and reset with the other settings, and its chosen family must be referenced by both Spectrum and RSI styling modules.

---

### Task 1: Persist and apply the website font choice

**Files:**
- Modify: `src/shared/settings.ts`
- Modify: `src/content/apply-settings.ts`
- Modify: `src/popup/index.html`
- Modify: `src/popup/index.ts`
- Modify: `src/themes/tokens.css`
- Modify: `src/styles/spectrum-forums.css`
- Modify: `src/styles/spectrum-chat.css`
- Modify: `src/styles/spectrum-notifications.css`
- Modify: `src/styles/spectrum-saved-threads.css`
- Modify: `src/styles/spectrum-blocks.css`
- Modify: `src/styles/rsi/*.css` where the enhanced modules set a font family
- Test: `tests/settings.test.mjs`

**Interfaces:** `Settings.fontFamily` is `'default' | 'arial' | 'segoe-ui' | 'verdana' | 'tahoma' | 'trebuchet-ms' | 'system-ui'`. `applySettings` sets `--rsi-selected-font-family` for explicit values and removes it for `default`.

- [x] **Step 1: Write failing tests** for legacy and invalid values defaulting to `default`, accepted choices, setting/removing the shared root CSS variable, and popup option/save/load/reset wiring. Add a CSS assertion that every Spectrum and RSI font declaration uses the shared variable while preserving its current fallback.
- [x] **Step 2: Verify the tests fail for the missing feature** with `node --test tests/settings.test.mjs`.
- [x] **Step 3: Implement the setting and popup selector.** Add the six explicit font stacks, first option “Site default,” include `fontFamily` in draft/render, and set or remove the root variable in `applySettings`.
- [x] **Step 4: Route existing extension typography through the variable.** Keep each declaration’s current family as the variable fallback; preserve monospace declarations.
- [x] **Step 5: Run the focused checks.** Run `node --test tests/settings.test.mjs`, then `pnpm build` and `pnpm check:settings`; inspect the generated Spectrum and RSI CSS for the shared variable and existing default fallbacks. Add and run a regression proving notifications do not depend on the independently guarded chat font.
