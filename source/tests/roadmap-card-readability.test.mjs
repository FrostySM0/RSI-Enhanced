import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Release View card descriptions use readable, high-contrast typography', async () => {
  const source = await readFile('src/styles/rsi/roadmap.css', 'utf8');
  const packaged = await readFile('dist/rsi.css', 'utf8');

  assert.match(source, /article\[class\*="Board__Wrapper-"\]\s+\[class\*="Card__Description-"\]\s*\{[^}]*color:\s*var\(--rsi-text,[^;]+;[^}]*font:\s*500 12px\/1\.55/s,
    'card descriptions are 12px, use relaxed line spacing and a stronger text color');
  assert.match(packaged, /@scope \(:root\[data-rsi-section="roadmap"\]:not\(\[data-rsi-roadmap="off"\]\)\)[\s\S]*?Card__Description-[^{}]*\{[^}]*font:\s*500 12px\/1\.55/s,
    'the readable card text rule is packaged only within the Roadmap module');
});
