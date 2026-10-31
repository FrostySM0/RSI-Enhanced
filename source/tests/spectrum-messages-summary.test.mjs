import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

let createSpectrumMessagesSummaryController;
try {
  ({ createSpectrumMessagesSummaryController } = await import('../src/content/spectrum-messages-summary.ts'));
} catch {
  // The regression run is expected to fail until the controller is added.
}

class ElementStub {
  constructor(tagName, className = '', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.className = className;
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this._textContent = '';
  }

  get textContent() { return this._textContent + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this._textContent = String(value); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      child.isConnected = this.isConnected;
      this.children.push(child);
    }
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
    this.isConnected = false;
  }
  querySelector(selector) {
    if (selector === '.orion-tavern-c-sidebarRightHeader__title[title="Messages"]') {
      return this.descendants().find(item => item.className.split(/\s+/).includes('orion-tavern-c-sidebarRightHeader__title') && item.getAttribute('title') === 'Messages') ?? null;
    }
    if (selector === '.orion-tavern-c-sidebarRightHeader__top') return this.descendants().find(item => item.className.split(/\s+/).includes('orion-tavern-c-sidebarRightHeader__top')) ?? null;
    if (selector === '.orion-tavern-c-sidebarRightHeader__counter') return this.descendants().find(item => item.className.split(/\s+/).includes('orion-tavern-c-sidebarRightHeader__counter')) ?? null;
    if (selector === '.orion-tavern-c-SidebarRightDirectMessage__counter') return this.descendants().find(item => item.className.split(/\s+/).includes('orion-tavern-c-SidebarRightDirectMessage__counter')) ?? null;
    if (selector === '.orion-tavern-c-SidebarRightDirectMessage__counter p') return this.querySelector('.orion-tavern-c-SidebarRightDirectMessage__counter')?.descendants().find(item => item.tagName === 'P') ?? null;
    if (selector === '.rsi-spectrum-message-summary') return this.descendants().find(item => item.className.split(/\s+/).includes('rsi-spectrum-message-summary')) ?? null;
    return null;
  }
  querySelectorAll(selector) {
    if (selector === 'a.orion-tavern-c-SidebarRightDirectMessage') {
      return this.descendants().filter(item => item.className.split(/\s+/).includes('orion-tavern-c-SidebarRightDirectMessage'));
    }
    return [];
  }
  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
}

class MutationObserverStub {
  static instances = [];
  constructor(callback) { this.callback = callback; this.targets = new Map(); MutationObserverStub.instances.push(this); }
  observe(target, options) { this.targets.set(target, options); }
  disconnect() { this.targets.clear(); }
  trigger(target) {
    const observed = this.targets.has(target) || [...this.targets].some(([root, options]) => options.subtree && root.contains?.(target));
    if (observed) this.callback([{ type: 'childList', target, addedNodes: [] }], this);
  }
}

function createFixture() {
  const title = new ElementStub('p', 'orion-tavern-c-sidebarRightHeader__title', { title: 'Messages' });
  title.textContent = 'Messages';
  const nativeCounter = new ElementStub('p', 'orion-tavern-c-sidebarRightHeader__counter', { title: '1 unread' });
  nativeCounter.textContent = '1 unread';
  const top = new ElementStub('div', 'orion-tavern-c-sidebarRightHeader__top');
  top.append(title, nativeCounter);
  const sidebar = new ElementStub('div', 'mainLayout__sidebar mainLayout__right');
  sidebar.append(top);
  const row = new ElementStub('a', 'orion-tavern-c-SidebarRightDirectMessage');
  const rowCounter = new ElementStub('span', 'orion-tavern-c-SidebarRightDirectMessage__counter');
  const count = new ElementStub('p');
  count.textContent = '1';
  rowCounter.append(count);
  row.append(rowCounter);
  sidebar.append(row);
  const root = new ElementStub('div', 'react-root');
  root.append(sidebar);
  const doc = {
    documentElement: root,
    querySelector(selector) {
      if (selector === '#react') return root;
      if (selector === '.mainLayout__sidebar.mainLayout__right') return sidebar;
      return null;
    },
    querySelectorAll(selector) {
      return selector === '.mainLayout__sidebar.mainLayout__right' ? [sidebar] : [];
    },
    createElement(tagName) { return new ElementStub(tagName); },
  };
  return { doc, root, sidebar, top, nativeCounter, row, rowCounter, count };
}

test('Messages status shows conversation and unread totals and updates with native rows', () => {
  assert.equal(typeof createSpectrumMessagesSummaryController, 'function', 'Messages summary controller should be available');
  MutationObserverStub.instances = [];
  const fixture = createFixture();
  const refresh = createSpectrumMessagesSummaryController(fixture.doc, {
    MutationObserver: MutationObserverStub,
    setTimeout: callback => { MutationObserverStub.discovery = callback; return 1; },
    clearTimeout: () => {},
  });

  refresh(true);
  const summary = fixture.top.querySelector('.rsi-spectrum-message-summary');
  assert.ok(summary, 'a visible extension-owned summary is added to the header');
  assert.equal(summary.textContent, '1 conversation · 1 unread');
  assert.equal(summary.getAttribute('role'), 'status');
  assert.equal(fixture.nativeCounter.getAttribute('title'), '1 unread', 'native counter data is preserved');

  fixture.top.children.find(item => item === fixture.nativeCounter).setAttribute('title', '3 unread');
  fixture.nativeCounter.textContent = '3 unread';
  const secondRow = new ElementStub('a', 'orion-tavern-c-SidebarRightDirectMessage');
  fixture.sidebar.append(secondRow);
  MutationObserverStub.instances.find(observer => observer.targets.has(fixture.sidebar)).trigger(fixture.sidebar);
  assert.equal(summary.textContent, '2 conversations · 3 unread', 'counts update when Spectrum changes the native drawer');

  refresh(false);
  assert.equal(fixture.top.querySelector('.rsi-spectrum-message-summary'), null, 'disabling removes only the extension-owned status');
});

test('Messages summary falls back to unread markers on conversation rows', () => {
  assert.equal(typeof createSpectrumMessagesSummaryController, 'function');
  const fixture = createFixture();
  fixture.nativeCounter.remove();
  const refresh = createSpectrumMessagesSummaryController(fixture.doc, {
    MutationObserver: MutationObserverStub,
    setTimeout: callback => { MutationObserverStub.discovery = callback; return 1; },
    clearTimeout: () => {},
  });

  refresh(true);
  assert.equal(fixture.top.querySelector('.rsi-spectrum-message-summary')?.textContent, '1 conversation · 1 unread');
  refresh(false);
});

test('Messages summary is wired to the themed Spectrum route', async () => {
  const entry = await readFile('src/content/index.ts', 'utf8');
  assert.match(entry, /createSpectrumMessagesSummaryController/);
  assert.match(entry, /refreshSpectrumMessagesSummary\(activeSection === 'spectrum' && settings\.modules\.theme\)/);
});
