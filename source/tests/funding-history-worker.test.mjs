import assert from 'node:assert/strict';
import { test } from 'node:test';

const { registerFundingHistoryListener } = await import('../src/background/funding-history.ts');

test('the worker serves the fixed hourly history only to the RSI Funding Goals route', async () => {
  let listener;
  let loadCount = 0;
  const response = { entries: [], fetchedAt: 1_800_000_000_000, stale: false };
  registerFundingHistoryListener({ onMessage: { addListener: callback => { listener = callback; } } }, async () => {
    loadCount += 1;
    return response;
  });

  const messages = await Promise.all(Array.from({ length: 2 }, () => new Promise(resolve => {
    assert.equal(listener({ type: 'rsiEnhanced.getFundingHistory' }, {
      url: 'https://robertsspaceindustries.com/en/funding-goals',
    }, resolve), true);
  })));
  assert.deepEqual(messages, [response, response]);
  assert.equal(loadCount, 1, 'concurrent Funding Goals tabs share one sheet request');

  let denied;
  assert.equal(listener({ type: 'rsiEnhanced.getFundingHistory' }, {
    url: 'https://example.com/en/funding-goals',
  }, value => { denied = value; }), false);
  assert.match(denied.error, /only available to the RSI Funding Goals page/);
  assert.equal(loadCount, 1, 'untrusted pages must not trigger sheet requests');
});

test('the worker ignores unrelated extension messages', () => {
  let listener;
  registerFundingHistoryListener({ onMessage: { addListener: callback => { listener = callback; } } }, async () => {
    throw new Error('should not load');
  });
  assert.equal(listener({ type: 'other' }, { url: 'https://robertsspaceindustries.com/en/funding-goals' }, () => {}), false);
});

test('the worker serves yearly totals only to the RSI Funding Goals route', async () => {
  let listener;
  let yearlyLoadCount = 0;
  const response = { totals: [{ year: 2026, amount: 29_000_000 }], fetchedAt: 1_800_000_000_000, stale: false };
  registerFundingHistoryListener(
    { onMessage: { addListener: callback => { listener = callback; } } },
    async () => { throw new Error('the hourly history loader should not run'); },
    async () => { yearlyLoadCount += 1; return response; },
  );

  let received;
  assert.equal(listener({ type: 'rsiEnhanced.getYearlyFundingTotals' }, {
    url: 'https://robertsspaceindustries.com/en/funding-goals',
  }, value => { received = value; }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(received, response);
  assert.equal(yearlyLoadCount, 1);

  let denied;
  assert.equal(listener({ type: 'rsiEnhanced.getYearlyFundingTotals' }, {
    url: 'https://example.com/en/funding-goals',
  }, value => { denied = value; }), false);
  assert.match(denied.error, /only available to the RSI Funding Goals page/);
  assert.equal(yearlyLoadCount, 1);
});
