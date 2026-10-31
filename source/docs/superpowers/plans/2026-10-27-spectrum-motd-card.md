# Spectrum MOTD Card Implementation Plan

> **For agentic workers:** Execute inline in this workspace; use the focused test and build below.

**Goal:** Redesign the Spectrum lobby Message of the Day as a readable full-width dark announcement card shared by General and Testing.

**Architecture:** CSS-only changes in the existing lobby-scoped chat module. Keep the native message structure, links, close control and scrolling behavior.

**Tech Stack:** CSS custom properties, Node.js test runner, Vite build.

**Spec:** `docs/superpowers/specs/2026-10-27-spectrum-motd-card-design.md`

## Global Constraints

- Keep chat CSS scoped to `#react #page.lobby`.
- Use existing palette tokens and do not add runtime dependencies or JavaScript.
- Preserve native content, controls, scrolling and virtualized row dimensions.

## Review Focus

- The card stays full width: do not set a fixed width or max width.
- Native rendering remains in control: do not change display, position, overflow or pointer-events on the wrapper.
- Links and close control stay visible and keyboard reachable.
- The announcement treatment is the same across lobby channels.
- The generated Spectrum CSS contains the source styling.

### Task 1: Style and package the lobby MOTD card

**Files:**
- Modify: `src/styles/spectrum-chat.css`
- Modify: `tests/spectrum-theme.test.mjs`
- Modify: `package.json`, `extension/manifest.json`, `README.md`
- Modify: `docs/spectrum-inspection.md`
- Test: `tests/spectrum-theme.test.mjs`

**Interfaces:** The CSS consumes existing `--rsi-*` tokens; Vite packages it into `dist/spectrum.css` under the existing theme guard.

- [x] Add a focused MOTD style contract test and run it to confirm it fails before the change.
- [x] Add full-width card styling and readable text/link/focus treatments without changing native layout behavior.
- [x] Bump the patch version, build, and run the MOTD test plus release-package check.
- [x] Verify the generated CSS contains the lobby-scoped card rules and package the tester ZIP with a single top-level folder.
