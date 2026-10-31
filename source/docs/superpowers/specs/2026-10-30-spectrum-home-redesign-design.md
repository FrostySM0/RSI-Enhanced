# Spectrum Home Redesign

**Intent:** Apply the approved local HTML mockup's visual layout to Spectrum's main Star Citizen community landing page, while preserving RSI's native links and controls.

**Goals:** Give the landing page a clear bookmark/sidebar rail, a wide community banner, and side-by-side forum and chat sections styled to match the supplied screenshot. Restrict the redesign to `/spectrum/community/SC` (including locale prefixes and a trailing slash).

**Non-goals:** Rebuild the page content, replace React-owned controls, change forum threads or chat, or access the user's browser for inspection.

**Approaches:** Replacing native content would recreate functionality and risk breaking site interactions. Broad Spectrum CSS would affect forums and chat. The chosen approach adds one route marker and one separate theme-scoped stylesheet that restyles only verified native landing-page containers. The mockup remains available as a separate local HTML artifact.

**Constraints:** Preserve native DOM and actions; use the current theme module guard and CSS packaging; use only selectors confirmed by existing inspection notes or user-provided DOM; make the source changes easy to remove. There is no Git repository in this workspace, so no commit-based rollback is available.

**Validation:** Test exact-route matching and CSS packaging/scope, build the extension, and run the release artifact check. Live browser appearance remains for the user to judge.
