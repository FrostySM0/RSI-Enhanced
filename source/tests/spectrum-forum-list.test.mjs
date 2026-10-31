import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('forum list rows use separated surfaces and keep gold developer markers', async () => {
  const source = await readFile('src/styles/spectrum-forums.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-forums.html', 'utf8');

  assert.match(source, /:root\s*\{[^}]*--rsi-forum-gap:\s*8px;/s,
    'regular forum lists have the spacing shown in the approved mockup');
  assert.match(source, /:root\s*\{[^}]*--rsi-forum-padding:\s*8px;/s,
    'regular forum rows use the compact vertical rhythm shown in the approved mockup');
  assert.match(source, /:root\[data-rsi-density="compact"\]\s*\{[^}]*--rsi-forum-gap:\s*6px;/s,
    'compact density keeps a smaller gap between rows');
  assert.match(source, /:root\[data-rsi-density="comfortable"\]\s*\{[^}]*--rsi-forum-gap:\s*10px;/s,
    'comfortable density keeps a larger gap between rows');

  const title = source.match(/#react \.thread-list-screen \.header__title\s*\{([^}]+)\}/)?.[1];
  assert.ok(title, 'forum titles have their own list typography');
  assert.match(title, /font-size:\s*14px/);
  const metadata = source.match(/#react \.thread-list-screen :is\(\.orion-tavern-c-ThreadListItem__subtitle, \.orion-tavern-c-ThreadListItem__last-reply, \.orion-tavern-c-ThreadListItem__stats \.a-fontStyle\)\s*\{([^}]+)\}/)?.[1];
  assert.ok(metadata, 'forum row metadata has its own list typography');
  assert.match(metadata, /font-size:\s*12px/);

  const dividers = source.match(/#react \.thread-list-screen \.orion-tavern-c-ThreadListItem__last-reply::before,\s*#react \.thread-list-screen \.orion-tavern-c-ThreadListItem__stats::before,\s*#react \.thread-list-screen \.orion-tavern-c-ThreadListItem__stats::after\s*\{([^}]+)\}/)?.[1];
  assert.ok(dividers, 'the reference column separators are placed on verified list cells');
  assert.doesNotMatch(source, /:is\([^)]*::(?:before|after)/,
    'pseudo-elements stay outside :is() so Chromium accepts the selectors');
  assert.match(dividers, /position:\s*absolute/);
  assert.match(dividers, /background:\s*var\(--rsi-border\)/);
  assert.match(dividers, /pointer-events:\s*none/);
  const statsSpacing = source.match(/#react \.thread-list-screen \.orion-tavern-c-ThreadListItem__stats\s*\{([^}]+)\}/)?.[1];
  assert.ok(statsSpacing, 'the counts cell reserves space before its trailing divider');
  assert.match(statsSpacing, /padding-inline-end:\s*16px/);

  const row = source.match(/#react \.thread-list-screen \.orion-tavern-c-ThreadListItem\s*\{([^}]+)\}/)?.[1];
  assert.ok(row, 'thread rows receive the new surface treatment');
  assert.match(row, /border:\s*1px solid var\(--rsi-border\)/);
  assert.match(row, /border-radius:\s*8px/);
  assert.match(row, /background:\s*var\(--rsi-surface\)/);
  assert.match(row, /position:\s*relative/);
  assert.match(row, /padding-inline-end:\s*max\(8px,\s*var\(--rsi-forum-padding\)\)/,
    'the rightmost native control stays inset from the card border at every density');
  assert.doesNotMatch(row, /\b(?:display|grid-template-columns|grid-column)\s*:/,
    'native row and subgrid layout stays intact');

  const developerMarker = source.match(/#react \.thread-list-screen \.orion-tavern-c-ThreadListItem:has\(\.orion-tavern-c-ThreadListItem__role-line\)::before\s*\{([^}]+)\}/)?.[1];
  assert.ok(developerMarker, 'only rows with Spectrum’s verified developer role line get an accent');
  assert.match(developerMarker, /background:\s*var\(--rsi-highlight\)/i);
  assert.match(developerMarker, /pointer-events:\s*none/);
  const divider = source.match(/#react \.thread-list-screen__thread-list > \.orion-c-divider\s*\{([^}]+)\}/)?.[1];
  assert.ok(divider, 'native separators inside the thread list receive a scoped override');
  assert.match(divider, /display:\s*none/);
  assert.doesNotMatch(source, /\.orion-tavern-c-ThreadListHeader/,
    'the native forum header and its controls remain untouched');

  assert.match(packaged, /#react \.thread-list-screen \.orion-tavern-c-ThreadListItem\s*\{[^}]*border-radius:\s*8px;[^}]*background:\s*var\(--rsi-surface\)/s);
  assert.match(packaged, /#react \.thread-list-screen \.orion-tavern-c-ThreadListItem\s*\{[^}]*padding-inline-end:\s*max\(8px,\s*var\(--rsi-forum-padding\)\)/s);
  assert.match(packaged, /#react \.thread-list-screen \.orion-tavern-c-ThreadListItem__last-reply::before,\s*#react \.thread-list-screen \.orion-tavern-c-ThreadListItem__stats::before,\s*#react \.thread-list-screen \.orion-tavern-c-ThreadListItem__stats::after\s*\{[^}]*background:\s*var\(--rsi-border\)/s);
  assert.match(packaged, /#react \.thread-list-screen \.orion-tavern-c-ThreadListItem__stats\s*\{[^}]*padding-inline-end:\s*16px/s);
  assert.match(packaged, /#react \.thread-list-screen \.orion-tavern-c-ThreadListItem:has\(\.orion-tavern-c-ThreadListItem__role-line\)::before\s*\{[^}]*background:\s*var\(--rsi-highlight\)/s);
  assert.match(packaged, /#react \.thread-list-screen__thread-list > \.orion-c-divider\s*\{[^}]*display:\s*none/s);
  assert.match(fixture, /orion-tavern-c-ThreadListItem__role-line/);
  assert.match(fixture, /<div class="orion-c-divider -hasStartDecoration -hasEndDecoration"><\/div>/);
  assert.match(fixture, /class="orion-tavern-c-ThreadListItem__last-reply"[\s\S]*?DevReplyAuthor/);
});
