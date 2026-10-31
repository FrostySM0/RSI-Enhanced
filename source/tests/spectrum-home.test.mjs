import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('home-page styling is separately packaged behind the exact home-route marker', async () => {
  const source = await readFile('src/styles/spectrum-home.css', 'utf8');
  const build = await readFile('scripts/build.mjs', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const runtime = await readFile('dist/content.js', 'utf8');
  const routeSource = await readFile('src/content/index.ts', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-home.html', 'utf8');

  assert.match(build, /src\/styles\/spectrum-home\.css', 'theme'/);
  assert.match(source, /:root\[data-rsi-spectrum-home="true"\]/);
  const bannerPalette = source.match(/\.orion-tavern-c-CommunityBanner\s*\{[^}]*--rsi-home-banner-panel:\s*([^;]+);[^}]*--rsi-home-banner-edge:\s*([^;]+);/s);
  assert.ok(bannerPalette, 'the community banner keeps its established brand colours');
  assert.equal(bannerPalette[1].trim(), '#0d3042');
  assert.equal(bannerPalette[2].trim(), '#0c7190');
  const selectors = [...source.matchAll(/(?:^|})\s*([^{}]+?)\s*\{/g)].map(match => match[1]);
  const sharedSidebarSelectors = selectors.filter(selector => /\.spectrumSidebarLeft|\.orion-tavern-c-sidebarLeft/.test(selector));
  const homeOnlySelectors = selectors.filter(selector => !/\.spectrumSidebarLeft|\.orion-tavern-c-sidebarLeft/.test(selector));
  assert.ok(homeOnlySelectors.every(selector => selector.includes(':root[data-rsi-spectrum-home="true"]')),
    'community banner and forum/lobby home rules keep their exact route guard');
  assert.ok(sharedSidebarSelectors.length > 0 && sharedSidebarSelectors.every(selector => selector.includes(':root[data-rsi-section="spectrum"]')),
    'sidebar rules apply across Spectrum routes, independently of the home marker');
  assert.match(source, /\.community-screen__content\s*\{[^}]*display:\s*grid/s);
  assert.match(source, /:root\[data-rsi-spectrum-home="true"\]\[data-rsi-preset\]:not\(\[data-rsi-preset="enhanced"\]\) #react :is\(\.screen-layout\.community-screen, \.screen-layout__main, \.community-screen__content\)\s*\{[^}]*background:\s*var\(--rsi-background\);/s,
    'alternate presets recolour only the community-home backdrop while Enhanced keeps its native default');
  assert.doesNotMatch(source, /\.orion-tavern-c-CommunityList\s*\{/,
    'Forum and Chat Lobbies panels retain Spectrum native colours and artwork');
  assert.match(source, /\.community-screen__article\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s,
    'the forum and lobby article boxes are transparent');
  assert.match(source, /\.orion-tavern-c-CommunityList__header\s*\{[^}]*background:\s*transparent;/s,
    'panel heading boxes are transparent so the native artwork shows through');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__header\s*\{[^}]*border-bottom:\s*0;/s,
    'the custom cyan banner divider is removed');
  assert.match(source, /\.orion-tavern-c-CommunityBanner\s*\{[^}]*background(?:-color)?:\s*transparent;/s,
    'the banner wrapper stays visually clear around the artwork');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__header-text\s*\{[^}]*background:\s*transparent;/s,
    'the title has no separate backing box');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__header\s*\{[^}]*height:\s*294px;[^}]*background:\s*var\(--rsi-home-banner-panel\);/s,
    'the full banner uses one continuous title-rail surface');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__header::before\s*\{[^}]*bottom:\s*84px;[^}]*border:\s*0;[^}]*border-right:\s*2px solid[^}]*border-top-right-radius:\s*\d+px\s+\d+px;[^}]*background:\s*var\(--rsi-home-banner-panel\);/s,
    'the shoulder keeps its curved edge and panel fill without a cyan stroke beside the avatar');
  assert.doesNotMatch(source, /CommunityBanner__header::before\s*\{[^}]*linear-gradient\(/s,
    'the cyan line across the avatar shoulder is removed');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__header-text\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*20px;[^}]*left:\s*40px;/s,
    'the title sits inside the lower rail');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__avatar\s*\{[^}]*position:\s*absolute;[^}]*width:\s*112px;[^}]*height:\s*112px;/s,
    'the community avatar overlaps the panorama and title rail');
  assert.doesNotMatch(source, /CommunityBanner__header::after\s*\{[^}]*rgb\(7 22 31 \/ 58%\)/s,
    'the panorama is not dimmed by the previous left-side overlay');
  assert.match(source, /\.orion-tavern-c-CommunityBanner\s*\{[^}]*display:\s*block;[^}]*overflow:\s*visible/s,
    'the banner wrapper reserves its header height and does not clip its art');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__background-assets\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0 0 auto;[^}]*height:\s*210px;[^}]*overflow:\s*hidden;/s,
    'the full-width panorama has an explicit 210px viewport above the title rail');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__background-assets::after\s*\{[^}]*display:\s*none;[^}]*background:\s*none;[^}]*content:\s*none;/s,
    'the native decorative line under the panorama is removed');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__header::after\s*\{[^}]*left:\s*clamp\(260px,\s*16\.1vw,\s*330px\);/s,
    'the divider starts after the shoulder so the line does not double under it');
  assert.match(source, /\.orion-tavern-c-CommunityGroup__header\s*\{[^}]*background:\s*linear-gradient\(105deg,\s*color-mix\(in srgb, var\(--rsi-accent\) 30%, var\(--rsi-raised\)\),\s*color-mix\(in srgb, var\(--rsi-accent\) 12%, var\(--rsi-raised\)\) 48%,\s*var\(--rsi-raised\)\);/s,
    'expandable forum section headings use the thread button’s cyan-to-navy gradient');
  assert.match(source, /\.orion-tavern-c-CommunityBanner__background-image\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*cover/s,
    'the native banner image fills its art container');
  assert.match(source, /\.orion-tavern-c-CommunityGroup__header/);
  assert.match(source, /\.orion-tavern-c-CommunityGroupItem__description/);
  assert.match(source, /\.community-screen__article:has\(a\.orion-tavern-c-CommunityGroupItem\[href\*="\/lobby\/"\]\)/);
  assert.match(packaged, /:scope\[data-rsi-spectrum-home="true"\]/);
  assert.match(packaged, /:scope\[data-rsi-spectrum-home="true"\]\[data-rsi-preset\]:not\(\[data-rsi-preset="enhanced"\]\) #react :is\(\.screen-layout\.community-screen, \.screen-layout__main, \.community-screen__content\)\s*\{[^}]*background:\s*var\(--rsi-background\);/s);
  assert.doesNotMatch(packaged, /\.orion-tavern-c-CommunityList\s*\{/);
  assert.match(packaged, /\.community-screen__article\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityList__header\s*\{[^}]*background:\s*transparent;/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner__header\s*\{[^}]*border-bottom:\s*0;/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner\s*\{[^}]*background:\s*transparent;/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner__header-text\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*20px;[^}]*left:\s*40px;/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner__header\s*\{[^}]*height:\s*294px;[^}]*background:\s*var\(--rsi-home-banner-panel\);/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner__header::before\s*\{[^}]*border:\s*0;[^}]*border-right:\s*2px solid[^}]*background:\s*var\(--rsi-home-banner-panel\);/s);
  assert.doesNotMatch(packaged, /CommunityBanner__header::before\s*\{[^}]*linear-gradient\(/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner__avatar\s*\{[^}]*position:\s*absolute;[^}]*width:\s*112px;[^}]*height:\s*112px;/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner__background-assets\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0 0 auto;[^}]*height:\s*210px;[^}]*overflow:\s*hidden;/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner__background-assets::after\s*\{[^}]*display:\s*none;[^}]*background:\s*none;[^}]*content:\s*none;/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner__header::after\s*\{[^}]*left:\s*clamp\(260px,\s*16\.1vw,\s*330px\);/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityGroup__header\s*\{[^}]*background:\s*linear-gradient\(105deg,\s*color-mix\(in srgb, var\(--rsi-accent\) 30%, var\(--rsi-raised\)\),\s*color-mix\(in srgb, var\(--rsi-accent\) 12%, var\(--rsi-raised\)\) 48%,\s*var\(--rsi-raised\)\);/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner__background-image\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(packaged, /\.orion-tavern-c-CommunityBanner\s*\{[^}]*display:\s*block;[^}]*overflow:\s*visible/s);
  assert.match(packaged, /@scope \(:root\[data-rsi-section="spectrum"\]:not\(\[data-rsi-theme="off"\]\)\)/);
  assert.match(packaged, /--rsi-home-banner-panel:\s*#0d3042/);
  assert.match(runtime, /rsiSpectrumHome/);
  assert.match(routeSource, /root\.dataset\.rsiSpectrumHome\s*=\s*String\(activeSection === 'spectrum' && isSpectrumHome\(location\.pathname\)\)/);
  assert.match(fixture, /class="screen-layout community-screen"/);
  assert.match(fixture, /class="orion-tavern-c-CommunityBanner/);
  assert.match(fixture, /class="orion-tavern-c-CommunityBanner__background-assets"><img class="orion-tavern-c-CommunityBanner__background-image"[^>]+src=/);
  assert.match(fixture, /href="\/spectrum\/community\/SC\/forum\/1"/);
  assert.match(fixture, /href="\/spectrum\/community\/SC\/lobby\/1"/);
});

test('home sidebar bookmarks and navigation controls use the redesigned row treatment', async () => {
  const source = await readFile('src/styles/spectrum-home.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');

  assert.match(source, /\.spectrumSidebarLeft \.orion-tavern-c-SidebarLeftBookmark\s*\{[^}]*display:\s*flex;[^}]*min-height:\s*36px;[^}]*gap:\s*8px;[^}]*padding:\s*6px;[^}]*border-radius:\s*6px;/s,
    'bookmark rows have consistent height, spacing, and a soft active shape');
  assert.match(source, /\.spectrumSidebarLeft \.orion-tavern-c-SidebarLeftBookmark:is\(:hover, \.\-isSelected\)\s*\{[^}]*background:\s*var\(--rsi-raised\);/s);
  assert.match(source, /\.spectrumSidebarLeft a:not\(\.orion-tavern-c-SidebarLeftBookmark\)\s*\{[^}]*border-radius:\s*6px;[^}]*text-decoration:\s*none;/s,
    'other sidebar links receive the visual treatment without replacing native rows');
  assert.match(source, /\.spectrumSidebarLeft button\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;[^}]*border-radius:\s*6px;/s,
    'sidebar settings and add controls have consistent hit areas');
  assert.match(packaged, /\.spectrumSidebarLeft \.orion-tavern-c-SidebarLeftBookmark\s*\{[^}]*min-height:\s*36px;[^}]*gap:\s*8px;/s);
  assert.match(packaged, /\.spectrumSidebarLeft button\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;/s);
});

test('Spectrum bookmark rows use distinct forum and chat glyphs plus the unread signal bar', async () => {
  const source = await readFile('src/styles/spectrum-home.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-home.html', 'utf8');

  const bookmarkSlot = source.match(/\.orion-tavern-c-SidebarLeftBookmark__avatar\s*\{([^}]*)\}/s)?.[1];
  assert.ok(bookmarkSlot, 'the native avatar slot remains available for the bookmark mark');
  assert.match(bookmarkSlot, /width:\s*22px;[^}]*height:\s*22px;[^}]*flex:\s*0 0 22px;/s,
    'the bookmark mark keeps the native icon-column size');
  assert.match(bookmarkSlot, /border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;/s,
    'the circular badge is removed so only the bookmark icon remains');
  assert.doesNotMatch(bookmarkSlot, /border-radius:\s*50%|background:\s*color-mix/,
    'the bookmark slot has no circular backing');
  assert.match(source, /SidebarLeftBookmark__avatar \.orion-c-avatar__wrapper\s*\{[^}]*border:\s*0;[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s,
    'the native inner avatar wrapper does not leave a circle behind the custom bookmark');
  assert.match(source, /\.orion-tavern-c-SidebarLeftBookmark__avatar::before\s*\{[^}]*position:\s*absolute;[^}]*top:\s*\d+px;[^}]*left:\s*\d+px;[^}]*width:\s*12px;[^}]*height:\s*17px;[^}]*clip-path:\s*polygon\(/s,
    'the standalone icon is shaped like a bookmark');
  assert.match(source, /\.orion-tavern-c-SidebarLeftBookmark__avatar::after\s*\{[^}]*position:\s*absolute;[^}]*top:\s*\d+px;[^}]*left:\s*\d+px;[^}]*width:\s*9px;[^}]*height:\s*13px;[^}]*clip-path:\s*polygon\(/s,
    'the bookmark glyph has a contrasting inset that keeps its shape legible');
  assert.match(source, /\.orion-tavern-c-SidebarLeftBookmark__icon--rowsNested::before\s*\{[^}]*border:/s,
    'forum bookmarks use a custom stacked-list glyph');
  assert.match(source, /\.orion-tavern-c-SidebarLeftBookmark__icon--chat::before\s*\{[^}]*border:/s,
    'chat bookmarks use a custom speech-bubble glyph');
  assert.match(source, /\.orion-tavern-c-SidebarLeftBookmark__counter\s*\{[^}]*width:\s*4px;[^}]*height:\s*15px;[^}]*margin-inline-start:\s*auto;[^}]*border-radius:\s*999px;/s,
    'unread bookmarks use a narrow, right-aligned signal bar');
  assert.match(source, /\.orion-tavern-c-SidebarLeftBookmark__counter \.a-icon\s*\{[^}]*display:\s*none;/s,
    'the native unread bullet is hidden inside the signal bar');
  assert.match(source, /\.orion-tavern-c-SidebarLeftBookmark__names\[title="#sc-testing-chat"\]\s*\{(?=[^}]*font-size:\s*0\s*!important;)(?=[^}]*color:\s*transparent\s*!important;)[^}]*\}/s,
    'the native channel text is hidden so it cannot duplicate the replacement');
  assert.match(source, /\.orion-tavern-c-SidebarLeftBookmark__names\[title="#sc-testing-chat"\]::after\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;[^}]*color:\s*var\(--rsi-text\);[^}]*content:\s*"SC Testing Chat";[^}]*font-size:\s*14px;[^}]*font-weight:\s*inherit;/s,
    'the replacement title matches the native channel label size and weight');
  assert.match(fixture, /id="Channel3"[^>]*href="\/spectrum\/community\/SC\/forum\/3"[\s\S]*?__icon--rowsNested[\s\S]*?__counter[\s\S]*?aria-label="Drag"/);
  assert.match(fixture, /id="Lobby38230"[^>]*href="\/spectrum\/community\/SC\/lobby\/38230"[\s\S]*?__icon--chat[\s\S]*?title="#sc-testing-chat">SC testing chat[\s\S]*?__counter[\s\S]*?aria-label="Drag"/);
  assert.match(packaged, /:scope\[data-rsi-section="spectrum"\] #react \.spectrumSidebarLeft \.orion-tavern-c-SidebarLeftBookmark__counter\s*\{[^}]*width:\s*4px;[^}]*height:\s*15px;/s,
    'the signal bar remains inside the shared Spectrum-only stylesheet scope');
  assert.match(packaged, /:scope\[data-rsi-section="spectrum"\] #react \.spectrumSidebarLeft \.orion-tavern-c-SidebarLeftBookmark__avatar \.orion-c-avatar__wrapper\s*\{[^}]*border-radius:\s*0;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/s,
    'the generated stylesheet clears the native circular backing behind the bookmark');
  assert.match(packaged, /\.orion-tavern-c-SidebarLeftBookmark__names\[title="#sc-testing-chat"\]::after\s*\{[^}]*content:\s*"SC Testing Chat";/s,
    'the channel label update is included in the generated extension stylesheet');
});

test('home sidebar collapse icon is centered within its native button hit area', async () => {
  const source = await readFile('src/styles/spectrum-home.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-home.html', 'utf8');

  const sourceButton = source.match(/\.orion-tavern-c-sidebarLeft \.community-nav__collapse-button\s*\{([^}]*)\}/s)?.[1];
  const packagedButton = packaged.match(/\.orion-tavern-c-sidebarLeft \.community-nav__collapse-button\s*\{([^}]*)\}/s)?.[1];
  for (const button of [sourceButton, packagedButton]) {
    assert.ok(button, 'the home styling positions the native collapse button');
    assert.match(button, /position:\s*relative;/,
      'the native button is the containing block for its centered icon');
  }

  const sourceContent = source.match(/\.orion-tavern-c-sidebarLeft \.community-nav__collapse-button > \.a-button__content\s*\{([^}]*)\}/s)?.[1];
  const packagedContent = packaged.match(/\.orion-tavern-c-sidebarLeft \.community-nav__collapse-button > \.a-button__content\s*\{([^}]*)\}/s)?.[1];
  assert.ok(sourceContent, 'home CSS targets only the native sidebar toggle content');
  for (const content of [sourceContent, packagedContent]) {
    assert.ok(content, 'the constrained rule is included in the packaged stylesheet');
    assert.match(content, /position:\s*absolute;/);
    assert.match(content, /inset:\s*auto\s*!important;/,
      'the native full-size inset cannot displace the icon box');
    assert.match(content, /display:\s*flex;/);
    assert.match(content, /align-items:\s*center;/);
    assert.match(content, /justify-content:\s*center;/);
    assert.match(content, /left:\s*50%\s*!important;/,
      'the inner icon box is anchored to the button center');
    assert.match(content, /top:\s*50%\s*!important;/);
    assert.match(content, /width:\s*24px\s*!important;/,
      'the inner icon box is constrained to the native button size');
    assert.match(content, /height:\s*24px\s*!important;/);
    assert.match(content, /transform:\s*translate\(-50%,\s*-50%\)\s*!important;/,
      'the inner box is centered independently of the native 48px width');
    assert.match(content, /box-sizing:\s*border-box;/);
  }
  assert.match(fixture, /button class="a-button community-nav__collapse-button[^>]+aria-label="Toggle sidebar"><div class="a-button__background"><\/div><div class="a-button__content"><i class="a-button__icon/,
    'the fixture preserves the observed native toggle structure');
});

test('home sidebar styling preserves wrapper geometry and keeps rows and controls inside the panel', async () => {
  const source = await readFile('src/styles/spectrum-home.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');

  assert.doesNotMatch(source, /\.spectrumSidebarLeft\s*\{[^}]*padding:/s,
    'the shared sidebar wrapper does not shrink the icon rail');
  assert.match(source, /\.spectrumSidebarLeft \.orion-tavern-c-SidebarLeftBookmark\s*\{[^}]*min-width:\s*0;[^}]*gap:\s*8px;[^}]*padding:\s*6px;/s,
    'bookmark content can shrink within the available width');
  assert.doesNotMatch(source, /\.spectrumSidebarLeft a:not\(\.orion-tavern-c-SidebarLeftBookmark\)\s*\{[^}]*\b(?:display|min-width|min-height|gap|padding)\s*:/s,
    'unverified sidebar links retain their native geometry, protecting the icon rail');
  assert.match(source, /\.spectrumSidebarLeft button\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;[^}]*flex:\s*0 0 24px;/s,
    'settings and add buttons fit inside narrow section headers');
  assert.doesNotMatch(packaged, /\.spectrumSidebarLeft\s*\{[^}]*padding:/s);
  assert.match(packaged, /\.spectrumSidebarLeft button\s*\{[^}]*width:\s*24px;[^}]*height:\s*24px;[^}]*flex:\s*0 0 24px;/s);
  assert.doesNotMatch(packaged, /\.spectrumSidebarLeft a:not\(\.orion-tavern-c-SidebarLeftBookmark\)\s*\{[^}]*\b(?:display|min-width|min-height|gap|padding)\s*:/s);
});

test('home sidebar content pane has a subtle frame without changing its layout', async () => {
  const source = await readFile('src/styles/spectrum-home.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');

  assert.match(source, /\.spectrumSidebarLeft\s*\{[^}]*border:\s*1px solid var\(--rsi-border\);[^}]*border-radius:\s*8px;/s,
    'the sidebar content pane has the softly rounded frame from the mockup');
  assert.doesNotMatch(source, /\.spectrumSidebarLeft\s*\{[^}]*\b(?:padding|margin|width|min-width)\s*:/s,
    'the frame does not alter the verified rail or content geometry');
  assert.match(packaged, /\.spectrumSidebarLeft\s*\{[^}]*border:\s*1px solid var\(--rsi-border\);[^}]*border-radius:\s*8px;/s);
});

test('recent-message avatars are round, prominent, and preserve their presence indicator', async () => {
  const source = await readFile('src/styles/spectrum-home.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');

  assert.match(source, /\.orion-tavern-c-SidebarLeftDirectMessage__avatar\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px;[^}]*flex:\s*0 0 28px;/s,
    'recent-message avatars are enlarged within their verified row component');
  assert.match(source, /\.orion-tavern-c-SidebarLeftDirectMessage__avatar \.orion-c-avatar__image\s*\{[^}]*border-radius:\s*50%;[^}]*object-fit:\s*cover;/s,
    'the avatar image is circular while its outer component remains available for presence state');
  assert.match(packaged, /\.orion-tavern-c-SidebarLeftDirectMessage__avatar\s*\{[^}]*width:\s*28px;[^}]*height:\s*28px;/s);
  assert.match(packaged, /\.orion-tavern-c-SidebarLeftDirectMessage__avatar \.orion-c-avatar__image\s*\{[^}]*border-radius:\s*50%;/s);
});

test('empty recent-message and private-group states use the separate reference layout and native actions', async () => {
  const source = await readFile('src/styles/spectrum-home.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const runtime = await readFile('src/content/spectrum-sidebar-empty.ts', 'utf8');
  const packagedRuntime = await readFile('dist/content.js', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-home.html', 'utf8');
  const entry = await readFile('src/content/index.ts', 'utf8');

  for (const [action, prompt] of [
    ['Start a conversation', 'No recent messages yet'],
    ['Start a group', 'No private groups yet'],
  ]) {
    assert.ok(runtime.includes(prompt), `the ${action} empty state explains what belongs here`);
    assert.ok(fixture.includes(`aria-label="${action}"`), `the fixture retains RSI's native ${action} button`);
  }

  assert.match(source, /\.rsi-spectrum-sidebar-empty-state\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*align-items:\s*center;/s,
    'the empty prompt is a simple centered stack, not a bordered card');
  assert.match(source, /\.rsi-spectrum-sidebar-empty-state__icon\s*\{[^}]*width:\s*64px;[^}]*height:\s*64px;[^}]*border-radius:\s*50%;/s,
    'the empty prompt uses the large round group icon from the reference');
  assert.match(source, /\.rsi-spectrum-sidebar-empty-state__action\s*\{[^}]*border:\s*1px solid/s,
    'the separate bottom action is outlined');
  assert.match(runtime, /header\.querySelector<HTMLButtonElement>\(`button\[aria-label=/,
    'the separate action activates the native RSI control');
  assert.doesNotMatch(source, /header button\[aria-label="Start a (?:group|conversation)"\]\s*\{[^}]*position:\s*absolute;/s,
    'the native plus controls stay in their headings');
  assert.match(packaged, /\.rsi-spectrum-sidebar-empty-state__action/);
  assert.match(packagedRuntime, /No private groups yet\./);
  assert.match(entry, /refreshSpectrumSidebarEmptyStates\(\s*activeSection === 'spectrum' && settings\.modules\.theme,?\s*\)/);
  assert.doesNotMatch(entry, /refreshSpectrumSidebarEmptyStates\(\s*activeSection === 'spectrum' && isSpectrumHome/);
});
