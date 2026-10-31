import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Roadmap packaging preserves native detail activation and artwork while removing update tracking', async () => {
  const runtime = await readFile('dist/content.js', 'utf8');
  const styles = await readFile('dist/rsi.css', 'utf8');
  const popup = await readFile('src/popup/index.html', 'utf8');

  assert.doesNotMatch(runtime, /No new or changed releases|Mark all seen|rsiEnhanced\.roadmapUpdates|data-rsi-roadmap-tools/);
  assert.doesNotMatch(styles, /rsi-roadmap-tools|data-rsi-roadmap-tools/);
  assert.doesNotMatch(popup, /Roadmap Updates|roadmap-tools/);
  assert.match(runtime, /rsi-roadmap-image-dialog/, 'artwork zoom remains available independently of update tracking');
  assert.match(styles, /filter:\s*none\s*!important/);
});
