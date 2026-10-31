import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { sectionForPath } from '../src/shared/site-sections.ts';
import { normalizeSettings } from '../src/shared/settings.ts';
import { applySettings } from '../src/content/apply-settings.ts';

test('Account and Hangar have separate bounded routes, including locale prefixes', () => {
  for (const locale of ['', '/en', '/de', '/en-GB']) {
    for (const path of ['/account', '/account/', '/account/settings', '/account/profile']) assert.equal(sectionForPath(locale + path), 'account', path);
    assert.equal(sectionForPath(locale + '/account/pledges'), 'hangar');
    assert.equal(sectionForPath(locale + '/account/pledges/'), 'hangar');
  }
  for (const path of ['/account/pledges-extra', '/account/pledges/reclaim', '/account/security', '/account/billing', '/account/settings/password', '/pledge/checkout']) assert.equal(sectionForPath(path), null, path);
});

test('existing preferences gain independent Account/Hangar toggles and apply them', () => {
  const settings = normalizeSettings({ theme: 'navy', rsi: { store: false, account: false } });
  assert.equal(settings.rsi.account, false);
  assert.equal(settings.rsi.hangar, true);
  assert.equal(settings.rsi.store, false);
  assert.equal(settings.theme, 'navy');
  const attrs = new Map();
  applySettings(settings, { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attrs.set(key, value) });
  assert.equal(attrs.get('data-rsi-account'), 'off');
  assert.equal(attrs.get('data-rsi-hangar'), 'on');
  settings.rsi.hangar = false;
  assert.equal(normalizeSettings().rsi.hangar, true);
});

test('packaged private-page CSS retains independent guards and preserves action visibility', async () => {
  const css = await readFile('dist/rsi.css', 'utf8');
  for (const key of ['account', 'hangar']) {
    assert.ok(css.includes(`@scope (:root[data-rsi-section="${key}"]:not([data-rsi-${key}="off"]))`));
    const source = await readFile(`src/styles/rsi/${key}.css`, 'utf8');
    if (key === 'account') {
      assert.doesNotMatch(source, /#profile|#public-profile|citizen-record/i);
      assert.doesNotMatch(source, /(?:display|visibility|position|width|height|pointer-events)\s*:/i);
      assert.doesNotMatch(css, /#profile|#public-profile|citizen-record/i);
    }
    // Hangar redesign may change layout and hide its decorative separator only.
    const searchAdornment = source.match(/#billing\.pledges \.rsi-hangar-search-panel::before\s*\{[^}]*\}/i)?.[0] || '';
    const interactiveStyles = source.replace(searchAdornment, '');
    assert.doesNotMatch(interactiveStyles, /visibility\s*:\s*(?:hidden|collapse)|pointer-events\s*:/i);
    if (key === 'hangar') assert.doesNotMatch(source, /\.row(?:\.active)?\s+(?:>\s*)?\.more\s*\{[^}]*display\s*:/i);
    assert.doesNotMatch(source, /@import|url\(/i);
  }
});

test('Buy Back action stays inside and vertically centered in its pledge row', async () => {
  const source = await readFile('src/styles/rsi/hangar.css', 'utf8');
  const rowRule = source.match(/\.information:has\(\.buyback-action\)\s*\{([^}]+)\}/);
  const detailsRule = source.match(/\.information:has\(\.buyback-action\)\s*>\s*div:has\(>\s*\.buyback-action\)\s*\{([^}]+)\}/);
  const actionRule = source.match(/\.information:has\(\.buyback-action\)\s+\.buyback-action\s*\{([^}]+)\}/);
  const linkRule = source.match(/\.information:has\(\.buyback-action\)\s+\.buyback-action\s*>\s*a\.holosmallbtn\s*\{([^}]+)\}/);
  const labelRule = source.match(/\.information:has\(\.buyback-action\)\s+\.buyback-action\s*>\s*a\.holosmallbtn\s*>\s*\.holosmallbtn-top\s*\{([^}]+)\}/);
  const packaged = await readFile('dist/rsi.css', 'utf8');
  const fixture = await readFile('tests/fixtures/buyback-action.html', 'utf8');
  assert.ok(rowRule, 'Buy Back pledge rows need a positioning context and room for the native buyback-action');
  assert.match(rowRule[1], /position:\s*relative/);
  assert.match(rowRule[1], /padding-inline-end:\s*\d+px/);
  assert.ok(detailsRule, 'The native details wrapper must not intercept row-relative action positioning');
  assert.match(detailsRule[1], /position:\s*static/);
  assert.ok(actionRule, 'The supplied buyback-action wrapper needs a row-relative alignment rule');
  assert.match(actionRule[1], /inset-block-start:\s*50%/);
  assert.match(actionRule[1], /inset-inline-end:\s*\d+px/);
  assert.match(actionRule[1], /transform:\s*translateY\(-50%\)/);
  assert.ok(linkRule, 'The native Buy Back anchor needs enough width to keep its label on one line');
  assert.match(linkRule[1], /min-width:\s*\d+px/);
  assert.match(linkRule[1], /white-space:\s*nowrap/);
  assert.ok(labelRule, 'The native overlaid Buy Back label needs normal in-flow button geometry');
  assert.match(labelRule[1], /position:\s*relative/);
  assert.match(labelRule[1], /display:\s*inline-flex/);
  assert.match(labelRule[1], /white-space:\s*nowrap/);
  assert.match(packaged, /\.information:has\(\.buyback-action\)\s+\.buyback-action\s*>\s*a\.holosmallbtn/);
  assert.match(fixture, /class="information no-countdown"[\s\S]*?class="buyback-action"[\s\S]*?class="holosmallbtn"[\s\S]*?class="holosmallbtn-top abs-overlay/);
});

test('Game Access upgrade button keeps identical geometry on hover', async () => {
  const source = await readFile('src/styles/rsi/hangar.css', 'utf8');
  const packaged = await readFile('dist/rsi.css', 'utf8');
  assert.equal(sectionForPath('/en/account/game-access-management'), 'hangar');
  const selector = source.match(/\.account-section #billing \.content \.row \.shadow-button\.upgrade,\s*\.account-section #billing \.content \.row \.shadow-button\.upgrade:hover\s*\{([^}]+)\}/);
  assert.ok(selector, 'The stable Upgrade-button rule must cover Game Access #billing rows as well as My Gear');
  assert.match(packaged, /\.account-section #billing \.content \.row \.shadow-button\.upgrade,\s*\.account-section #billing \.content \.row \.shadow-button\.upgrade:hover\s*\{/);
  for (const declaration of [/display:\s*inline-flex/, /box-sizing:\s*border-box/, /width:\s*auto/, /height:\s*auto/, /min-height:\s*28px/, /padding:\s*5px 9px/, /transform:\s*none/]) {
    assert.match(selector[1], declaration);
  }
  assert.match(selector[1], /transition:\s*color\s*\.15s\s*ease,\s*background-color\s*\.15s\s*ease,\s*border-color\s*\.15s\s*ease/);
  assert.match(source, /\.account-section #billing \.content \.row \.shadow-button\.upgrade \.label\s*\{\s*opacity:\s*1;/);
});
