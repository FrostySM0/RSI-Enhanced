# RSI Enhanced

Enhanced blocking (0.11.2): use **Block and remove posts** in a Spectrum profile, or the **Remove posts** controls in Spectrum’s native Blocked Users section to hide or show posts locally. Account blocking still uses Spectrum’s native Block/Unblock actions. J3PT is preconfigured once for local removal; other authors' nested replies remain visible.

A lightweight Manifest V3 extension for public use in Chromium-based desktop browsers, including Brave, Chrome and Microsoft Edge.

## Current scope: public desktop extension

Implemented: desktop forum/chat styling, settings popup, 16 built-in theme presets and saved local preferences. Approved defaults remain full-width forums, round prominent avatars and balanced spacing. Controls support theme presets, an optional accent override, website fonts (Site default, Arial, Segoe UI, Verdana, Tahoma, Trebuchet MS, System UI and Comic Sans) with live font/comment-layout previews, percentage/pixel forum width, density, six theme-aware Spectrum comment layouts, body text size, avatar shape and independent Spectrum modules for theme/sidebar, forums, chat, Messages, Friends, saved threads, notification filters and enhanced post blocks. The layouts are Threaded, Compact threaded, Flat, Card stack, Bubble and Conversation stream; the last adds parent labels while preserving native reply controls and Extend conversation. Save applies to open recognized RSI tabs; Reset restores the approved defaults. Nine independent RSI modules cover Account/profile settings, My Hangar, Pledge Store information panels, Ship Matrix, Organizations, Comm-Link and Patch Notes text/cards, Roadmap Release View, Funding Goals and Dev Tracker. Dev Tracker keeps native posts, links and auto-load controls inside a theme-aware date-grouped feed. Funding Goals keeps RSI’s live totals, native Hour/Day/Week/Month chart controls and stretch goals; the 24-hour changes and added Quarter/Year charts use the user-provided hourly funding spreadsheet, checking its newest row once a minute while refreshing the locally cached full history every ten minutes. Account settings and Hangar use selectors from RSI’s published CSS. Mobile-specific styling is outside scope.

Messages and Friends panels each have an independent switch. Messages no longer follows the shared theme/sidebar switch, and Friends no longer follows Chat enhancements; the Chat switch continues to control the room and Online Users roster. Saved forum threads use separate local storage and merge cross-tab changes safely. Notification filters classify visible notification copy and have their own switch; enhanced post-block controls can also be disabled without deleting saved block preferences. Spectrum styles are scoped to the active Spectrum route so they drop away during in-app navigation to other RSI sections.

## Privacy and data use

On first use, the popup shows a privacy notice. Settings and page features stay inactive until the user chooses **Agree and enable**; **Not now** keeps them off. The content script checks the separate consent record before reading settings or starting page features, and clearing that consent turns the features off in open RSI tabs.

The extension runs its content script on `https://robertsspaceindustries.com/*` so it can apply enabled settings and respond to navigation between RSI sections. It reads relevant page content for the tools in use. The extension requests the `storage` permission and stores settings, saved Spectrum links and titles, hidden-user handles and names, Hangar favourites and view choices, Hangar search details, and cached public funding figures in browser-local storage. Temporary navigation state can be held in the current tab's session storage. It does not include analytics or telemetry, and does not send saved extension data to the developer.

Hangar pages beyond the one currently open are fetched only after a search, filter, export, refresh or cross-page view action. If a cross-page display or Ship Paint mode was saved, it may also load the needed pages when Hangar opens. These are sequential, read-only requests to RSI on the same site. The local normalized index is valid for 15 minutes; after that it is not reused and is deleted the next time an indexing action checks it. Until then, the expired copy may remain in browser storage. Conversation context images are loaded only from HTTPS RSI domains, and those image requests omit referrer information.

Some optional Hangar and Spectrum tools make requests to RSI for additional page or reply data, using the current RSI tab and its existing sign-in session where required. The extension does not read or store passwords or session cookies. Funding Goals reads a public Google Sheet with browser credentials omitted; the request does not include RSI account or Hangar data, though Google receives ordinary connection details such as the user's IP address and request time. The extension has a fixed `docs.google.com` host permission for this feature. The published policy is available at [the public privacy policy](https://frostysm0.github.io/RSI-Enhanced/privacy-policy.html); use this URL in the Chrome Web Store listing.

RSI Enhanced uses the information it accesses only to provide or support its user-facing features, consistent with the Chrome Web Store User Data Policy, including its Limited Use requirements. It does not use this information for advertising, sell it, or share it with data brokers.

Dev Tracker developer text colour (0.11.91): the response excerpt and expanded reply follow the Gold, White or Off-white selection under Developer post text in extension settings.

Spectrum Extend conversation replies (0.11.94): each fetched parent post, including the original thread post, has a named Reply action. It follows Spectrum's native “View the rest of the replies” navigation, then opens the exact post's native Reply composer without a direct-link page refresh. Expanding the chain scrolls the linked reply into view and reinforces its yellow highlight.

Dev Tracker presentation (0.12.3): the date heading has equal, modest spacing above and below. The thread title and reply/response panel share the right-hand column of the existing card grid, with balanced space above the title and below the response. The author rail keeps its original width while using a 69px avatar and 1.5× identity/date text, preserving room for each post and developer response. The “Star Citizen Dev Tracker” heading stays aligned with the centered arrow; parent context remains evenly inset.

Hangar thumbnails open their existing source image in a modal card by click or keyboard. Close with the button, Escape or the backdrop; RSI heap thumbnails use the verified full-size source rendition, falling back to the thumbnail if unavailable.

Roadmap Release View cards retain their native status, details and navigation. Their card images remain in colour; select an image to view its supplied source, then use the source tab’s browser context menu to save it. The header search opens RSI's previous releases when the board loads, keeps newly rendered archive cards indexed, and jumps to matches without replacing the native detail pop-out. Press Ctrl+K to focus the search and Enter to jump to the first result.

Patch Notes and Comm-Link labels (0.11.79): use a shared angular navy tag with a cyan marker, matching the extension's sci-fi styling across both feeds. Patch Notes cards retain the clear artwork and animated hover/focus highlight.

Dev Tracker full response expansion (0.11.90): developer replies use the complete text from Spectrum's read-only reply API, so a truncated Dev Tracker excerpt now has its own Show more/Show less control and can be read in full inline. Parent and developer controls work independently.

Dev Tracker message expansion (0.11.89): long parent posts and developer excerpts each have their own Show more/Show less control. Both expand inline so the full messages can be read on Dev Tracker without opening Spectrum.

Dev Tracker reply flow (0.11.87): parent context and developer response share one panel, with the developer label and full response aligned together. Timed-out parent lookups show an unavailable state, and disabling the module restores native post links. Opening a Dev Tracker response opens Spectrum's native Reply composer on that exact developer post.

Dev Tracker message expanders (0.11.84): long parent posts and developer responses show a 320-character preview with Show more/Show less controls. Expanded developer replies retain their original markup, and the cards expand to show the full messages.

Dev Tracker card height fix (0.11.83): cards and developer response text now grow to fit their content, preventing replies from being clipped below the inset context panel.

Dev Tracker reply context (0.11.82): each developer response now includes the actual Spectrum post it answers, with that post's author name, avatar and text. The feed uses the selected extension font throughout, with clearer type sizing and a theme-aware context panel. Native post links and Auto Load behavior stay intact.

Dev Tracker layout fix (0.11.81): the feed now fills the available desktop width, with one full-width post per row and a fixed author rail so post titles and summaries remain readable. Native post links and Auto Load behavior stay intact.

Dev Tracker (0.11.80): date-grouped native posts use the active RSI theme, with clearer author, category and title hierarchy. Original post links and the Auto Load control remain native, and the module has its own switch in extension settings.

Hangar workspace (0.11.2): full-width desktop layout, modern side navigation, flat controls/pagination, compact gear rows and expanded-content grids. The same module covers the supplied Game Access, My ROMs, Buy Back, Tickets and Electronic Access routes. Shared category containers are styled; unique signed-in Game Access/ROMs panels have not been inspected. See [workspace scope](docs/hangar-workspace.md).

## Development

For source setup, architecture, and contribution conventions, see the [developer guide](docs/development.md).

Desktop discussion defaults: 80px original-post avatars, 56px reply avatars, 22px card padding and 18px between top-level replies. Forum-list spacing is controlled separately.

Replies default to one outer surface with lightweight nested dividers. Users can choose Threaded, Compact threaded, Flat, Card stack, Bubble or Conversation stream comments; each layout uses the active theme’s colors and typography. Original-post avatars sit beside the heading while body text spans the width beneath it. Adjacent single-image attachments share a row where space allows, retaining original links and media controls.

Use Node.js 22.18+ (native TypeScript stripping for focused tests) and pnpm 11. The extension targets desktop Chromium 118+ browsers, including Chrome, Edge and Brave.

```sh
pnpm install
pnpm build
pnpm check:scaffold
pnpm check:theme
pnpm check:settings
pnpm dev
```

`dev` watches and rebuilds the packaged files. After a build, reload the extension in the browser and refresh the RSI tab. Popup and content builds are separate so the content script remains a self-contained classic script. There is no HMR server or remotely hosted extension code.

## Load locally

1. Open `chrome://extensions` in Chrome or `edge://extensions` in Microsoft Edge.
2. Enable **Developer mode**, choose **Load unpacked**, and select this project's `dist` directory.
3. Open the extension popup; it should display settings and the current package version.
4. Open Spectrum, change a preference and click **Save changes**. Confirm the open page updates and that reopening the popup retains the value.
5. Check the extension's error list. Verify in your preferred Chromium browser before preparing a store submission.

After updating an existing installation, click **Reload** on the extension card and refresh RSI. Funding Stats keeps RSI’s native totals and four timeline controls, while 24-hour changes and Quarter/Year ranges use the spreadsheet’s hourly history. An active page checks the newest sheet row every minute and refreshes its full history every ten minutes, including immediately when a suspended tab becomes visible. The stats status shows the latest row time, its age and the last successful check in UTC, so a delayed spreadsheet row is visible as delayed data. The browser caches rows locally, so the first load needs access to `docs.google.com`; if the sheet is unavailable, the extension uses the last good cached history and marks it as saved. The timeline container is centered and has subtle horizontal guides behind RSI’s native graph. Check the independent Spectrum feature switches and all nine RSI section modules; checkout, security, billing and unrelated routes should retain their original appearance. Disable Funding Goals and refresh to compare or revert.

For theme-only verification, run `pnpm build` and `pnpm check:theme`. Optional local cascade fixture: `node tests/preview-theme.mjs`, then open `http://127.0.0.1:4173`. Stop the server with Ctrl+C. The fixture is not a live Spectrum integration check.

For forum-only CSS work, use `/forums` on that fixture server. Query options isolate variants, e.g. `/forums?density=compact&avatar=rounded&width=900`. Verify affected desktop widths, late content and nested reply collapse. The fixture includes a 288px sidebar to catch unused content space. When packaging changes, run only `node --test --test-name-pattern='theme is packaged' tests/spectrum-theme.test.mjs`.

The comment layout fixture is available at `/comment-layouts`; its local selector switches among all six styles without requiring extension storage.

For chat-only CSS work, use `/chat` and `/chat?density=compact`. Verify grouped timestamps, selected channels, mentions, media, late messages and composer focus/error styling. The local composer fixture never sends messages. Actual authenticated chat still needs Chrome/Edge validation.

Settings workflow and test-only connected preview: [Settings architecture and verification](docs/settings.md).

## Architecture decisions

- Plain Vite and TypeScript; no UI framework, runtime dependency or extension build plugin.
- `extension/manifest.json` is copied to the build output. Vite builds the popup and bundles the content script separately as IIFE.
- The settings content script matches the HTTPS RSI host at document start so client-side navigation can enter a supported section. Spectrum CSS retains its `/spectrum/*` match and is guarded by the active Spectrum route; separate `rsi.css` uses strict recognized-route and independent module guards, with shared header-avatar styling available across all non-Spectrum RSI pages. Native Navigation API success events and popstate refresh route guards without intercepting navigation. Saved settings apply to root variables/attributes; the avatar shape also updates on unclassified RSI routes, and `chrome.storage.onChanged` updates open tabs. Targeted observers handle React-mounted UI where needed; no periodic polling is used.
- Inert default tokens precede shared avatar-shape styling, scoped theme mapping, foundation, forum, saved-thread, chat, notification and post-block CSS in `dist/spectrum.css`. Native `@scope` gates the active Spectrum route and independent feature modules, restoring site styling when disabled or when navigation leaves Spectrum. Chromium 118+ is required. Source files are watched for development rebuilds.
- Layout and colour values use extension-owned CSS variables/attributes, never assumed website settings. Default width is `100%` with zero auto-centering margins. Shared settings are validated before use; built-in palette values are fixed and the optional accent override accepts only opaque six-digit hex colours.
- Visual reference: the author's [Better Spectrum Dark Theme page and screenshots](https://www.fwkart.de/star-citizen-chrome-extension-better-spectrum-look/). Its muted navy surfaces, readable text, round avatars and space-saving image layout guide this implementation; its original CSS and precise font have not been recovered. No original extension code is claimed to be copied.
- Live selector evidence, nested theme boundaries and inspection limits are recorded in [Spectrum inspection](docs/spectrum-inspection.md).
- Only the `storage` API permission is requested. A fixed-purpose service worker reads the public hourly funding sheet with the `docs.google.com` host permission; it does not accept arbitrary URLs. There is no tabs/scripting permission or web-accessible resource.
- Code is divided between `src/content`, `src/styles`, `src/themes`, `src/popup` and `src/shared`.
- Packaged files contain local scripts/styles under an explicit Manifest V3 content security policy.

Build checks validate manifest asset references, classic-script execution and popup asset packaging. They do not validate actual browser installation, Spectrum DOM compatibility or visual rendering.

## Roadmap

2. Foundational Spectrum dark theme implemented; user confirmed it is visible.
3. Forum styling implemented and fixture-checked; user approved the updated live appearance.
4. Desktop chat styling implemented; user approved the live colour correction.
5. Settings, local storage and 16 built-in themes implemented and fixture-checked; real extension storage validation pending.
6. Nine RSI section modules implemented; Account/Profile and My Hangar use current published CSS contracts, with signed-in visual validation pending.
7. Release artifact validation implemented and passed; real Chrome/Edge compatibility and live performance validation pending.

Build references: [Vite production builds](https://vite.dev/guide/build.html) and [Chrome manifest content scripts](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts).

Release packaging and remaining browser checks: [Release validation](docs/release-validation.md). Run `pnpm build` then `pnpm check:release` for artifact-only validation.
`nChris Roberts theme (0.11.2): select it under Themes and save for a cyan/magenta holographic Spectrum interface with static scanlines, glowing borders and chromatic separation on headings and controls. Spectrum text is deliberately obscured by heavy chromatic separation and blur; popup settings remain readable.
Hangar search and data tools: beside Ship upgrades, search package names and listed contents across Hangar pages. The first search reads pages sequentially and builds a memory-only index; failed pages are reported and can be retried. The expandable Hangar tools panel filters type, LTI, giftable/reclaim status, Warbond and melt value, and exports CSV or Hangar Transfer JSON. Pledge IDs, base pledge names and melt values appear on cards when RSI provides them. Requests remain same-origin and read-only.
`nSpectrum conversation context (0.11.2): single-reply links now offer Extend conversation. It loads the original post and parent reply chain inline, with a yellow outline around the reply originally opened. Click the line again to collapse context. This follows parent replies, not unrelated sibling branches, and uses the Forums module toggle.
Hangar grid (0.11.2): select List or Grid beside the item filter. Grid uses large image cards; expanding a card spans the content width. The selected view is saved locally and uses the existing cards, image preview and search anchors.
My Hangar redesign (0.12.69): search and pledge tools sit in a unified header, with an item count and indexing state beside My Gear. Sort all Hangar pages by default order, date or value, choose 9/18/36/All items, and see the visible range and page number. All-items loading avoids repainting the entire card list for each fetched page.
Hangar ship titles (0.11.5): package cards use the contained ship's name and thumbnail, with the original package name beneath. The expand arrow follows the same placement as other cards, and the upgrade control has its own line.
Hangar favourites (0.11.8): star standalone ships and packages containing ships to save them locally. The star is inserted into the native card heading, even when RSI wraps its list in an extra container. Page one shows saved items at the top, promoting native cards already on that page and linking saved cards on other pages to their original pledge. The section follows List/Grid view and uses separate storage from appearance settings.
Hangar actions (0.11.9): preserve the native action-icon geometry used by RSI's Ship upgrades, Hangar log and card upgrade popovers. Keep the card Upgrades button fixed in place on hover; its hover transition now changes only paint properties.


Hangar Log timeline (0.11.10): restyle the supplied native pledge history as a cyan-accented activity timeline, emphasizing pledge names and clarifying date/action text while retaining RSI's close control, loader, entries and scroll implementation.

