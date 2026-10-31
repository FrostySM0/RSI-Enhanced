import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

test('Hangar Log timeline styles are confined to the supplied panel and leave native controls and scrolling intact', async () => {
  const [css, fixture, preview] = await Promise.all([
    readFile('src/styles/rsi/hangar.css', 'utf8'),
    readFile('tests/fixtures/hangar-log.html', 'utf8'),
    readFile('tests/preview-theme.mjs', 'utf8'),
  ]);
  const marker = '/* Hangar Log activity timeline';
  const markerIndex = css.indexOf(marker);
  assert.notEqual(markerIndex, -1, 'timeline styles are present');
  const section = css.slice(markerIndex).replace(/^\/\*.*?\*\/\s*/s, '');

  for (const selector of ['.pledge-log-entry', '.pledge-log-rows', '.important', '.head']) {
    assert.ok(section.includes(selector), `timeline styles include ${selector}`);
  }
  const rules = [...section.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  assert.ok(rules.length >= 4, 'timeline styles have separate, focused rules');
  for (const [, selector] of rules) {
    assert.ok(selector.trim().startsWith('.modal-inner:has(> #pledge-log)'), `rule stays within the Hangar Log panel: ${selector.trim()}`);
    assert.doesNotMatch(selector, /\.close|\.scrollable|\.viewport|\.scrollbar|\.track|\.thumb/);
  }

  assert.match(fixture, /id="pledge-log"/);
  for (const className of ['modal-inner', 'close', 'js-close', 'icon', 'scrollable', 'scrollbar', 'track', 'thumb', 'viewport', 'traj-loader', 'pledge-log-rows', 'pledge-log-entry', 'important']) {
    const hasClass = fixture.includes(`class="${className}"`) || fixture.includes(`class="${className} `) || fixture.includes(` ${className}"`) || fixture.includes(` ${className} `);
    assert.ok(hasClass, `fixture preserves .${className}`);
  }
  assert.equal((fixture.match(/class="pledge-log-entry"/g) ?? []).length, 2);
  assert.match(fixture, /style="height: 250px;"/);
  assert.match(fixture, /Package - Aurora MR Starter Pack/);
  assert.match(preview, /searchParams\.get\('log'\) === '1'/);
  assert.match(preview, /tests\/fixtures\/hangar-log\.html/);
});
