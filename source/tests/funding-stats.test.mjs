import assert from 'node:assert/strict';
import { test } from 'node:test';

let fundingStats;
try { fundingStats = await import('../src/shared/funding-stats.ts'); }
catch { fundingStats = null; }
let fundingController;
try { fundingController = await import('../src/content/funding-stats.ts'); }
catch { fundingController = null; }

test('funding history parses the sheet’s UTC timestamp and localized pledge and citizen columns', () => {
  assert.ok(fundingStats, 'Funding Stats needs sheet-history helpers');
  assert.equal(typeof fundingStats.parseFundingHistoryCsv, 'function',
    'the sheet CSV parser should be available');

  const rows = fundingStats.parseFundingHistoryCsv([
    'Datetime UTC,Total Pledge,Delta Pledge,Total Citizens,Delta Citizens',
    '2026-10-27 12:00:00,"$1.058.427.688","$0",6.745.842,0',
    '2026-10-28 12:00:00,"$1.058.451.531","$23.843",6.747.126,1.284',
  ].join('\n'));

  assert.deepEqual(rows, [
    { timestamp: Date.UTC(2026, 9, 27, 12), totalPledge: 1_058_427_688, deltaPledge: 0, totalCitizens: 6_745_842, deltaCitizens: 0 },
    { timestamp: Date.UTC(2026, 9, 28, 12), totalPledge: 1_058_451_531, deltaPledge: 23_843, totalCitizens: 6_747_126, deltaCitizens: 1_284 },
  ]);
});

test('funding snapshot timestamps are displayed explicitly in UTC', () => {
  assert.equal(typeof fundingStats.formatFundingTimestamp, 'function',
    'the funding page should format sheet timestamps in the sheet’s UTC timezone');
  assert.equal(
    fundingStats.formatFundingTimestamp(Date.UTC(2026, 9, 28, 16)),
    '28 Oct 2026, 16:00 UTC',
  );
  assert.equal(fundingStats.formatFundingClockTime(Date.UTC(2026, 9, 28, 18, 17)), '18:17 UTC',
    'the check time should use the same 24-hour UTC format in every browser locale');
  assert.equal(fundingStats.formatFundingSnapshotAge(Date.UTC(2026, 9, 28, 16), Date.UTC(2026, 9, 28, 17, 39)), '1h 39m old');
  assert.equal(fundingStats.formatFundingSnapshotAge(Date.UTC(2026, 9, 28, 17, 39), Date.UTC(2026, 9, 28, 17, 39)), '0m old');
});

test('sheet history calculates 24-hour changes from hourly totals', () => {
  assert.ok(fundingStats, 'Funding Stats needs sheet-history helpers');
  assert.equal(typeof fundingStats.calculate24HourHistoryChanges, 'function',
    'hourly sheet rows should produce 24-hour changes');
  const start = Date.UTC(2026, 9, 27, 12);

  assert.deepEqual(fundingStats.calculate24HourHistoryChanges([
    { timestamp: start, totalPledge: 1_058_427_688, deltaPledge: 0, totalCitizens: 6_745_842, deltaCitizens: 0 },
    { timestamp: start + 23 * 60 * 60 * 1000, totalPledge: 1_058_450_531, deltaPledge: 22_843, totalCitizens: 6_747_026, deltaCitizens: 1_184 },
    { timestamp: start + 24 * 60 * 60 * 1000, totalPledge: 1_058_451_531, deltaPledge: 1_000, totalCitizens: 6_747_126, deltaCitizens: 100 },
  ], start + 24 * 60 * 60 * 1000), {
    fundingDelta: 23_843,
    citizenDelta: 1_284,
    asOf: start + 24 * 60 * 60 * 1000,
  });
});

test('sheet history exposes the latest fresh hourly funding and citizen changes', () => {
  const now = Date.UTC(2026, 9, 28, 13);
  const hour = 60 * 60 * 1000;
  const row = (timestamp, totalPledge, deltaPledge, totalCitizens, deltaCitizens) => ({
    timestamp, totalPledge, deltaPledge, totalCitizens, deltaCitizens,
  });
  assert.deepEqual(fundingStats.calculateLatestHourlyHistoryChanges([
    row(now - hour, 1_000_000, 900, 100, 9),
    row(now, 1_000_500, 500, 105, 5),
  ], now), {
    fundingDelta: 500,
    citizenDelta: 5,
    asOf: now,
  });
  assert.equal(fundingStats.calculateLatestHourlyHistoryChanges([
    row(now - 3 * hour, 1_000_000, 900, 100, 9),
  ], now), null, 'a stale row must not be described as the latest hour');
});

test('24-hour changes require a fresh latest row and a nearby 24-hour baseline', () => {
  const now = Date.UTC(2026, 9, 28, 13);
  const row = (timestamp, totalPledge, totalCitizens) => ({
    timestamp, totalPledge, deltaPledge: 0, totalCitizens, deltaCitizens: 0,
  });
  assert.equal(fundingStats.calculate24HourHistoryChanges([
    row(now - 27 * 60 * 60 * 1000, 120, 12),
    row(now, 100, 10),
  ], now), null, 'a three-hour baseline gap must not be presented as exactly 24 hours');
  assert.equal(fundingStats.calculate24HourHistoryChanges([
    row(now - 27 * 60 * 60 * 1000, 100, 10),
    row(now - 3 * 60 * 60 * 1000, 120, 12),
  ], now), null, 'a sheet that has stopped updating must not show stale deltas');
  assert.deepEqual(fundingStats.calculate24HourHistoryChanges([
    row(now - 24 * 60 * 60 * 1000, 120, 12),
    row(now, 100, 10),
  ], now), { fundingDelta: -20, citizenDelta: -2, asOf: now });
});

test('failed refresh can label cached deltas as saved without reusing expired changes', () => {
  const now = Date.UTC(2026, 9, 28, 13);
  const recent = [
    { timestamp: now - 24 * 60 * 60 * 1000, totalPledge: 100, deltaPledge: 0, totalCitizens: 10, deltaCitizens: 0 },
    { timestamp: now, totalPledge: 125, deltaPledge: 25, totalCitizens: 12, deltaCitizens: 2 },
  ];
  assert.deepEqual(fundingStats.getFundingHistoryFallback(recent, now), {
    stale: true,
    changes: { fundingDelta: 25, citizenDelta: 2, asOf: now },
  });
  assert.deepEqual(fundingStats.getFundingHistoryFallback(recent, now + 3 * 60 * 60 * 1000), {
    stale: true,
    changes: null,
  });
  assert.equal(fundingStats.getFundingHistoryFallback([], now), null);
});

test('Quarter groups the current calendar year into Q1-Q4 and Year shows annual funding totals', () => {
  assert.ok(fundingStats, 'Funding Stats needs sheet-history helpers');
  assert.equal(typeof fundingStats.buildFundingTimeline, 'function',
    'the sheet history should build extension-owned long-range chart data');
  const now = Date.UTC(2026, 9, 28, 13);
  const hour = 60 * 60 * 1000;
  const entries = Array.from({ length: 400 * 24 + 1 }, (_, index) => ({
    timestamp: now - (400 * 24 - index) * hour,
    totalPledge: 1_000 + index * 100,
    deltaPledge: 100,
    totalCitizens: 10 + index,
    deltaCitizens: 1,
  }));

  const quarter = fundingStats.buildFundingTimeline(entries, 'quarter', now);
  const annualFunding = [
    { year: 2024, amount: 38_000_000 },
    { year: 2025, amount: 52_000_000 },
    { year: 2026, amount: 29_000_000 },
    { year: 2027, amount: 40_000_000 },
  ];
  const year = fundingStats.buildFundingTimeline(entries, 'year', now, annualFunding);
  assert.deepEqual(quarter.map(point => point.label), ['Q1', 'Q2', 'Q3', 'Q4']);
  assert.deepEqual(quarter.map(point => point.amount), [216_000, 218_400, 220_800, 66_200]);
  assert.deepEqual(year.map(point => point.label), ['2024', '2025', '2026']);
  assert.deepEqual(year.map(point => point.amount), [38_000_000, 52_000_000, 29_000_000]);
});

test('positive quarter and year funding charts keep the vertical scale at zero', () => {
  assert.equal(typeof fundingStats.getFundingTimelineScale, 'function');
  assert.deepEqual(fundingStats.getFundingTimelineScale([12_000_000, 75_000_000, 11_000_000]), {
    min: 0,
    max: 84_000_000,
  });
  const scaleWithNegativeData = fundingStats.getFundingTimelineScale([-10, 20]);
  assert.ok(scaleWithNegativeData.min < 0,
    'the axis should still include negative space when a source total is negative');
});

test('yearly totals query groups the sheet deltas by calendar year', () => {
  assert.equal(typeof fundingStats.buildFundingYearlyQueryUrl, 'function');
  assert.equal(typeof fundingStats.parseFundingYearlyTotalsCsv, 'function');
  const now = Date.UTC(2026, 9, 28, 13);
  const url = new URL(fundingStats.buildFundingYearlyQueryUrl(now));
  const query = url.searchParams.get('tq');
  assert.match(query, /year\(A\)/i);
  assert.match(query, /sum\(C\)/i);
  assert.match(query, /where A <= datetime '2026-10-28 13:00:00'/i,
    'annual totals should exclude future sheet rows');
  assert.match(query, /group by year\(A\)/i);
  assert.deepEqual(fundingStats.parseFundingYearlyTotalsCsv('Year,Funding\n2024,38000000\n2025,52000000\n2026,29000000'), [
    { year: 2024, amount: 38_000_000 },
    { year: 2025, amount: 52_000_000 },
    { year: 2026, amount: 29_000_000 },
  ]);
});

test('yearly funding totals use the short cache and retain last-good data on request failure', async () => {
  assert.equal(typeof fundingStats.loadFundingYearlyTotals, 'function');
  const now = Date.UTC(2026, 9, 28, 13);
  const csv = 'Year,sum-Delta Pledge\n2024,38000000\n2025,52000000\n2026,29000000';
  const values = new Map();
  const storage = {
    async get(key) { return { [key]: values.get(key) }; },
    async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); },
  };
  let fetchCount = 0;
  const fetcher = async () => {
    fetchCount += 1;
    return new Response(csv, { status: 200, headers: { 'content-type': 'text/csv' } });
  };
  const first = await fundingStats.loadFundingYearlyTotals(storage, fetcher, () => now);
  const cached = await fundingStats.loadFundingYearlyTotals(storage, async () => {
    throw new Error('fresh cache should avoid another request');
  }, () => now + 5 * 60 * 1000);
  assert.equal(fetchCount, 1);
  assert.deepEqual(first.totals, [
    { year: 2024, amount: 38_000_000 },
    { year: 2025, amount: 52_000_000 },
    { year: 2026, amount: 29_000_000 },
  ]);
  assert.deepEqual(cached, first);
  const stale = await fundingStats.loadFundingYearlyTotals(storage, async () => {
    throw new Error('offline');
  }, () => now + 2 * fundingStats.FUNDING_HISTORY_CACHE_TTL_MS);
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.totals, first.totals);
});

test('incomplete quarter and year buckets are gaps instead of misleading partial totals', () => {
  const now = Date.UTC(2026, 9, 28, 13);
  const sparse = [
    { timestamp: now - 80 * 24 * 60 * 60 * 1000, totalPledge: 1_000, deltaPledge: 100, totalCitizens: 10, deltaCitizens: 1 },
    { timestamp: now, totalPledge: 1_100, deltaPledge: 100, totalCitizens: 11, deltaCitizens: 1 },
  ];
  const quarter = fundingStats.buildFundingTimeline(sparse, 'quarter', now);
  assert.equal(quarter.length, 4);
  assert.ok(quarter.every(point => point.amount === null));
  assert.deepEqual(fundingStats.buildFundingTimeline(sparse, 'year', now), [],
    'the Year filter must wait for actual year-grouped sheet totals');
});

test('selected extended range writes its observed attribute only when the range changes', () => {
  assert.equal(typeof fundingController.setFundingTimelineRange, 'function');
  let writes = 0;
  let range;
  const target = { dataset: {} };
  Object.defineProperty(target.dataset, 'rsiFundingRange', {
    get() { return range; },
    set(value) { writes += 1; range = value; },
  });
  assert.equal(fundingController.setFundingTimelineRange(target, 'quarter'), true);
  assert.equal(fundingController.setFundingTimelineRange(target, 'quarter'), false);
  assert.equal(fundingController.setFundingTimelineRange(target, 'year'), true);
  assert.equal(writes, 2, 'unchanged redraws must not retrigger the page mutation observer');
});

test('rapid extended filter selection stays exclusive and isolated from native timeline clicks', async () => {
  assert.equal(typeof fundingController.syncFundingTimelineButtonState, 'function');
  const makeClassList = (...initial) => {
    const values = new Set(initial);
    return {
      add(name) { values.add(name); },
      remove(name) { values.delete(name); },
      contains(name) { return values.has(name); },
      toggle(name, force) {
        const enabled = force ?? !values.has(name);
        if (enabled) values.add(name);
        else values.delete(name);
        return enabled;
      },
    };
  };
  const native = [{ classList: makeClassList('on') }, { classList: makeClassList() }];
  const button = range => ({
    dataset: { range },
    classList: makeClassList(),
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
  });
  const quarter = button('quarter');
  const year = button('year');
  const extended = [quarter, year];

  fundingController.syncFundingTimelineButtonState('quarter', extended, native);
  assert.equal(quarter.classList.contains('on'), true);
  assert.equal(year.classList.contains('on'), false);
  assert.equal(native[0].classList.contains('on'), false,
    'selecting the extension chart must clear the native range highlight');

  fundingController.syncFundingTimelineButtonState('year', extended, native);
  assert.equal(quarter.classList.contains('on'), false);
  assert.equal(year.classList.contains('on'), true);
  assert.equal(year.attributes.get('aria-pressed'), 'true');
  fundingController.syncFundingTimelineButtonState(null, extended, native);
  assert.equal(quarter.classList.contains('on'), false);
  assert.equal(year.classList.contains('on'), false);

  const source = await (await import('node:fs/promises')).readFile('src/content/funding-stats.ts', 'utf8');
  const clickHandler = source.match(/function onFilterClick\(event: Event\): void \{([\s\S]*?)\n  \}/)?.[1] ?? '';
  assert.match(clickHandler, /event\.stopImmediatePropagation\(\)/,
    'extension range clicks must not reach RSI’s native timeline click handlers');
  assert.match(source, /addEventListener\('click', onFilterClick, true\)/,
    'extension ranges must be handled before native delegated click handlers');
});

test('24-hour indicators and extended ranges use cached hourly sheet history', async () => {
  assert.ok(fundingController, 'Funding Stats needs its page controller');
  const source = await (await import('node:fs/promises')).readFile('src/content/funding-stats.ts', 'utf8');
  assert.match(source, /funds_raised_counter/);
  assert.match(source, /fans_counter/);
  assert.match(source, /FUNDING_HISTORY_REQUEST/);
  assert.match(source, /FUNDING_YEARLY_REQUEST/);
  assert.match(source, /rsi-funding-range/);
  assert.match(source, /buildFundingTimeline/);
  assert.doesNotMatch(source, /recordCitizenCountSnapshot|fundingCitizenHistory/);
});

test('a recent full history uses a small latest-row check on the short cadence', async () => {
  assert.ok(fundingStats, 'Funding Stats needs history-cache helpers');
  const now = Date.UTC(2026, 9, 28, 13, 10);
  const csv = [
    'Datetime UTC,Total Pledge,Delta Pledge,Total Citizens,Delta Citizens',
    '2026-10-27 13:00:00,"$1.058.427.688","$0","6.745.842,00",0',
    '2026-10-28 13:00:00,"$1.058.451.531","$23.843","6.747.126,00","1.284,00"',
  ].join('\n');
  const latestCsv = [
    'Datetime UTC,Total Pledge,Delta Pledge,Total Citizens,Delta Citizens',
    '2026-10-28 13:00:00,"$1.058.451.531","$23.843","6.747.126,00","1.284,00"',
  ].join('\n');
  const values = new Map();
  const storage = {
    async get(key) { return { [key]: values.get(key) }; },
    async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); },
  };
  let fetchCount = 0;
  let requestedUrl = '';
  const fetcher = async url => {
    fetchCount += 1;
    requestedUrl = url;
    return new Response(new URL(url).searchParams.get('tq')?.includes('limit 1') ? latestCsv : csv,
      { status: 200, headers: { 'content-type': 'text/csv' } });
  };

  const first = await fundingStats.loadFundingHistory(storage, fetcher, () => now);
  const cached = await fundingStats.loadFundingHistory(storage, fetcher, () => now + 5 * 60 * 1000);
  assert.equal(fetchCount, 2, 'a fresh history should check only the newest sheet row');
  assert.match(requestedUrl, /docs\.google\.com\/spreadsheets\/d\/1n96sotjICGR8pw7SL74KTwrCHO6hoqRuAc2Y_fbIJaA\/gviz\/tq/);
  assert.match(new URL(requestedUrl).searchParams.get('tq'), /order by A desc limit 1/i);
  assert.equal(first.entries.length, 2);
  assert.deepEqual(cached.entries, first.entries);
  assert.equal(cached.fetchedAt, now + 5 * 60 * 1000);
  assert.equal(cached.fullFetchedAt, now);
  assert.equal(values.get(fundingStats.FUNDING_HISTORY_CACHE_KEY).entries.length, 2);
});

test('history cache refreshes after ten minutes so a newly added hourly sheet row appears', async () => {
  const now = Date.UTC(2026, 9, 28, 16, 5);
  const cached = {
    fetchedAt: now - 35 * 60 * 1000,
    stale: false,
    entries: [
      { timestamp: Date.UTC(2026, 9, 27, 15), totalPledge: 1_058_400_000, deltaPledge: 0, totalCitizens: 6_745_000, deltaCitizens: 0 },
      { timestamp: Date.UTC(2026, 9, 28, 15), totalPledge: 1_058_467_913, deltaPledge: 0, totalCitizens: 6_746_067, deltaCitizens: 0 },
    ],
  };
  const csv = [
    'Datetime UTC,Total Pledge,Delta Pledge,Total Citizens,Delta Citizens',
    '2026-10-27 15:00:00,"$1.058.400.000","$0","6.745.000,00",0',
    '2026-10-28 15:00:00,"$1.058.467.913","$0","6.746.067,00",0',
    '2026-10-28 16:00:00,"$1.058.485.721","$17.808","6.746.143,00",76',
  ].join('\n');
  const storage = {
    async get(key) { return { [key]: cached }; },
    async set() {},
  };
  let fetchCount = 0;
  const result = await fundingStats.loadFundingHistory(storage, async () => {
    fetchCount += 1;
    return new Response(csv, { status: 200 });
  }, () => now);

  assert.equal(fetchCount, 1, 'the cache must expire before the old row hides a newer hourly snapshot');
  assert.equal(result.entries.at(-1)?.timestamp, Date.UTC(2026, 9, 28, 16));
  assert.equal(result.entries.at(-1)?.totalPledge, 1_058_485_721);
  assert.equal(result.fetchedAt, now);
  assert.equal(result.stale, false);
});

test('a fresh history cache checks only the newest sheet row every minute and merges it', async () => {
  const now = Date.UTC(2026, 9, 28, 17, 2);
  const cachedAt = now - 60 * 1000;
  const values = new Map([[fundingStats.FUNDING_HISTORY_CACHE_KEY, {
    fetchedAt: cachedAt,
    fullFetchedAt: cachedAt - 5 * 60 * 1000,
    stale: false,
    entries: [
      { timestamp: Date.UTC(2026, 9, 27, 16), totalPledge: 1_058_400_000, deltaPledge: 0, totalCitizens: 6_745_000, deltaCitizens: 0 },
      { timestamp: Date.UTC(2026, 9, 28, 16), totalPledge: 1_058_485_721, deltaPledge: 17_808, totalCitizens: 6_746_143, deltaCitizens: 76 },
    ],
  }]]);
  const storage = {
    async get(key) { return { [key]: values.get(key) }; },
    async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); },
  };
  const urls = [];
  const result = await fundingStats.loadFundingHistory(storage, async url => {
    urls.push(url);
    return new Response([
      'Datetime UTC,Total Pledge,Delta Pledge,Total Citizens,Delta Citizens',
      '2026-10-28 17:00:00,"$1.058.503.521","$17.800","6.746.219,00",76',
    ].join('\n'), { status: 200 });
  }, () => now);
  const cachedCheck = await fundingStats.loadFundingHistory(storage, async url => {
    urls.push(url);
    throw new Error('a recent successful row check should be shared briefly');
  }, () => now + 20 * 1000);

  assert.equal(fundingStats.FUNDING_HISTORY_REFRESH_MS, 60 * 1000,
    'an active Funding Goals tab should check for new hourly rows each minute');
  assert.equal(urls.length, 1, 'a fresh history cache should avoid another full-history download');
  assert.match(new URL(urls[0]).searchParams.get('tq'), /order by A desc limit 1/i);
  assert.equal(result.entries.length, 3, 'the new row should be merged into the saved history');
  assert.equal(result.entries.at(-1)?.timestamp, Date.UTC(2026, 9, 28, 17));
  assert.equal(result.entries.at(-1)?.totalPledge, 1_058_503_521);
  assert.equal(result.fetchedAt, now, 'the successful check time should advance even if it only fetched one row');
  assert.equal(result.fullFetchedAt, cachedAt - 5 * 60 * 1000,
    'a lightweight row check must not make the full history appear newly fetched');
  assert.equal(result.stale, false);
  assert.equal(urls.length, 1, 'separate tabs should reuse a recent successful latest-row check');
  assert.equal(cachedCheck.fetchedAt, now);
});

test('a failed latest-row check falls back to a full history refresh before serving cached data', async () => {
  const now = Date.UTC(2026, 9, 28, 17, 2);
  const cachedAt = now - 60 * 1000;
  const cached = {
    fetchedAt: cachedAt,
    fullFetchedAt: cachedAt - 5 * 60 * 1000,
    stale: false,
    entries: [
      { timestamp: Date.UTC(2026, 9, 27, 16), totalPledge: 1_058_400_000, deltaPledge: 0, totalCitizens: 6_745_000, deltaCitizens: 0 },
      { timestamp: Date.UTC(2026, 9, 28, 16), totalPledge: 1_058_485_721, deltaPledge: 17_808, totalCitizens: 6_746_143, deltaCitizens: 76 },
    ],
  };
  const csv = [
    'Datetime UTC,Total Pledge,Delta Pledge,Total Citizens,Delta Citizens',
    '2026-10-27 16:00:00,1000,0,10,0',
    '2026-10-28 16:00:00,1025,25,12,2',
  ].join('\n');
  const values = new Map([[fundingStats.FUNDING_HISTORY_CACHE_KEY, cached]]);
  const storage = {
    async get(key) { return { [key]: values.get(key) }; },
    async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); },
  };
  const urls = [];
  const result = await fundingStats.loadFundingHistory(storage, async url => {
    urls.push(url);
    if (new URL(url).searchParams.get('tq')?.includes('limit 1')) {
      return new Response('not valid sheet data', { status: 200 });
    }
    return new Response(csv, { status: 200 });
  }, () => now);
  assert.equal(urls.length, 2, 'an invalid lightweight response should trigger a full-history recovery');
  assert.match(urls[1], /\/gviz\/tq/);
  assert.equal(result.stale, false);
  assert.equal(result.entries.at(-1)?.timestamp, Date.UTC(2026, 9, 28, 16));
});

test('failed newest-row and full-history requests keep the last-good snapshot visibly stale', async () => {
  const now = Date.UTC(2026, 9, 28, 17, 2);
  const cached = {
    fetchedAt: now - 60 * 1000,
    fullFetchedAt: now - 5 * 60 * 1000,
    stale: false,
    entries: [
      { timestamp: Date.UTC(2026, 9, 27, 16), totalPledge: 1_058_400_000, deltaPledge: 0, totalCitizens: 6_745_000, deltaCitizens: 0 },
      { timestamp: Date.UTC(2026, 9, 28, 16), totalPledge: 1_058_485_721, deltaPledge: 17_808, totalCitizens: 6_746_143, deltaCitizens: 76 },
    ],
  };
  const storage = { async get(key) { return { [key]: cached }; }, async set() {} };
  let fetchCount = 0;
  const result = await fundingStats.loadFundingHistory(storage, async () => {
    fetchCount += 1;
    throw new Error('sheet unavailable');
  }, () => now);
  assert.equal(fetchCount, 3, 'the worker should try the latest-row and both full-history sources');
  assert.equal(result.stale, true);
  assert.equal(result.fetchedAt, cached.fetchedAt,
    'a failed refresh must not advance the last successful check timestamp');
  assert.equal(result.entries.at(-1)?.timestamp, Date.UTC(2026, 9, 28, 16));
});

test('an invalid filtered response falls back to the fixed CSV export', async () => {
  const now = Date.UTC(2026, 9, 28, 13, 10);
  const csv = [
    'Datetime UTC,Total Pledge,Delta Pledge,Total Citizens,Delta Citizens',
    '2026-10-27 13:00:00,1000,0,10,0',
    '2026-10-28 13:00:00,1025,25,12,2',
  ].join('\n');
  const storage = { async get() { return {}; }, async set() {} };
  const urls = [];
  const result = await fundingStats.loadFundingHistory(storage, async url => {
    urls.push(url);
    return new Response(url.includes('/gviz/tq') ? 'not the expected CSV' : csv, { status: 200 });
  }, () => now);
  assert.equal(result.entries.length, 2);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /\/export\?/);
  assert.match(urls[1], /format=csv/);
});

test('sheet failures preserve last-good hourly history and flag it as saved data', async () => {
  const now = Date.UTC(2026, 9, 28, 13, 10);
  const values = new Map([[fundingStats.FUNDING_HISTORY_CACHE_KEY, {
    fetchedAt: now - 2 * fundingStats.FUNDING_HISTORY_CACHE_TTL_MS,
    stale: false,
    entries: [
      { timestamp: now - 24 * 60 * 60 * 1000, totalPledge: 1000, deltaPledge: 10, totalCitizens: 10, deltaCitizens: 1 },
      { timestamp: now, totalPledge: 1025, deltaPledge: 25, totalCitizens: 12, deltaCitizens: 2 },
    ],
  }]]);
  const storage = {
    async get(key) { return { [key]: values.get(key) }; },
    async set(items) { for (const [key, value] of Object.entries(items)) values.set(key, value); },
  };
  const result = await fundingStats.loadFundingHistory(storage, async () => { throw new Error('offline'); }, () => now);
  assert.equal(result.stale, true);
  assert.equal(result.entries.length, 2);
  assert.deepEqual(fundingStats.calculate24HourHistoryChanges(result.entries, now), {
    fundingDelta: 25,
    citizenDelta: 2,
    asOf: now,
  });
});

test('a sparse fresh sheet response cannot replace the last-good cache', async () => {
  const now = Date.UTC(2026, 9, 28, 13, 10);
  const cached = {
    fetchedAt: now - 2 * fundingStats.FUNDING_HISTORY_CACHE_TTL_MS,
    stale: false,
    entries: [
      { timestamp: now - 24 * 60 * 60 * 1000, totalPledge: 1000, deltaPledge: 10, totalCitizens: 10, deltaCitizens: 1 },
      { timestamp: now, totalPledge: 1025, deltaPledge: 25, totalCitizens: 12, deltaCitizens: 2 },
    ],
  };
  const sparseCsv = [
    'Datetime UTC,Total Pledge,Delta Pledge,Total Citizens,Delta Citizens',
    '2026-10-25 13:00:00,1000,0,10,0',
    '2026-10-28 13:00:00,1025,25,12,2',
  ].join('\n');
  let writes = 0;
  const storage = {
    async get(key) { return { [key]: cached }; },
    async set() { writes += 1; },
  };
  const result = await fundingStats.loadFundingHistory(storage, async () => new Response(sparseCsv, { status: 200 }), () => now);
  assert.equal(result.stale, true);
  assert.equal(result.entries.length, 2);
  assert.equal(writes, 0);
});

test('a local cache write failure does not discard successfully fetched sheet data', async () => {
  const now = Date.UTC(2026, 9, 28, 13, 10);
  const oldTimestamp = now - 60 * 24 * 60 * 60 * 1000;
  const cached = {
    fetchedAt: now - 2 * fundingStats.FUNDING_HISTORY_CACHE_TTL_MS,
    entries: [
      { timestamp: oldTimestamp, totalPledge: 900, deltaPledge: 9, totalCitizens: 9, deltaCitizens: 1 },
    ],
  };
  const csv = [
    'Datetime UTC,Total Pledge,Delta Pledge,Total Citizens,Delta Citizens',
    '2026-10-27 13:00:00,1000,0,10,0',
    '2026-10-28 13:00:00,1025,25,12,2',
  ].join('\n');
  const storage = {
    async get(key) { return { [key]: cached }; },
    async set() { throw new Error('storage unavailable'); },
  };
  const result = await fundingStats.loadFundingHistory(storage, async () => new Response(csv, { status: 200 }), () => now);
  assert.equal(result.stale, false);
  assert.equal(result.entries.length, 3, 'a refresh should merge retained history with the latest rows');
  assert.equal(result.entries[0].timestamp, oldTimestamp);
});
