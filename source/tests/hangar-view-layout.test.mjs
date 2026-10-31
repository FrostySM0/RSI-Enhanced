import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installHangarView } from '../src/content/hangar-view.ts';

class FixtureElement {
  constructor(tagName = 'div', className = '') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.classes = new Set(className.split(/\s+/).filter(Boolean));
    this.classList = {
      add: value => this.classes.add(value),
      remove: value => this.classes.delete(value),
      contains: value => this.classes.has(value),
    };
    this.value = '';
    this.isConnected = true;
  }

  set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(' '); }
  get childNodes() { return this.children; }
  set textContent(value) { this._textContent = value; this.children = []; }
  get textContent() { return this._textContent || this.children.map(child => child.textContent).join(''); }

  #insert(nodes, index) {
    for (const node of nodes) {
      if (node.parentElement) node.parentElement.children.splice(node.parentElement.children.indexOf(node), 1);
      node.parentElement = this;
      this.children.splice(index++, 0, node);
    }
  }

  append(...nodes) { this.#insert(nodes, this.children.length); }
  prepend(...nodes) { this.#insert(nodes, 0); }
  before(...nodes) {
    if (!this.parentElement) return;
    this.parentElement.#insert(nodes, this.parentElement.children.indexOf(this));
  }
  remove() {
    if (this.parentElement) this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
    this.parentElement = null;
    this.isConnected = false;
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (selector.startsWith('.') && node.classes.has(selector.slice(1))) return node;
    }
    return null;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  querySelectorAll(selector) {
    const selectors = selector.split(',').map(value => value.trim());
    const matches = node => selectors.some(candidate => /^h[1-6]$/i.test(candidate) ? node.tagName === candidate.toUpperCase()
      : candidate.startsWith('.') ? node.classes.has(candidate.slice(1))
        : candidate.startsWith('[class*="title"]') ? node.className.includes('title')
          : candidate.startsWith('[class*="heading"]') ? node.className.includes('heading')
            : candidate === 'button' ? node.tagName === 'BUTTON' : false);
    return this.children.flatMap(child => [ ...(matches(child) ? [child] : []), ...child.querySelectorAll(selector) ]);
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}

test('My Gear toolbar centers the title between view controls and page controls', () => {
  const items = new FixtureElement('div', 'items');
  const pagination = new FixtureElement('div', 'billing-title-pager-wrapper');
  const title = new FixtureElement('div', 'title'); title.textContent = 'My Gear';
  const filter = new FixtureElement('div', 'js-product-type-filter');
  const pager = new FixtureElement('div', 'pager');
  pagination.append(title, filter, pager);
  items.append(pagination);
  const search = new FixtureElement('input', 'rsi-hangar-search');
  const filterSlot = new FixtureElement('div', 'rsi-hangar-filter-slot');
  const sortSlot = new FixtureElement('div', 'rsi-hangar-search-sort-slot');
  const searchPanel = new FixtureElement('div', 'rsi-hangar-search-panel');
  searchPanel.append(search, filterSlot, sortSlot);
  const documentListeners = new Map();
  let searchReady = false;

  const document = {
    readyState: 'complete',
    documentElement: new FixtureElement('html'),
    defaultView: { CustomEvent: class {}, location: { search: '?page=2' } },
    querySelector(selector) {
      if (selector.includes('.billing-title-pager-wrapper')) return pagination;
      if (selector.includes('.rsi-hangar-search-sort-slot')) return searchReady ? sortSlot : null;
      if (selector.includes('.rsi-hangar-filter-slot')) return filterSlot;
      if (selector.includes('.rsi-hangar-search')) return search;
      if (selector.includes('.rsi-hangar-filter') || selector.includes('.js-product-type-filter')) return filter;
      return null;
    },
    querySelectorAll(selector) {
      return title.tagName === 'H2' && selector.includes('.inner-content h2') && !selector.includes('>') ? [title] : [];
    },
    createElement: tag => new FixtureElement(tag),
    createComment: () => new FixtureElement('#comment'),
    addEventListener(name, callback) { documentListeners.set(name, callback); },
    removeEventListener(name) { documentListeners.delete(name); },
    dispatchEvent(event) { documentListeners.get(event.type)?.(event); },
  };
  const previousChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {
      onChanged: { addListener() {} },
      local: { get: async () => ({}), set: async () => {} },
    },
  };

  let enabled = true;
  const refresh = installHangarView(() => enabled, document);
  try {
    refresh();

    const heading = items.children.find(child => child.classes.has('rsi-hangar-heading'));
    assert.ok(heading, 'the extension inserts a dedicated My Gear header row');
    assert.ok(heading.children[0].classList.contains('rsi-hangar-view'), 'view controls stay on the left');
    const titleGroup = heading.querySelector('.rsi-hangar-title');
    assert.ok(titleGroup, 'the My Gear title gets a dedicated centered group');
    assert.ok(titleGroup.children.includes(title));
    assert.ok(titleGroup.querySelector('.rsi-hangar-item-count'), 'the all-page count stays with the centered heading');
    const controls = heading.querySelector('.rsi-hangar-heading-controls');
    assert.ok(controls, 'page-size and native pagination share the right-side controls group');
    assert.ok(controls.querySelector('.rsi-hangar-sort'), 'sort falls back to the item toolbar before search is ready');
    searchReady = true;
    document.dispatchEvent({ type: 'rsi-hangar-search-ready' });
    assert.ok(sortSlot.querySelector('.rsi-hangar-sort'), 'sort moves into the search toolbar once the panel exists');
    assert.ok(!controls.querySelector('.rsi-hangar-sort'));
    assert.ok(controls.querySelector('.rsi-hangar-page-size'));
    assert.ok(controls.children.indexOf(controls.querySelector('.rsi-hangar-page-size')) < controls.children.indexOf(pager), 'items per page appears before page numbers');
    assert.ok(controls.children.includes(pager), 'native page-number controls stay on the right beside page size');
    assert.ok(!pagination.querySelector('.pager'), 'native page numbers move into the toolbar while the extension layout is active');
    assert.ok(filterSlot.children.includes(filter), 'the native type filter appears inside the Filters popover slot');
    assert.ok(!pagination.querySelector('.rsi-hangar-view'), 'pagination remains independent below the header');
    document.dispatchEvent({ type: 'rsi-hangar-index-status', detail: { itemCount: 27, pageCount: 3, state: 'ready' } });
    assert.equal(controls.querySelector('.rsi-hangar-range').textContent, 'Showing 10–18 of 27', 'the toolbar shows the current item range beside pagination');
    enabled = false;
    refresh();
    assert.equal(title.parentElement, pagination, 'the native title returns to its original location when Hangar styling is disabled');
    assert.equal(pager.parentElement, pagination, 'native page numbers return to the original wrapper when Hangar styling is disabled');
    assert.ok(!pagination.classList.contains('rsi-hangar-pagination-rehomed'));
  } finally {
    globalThis.chrome = previousChrome;
  }
});
