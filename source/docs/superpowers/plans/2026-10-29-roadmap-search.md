# Roadmap Card Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact Roadmap header search that finds current and previous native cards and jumps to a selected patch/category/card.

**Architecture:** A Roadmap-only content module opens RSI's native previous-releases control on the first non-empty search, observes the Roadmap DOM while those releases appear, then reads the existing card links and matches all query words against card and release metadata. It renders an accessible result dropdown inside the native controls area. Selecting a result expands its category only when collapsed, scrolls the release/card into view, and highlights the card without intercepting its native detail link. Previous releases stay open after selecting an archived result.

**Tech Stack:** TypeScript, scoped CSS, Node's built-in test runner, existing Vite build.

**Spec:** `docs/roadmap-search-design.md`

## Global Constraints

- Target Chromium desktop browsers, including Brave, Chrome and Edge (118+).
- Use minimal runtime dependencies; no framework or background worker without a demonstrated need.
- Do not access the user's browser for inspection unless newly requested.
- `dist/`: generated unpacked extension; never edit manually.
- For each extension version bump, refresh a matching tester package under `release/` from the current `dist/`, including version-matched `TESTER-INSTRUCTIONS.txt` and a ZIP with one top-level folder; keep prior tester releases intact.
- Roadmap search stays local to cards rendered by RSI, exposes previous releases through the native control, and preserves native card activation.

## Review Focus

- Cards rendered after the search UI appears: results must be collected from the current DOM on each query; test a late-added card.
- Archived cards: first non-empty search opens the native previous-releases control, waits for asynchronously rendered archive cards, and allows a selected result to jump to its patch; test both immediate and delayed archive content.
- Empty/whitespace query: dropdown closes without results; test empty and whitespace.
- No matching card: announce an empty result state; test the no-results message.
- Collapsed versus expanded category: expand only a collapsed category before scrolling; test both states.
- Route/module disable: remove search UI and temporary highlight; test cleanup.

---

### Task 1: Roadmap Search Runtime

**Files:**
- Create: `src/content/roadmap-search.ts`
- Modify: `src/content/index.ts`
- Create: `tests/roadmap-search.test.mjs`

**Interfaces:**
- Produces `roadmapSearchMatches(record, query)` for case-insensitive all-word matching and `installRoadmapSearch(isEnabled, win, doc)` for route/setting-gated UI installation and cleanup.
- Each result holds the native anchor plus title, description, release, category, and status extracted from its native Roadmap ancestors.

- [x] **Step 1: Write failing tests** for matching across card/release metadata, opening and observing previous releases, current/archived results, live-DOM result refresh, no results, keyboard/dismissal, collapsed-category expansion and scroll/highlight, and teardown.
- [x] **Step 2: Run `node --test tests/roadmap-search.test.mjs` and confirm it fails because the Roadmap search module is missing.**
- [x] **Step 3: Implement the matcher and Roadmap-only installer; wire its refresh function into `src/content/index.ts`.**
- [x] **Step 4: Run `node --test tests/roadmap-search.test.mjs` and confirm all search behavior tests pass.**

### Task 2: Header Styling and Tester Release

**Files:**
- Modify: `src/styles/rsi/roadmap.css`
- Modify: `package.json`
- Modify: `extension/manifest.json`
- Create: `release/RSI-Enhanced-v0.12.44/TESTER-INSTRUCTIONS.txt`
- Create: `release/RSI-Enhanced-v0.12.44/` package copied from `dist/`
- Create: `release/RSI-Enhanced-v0.12.44-developer-mode.zip`
- Test: `tests/rsi-sections.test.mjs`

**Interfaces:**
- Styles consume `.rsi-roadmap-search`, `.rsi-roadmap-search-input`, `.rsi-roadmap-search-results`, `.rsi-roadmap-search-result`, and `.rsi-roadmap-search-highlight` classes emitted by Task 1.

- [x] **Step 1: Add focused Roadmap CSS assertions** for the header search, dropdown, result rows, and temporary highlight to the existing Roadmap release-view test.
- [x] **Step 2: Run `node --test --test-name-pattern='Roadmap release view keeps native card detail activation' tests/rsi-sections.test.mjs` and confirm the new styling assertions fail.**
- [x] **Step 3: Add the scoped styling and bump package/manifest version to `0.12.44`; build and create the version-matched tester directory and ZIP.**
- [x] **Step 4: Run the targeted Roadmap test, `node --test tests/roadmap-search.test.mjs`, `pnpm build`, and `node scripts/check-release.mjs`; inspect packaged files and the ZIP's single top-level folder.**

**Workspace ruling:** The supplied project folder has no Git repository, so use the authorized workspace directly; worktree isolation and commits are unavailable.
