# RSI Enhanced Regression Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dependable full-project regression workflow and a local Chrome fixture review for the extension's existing feature areas.

**Architecture:** Keep the existing focused Node tests and use Node's built-in test discovery for the full run. Add one verification command that builds, runs the tests, and checks the packaged extension; extend the existing local preview fixture only where needed to review both Messages states.

**Tech Stack:** Node.js 22+, pnpm, built-in `node:test`, Vite, HTML/CSS fixtures, Chrome.

**Spec:** `docs/superpowers/specs/2026-10-30-regression-suite-design.md`

## Global Constraints

- Use Node's built-in test runner, pnpm, TypeScript, Vite, and existing local fixtures.
- Keep the extension's production dependency set unchanged.
- Browser review uses localhost fixtures in desktop Chrome; it must not depend on a signed-in site session.
- Automated fixture-route checks may use loopback only and make no external network requests.
- Preserve existing focused commands.
- Do not add blanket lint or repository-wide TypeScript checks.
- Do not change the extension version for test-only work; if a real product fix becomes necessary, bump the version and refresh the matching tester package.
- Report automated tests and browser observations separately.

## Review Focus

- Roadmap and forum style assertions can go stale when the product moves to a palette token or updated spacing; pin assertions to the active rule and token contract in Task 1.
- The website font setting should style text while decorative Funding and Roadmap search glyphs keep their fixed font and size; pin all contracts in Task 1.
- Messages needs a visible local example for both unread populated and empty states; pin the fixture route and content in Task 3.
- Spectrum and RSI selectors must remain route/module guarded; retain the existing packaging assertions and include them in Task 2's full test command.
- Generated assets and manifest must match the built release; use Task 2's build-first verification command and Task 4's end-to-end run.

---

### Task 1: Reconcile the Three Baseline Failures

**Files:**
- Modify: `tests/rsi-sections.test.mjs`
- Modify: `tests/spectrum-forum-list.test.mjs`
- Modify: `tests/settings.test.mjs`
- Read-only reference: `src/styles/rsi/roadmap.css`, `tests/roadmap-card-readability.test.mjs`, `src/styles/spectrum-forums.css`, `src/themes/tokens.css`, `src/styles/rsi/funding.css`

**Interfaces:** No production interface changes. Tests should describe the current approved CSS behavior, not reproduce selectors as brittle whole-file snapshots.

- [x] **Step 1: Reproduce the failures**

Run: `node --test --test-name-pattern="Roadmap release view|forum list rows|font declarations use the shared selection" tests/rsi-sections.test.mjs tests/spectrum-forum-list.test.mjs tests/settings.test.mjs`

Expected: the three known baseline assertions fail.

- [x] **Step 2: Correct the Roadmap expectation**

In `tests/rsi-sections.test.mjs`, update test `Roadmap release view keeps native card detail activation and the redesigned native popup styles` to expect the current readable description padding `10px 10px 12px`, consistent with `tests/roadmap-card-readability.test.mjs` and `src/styles/rsi/roadmap.css`.

- [x] **Step 3: Correct the forum marker expectation**

In `tests/spectrum-forum-list.test.mjs`, update test `forum list rows use separated surfaces and keep gold developer markers` to assert `background: var(--rsi-highlight)` on the marker in both source and packaged CSS; keep the palette's resolved gold value covered by theme-token tests.

- [x] **Step 4: Scope the font assertion to text and the intentional glyph exception**

In `tests/settings.test.mjs`, update test `Spectrum and RSI font declarations use the shared selection with their current families as fallback, except fixed icon glyphs` so ordinary text font declarations must use `--rsi-selected-font-family`, while the verified Funding page-title `$` pseudo-element is checked for `700 28px/1 Arial, Helvetica, sans-serif` and the Roadmap search `⌕` pseudo-element is checked for `22px/1 Arial, sans-serif`. Do not modify product CSS for this test-only correction.

- [x] **Step 5: Run the focused regression tests**

Run the same command from Step 1.

Expected: all selected tests pass; no CSS or generated package files change.

### Task 2: Add Full Automated Test and Verification Commands

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `pnpm test` builds `dist/`, then runs `node --test` to discover all project tests.
- Produces: `pnpm verify` runs `pnpm test` (build plus tests), then `pnpm check:release`, stopping if a stage fails.
- Preserves: `check:scaffold`, `check:theme`, `check:settings`, and `check:release`.

- [x] **Step 1: Add the scripts**

Add the two package scripts exactly as described in the Interfaces block. The test command owns the build step because existing tests read generated `dist/` files; verification reuses that build. Do not add dependencies or a custom runner.

- [x] **Step 2: Verify the package scripts are parseable**

Run: `node -e "const p=require('./package.json'); if (p.scripts.test !== 'pnpm build && node --test' || p.scripts.verify !== 'pnpm test && pnpm check:release') process.exit(1)"`

Expected: exit code 0.

### Task 3: Add an Empty Messages Fixture and Testing Guide

**Files:**
- Create: `tests/fixtures/spectrum-messages-empty.html`
- Create: `tests/fixtures/spectrum-messages-native.css`
- Modify: `tests/preview-theme.mjs`
- Modify: `tests/spectrum-messages.test.mjs`
- Modify: `tests/fixtures/extension-api.js`
- Modify: `tests/fixtures/spectrum-messages.html`
- Create: `docs/testing.md`

**Interfaces:**
- Produces: `http://127.0.0.1:4173/spectrum/messages-preview` serves the existing populated unread conversation fixture.
- Produces: `http://127.0.0.1:4173/spectrum/messages-empty-preview` serves an empty state fixture using the same native header and approved CSS.
- The Messages test starts the actual preview server on an ephemeral port and verifies both HTTP routes, local native drawer geometry, current popup assets and the manifest-matched preview version.
- `docs/testing.md` maps feature areas to focused tests and documents the automated commands and manual Chrome fixture checks.

- [x] **Step 1: Add the failing fixture contract test**

Add an HTTP integration test in `tests/spectrum-messages.test.mjs` that launches `tests/preview-theme.mjs` with `RSI_ENHANCED_FIXTURE_PORT=0`, waits for its listening address, and requests `/spectrum/messages-preview` and `/spectrum/messages-empty-preview`. Assert that both return 200, the populated route contains the unread direct-message row, and the empty route contains `NO MESSAGES` plus its native New button without a direct-message row.

Run: `node --test tests/spectrum-messages.test.mjs`

Expected: FAIL because the server does not yet report an ephemeral port or serve the two Messages routes.

- [x] **Step 2: Add the empty-state fixture and preview routes**

Create a second static fixture from the observed Messages header structure with the native `.m-emptyState.t-messagesEmptyState` title, body, and New action. Add native drawer geometry shared by both local Messages fixtures, add the explicit Spectrum routes, serve built image assets, derive the local preview version from the manifest, allow `RSI_ENHANCED_FIXTURE_PORT` to override its default port for isolated test runs, and report the actual bound address.

- [x] **Step 3: Run the Messages regression test**

Run: `node --test tests/spectrum-messages.test.mjs`

Expected: PASS for populated and empty fixture contracts, including both preview routes.

- [x] **Step 4: Document coverage and browser review**

Create `docs/testing.md` with:
- The exact behavior covered by `pnpm test` and `pnpm verify`.
- A compact feature-to-test map for settings/scaffold, Spectrum, Hangar/account, Roadmap, and public RSI modules.
- The command `pnpm build` followed by `node tests/preview-theme.mjs` for local browser review.
- A desktop Chrome route matrix covering real Spectrum paths, both Messages previews, Roadmap, Patch Notes, Hangar, and the popup. Document missing faithful visual fixtures for Funding Goals, Organizations, and Comm-Link rather than treating the shared component sample as page-level visual verification.
- The limitation that fixtures validate local structures and rendering, not live authenticated behavior or RSI site changes.

### Task 4: Run the Full Regression Workflow and Chrome Fixture Review

**Files:** No additional files expected unless a planned check reveals a defect.

- [x] **Step 1: Run the full verification command**

Run: `pnpm verify`

Expected: Vite build succeeds, every discovered Node test passes, and `check:release` confirms manifest, permissions, assets, and runtime constraints.

- [x] **Step 2: Review representative fixtures in Chrome**

Start: `node tests/preview-theme.mjs`

Open the routes listed in `docs/testing.md` in the connected Chrome browser. Check the solid Messages header, title/action contrast, populated conversation counter and unread signal, centered empty state, threaded forum nesting, Roadmap description readability, Patch Notes readability, Hangar layout, and settings previews at desktop size. Record observations separately from the automated test result, then stop the fixture server.

- [x] **Step 3: Confirm the release version is unchanged**

Because this plan changes only tests, fixtures, scripts, and documentation, confirm `package.json` and `extension/manifest.json` remain on the existing version and do not create a new tester package.

- [x] **Step 4: Resolve the clean-checkout review finding and re-review**

Ensure `pnpm test` builds generated artifacts before running tests, with `pnpm verify` reusing that build. Reproduce from an absent-`dist` state, rerun the final verification command, and obtain an independent review of the resolution.
