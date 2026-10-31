import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { PRIVACY_CONSENT_KEY } from '../src/shared/privacy-consent.ts';
import { startPrivacyGate } from '../src/popup/privacy-gate.ts';

class ElementFixture {
  hidden = false;
  disabled = false;
  textContent = '';
  listeners = new Map();
  addEventListener(name, listener) {
    const list = this.listeners.get(name) ?? new Set();
    list.add(listener);
    this.listeners.set(name, list);
  }
  removeEventListener(name, listener) { this.listeners.get(name)?.delete(listener); }
  async click() {
    for (const listener of this.listeners.get('click') ?? []) await listener({ preventDefault() {} });
  }
}

function makeEvent() {
  const listeners = new Set();
  return {
    addListener(listener) { listeners.add(listener); },
    removeListener(listener) { listeners.delete(listener); },
    emit(changes, area = 'local') { for (const listener of listeners) listener(changes, area); },
  };
}

test('the popup keeps preferences locked until affirmative current-version consent', async () => {
  const changeEvent = makeEvent();
  const writes = [];
  const storage = {
    get: async () => ({}),
    set: async values => {
      writes.push(values);
      changeEvent.emit({ [PRIVACY_CONSENT_KEY]: { newValue: values[PRIVACY_CONSENT_KEY] } });
    },
  };
  const elements = {
    disclosure: new ElementFixture(),
    settingsArea: new ElementFixture(),
    fields: new ElementFixture(),
    agree: new ElementFixture(),
    notNow: new ElementFixture(),
    status: new ElementFixture(),
  };
  let settingsLoads = 0;
  const stop = startPrivacyGate(elements, storage, changeEvent, () => {
    settingsLoads++;
    elements.fields.disabled = false;
  });
  await new Promise(setImmediate);
  assert.equal(elements.disclosure.hidden, false);
  assert.equal(elements.settingsArea.hidden, true);
  assert.equal(elements.fields.disabled, true);
  assert.equal(settingsLoads, 0);

  await elements.notNow.click();
  assert.equal(settingsLoads, 0);
  assert.equal(writes.length, 0);

  await elements.agree.click();
  await new Promise(setImmediate);
  assert.deepEqual(writes, [{ [PRIVACY_CONSENT_KEY]: { accepted: true, noticeVersion: 1 } }]);
  assert.equal(settingsLoads, 1);
  assert.equal(elements.disclosure.hidden, true);
  assert.equal(elements.settingsArea.hidden, false);
  assert.equal(elements.fields.disabled, false);
  stop();
});

test('an outdated saved acceptance keeps the popup disclosure visible', async () => {
  const changeEvent = makeEvent();
  const elements = {
    disclosure: new ElementFixture(), settingsArea: new ElementFixture(), fields: new ElementFixture(),
    agree: new ElementFixture(), notNow: new ElementFixture(), status: new ElementFixture(),
  };
  let settingsLoads = 0;
  const stop = startPrivacyGate(elements, {
    get: async () => ({ [PRIVACY_CONSENT_KEY]: { accepted: true, noticeVersion: 0 } }),
    set: async () => {},
  }, changeEvent, () => { settingsLoads++; });
  await new Promise(setImmediate);
  assert.equal(settingsLoads, 0);
  assert.equal(elements.disclosure.hidden, false);
  assert.equal(elements.settingsArea.hidden, true);
  assert.equal(elements.fields.disabled, true);
  stop();
});

test('the packaged first-run disclosure links to the bundled, complete policy', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const policy = await readFile('release/privacy-policy.html', 'utf8');
  const packagedPolicy = await readFile('dist/privacy-policy.html', 'utf8');
  const rsiStyles = await readFile('dist/rsi.css', 'utf8');
  assert.match(popup, /<main id="privacy-gate"[^>]*aria-labelledby=/);
  assert.doesNotMatch(popup.match(/<main id="privacy-gate"[^>]*>/)?.[0] ?? '', /\shidden(?:\s|>)/);
  assert.match(popup, /<main id="settings-area" hidden>/);
  assert.match(popup, /href="\.\.\/\.\.\/privacy-policy\.html"/);
  for (const disclosure of [
    'saved Spectrum thread links and titles',
    'hidden-user handles and names',
    'Hangar favourites, view choices and search details',
    'cached public funding figures',
    'does not read or store your password or session cookies',
    'no analytics or telemetry',
  ]) assert.ok(popup.includes(disclosure), `popup disclosure should cover ${disclosure}`);
  for (const statement of [
    "Chrome's extension storage",
    'The developer does not receive that data',
    'public historical figures from a Google Sheets document',
    'uninstall RSI Enhanced',
    'https://github.com/FrostySM0/RSI-Enhanced/issues',
    'Limited Use requirements',
  ]) assert.ok(policy.includes(statement), `privacy policy should cover ${statement}`);
  assert.equal(packagedPolicy, policy);
  assert.match(rsiStyles, /@scope\s*\(:root\[data-rsi-consent="accepted"\]\)/, 'shared avatar styling must wait for consent too');
});
