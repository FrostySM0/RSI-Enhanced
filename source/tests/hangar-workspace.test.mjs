import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { sectionForPath } from '../src/shared/site-sections.ts';

test('Hangar header and item controls follow the approved compact workspace layout', async () => {
  const css = await readFile('src/styles/rsi/hangar.css', 'utf8');
  const fixture = await readFile('tests/fixtures/hangar.html', 'utf8');
  assert.match(css, /#billing\.pledges \.inner-content \.rsi-hangar-search-panel\s*\{[^}]*display:\s*grid\s*;/);
  assert.match(css, /#billing\.pledges \.inner-content > \.top:has\(\.rsi-hangar-search-panel\) > \.actions\s*\{[^}]*display:\s*grid\s*!important;[^}]*grid-auto-flow:\s*column;[^}]*grid-auto-columns:\s*max-content/,
    'Hangar actions are forced into one horizontal row despite native button layout rules');
  assert.match(css, /grid-template-areas:\s*'eyebrow eyebrow'\s*'title actions'\s*'description description'\s*'search search'/,
    'Hangar Log and Ship Upgrades share the My Hangar title row');
  assert.match(css, /#billing\.pledges \.inner-content > \.top:has\(\.rsi-hangar-search-panel\) > \.actions \.shadow-button\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(css, /\.account-section \.rsi-hangar-upgrade-origin-empty\s*\{\s*display:\s*none !important/,
    'an emptied native Ship upgrades wrapper is hidden anywhere inside the Hangar account section');
  assert.match(css, /#billing\.pledges \.rsi-hangar-search\s*\{[^}]*max-width:\s*none/);
  assert.match(css, /\.account-section\[data-rsi-hangar-layout=['"]compact['"]\]\s*\{[^}]*top:\s*-90px/,
    'the compact Hangar lift leaves the content clear of the sticky RSI header');
  assert.match(css, /\.account-section \.sidenav::before\s*\{[^}]*RSI/);
  assert.match(css, /\.rsi-hangar-search-sort-slot/);
  assert.match(css, /\.rsi-hangar-range/);
  assert.match(css, /billing-title-pager-wrapper:has\(\+ \.rsi-hangar-page-pagination\)/);
  assert.match(css, /\.item-image-wrapper \.image\s*\{[^}]*width:\s*68px/);
  assert.match(css, /\.rsi-hangar-heading\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto\s+minmax\(0,\s*1fr\)/);
  assert.match(css, /\.rsi-hangar-heading\s*>\s*\.rsi-hangar-view\s*\{[^}]*grid-column:\s*1/);
  assert.match(css, /\.rsi-hangar-title\s*\{[^}]*grid-column:\s*2/);
  assert.match(css, /\.rsi-hangar-heading-controls[^}]*justify-content:\s*flex-end/);
  assert.match(css, /\.rsi-hangar-heading-controls[^}]*grid-column:\s*3/);
  assert.match(css, /\.billing-title-pager-wrapper\.rsi-hangar-pagination-rehomed\s*\{[^}]*display:\s*none/);
  assert.match(css, /:scope\[data-rsi-hangar-view="grid"\] #billing\.pledges \.content \.list-items \.row \.item-image-wrapper\s*\{[^}]*display:\s*block;[^}]*min-height:\s*210px/,
    'grid cards reserve a visible image area instead of collapsing the native thumbnail wrapper');
  assert.match(css, /:scope\[data-rsi-hangar-view="grid"\] #billing\.pledges \.content \.list-items \.row \.item-image-wrapper \.image\s*\{[^}]*display:\s*block;[^}]*height:\s*210px/,
    'the native background image remains visible at the grid card size');
  assert.match(css, /:scope\[data-rsi-hangar-view="grid"\] #billing\.pledges \.content \.list-items \.row \.item-image-wrapper img\s*\{[^}]*object-fit:\s*contain/,
    'image elements remain visible when RSI uses an img rather than a background');
  assert.match(css, /:scope\[data-rsi-hangar-view="grid"\] #billing\.pledges \.title-col \.pledge-title-row\.has-entitlement-lock\s*\{[^}]*width:\s*100%;[^}]*min-width:\s*0/,
    'grid entitlement rows remain within the pledge card width');
  assert.match(css, /:scope\[data-rsi-hangar-view="grid"\] #billing\.pledges \.title-col \.pledge-title-row\.has-entitlement-lock \.entitlement-lock\s*\{[^}]*max-width:\s*100%;[^}]*box-sizing:\s*border-box/,
    'the game-access badge cannot protrude beyond its card');
  assert.match(fixture, /<div class="content-wrapper pledges" id="billing"><div class="content clearfix">/,
    'the fixture records that the Hangar container wraps its content frame');
  assert.match(fixture, /<header class="top"><h2 class="title">My Hangar<\/h2><a class="shadow-button trans-02s trans-color pledge-log js-pledge-log">[\s\S]*?Hangar log[\s\S]*?<\/a><a class="shadow-button trans-02s trans-color ship-upgrade js-open-ship-upgrades" data-apiurl="\/pledge-store\/api\/upgrade\/v2">[\s\S]*?Ship upgrades[\s\S]*?<\/a><p>/,
    'the fixture uses RSI’s native direct header links without an .actions wrapper');
  assert.match(css, /#billing\.pledges > \.content:has\(> \.sidenav\)\s*\{[^}]*background-size:\s*8px 1px,\s*1px 8px,\s*8px 1px,\s*1px 8px/,
    'the Hangar header uses only short cyan corner strokes, not a long top rule');
  assert.match(css, /\.account-section \.content-wrapper :is\(\.top-line,\.top-line-thin,\.corner\),\s*\.account-section \.sidenav \.line, \.account-section \.sidenav \.bg-line\s*\{\s*display:\s*none/,
    'native decorative header rules are removed while the replacement corners remain');
});

test('verified Hangar subcategory paths use the Hangar module', () => {
  assert.equal(sectionForPath('/en/account/settings/games-library'), 'hangar');
  assert.equal(sectionForPath('/en/account/buy-back-pledges'), 'hangar');
  assert.equal(sectionForPath('/account/settings/games-library/reassign'), null);
  for (const prefix of ['', '/en', '/de', '/en-GB']) {
    for (const path of ['/account/pledges', '/account/game-access-management', '/account/roms', '/account/buy-back-pledges', '/account/rsvp', '/electronic-access']) assert.equal(sectionForPath(prefix + path), 'hangar', path);
  }
});

test('category styling excludes unlisted pages, prefix collisions and action subroutes', () => {
  for (const path of ['/account/security', '/account/billing', '/account/settings/security', '/account/pledges/reclaim', '/account/roms-extra', '/account/game-access-management/reassign', '/account/roms/download', '/electronic-access-extra']) assert.equal(sectionForPath(path), null, path);
  assert.equal(sectionForPath('/pledge'), 'store');
});
