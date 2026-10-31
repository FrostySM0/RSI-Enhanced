import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STORAGE_KEY } from '../src/shared/settings.ts';

const BASE = 'https://robertsspaceindustries.com';
const THREAD = '/spectrum/community/SC/forum/3/thread/example-thread/12345';

async function savedThreadsApi() {
  try { return await import('../src/shared/saved-threads.ts'); }
  catch { return null; }
}

async function savedThreadsRuntime() {
  try { return await import('../src/content/spectrum-saved-threads.ts'); }
  catch { return null; }
}

class FixtureElement {
  constructor(tagName = 'div', className = '') {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.className = className;
    this.parentElement = null;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.ownTextContent = '';
    this.classList = { add: value => { if (!this.className.split(/\s+/).includes(value)) this.className = `${this.className} ${value}`.trim(); } };
    this.href = '';
    this.disabled = false;
  }
  get textContent() { return this.ownTextContent + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.ownTextContent = String(value); }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const child of [...this.children]) child.remove(); this.append(...nodes); }
  after(node) {
    if (!this.parentElement) return;
    const siblings = this.parentElement.children;
    const index = siblings.indexOf(this);
    node.remove(); node.parentElement = this.parentElement; siblings.splice(index + 1, 0, node);
  }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
  }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  closest(selector) {
    const selectors = selector.split(',').map(value => value.trim());
    let element = this;
    while (element) {
      if (selectors.some(value => {
        const tag = value.match(/^[a-z]+/i)?.[0]?.toUpperCase();
        const classes = [...value.matchAll(/\.([\w-]+)/g)].map(match => match[1]);
        return (!tag || element.tagName === tag) && classes.every(name => element.className.split(/\s+/).includes(name));
      })) return element;
      element = element.parentElement;
    }
    return null;
  }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  click() { this.listeners.get('click')?.({ preventDefault() {}, stopPropagation() {} }); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  querySelectorAll(selector) {
    const found = [];
    const visit = node => {
      for (const child of node.children) {
        if (selector === '*') found.push(child);
        if (selector.startsWith('.') && child.className.split(/\s+/).includes(selector.slice(1))) found.push(child);
        if (selector.startsWith('a.') && child.tagName === 'A' && child.className.split(/\s+/).includes(selector.slice(2))) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }
  cloneNode(deep = false) {
    const copy = new FixtureElement(this.tagName, this.className);
    copy.href = this.href;
    copy.ownTextContent = this.ownTextContent;
    for (const [name, value] of this.attributes) copy.setAttribute(name, value);
    if (deep) for (const child of this.children) copy.append(child.cloneNode(true));
    return copy;
  }
}

class FixtureMutationObserver {
  constructor(callback) { this.callback = callback; FixtureMutationObserver.instances.push(this); }
  observe() {}
  disconnect() {}
}
FixtureMutationObserver.instances = [];

function forumRow(title, url) {
  const row = new FixtureElement('li', 'orion-tavern-c-ThreadListItem');
  const header = new FixtureElement('header', 'orion-tavern-c-ThreadListItem__header');
  const link = new FixtureElement('a', 'title__link');
  link.href = url; link.textContent = title; header.append(link); row.append(header);
  return { row, link };
}

function savedThreadsFixture(href = BASE + '/spectrum/community/SC/forum/3', {
  includeBookmark = true,
  includeNativeThreadBookmark = false,
  nativeBookmarkActive = includeNativeThreadBookmark,
  threadTitleText = 'Example Spectrum thread',
  notificationMenuText = '',
  nativeRemovalWorks = true,
} = {}) {
  const react = new FixtureElement('div'); react.id = 'react';
  const sidebar = new FixtureElement('aside');
  const bookmarkList = new FixtureElement('div');
  const bookmarkHeader = new FixtureElement('div');
  const bookmarkHeading = new FixtureElement('strong'); bookmarkHeading.textContent = 'Bookmarks';
  bookmarkHeader.append(bookmarkHeading); bookmarkList.append(bookmarkHeader);
  const nativeBookmark = new FixtureElement('a', 'orion-tavern-c-SidebarLeftBookmark');
  nativeBookmark.href = '/spectrum/community/SC/forum/3';
  if (includeBookmark) bookmarkList.append(nativeBookmark);
  const nativeThreadBookmark = new FixtureElement('a', 'orion-tavern-c-SidebarLeftBookmark');
  nativeThreadBookmark.href = BASE + THREAD;
  if (includeNativeThreadBookmark) bookmarkList.append(nativeThreadBookmark);
  sidebar.append(bookmarkList);
  const rows = [forumRow('Example forum thread', THREAD)];
  const list = new FixtureElement('ul', 'thread-list-screen__thread-list');
  for (const entry of rows) list.append(entry.row);
  const screen = new FixtureElement('main', 'thread-list-screen'); screen.append(list); react.append(sidebar, screen);
  const threadTitle = new FixtureElement('h1', 'forum-thread-subject');
  threadTitle.textContent = threadTitleText;
  if (notificationMenuText) {
    const notificationMenu = new FixtureElement('div', 'thread-notification-menu');
    notificationMenu.textContent = notificationMenuText;
    threadTitle.append(notificationMenu);
  }
  if (href.includes('/thread/')) react.append(threadTitle);
  const subjectActions = new FixtureElement('div', 'subject-actions');
  const nativeAddButton = new FixtureElement('button', 'reset bookmark');
  nativeAddButton.setAttribute('data-tip', `${nativeBookmarkActive ? 'Remove' : 'Add'}${nativeBookmarkActive ? ' from' : ' to'} bookmarks (sidebar)`);
  let addClicks = 0; nativeAddButton.addEventListener('click', () => {
    addClicks++;
    if (nativeRemovalWorks) {
      if (nativeThreadBookmark.parentElement) nativeThreadBookmark.remove();
      nativeAddButton.setAttribute('data-tip', 'Add to bookmarks (sidebar)');
      nativeAddButton.setAttribute('aria-pressed', 'false');
    }
  });
  const nativeBookmarkIcon = new FixtureElement('span', 'bookmark-icon');
  nativeAddButton.append(nativeBookmarkIcon);
  subjectActions.append(nativeAddButton);
  if (href.includes('/thread/')) react.append(subjectActions);
  const documentListeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;
  const doc = {
    readyState: 'complete', documentElement: react,
    createElement: tagName => new FixtureElement(tagName),
    addEventListener: (name, callback, options) => {
      if (!documentListeners.has(name)) documentListeners.set(name, []);
      documentListeners.get(name).push({ callback, capture: options === true || options?.capture === true });
    },
    dispatchClick(target) {
      const event = {
        target, defaultPrevented: false, immediatePropagationStopped: false,
        preventDefault() { this.defaultPrevented = true; },
        stopImmediatePropagation() { this.immediatePropagationStopped = true; },
        stopPropagation() {},
      };
      for (const { callback, capture } of documentListeners.get('click') ?? []) if (capture) callback(event);
      let current = target;
      while (current && !event.immediatePropagationStopped) {
        current.listeners.get('click')?.(event);
        current = current.parentElement;
      }
      return event;
    },
    querySelector: selector => selector === '#react' ? react
      : selector === '#react #page.forum-thread .forum-thread-subject' && href.includes('/thread/') ? threadTitle
      : selector === '#react .subject-actions button.reset.bookmark[data-tip="Add to bookmarks (sidebar)"]' && href.includes('/thread/') && nativeAddButton.getAttribute('data-tip') === 'Add to bookmarks (sidebar)' ? nativeAddButton
      : null,
    querySelectorAll: selector => selector === '#react .thread-list-screen .orion-tavern-c-ThreadListItem' ? rows.map(entry => entry.row)
      : selector === '#react a.orion-tavern-c-SidebarLeftBookmark' ? nativeBookmark.parentElement?.querySelectorAll('a.orion-tavern-c-SidebarLeftBookmark') ?? []
      : selector === '#react .subject-actions button.reset.bookmark' && href.includes('/thread/') ? [nativeAddButton]
      : [],
  };
  nativeAddButton.click = () => doc.dispatchClick(nativeAddButton);
  nativeBookmarkIcon.click = () => doc.dispatchClick(nativeBookmarkIcon);
  const win = {
    location: { href, origin: BASE, pathname: new URL(href).pathname },
    requestAnimationFrame: callback => callback(), addEventListener() {},
    setTimeout: callback => { const id = nextTimerId++; timers.set(id, callback); return id; },
    clearTimeout: id => timers.delete(id),
    MutationObserver: FixtureMutationObserver,
  };
  return { doc, win, react, bookmarkList, rows, list, nativeBookmark, nativeThreadBookmark, nativeAddButton, nativeBookmarkIcon, runTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(callback => callback()); }, get addClicks() { return addClicks; } };
}

test('saved thread helpers accept only same-origin Spectrum thread routes', async () => {
  const api = await savedThreadsApi();
  assert.ok(api, 'the saved-thread data contract is implemented');
  assert.equal(api.normalizeThreadUrl(THREAD, BASE), THREAD);
  assert.equal(api.normalizeThreadUrl('https://example.com' + THREAD, BASE), null);
  assert.equal(api.normalizeThreadUrl('/spectrum/community/SC/lobby/1', BASE), null);
  assert.equal(api.normalizeThreadUrl('/spectrum/community/SC/forum/3', BASE), null);
  assert.equal(api.normalizeThreadUrl('/spectrum/community/SC/forum/3/thread/you-can-t-keep-doing-this', BASE), '/spectrum/community/SC/forum/3/thread/you-can-t-keep-doing-this');
});

test('saved thread toggle de-duplicates by URL and stores sanitized local records', async () => {
  const api = await savedThreadsApi();
  assert.ok(api, 'the saved-thread data contract is implemented');
  const first = api.toggleSavedThread([], { url: THREAD, title: '  Example   thread  ' }, BASE, 123);
  assert.deepEqual(first, [{ url: THREAD, title: 'Example thread', savedAt: 123 }]);
  assert.deepEqual(api.toggleSavedThread(first, { url: THREAD, title: 'Example thread' }, BASE, 456), []);
  const duplicate = api.normalizeSavedThreads([...first, { ...first[0], url: THREAD + '?source=sidebar', title: 'New label' }], BASE);
  assert.equal(duplicate.length, 1);
  assert.equal(duplicate[0].savedAt, 123);
});

test('saved thread titles strip appended Spectrum notification controls from existing data', async () => {
  const api = await savedThreadsApi();
  assert.ok(api, 'the saved-thread data contract is implemented');
  const polluted = 'Star Citizen VR Support - Experimental Release (Alpha 4.8/4.9/4.10)DisabledYou will not receive any notificationsOnly my repliesYou will receive notifications only for activities related to your own repliesWatch All';
  const [thread] = api.normalizeSavedThreads([{ url: THREAD, title: polluted }], BASE);
  assert.equal(thread.title, 'Star Citizen VR Support - Experimental Release (Alpha 4.8/4.9/4.10)');
  const [alternate] = api.normalizeSavedThreads([{ url: THREAD, title: 'Example threadNotifications are enabled · You will receive all activity notifications' }], BASE);
  assert.equal(alternate.title, 'Example thread');
});

test('concurrent saved-thread changes merge instead of overwriting another tab', async () => {
  const api = await savedThreadsApi();
  assert.ok(api, 'the saved-thread data contract is implemented');
  let tail = Promise.resolve();
  const locks = { request: (_name, _options, callback) => {
    const result = tail.then(callback);
    tail = result.catch(() => {});
    return result;
  } };
  const store = {};
  globalThis.chrome = { storage: { local: {
    get: async key => { await new Promise(resolve => setTimeout(resolve, 2)); return { [key]: store[key] }; },
    set: async values => { await new Promise(resolve => setTimeout(resolve, 2)); Object.assign(store, values); },
  } } };
  await Promise.all([
    api.setSavedThreadState({ url: THREAD, title: 'First thread' }, true, BASE, locks),
    api.setSavedThreadState({ url: THREAD.replace('example-thread/12345', 'second-thread/23456'), title: 'Second thread' }, true, BASE, locks),
  ]);
  assert.deepEqual(store[api.SAVED_THREADS_KEY].map(item => item.title).sort(), ['First thread', 'Second thread']);
});

test('saved thread storage is independent from appearance reset storage', async () => {
  const api = await savedThreadsApi();
  assert.ok(api, 'the saved-thread data contract is implemented');
  const calls = [];
  const store = { [STORAGE_KEY]: { theme: 'navy' } };
  globalThis.chrome = { storage: { local: {
    get: async key => ({ [key]: store[key] }),
    set: async values => { calls.push(Object.keys(values)); Object.assign(store, values); },
  } } };
  const saved = api.toggleSavedThread([], { url: THREAD, title: 'Example thread' }, BASE, 123);
  await api.writeSavedThreads(saved, BASE);
  assert.equal((await api.readSavedThreads(BASE)).length, 1);
  await (await import('../src/shared/storage.ts')).saveSettings((await import('../src/shared/settings.ts')).normalizeSettings());
  assert.deepEqual(calls, [[api.SAVED_THREADS_KEY], [STORAGE_KEY]]);
  assert.equal((await api.readSavedThreads(BASE)).length, 1);
});

test('forum rows and sidebar expose saved threads, and disabling hides UI without deleting saved data', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  const changes = new Set();
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => { Object.assign(stored, values); for (const listener of changes) listener(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])), 'local'); } },
    onChanged: { addListener: listener => changes.add(listener) },
  } };
  const fixture = savedThreadsFixture();
  assert.equal(fixture.doc.querySelectorAll('#react .thread-list-screen .orion-tavern-c-ThreadListItem').length, 1);
  assert.ok(fixture.rows[0].row.querySelector('a.title__link'));
  let enabled = true;
  const refresh = runtime.installSpectrumSavedThreads(() => enabled, fixture.win, fixture.doc);
  await new Promise(setImmediate);
  const star = fixture.rows[0].link.parentElement.children.find(element => element.className === 'rsi-saved-thread-toggle');
  assert.ok(star);
  assert.equal(star.textContent, '☆');
  star.click();
  await new Promise(setImmediate);
  const saved = stored[api.SAVED_THREADS_KEY];
  assert.equal(saved[0].title, 'Example forum thread');
  assert.equal(fixture.rows[0].link.parentElement.children.find(element => element.className === 'rsi-saved-thread-toggle').textContent, '★');
  const section = fixture.react.querySelector('.rsi-saved-threads');
  assert.ok(section);
  assert.equal(section.querySelector('.rsi-saved-threads__link').textContent, 'Example forum thread');
  assert.equal(section.querySelector('img'), null);
  const remove = section.querySelector('.rsi-saved-threads__remove');
  assert.ok(remove);
  assert.equal(remove.disabled, false, 'sidebar remove control is active after the save finishes');
  const late = forumRow('Late forum thread', '/spectrum/community/SC/forum/3/thread/late-thread/23456');
  fixture.list.append(late.row); fixture.rows.push(late);
  FixtureMutationObserver.instances.at(-1).callback([{ addedNodes: [late.row], removedNodes: [] }]);
  assert.ok(late.link.parentElement.children.some(element => element.className === 'rsi-saved-thread-toggle'));
  enabled = false; refresh();
  assert.equal(fixture.react.querySelector('.rsi-saved-threads'), null);
  assert.equal(fixture.rows[0].link.parentElement.children.some(element => element.className === 'rsi-saved-thread-toggle'), false);
  assert.equal(late.link.parentElement.children.some(element => element.className === 'rsi-saved-thread-toggle'), false);
  assert.equal(stored[api.SAVED_THREADS_KEY].length, 1);
});

test('saving a thread stays local and never invokes Spectrum’s native bookmark action', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD);
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);
  const star = fixture.rows[0].link.parentElement.children.find(element => element.className === 'rsi-saved-thread-toggle');
  star.click();
  await new Promise(setImmediate);
  assert.equal(fixture.addClicks, 0);
  assert.equal(stored[api.SAVED_THREADS_KEY].length, 1);
  assert.equal('bookmarkPending' in stored[api.SAVED_THREADS_KEY][0], false);
});

test('the native thread favorite control saves and removes only extension Saved Threads', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD);
  let enabled = true;
  const refresh = runtime.installSpectrumSavedThreads(() => enabled, fixture.win, fixture.doc);
  await new Promise(setImmediate);

  assert.equal(fixture.nativeAddButton.getAttribute('data-tip'), 'Save to Saved Threads');
  const saveEvent = fixture.nativeBookmarkIcon.click();
  await new Promise(setImmediate);
  assert.equal(saveEvent.defaultPrevented, true, 'the native bookmark navigation/action is cancelled');
  assert.equal(saveEvent.immediatePropagationStopped, true, 'Spectrum’s delegated bookmark handler is blocked');
  assert.equal(fixture.addClicks, 0, 'the native bookmark action never runs');
  assert.deepEqual(stored[api.SAVED_THREADS_KEY].map(({ url, title }) => ({ url, title })), [
    { url: THREAD, title: 'Example Spectrum thread' },
  ]);
  const savedSection = fixture.react.querySelector('.rsi-saved-threads');
  assert.equal(savedSection.querySelector('.rsi-saved-threads__heading').textContent, 'Saved Threads');
  assert.equal(savedSection.querySelector('.rsi-saved-threads__link').textContent, 'Example Spectrum thread');
  assert.equal(fixture.nativeAddButton.getAttribute('data-tip'), 'Remove from Saved Threads');
  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), 'true');

  const removeEvent = fixture.nativeAddButton.click();
  await new Promise(setImmediate);
  assert.equal(removeEvent.defaultPrevented, true);
  assert.equal(fixture.addClicks, 0, 'removing also never invokes Spectrum’s bookmark action');
  assert.deepEqual(stored[api.SAVED_THREADS_KEY], []);
  assert.equal(fixture.react.querySelector('.rsi-saved-threads'), null);
  assert.equal(fixture.nativeAddButton.getAttribute('data-tip'), 'Save to Saved Threads');
  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), 'false');

  enabled = false;
  refresh();
  assert.equal(fixture.nativeAddButton.getAttribute('data-tip'), 'Add to bookmarks (sidebar)', 'disabling restores Spectrum’s original control');
  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), null);
  const nativeEvent = fixture.nativeAddButton.click();
  assert.equal(nativeEvent.defaultPrevented, false, 'the native control resumes when Saved Threads is disabled');
  assert.equal(fixture.addClicks, 1);
});

test('clicking an already-native-bookmarked thread removes the legacy bookmark without duplicating it', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD, { includeNativeThreadBookmark: true });
  let enabled = true;
  const refresh = runtime.installSpectrumSavedThreads(() => enabled, fixture.win, fixture.doc);
  await new Promise(setImmediate);

  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), 'true', 'the existing native bookmark is shown as active');
  const event = fixture.nativeBookmarkIcon.click();
  await new Promise(setImmediate);
  assert.equal(event.defaultPrevented, false, 'the native removal is allowed for a legacy bookmark');
  assert.equal(fixture.addClicks, 1, 'the existing native bookmark is removed');
  assert.equal(fixture.nativeThreadBookmark.parentElement, null);
  assert.deepEqual(stored[api.SAVED_THREADS_KEY] ?? [], [], 'removing a legacy bookmark does not add it to Saved Threads');
  refresh();
  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), 'false', 'the star now appears unbookmarked');
  enabled = false;
  refresh();
  assert.equal(fixture.nativeAddButton.getAttribute('data-tip'), 'Add to bookmarks (sidebar)', 'disabling restores Spectrum’s updated native state');
});

test('a failed legacy native bookmark removal recovers and allows another header-star click', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD, { includeNativeThreadBookmark: true, nativeRemovalWorks: false });
  let enabled = true;
  const refresh = runtime.installSpectrumSavedThreads(() => enabled, fixture.win, fixture.doc);
  await new Promise(setImmediate);

  const first = fixture.nativeAddButton.click();
  assert.equal(first.defaultPrevented, false, 'Spectrum receives the first native cleanup click');
  assert.equal(fixture.addClicks, 1);
  assert.ok(fixture.nativeThreadBookmark.parentElement, 'the simulated native bookmark remains after failure');
  fixture.runTimers();
  refresh();
  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), 'true', 'the failed removal is shown as active again');

  const retry = fixture.nativeAddButton.click();
  assert.equal(retry.defaultPrevented, false, 'the recovered star allows a retry');
  assert.equal(fixture.addClicks, 2, 'the second native cleanup click reaches Spectrum');
  assert.deepEqual(stored[api.SAVED_THREADS_KEY] ?? [], [], 'failed cleanup never creates a local duplicate');
  enabled = false;
  refresh();
  assert.equal(fixture.nativeAddButton.getAttribute('data-tip'), 'Remove from bookmarks (sidebar)', 'disabling restores the still-active native bookmark after a failed cleanup');
});

test('a bookmark missing from the truncated sidebar is not mistaken for a successful cleanup', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD, { nativeBookmarkActive: true, nativeRemovalWorks: false });
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);

  const first = fixture.nativeAddButton.click();
  assert.equal(first.defaultPrevented, false, 'the known-active native favorite remains a cleanup action');
  fixture.runTimers();
  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), 'true', 'an absent sidebar entry does not clear the active state');
  const retry = fixture.nativeAddButton.click();
  assert.equal(retry.defaultPrevented, false, 'the active native favorite can be retried');
  assert.equal(fixture.addClicks, 2);
  assert.deepEqual(stored[api.SAVED_THREADS_KEY] ?? [], [], 'a failed native request never creates a local duplicate');
});

test('disabling during pending cleanup preserves an active bookmark omitted from the sidebar', async () => {
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  globalThis.chrome = { storage: {
    local: { get: async () => ({}), set: async () => {} },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD, { nativeBookmarkActive: true, nativeRemovalWorks: false });
  let enabled = true;
  const refresh = runtime.installSpectrumSavedThreads(() => enabled, fixture.win, fixture.doc);
  await new Promise(setImmediate);
  fixture.nativeAddButton.click();
  enabled = false;
  refresh();
  assert.equal(fixture.nativeAddButton.getAttribute('data-tip'), 'Remove from bookmarks (sidebar)', 'disabling restores the still-active native state when the sidebar entry is not visible');
});

test('a delayed native removal is detected after the retry timeout', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD, { includeNativeThreadBookmark: true, nativeRemovalWorks: false });
  const refresh = runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);

  fixture.nativeAddButton.click();
  fixture.runTimers();
  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), 'true', 'the timeout keeps the native state active while its result is unknown');
  fixture.nativeThreadBookmark.remove();
  fixture.nativeAddButton.setAttribute('data-tip', 'Add to bookmarks (sidebar)');
  fixture.nativeAddButton.setAttribute('aria-pressed', 'false');
  FixtureMutationObserver.instances.at(-1).callback([{ type: 'attributes', target: fixture.nativeAddButton, attributeName: 'aria-pressed' }]);
  refresh();
  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), 'false', 'a late native state change clears the stale active state');

  const save = fixture.nativeAddButton.click();
  await new Promise(setImmediate);
  assert.equal(save.defaultPrevented, true, 'the next click now saves locally instead of re-adding the native bookmark');
  assert.equal(stored[api.SAVED_THREADS_KEY].length, 1);
});

test('removing a legacy native bookmark also clears its duplicate extension save', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = { [api.SAVED_THREADS_KEY]: [{ url: THREAD, title: 'Example Spectrum thread', savedAt: 123 }] };
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD, { includeNativeThreadBookmark: true });
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);

  const event = fixture.nativeAddButton.click();
  await new Promise(setImmediate);
  assert.equal(event.defaultPrevented, false, 'the native bookmark removal is preserved');
  assert.equal(fixture.nativeThreadBookmark.parentElement, null);
  assert.deepEqual(stored[api.SAVED_THREADS_KEY], [], 'one click removes both stale native and duplicate local state');
});

test('thread titles omit notification controls regardless of their wording', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD, {
    threadTitleText: 'Example Spectrum thread',
    notificationMenuText: 'Notifications are enabled · You will receive all activity alerts',
  });
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);
  fixture.nativeAddButton.click();
  await new Promise(setImmediate);
  assert.equal(stored[api.SAVED_THREADS_KEY][0].title, 'Example Spectrum thread');
});

test('a favorite clicked before saved-thread storage loads waits for existing state before toggling', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const initial = [{ url: THREAD, title: 'Previously saved thread', savedAt: 123 }];
  const stored = { [api.SAVED_THREADS_KEY]: initial };
  let finishRead;
  const readGate = new Promise(resolve => { finishRead = resolve; });
  globalThis.chrome = { storage: {
    local: {
      get: async key => { await readGate; return { [key]: stored[key] }; },
      set: async values => Object.assign(stored, values),
    },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD);
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);

  const event = fixture.nativeAddButton.click();
  assert.equal(event.defaultPrevented, true, 'the click is captured while storage is loading');
  assert.equal(fixture.addClicks, 0, 'the native bookmark action cannot run during startup');
  finishRead();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.deepEqual(stored[api.SAVED_THREADS_KEY], [], 'the queued click removes the already-saved thread after loading');
  assert.equal(fixture.nativeAddButton.getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.addClicks, 0);
});

test('saved thread can be removed directly from the sidebar without changing native bookmarks', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture();
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);
  fixture.rows[0].link.parentElement.children.find(element => element.className === 'rsi-saved-thread-toggle').click();
  await new Promise(setImmediate);
  const remove = fixture.react.querySelector('.rsi-saved-threads__remove');
  assert.ok(remove);
  remove.click();
  await new Promise(setImmediate);
  assert.deepEqual(stored[api.SAVED_THREADS_KEY], []);
  assert.equal(fixture.react.querySelector('.rsi-saved-threads'), null);
  assert.equal(fixture.nativeBookmark.parentElement !== null, true);
  assert.equal(fixture.addClicks, 0);
});

test('reused forum row star saves the current link and title', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = {};
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture();
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);
  const row = fixture.rows[0];
  const star = row.link.parentElement.children.find(element => element.className === 'rsi-saved-thread-toggle');
  row.link.href = '/spectrum/community/SC/forum/3/thread/changed-thread/67890';
  row.link.textContent = 'Updated row title';
  FixtureMutationObserver.instances.at(-1).callback([{ addedNodes: [row.link], removedNodes: [] }]);
  star.click();
  await new Promise(setImmediate);
  assert.equal(stored[api.SAVED_THREADS_KEY][0].url, row.link.href);
  assert.equal(stored[api.SAVED_THREADS_KEY][0].title, 'Updated row title');
});

test('saved threads sidebar renders with an empty native bookmarks list', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = { [api.SAVED_THREADS_KEY]: [{ url: THREAD, title: 'Example forum thread', savedAt: 123 }] };
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + '/spectrum/community/SC/forum/3', { includeBookmark: false });
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);
  const section = fixture.react.querySelector('.rsi-saved-threads');
  assert.ok(section);
  assert.equal(section.querySelector('.rsi-saved-threads__link').textContent, 'Example forum thread');
});

test('saved-thread data never clicks Spectrum native bookmark controls', async () => {
  const api = await savedThreadsApi();
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  const stored = { [api.SAVED_THREADS_KEY]: [{ url: THREAD, title: 'Example forum thread', savedAt: 123 }] };
  globalThis.chrome = { storage: {
    local: { get: async key => ({ [key]: stored[key] }), set: async values => Object.assign(stored, values) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + THREAD);
  fixture.nativeAddButton.setAttribute('data-tip', 'Remove from bookmarks (sidebar)');
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);
  assert.equal(fixture.addClicks, 0);
  assert.equal(stored[api.SAVED_THREADS_KEY].length, 1);
});

test('unrelated chat message mutations do not trigger forum or sidebar rescans', async () => {
  const runtime = await savedThreadsRuntime();
  assert.ok(runtime, 'the saved-thread UI module is implemented');
  globalThis.chrome = { storage: {
    local: { get: async () => ({}) },
    onChanged: { addListener() {} },
  } };
  const fixture = savedThreadsFixture(BASE + '/spectrum/community/SC/lobby/1');
  const selectors = [];
  const queryAll = fixture.doc.querySelectorAll;
  fixture.doc.querySelectorAll = selector => { selectors.push(selector); return queryAll(selector); };
  runtime.installSpectrumSavedThreads(() => true, fixture.win, fixture.doc);
  await new Promise(setImmediate);
  selectors.length = 0;
  const chatMessage = new FixtureElement('div', 'message-item'); fixture.react.append(chatMessage);
  FixtureMutationObserver.instances.at(-1).callback([{ addedNodes: [chatMessage], removedNodes: [] }]);
  assert.deepEqual(selectors, []);
});
