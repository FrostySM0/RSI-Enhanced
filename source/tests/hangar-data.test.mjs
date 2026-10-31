import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  HANGAR_CACHE_TTL_MS,
  createHangarCache,
  filterHangarRecords,
  formatPledgeValue,
  hangarCsv,
  hangarTransferShips,
  normalizeHangarPledge,
  parseMoney,
  readHangarCache,
} from '../src/content/hangar-data.ts';

const record = (overrides = {}) => normalizeHangarPledge({
  id: '1042',
  title: 'Package - Aurora MR Starter Pack',
  basePledge: 'Package - Aurora MR Starter Pack',
  valueText: '$1,250.00 USD',
  created: 'October 16, 2026',
  details: 'Contains: RSI Aurora MR and Lifetime Insurance',
  actionsText: 'Gift Exchange Reclaim',
  hasActionMarkup: true,
  reclaimable: true,
  page: 'https://robertsspaceindustries.com/en/account/pledges?page=2',
  image: 'https://media.robertsspaceindustries.com/example.jpg',
  items: [{ name: 'Aurora MR', kind: 'Ship', manufacturerCode: 'RSI', manufacturerName: 'Roberts Space Industries' }],
  ...overrides,
});

test('pledge values parse only explicit amounts and preserve unknowns', () => {
  assert.equal(parseMoney('$1,250.50 USD'), 1250.5);
  assert.equal(parseMoney('USD 75.00'), 75);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('not listed'), null);
  assert.equal(formatPledgeValue(1250.5, 'USD'), '$1,250.50');
  assert.equal(formatPledgeValue(null, null), 'Not listed');
});

test('pledge normalization exposes type, base pledge and explicit status fields', () => {
  const value = record();
  assert.equal(value.category, 'package');
  assert.equal(value.basePledge, 'Package - Aurora MR Starter Pack');
  assert.equal(value.pledgeValue, 1250);
  assert.equal(value.currency, 'USD');
  assert.equal(value.lti, true);
  assert.equal(value.giftable, true);
  assert.equal(value.meltable, true);
  assert.equal(value.warbond, false);
  assert.equal(value.ships[0].name, 'Aurora MR');
  assert.equal(record({ title: 'Aegis Warbond Reclaimer', basePledge: 'Aegis Warbond Reclaimer', details: '', items: [] }).warbond, true);
});

test('missing price and unobserved action data remain unknown', () => {
  const value = record({ valueText: null, details: '', actionsText: null, hasActionMarkup: false, reclaimable: null, items: [] });
  assert.equal(value.pledgeValue, null);
  assert.equal(value.lti, null);
  assert.equal(value.giftable, null);
  assert.equal(value.meltable, null);
});

test('Hangar filters combine type, status and value without matching unknown amounts', () => {
  const records = [
    record(),
    record({ id: '1043', title: 'Gladius - Foundation Festival Paint', basePledge: 'Paints - Gladius Foundation Festival', valueText: '$25.00 USD', details: 'Paint item', actionsText: 'Reclaim', hasActionMarkup: true, reclaimable: true, items: [{ name: 'Foundation Paint', kind: 'Skin' }] }),
    record({ id: '1044', title: 'Ship Upgrade - Aurora to Gladius', basePledge: 'Ship Upgrade - Aurora to Gladius', valueText: null, details: 'Upgrade', items: [{ name: 'Upgrade', kind: 'Upgrade' }] }),
  ];
  assert.deepEqual(filterHangarRecords(records, { category: 'paint' }).map(item => item.id), ['1043']);
  assert.deepEqual(filterHangarRecords(records, { lti: 'yes', warbond: 'no', minValue: 1000 }).map(item => item.id), ['1042']);
  assert.deepEqual(filterHangarRecords(records, { minValue: 1 }).map(item => item.id), ['1042', '1043']);
});

test('CSV export quotes commas, quotes and line breaks in pledge data', () => {
  const csv = hangarCsv([record({ title: 'Ship, "Special" Edition' })]);
  assert.match(csv, /^Pledge ID,Name,Base pledge,Type,Melt value,Currency,LTI,Giftable,Meltable,Warbond,Created,Page,Ships\r\n/);
  assert.ok(csv.includes('"Ship, ""Special"" Edition"'));
  assert.ok(csv.endsWith('"October 16, 2026",2,Aurora MR\r\n'));
});

test('CSV export prefixes formula-like text before spreadsheet parsing', () => {
  const sample = record({ title: '=1+1' });
  sample.basePledge = '\t@SUM(1,1)';
  sample.ships[0].nickname = ' +HYPERLINK("https://example.test","Open")';
  const csv = hangarCsv([sample]);
  assert.ok(csv.includes(",'=1+1,"), 'a formula title becomes a text cell');
  assert.ok(csv.includes(`,"'\t@SUM(1,1)"`), 'leading control whitespace cannot hide a formula');
  assert.ok(csv.includes(`,"' +HYPERLINK(""https://example.test"",""Open"")"`), 'ship nicknames are protected before CSV quoting');
});

test('Hangar Transfer export emits contained ships with pledge metadata and flags unresolved codes', () => {
  const ships = hangarTransferShips([record(), record({ id: '2', items: [{ name: 'Festival Paint', kind: 'Skin' }] })]);
  assert.equal(ships.length, 1);
  assert.equal(ships[0].entity_type, 'ship');
  assert.equal(ships[0].ship_name, 'Aurora MR');
  assert.equal(ships[0].pledge_id, '1042');
  assert.equal(ships[0].pledge_cost, '$1,250.00 USD');
  assert.equal(ships[0].ship_code, 'RSI_Aurora_MR');
  assert.equal(ships[0].lookup, 'aurora mr');
  assert.ok(ships[0].unidentified, 'an unavailable official ship code is called out rather than fabricated as canonical');
});

test('cache expires, is scoped to the current Hangar fingerprint, and rejects malformed entries', () => {
  const value = record();
  const cache = createHangarCache([value], 'account-page-fingerprint', 10_000);
  assert.equal(cache.expiresAt, 10_000 + HANGAR_CACHE_TTL_MS);
  assert.deepEqual(readHangarCache(cache, 'account-page-fingerprint', 10_001)?.records, [value]);
  assert.equal(readHangarCache(cache, 'account-page-fingerprint', 10_001)?.pageCount, 1);
  assert.equal(readHangarCache(cache, 'different-account', 10_001), null);
  assert.equal(readHangarCache(cache, 'account-page-fingerprint', cache.expiresAt), null);
  assert.equal(readHangarCache({ ...cache, records: [{ id: 'nope' }] }, 'account-page-fingerprint', 10_001), null);
});
