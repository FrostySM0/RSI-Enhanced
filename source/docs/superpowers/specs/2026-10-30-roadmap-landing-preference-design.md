# Roadmap Landing Preference

## Intent

Let users choose whether the main RSI Roadmap navigation entry opens Release View or Progress Tracker, without changing the Roadmap page's own view switcher.

## Goals

- Add a saved **Roadmap opens to** preference in the extension's **RSI website** settings panel.
- Offer **Release View** and **Progress Tracker**; default to Release View to preserve the current destination.
- Apply the preference only to the main site Roadmap entry. Keep internal view links and direct Roadmap URLs unchanged.
- Keep the preference independent of the Roadmap styling toggle and store it in the existing `rsiEnhanced.settings` key.

## Non-goals and anti-goals

- Do not force all Roadmap visits onto the preferred view.
- Do not rewrite the in-page Release View / Progress Tracker links or prevent switching between them.
- Do not add permissions, network requests, or a new settings storage key.

## Selected approach

Add a validated `roadmapLandingView` setting (`release-view` or `progress-tracker`) with a `release-view` default. Place a select control beside the Roadmap module toggle in the existing RSI website settings panel. On RSI pages, route only activation of the top-level Roadmap navigation entry to the saved destination; leave Roadmap's in-page navigation untouched.

The alternative was to force every Roadmap page load to the saved view. That would override direct view links and complicate the native view switcher, so the main-entry-only behavior was selected.

## Constraints and verification

- Preserve schema version 1 and normalize missing or invalid values to `release-view`.
- Inspect the current main navigation link before adding runtime selectors; do not infer it from the in-page view links. Existing Roadmap routes are `/roadmap/release-view` and `/roadmap/progress-tracker/teams`.
- Verify settings normalization, popup restore/save, main-entry routing versus in-page navigation, focused settings/runtime tests, the build, and the release artifact. Bump the extension version and create the version-matched tester folder and ZIP with cumulative patch notes.
