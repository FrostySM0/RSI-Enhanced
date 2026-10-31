import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Roadmap Release View title has a theme-colored release-board icon before its text', async () => {
  const sources = [
    await readFile('src/styles/rsi/roadmap.css', 'utf8'),
    await readFile('dist/rsi.css', 'utf8'),
  ];
  const title = /article\[class\*="Board__Wrapper-"\] \[class\*="Board__NameAndLastModified-"\] h2\s*\{([^}]+)\}/s;
  const icon = /article\[class\*="Board__Wrapper-"\] \[class\*="Board__NameAndLastModified-"\] h2::before\s*\{([^}]+)\}/s;

  for (const source of sources) {
    const titleRule = source.match(title)?.[1] ?? '';
    const iconRule = source.match(icon)?.[1] ?? '';
    assert.match(titleRule, /position:\s*relative/);
    assert.match(titleRule, /padding-inline-start:\s*34px/);
    assert.match(iconRule, /content:\s*["']{2}/);
    assert.match(iconRule, /position:\s*absolute/);
    assert.match(iconRule, /left:\s*0/);
    assert.match(iconRule, /top:\s*50%/);
    assert.match(iconRule, /translateY\(-50%\)/);
    assert.match(iconRule, /border:\s*1px solid var\(--rsi-accent/);
    assert.match(iconRule, /background:/);
    assert.match(iconRule, /var\(--rsi-accent/);
    assert.doesNotMatch(iconRule, /url\(/,
      'the release-board icon should be drawn in CSS without image requests');
  }
});
