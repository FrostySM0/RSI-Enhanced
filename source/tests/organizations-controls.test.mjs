import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const runtime = await readFile('src/content/index.ts', 'utf8');

test('Organizations sort clicks are left to RSI native handling', () => {
  assert.doesNotMatch(runtime, /organizations-controls|installOrganizationSortControls|refreshOrganizationSortControls/);
});
