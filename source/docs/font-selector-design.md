# Website font selector

## Goal

Let users choose a clear, readable font that applies across the RSI website and Spectrum, while preserving the current typography by default.

## Design

- Add a saved website-font setting to the existing Appearance settings.
- The first dropdown option is named exactly **Site default** and preserves each page area’s current font stack (including System UI in the general Spectrum theme and Arial in forums, chat, and RSI sections).
- Offer Arial, Segoe UI, Verdana, Tahoma, Trebuchet MS, and System UI as explicit choices. Use local system-font stacks with sensible fallbacks; do not fetch or bundle font files.
- Apply the selected family through a shared CSS custom property across the existing Spectrum and RSI styling modules. Leave the extension popup’s own typography unchanged.
- Existing stored preferences normalize to Site default, and Reset restores Site default. Saving updates already-open pages through the current settings subscription.

## Out of scope

- Bundled or remotely hosted fonts.
- Changing font sizes, weights, or spacing.
- Replacing the native font on pages or modules where RSI Enhanced styling is disabled.

## Verification

Run the settings-specific checks and inspect the built CSS to confirm the default leaves current font stacks intact and each explicit selection reaches both Spectrum and RSI styles.
