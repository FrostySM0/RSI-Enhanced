import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('sidebar styling and empty states are shared by Spectrum home and forum pages', async () => {
  const source = await readFile('src/styles/spectrum-home.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const entry = await readFile('src/content/index.ts', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-forums.html', 'utf8');

  const sharedSidebarRules = [...source.matchAll(/(?:^|})\s*([^{}]+?)\s*\{([^{}]*)\}/g)]
    .filter(([, selector]) => /\.spectrumSidebarLeft|\.orion-tavern-c-sidebarLeft/.test(selector));
  assert.ok(sharedSidebarRules.length > 0);
  for (const [, selector] of sharedSidebarRules) {
    assert.match(selector, /:root\[data-rsi-section="spectrum"\]/);
    assert.doesNotMatch(selector, /data-rsi-spectrum-home/);
  }

  assert.match(source, /:root\[data-rsi-spectrum-home="true"\] #react \.orion-tavern-c-CommunityBanner/,
    'the banner remains restricted to the community landing page');
  assert.match(entry, /refreshSpectrumSidebarEmptyStates\(\s*activeSection === 'spectrum' && settings\.modules\.theme,?\s*\)/,
    'empty-state prompts are refreshed on every Spectrum route');
  assert.doesNotMatch(entry, /refreshSpectrumSidebarEmptyStates\(\s*activeSection === 'spectrum' && isSpectrumHome/);
  assert.match(packaged, /:scope\[data-rsi-section="spectrum"\] #react \.spectrumSidebarLeft \.rsi-spectrum-sidebar-empty-state__action/);
  assert.match(fixture, /<html lang="en" data-rsi-section="spectrum">/,
    'the forum fixture represents a Spectrum page without the community-home marker');
  assert.doesNotMatch(fixture, /data-rsi-spectrum-home="true"/);
  assert.match(fixture, /aria-label="Start a conversation"/);
  assert.match(fixture, /aria-label="Start a group"/);
});
