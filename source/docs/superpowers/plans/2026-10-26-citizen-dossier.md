# Citizen Dossier Implementation Plan

> Superseded in version 0.11.14 at the user's request. The Citizen Dossier redesign, route mapping, fixture, and focused tests have been removed; the remaining plan is historical.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand and modernize the verified public Citizen Dossier overview using the existing Account & profile toggle.

**Architecture:** Map only `/citizens/{handle}` and `/citizens/{handle}/organizations` to the existing `account` section. Use CSS in `account.css` under its existing route/module guard; keep RSI's supplied markup, controls, privacy overlays and data intact.

**Tech Stack:** TypeScript route helper, CSS, Node built-in test runner, Vite build.

**Spec:** `docs/superpowers/specs/2026-10-26-citizen-dossier-design.md`

## Global Constraints

- The public profile route reuses the existing Account & profile module and toggle.
- Keep the Overview and Organizations links and native edit links/actions intact.
- Preserve `.member-visibility-restriction`, `.visibility-R` and `.data*` privacy masking.
- Do not add DOM transformations, action interception, permissions, or mobile-specific behavior.
- The local fixture uses sanitized supplied markup; do not inspect the user's authenticated browser.

## Review Focus

- Locale prefixes and trailing slashes map the two supplied dossier paths to `account`; test every observed variant.
- Similar and unobserved suffixes remain excluded; test `/citizens`, `/citizens/{handle}/other`, and `/citizens/{handle}/edit`.
- Long handles, bio text and organization labels wrap inside the new cards; include long fixture values and inspect the local desktop preview.
- Redacted organizations remain masked while visible profile images and rank remain present; assert the mask and obfuscation elements remain in the fixture and no CSS hides them.
- Disabling the existing Account module removes all dossier styling through the current guard; assert the packaged `account` scope is unchanged and the feature rules sit within it.

---

### Task 1: Add Citizen Dossier layout

**Files:**
- Modify: `src/shared/site-sections.ts`
- Modify: `src/styles/rsi/account.css`
- Modify: `tests/rsi-sections.test.mjs`
- Create: `tests/citizen-dossier.test.mjs`
- Create: `tests/fixtures/citizen-dossier.html`
- Modify: `tests/preview-theme.mjs`
- Modify: `docs/account-hangar.md`
- Modify: `README.md`
- Modify: `package.json`, `extension/manifest.json` (version `0.11.12`)

**Interfaces:**
- Consumes: `sectionForPath(path: string): RsiSection | 'spectrum' | null` and the existing `account` module/toggle.
- Produces: Account section classification for the two verified dossier routes and scoped CSS for `#profile.wrapper:has(> #public-profile.account-profile)` plus the verified overview structure.

- [x] **Step 1: Add sanitized fixture and failing focused tests**

The fixture reproduces the supplied wrapper, page title, two tabs, profile and main-organization cards, metadata, bio, edit links, image elements, `.visibility-R`, `.member-visibility-restriction` and `.data*` elements. Include long display text for wrapping checks. Tests assert locale/trailing-slash route variants, near-miss exclusions, preserved native controls and privacy elements, full-width wrapper/card rules, and CSS guard packaging.

- [x] **Step 2: Run focused tests and verify they fail**

Run: `node --test tests/citizen-dossier.test.mjs tests/rsi-sections.test.mjs`
Expected: route and dossier-style assertions fail before implementation.

- [x] **Step 3: Implement route and CSS changes**

Map the two observed citizen paths to `account`. In `account.css`, widen only `#profile.wrapper` when it directly contains the verified dossier, modernize the shared title/tab shell, lay out the overview's profile, main organization, metadata and bio as navy cards, and keep images contained. Do not override or hide the redaction overlay or `.data*` elements. Keep the uninspected Organizations-tab content in its native layout.

- [x] **Step 4: Update fixture preview, docs and version**

Serve the sanitized fixture on the two verified local paths and inject the existing test-only API mock/content bundle. Update Account & profile scope documentation and README feature notes; set package and manifest versions to `0.11.12`.

- [x] **Step 5: Run scoped checks and build**

Run: `node --test tests/citizen-dossier.test.mjs tests/rsi-sections.test.mjs tests/account-hangar.test.mjs`
Expected: route, CSS preservation, packaging guard and existing Account/Hangar checks pass.

Run: `pnpm build`
Expected: popup/content builds succeed and generated `dist/rsi.css` contains the new rules inside the `account` scope.

The local fixture server started, but the execution sandbox denied loopback HTTP requests, so a visual preview was unavailable. The fixture is synthetic and does not verify signed-in RSI behavior.
