import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { hangarPageHtml } from './fixtures/hangar-pages.mjs';
import { filterHangarEntries, hangarPage, hangarResultHref, isShipPaintCard, isShipPaintTitle, matchesHangarSearch, paginateHangarEntries, sortHangarEntries } from '../src/content/hangar-search.ts';

test('search follows only same-origin same-route Hangar pagination', () => {
  const base = 'https://robertsspaceindustries.com/en/account/pledges?page=22';
  assert.equal(hangarPage('?page=2', base), 'https://robertsspaceindustries.com/en/account/pledges?page=2');
  assert.equal(hangarPage('?page=15', base), 'https://robertsspaceindustries.com/en/account/pledges?page=15');
  assert.equal(hangarPage('/account/pledges?page=2', base), 'https://robertsspaceindustries.com/en/account/pledges?page=2', 'RSI pagination drops the locale prefix');
  for (const value of ['https://evil.example/en/account/pledges','/fr/account/pledges?page=2','?type=ships','?page=-1','?page=2&action=gift','/en/account/pledges/reclaim','javascript:alert(1)']) assert.equal(hangarPage(value, base), null, value);
});

test('paint classification and result links preserve the native page and pledge ID', () => {
  assert.equal(isShipPaintTitle('Gladius - Foundation Festival Paint'), true);
  assert.equal(isShipPaintTitle('Aurora Mk I ES'), false);
  assert.equal(isShipPaintTitle('Package - Aurora MR Starter Pack'), false);
  assert.equal(hangarResultHref('https://robertsspaceindustries.com/en/account/pledges?page=15', '1501'), 'https://robertsspaceindustries.com/en/account/pledges?page=15#rsi-pledge-1501');
});

test('Ship Paint matches native card titles and contained-item details', () => {
  assert.equal(isShipPaintCard('Gladius - Foundation Festival Paint', ''), true);
  assert.equal(isShipPaintCard('Package - Aurora MR Starter Pack', 'Contains: Gladius - Foundation Festival Paint'), true);
  assert.equal(isShipPaintCard('Aurora Mk I ES', 'Contains: Aurora Mk I ES'), false);
  assert.equal(isShipPaintTitle('Contains: paints for the ship'), true);
});

test('the page-15 Hangar fixture contains a distinct paint pledge and exposes pages 1–15', async () => {
  const source = await readFile(new URL('./fixtures/hangar.html', import.meta.url), 'utf8');
  const html = hangarPageHtml(source, 15);
  assert.match(html, /Gladius - Foundation Festival Paint/);
  assert.match(html, /class="js-pledge-id" value="1501"/);
  for (let page = 1; page <= 15; page++) assert.ok(html.includes(`href="?page=${page}"`), `page ${page} can be discovered`);
});

test('search matches all query words across title and package contents without case sensitivity', () => {
  const title = 'Package - Aurora MR Starter Pack Contains: Constellation Mk V Centaurus';
  assert.equal(matchesHangarSearch(title, 'centaurus aurora'), true);
  assert.equal(matchesHangarSearch(title, '  CONSTELLATION   pack '), true);
  assert.equal(matchesHangarSearch(title, 'aurora armour'), false);
  assert.equal(matchesHangarSearch(title, ' '), false);
});

test('Hangar sort options order newest, name, and value while keeping unknown metadata last', () => {
  const entries = [
    { id: 'a', title: 'Zeta', page: 'https://robertsspaceindustries.com/en/account/pledges?page=1', record: { created: 'January 4, 2025', pledgeValue: 50 } },
    { id: 'b', title: 'Alpha', page: 'https://robertsspaceindustries.com/en/account/pledges?page=2', record: { created: 'October 16, 2026', pledgeValue: 120 } },
    { id: 'c', title: 'Beta', page: 'https://robertsspaceindustries.com/en/account/pledges?page=3', record: { created: '', pledgeValue: null } },
  ];
  assert.deepEqual(sortHangarEntries(entries, 'default').map(entry => entry.id), ['a', 'b', 'c']);
  assert.deepEqual(sortHangarEntries(entries, 'newest').map(entry => entry.id), ['b', 'a', 'c']);
  assert.deepEqual(sortHangarEntries(entries, 'name').map(entry => entry.id), ['b', 'c', 'a']);
  assert.deepEqual(sortHangarEntries(entries, 'value').map(entry => entry.id), ['b', 'a', 'c']);
});

test('Hangar search keeps every matching result when many pages contain the query', () => {
  const entries = Array.from({ length: 75 }, (_, index) => ({
    id: String(index + 1), title: `Pledge ${index + 1}`, details: 'Contains: RSI Disc. Galactic Tour Reward',
    page: `https://robertsspaceindustries.com/en/account/pledges?page=${index + 1}`,
  }));
  assert.equal(filterHangarEntries(entries, 'RSI Disc').length, 75);
});

test('Ship Paint pagination packs matches from different native pages into full pages', () => {
  const entries = Array.from({ length: 7 }, (_, index) => ({ id: String(index + 1), sourcePage: index < 2 ? 1 : 2 }));
  const first = paginateHangarEntries(entries, 1, 4);
  const second = paginateHangarEntries(entries, 2, 4);
  assert.deepEqual(first.entries.map(entry => entry.id), ['1', '2', '3', '4']);
  assert.deepEqual(second.entries.map(entry => entry.id), ['5', '6', '7']);
  assert.equal(first.totalPages, 2);
  assert.equal(second.totalPages, 2);
});
