# Roadmap Quick Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact filter popover that narrows Roadmap search results by status and category, including previous releases.

**Architecture:** Extend the existing Roadmap search module to own the filter button, popover state, category options and filtered result predicate. Keep the existing indexed card records, result rendering, native card selection and red highlight behavior. Add scoped styles in the existing Roadmap stylesheet and focused interaction coverage in the Roadmap search test.

**Tech Stack:** TypeScript, scoped CSS, Node built-in test runner, Vite build.

**Spec:** `docs/superpowers/specs/2026-10-29-roadmap-quick-filters-design.md`

## Global Constraints

- Target Chromium desktop browsers, including Brave, Chrome and Edge (118+).
- Keep the feature scoped to the Roadmap route and existing Roadmap module setting.
- Use the current in-memory Roadmap search index; do not add a network request or separate observer.
- Do not expand all categories, hide native board cards, or change native card activation.
- Keep prior tester releases intact; package version `0.12.66` from the built `dist/` with version-matched tester instructions and a ZIP containing one top-level folder.

## Review Focus

- No filters selected or defaults active: all text matches remain visible; focusing search or opening the popover does not expand categories or otherwise change the board.
- Status and category intersection: only cards satisfying both selected filters and the text query remain in results.
- Previous-release card: archived results remain filterable and selecting one still jumps and highlights it.
- Empty query with active filters: results show for the narrowed set; empty status selection shows zero matches.
- Dismissal and cleanup: Escape/outside interaction closes the popover, and module teardown removes its controls/listeners without changing native category expansion.

---

### Task 1: Filter Behavior, Controls, Styling, and Tester Package

**Files:**
- Modify: `src/content/roadmap-search.ts`
- Modify: `src/styles/rsi/roadmap.css`
- Modify: `tests/roadmap-search.test.mjs`
- Modify: `package.json`
- Modify: `extension/manifest.json`
- Create: `release/RSI-Enhanced-v0.12.66/TESTER-INSTRUCTIONS.txt`
- Create: `release/RSI-Enhanced-v0.12.66/` packaged from current `dist/`
- Create: `release/RSI-Enhanced-v0.12.66-developer-mode.zip`

**Interfaces:**
- Consume the existing `indexedCards: Map<string, RoadmapSearchRecord>` and result selection flow in `src/content/roadmap-search.ts`.
- Add extension-owned button/popover elements with stable `rsi-roadmap-search-filter*` classes; use checkbox inputs for the three statuses and a select with **All categories** plus distinct indexed categories.
- Keep filter defaults equivalent to no filtering: Tentative, Committed, and Released selected; category set to all.
- Compute each result as the intersection of text terms, selected status values, and selected category. If the query is empty, active filters may still show results.

- [x] **Step 1: Write failing tests** in `tests/roadmap-search.test.mjs` for default/no-op filters, status/category intersection, previous-release filtering, empty-query filtering, Clear filters preserving query, Escape/outside dismissal, no category expansion on search focus or typing, and selected-result navigation/highlight.
- [x] **Step 2: Run `node --test tests/roadmap-search.test.mjs` and confirm the new filter tests fail.**
- [x] **Step 3: Implement filter state and result matching** in `src/content/roadmap-search.ts`; derive categories from `indexedCards`, preserve checkbox/selection values when archive cards arrive, and keep the existing jump/highlight flow. Remove eager category expansion during search preparation and archive mutations; expand only a selected result's category.
- [x] **Step 4: Implement accessible filter controls and cleanup** in `src/content/roadmap-search.ts`; expose a filter button beside search, keep the popover open while editing, support Escape/outside dismissal, and avoid any category expansion when opening the popover.
- [x] **Step 5: Style the search row and anchored popover** in `src/styles/rsi/roadmap.css`; keep the results dropdown usable alongside the popover and constrain the panel to the viewport at narrow desktop widths.
- [x] **Step 6: Run `node --test tests/roadmap-search.test.mjs` and confirm all Roadmap search and filter tests pass.**
- [x] **Step 7: Bump package and manifest versions to `0.12.66`, run `pnpm build`, and create the matching tester folder and single-root ZIP from the new `dist/`.**
- [x] **Step 8: Run `node scripts/check-release.mjs` and verify the packaged version, tester instructions, and ZIP top-level folder.**

### Follow-up: Numbered Alpha patch labels

- [x] Mark only numeric patch names as Alpha, leaving named releases such as `Star Citizen 1.0` unchanged; add the scoped prefix styling and regression coverage.
- [x] Fix the reviewed result-Escape and empty-query active-filter refocus cases, and add focused regression checks for zero selected statuses and listener teardown.
- [x] Rebuild and refresh the 0.12.66 tester folder/ZIP; verify packaged assets, manifest version, and single-root archive.
