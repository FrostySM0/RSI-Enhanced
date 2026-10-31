import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { sectionForPath } from '../src/shared/site-sections.ts';

test('localized Patch Notes routes use the Comm-Link styling module', () => {
  assert.equal(sectionForPath('/en/patch-notes'), 'commlink');
  assert.equal(sectionForPath('/patch-notes/'), 'commlink');
  assert.equal(sectionForPath('/en/patch-notes-extra'), null);
});

test('Patch Notes use the Comm-Link shell, shared category labels, and clear card artwork', async () => {
  const fixture = await readFile('tests/fixtures/patch-notes.html', 'utf8');
  const css = await readFile('src/styles/rsi/commlink.css', 'utf8');
  const packagedCss = await readFile('dist/rsi.css', 'utf8');

  assert.match(fixture, /id="patch-notes"[\s\S]*?class="page-title"[\s\S]*?id="channel"[\s\S]*?class="hub-blocks"[\s\S]*?class="over"/);
  assert.match(css, /#patch-notes,\s*#patch-notes > \.content-wrapper,\s*#patch-notes > \.content-wrapper > \.wrapper\s*\{/);
  assert.match(css, /#patch-notes > \.content-wrapper > \.wrapper > \.page-title\s*\{/);
  assert.match(css, /#patch-notes > \.content-wrapper > \.wrapper > \.page-title > \.icon\s*\{[^}]*background:\s*none !important/s);
  assert.match(css, /#patch-notes > \.content-wrapper > \.wrapper > \.page-title > \.icon\s*\{[^}]*position:\s*relative !important;[^}]*inset:\s*auto !important/s);
  assert.match(css, /#patch-notes > \.content-wrapper > \.wrapper > \.page-title > \.icon::before\s*\{[^}]*border:[^}]*var\(--rsi-accent\)/s);
  assert.match(css, /#patch-notes > \.content-wrapper > \.wrapper > \.page-title > \.icon::after\s*\{[^}]*repeating-linear-gradient/);
  assert.match(packagedCss, /#patch-notes > \.content-wrapper > \.wrapper > \.page-title > \.icon::before\s*\{[^}]*border:[^}]*var\(--rsi-accent\)/s);
  assert.match(css, /#patch-notes > \.content-wrapper > \.wrapper > #channel\s*\{[^}]*padding-inline:\s*0/,
    'the Patch Notes feed aligns horizontally with its title bar');
  assert.match(packagedCss, /#patch-notes > \.content-wrapper > \.wrapper > #channel\s*\{[^}]*padding-inline:\s*0/);
  assert.match(css, /#patch-notes #channel \.hub-blocks > \.hub-block > \.over\s*\{[^}]*display:\s*none !important/s);
  assert.match(fixture, /class="type patchnotes"/);
  assert.match(css, /#channel \.hub-blocks > \.hub-block > \.type\s*\{[^}]*clip-path:/s);
  assert.match(css, /#channel \.hub-blocks > \.hub-block > \.type\s*>\s*span\s*\{[^}]*color:\s*inherit/);
  assert.match(css, /#patch-notes #channel \.hub-blocks > \.hub-block:is\(:hover,\s*:focus-visible\)\s*\{[^}]*box-shadow:/s);
  assert.match(css, /#patch-notes #channel \.hub-blocks > \.hub-block:is\(:hover,\s*:focus-visible\)::after\s*\{[^}]*animation:\s*patchNotesCardSweep/);
  assert.match(css, /@keyframes\s+patchNotesCardSweep/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.hub-block:is\(:hover,\s*:focus-visible\)::after\s*\{[^}]*animation:\s*none/s);
  assert.match(packagedCss, /@scope \(:root\[data-rsi-section="commlink"\]:not\(\[data-rsi-commlink="off"\]\)\)[\s\S]*?#patch-notes #channel \.hub-blocks > \.hub-block > \.over\s*\{[^}]*display:\s*none !important/s);
  assert.match(packagedCss, /@scope \(:root\[data-rsi-section="commlink"\]:not\(\[data-rsi-commlink="off"\]\)\)[\s\S]*?#channel \.hub-blocks > \.hub-block > \.type\s*\{/);
  assert.match(packagedCss, /@keyframes\s+patchNotesCardSweep/);
});
