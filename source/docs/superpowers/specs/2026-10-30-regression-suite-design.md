# RSI Enhanced Regression Suite Design

**Status:** Approved for implementation.

## Intent

Give the RSI Enhanced project one dependable way to check the extension's existing behavior across Spectrum, Hangar, Roadmap, the public RSI pages, settings, and release packaging. The suite should catch regressions early and make visual drift easier to diagnose, while staying local and independent of signed-in website data.

The project already has focused Node tests and a local fixture server, but no top-level test command or browser automation dependency. A baseline `node --test` run discovered 391 tests: 388 passed and 3 failed. The failures appear to be two stale CSS expectations and one font rule that needs a behavior decision. The implementation must triage each instead of hiding the baseline failures.

## Goals

- Provide a clear command that runs every automated regression test in the repository.
- Provide a broader verification command that builds the extension, runs the full test set, and checks the packaged release.
- Keep tests grouped and discoverable by feature so a failure points to Spectrum, Hangar, Roadmap, settings, or an RSI page.
- Use local fixtures for browser-rendered review of the high-risk CSS and layout flows, including the populated and empty states represented by fixtures.
- Confirm that product-affecting regressions receive a targeted test and that stale tests are corrected to match approved behavior.
- Document what each verification layer covers and where its limits are.

## Non-goals

- Replacing all current tests with browser tests or rewriting tests that already provide meaningful coverage.
- Pixel-perfect screenshot comparison across machines, browsers, or font-rendering environments.
- Testing authenticated RSI behavior, relying on live account data, or making network requests to RSI during tests.
- Setting up CI, publishing the extension, or changing product behavior except where baseline triage proves a real defect.
- Adding a runtime dependency to the extension.

## Constraints

- Use the existing Node.js test runner, pnpm, TypeScript, Vite build, and local fixtures where they fit.
- Keep the extension's production dependency set unchanged.
- Browser review must use localhost fixtures in Chrome and stay on desktop layouts; the suite must not need the user's personal browser profile or login.
- Preserve existing focused commands and release packaging rules.
- A test/documentation-only change does not bump the extension version; if baseline triage proves a product fix is needed, bump the version and refresh the matching tester package as required by the project rules.
- Do not claim browser validation from static tests or live-site validation from fixtures.

## Approaches considered

1. **Node-only aggregate.** Add a single command over the existing focused tests and build checks. It is simple, offline, and repeatable, but it cannot catch browser cascade or rendering differences.
2. **Browser-first automation.** Add a browser automation dependency and migrate substantial coverage into end-to-end tests. This exercises rendered pages deeply, but increases setup and maintenance, requires a browser runtime, and would duplicate many useful tests already in place.
3. **Layered suite — recommended and selected.** Keep Node tests as the automated, offline regression base; add a one-command full verification path for tests, packaging, and release checks; use the existing local fixture server for a concise Chrome review of visual and computed-style risks. This provides broad automation without introducing a browser dependency and uses Chrome where rendered behavior adds real evidence.

## Proposed behavior

### Automated checks

- `pnpm test` builds the extension, then runs the complete Node test set using Node's built-in test runner. This makes the command self-contained because existing tests inspect generated package files.
- `pnpm verify` runs `pnpm test`, then checks the release package without rebuilding. It stops on the first failing stage and reports the stage clearly.
- Keep the current focused commands available for settings, theme, scaffold, and release work.
- Add no blanket lint or repository-wide TypeScript command. Type checking remains scoped to the existing settings targets unless a changed feature already defines a targeted type check.
- Triage all three baseline failures. Update an assertion only when source and approved behavior establish that the assertion is stale; fix product code and add a regression test if the font rule is a real behavior defect.

### Browser fixture review

- Use `node tests/preview-theme.mjs` after a build to serve the existing fixtures on localhost, then inspect them in Chrome.
- Record a short desktop smoke matrix in the testing guide. It should include Spectrum forums/thread nesting, chat and home/sidebar; Roadmap Release View; public RSI sections including Funding, Organizations, Comm-Link and Patch Notes; Hangar controls/layout; and the settings preview.
- Cover representative states that can be built from local fixtures, such as empty and populated messages, unread indicators, long text, nested replies, expanded Hangar cards, and selected settings. Where no fixture currently represents a state, call out that gap rather than treating static assertions as visual verification.
- Browser review is a deliberate manual visual layer for this phase. It is not a required automated dependency and does not use live RSI pages.

### Test organization and maintenance

- Add a testing guide that maps feature areas to their focused test files and states what each top-level command covers.
- Keep behavior tests focused on user-visible contracts and observed DOM structures. Avoid brittle checks for unrelated source formatting or duplicated implementation details.
- For future product fixes, add the smallest meaningful regression test alongside the fix and keep generated `dist/` files out of test authorship.
- Report automated test results and browser-fixture observations as separate evidence.

## Acceptance criteria

- A clean checkout with dependencies installed can run `pnpm test` locally; the command builds generated files before tests and requires no external network access or authenticated RSI session. Fixture integration checks may use localhost loopback only.
- `pnpm verify` builds and validates the currently packaged release after the baseline failures are resolved.
- All pre-existing focused test files are included in the aggregate run; none are silently skipped or marked as expected failures.
- The testing guide maps the extension's implemented feature areas to their checks and identifies fixture/browser limits.
- The documented Chrome fixture review can be followed without inspecting or modifying the user's signed-in browser state.
- Final reporting gives the exact commands, test counts, browser review scope, and any remaining limitations.

## Open implementation choices

- Whether `pnpm verify` should call existing package scripts or a small Node orchestrator; choose the clearest minimal implementation after reviewing script behavior.
- Whether a missing visual fixture is important enough to add now. Add only fixtures that cover a meaningful gap in an already requested product behavior.
- Keep `pnpm test` self-contained: tests read generated `dist/` artifacts, so it must build before invoking Node's test runner; `pnpm verify` should reuse that build rather than duplicate it.
- Resolve the font rule failure from the existing shared-font contract and expected dollar-sign icon appearance; do not change the icon solely to satisfy a broad regex.
