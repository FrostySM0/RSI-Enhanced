import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Hangar action icons retain native geometry while their sprites stay hidden', async () => {
  const css = await readFile('src/styles/rsi/hangar.css', 'utf8');
  assert.match(css, /\.account-section #billing \.shadow-button > \.icon\s*\{[^}]*width:\s*19px[^}]*height:\s*22px[^}]*background:\s*none/s);
});

test('upgrade hover keeps the same card geometry and only animates paint', async () => {
  const css = await readFile('src/styles/rsi/hangar.css', 'utf8');
  const rule = css.match(/\.account-section #billing \.content \.row \.shadow-button\.upgrade,\s*\.account-section #billing \.content \.row \.shadow-button\.upgrade:hover\s*\{([^}]*)\}/s)?.[1];
  assert.ok(rule, 'normal and hover states share one layout rule');
  assert.match(rule, /width:\s*auto/);
  assert.match(rule, /flex:\s*0 0 auto/);
  assert.match(rule, /transform:\s*none/);
  assert.match(rule, /transition:\s*(?:color|background-color|border-color)/);
});
