import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  hasCurrentPrivacyConsent,
  PRIVACY_CONSENT_KEY,
  PRIVACY_NOTICE_VERSION,
  recordPrivacyConsent,
  watchPrivacyConsent,
} from '../src/shared/privacy-consent.ts';

function makeEvent() {
  const listeners = new Set();
  return {
    addListener(listener) { listeners.add(listener); },
    removeListener(listener) { listeners.delete(listener); },
    emit(changes, area = 'local') { for (const listener of listeners) listener(changes, area); },
    get size() { return listeners.size; },
  };
}

test('only the current accepted notice unlocks extension features', () => {
  assert.equal(hasCurrentPrivacyConsent(undefined), false);
  assert.equal(hasCurrentPrivacyConsent(null), false);
  assert.equal(hasCurrentPrivacyConsent({ accepted: true, noticeVersion: PRIVACY_NOTICE_VERSION - 1 }), false);
  assert.equal(hasCurrentPrivacyConsent({ accepted: false, noticeVersion: PRIVACY_NOTICE_VERSION }), false);
  assert.equal(hasCurrentPrivacyConsent({ accepted: true, noticeVersion: PRIVACY_NOTICE_VERSION }), true);
});

test('recording acceptance writes only the consent key', async () => {
  const writes = [];
  await recordPrivacyConsent({ set: async value => writes.push(value) });
  assert.deepEqual(writes, [{ [PRIVACY_CONSENT_KEY]: { accepted: true, noticeVersion: 1 } }]);
});

test('consent watcher ignores sync and unrelated changes and removes its listener', async () => {
  const event = makeEvent();
  const values = [];
  const stop = watchPrivacyConsent({ get: async () => ({ [PRIVACY_CONSENT_KEY]: undefined }) }, event, value => values.push(value));
  await new Promise(setImmediate);
  event.emit({ [PRIVACY_CONSENT_KEY]: { newValue: { accepted: true, noticeVersion: 1 } } }, 'sync');
  event.emit({ unrelated: { newValue: true } }, 'local');
  assert.deepEqual(values, [false]);
  stop();
  assert.equal(event.size, 0);
});

test('a live consent change wins over an older initial read', async () => {
  const event = makeEvent();
  let finishRead;
  const values = [];
  const stop = watchPrivacyConsent({
    get: () => new Promise(resolve => { finishRead = resolve; }),
  }, event, value => values.push(value));
  event.emit({ [PRIVACY_CONSENT_KEY]: { newValue: { accepted: true, noticeVersion: 1 } } });
  finishRead({ [PRIVACY_CONSENT_KEY]: undefined });
  await new Promise(setImmediate);
  assert.deepEqual(values, [true]);
  stop();
});
