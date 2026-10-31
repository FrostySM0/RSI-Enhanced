# Comm-Link Listing Editorial Redesign Implementation Plan

> **For implementation:** Complete each task in order, use the test-first loop, and verify only the Comm-Link feature and its directly affected build output.

**Goal:** Restyle only the live Comm-Link listing into a clear full-width editorial layout while preserving RSI's existing filters, search, sorting, native card geometry, story links, and artwork.

**Architecture:** Keep the work in the independent `commlink.css` module. Target the observed `#channel` listing and documented `.hub-block` card hooks. Break the listing out of a centered parent to viewport width, replace its distracting grid canvas, and restyle the known title/filter hooks while leaving native filter behavior, card geometry, artwork crop, and overlays untouched. Keep article-detail typography and layout isolated. Add a fixture-backed regression check for the breakout, canvas, native controls, card links, image treatment, and detail-page isolation.

**Tech Stack:** Manifest V3 content styling, scoped CSS, Node's built-in test runner, Vite packaging.

**Spec:** `docs/superpowers/specs/2026-10-26-commlink-listing-editorial-redesign.md`

**Global constraints:** CSS-only; no data fetching or cloned content. Preserve native navigation and artwork. Do not edit generated `dist/` files. Comm-Link remains an independent RSI module. User explicitly selected listing-only editorial design. Keep this desktop focused and use existing RSI theme tokens.

**Review Focus:** Selector specificity and route isolation; native controls remain usable; image color and aspect ratios remain intact; no article-detail layout changes; generated scoped CSS contains the new listing rules.

## Tasks

- [x] 1. Build a sanitized fixture from the inspected Comm-Link listing card and filter structure, then add a focused regression test for native links, controls, art, and listing/detail isolation.
- [x] 2. Run the focused test to confirm the new listing behavior is not yet present.
- [x] 3. Add a full-viewport listing breakout and restrained theme colors in `src/styles/rsi/commlink.css`, preserving native card geometry, image crop, overlay positioning, and existing article typography rules.
- [x] 4. Run the focused Comm-Link test and package build; update `docs/rsi-inspection.md` with the observed listing selectors and scope.
- [x] 5. Inspect the changed files and report test/build results plus the live-browser validation limitation.
- [x] 6. Extend the route-scoped redesign to the page backdrop, listing title, and native filter panel; verify these surfaces in the Comm-Link fixture without changing control or card layout behavior.
