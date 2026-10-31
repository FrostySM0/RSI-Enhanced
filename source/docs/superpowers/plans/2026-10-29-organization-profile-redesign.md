# Organization Profile Redesign Implementation Plan

> **For agentic workers:** Use the inline execution workflow. Work is authorized by the user's request to implement the approved mockup.

**Goal:** Apply the approved ITCN organization-profile design to every public RSI organization profile while preserving each profile's native text, controls, artwork, and video.

**Architecture:** Keep selectors bounded to `#bodyWrapper` and `#contentbody.public.profile`. `src/content/organization-profile.ts` places reversible containers around observed native RSI nodes to match the approved hero, two-column overview and optional media panel; CSS supplies the design. Keep native tab/event ancestry, artwork URLs, and the YouTube iframe's Cookiebot `src`/`data-src` behavior intact.

**Tech Stack:** CSS, Node's built-in test runner, Vite extension build.

**Spec:** `docs/mockups/organizations-itcn-profile.html` and the user's approved screenshots.

## Global Constraints

- Preserve native RSI text, links, tabs, media sources and cookie-consent behavior.
- Keep shared RSI navigation outside the selector scope.
- Use the selected extension font and active RSI theme tokens.
- Keep directory search and the Organizations hub unchanged.
- A version-matched local tester package is for visual validation; do not publish or push it until the user confirms the page matches the supplied mockup. Include updated detailed patch notes and tester instructions.

## Review Focus

- Profile selectors apply to every organization SID but not the search page or hub; test the verified `.public.profile` ancestry.
- Native description tabs remain readable and usable; test the selector scope and avoid hiding inactive content controls.
- Optional artwork and video share a row when both exist, while a lone media item spans the full row; keep long artwork uncropped and preserve the native player frame.
- RSI's marketing-consent iframe keeps its original source contract and remains visible; test media sizing without source mutation or hiding rules.
- Header/navigation remain untouched; test that all new profile selectors begin beneath `#bodyWrapper`.

---

### Task 1: Style native organization profiles

**Files:**
- Modify: `src/styles/rsi/organizations.css`
- Modify: `src/content/organization-profile.ts`
- Modify: `src/content/index.ts`
- Create: `tests/organizations-profile-layout.test.mjs`
- Modify: `tests/organizations-redesign.test.mjs`
- Modify: `docs/rsi-inspection.md`

**Interfaces:** Uses only the observed RSI profile markup: `.heading`, `.banner`, `.inner`, `.logo`, `.tags`, `.focus`, `.content.join-us`, `.content.block.description`, `.content-tab`, `.content.block.cover`, and `.content.block.youtube .embed-container #ytplayer`.

- [x] Add failing profile-layout and media-preservation assertions, then run `node --test tests/organizations-redesign.test.mjs` and confirm the new assertions fail.
- [x] Implement reversible native-node composition and the profile-only CSS layout; run focused composition and layout tests.
- [x] Integrate the enhancer behind the Organizations route/module setting and type-check its helper.
- [x] Record the live profile ancestry and native Cookiebot-gated video behavior in `docs/rsi-inspection.md`.

### Task 2: Build a local visual validation package; publish only after visual approval

**Files:**
- Create: local preview from the current Organizations CSS and native-profile fixture
- Modify: `package.json`, `extension/manifest.json`
- Create: `release/RSI-Enhanced-v0.12.21/` and its versioned ZIP
- Update: version-matched detailed patch notes and tester instructions

**Interfaces:** Keep this tester package local for comparison. Build `dist/` into one top-level tester folder using the existing version-matched release format. Never publish or push without the user's visual approval.

- [x] Build the extension locally and run the focused organization layout/composition checks plus the packaged public-CSS check.
- [x] Bump to `0.12.21`, refresh detailed patch notes/instructions, create the tester folder/ZIP from `dist/`, and run `pnpm check:release`.
- [ ] Keep the tester package local until the user confirms the visual match; do not publish or push it beforehand.
