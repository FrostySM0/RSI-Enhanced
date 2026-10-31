# Settings

The popup saves only when **Save changes** is selected. Controls update the preview until then. **Reset defaults** writes extension defaults to the settings key and updates open RSI tabs. A failed load blocks editing with a retry action; a failed save keeps the draft available for retry.

Appearance includes 13 built-in themes, an optional accent override, a website font, forum width, density, post/message text size, avatar shape and developer post text colour (Gold, White or Off-white). **Site default** preserves each area’s current font; the available choices are Arial, Segoe UI, Verdana, Tahoma, Trebuchet MS, System UI and Comic Sans. Font choices use local system fonts and apply to extension-styled text across Spectrum and RSI. Comic Sans falls back to Segoe UI or the system sans-serif when it is unavailable. The font and comment-layout previews appear beside their controls, update immediately, and use the selected theme. Developer colour applies to forum-list latest repliers carrying Spectrum’s role-line marker and to posts whose author carries the observed Spectrum gold inline style. The post-level check accepts common RGB spacing and hex serialization; Spectrum does not expose a confirmed semantic developer marker in the supplied post markup.

Spectrum feature switches are independent: base theme and sidebar styling, forum enhancements, chat enhancements, Messages panel styling, Friends panel styling, saved forum threads, notification filters and enhanced post blocks. Messages and Friends no longer depend on the shared theme switch; the Friends panel is separate from Chat enhancements, which retain the room and Online Users styling. Saved threads and hidden-user preferences remain stored when their UI switches are off. Notification filters classify rows from their visible text because the supplied markup contains no stable notification-kind attribute. RSI website sections (Pledge Store, Ship Matrix, Organizations, Comm-Link, Account & profile, My Hangar, Roadmap, Funding Goals and Dev Tracker) have separate switches.

The RSI website settings also include **Roadmap opens to** (Release View or Progress Tracker). It applies only when selecting the main Roadmap entry in RSI navigation; direct Roadmap links and the view switcher inside the Roadmap page keep their own destinations. This navigation preference works independently from the Roadmap appearance switch.

## Architecture

- Schema version 1 lives under `rsiEnhanced.settings` in `chrome.storage.local`. Invalid and partial values are normalized; reset never clears unrelated keys.
- Saved threads use the separate `rsiEnhanced.savedThreads` key. A Web Lock serializes cross-tab read-modify-write updates, with a per-context queue fallback.
- Hidden-user preferences use independent per-handle storage keys and survive appearance resets.
- The popup uses explicit Save/Reset actions. The content entry applies validated palette/layout values and extension-owned module attributes.
- Spectrum CSS is packaged under a `data-rsi-section="spectrum"` scope, then guarded by each feature’s module attribute where a separate switch exists. RSI CSS uses matching route and section guards. This prevents styles from persisting after in-app navigation leaves a supported route.
- The extension targets Chromium 118+ and requests only the `storage` permission. Content scripts match the RSI host. Spectrum notifications and saved-thread UI use bounded/demand-driven observers; there is no periodic polling. Hangar search performs read-only same-origin page requests only when the user starts a search.

## Focused checks

For settings changes, run `pnpm build` and `pnpm check:settings`. For Spectrum styling/package changes, run `node --test tests/spectrum-theme.test.mjs`. Run feature-specific tests for notification filtering, saved threads, blocks or other changed runtime modules. The release artifact check is `pnpm check:release` after a build; it does not verify live site behavior.

`node tests/preview-theme.mjs` serves local fixtures. The popup preview uses test-only storage and does not verify real Chrome/Edge extension storage. Existing open RSI tabs need a refresh after installing or reloading the extension. Cross-browser and authenticated live-site checks remain manual.
