import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSettings, STORAGE_KEY } from '../src/shared/settings.ts';
import { readSettings, saveSettings, watchSettings } from '../src/shared/storage.ts';
import { applySettings } from '../src/content/apply-settings.ts';

test('save/reset touches only the settings key and propagates failures', async () => {
  const stored = { unrelated: 'keep' };
  globalThis.chrome = { storage: { local: {
    get: async () => stored,
    set: async (value) => Object.assign(stored, value),
  } } };
  await saveSettings({ theme: 'navy', devTextColor: 'off-white', fontFamily: 'comic-sans', modules: { chat: false } });
  assert.equal((await readSettings()).theme, 'navy');
  assert.equal((await readSettings()).devTextColor, 'off-white');
  assert.equal((await readSettings()).fontFamily, 'comic-sans');
  assert.equal((await readSettings()).modules.chat, false);
  await saveSettings(normalizeSettings());
  assert.equal(stored.unrelated, 'keep');
  assert.equal((await readSettings()).theme, 'enhanced');
  assert.equal((await readSettings()).devTextColor, 'gold');
  assert.equal((await readSettings()).fontFamily, 'default');
  chrome.storage.local.set = async () => { throw new Error('Storage full'); };
  await assert.rejects(saveSettings({ theme: 'oled' }), /Storage full/);
});

test('legacy Roadmap update preference is dropped when settings are saved', async () => {
  const stored = {};
  globalThis.chrome = { storage: { local: {
    get: async () => stored,
    set: async value => Object.assign(stored, value),
  } } };
  stored[STORAGE_KEY] = { roadmapTools: false, theme: 'navy' };
  await saveSettings(await readSettings());
  assert.equal((await readSettings()).theme, 'navy');
  assert.equal('roadmapTools' in stored[STORAGE_KEY], false);
});

test('fresh changes beat a stale initial read; deletion restores defaults; sync changes are ignored', async () => {
  let onChange; let removed;
  let resolve;
  globalThis.chrome = { storage: { local: { get: () => new Promise((done) => { resolve = done; }) }, onChanged: { addListener: (fn) => { onChange = fn; }, removeListener: fn => { removed = fn; } } } };
  const applied = [];
  const watching = watchSettings((value) => applied.push(value));
  onChange({ [STORAGE_KEY]: { newValue: { theme: 'oled' } } }, 'local');
  resolve({ [STORAGE_KEY]: { theme: 'navy' } });
  const stop = await watching;
  assert.deepEqual(applied.map((s) => s.theme), ['oled']);
  onChange({ [STORAGE_KEY]: { newValue: { theme: 'navy' } } }, 'sync');
  assert.equal(applied.length, 1);
  onChange({ [STORAGE_KEY]: {} }, 'local');
  assert.equal(applied.at(-1).theme, 'enhanced');
  stop();
  assert.equal(removed, onChange);
  onChange({ [STORAGE_KEY]: { newValue: { theme: 'oled' } } }, 'local');
  assert.equal(applied.length, 2, 'a stopped settings subscription cannot update preferences');
});

test('a rejected stale read cannot replace an already applied storage update', async () => {
  let onChange;
  let reject;
  globalThis.chrome = { storage: { local: { get: () => new Promise((_, fail) => { reject = fail; }) }, onChanged: { addListener: (fn) => { onChange = fn; }, removeListener() {} } } };
  const applied = [];
  const watching = watchSettings((value) => applied.push(value));
  onChange({ [STORAGE_KEY]: { newValue: { theme: 'origin' } } }, 'local');
  reject(new Error('Old read failed'));
  const stop = await watching;
  assert.deepEqual(applied.map((s) => s.theme), ['origin']);
  stop();
});

test('applying preferences updates root variables and only extension-owned attributes', () => {
  const vars = new Map();
  const attrs = new Map([['data-site-theme', 'native']]);
  const root = { style: { setProperty: (key, value) => vars.set(key, value) }, dataset: {}, setAttribute: (key, value) => attrs.set(key, value) };
  applySettings(normalizeSettings({ theme: 'oled', avatar: 'square', fontSize: 18, density: 'compact', modules: { chat: false } }), root);
  assert.equal(vars.get('--rsi-background'), '#000000');
  assert.equal(vars.get('--rsi-font-size'), '18px');
  assert.equal(vars.get('--rsi-forum-width'), '100%');
  assert.equal(root.dataset.rsiDensity, 'compact');
  assert.equal(attrs.get('data-rsi-chat'), 'off');
  assert.equal(attrs.get('data-site-theme'), 'native');
});
