# Spectrum foundation inspection — 25 October 2026

Inspected the live public site in the in-app Chromium browser, signed out:

- `/spectrum/community/SC`: community navigation and forum categories.
- `/spectrum/community/SC/forum/3`: loaded discussion list.
- `/spectrum/community/SC/forum/3/thread/roadmap-roundup-october-21-2026`: discussion body and replies.
- Opened the legacy Flag Post modal solely to inspect its structure, then cancelled without entering or submitting data.

## Verified boundaries

- `#react.theme-dark` contains `.mainLayout`, `.mainLayout__body`, `.mainLayout__content`, `.screen-layout` and sidebar components.
- New list components use `.orion-tavern-c-ThreadListHeader`, `.orion-tavern-c-ThreadListItem`, `__header` and `__subtitle`.
- Legacy discussions use nested `.app.theme-dark`, `.forum-thread`, `.content-blocks` and `.forum-thread-time-created`.
- Modals are outside `#react`: `.ReactModalPortal .theme-dark .modal .modal-content`. Observed `.c-modal-header`, `.modal-content-footer`, `.custom-select .fake-select`, native `select`, `textarea`, `.action-button` and `.action-button--error`.
- New portal mount: `#portal-root`. Only its inherited palette is prepared; unobserved widgets are not targeted.

## Palette evidence and approach

The live `.theme-dark` rule declares `--theme-bg-color-1` through `-9`, text, border, sidebar, forum and input variables. Orion variables include `--orion-semantic-background`, `--orion-semantic-default_default`, `--orion-semantic-focus`, and Orion 3 surface/foreground/border variables. Source CSS and computed styles were inspected before selecting the overrides in `src/themes/spectrum-enhanced.css`.

The layout body/content backgrounds are hard-coded in the site's stylesheet, so they receive explicit scoped overrides. The palette is reapplied at nested theme and portal boundaries because those nodes redeclare site tokens. No DOM changes, observers, requests, layout dimensions or avatar changes are introduced. Existing unread flashes and role/error states remain site-controlled.

## Limits and verification

Observed the current signed-out dark-mode DOM at the browser's default viewport. Authenticated editors, alternate site theme modes, all responsive breakpoints and chat interactions have not been validated. Shared tokens can naturally affect chat colours; its dedicated redesign remains Phase 4.

Automated theme checks cover packaged CSS path isolation, absence of remote CSS assets, and base palette contrast. The local fixture uses verified component boundaries to inspect CSS parsing, nested token inheritance, focus and modal surfaces; it is not a reproduction or live integration test.

Local Chromium fixture check: the bundled stylesheet parsed as 15 rules; computed root/content background was `rgb(15, 20, 27)`, card/nested app/modal surface was `rgb(22, 30, 40)`, discussion text was `rgb(230, 237, 243)`, metadata was `rgb(175, 189, 203)`, and links were `rgb(128, 204, 239)`. Keyboard navigation to the textarea displayed a 2px accent focus outline. These are fixture observations only.

Before release, reload the unpacked extension in Chrome and Edge and check the live community/list/thread views, keyboard focus, navigation, a cancellable modal, and unchanged RSI pages outside `/spectrum/`.

## Phase 3: forum inspection and implementation

Re-inspected the live General forum list and the same Roadmap discussion before adding forum rules. Observed the following:

- `.thread-list-screen > .screen-layout__main` wraps the header, list and pagination. `.thread-list-screen__thread-list` owns a grid; `.orion-tavern-c-ThreadListItem` uses `grid-template-columns: subgrid` and its own `--_padding`/`--_gap` variables. Responsive `-isMobile`/`-isTablet` variants change the grid. The extension preserves these templates and only adjusts spacing, card borders and the main width cap.
- `.orion-tavern-c-ThreadListItem.-isRead` is verified in site CSS. Read titles receive muted text; absence of that class is not treated as proof of unread content.
- Legacy `.forum-thread.discussion` contains the original `.type-forum_thread`, header and `.forum-thread-replies`. Each reply has `.content > .content-main` followed by `.forum-thread-item-children-replies` inside the same `.content`. Parent card decoration applies to content-main, leaving nested replies outside that card and preserving gutters/collapse controls.
- `.forum-thread-item.unread` is a real site state with a highlighted background. Empty `.unread` children are present on ordinary replies too. The new inset accent marker targets only the item state; the site's background remains unchanged.
- Avatars use `.member-avatar .avatar > img`, including role borders and badge variants. Only corner radii change; original sizes, role colours and badges are retained.
- Rendered quotations use native `blockquote`. Image attachments are linked `.content-block-media > img`; links remain intact. Existing source CSS defines native `pre`/`code` and `.media-embed-wrapper` with a 550px width and aspect-ratio-controlled embed children. Code/embeds were not rendered in the inspected public discussion, so the extension uses conservative native-code styling and a wrapper max-width without changing embed/consent behavior.

Defaults are a 1200px maximum column, 14px card padding, 12px gaps and 8px avatar corners. Extension-owned root density/avatar attributes provide CSS variants for Phase 5. No settings, storage or runtime DOM work is added here.

### Phase 3 verification

- Production build succeeded. The Spectrum-only packaged-CSS test passed; no unrelated suite/type/contrast checks were run.
- Browser fixture before implementation: content width was 1265px with no cap; a 1600px image exceeded its 1201px content region.
- Desktop fixture after implementation: list and discussion capped at 1200px, original subgrid retained, parent content padding 14px, media contained, code scrolled internally and no horizontal page overflow. Unread background and collapse control were preserved. A chat lookalike outside the forum root retained zero padding.
- Compact/circle/custom-width fixture: 900px width, 8px list/post padding and 50% avatar radius. A late-inserted card immediately inherited spacing and rounding. Comfortable/square fixture: 20px padding and 0px avatar radius.
- At a 390px viewport, page scroll width was 375px, image/embed widths matched the 285px content region, and long code scrolled inside its 283px container. The temporary viewport was reset afterwards.

These checks use a reduced synthetic grid/flex fixture built from observed contracts. Actual Chrome/Edge installation, authenticated controls, deep nesting and every live responsive grid variant still require live validation. After updating, reload version 0.3.0 and refresh Spectrum; verify list navigation, nested reply collapse, media links and actual unread states.

## Desktop correction — version 0.3.1

User feedback supersedes the earlier reading-width/mobile assumptions: this extension targets desktop, and forums must use the available content area beside the sidebar. The earlier 1200px cap and auto margins caused the reported central column. Default width is now `100%`, margins are zero, and the extension's mobile media query has been removed.

The user identified Star Citizen – Better Spectrum Dark Theme (later listed as Better dark RSI webstyle), ID `omcmgcldeclkpakdccipdajcfddhcdkj`. The store description documents readable fonts and round avatars, but original CSS/exact font details were not found. Current typography is a recreation using Arial/Helvetica/sans-serif, 16px forum titles, 13px metadata, 15px discussion text and circular avatars by default.

Live desktop inspection confirmed that newer `.header__title.a-fontStyle` and `.title__link` explicitly use Univia Pro; subtitle/stat components use Bai Jamjuree. These component declarations bypassed the foundation's inherited system font. Forum-scoped overrides now include verified `.a-fontStyle` components and legacy discussion text; code keeps its monospace family. No new website selector assumptions were required.

Focused verification: production build passed. The desktop fixture reproduced a 1200px column in a 2250px available content region before the fix. Afterwards, list/discussion widths both matched 2250px at a 2553px viewport and 1617px at a 1920px viewport, accounting for the 288px sidebar and scrollbar. Computed titles/body were Arial/Helvetica/sans-serif, code remained monospace and avatar radius was 50%. Neither viewport had horizontal page overflow. No mobile tests or unrelated checks were run. Live unpacked-extension appearance remains user-validated.

## Avatar/reply sizing — version 0.3.2

User requested larger round profile pictures and roomier reply cards. Using the already verified legacy avatar/gutter/header selectors, original-post avatars are now 80px and reply-header avatars 56px. The original-post gutter reserves the larger width; images fill their avatar without changing role borders or clipping badges. Reply/post card padding is 22px, with 18px top-level reply spacing, separate from forum-list density. Compact/comfortable variants retain smaller/larger reply padding.

Production build passed. The targeted desktop fixture confirmed 80px/56px avatar widths, 22px padding, 18px spacing, preserved full available width, no horizontal page overflow and a working synthetic collapse control. Actual Spectrum rendering still requires refresh and user inspection.

## Unified replies and compact media — version 0.3.3

Inspected the actual user-reported public thread `/spectrum/community/SC/forum/3/thread/ship-weight-limit` and the author's reference page at https://www.fwkart.de/star-citizen-chrome-extension-better-spectrum-look/ . Visually inspected all four Spectrum screenshots: community, forum list, discussion and chat. The reference uses subdued navy, readable text, round avatars and restrained reply framing; the author's text explicitly describes images side by side to save space. Exact font/source CSS is still unverified; the current implementation recreates the visual direction on today's Spectrum DOM, preserving the user's desktop/full-width and larger-avatar preferences.

Live evidence: `#page.forum-thread` encloses discussions. Legacy rules paint `.depth-odd` reply items behind our inner content-main cards, causing the double surfaces. The original `.type-forum_thread > .gutter` is a separate full-height flex column containing the author avatar and badges. Collapse gutters are absolute at left 0 with a 23px width. Single image blocks are `.content-block.image.single`, flex-centred panels containing a decorative `.block-icon` and linked `.content-block-media`.

Fix: top-level reply items own a single card; content-main is unboxed and nested items have transparent surfaces plus a thread divider. Real unread/flash/editor states remain visible on the outer surface; only their matching important site backgrounds are overridden. Collapse gutters retain space. The original-post avatar sits absolutely beside a header tall enough for its badge; body/footer use full width. Single image panels become intrinsic-width inline-flex attachments aligned from the left; image links/actions remain untouched, and decorative block icons are hidden.

Focused fixture evidence: original body inset reduced from 103px to 23px; inner reply border is 0, outer border 1px and nested background transparent. Two 400px attachment blocks now share a row rather than occupy separate 827px panels. Avatar sizes, unread marker and collapse remain functional with no horizontal page overflow. Static review found no blocking issues. Live extension appearance remains pending user inspection.

## Phase 4 desktop chat — version 0.4.0

User approved the live forum appearance before continuing. Inspected public `/spectrum/community/SC/lobby/1` signed out, including loaded messages, grouped follow-ups, a mention, YouTube/Imgur media previews, channel navigation and the online-user panel. No live messages were typed or sent.

Verified DOM contracts:

- `#page.lobby` contains `.lobby-header`, `.messages-list > .messages-items` and `.lobby-footer`. The native list owns scrolling; neither its display/flex direction nor message ordering is changed.
- `.message-item` has `.gutter` and `.content`, with `.top` metadata and `.bottom .body`. `.type-small` follow-ups omit avatars and show gutter timestamps on hover. Author role colours, erased/revealed states, highlight borders and action controls remain site-owned.
- Mentions use `.mention` and current-user state `.mention.current-member` (the latter also verified in source CSS). Media uses `.message-media`, `.handle .provider`, `.message-media-rich`, `.message-media-meta`, `.image.photo`/`.image.video` and `figure`.
- Live chat inspection confirmed `.orion-tavern-c-SidebarLeftBookmark` anchors with `/lobby/` hrefs and `.-isSelected`. The active bookmark cue now follows that shared bookmark class under `#react` across Spectrum sections, including forum bookmarks, as requested from the supplied screenshots. The forum selected state was not independently inspected in authenticated DOM. Online-user panels remain route-scoped with `#react:has(#page.lobby)` because they sit outside `#page`.
- Online-user lists include positioned rows; only palette/font are adjusted, not row dimensions or virtualization.
- The signed-out footer has typing status but no composer. Current site CSS verifies `.message-input .message-row > .input`, `.input.error`, `.draft-extend`, character-counter error states and footer placement. Composer styling excludes `.input.error` backgrounds and does not target counters, submit buttons or editor content/logic. Real signed-in composer validation remains pending.

Implementation appends `src/styles/spectrum-chat.css` to the CSS bundle. Defaults are Arial/Helvetica/sans-serif, 15px text with 24px line-height, 48px round avatars and 12px message padding. Grouped follow-ups stay tight. The extension's existing compact-density attribute selects 36px avatars and 7px message padding; popup controls remain Phase 5. No runtime JS, permissions, dependencies, observers or polling were added.

Targeted validation: production build and the Spectrum-only packaged-CSS test passed. Before styling, the fixture had 40px avatars, normal line-height, no selected-channel cue, and a 900px attachment in a 790px content region. Afterwards it confirmed 48px avatars, Arial/24px body text, contained attachments, selected-channel/current-user cues, unchanged hidden grouped timestamps, preserved red error backgrounds, late message styling and local-only text entry/focus. At 1920px, compact mode confirmed 36px avatars, 7px padding, 2px grouped bottom padding, unchanged native auto scrolling, a 200px presence panel and no horizontal page overflow. Temporary viewport was reset; static review found no blocking issues. No forum/mobile/unrelated suite checks were run. Actual authenticated chat behavior and browser installation remain live validation work.

## Legacy chat background correction — version 0.4.1

The user's live screenshot showed message/avatar styling active but the old blue background still present. Live CSS inspection found `.app.theme-dark .app-content #page.lobby #page-main .messages-list` and the corresponding header rule: both contain two IDs plus more classes than the original two-ID extension overrides. Inner `.lobby-member-presences` and its `.search` also painted blue independently of their outer panel.

The fixture now includes these exact competing site rules. It reproduced blue RGB(14,40,58) on messages before the fix. The extension now includes the verified `#page-main` in header/list selectors and targets the nested presence/search layers. No important overrides or layout changes were needed. Build passed; the scoped fixture confirmed background RGB(15,20,27), header/presence/search RGB(22,30,40), and unchanged red editor error state, native auto scrolling and grouped timestamp visibility. Live appearance remains pending user refresh.
`n## Conversation extension — 0.9.0`nInspected public boot.js -> Main.uX02y0Mw.js, release 7.160.0. Verified native single-reply h3 banner, thread reply data-reply-id and API read endpoints. Supplied public /spectrum/community/SC/forum/3/thread/sq42-play-test/9176422 returned original 9175809 and ancestors 9175831, 9175910, 9176406 before target 9176422. Top-level reply has no parent; original comes from thread content_reply_id. Implemented loader confirmed this exact order against public API without browser/session access. Local mock verified inline expansion/collapse, yellow 2px target outline and literal untrusted markup. Parent context renders plain text and legacy image attachments; full native formatting/other embeds remain available through original/parent links. No signed-in UI inspection performed.
`n0.9.1: supplied screenshot requests nested ancestry instead of separate context cards. Parent articles now contain their child context with 40px indentation and 2px connecting borders, round 56px avatars, author handles/times and explicit Replying to labels. The native linked reply is indented at the next depth and retains its yellow outline and controls. Collapse restores native indentation; cleanup restores the inline depth property. Local fixture confirmed increasing parent positions and yellow native outline; no signed-in UI inspection.
`n0.9.2 avatar repair: public reply 9175910 returns member.avatar=null. Current native bundle uses https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg as its fallback. Context headers now always reserve a 56px avatar slot and use that native default for absent/unsafe URLs, with initials if the image request fails. Names fall back from displayname to nickname to Unavailable author. Targeted author/chain tests and scoped TypeScript passed.
Enhanced blocking 0.10.0: verified legacy member-profile/profile-member-nickname/profile-actions and native Block/Unblock handlers in public 7.160.0 bundle; blocked-users/table-row/table-cell provides handle and action columns. Local fixture verified default J3PT removal, later posts, preserved unblocked children, profile/table restore, simulated native handler invocation and cross-tab popup undo. Actual signed-in native blocking and alternate modern profile UI remain unverified. J3PT preset is local-only. Unknown author identity is left visible; native placeholders may use exact unique stored display names.
0.10.2: permanent Block/unblock J3PT toggle is also inserted into native .blocked-users settings, independently of listed user rows. Local fixture confirmed toggle visibility, removal, restore and synchronization with the row checkbox.

## Message of the Day card — version 0.11.23

The user supplied a Spectrum chat screenshot showing the full-width Message of the Day banner, title, age, multiple announcement lines, a version link and a dismiss control. The redesign targets the existing `.lobby-message--motd` wrapper under `#react #page.lobby`, so General and Testing receive the same chat styling. It changes presentation only and leaves native display, positioning, content, dismissal and scrolling behavior in place. A follow-up screenshot showed the site's bright-blue inner panel and close-control border still visible. The CSS now clears descendant backgrounds, borders and shadows with a selector that outranks the verified legacy chat selector pattern, while keeping the native structure and button hover/focus behavior. A synthetic local fixture covers those competing styles; no live inner MOTD markup was inspected.

## Spectrum online roster redesign — version 0.11.25

User-supplied panel markup shows `.quick-access-header-title`, `.online-count`, the native settings/close SVGs, a search input, and a `ReactVirtualized__List` with 36px member rows. Group headers and avatar borders carry inline category colors; the status icon is an SVG with a native state class such as `.member-presence.online`. A supplied status-menu screenshot identifies Online, Away, Do Not Disturb, Invisible and Playing states with distinct colors. The redesign styles panel controls and row alignment, preserves the virtualized row height and inline group/avatar colors, and does not set presence icon `color`, `fill` or `opacity`; other state colors remain owned by Spectrum's native status classes. Non-online row markup was not supplied, so those state selectors are intentionally not guessed.

Roster profile pictures use the shared `--rsi-avatar-radius` value, keeping the circle, rounded and square appearance consistent with the selected Spectrum avatar setting. Version 0.11.34 restores the online roster styling after it was removed during a later chat-only change. It styles the header, filter, category bands, avatars and row alignment while retaining 36px virtualized rows, native presence-state colors and the selected avatar shape.

## Spectrum live-chat mention highlight — version 0.11.35

Spectrum marks a mention of the signed-in user with `.mention.current-member`. Both General and Testing share the `#page.lobby` message structure, so matching rows receive a subtle accent surface and left edge, an outlined mention token, and a compact “Mentioned you” badge. The rules target only message rows; the online-user panel and native scrolling remain unchanged.

## Same-author live-chat separators — version 0.11.36

Live lobby rows expose the sender handle through `.member-nickname`; `.type-small` rows are continuations of the preceding full row. The chat-only controller compares adjacent sender handles and suppresses the divider between confirmed consecutive messages from the same account, restoring one at author changes. Missing identity leaves the existing divider behavior intact. The controller observes only the message list and removes its row markers when chat styling is disabled or the route changes. General and SC testing chat share this structure; the Online Users panel is untouched. Local fixture/runtime tests cover repeated full rows, grouped follow-ups, changed authors, later inserted rows and cleanup. No authenticated live-browser validation was performed.

## Spectrum notifications popup — version 0.11.26

User-supplied outerHTML shows `aside.quick-access.notifications` with a native Clear all button, a `.notifications-list`, linked `.notifications-item` rows, background-image avatars, timestamps and per-item `.item-menu` buttons. The list also contains non-link moderator notices. The CSS restyles these surfaces and controls, uses the shared avatar-shape setting for notification pictures, and preserves Spectrum's popup placement, list scrolling, link targets and button handlers. Non-link notice rows use a fixed amber surface and marker independent of theme variables. No expanded notification state was supplied, so no expanded-state selectors are assumed; the panel is found by its exact class without relying on a mounting parent.

## Spectrum Friends panel — version 0.11.31

User-supplied Friends markup confirms a quick-access panel with Add/settings controls, a “Filter friends” field, a React-virtualized list, 36px rows and online/offline presence classes. The panel uses the shared roster styling, dims offline names and keeps “Last online” details visible. It targets the unique native search placeholder rather than assuming an outer wrapper class; native row geometry, presence icon colors, filtering, scrolling and actions remain site-owned. Friend avatars and their images use the configured avatar shape. The supplied sample contained only online and offline friends.

## Spectrum channel label formatting — version 0.11.27

The user screenshot shows the lobby bookmark labels `#general` and `#sc-testing-chat`; the observed bookmark selector is `a.orion-tavern-c-SidebarLeftBookmark[href*="/lobby/"]` with `.orion-tavern-c-SidebarLeftBookmark__names` for its label. When the chat module is enabled on Spectrum routes, these two visible labels become `SC General` and `SC testing chat`. The anchor hrefs and all other channel labels remain unchanged. Original text is restored when navigating away from Spectrum or disabling chat styling.

## Spectrum active channel title — version 0.11.30

The same display names apply to the active lobby title at `#react #page.lobby .lobby-name`, so the top heading matches the sidebar. The selected `/lobby/` bookmark is the source of truth if Spectrum leaves the header stale during a channel switch. A bounded observer watches selection-class changes on bookmark anchors, the `.lobby-header`, its direct parent for header replacements, and bookmark containers. While waiting for the sidebar to mount, it still handles changes inside the known title header and filters unrelated page mutations. Original text is restored only while the extension's display label is still present, which avoids overwriting a newer native title when React reuses the heading.

When the extension is reloaded while a page is still open, Chromium invalidates the old content-script context. Hidden-user initialization treats that specific condition as recoverable and tells the user to refresh the page. Other storage failures get up to three quick attempts, and later hidden-user changes can restart initialization after a persistent failure; any remaining error includes its underlying cause in the console warning.

## Spectrum Friends settings popover — version 0.11.32

User-supplied markup confirms `.quick-access-settings` contains three navigation links, an `<hr>`, and `.smart-checkbox` rows with native `.widget.allow` checkmark and `.widget.disallow` cross states. The popover uses the shared theme surface and border tokens; links and rows receive consistent spacing, typography, hover, and keyboard focus styling. Its native anchoring and state icon colors remain unchanged. The local fixture includes the supplied menu structure; no live browser inspection was performed.

## Global developer text preference

The user-supplied thread-list fragment identifies developer latest-reply authors with `.orion-tavern-c-ThreadListItem__role-line`. Supplied post markup has no explicit post-level role class; its developer author is marked by the inline gold name color `rgb(191, 167, 57)`, with a matching gold title and text-block color. The global developer-text dropdown offers Gold (native Spectrum styling), White and Off-white (`#d6d9dd`), targeting marked author text in forum lists and developer-authored original posts/replies. It leaves reply nesting, ordinary posts, links and chat unchanged. This post-level role cue is based on the supplied staff post sample and should be revisited if Spectrum changes its role colors or markup.

## Saved Spectrum forum threads

The supplied thread-list contract uses `.thread-list-screen .orion-tavern-c-ThreadListItem` with title links at `a.title__link`. Canonical same-origin forum thread paths are accepted both with and without a trailing numeric reply ID. Saved titles and canonical thread paths live under `rsiEnhanced.savedThreads`, separate from appearance preferences. Forum rows get a compact extension-owned star beside the title; dynamic rows are handled through a filtered child-list observer, including React-reused row links. The legacy-bookmark recovery below applies only to the separate native favorite in the thread header.

On an individual thread page, new favorite clicks on an unbookmarked post are routed into the local Saved Threads list and stopped before Spectrum's delegated handler can add a native bookmark. A matching thread already bookmarked natively is treated as legacy state: its explicit star click is allowed through so Spectrum removes that one bookmark, and any duplicate local save for the same URL is cleared. This avoids silently removing unrelated bookmarks; after the legacy entry is cleared, the next click saves locally. Removal is confirmed by the matching sidebar entry or the native header control's own state, so truncated sidebar lists do not create a false success. If native removal does not complete within 1.8 seconds, the star returns to its active state and a later click can retry; a narrowly scoped attribute observer also catches delayed native completion. Disabling during an unconfirmed removal preserves the native state. The button's label and pressed state reflect either store, and its original attributes and native behavior are restored when the Saved Threads setting is disabled. Clicks received before storage finishes loading are queued against the loaded state. Thread titles are extracted from the heading after its interactive, notification and subscription controls are removed; the data normalizer also removes known notification-menu suffixes from older records. Tests cover both stores, native removal/retry/delayed completion, sidebar truncation, title cleanup, startup storage delay, disabled restoration, local persistence and sidebar rendering. This thread-page selector is covered by the local fixture; no authenticated live-browser validation was performed.

The sidebar group is inserted after the shared native bookmark container and renders title-only links with a small star button to remove each local save. If there are no native bookmark links, it uses the visible `Bookmarks` heading as a fallback anchor. Removing a local save changes only `rsiEnhanced.savedThreads`; the matching legacy thread bookmark is removed only by an explicit click on that thread's active native favorite. The supplied material does not include the native sidebar's outer container, so the heading fallback still needs live verification.

## Extend conversation reply actions — 0.11.94

Every reconstructed ancestor and original thread post has a named Reply action that identifies its recipient. The action stores a short-lived, same-tab reply intent and clicks Spectrum's native “View the rest of the replies” link; after the native thread view loads, the extension finds the exact post ID and opens that post's native Reply control. The intent is cleared after activation, expires after one minute, and is discarded if the user navigates to another thread. A direct single-reply URL with an explicit target ID remains as a fallback if the native thread link is unavailable. Once the chain loads, the linked reply is re-resolved in the live DOM, given a stronger yellow outline/glow and brought into view with smooth scrolling. Focused synthetic tests verify native navigation, recipient targeting, single-reply/thread routes, scroll behavior and highlight rules. Live authenticated Spectrum behavior still needs browser validation.


## Spectrum community home structure — 30 October 2026

The user supplied a DevTools class-tree from the current `/spectrum/community/SC` page. It confirms `#react .mainLayout__body` contains `.mainLayout__left`, `.spectrumSidebarLeft`, `.mainLayout__content`, and `.mainLayout__right`. The content area contains `.screen-layout.community-screen`, `.orion-tavern-c-CommunityBanner`, `main.screen-layout__main`, and `section.community-screen__content`.

Within `.community-screen__content`, two `article.community-screen__article` sections contain `.orion-tavern-c-CommunityList`: the forum list and the chat lobbies. Forum accordions are `.orion-tavern-c-CommunityGroup`; their header/action and open content use `CommunityGroup__header`, `header__actions`, `CommunityGroup__collapsible.-isOpen`, and `.community-screen__group`. Forum rows are native `.orion-tavern-c-CommunityGroupItem.community-screen__link` anchors with `CommunityGroupItem__header`, `__description`, and `__content`. Chat lobby links use the same group-item component and native `/lobby/` destinations. The list ordering and links remain site-owned.

The home redesign uses these supplied selectors only under an exact `/spectrum/community/SC` route marker. Forum, lobby, and other Spectrum routes do not receive the new layout rules. No authenticated actions or browser state were inspected.

Computed styles supplied by the user show the patterned SVG and blue gradient belong to `.orion-tavern-c-CommunityList`, while the heading and article cards are extension-owned surfaces. Keep the native list artwork, but make the surrounding Forum/Chat article boxes and heading backgrounds transparent so the artwork remains visible. The original banner divider was removed in the first redesign pass; the later reference treatment adds one rail outline after the curved shoulder.

The user supplied a visual reference of the native left Spectrum sidebar. The home-only restyle uses the observed `.spectrumSidebarLeft` and `.orion-tavern-c-SidebarLeftBookmark` contracts, with semantic heading, anchor, button and divider rules scoped beneath the sidebar. Keep the shared wrapper free of added padding so it does not compress the icon rail; constrain spacing to known bookmark rows and compact action controls to fit narrow headers. Generic sidebar anchors retain native sizing so the icon rail and message rows are not reshaped. Native bookmark destinations and controls remain React-owned; private-group actions are not recreated or intercepted.

User-supplied DevTools output later confirmed the `div.orion-tavern-c-SidebarLeftContentGroup` section wrapper and `SidebarLeftContentGroup__header` heading. Recent Messages uses the `SidebarLeftContentGroup__content` list with native `a.orion-tavern-c-SidebarLeftDirectMessage` rows, `SidebarLeftDirectMessage__avatar`, and `orion-c-avatar__image`; its presence overlay stays site-owned. The existing add buttons are labeled `Start a conversation` and `Start a group`. Version 0.13.5 styles those image rows and frames the content pane. Version 0.13.6 replaces the boxed pseudo-element prompts and moved header actions with an unboxed people-icon empty state and a separate CTA for each empty list. Each CTA invokes the matching native header button; scoped child-list observers refresh the state when RSI inserts or removes rows. The supplied markup did not include the full empty Private Groups container, so the fixture covers both an empty list and a missing list; final appearance should be checked against the user's reference.

Version 0.13.7 adds a bounded wait for the Spectrum app root to mount the sidebar, then watches the sidebar subtree for late-created content groups and list rows. This covers the live page's delayed React hydration without leaving a page-wide observer running.

Version 0.13.8 uses a thought-bubble icon for the empty Recent Messages state while retaining the people icon for Private Groups. The native “Start a conversation” and “Start a group” heading buttons are hidden only while their matching empty-state CTA is visible; their section settings controls stay visible, and native add buttons return for populated lists.

Version 0.13.9 removes the solid surface fills from the community banner wrapper, image header and title container. This lets the panorama remain visually continuous behind the community title rather than showing a separate dark title strip.

Version 0.13.10 supersedes that title treatment to match the supplied reference: a bright 210px panorama, an 84px deep teal title rail, a 112px overlapping avatar, and a rounded cyan shoulder joining the rail to the image. The former dark gradient over the image is removed; the title stays in the lower rail.

Version 0.13.11 explicitly fixes the panorama asset container at 210px high. The native image previously overran its intended box despite the bottom inset, covering the title rail and drawing the divider across the artwork. The fixed-height asset leaves the lower 84px rail exposed.

Version 0.13.12 supersedes that fix: the panorama retains the full banner-sized image box, while a separate opaque rail overlay covers only the lower 84px. The cyan divider begins at the end of the rounded shoulder, preventing a second line beneath it.

A user-supplied geometry snapshot confirms the collapse control is `aside.orion-tavern-c-sidebarLeft > nav.orion-tavern-c-sidebarLeft__community-nav > button.community-nav__collapse-button`. Its clickable box measures 24×24px, while the nested `.a-button__content` measures 48×48px; that oversized inner box pushes the 24px icon down and right beyond the hit area. The home-only fix positions that content across the native button and centers it, preserving the button dimensions and React action. The same snapshot confirms the banner image and asset container both remain 294px tall, with the lower 84px rail painted over the image.

Version 0.13.13 attempted to end the full-width image container at the 84px title rail, but the user's post-install measurements showed the native `height: 100%` still produced a 294px image box. They also confirmed the native `.orion-tavern-c-CommunityBanner__background-assets::after` still paints `CommunityList_decoLine.svg`. Version 0.13.14 explicitly sets the image viewport to 210px and disables that native decoration, while keeping the 294px banner, 84px rail, rounded shoulder, and one continuation divider. The updated package still needs visual confirmation in Chrome or Edge.

Version 0.13.15 moves the shoulder's top cyan stroke to 160px from the banner's left edge, leaving a small gap after the 112px avatar at 40px. The section accordion headers also gain a theme-aware cyan-to-navy gradient using the existing accent and raised-surface tokens. This is verified in the local fixture and packaged CSS; it still needs visual confirmation in Chrome or Edge.

Version 0.13.16 follows the user's current DevTools measurement: the native toggle button is 24×24px, but its content remains 48px wide even after the prior positioning rule. Its visual alignment was not confirmed in the browser.

Version 0.13.17 responds to the follow-up screenshot: set the native toggle button as the containing block, then center its 24px content box on the button, overriding the inherited 48px sizing and offsets. Remove the short cyan top stroke from the banner shoulder while preserving its curved cyan edge and the distant continuation divider. The previous packaged CSS had kept this short stroke; live browser appearance remains for user review.

Version 0.13.18 updates only the forum thread list rows: retain Spectrum's native subgrid and controls, give each row a separate rounded surface with density-aware spacing, and show the gold left marker on rows carrying Spectrum's verified `.orion-tavern-c-ThreadListItem__role-line` developer cue. The top thread header and its native sort, favorite, mute, and new-thread controls are not targeted.

The user's 0.13.19 DOM snapshot shows that Spectrum inserts an empty `.orion-c-divider.-hasStartDecoration.-hasEndDecoration` between forum rows. Its pseudo-elements paint the extra cyan rule seen in the screenshot. The forum-list CSS now hides only these direct children of `.thread-list-screen__thread-list`, preserving the row gap and leaving other page dividers untouched. The same release applies the redesigned sidebar and its empty Recent Messages/Private Groups states on every Spectrum route; the community banner and home layout remain home-only.

Version 0.13.20 adds a density-aware end inset to the forum thread-row subgrid (`max(8px, var(--rsi-forum-padding))`) so the rightmost native vote control has visible room inside the card border.

Version 0.13.21 brings forum rows closer to the selected reference: slimmer list typography and vertical padding, with subtle dividers at the verified last-reply and stats columns. The vote button keeps its existing density-aware inset. Native subgrid columns and list controls remain owned by Spectrum.

Version 0.13.22 increases the stats cell's end padding so the view count has more breathing room before the right divider. The Spectrum theme runtime test now follows an open community-home route while switching OLED Black, Aegis with a custom accent, and Enhanced presets, confirming the root palette updates. The explicit page-shell background includes the observed `.mainLayout` wrapper, and the community banner panel and edge now use the selected surface and accent tokens instead of fixed blue. Focused forum-list, home, theme, and runtime checks passed; live rendering was not inspected.

Version 0.13.23 completes palette coverage for the community home. The left and right layout columns now receive the selected background token, and the Forum/Chat Lobbies panels replace Spectrum's fixed blue artwork with a restrained diagonal treatment built from the current background, surface, and accent tokens. The pattern therefore changes with all presets and custom accents. Focused community-home and Spectrum theme checks passed; live rendering was not inspected.

Version 0.13.24 supersedes the broad 0.13.23 recoloring after the user clarified that the panels should retain their existing appearance. Restore the established banner rail and native Forum/Chat panels, leave the sidebar alone, and apply `--rsi-background` only to the home backdrop for non-default presets. Spectrum Enhanced retains its native default background; alternate presets such as OLED Black now match the backdrop treatment already working on forum pages. Focused home and theme checks passed; live rendering was not inspected.

Profile menu layout follow-up (0.13.27): User-supplied live markup shows native actions as `.profile-action` rows containing 12×12 SVG elements with class `icon`; the native Block row uses the same structure. The extension action now uses that class and icon slot for its skull so native sizing and spacing apply. This update is based on the supplied markup and has not been inspected in a signed-in browser.

Profile menu alignment follow-up (0.13.28): The 0.13.27 screenshot showed the custom button content starting 10px left of the native action icon/text columns, and the custom SVG used the browser's dark default fill. Preserve the button's compact inline sizing while adding the matching 10px leading inset and `currentColor` fill. The Recent Messages description is “Start a conversation to see messages here.” The screenshot-based alignment has not been validated in a live signed-in browser.

User-supplied bookmark HTML from a Spectrum community page confirms `.orion-tavern-c-SidebarLeftBookmark` rows contain an avatar image, a type-specific `__icon--rowsNested` forum or `__icon--chat` lobby glyph, a `__names` label, an optional `__counter` wrapping the native `-bullet` unread glyph, and a native drag button. The matching counters appear on rows without `-isRead`; read rows include that class and omit the counter. Version 0.13.40 uses a circular badge with a bookmark glyph, distinct stacked-forum and chat-bubble icons, and amber signal bars for unread state. The known `title="#sc-testing-chat"` label displays as “SC Testing Chat” at the same 14px size as the native labels, replacing the original text visually. Native anchors, unread/read state, and drag controls remain owned by Spectrum. This styling follows the supplied live markup and has not been verified in a live browser after installation.
## Spectrum Messages drawer — user-supplied markup

The supplied live class-tree confirms the right drawer at .mainLayout__sidebar.mainLayout__right contains aside.orion-tavern-c-sidebarRight, a header titled by .orion-tavern-c-sidebarRightHeader__title[title="Messages"], the native New action, the conversation-search input (input[data-cy-id="input"]), and .orion-tavern-c-sidebarRightContent. The empty state is .m-emptyState.t-messagesEmptyState with its native SVG, text, and New button. Version 0.13.41 styles only this exact Messages drawer surface and empty state through shared theme tokens; the empty-state screenshot has been supplied. It also replaces the bookmark badge with a standalone bookmark glyph. No populated conversation-list DOM was provided, so styling of conversation rows is left native until those selectors are observed. Buttons, input behavior, panel layout, and React-owned elements remain native. Local fixture coverage does not constitute live browser validation.

The later user-supplied populated drawer confirms that each conversation is an `a.orion-tavern-c-SidebarRightDirectMessage` with a native avatar, sender name, excerpt, optional unread counter, and close button. Version 0.13.42 styles these verified elements with compact quick-panel spacing and shared theme tokens; native links, search, New, and close actions remain unchanged. Version 0.13.43 moves the header and populated rows closer to the approved mockup, including a visible accent-filled New action and an amber unread signal. The supplied example included account and message content, which is redacted from fixtures and documentation. Rendering after installation was not inspected in a live browser.

Bookmark follow-up (0.13.43): the screenshot showed that the native `.orion-c-avatar__wrapper` retained a circular background behind the replacement glyph even though its outer bookmark slot was transparent. The sidebar-only rule now clears the wrapper background, border, radius, and shadow as well. The native bookmark destination, forum/chat glyphs, unread marker, and drag control remain unchanged. This correction has focused fixture assertions but still needs visual confirmation after installation.

Messages header layout (0.13.44): the title strip retains its theme-aware diagonal pattern, while its contents now follow the Friends panel arrangement. The uppercase title and native unread count stack at left; the native New button sits at right across both rows, and search remains beneath the header. The supplied markup's inline-block wrapper around New is represented in the fixture and positioned as a grid item. Native actions and drawer structure are unchanged; live rendering was not inspected.

Messages header counters (0.13.45): the title now uses a larger type size and the header uses the same solid raised surface as the Friends and Notifications quick panels. A small extension-owned status line counts rendered native conversation rows and shows the native unread total, falling back to unread row counters when the native header total is absent. It is scoped to the Spectrum Messages right drawer and removed when theme styling is disabled. Native conversation content and actions remain unchanged; live rendering was not inspected.

Roadmap card text (0.13.45): release-view card descriptions now use 12px text, relaxed line spacing, and the primary text colour in place of the former 9px muted treatment. Card structure, image sizing, and native navigation are unchanged. Live rendering was not inspected.
