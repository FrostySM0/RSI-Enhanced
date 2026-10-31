import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isRoadmapReleaseView, isSpectrumHome, sectionForPath, RSI_SECTIONS } from '../src/shared/site-sections.ts';
import { normalizeSettings } from '../src/shared/settings.ts';
import { readFile } from 'node:fs/promises';

test('shared header avatar shape styles are packaged for RSI pages and Spectrum', async () => {
  const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
  const rsi = await readFile('dist/rsi.css', 'utf8');
  const spectrum = await readFile('dist/spectrum.css', 'utf8');
  const rsiEntry = manifest.content_scripts.find(entry => entry.css?.includes('rsi.css'));
  const spectrumEntry = manifest.content_scripts.find(entry => entry.css?.includes('spectrum.css'));

  assert.deepEqual(rsiEntry.matches, ['https://robertsspaceindustries.com/*']);
  assert.deepEqual(rsiEntry.exclude_matches, ['https://robertsspaceindustries.com/spectrum/*']);
  assert.deepEqual(spectrumEntry.matches, ['https://robertsspaceindustries.com/spectrum/*']);
  for (const css of [rsi, spectrum]) {
    assert.match(css, /#platform-bar-navigation[^{}]*orion3-c-avatar__wrapper/);
    assert.match(css, /#platform-bar-navigation[^{}]*orion3-c-avatar__image/);
    assert.match(css, /#platform-bar-navigation[^{}]*orion-c-avatar__wrapper/,
      'the current shared header avatar wrapper follows the selected shape');
    assert.match(css, /#platform-bar-navigation[^{}]*orion-c-avatar__image/,
      'the current shared header avatar image follows the selected shape');
    assert.match(css, /\.orion-c-presenceOverlay__mask\s+\.orion-c-avatar__wrapper/,
      'the account menu avatar wrapper follows the selected shape');
    assert.match(css, /\.orion-c-presenceOverlay__mask\s+\.orion-c-avatar__image/,
      'the account menu avatar image follows the selected shape');
    assert.match(css, /border-radius:\s*var\(--rsi-avatar-radius,\s*50%\)/);
  }
});

test('public routes resolve with current locale prefixes and bounded path segments', () => {
  for (const prefix of ['', '/en', '/de', '/en-GB']) {
    assert.equal(sectionForPath(`${prefix}/pledge`), 'store');
    assert.equal(sectionForPath(`${prefix}/pledge/Standalone-Ships/M80`), 'store');
    assert.equal(sectionForPath(`${prefix}/store/pledge/browse/merchandise`), 'store');
    assert.equal(sectionForPath(`${prefix}/ship-matrix`), 'matrix');
    assert.equal(sectionForPath(`${prefix}/community/orgs/listing`), 'organizations');
    assert.equal(sectionForPath(`${prefix}/orgs/ITCN`), 'organizations');
    assert.equal(sectionForPath(`${prefix}/orgs/NOVAEN/members`), 'organizations');
    assert.equal(sectionForPath(`${prefix}/comm-link/transmission/21337-Day-Of-The-Vara-2956`), 'commlink');
    assert.equal(sectionForPath(`${prefix}/roadmap/release-view`), 'roadmap');
    assert.equal(sectionForPath(`${prefix}/roadmap/release-view/1603-Orison-Relief-Support-4101`), 'roadmap');
    assert.equal(sectionForPath(`${prefix}/roadmap/progress-tracker/teams`), 'roadmap');
    assert.equal(sectionForPath(`${prefix}/roadmap/progress-tracker/deliverables`), 'roadmap');
    assert.equal(sectionForPath(`${prefix}/community/devtracker`), 'devtracker');
    assert.equal(sectionForPath(`${prefix}/community/devtracker/`), 'devtracker');
  }
  assert.equal(sectionForPath('/spectrum/community/SC/lobby/1'), 'spectrum');
  assert.equal(isSpectrumHome('/spectrum/community/SC'), true);
  assert.equal(isSpectrumHome('/spectrum/community/SC/'), true);
  assert.equal(isSpectrumHome('/en/spectrum/community/SC'), true);
  assert.equal(isSpectrumHome('/de/spectrum/community/sc/'), true);
  assert.equal(isSpectrumHome('/spectrum/community/SC/forum/3'), false);
  assert.equal(isSpectrumHome('/spectrum/community/SC/lobby/1'), false);
  assert.equal(isSpectrumHome('/spectrum/community/SC-extra'), false);
  assert.equal(isSpectrumHome('/spectrum'), false);
  assert.equal(sectionForPath('/roadmap/progress-tracker-extra'), null);
  assert.equal(isRoadmapReleaseView('/en/roadmap/release-view/1603-Orison-Relief-Support-4101'), true);
  assert.equal(isRoadmapReleaseView('/roadmap/progress-tracker/teams'), false);
});

test('public CSS is locally packaged behind independent route and module guards', async () => {
  const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
  const entry = manifest.content_scripts.find(value => value.css?.includes('rsi.css'));
  assert.deepEqual(entry.matches, ['https://robertsspaceindustries.com/*']);
  assert.deepEqual(entry.exclude_matches, ['https://robertsspaceindustries.com/spectrum/*']);
  const css = await readFile('dist/rsi.css', 'utf8');
  for (const key of Object.keys(RSI_SECTIONS)) assert.ok(css.includes(`@scope (:root[data-rsi-section="${key}"]:not([data-rsi-${key}="off"]))`));
  assert.doesNotMatch(css, /@import|url\(/i);
});

test('Roadmap release view keeps native card detail activation and the redesigned native popup styles', async () => {
  const fixture = await readFile('tests/fixtures/roadmap-release.html', 'utf8');
  const css = await readFile('dist/rsi.css', 'utf8');
  const runtime = await readFile('dist/content.js', 'utf8');
  assert.match(fixture, /<html[^>]+data-rsi-section="roadmap"/);
  assert.match(fixture, /class="App__PageContent-sc-[^"]+"/);
  assert.match(fixture, /\.App__PageContent-sc-12xftiu-1\s*\{[^}]*display:\s*block/s);
  assert.match(fixture, /class="Board__Wrapper-[^"]+"/);
  assert.match(fixture, /class="Board__ScrollContent-[^"]+"/);
  assert.match(fixture, /class="Release__Wrapper-[^"]+"/);
  assert.match(fixture, /class="Category__Wrapper-[^"]+"/);
  assert.match(fixture, /class="Card__StyledNavLink-[^"]+"/);
  assert.match(fixture, /href="\/roadmap\/release-view\/1603-Orison-Relief-Support-4101"/);
  assert.match(fixture, /href="\/roadmap\/release-view\/1604-Flight-Ready-4101"/);
  assert.equal((fixture.match(/<figure[^>]+media=/g) ?? []).length, 2);
  assert.match(fixture, /viewBox="0 0 12 13" class="StatusBar__StyledIcon-/);
  assert.match(fixture, /viewBox="0 0 10 10" class="StatusBar__StyledIcon-/);
  assert.match(fixture, /ReleaseHeader__ReleaseHeaderStatus-[^"]+"><svg[^>]+viewBox="0 0 10 10"/);
  assert.match(fixture, /\/hangar-image\.svg\?card=orison/);
  assert.match(fixture, /\/hangar-image\.svg\?card=flight-ready/);
  assert.match(css, /article\[class\*="Board__Wrapper-"\]/);
  assert.match(css, /\.App__PageContent-sc-12xftiu-1:has\(article\[class\*="Board__Wrapper-"\]\)\s*\{[^}]*display:\s*flex\s*!important/s);
  assert.match(css, /article\[class\*="Board__Wrapper-"\]\s*\{[^}]*padding:\s*0\s*!important/s);
  assert.match(css, /article\[class\*="Board__Wrapper-"\]\s*\{[^}]*height:\s*max\(560px,\s*calc\(100dvh - 144px\)\)/s, 'the Roadmap board fills the viewport below the platform bar and page-shell padding');
  assert.match(css, /button\[class\*="TogglePreviousReleases-"\]\s*\{[^}]*flex:\s*0 0 40px[^}]*width:\s*40px[^}]*margin:\s*0\s*!important/s, 'the previous-releases tab has no inherited margin creating a blank left gutter');
  assert.match(css, /article\[class\*="Board__Wrapper-"\]\s+\[class\*="Board__Releases-"\]\s*\{[^}]*margin:\s*0\s*!important/s, 'the release-list container does not push the previous-releases tab inward');
  assert.match(css, /article\[class\*="Board__Wrapper-"\]\s+\[class\*="Board__Releases-"\]\s*\{[^}]*padding-left:\s*0\s*!important/s, 'the release track begins flush beside the previous-releases tab');
  assert.match(css, /article\[class\*="Board__Wrapper-"\]\s+\[class\*="Board__ScrollContent-"\]\s*\{[^}]*padding:\s*0\s*!important/s, 'the scroll viewport does not leave an inherited gutter before the release list');
  assert.match(css, /@media \(max-width:\s*1023px\)[\s\S]*?article\[class\*="Board__Wrapper-"\]\s*\{[^}]*height:\s*max\(560px,\s*calc\(100dvh - 144px\)\)/s, 'the mid-width board also uses the available viewport height');
  assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*?article\[class\*="Board__Wrapper-"\]\s*\{[^}]*height:\s*max\(500px,\s*calc\(100dvh - 198px\)\)/s, 'the narrow layout accounts for the horizontal section rail when filling the viewport');
  assert.match(css, /\.App__Wrapper-sc-12xftiu-0:has\(article\[class\*="Board__Wrapper-"\]\)\s*\{[^}]*padding:\s*16px 10px 24px 0/s, 'the board has a right inset matching the left navigation gap');
  assert.match(css, /\[class\*="Group-sc-"\]\s*\{[^}]*border-bottom:\s*0\s*!important/s, 'the category control group has no cyan underline');
  assert.match(css, /> nav\[class\*="Navigation-"\]\s*\{[^}]*top:\s*104px[^}]*flex:\s*0 0 80px[^}]*width:\s*80px/s);
  assert.match(css, /> nav\[class\*="Navigation-"\] ul\s*\{[^}]*height:\s*100%/s);
  assert.match(css, /> nav\[class\*="Navigation-"\] li:last-child\s*\{[^}]*margin-top:\s*auto/s);
  assert.match(css, /> nav\[class\*="Navigation-"\] a\s*\{[^}]*min-height:\s*104px/s);
  assert.match(css, /> nav\[class\*="Navigation-"\] svg\s*\{[^}]*width:\s*40px[^}]*height:\s*40px/s);
  assert.ok(css.includes('a[href="/roadmap/release-view"]'), 'the current Release View link has an explicit active style');
  assert.match(css, /\.rsi-roadmap-search-highlight::after\s*\{[^}]*border:\s*4px solid #ff4d4f/s, 'search jumps draw a red inset ring inside the clipped card');
  assert.match(css, /box-shadow:\s*inset 3px 0 #56d8f4/);
  assert.match(css, /\[class\*="Board__Header-"\]\s*\{[^}]*grid-template-areas:\s*"title actions" "description actions" "legend actions"/s, 'the release color key has a header row beneath the live-version line');
  assert.match(css, /\[class\*="ReleaseHeader-"\]\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) 25px[^}]*grid-template-areas:\s*"version icon" "status status"/s);
  assert.match(css, /\[class\*="ReleaseHeaderName-"\]\s*\{[^}]*text-align:\s*left/s);
  assert.match(css, /\[class\*="ReleaseHeaderName-"\]\[data-rsi-roadmap-alpha="true"\]::before\s*\{[^}]*content:\s*"Alpha "/s, 'numbered patch headers visibly identify the Alpha track');
  assert.match(css, /\[class\*="ReleaseHeaderName-"\]\[data-rsi-roadmap-alpha="true"\]::before\s*\{[^}]*font-size:\s*\.8em[^}]*font-weight:\s*700/s, 'the Alpha prefix stays slightly smaller and lighter than the patch number');
  assert.match(runtime, /data-rsi-roadmap-alpha/);
  assert.match(css, /\[class\*="ReleaseHeaderStatus-"\]\s*\{[^}]*width:\s*max-content/s);
  assert.match(css, /\[class\*="ReleaseHeaderStatus-"\]\s*\{[^}]*display:\s*inline-block/s, 'status and quarter remain in one inline text flow');
  assert.match(css, /\[class\*="ReleaseHeaderStatus-"\]\s+strong\s*\{[^}]*font:\s*inherit/s, 'the status label uses the same text metrics as its quarter');
  assert.match(css, /\[class\*="ReleaseHeaderStatus-"\]\s+svg\s*\{[^}]*vertical-align:\s*middle/s, 'the status icon stays vertically centered beside the inline text');
  assert.match(css, /\[class\*="Card__TitleBar-"\]\s*\{[^}]*min-height:\s*48px/s);
  assert.match(css, /\[class\*="StatusBar-"\]\s*\{[^}]*font:\s*850 8px\/1\.25/s);
  assert.match(css, /section\[class\*="Release__Wrapper-"\]:has\(\[class\*="ReleaseHeaderStatus-"\]\[data-rsi-roadmap-status="tentative"\]\)\s*\{[^}]*border-top-color:\s*#c9a45c/s, 'tentative releases use the gold column accent');
  assert.match(css, /\[class\*="ReleaseHeaderStatus-"\]\[data-rsi-roadmap-status="tentative"\]\s*\{[^}]*color:\s*#f0cb78/s, 'tentative release pills use the gold palette');
  assert.match(css, /\[class\*="StatusBar-"\]\[data-rsi-roadmap-status="tentative"\]\s*\{[^}]*background:\s*repeating-linear-gradient\(135deg/s, 'tentative card status strips use the striped gold treatment');
  assert.match(css, /\[class\*="StatusBar-"\]\[data-rsi-roadmap-status="tentative"\]\s*\{[^}]*linear-gradient\(105deg, #85744e 0%, #b39c63 55%, #c2ab71 100%\)/s, 'tentative card status strips layer gold stripes over a warm gradient');
  assert.match(css, /section\[class\*="Release__Wrapper-"\]:has\(\[class\*="ReleaseHeaderStatus-"\]\[data-rsi-roadmap-status="committed"\]\)\s*\{[^}]*border-top-color:\s*#56d8f4/s, 'committed releases use cyan columns');
  assert.match(css, /\[class\*="StatusBar-"\]\[data-rsi-roadmap-status="committed"\]\s*\{[^}]*background:\s*linear-gradient\(105deg, #2587a4 0%, #40abc7 55%, #56c6e6 100%\) !important[^}]*color:\s*#08131b/s, 'committed cards use a cyan gradient status strip');
  assert.match(css, /section\[class\*="Release__Wrapper-"\]:has\(\[class\*="ReleaseHeaderStatus-"\]\[data-rsi-roadmap-status="released"\]\)\s*\{[^}]*border-top-color:\s*#50c878/s, 'released columns use green');
  assert.match(css, /\[class\*="StatusBar-"\]\[data-rsi-roadmap-status="released"\]\s*\{[^}]*background:\s*linear-gradient\(105deg, #319b60 0%, #40b96f 52%, #50c878 100%\) !important[^}]*color:\s*#08180f/s, 'released cards use a green gradient status strip');
  assert.match(css, /\[class\*="Modal__ModalInner-"\]:has\(\[class\*="StatusBar-"\]\)[^{]*\[class\*="StatusBar-"\]\[data-rsi-roadmap-status="committed"\]\s*\{[^}]*background:\s*linear-gradient\(105deg, #2587a4 0%, #40abc7 55%, #56c6e6 100%\) !important/s, 'the native card popup matches the committed gradient');
  assert.match(css, /\[class\*="Modal__ModalInner-"\]:has\(\[class\*="StatusBar-"\]\)[^{]*\[class\*="StatusBar-"\]\[data-rsi-roadmap-status="released"\]\s*\{[^}]*background:\s*linear-gradient\(105deg, #319b60 0%, #40b96f 52%, #50c878 100%\) !important/s, 'the native card popup matches the released gradient');
  assert.match(css, /\[class\*="Category__Wrapper-"\]\s*\{[^}]*box-sizing:\s*border-box[^}]*width:\s*100%/s, 'expanded categories fill their release column');
  assert.match(css, /\[class\*="Release__Categories-"\]\s*\{[^}]*box-sizing:\s*border-box[^}]*width:\s*100%[^}]*align-items:\s*stretch/s, 'the category list uses the full release-column width');
  assert.match(css, /\[class\*="Category__Cards-"\]\s*\{[^}]*width:\s*100%[^}]*display:\s*flex/s, 'category card stacks stretch across the available width');
  assert.match(css, /\[class\*="Card__Wrapper-"\]\s*\{[^}]*width:\s*100%/s, 'dynamically expanded cards use the full category width');
  assert.match(css, /article\[class\*="Board__Wrapper-"\]\s+\[class\*="Category__Header-"\]:is\(:hover, :active, :focus, :focus-within, \[aria-expanded="true"\]\)[^{]*\{[^}]*background:[^;]*!important/s, 'expanded and hovered categories keep the redesigned navy header');
  assert.match(css, /\[class\*="Release__StickyHeader-"\]\s*\{[^}]*position:\s*sticky[^}]*inset-block-start:\s*0[^}]*z-index:\s*5[^}]*background:[^;]*!important/s, 'the scrolling category header stays flush above card content');
  assert.match(fixture, /<span class="Release__StickyHeader-[^"]*"><svg[^>]*><path[^>]*><\/path><\/svg><\/span><div class="Release__Categories-/);
  assert.match(css, /\[class\*="Release__StickyHeader-"\]:has\(>\s*svg:only-child\)\s*\{[^}]*display:\s*none\s*!important/s, 'the chevron-only sticky header placeholder does not leave a blank gap above categories');
  assert.match(css, /\.rsi-roadmap-status-legend\s*\{[^}]*grid-area:\s*legend/s, 'the color key occupies its own row under the live-version line');
  assert.match(css, /\.rsi-roadmap-status-legend-swatch--tentative/);
  assert.match(css, /\.rsi-roadmap-status-legend-swatch--committed/);
  assert.match(css, /\.rsi-roadmap-status-legend-swatch--released/);
  assert.match(runtime, /rsi-roadmap-status-legend/);
  assert.match(runtime, /data-rsi-roadmap-status/);
  assert.ok(runtime.includes('data-part') && runtime.includes('currentColor') && runtime.includes('0 0 10 10'), 'status icon glyphs are included in the packaged Roadmap runtime');
  assert.match(runtime, /rsi-roadmap-search-input/, 'the Roadmap search is included in the packaged content script');
  assert.match(runtime, /Ctrl K/, 'the packaged Roadmap search advertises its keyboard shortcut');
  assert.match(runtime, /rsi-roadmap-search-filter-button/, 'the packaged Roadmap search includes its quick-filter control');
  assert.match(css, /\.rsi-roadmap-search-results\s*\{/);
  assert.match(css, /\.rsi-roadmap-search-result\s*\{/);
  assert.match(css, /\.rsi-roadmap-search-filter-popover\s*\{/);
  assert.match(css, /\.rsi-roadmap-search-filter-status-option\s*\{/);
  assert.match(css, /\.rsi-roadmap-search-filter-category\s*\{/);
  assert.match(css, /\.rsi-roadmap-search-summary\s*\{[^}]*justify-content:\s*space-between/s, 'the result count and Enter-to-jump hint align on opposite sides');
  assert.match(css, /\.rsi-roadmap-search-shortcut\s*\{/);
  assert.match(css, /\.rsi-roadmap-search-highlight\s*\{/);
  assert.doesNotMatch(css, /rsi-roadmap-search-indexing/, 'search no longer hides expanded categories while loading the index');
  assert.match(css, /\.rsi-roadmap-search-highlight\s*\{[^}]*outline:\s*2px solid #ff4d4f/s, 'search navigation applies the red card outline');
  assert.ok(runtime.includes('insertAdjacentElement(`afterend`'), 'the color key is inserted immediately after the live-version description');
  assert.match(css, /figure\[media\]\s*\{[^}]*height:\s*clamp\(170px,\s*8\.5vw,\s*200px\)/s);
  assert.match(css, /figure\[media\]::after\s*\{[^}]*display:\s*none/s);
  assert.match(css, /article\[class\*="Board__Wrapper-"\]\s+\[class\*="Card__Description-"\]\s*\{[^}]*padding:\s*10px 10px 12px/s, 'card descriptions keep the updated readable spacing beneath their artwork');
  assert.ok(css.includes('[class*="Modal__ModalInner-"]') && css.includes('background: #101923'), 'the native card detail surface matches the Roadmap navy palette');
  assert.match(css, /background:\s*transparent\s*!important/);
  assert.match(css, /backdrop-filter:\s*none\s*!important/);
  assert.match(css, /dialog\[open\]::backdrop\s*\{[^}]*background:\s*transparent\s*!important[^}]*backdrop-filter:\s*none\s*!important/s);
  assert.match(css, /border:\s*1px solid #3a5c73/);
  assert.ok(css.includes('padding: 14px 20px 18px'), 'the native popup keeps a readable description section');
  assert.match(css, /\[class\*="Modal__Wrapper-"\]\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*width:\s*100vw[^}]*height:\s*100dvh[^}]*background:\s*transparent\s*!important/s);
  assert.match(css, /\[class\*="Modal__CloseTarget-"\]\s*\{[^}]*background:\s*rgb\(5 11 18 \/ 20%\)\s*!important[^}]*backdrop-filter:\s*blur\(4px\)\s*!important/s, 'the native close target softly dims and blurs the page behind the card');
  assert.match(css, /\[class\*="Modal-sc-"\]\s*\{[^}]*background:\s*transparent\s*!important[^}]*backdrop-filter:\s*none\s*!important/s, 'the full-screen native Modal layer does not tint the page behind the card');
  assert.match(css, /\[class\*="Modal__ModalInner-"\]:has\([^}]*StatusBar-[^}]*\)\s*\{[^}]*width:\s*min\(840px,\s*calc\(100vw - 48px\)\)/s);
  assert.match(css, /\[class\*="ModalMedia__Img-"\][^{]*\{[^}]*filter:\s*none\s*!important/s);
  assert.match(css, /\[class\*="ModalBody-"\]\s*\{[^}]*padding:\s*14px 20px 18px/s);
  assert.match(runtime, /rsi-roadmap-card-metadata/, 'the native card popup receives verified metadata below its category');
  assert.match(runtime, /Card information/);
  assert.match(runtime, /Modified/);
  assert.match(runtime, /Slug/);
  assert.match(css, /\.rsi-roadmap-card-metadata\s*\{/);
  assert.match(css, /\.rsi-roadmap-card-metadata\s*\{[^}]*border-left:\s*3px solid #56c6e6[^}]*border-radius:\s*7px/s, 'card metadata is presented as a distinct detail panel');
  assert.match(css, /\.rsi-roadmap-card-metadata-value--slug\s*\{/);
  assert.match(css, /\.rsi-roadmap-card-metadata-row\s*\{[^}]*grid-template-columns:\s*60px minmax\(0,\s*1fr\)/s, 'metadata labels align consistently with their values');
  assert.match(css, /\.rsi-roadmap-card-metadata-value--slug\s*\{[^}]*background:\s*#0f1a24[^}]*overflow-wrap:\s*anywhere/s, 'long card slugs stay readable inside a compact code-like field');
  assert.match(css, /#root\s*\{[^}]*filter:\s*none\s*!important[^}]*backdrop-filter:\s*none\s*!important/s);
  assert.match(css, /\[class\*="Release__Wrapper-"\]/);
  assert.match(css, /figure\[media\]/);
  assert.match(css, /a\[href\*="\/roadmap\/release-view\/"\] figure\[media\][\s\S]*?filter:\s*none\s*!important/);
  assert.doesNotMatch(css, /grayscale/i);
  assert.match(runtime, /rsi-roadmap-image-dialog/);
  assert.match(css, /\.rsi-roadmap-image-dialog/);
  assert.match(fixture, /Card__Description-[^\"]*">A local preview/);
  assert.doesNotMatch(runtime, /Download source image|roadmapImageFilename/);
});

test('Roadmap header and release columns use the selected theme palette', async () => {
  const css = await readFile('dist/rsi.css', 'utf8');

  assert.match(css, /article\[class\*="Board__Wrapper-"\]\s*>\s*\[class\*="Board__Header-"\]\s*\{[^}]*background:[^;]*var\(--rsi-raised[^)]*\)[^;]*var\(--rsi-surface/s,
    'the Release View header derives its surface from the selected palette');
  assert.match(css, /section\[class\*="Release__Wrapper-"\]\s*\{[^}]*border:\s*1px solid [^;]*var\(--rsi-border[^)]*\)[^;]*;[^}]*background:[^;]*var\(--rsi-surface[^)]*\)[^;]*var\(--rsi-background/s,
    'patch columns derive their background and border from the selected palette');
  assert.match(css, /\[class\*="ReleaseHeader-"\]\s*\{[^}]*background:[^;]*var\(--rsi-raised[^)]*\)[^;]*var\(--rsi-surface/s,
    'patch headers derive their surface from the selected palette');
  assert.match(css, /\[class\*="Category__Wrapper-"\]\s*\{[^}]*border:\s*1px solid var\(--rsi-border[^)]*\)[^}]*background:\s*var\(--rsi-surface/s,
    'category panels inside patch columns follow the selected palette');
  assert.match(css, /\[class\*="Category__Header-"\]\s*\{[^}]*background:[^;]*var\(--rsi-raised[^)]*\)[^;]*var\(--rsi-surface/s,
    'category headers inside patch columns follow the selected palette');
  assert.match(css, /a\[class\*="Card__StyledNavLink-"\]\s*\{[^}]*border:\s*1px solid var\(--rsi-border[^)]*\)[^}]*background:\s*var\(--rsi-background/s,
    'release cards use the selected palette for their surface and edge');
  assert.match(css, /\[class\*="Card__TitleBar-"\]\s*\{[^}]*background:[^;]*var\(--rsi-raised[^)]*\)[^;]*var\(--rsi-surface/s,
    'release card title bars follow the selected palette');
});

test('Roadmap version line is replaced with compact cards and retains native information links', async () => {
  const fixture = await readFile('tests/fixtures/roadmap-release.html', 'utf8');
  const css = await readFile('dist/rsi.css', 'utf8');
  const runtime = await readFile('dist/content.js', 'utf8');

  assert.match(fixture, /Live Version: 4\.10\.2 \(<a href="\/en\/comm-link\/transmission\/21334-Alpha-4102-RSI-Discovery-Month">more info<\/a>\)/);
  assert.match(fixture, /Latest Roadmap Roundup: 21\/10\/2026 \(<a href="\/spectrum\/community\/SC\/forum\/3\/thread\/roadmap-roundup-october-21-2026">more info<\/a>\)/);
  assert.match(runtime, /rsi-roadmap-version-cards/);
  assert.match(runtime, /PTU closed/);
  assert.match(runtime, /Latest Roadmap Roundup/);
  assert.match(css, /\.rsi-roadmap-version-card\s*\{/);
  assert.match(css, /\.rsi-roadmap-version-action\s*\{/);
  assert.match(css, /\.rsi-roadmap-version-cards\s*\{[^}]*width:\s*fit-content[^}]*display:\s*flex[^}]*flex-wrap:\s*nowrap/s, 'version cards stay in one compact row instead of stretching across the header');
  assert.match(css, /\.rsi-roadmap-version-card--live\s*\{\s*flex:\s*0 1 168px;\s*\}/);
  assert.match(css, /\.rsi-roadmap-version-card--roundup\s*\{\s*flex:\s*0 1 198px;\s*\}/);
  assert.match(css, /\.rsi-roadmap-version-card--ptu\s*\{\s*flex:\s*0 1 168px;\s*\}/);
});

test('Dev Tracker fixture keeps date groups, native post links, and auto-load controls', async () => {
  const fixture = await readFile('tests/fixtures/devtracker.html', 'utf8');
  const css = await readFile('dist/rsi.css', 'utf8');
  assert.match(fixture, /class="devtracker-list js-devtracker-list"/);
  assert.match(fixture, /class="rsi-devtracker-context" aria-label="Spectrum post and developer response"/);
  assert.match(fixture, /class="rsi-devtracker-context-divider"/);
  assert.match(fixture, /class="rsi-devtracker-response"/);
  assert.match(fixture, /rsi-enhanced-reply=1/);
  assert.match(fixture, /<h3 class="clearfix">October 28th 2026<\/h3>/);
  assert.match(fixture, /<a href="\/spectrum\/community\/SC\/forum\/5\/thread\/[^\"]+" class="devpost">/);
  assert.match(fixture, /class="category">Spectrum Feedback<\/span>/);
  assert.match(fixture, /class="thread">So, is the Organization admin function busted\?<\/span>/);
  assert.match(fixture, /class="control js-glow-load-more-control" data-action="on"/);
  assert.match(css, /\.devtracker-hub a\.devpost:is\(:hover, :focus-visible\)/);
  assert.match(css, /\.devtracker-hub \.devpost-wrapper\s*\{[^}]*grid-template-columns:\s*minmax\(220px,\s*280px\)\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.devtracker-hub #bodyWrapper > \.page-wrapper\s*\{[^}]*max-width:\s*none/);
  assert.match(css, /\.devtracker-hub \.js-devtracker-list > \.devtracker-list\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.devtracker-hub a\.devpost\s*\{[^}]*float:\s*none\s*!important[^}]*width:\s*100%\s*!important/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-context\s*\{/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-context-avatar/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-expand/);
  assert.match(css, /\.devtracker-hub \.devpost \.rsi-devtracker-response-preview/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-response-label/);
  assert.match(css, /\.devtracker-hub \.devpost \.details\s*\{[^}]*font:\s*[^;]*var\(--rsi-selected-font-family/);
  assert.doesNotMatch(css, /@import|url\(/i);
});

test('Dev Tracker long developer replies fit after inline expansion', async () => {
  const css = await readFile('dist/rsi.css', 'utf8');
  assert.match(css, /\.devtracker-hub a\.devpost\s*\{[^}]*height:\s*auto\s*!important/);
  assert.match(css, /\.devtracker-hub \.devpost-wrapper\s*\{[^}]*height:\s*auto\s*!important/);
  assert.match(css, /\.devtracker-hub \.devpost \.details\s*\{[^}]*max-height:\s*none\s*!important[^}]*overflow:\s*visible\s*!important/);
  assert.match(css, /\.devtracker-hub \.devpost \.rsi-devtracker-response-preview,\s*body\.devtracker-hub \.devpost \.rsi-devtracker-response-full\s*\{[^}]*padding:\s*0[^}]*background:\s*transparent/);
});

test('Dev Tracker parent and developer messages share one readable panel', async () => {
  const css = await readFile('dist/rsi.css', 'utf8');
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-context\s*\{[^}]*border:\s*1px solid/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-parent\s*\{[^}]*padding:\s*12px 14px 11px/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-response-label\s*\{[^}]*min-height:\s*22px[^}]*font:\s*800 12px/);
  assert.doesNotMatch(css, /\.devtracker-hub \.rsi-devtracker-response-label\s*\{[^}]*grid-column:\s*2/);
  assert.match(css, /\.devtracker-hub \.devpost \.details\s*\{[^}]*padding:\s*0[^}]*border:\s*0[^}]*background:\s*transparent[^}]*font:\s*400 15px/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-context-text\s*\{[^}]*font:\s*400 15px/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-expand\s*\{/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-context-toggle/);
  assert.match(css, /\.devtracker-hub \.rsi-devtracker-response-toggle/);
  assert.doesNotMatch(css, /rsi-devtracker-context-text:hover|rsi-devtracker-response \.details:hover/);
});

test('Dev Tracker developer response uses the selected Developer post text colour', async () => {
  const css = await readFile('dist/rsi.css', 'utf8');
  assert.match(css, /:scope\[data-rsi-dev-text-color="gold"\]\s*\{\s*--rsi-dev-post-text:\s*#bfa739;/);
  assert.match(css, /:scope\[data-rsi-dev-text-color="white"\]\s*\{\s*--rsi-dev-post-text:\s*#fff;/);
  assert.match(css, /:scope\[data-rsi-dev-text-color="off-white"\]\s*\{\s*--rsi-dev-post-text:\s*#d6d9dd;/);
  assert.match(css, /body\.devtracker-hub \.devpost \.rsi-devtracker-response-preview,[\s\S]*?\.rsi-devtracker-response-full\s*\{[^}]*color:\s*var\(--rsi-dev-post-text,\s*var\(--rsi-text\)\)\s*!important/);
  assert.match(css, /body\.devtracker-hub \.devpost \.details :not\(\.icon\)[\s\S]*?color:\s*var\(--rsi-dev-post-text,\s*var\(--rsi-text\)\)\s*!important/);
});

test('private, checkout, Citizen Dossier, unrelated and similarly named routes stay outside public styling', () => {
  for (const path of ['/en/account/billing', '/en/account/security', '/en/pledge/cart', '/en/pledge/checkout', '/en/store/checkout', '/en/community/orgs/create', '/en/community/devtracker/thread', '/en/community/devtrackers', '/en/ship-matrix-extra', '/en/orgs', '/en/comm-linker', '/en/roadmap', '/en/roadmap/release-viewer', '/en/roadmap/release-view-extra', '/en/citizens/examplehandle', '/en/citizens/examplehandle/organizations', '/en/citizens/examplehandle/edit', '/en/', '/privacy']) assert.equal(sectionForPath(path), null, path);
});

test('old saved settings gain independent public-module defaults without changing Spectrum', () => {
  const settings = normalizeSettings({ modules: { forums: false }, theme: 'navy', rsi: { store: false, matrix: 'false' } });
  assert.equal(settings.modules.forums, false);
  assert.equal(settings.theme, 'navy');
  assert.equal(settings.rsi.store, false);
  assert.equal(settings.rsi.matrix, true);
  assert.equal(settings.rsi.roadmap, true);
  assert.equal(settings.rsi.devtracker, true);
  assert.deepEqual(Object.keys(settings.rsi), Object.keys(RSI_SECTIONS));
  settings.rsi.commlink = false;
  assert.equal(normalizeSettings().rsi.commlink, true);
  settings.rsi.roadmap = false;
  assert.equal(normalizeSettings({ rsi: settings.rsi }).rsi.roadmap, false);
  settings.rsi.devtracker = false;
  assert.equal(normalizeSettings({ rsi: settings.rsi }).rsi.devtracker, false);
});
