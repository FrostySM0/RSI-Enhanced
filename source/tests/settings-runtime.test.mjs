import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { test } from 'node:test';
import { STORAGE_KEY } from '../src/shared/settings.ts';
import { PRIVACY_CONSENT_KEY } from '../src/shared/privacy-consent.ts';

class FixtureMutationObserver {
  observe() {}
  disconnect() {}
}

test('packaged content entry applies avatar settings on unclassified RSI pages while keeping route modules isolated', async () => {
  const source = await readFile('dist/content.js', 'utf8');
  const vars = new Map(); const attrs = new Map(); const listeners = new Set(); let reads = 0; let navigate;
  const location = { pathname: '/spectrum/community/SC', search: '', href: 'https://robertsspaceindustries.com/spectrum/community/SC' };
  const context = {
    location,
    URLSearchParams,
    document: { readyState: 'loading', addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [], querySelector: () => null, documentElement: { style: { setProperty: (k, v) => vars.set(k, v) }, dataset: {}, setAttribute: (k, v) => attrs.set(k, v) } },
    chrome: { storage: { local: { get: async key => {
      if (key === PRIVACY_CONSENT_KEY) return { [PRIVACY_CONSENT_KEY]: { accepted: true, noticeVersion: 1 } };
      reads++;
      return { [STORAGE_KEY]: { theme: 'oled', fontSize: 18, devTextColor: 'white', commentLayout: 'bubbles', fontFamily: 'verdana' } };
    } }, onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } } },
    window: { location, MutationObserver: FixtureMutationObserver, addEventListener() {}, removeEventListener() {}, requestAnimationFrame: callback => callback(), setTimeout: () => 1, clearTimeout() {}, navigation: { addEventListener: (_, fn) => { navigate = fn; }, removeEventListener() {} } },
    console,
  };
  vm.runInNewContext(source, context);
  await new Promise(setImmediate);
  const readsAfterInitialLoad = reads;
  const emit = (changes, area = 'local') => { for (const listener of listeners) listener(changes, area); };
  assert.equal(vars.get('--rsi-background'), '#000000');
  assert.equal(attrs.get('data-rsi-preset'), 'oled');
  assert.equal(attrs.get('data-rsi-theme'), 'on');
  assert.equal(attrs.get('data-rsi-messages'), 'on');
  assert.equal(attrs.get('data-rsi-friends'), 'on');
  assert.equal(vars.get('--rsi-font-size'), '18px');
  assert.equal(vars.get('--rsi-selected-font-family'), 'Verdana, Geneva, sans-serif');
  assert.equal(attrs.get('data-rsi-dev-text-color'), 'white');
  assert.equal(context.document.documentElement.dataset.rsiCommentLayout, 'bubbles');
  assert.equal(context.document.documentElement.dataset.rsiSection, 'spectrum');
  assert.equal(context.document.documentElement.dataset.rsiSpectrumHome, 'true');
  emit({ [STORAGE_KEY]: { newValue: { theme: 'aegis', accent: '#ff0000', modules: { chat: false, messages: false, friends: false }, commentLayout: 'flat' } } }, 'local');
  assert.equal(attrs.get('data-rsi-chat'), 'off');
  assert.equal(attrs.get('data-rsi-messages'), 'off');
  assert.equal(attrs.get('data-rsi-friends'), 'off');
  assert.equal(attrs.get('data-rsi-preset'), 'aegis');
  assert.equal(vars.get('--rsi-background'), '#141212');
  assert.equal(vars.get('--rsi-surface'), '#211b1b');
  assert.equal(vars.get('--rsi-accent'), '#ff0000');
  assert.equal(context.document.documentElement.dataset.rsiCommentLayout, 'flat');
  assert.equal(attrs.get('data-rsi-dev-text-color'), 'gold');
  assert.equal(vars.get('--rsi-selected-font-family'), '');
  emit({ [STORAGE_KEY]: { newValue: { theme: 'enhanced' } } }, 'local');
  assert.equal(vars.get('--rsi-background'), '#0f141b');
  assert.equal(attrs.get('data-rsi-preset'), 'enhanced');
  emit({ [STORAGE_KEY]: { newValue: { theme: 'terraFrontier' } } }, 'local');
  assert.equal(attrs.get('data-rsi-preset'), 'terraFrontier');
  assert.equal(vars.get('--rsi-background'), '#131712');
  assert.equal(vars.get('--rsi-highlight'), '#d8bd8b');
  emit({ [STORAGE_KEY]: { newValue: { fontFamily: 'comic-sans' } } }, 'local');
  assert.equal(vars.get('--rsi-selected-font-family'), '"Comic Sans MS", "Comic Sans", "Segoe UI", sans-serif');
  context.location.pathname = '/en/pledge'; navigate();
  assert.equal(context.document.documentElement.dataset.rsiSection, 'store');
  emit({ [STORAGE_KEY]: { newValue: { rsi: { store: false } } } }, 'local');
  assert.equal(attrs.get('data-rsi-store'), 'off');
  context.location.pathname = '/en/comm-link'; navigate();
  assert.equal(context.document.documentElement.dataset.rsiSection, 'commlink');
  context.location.pathname = '/account/pledges'; navigate();
  assert.equal(context.document.documentElement.dataset.rsiSection, 'hangar');
  emit({ [STORAGE_KEY]: { newValue: { rsi: { hangar: false, account: true } } } }, 'local');
  assert.equal(attrs.get('data-rsi-hangar'), 'off');
  assert.equal(attrs.get('data-rsi-account'), 'on');
  context.location.pathname = '/account/settings'; navigate();
  assert.equal(context.document.documentElement.dataset.rsiSection, 'account');
  context.location.pathname = '/account/security';
  navigate();
  assert.equal(reads, readsAfterInitialLoad);
  assert.equal(context.document.documentElement.dataset.rsiSection, 'none');
  const lastSupportedPreset = attrs.get('data-rsi-preset');
  emit({ [STORAGE_KEY]: { newValue: { avatar: 'square', theme: 'oled' } } }, 'local');
  assert.equal(vars.get('--rsi-avatar-radius'), '0px', 'the selected avatar shape is applied even when no page module matches');
  assert.equal(context.document.documentElement.dataset.rsiAvatar, 'square');
  assert.equal(attrs.get('data-rsi-preset'), lastSupportedPreset, 'unsupported routes do not receive section theme settings');
});

test('packaged content entry waits for the document root before applying saved theme settings', async () => {
  const source = await readFile('dist/content.js', 'utf8');
  const vars = new Map(); const attrs = new Map(); let listener; let domReady;
  const root = { style: { setProperty: (key, value) => vars.set(key, value) }, dataset: {}, setAttribute: (key, value) => attrs.set(key, value) };
  const document = {
    readyState: 'loading',
    documentElement: null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: (event, callback) => { if (event === 'DOMContentLoaded') domReady = callback; },
  };
  const context = {
    URLSearchParams,
    location: { pathname: '/en/pledge' },
    document,
    chrome: {
      storage: {
        local: { get: async key => key === PRIVACY_CONSENT_KEY
          ? { [PRIVACY_CONSENT_KEY]: { accepted: true, noticeVersion: 1 } }
          : { [STORAGE_KEY]: { theme: 'navy' } } },
        onChanged: { addListener: (callback) => { listener = callback; } },
      },
    },
    window: { location: { pathname: '/spectrum/community/SC', href: 'https://robertsspaceindustries.com/spectrum/community/SC' }, addEventListener() {}, requestAnimationFrame: callback => callback(), navigation: { addEventListener() {} } },
    console,
  };

  assert.doesNotThrow(() => vm.runInNewContext(source, context));
  await new Promise(setImmediate);
  assert.equal(typeof domReady, 'function');
  assert.equal(typeof listener, 'function');
  document.documentElement = root;
  domReady();
  await new Promise(setImmediate);

  assert.equal(attrs.get('data-rsi-preset'), 'navy');
  assert.equal(vars.get('--rsi-background'), '#080f1d');
});

test('packaged content entry ignores the retired Roadmap tools preference', async () => {
  const source = await readFile('dist/content.js', 'utf8');
  const attrs = new Map(); let listener;
  const root = { style: { setProperty() {}, removeProperty() {} }, dataset: {}, setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key) };
  const context = {
    URLSearchParams,
    location: { pathname: '/en/pledge' },
    document: { readyState: 'complete', documentElement: root, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} },
    chrome: {
      storage: {
        local: { get: async key => key === PRIVACY_CONSENT_KEY
          ? { [PRIVACY_CONSENT_KEY]: { accepted: true, noticeVersion: 1 } }
          : { [STORAGE_KEY]: { roadmapTools: false } } },
        onChanged: { addListener: callback => { listener = callback; } },
      },
    },
    window: { location: { pathname: '/spectrum/community/SC', href: 'https://robertsspaceindustries.com/spectrum/community/SC' }, addEventListener() {}, requestAnimationFrame: callback => callback(), navigation: { addEventListener() {} } },
    console,
  };
  vm.runInNewContext(source, context);
  await new Promise(setImmediate);
  assert.equal(attrs.has('data-rsi-roadmap-tools'), false);
  listener({ [STORAGE_KEY]: { newValue: { roadmapTools: true } } }, 'local');
  assert.equal(attrs.has('data-rsi-roadmap-tools'), false);
});

test('content features stay idle before consent and shut off when consent is cleared', async () => {
  const source = await readFile('dist/content.js', 'utf8');
  const attrs = new Map(); const listeners = new Set(); const storageReads = [];
  const root = { style: { setProperty() {}, removeProperty() {} }, dataset: {}, setAttribute: (key, value) => attrs.set(key, value), removeAttribute: key => attrs.delete(key) };
  const location = { pathname: '/spectrum/community/SC', search: '', href: 'https://robertsspaceindustries.com/spectrum/community/SC' };
  const context = {
    URLSearchParams,
    location,
    document: { readyState: 'complete', documentElement: root, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, removeEventListener() {} },
    chrome: { storage: {
      local: { get: async key => {
        storageReads.push(key);
        if (key === PRIVACY_CONSENT_KEY) return {};
        return { [STORAGE_KEY]: { theme: 'oled' } };
      } },
      onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
    } },
    window: { location, MutationObserver: FixtureMutationObserver, addEventListener() {}, removeEventListener() {}, requestAnimationFrame: callback => callback(), setTimeout: () => 1, clearTimeout() {}, navigation: { addEventListener() {}, removeEventListener() {} } },
    console,
  };
  vm.runInNewContext(source, context);
  await new Promise(setImmediate);
  assert.deepEqual(storageReads, [PRIVACY_CONSENT_KEY]);
  assert.equal(root.dataset.rsiSection, undefined);
  const emit = changes => { for (const listener of listeners) listener(changes, 'local'); };
  emit({ [PRIVACY_CONSENT_KEY]: { newValue: { accepted: true, noticeVersion: 1 } } });
  await new Promise(setImmediate);
  assert.ok(storageReads.includes(STORAGE_KEY));
  assert.equal(root.dataset.rsiSection, 'spectrum');
  assert.equal(attrs.get('data-rsi-theme'), 'on');
  emit({ [PRIVACY_CONSENT_KEY]: { newValue: undefined } });
  assert.equal(root.dataset.rsiSection, 'none');
  assert.notEqual(attrs.get('data-rsi-consent'), 'accepted');
  const readsAfterRevocation = [...storageReads];
  emit({ [STORAGE_KEY]: { newValue: { theme: 'navy' } } });
  assert.deepEqual(storageReads, readsAfterRevocation, 'revoked features do not request further stored settings');
});
