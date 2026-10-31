import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

let createSpectrumSidebarEmptyStateController;
try {
  ({ createSpectrumSidebarEmptyStateController } = await import('../src/content/spectrum-sidebar-empty.ts'));
} catch {
  // The initial regression run is expected to fail until the controller exists.
}

class ElementStub {
  constructor(tagName, className = '', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.className = className;
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.listeners = new Map();
    this.parentElement = null;
    this.isConnected = true;
    this._textContent = '';
  }

  get textContent() { return this._textContent + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._textContent = String(value); }

  get classList() {
    return { add: name => { this.className = `${this.className} ${name}`.trim(); } };
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      child.isConnected = this.isConnected;
      this.children.push(child);
    }
  }
  appendChild(child) { this.append(child); return child; }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
    this.isConnected = false;
  }
  click() {
    this.clicks = (this.clicks ?? 0) + 1;
    this.listeners.get('click')?.({ currentTarget: this });
  }
  contains(target) {
    for (let current = target; current; current = current.parentElement) if (current === this) return true;
    return false;
  }
  closest(selector) {
    for (let current = this; current; current = current.parentElement) if (current.matches(selector)) return current;
    return null;
  }

  matches(selector) {
    if (selector.startsWith('button[')) {
      return this.tagName === 'BUTTON' && this.getAttribute('aria-label') === selector.match(/aria-label="([^"]+)"/)?.[1];
    }
    if (selector.startsWith('[data-')) return this.attributes.has(selector.slice(1, -1).split('=')[0]);
    const className = selector.split('.').filter(Boolean).at(-1)?.split(/[\s:[>]/)[0];
    return Boolean(className && this.className.split(/\s+/).includes(className));
  }

  querySelector(selector) {
    const directOnly = selector.startsWith(':scope > ');
    const target = directOnly ? selector.slice(':scope > '.length) : selector;
    const candidates = directOnly ? this.children : this.descendants();
    return candidates.find(child => target === 'li'
      ? child.tagName === 'LI'
      : child.matches(target)) ?? null;
  }

  querySelectorAll(selector) {
    const directOnly = selector.startsWith(':scope > ');
    const target = directOnly ? selector.slice(':scope > '.length) : selector;
    const candidates = directOnly ? this.children : this.descendants();
    if (target.includes('SidebarLeftContentGroup')) {
      return candidates.filter(child => child.className.split(/\s+/).includes('orion-tavern-c-SidebarLeftContentGroup'));
    }
    return candidates.filter(child => child.matches(target));
  }

  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
}

class MutationObserverStub {
  static instances = [];
  constructor(callback) { this.callback = callback; this.targets = new Map(); MutationObserverStub.instances.push(this); }
  observe(target, options) { this.targets.set(target, options); }
  disconnect() { this.targets.clear(); }
  trigger(target) {
    const observed = this.targets.has(target) || [...this.targets].some(([root, options]) => options.subtree && root.contains(target));
    if (observed) this.callback([{ type: 'childList', target, addedNodes: [] }], this);
  }
}

function fixtureGroup(action, listPresent = true) {
  const group = new ElementStub('div', 'orion-tavern-c-SidebarLeftContentGroup');
  const header = new ElementStub('header', 'orion-tavern-c-SidebarLeftContentGroup__header');
  const nav = new ElementStub('nav', 'header__nav-icons');
  const nativeSettings = new ElementStub('a', '', { 'aria-label': 'Settings' });
  const nativeAction = new ElementStub('button', '', { 'aria-label': action, type: 'button' });
  nav.append(nativeSettings, nativeAction);
  header.append(nav);
  group.append(header);
  const list = listPresent ? new ElementStub('ul', 'orion-tavern-c-SidebarLeftContentGroup__content') : null;
  if (list) group.append(list);
  return { group, header, list, nativeAction, nativeSettings };
}

function fixtureDocument(groups, shouldMount = true) {
  let mounted = shouldMount;
  const sidebar = new ElementStub('nav', 'spectrumSidebarLeft');
  sidebar.append(...groups.map(item => item.group));
  const host = new ElementStub('aside', 'mainLayout__left');
  host.append(sidebar);
  const reactRoot = new ElementStub('div', 'react-root');
  if (mounted) reactRoot.append(host);
  return {
    sidebar,
    host,
    reactRoot,
    mount() { mounted = true; reactRoot.append(host); },
    document: {
      querySelector(selector) {
        if (selector === '#react') return reactRoot;
        if (selector === '.spectrumSidebarLeft') return mounted ? sidebar : null;
        if (selector === '.mainLayout__left') return mounted ? host : null;
        return null;
      },
      querySelectorAll(selector) { return mounted && selector === '.spectrumSidebarLeft .orion-tavern-c-SidebarLeftContentGroup' ? sidebar.children : []; },
      documentElement: reactRoot,
      createElement(tagName) { return new ElementStub(tagName); },
      createElementNS(_namespace, tagName) { return new ElementStub(tagName); },
    },
  };
}

function observerEnvironment() {
  const timers = new Map();
  let timerId = 0;
  return {
    timers,
    window: {
      MutationObserver: MutationObserverStub,
      setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
  };
}

test('empty sidebar prompts match the reference and keep their CTA connected to RSI native actions', async () => {
  assert.equal(typeof createSpectrumSidebarEmptyStateController, 'function', 'sidebar empty-state controller should be available');
  MutationObserverStub.instances = [];

  const recent = fixtureGroup('Start a conversation');
  const privateGroups = fixtureGroup('Start a group');
  const noPrivateList = fixtureGroup('Start a group', false);
  const fixture = fixtureDocument([recent, privateGroups, noPrivateList]);
  const environment = observerEnvironment();
  const refresh = createSpectrumSidebarEmptyStateController(fixture.document, environment.window);

  refresh(true);
  const recentState = recent.group.querySelector('.rsi-spectrum-sidebar-empty-state');
  const privateState = privateGroups.group.querySelector('.rsi-spectrum-sidebar-empty-state');
  const missingListState = noPrivateList.group.querySelector('.rsi-spectrum-sidebar-empty-state');
  assert.ok(recentState, 'empty Recent Messages gets its own empty state');
  assert.ok(privateState, 'empty Private Groups gets its own empty state');
  assert.ok(missingListState, 'Private Groups still gets its empty state when RSI omits its list element');
  assert.match(privateState.textContent, /No private groups yet\./);
  assert.match(privateState.textContent, /Create a group to chat with your organisation or friends\./);
  assert.match(recentState.textContent, /No recent messages yet\./);
  assert.equal(recentState.children[1].textContent, 'No recent messages yet.', 'the bold title stays in its own row');
  assert.equal(recentState.children[2].textContent, 'Start a conversation to see messages here.', 'the recent-message description uses the requested copy');
  assert.equal(recentState.children[0].children[0].getAttribute('data-icon'), 'thought-bubble', 'Recent Messages uses a thought bubble');
  assert.equal(privateState.children[0].children[0].getAttribute('data-icon'), 'people', 'Private Groups keeps its people icon');
  assert.equal(recentState.children.at(-1).textContent, '+New Message');
  assert.equal(privateState.children.at(-1).textContent, '+Create Private Group');
  assert.equal(recent.nativeAction.getAttribute('aria-label'), 'Start a conversation', 'the native conversation action remains available to the CTA');
  assert.equal(privateGroups.nativeAction.getAttribute('aria-label'), 'Start a group', 'the native group action remains available to the CTA');
  assert.equal(recent.nativeSettings.getAttribute('aria-label'), 'Settings', 'Recent Messages settings remain in their heading');
  assert.equal(privateGroups.nativeSettings.getAttribute('aria-label'), 'Settings', 'Private Groups settings remain in their heading');

  recentState.children.at(-1).click();
  privateState.children.at(-1).click();
  assert.equal(recent.nativeAction.clicks, 1, 'New Message invokes RSI’s existing conversation action');
  assert.equal(privateGroups.nativeAction.clicks, 1, 'Create Private Group invokes RSI’s existing group action');

  const observer = MutationObserverStub.instances.at(-1);
  const row = new ElementStub('li');
  privateGroups.list.append(row);
  observer.trigger(privateGroups.list);
  assert.equal(privateGroups.group.querySelector('.rsi-spectrum-sidebar-empty-state'), null, 'the prompt disappears when a native group row appears');
  row.remove();
  observer.trigger(privateGroups.list);
  assert.ok(privateGroups.group.querySelector('.rsi-spectrum-sidebar-empty-state'), 'the prompt returns when the native list becomes empty again');

  refresh(false);
  assert.equal(recent.group.querySelector('.rsi-spectrum-sidebar-empty-state'), null, 'disabling removes extension-owned prompt elements');
  assert.equal(observer.targets.size, 0, 'disabling disconnects the local observer');
  assert.equal(noPrivateList.group.querySelector('.rsi-spectrum-sidebar-empty-state'), null);
});

test('sidebar content mounted after the initial route check is discovered for a bounded time', () => {
  assert.equal(typeof createSpectrumSidebarEmptyStateController, 'function');
  MutationObserverStub.instances = [];
  const privateGroups = fixtureGroup('Start a group');
  const fixture = fixtureDocument([], false);
  const environment = observerEnvironment();
  const refresh = createSpectrumSidebarEmptyStateController(fixture.document, environment.window);
  refresh(true);

  assert.equal(privateGroups.group.querySelector('.rsi-spectrum-sidebar-empty-state'), null);
  const discovery = MutationObserverStub.instances[0];
  assert.ok(discovery.targets.has(fixture.reactRoot), 'the late-mount observer watches only the app root');
  assert.equal([...environment.timers.values()][0].delay, 15_000, 'discovery has a short timeout');

  fixture.mount();
  discovery.trigger(fixture.reactRoot);
  assert.equal(privateGroups.group.querySelector('.rsi-spectrum-sidebar-empty-state'), null);
  assert.equal(discovery.targets.size, 0, 'the broad observer disconnects after finding the sidebar');
  assert.equal(environment.timers.size, 0, 'the discovery timeout is cleared after mounting');
  const sidebarObserver = MutationObserverStub.instances.at(-1);
  fixture.sidebar.append(privateGroups.group);
  sidebarObserver.trigger(fixture.sidebar);
  assert.ok(privateGroups.group.querySelector('.rsi-spectrum-sidebar-empty-state'), 'the empty state appears when RSI adds its nested content group');
  refresh(false);
});

test('sidebar empty-state CSS hides duplicate add controls but preserves settings actions', async () => {
  const css = await readFile('src/styles/spectrum-home.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-home.html', 'utf8');
  const entry = await readFile('src/content/index.ts', 'utf8');

  assert.match(css, /\.rsi-spectrum-sidebar-empty-state\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*align-items:\s*center;/s);
  assert.match(css, /\.rsi-spectrum-sidebar-empty-state__icon\s*\{[^}]*width:\s*64px;[^}]*height:\s*64px;[^}]*border-radius:\s*50%;/s);
  assert.match(css, /\.rsi-spectrum-sidebar-empty-state__action\s*\{[^}]*border:\s*1px solid color-mix\(/s);
  assert.match(css, /SidebarLeftContentGroup:has\(> \.rsi-spectrum-sidebar-empty-state\)[^{}]*button\[aria-label="Start a conversation"\][^{}]*button\[aria-label="Start a group"\][^{}]*\{\s*display:\s*none;/s,
    'only the redundant native conversation and group plus buttons are hidden while their empty-state CTA is shown');
  assert.doesNotMatch(css, /\.header__nav-icons\s*\{[^}]*display:\s*none/s,
    'the header action container and its settings control remain visible');
  assert.match(fixture, /aria-label="Start a conversation"/);
  assert.match(fixture, /aria-label="Start a group"/);
  assert.match(entry, /createSpectrumSidebarEmptyStateController/);
});
