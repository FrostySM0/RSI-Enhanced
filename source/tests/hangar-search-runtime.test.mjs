import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { HANGAR_FILTER_CHANGE_EVENT, HANGAR_SHIP_PAINT_SESSION_KEY, SHIP_PAINT_FILTER_VALUE } from '../src/content/hangar-controls.ts';
import { HANGAR_CACHE_TTL_MS, createHangarCache, normalizeHangarPledge } from '../src/content/hangar-data.ts';
import { HANGAR_INDEX_STORAGE_KEY, hangarIndexFingerprint, installHangarSearch } from '../src/content/hangar-search.ts';
import { hangarPageHtml } from './fixtures/hangar-pages.mjs';

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map(); this.parentElement = null; this.value = '';
    this.isConnected = true; this.hidden = false;
    this.attributes = new Map(); this.classes = new Set(); this.classList = {
      add: value => this.classes.add(value), remove: value => this.classes.delete(value),
      contains: value => this.classes.has(value), toggle: (value, force) => {
        const add = force ?? !this.classes.has(value); add ? this.classes.add(value) : this.classes.delete(value); return add;
      },
    };
  }
  append(...children) { for (const child of children) { const previous = child.parentElement; const index = previous?.children?.indexOf(child) ?? -1; if (index >= 0) previous.children.splice(index, 1); child.parentElement = this; this.children.push(child); } }
  insertBefore(child, reference) {
    const previous = child.parentElement; const oldIndex = previous?.children?.indexOf(child) ?? -1;
    if (oldIndex >= 0) previous.children.splice(oldIndex, 1);
    const index = reference ? this.children.indexOf(reference) : -1;
    child.parentElement = this;
    if (index < 0) this.children.push(child); else this.children.splice(index, 0, child);
    return child;
  }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  dispatch(name, event = {}) { this.listeners.get(name)?.({ ...event, target: this, preventDefault() { this.defaultPrevented = true; } }); }
  contains(target) { return target === this || this.children.some(child => child.contains?.(target)); }
  get childElementCount() { return this.children.filter(child => child.tagName !== '#COMMENT').length; }
  remove() { const index = this.parentElement?.children?.indexOf(this) ?? -1; if (index >= 0) this.parentElement.children.splice(index, 1); this.parentElement = null; this.isConnected = false; this.removed = true; }
  after(element) { this.afterElement = element; if (this.parentElement) this.parentElement.afterElement = element; element.parentElement = this.parentElement; }
  before(element) { if (!this.parentElement) return; const previous = element.parentElement; const oldIndex = previous?.children?.indexOf(element) ?? -1; if (oldIndex >= 0) previous.children.splice(oldIndex, 1); const index = this.parentElement.children.indexOf(this); this.parentElement.children.splice(index, 0, element); element.parentElement = this.parentElement; }
  focus() {}
  click() {}
  set textContent(value) { this._textContent = value; }
  get textContent() { return this._textContent || this.children.map(child => child.textContent || '').join(''); }
}

function pledgeRow(id, title, details = `Contains: ${title}`) {
  const classes = new Set();
  return {
    id: '', classes, classList: {
      add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value),
      toggle: (value, force) => { const add = force ?? !classes.has(value); add ? classes.add(value) : classes.delete(value); return add; },
    },
    querySelector(selector) {
      if (selector === '.js-pledge-id') return { value: id };
      if (selector === 'h3') return { textContent: title, childNodes: [{ nodeType: 3, textContent: title }], querySelector: () => null };
      if (selector === '.items-col' || selector === '.more') return { textContent: details };
      return null;
    }, scrollIntoView() {},
  };
}

function parsedPage(html) {
  const id = html.match(/class="js-pledge-id" value="(\d+)"/)?.[1] || '';
  const titleMarkup = html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/)?.[1] || '';
  const title = titleMarkup.replace(/<[^>]*>/g, '').trim();
  const rows = id === '1501' ? Array.from({ length: 51 }, (_, index) => pledgeRow(String(1501 + index), title, 'Contains: RSI Disc. Galactic Tour Reward and Gladius paint')) : [pledgeRow(id, title)];
  const links = [...html.matchAll(/href="(\?page=\d+)"/g)].map(match => match[1]);
  return {
    querySelector: selector => selector === '#billing.pledges .list-items' ? {} : null,
    querySelectorAll(selector) {
      if (selector === '#billing.pledges .list-items .row') return rows;
      if (selector === 'a[href]') return links.map(href => ({ getAttribute: name => name === 'href' ? href : null }));
      return [];
    },
  };
}

test('My Hangar search and preload controls use the separate mockup-style toolbar', () => {
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [pledgeRow('5499', 'Starter pledge')]);
  installHangarSearch(() => true, harness.win, harness.doc)();
  const panel = harness.host.afterElement;
  assert.equal(panel.className, 'rsi-hangar-search-panel');
  const [input, results, tools, status, filters, sortSlot] = panel.children;
  assert.equal(input.className, 'rsi-hangar-search');
  assert.equal(input.placeholder, 'Search ships, items, pledge names or IDs…');
  assert.equal(results.className, 'rsi-hangar-search-results');
  assert.equal(tools.children[0].textContent, 'Filters, pledge details & export');
  assert.equal(filters.children[0].textContent, 'Filters');
  assert.equal(filters.children[1].children[0].className, 'rsi-hangar-filter-slot');
  assert.equal(sortSlot.className, 'rsi-hangar-search-sort-slot');
  assert.equal(status.children[1].textContent, 'Refresh');
});

test('a valid local Hangar index makes cross-page search immediate without another crawl', async () => {
  const row = pledgeRow('5501', 'RSI Disc Cached Reward', 'Contains: RSI Disc paint');
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges?page=1', [row]);
  const cachedRecord = normalizeHangarPledge({
    id: '5501', title: 'RSI Disc Cached Reward', basePledge: 'RSI Disc Cached Reward',
    details: 'Contains: RSI Disc paint', page: 'https://robertsspaceindustries.com/en/account/pledges',
  });
  const fingerprint = hangarIndexFingerprint([cachedRecord], 1);
  const cache = createHangarCache([cachedRecord], fingerprint, Date.now(), 1);
  harness.win.chrome = { storage: { local: { get: async () => ({ [HANGAR_INDEX_STORAGE_KEY]: cache }), set: async () => {} } } };
  const refresh = installHangarSearch(() => true, harness.win, harness.doc); refresh();
  const [input, results] = harness.host.afterElement.children;
  input.value = 'RSI Disc'; input.dispatch('input');
  for (let attempt = 0; attempt < 40 && !results.children.find(child => child.tagName === 'A'); attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(results.children.filter(child => child.tagName === 'A').length, 1);
  assert.match(results.children.find(child => child.tagName === 'A').textContent, /Pledge 5501/);
  assert.equal(results.children.find(child => child.tagName === 'A').href, 'https://robertsspaceindustries.com/en/account/pledges#rsi-pledge-5501');
  assert.deepEqual(harness.fetched, [], 'a matching fingerprint avoids another multi-page fetch');
});

test('advanced Hangar type filters narrow the shared pledge index', async () => {
  const paint = pledgeRow('5701', 'Gladius - Foundation Paint');
  const ship = pledgeRow('5702', 'Aurora MR');
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [paint, ship]);
  const refresh = installHangarSearch(() => true, harness.win, harness.doc); refresh();
  const [input, results, tools] = harness.host.afterElement.children;
  assert.equal(tools.children[0].textContent, 'Filters, pledge details & export');
  const typeFilter = tools.children[1].children[0].children[0];
  typeFilter.value = 'paint'; typeFilter.dispatch('change');
  await new Promise(resolve => setTimeout(resolve, 0));
  const hits = results.children.filter(child => child.tagName === 'A');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].href, 'https://robertsspaceindustries.com/en/account/pledges#rsi-pledge-5701');
});

test('Hangar pages are indexed only after the user searches, then cached locally', async () => {
  const current = pledgeRow('5601', 'Current Hangar pledge');
  const later = pledgeRow('5602', 'Second page pledge');
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [current]);
  harness.doc.querySelectorAll = selector => selector === '#billing.pledges .list-items .row' ? [current]
    : selector === 'a[href]' ? [{ getAttribute: () => '?page=2' }] : [];
  let saved = null;
  harness.win.chrome = { storage: { local: {
    get: async () => ({}),
    set: async items => { saved = items[HANGAR_INDEX_STORAGE_KEY]; },
    remove: async () => {},
  } } };
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString() { return {
    querySelector: () => ({}),
    querySelectorAll: selector => selector === '#billing.pledges .list-items .row' ? [later] : [],
  }; } };
  let enabled = true;
  try {
    const refresh = installHangarSearch(() => enabled, harness.win, harness.doc); refresh();
    await new Promise(resolve => setTimeout(resolve, 1_600));
    assert.deepEqual(harness.fetched, [], 'an idle visit does not crawl authenticated Hangar pages');
    assert.equal(saved, null, 'an idle visit does not persist Hangar details');
    const [input] = harness.host.afterElement.children;
    input.value = 'Second page'; input.dispatch('input');
    for (let attempt = 0; attempt < 80 && !saved; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(harness.fetched, ['https://robertsspaceindustries.com/en/account/pledges?page=2']);
    assert.equal(saved?.pageCount, 2);
    assert.deepEqual(saved?.records.map(record => record.id).sort(), ['5601', '5602']);
  } finally {
    enabled = false;
    if (previousParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = previousParser;
  }
});

test('expired Hangar cache is removed when a user-triggered index checks it', async () => {
  const row = pledgeRow('5501', 'RSI Disc Cached Reward', 'Contains: RSI Disc paint');
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges?page=1', [row]);
  const cachedRecord = normalizeHangarPledge({
    id: '5501', title: 'RSI Disc Cached Reward', basePledge: 'RSI Disc Cached Reward',
    details: 'Contains: RSI Disc paint', page: 'https://robertsspaceindustries.com/en/account/pledges',
  });
  const fingerprint = hangarIndexFingerprint([cachedRecord], 1);
  const cache = createHangarCache([cachedRecord], fingerprint, Date.now() - HANGAR_CACHE_TTL_MS - 1, 1);
  const removed = [];
  harness.win.chrome = { storage: { local: {
    get: async () => ({ [HANGAR_INDEX_STORAGE_KEY]: cache }), set: async () => {},
    remove: async key => { removed.push(key); },
  } } };
  const refresh = installHangarSearch(() => true, harness.win, harness.doc); refresh();
  const [input] = harness.host.afterElement.children;
  input.value = 'RSI Disc'; input.dispatch('input');
  for (let attempt = 0; attempt < 40 && !removed.length; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.deepEqual(removed, [HANGAR_INDEX_STORAGE_KEY]);
});

test('all-page search returns every RSI Disc match and Ship Paint selection persists and resets correctly', async () => {
  const source = await readFile(new URL('./fixtures/hangar.html', import.meta.url), 'utf8');
  let liveRows = [
    pledgeRow('101', 'Package - Aurora MR Starter Pack', 'Contains: Gladius - Foundation Festival Paint'),
    pledgeRow('102', 'Aurora Mk I ES'),
  ];
  const root = new Element();
  const uiHost = new Element();
  const top = { querySelectorAll: () => [{ textContent: 'Ship upgrades', parentElement: uiHost, after(element) { uiHost.afterElement = element; element.parentElement = uiHost; } }] };
  const nativeFilter = { options: [{ value: '/en/account/pledges' }], value: '/en/account/pledges' };
  const listeners = new Map();
  const doc = {
    readyState: 'complete',
    querySelector(selector) {
      if (selector === '#billing.pledges .inner-content > .top') return top;
      if (selector === '#billing.pledges') return root;
      if (selector === '#billing.pledges select.rsi-hangar-filter') return nativeFilter;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#billing.pledges .list-items .row') return liveRows;
      if (selector === 'a[href]') return [{ getAttribute: () => '/account/pledges?page=2' }];
      return [];
    },
    createElement: tag => new Element(tag),
    getElementById: id => liveRows.find(row => row.id === id) || null,
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    dispatchEvent(event) { listeners.get(event.type)?.(event); return true; },
  };
  const fetched = [], session = new Map();
  const win = {
    location: { href: 'https://robertsspaceindustries.com/en/account/pledges', pathname: '/en/account/pledges', search: '', hash: '' },
    addEventListener() {},
    sessionStorage: {
      getItem: key => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, value),
      removeItem: key => session.delete(key),
    },
    async fetch(url) {
      fetched.push(url);
      const page = new URL(url).searchParams.get('page') || '1';
      if (page === '1') throw new Error('The current page is already available in the live DOM');
      let html = source;
      if (page === '1') html = source.replace(/href="\?page=\d+"/g, 'href="?page=2"');
      if (page === '2') html = source.replace('value="101"', 'value="201"').replace(/href="\?page=\d+"/g, 'href="?page=15"');
      if (page === '15') html = hangarPageHtml(source, 15).replace(/href="\?page=\d+"/g, 'href="?page=15"');
      return { ok: true, url, text: async () => html };
    },
  };
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(html) { return parsedPage(html); } };
  try {
    let enabled = true;
    const refresh = installHangarSearch(() => enabled, win, doc);
    refresh();
    const ui = uiHost.afterElement, [input, results] = ui.children;
    input.value = 'RSI Disc';
    input.dispatch('input');
    for (let attempt = 0; attempt < 150 && !results.children[0]?.textContent?.includes('across 15 Hangar pages'); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    assert.deepEqual(fetched.map(url => Number(new URL(url).searchParams.get('page'))).sort((a, b) => a - b), Array.from({ length: 14 }, (_, index) => index + 2), 'the crawl should use current-page DOM and fetch every page advertised by the pager');
    const result = results.children.find(child => child.tagName === 'A');
    assert.ok(result, 'the matching pledge from another page is rendered');
    assert.equal(results.children.filter(child => child.tagName === 'A').length, 51, 'search renders every matching pledge');
    assert.equal(result.href, 'https://robertsspaceindustries.com/en/account/pledges?page=15#rsi-pledge-1501');
    assert.match(result.textContent, /Gladius - Foundation Festival Paint/);
    assert.equal(results.hidden, false);

    doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: SHIP_PAINT_FILTER_VALUE } });
    assert.equal(session.get(HANGAR_SHIP_PAINT_SESSION_KEY), '1', 'Ship Paint selection survives native page navigation');
    assert.equal(results.hidden, false, 'the independent text search remains available');

    input.dispatch('keydown', { key: 'Escape' });
    assert.equal(results.hidden, true, 'Escape only closes the text-search results');
    input.dispatch('focus');
    ui.dispatch('focusout', { relatedTarget: new Element('button') });
    assert.equal(results.hidden, true, 'leaving search closes its results');

    input.value = '';
    input.dispatch('input');
    doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: '/en/account/pledges' } });
    assert.equal(session.has(HANGAR_SHIP_PAINT_SESSION_KEY), false, 'choosing a native category clears the page-persistent filter');
    assert.equal(nativeFilter.value, '/en/account/pledges');

    doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: SHIP_PAINT_FILTER_VALUE } });
    win.location.search = '?page=2';
    win.location.href = `https://robertsspaceindustries.com/en/account/pledges${win.location.search}`;
    liveRows = [
      pledgeRow('201', 'Aurora - Polar Paint'),
      pledgeRow('202', 'Package - Scout Starter Pack', 'Contains: Armor and game access'),
    ];
    refresh();
    assert.equal(session.get(HANGAR_SHIP_PAINT_SESSION_KEY), '1', 'Ship Paint remains selected after moving to another native page');

    await new Promise(resolve => setTimeout(resolve, 0));
    enabled = false; refresh();
    assert.equal(ui.removed, true);
    assert.equal(session.has(HANGAR_SHIP_PAINT_SESSION_KEY), false, 'disabling Hangar clears the temporary filter selection');
    assert.equal(liveRows[0].id, '', 'search target IDs are restored');
  } finally {
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test('search continues through other pagination links when one page request fails twice', async () => {
  const source = await readFile(new URL('./fixtures/hangar.html', import.meta.url), 'utf8');
  const host = new Element(), liveRows = [pledgeRow('100', 'RSI Disc Current Reward')];
  const top = { querySelectorAll: () => [{ textContent: 'Ship upgrades', parentElement: host, after(element) { host.afterElement = element; element.parentElement = host; } }] };
  const doc = {
    readyState: 'complete',
    querySelector: selector => selector === '#billing.pledges .inner-content > .top' ? top : selector === '#billing.pledges' ? new Element() : null,
    querySelectorAll(selector) {
      if (selector === '#billing.pledges .list-items .row') return liveRows;
      if (selector === 'a[href]') return ['?page=2', '?page=15'].map(href => ({ getAttribute: () => href }));
      return [];
    },
    createElement: tag => new Element(tag),
    getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  const fetched = [];
  const win = {
    location: { href: 'https://robertsspaceindustries.com/en/account/pledges', pathname: '/en/account/pledges', search: '', hash: '' },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {},
    async fetch(url) {
      fetched.push(new URL(url).searchParams.get('page'));
      if (url.includes('page=2')) return { ok: false, status: 503, url, text: async () => '' };
      return { ok: true, url, text: async () => hangarPageHtml(source, 15).replace(/href="\?page=\d+"/g, 'href="?page=15"') };
    },
  };
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(html) { return parsedPage(html); } };
  try {
    const refresh = installHangarSearch(() => true, win, doc);
    refresh();
    const [input, results] = host.afterElement.children;
    input.value = 'Gladius paint'; input.dispatch('input');
    for (let attempt = 0; attempt < 100 && results.children.filter(child => child.tagName === 'A').length < 51; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.deepEqual(fetched.map(page => Number(page)).sort((a, b) => a - b), [2, 2, ...Array.from({ length: 13 }, (_, index) => index + 3)]);
    assert.equal(results.children.filter(child => child.tagName === 'A').length, 51);
    assert.match(results.children[0].textContent, /Some pages could not be searched/);
    assert.match(results.children[0].textContent, /page 2: Hangar page returned 503/);
  } finally {
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test('search retries a temporarily unavailable page and completes without a partial-results warning', async () => {
  const source = await readFile(new URL('./fixtures/hangar.html', import.meta.url), 'utf8');
  const host = new Element(), liveRows = [pledgeRow('100', 'Current Hangar item')];
  const top = { querySelectorAll: () => [{ textContent: 'Ship upgrades', parentElement: host, after(element) { host.afterElement = element; element.parentElement = host; } }] };
  const doc = {
    readyState: 'complete',
    querySelector: selector => selector === '#billing.pledges .inner-content > .top' ? top : selector === '#billing.pledges' ? new Element() : null,
    querySelectorAll(selector) {
      if (selector === '#billing.pledges .list-items .row') return liveRows;
      if (selector === 'a[href]') return ['?page=2', '?page=15'].map(href => ({ getAttribute: () => href }));
      return [];
    },
    createElement: tag => new Element(tag),
    getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  const fetched = [], attempts = new Map();
  const win = {
    location: { href: 'https://robertsspaceindustries.com/en/account/pledges', pathname: '/en/account/pledges', search: '', hash: '' },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    addEventListener() {},
    async fetch(url) {
      const page = new URL(url).searchParams.get('page');
      fetched.push(page);
      attempts.set(page, (attempts.get(page) || 0) + 1);
      if (page === '2' && attempts.get(page) === 1) return { ok: false, status: 503, url, text: async () => '' };
      const html = page === '15'
        ? hangarPageHtml(source, 15).replace(/href="\?page=\d+"/g, 'href="?page=15"')
        : source.replace(/href="\?page=\d+"/g, 'href="?page=15"');
      return { ok: true, status: 200, url, text: async () => html };
    },
  };
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(html) { return parsedPage(html); } };
  try {
    const refresh = installHangarSearch(() => true, win, doc);
    refresh();
    const [input, results] = host.afterElement.children;
    input.value = 'Gladius paint'; input.dispatch('input');
    for (let attempt = 0; attempt < 150 && !results.children[0]?.textContent?.includes('across'); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.deepEqual(fetched.map(page => Number(page)).sort((a, b) => a - b), [2, 2, ...Array.from({ length: 13 }, (_, index) => index + 3)]);
    assert.equal(results.children.filter(child => child.tagName === 'A').length, 51);
    assert.match(results.children[0].textContent, /across 15 Hangar pages/);
    assert.doesNotMatch(results.children[0].textContent, /could not be searched/);
  } finally {
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test('Ship Paint combines native pages into full filtered pages and restores native rows', async () => {
  const host = new Element(), list = new Element('ul'), nativePager = new Element('div');
  const liveRows = [
    pledgeRow('101', 'Gladius - Aurora Paint'), pledgeRow('103', 'Arrow - Polar Paint'),
  ];
  list.append(...liveRows);
  let paintPager = null;
  list.before = element => {
    if (element.className === 'rsi-hangar-page-pagination') paintPager = element;
    element.parentElement = list.parentElement;
  };
  const top = { querySelectorAll: () => [{ textContent: 'Ship upgrades', parentElement: host, after(element) { host.afterElement = element; element.parentElement = host; } }] };
  const doc = {
    readyState: 'complete',
    querySelector(selector) {
      if (selector === '#billing.pledges .inner-content > .top') return top;
      if (selector === '#billing.pledges') return new Element();
      if (selector === '#billing.pledges .list-items') return list;
      if (selector === '#billing.pledges .pager') return nativePager;
      if (selector === '#billing.pledges select.rsi-hangar-filter') return { options: [{ value: '/en/account/pledges' }], value: '/en/account/pledges' };
      if (selector === '.rsi-hangar-page-pagination') return paintPager;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '#billing.pledges .list-items .row') return list.children;
      if (selector === '#billing.pledges .pager') return [nativePager];
      if (selector === 'a[href]') return [{ getAttribute: () => '/account/pledges?page=2' }];
      return [];
    },
    createElement: tag => new Element(tag),
    getElementById: id => list.children.find(row => row.id === id) || null,
    addEventListener() {}, removeEventListener() {},
    dispatchEvent(event) { if (event.type === HANGAR_FILTER_CHANGE_EVENT) filterListener?.(event); },
  };
  const session = new Map();
  const win = {
    location: { href: 'https://robertsspaceindustries.com/en/account/pledges', pathname: '/en/account/pledges', search: '', hash: '' },
    sessionStorage: { getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value), removeItem: key => session.delete(key) },
    addEventListener() {},
    async fetch(url) { return { ok: true, url, text: async () => 'page-two' }; },
  };
  const pageTwoRows = [
    pledgeRow('201', 'F7C - Storm Paint'), pledgeRow('202', 'Constellation - Blue Paint'),
    pledgeRow('203', 'Gladius - Foundation Paint'), pledgeRow('204', 'Package - Aurora Starter Pack', 'Contains: Aurora - Valentine Paint'),
    pledgeRow('205', 'Arrow - Ember Paint'),
  ];
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString() {
    return { querySelector: () => ({}), querySelectorAll(selector) {
      if (selector === '#billing.pledges .list-items .row') return pageTwoRows;
      if (selector === '.pager a[href]') return [];
      return [];
    } };
  } };
  let filterListener;
  const originalAdd = doc.addEventListener;
  doc.addEventListener = (name, callback) => { if (name === HANGAR_FILTER_CHANGE_EVENT) filterListener = callback; else originalAdd(name, callback); };
  try {
    const enhancedPages = [];
    const refresh = installHangarSearch(() => true, win, doc, () => enhancedPages.push([...list.children]));
    refresh();
    const [searchInput, searchResults] = host.afterElement.children;
    doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: SHIP_PAINT_FILTER_VALUE } });
    for (let attempt = 0; attempt < 100 && (!paintPager || paintPager.children.length < 3); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10));
      paintPager = doc.querySelector('.rsi-hangar-page-pagination');
    }

    assert.equal(list.children.length, 5, 'the first filtered page uses the fullest native page size, not the current partial page');
    assert.deepEqual(list.children.map(row => row.querySelector('h3').textContent), [
      'Gladius - Aurora Paint', 'Arrow - Polar Paint', 'F7C - Storm Paint', 'Constellation - Blue Paint', 'Gladius - Foundation Paint',
    ]);
    assert.match(paintPager.children[1].textContent, /Showing 1–5 of 7/);
    assert.deepEqual(enhancedPages.at(-1), list.children, 'fetched cards are enhanced after they enter the displayed page');
    assert.equal(nativePager.classList.contains('rsi-hangar-native-pager-hidden'), true);
    refresh();
    searchInput.value = 'Foundation'; searchInput.dispatch('input');
    const sourcePageResult = searchResults.children.find(child => child.tagName === 'A');
    assert.equal(sourcePageResult.href, 'https://robertsspaceindustries.com/en/account/pledges?page=2#rsi-pledge-203', 'refreshing the combined list does not rewrite a card source page');
    paintPager.children[2].dispatch('click');
    assert.equal(list.children.length, 2, 'the final page shows only remaining matches');
    assert.deepEqual(enhancedPages.at(-1), list.children, 'changing paint pages refreshes the newly displayed cards');
    assert.deepEqual(list.children.map(row => row.querySelector('h3').textContent), ['Package - Aurora Starter Pack', 'Arrow - Ember Paint']);

    doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: '/en/account/pledges' } });
    assert.deepEqual(list.children, liveRows, 'leaving Ship Paint restores the original native page');
    assert.equal(nativePager.classList.contains('rsi-hangar-native-pager-hidden'), false);
    assert.equal(paintPager.removed, true, 'the temporary filtered pager is removed');
  } finally {
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test('page-size selection combines every Hangar page, supports All, and restores native paging', async () => {
  const liveRows = [pledgeRow('100', 'Current pledge one'), pledgeRow('101', 'Current pledge two')];
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', liveRows);
  const nativePager = new Element('nav'), addedControls = [];
  const indexStates = [], nativeDispatch = harness.doc.dispatchEvent.bind(harness.doc);
  harness.doc.dispatchEvent = event => {
    if (event.type === 'rsi-hangar-index-status') indexStates.push(event.detail);
    return nativeDispatch(event);
  };
  const originalListBefore = harness.list.before.bind(harness.list);
  harness.list.before = element => { addedControls.push(element); originalListBefore(element); };
  let listRenderCount = 0;
  const originalReplaceChildren = harness.list.replaceChildren.bind(harness.list);
  harness.list.replaceChildren = (...children) => { listRenderCount++; originalReplaceChildren(...children); };
  harness.doc.querySelectorAll = selector => selector === '#billing.pledges .list-items .row' ? liveRows
    : selector === 'a[href]' ? [{ getAttribute: () => '?page=2' }]
      : selector === '#billing.pledges .pager' ? [nativePager] : [];
  harness.win.fetch = async url => { harness.fetched.push(url); return { ok: true, url, text: async () => 'page-two' }; };
  const laterRows = Array.from({ length: 20 }, (_, index) => pledgeRow(String(200 + index), index === 0 ? 'Aardvark from later page' : `Later pledge ${index + 1}`));
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString() { return {
    querySelector: selector => selector === '#billing.pledges .list-items' ? {} : null,
    querySelectorAll: selector => selector === '#billing.pledges .list-items .row' ? laterRows : [],
  }; } };
  try {
    const refresh = installHangarSearch(() => true, harness.win, harness.doc); refresh();
    const preloadStatus = harness.host.afterElement.children[3];
    assert.equal(harness.list.children.length, 2, 'the existing native page remains unchanged by default');

    harness.doc.dispatchEvent({ type: 'rsi-hangar-page-size-change', detail: { pageSize: '18' } });
    for (let attempt = 0; attempt < 80 && harness.list.children.length !== 18; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(harness.fetched, ['https://robertsspaceindustries.com/en/account/pledges?page=2']);
    assert.equal(harness.list.children.length, 18, '18-item mode combines native cards from every page');
    assert.equal(listRenderCount, 2, 'the initial page and completed full-page load render once each instead of repainting during the fetch');
    assert.match(preloadStatus.textContent, /All 2 Hangar pages indexed · 22 items/);
    assert.ok(indexStates.some(state => state.state === 'ready' && state.itemCount === 22 && state.pageCount === 2), 'the My Gear heading receives the completed all-page count');
    assert.equal(nativePager.classList.contains('rsi-hangar-native-pager-hidden'), true);
    const customPager = addedControls.filter(element => element.className === 'rsi-hangar-page-pagination').at(-1);
    assert.match(customPager.children[1].textContent, /Showing 1–18 of 22/);

    harness.doc.dispatchEvent({ type: 'rsi-hangar-sort-change', detail: { sort: 'name' } });
    assert.equal(harness.list.children[0].querySelector('h3').textContent, 'Aardvark from later page', 'sorting includes cards from later Hangar pages');
    harness.doc.dispatchEvent({ type: 'rsi-hangar-sort-change', detail: { sort: 'default' } });
    assert.equal(harness.list.children[0].querySelector('h3').textContent, 'Current pledge one', 'default order returns cards to their native page sequence');

    harness.doc.dispatchEvent({ type: 'rsi-hangar-page-size-change', detail: { pageSize: 'all' } });
    assert.equal(harness.list.children.length, 22, 'All displays the full combined Hangar');
    assert.equal(customPager.removed, true, 'All hides extension pagination');

    harness.doc.dispatchEvent({ type: 'rsi-hangar-page-size-change', detail: { pageSize: '9' } });
    assert.deepEqual(harness.list.children, liveRows, 'returning to 9 restores the current native page');
    assert.equal(nativePager.classList.contains('rsi-hangar-native-pager-hidden'), false);
  } finally {
    if (previousParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = previousParser;
  }
});

test('All items renders large card sets in small frames without blocking the page', async () => {
  const rows = Array.from({ length: 40 }, (_, index) => pledgeRow(String(800 + index), `Hangar item ${index + 1}`));
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', rows);
  const frames = [];
  harness.win.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  const refresh = installHangarSearch(() => true, harness.win, harness.doc); refresh();

  harness.doc.dispatchEvent({ type: 'rsi-hangar-page-size-change', detail: { pageSize: 'all' } });
  assert.ok(harness.list.children.length <= 24, 'the first paint inserts no more than one small batch');
  await new Promise(resolve => setTimeout(resolve, 0));
  for (let attempt = 0; attempt < 10 && harness.list.children.length < rows.length; attempt++) frames.shift()?.(Date.now());
  assert.equal(harness.list.children.length, rows.length, 'later frames finish the complete all-items list');
});

test('an existing Hangar index fetches native cards when a larger page size is selected', async () => {
  const live = pledgeRow('6101', 'Current cached item');
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [live]);
  harness.doc.querySelectorAll = selector => selector === '#billing.pledges .list-items .row' ? [live]
    : selector === 'a[href]' ? [{ getAttribute: () => '?page=2' }] : [];
  const currentRecord = normalizeHangarPledge({ id: '6101', title: 'Current cached item', basePledge: 'Current cached item', details: 'Contains: Current cached item', page: 'https://robertsspaceindustries.com/en/account/pledges' });
  const laterRecord = normalizeHangarPledge({ id: '6102', title: 'Cached later item', basePledge: 'Cached later item', details: 'Contains: Cached later item', page: 'https://robertsspaceindustries.com/en/account/pledges?page=2' });
  const fingerprint = hangarIndexFingerprint([currentRecord], 2);
  const cache = createHangarCache([currentRecord, laterRecord], fingerprint, Date.now(), 2);
  harness.win.chrome = { storage: { local: { get: async () => ({ [HANGAR_INDEX_STORAGE_KEY]: cache }), set: async () => {} } } };
  const later = pledgeRow('6102', 'Cached later item');
  harness.win.fetch = async url => { harness.fetched.push(url); return { ok: true, url, text: async () => 'page-two' }; };
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString() { return {
    querySelector: selector => selector === '#billing.pledges .list-items' ? {} : null,
    querySelectorAll: selector => selector === '#billing.pledges .list-items .row' ? [later] : [],
  }; } };
  try {
    const refresh = installHangarSearch(() => true, harness.win, harness.doc); refresh();
    const [input] = harness.host.afterElement.children;
    input.value = 'Current cached'; input.dispatch('input');
    for (let attempt = 0; attempt < 50 && !harness.host.afterElement.children[1].children[0]?.textContent?.includes('across 2 Hangar pages'); attempt++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(harness.fetched, [], 'the warm metadata index serves search without a page fetch');

    harness.doc.dispatchEvent({ type: 'rsi-hangar-page-size-change', detail: { pageSize: '18' } });
    for (let attempt = 0; attempt < 50 && harness.list.children.length !== 2; attempt++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.deepEqual(harness.fetched, ['https://robertsspaceindustries.com/en/account/pledges?page=2']);
    assert.deepEqual(harness.list.children, [live, later], 'the expanded view contains original native cards from the cached pages');
  } finally {
    if (previousParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = previousParser;
  }
});

test('search follows every page exposed by RSI locale-less Hangar pagination', async () => {
  const host = new Element(), liveRows = [pledgeRow('1001', 'RSI Disc first-page reward')];
  const top = { querySelectorAll: () => [{ textContent: 'Ship upgrades', parentElement: host, after(element) { host.afterElement = element; element.parentElement = host; } }] };
  const nativePagerHrefs = [
    '/account/pledges?page=1', '/account/pledges?page=2', '/account/pledges?page=3',
    '/account/pledges?page=2', '/account/pledges?page=22',
  ];
  const doc = {
    readyState: 'complete',
    querySelector: selector => selector === '#billing.pledges .inner-content > .top' ? top : selector === '#billing.pledges' ? new Element() : null,
    querySelectorAll(selector) {
      if (selector === '#billing.pledges .list-items .row') return liveRows;
      if (selector === '.pager a[href]') return [];
      if (selector === 'a[href]') return nativePagerHrefs.map(href => ({ getAttribute: name => name === 'href' ? href : null }));
      return [];
    },
    createElement: tag => new Element(tag), getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  const fetched = [];
  const win = {
    location: { href: 'https://robertsspaceindustries.com/en/account/pledges', pathname: '/en/account/pledges', search: '', hash: '' },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {},
    async fetch(url) {
      fetched.push(url);
      const page = Number(new URL(url).searchParams.get('page'));
      return { ok: true, url, text: async () => `RSI-PAGE:${page}` };
    },
  };
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(html) {
    const page = Number(html.match(/RSI-PAGE:(\d+)/)?.[1]);
    const pageLinks = page <= 2 ? [1, 2, 3] : [1, page - 1, page, page + 1, 22];
    if (page < 22) pageLinks.push(page + 1); // Native next-page control.
    pageLinks.push(22); // Native last-page control.
    const links = [...new Set(pageLinks.filter(number => number >= 1 && number <= 22))]
      .map(number => `/account/pledges?page=${number}`);
    return {
      querySelector: () => ({}),
      querySelectorAll(selector) {
        if (selector === '#billing.pledges .list-items .row') return [pledgeRow(String(1000 + page), `RSI Disc reward on page ${page}`)];
        if (selector === 'a[href]') return links.map(href => ({ getAttribute: name => name === 'href' ? href : null }));
        return [];
      },
    };
  } };
  try {
    const refresh = installHangarSearch(() => true, win, doc); refresh();
    const [input, results] = host.afterElement.children;
    input.value = 'RSI Disc'; input.dispatch('input');
    for (let attempt = 0; attempt < 150 && !results.children[0]?.textContent?.includes('across 22 Hangar pages'); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const searchedPages = fetched.map(url => Number(new URL(url).searchParams.get('page'))).sort((a, b) => a - b);
    assert.deepEqual(searchedPages, Array.from({ length: 21 }, (_, index) => index + 2), 'search traverses the native next/last pager links through every account page');
    assert.equal(results.children.filter(child => child.tagName === 'A').length, 22, 'search includes current-page results and every remote page');
    assert.match(results.children[0].textContent, /22 matches across 22 Hangar pages/);
    const lastPageResult = results.children.find(child => child.tagName === 'A' && child.href.includes('#rsi-pledge-1022'));
    assert.equal(lastPageResult.href, 'https://robertsspaceindustries.com/en/account/pledges?page=22#rsi-pledge-1022', 'cross-page results stay on the localized account route');
  } finally {
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test('search enumerates every page up to RSI pager last-page link', async () => {
  const host = new Element(), liveRows = [pledgeRow('1001', 'RSI Disc first-page reward')];
  const top = { querySelectorAll: () => [{ textContent: 'Ship upgrades', parentElement: host, after(element) { host.afterElement = element; element.parentElement = host; } }] };
  // This matches RSI's pager: it exposes pages 1–3, next page 2, and a direct
  // last-page link to 22. Some responses do not expose a useful next-page chain.
  const pagerHrefs = [
    '/account/pledges?page=1', '/account/pledges?page=2', '/account/pledges?page=3',
    '/account/pledges?page=2', '/account/pledges?page=22',
  ];
  const doc = {
    readyState: 'complete',
    querySelector: selector => selector === '#billing.pledges .inner-content > .top' ? top : selector === '#billing.pledges' ? new Element() : null,
    querySelectorAll(selector) {
      if (selector === '#billing.pledges .list-items .row') return liveRows;
      if (selector === 'a[href]') return pagerHrefs.map(href => ({ getAttribute: name => name === 'href' ? href : null }));
      return [];
    },
    createElement: tag => new Element(tag), getElementById: () => null,
    addEventListener() {}, removeEventListener() {},
  };
  const fetched = [];
  const win = {
    location: { href: 'https://robertsspaceindustries.com/en/account/pledges', pathname: '/en/account/pledges', search: '', hash: '' },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {},
    async fetch(url) {
      fetched.push(url);
      const page = Number(new URL(url).searchParams.get('page')) || 1;
      return { ok: true, url, text: async () => `RSI-PAGE:${page}` };
    },
  };
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(html) {
    const page = Number(html.match(/RSI-PAGE:(\d+)/)?.[1]);
    return {
      querySelector: () => ({}),
      querySelectorAll(selector) {
        if (selector === '#billing.pledges .list-items .row') return [pledgeRow(String(1000 + page), `RSI Disc reward on page ${page}`)];
        if (selector === 'a[href]') return pagerHrefs.map(href => ({ getAttribute: name => name === 'href' ? href : null }));
        return [];
      },
    };
  } };
  try {
    const refresh = installHangarSearch(() => true, win, doc); refresh();
    const [input, results] = host.afterElement.children;
    input.value = 'RSI Disc'; input.dispatch('input');
    for (let attempt = 0; attempt < 150 && !results.children[0]?.textContent?.includes('across 22 Hangar pages'); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const searchedPages = fetched.map(url => Number(new URL(url).searchParams.get('page'))).sort((a, b) => a - b);
    assert.deepEqual(searchedPages, Array.from({ length: 21 }, (_, index) => index + 2));
    assert.equal(results.children.filter(child => child.tagName === 'A').length, 22);
    assert.match(results.children[0].textContent, /22 matches across 22 Hangar pages/);
  } finally {
    if (previousParser === undefined) delete globalThis.DOMParser;
    else globalThis.DOMParser = previousParser;
  }
});

test('search reports why the current Hangar URL cannot be indexed', async () => {
  const host = new Element(), top = { querySelectorAll: () => [{ textContent: 'Ship upgrades', parentElement: host, after(element) { host.afterElement = element; element.parentElement = host; } }] };
  const doc = {
    readyState: 'complete',
    querySelector: selector => selector === '#billing.pledges .inner-content > .top' ? top : selector === '#billing.pledges' ? new Element() : null,
    querySelectorAll: selector => selector === '#billing.pledges .list-items .row' || selector === 'a[href]' ? [] : [],
    createElement: tag => new Element(tag), addEventListener() {}, removeEventListener() {},
  };
  const win = {
    location: { href: 'https://robertsspaceindustries.com/en/account/pledges?page=1&sort=name', pathname: '/en/account/pledges', search: '?page=1&sort=name', hash: '' },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {},
    fetch: async () => { throw new Error('No page should be fetched from an unsupported URL'); },
  };
  const refresh = installHangarSearch(() => true, win, doc); refresh();
  const [input, results] = host.afterElement.children;
  input.value = 'RSI Disc'; input.dispatch('input');
  for (let attempt = 0; attempt < 60 && !results.children[0]?.textContent?.includes('Current URL is not a plain Hangar page'); attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.match(results.children[0].textContent, /page 1: Current URL is not a plain Hangar page/);
  assert.doesNotMatch(results.children[0].textContent, /could not be searched \(\)/);
});

function integrationHarness(href, liveRows, dashboardButton = null, upgradeOutsideHeader = false, upgradeOutsideInnerContent = false, nativeTopActions = false) {
  const host = new Element(), list = new Element('ul'), listeners = new Map();
  const actions = new Element('div'), layoutRoot = new Element('div');
  const hangarLog = new Element('a'); hangarLog.textContent = 'Hangar log';
  hangarLog.classList.add('pledge-log'); hangarLog.classList.add('js-pledge-log'); hangarLog.classList.add('shadow-button');
  const actionWrapper = new Element('div'), outerHost = new Element('div');
  const upgradeAction = new Element('a'); upgradeAction.textContent = 'Ship upgrades';
  upgradeAction.setAttribute('data-apiurl', '/pledge-store/api/upgrade/v2');
  upgradeAction.classList.add('ship-upgrade'); upgradeAction.classList.add('js-open-ship-upgrades'); upgradeAction.classList.add('shadow-button');
  const upgradeCandidates = [upgradeAction];
  upgradeAction.after = element => { host.afterElement = element; element.parentElement = host; };
  const title = new Element('h2'); title.textContent = 'MY HANGAR'; title.classList.add('title');
  const description = new Element('p'); description.textContent = 'View and manage your pledges and their associated items.';
  const top = new Element('header');
  top.append = (...children) => {
    Element.prototype.append.apply(top, children);
    if (children.some(child => child.className === 'rsi-hangar-search-panel')) host.afterElement = children.find(child => child.className === 'rsi-hangar-search-panel');
  };
  if (nativeTopActions) {
    top.append(title, hangarLog, upgradeAction, description);
  } else {
    actions.classList.add('actions');
    actions.append(hangarLog);
    if (!upgradeOutsideHeader) actions.append(actionWrapper);
    actionWrapper.append(upgradeAction);
    top.append(title, actions, description);
  }
  host.append(list);
  if (upgradeOutsideHeader && upgradeOutsideInnerContent) outerHost.append(actionWrapper);
  else if (upgradeOutsideHeader && !nativeTopActions) host.append(actionWrapper);
  list.append(...liveRows);
  top.querySelector = selector => selector === '.actions' ? top.children.find(child => child.classList.contains('actions')) || null : selector === 'p' ? description : null;
  top.querySelectorAll = selector => selector === 'a, button' ? [hangarLog, upgradeAction].filter(element => element.parentElement) : [];
  const innerContent = { querySelectorAll: selector => selector === 'a' && !upgradeOutsideInnerContent ? upgradeCandidates : [] };
  const billingScope = { querySelectorAll: selector => selector === 'a' && !upgradeOutsideInnerContent ? upgradeCandidates : [] };
  const doc = {
    readyState: 'complete',
    querySelector: selector => selector === '#billing.pledges' ? billingScope : selector === '#billing.pledges .inner-content' ? innerContent : selector === '#billing.pledges .inner-content > .top' ? top : selector === '#billing.pledges .list-items' ? list : selector === '#contentbody.account-section' ? layoutRoot : null,
    querySelectorAll: selector => selector === 'a.ship-upgrade.js-open-ship-upgrades' ? upgradeCandidates : selector === '#billing.pledges .list-items .row' ? liveRows : selector === 'a, button' && dashboardButton ? [dashboardButton] : [],
    createElement: tag => new Element(tag), createComment: () => new Element('#comment'), getElementById: () => null,
    addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name),
    dispatchEvent: event => listeners.get(event.type)?.(event),
  };
  const url = new URL(href), fetched = [];
  const win = {
    location: { href, pathname: url.pathname, search: url.search, hash: '' },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, addEventListener() {},
    async fetch(page) { fetched.push(page); return { ok: true, url: page, text: async () => 'all-items' }; },
  };
  return { host, list, top, actions, hangarLog, actionWrapper, upgradeAction, upgradeCandidates, layoutRoot, doc, win, fetched };
}

test('Hangar header rehomes and restores the native dashboard action when compacting the page', () => {
  const dashboardButton = new Element('a'); dashboardButton.textContent = 'Back to Dashboard';
  const originalParent = new Element('div'); originalParent.append(dashboardButton);
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [pledgeRow('5801', 'Starter pledge')], dashboardButton);
  dashboardButton.before = marker => {
    originalParent.children.splice(originalParent.children.indexOf(dashboardButton), 1);
    marker.parentElement = originalParent;
    originalParent.children.push(marker);
    marker.before = element => {
      originalParent.children.splice(originalParent.children.indexOf(marker), 1);
      harness.actions.children.splice(harness.actions.children.indexOf(element), 1);
      element.parentElement = originalParent;
      originalParent.children.push(element);
    };
    marker.remove = () => { const index = originalParent.children.indexOf(marker); if (index >= 0) originalParent.children.splice(index, 1); };
  };
  let enabled = true;
  const refresh = installHangarSearch(() => enabled, harness.win, harness.doc); refresh();
  assert.ok(harness.actions.children.includes(dashboardButton), 'the existing back action remains available alongside Hangar actions');
  assert.equal(harness.layoutRoot.attributes.get('data-rsi-hangar-layout'), 'compact');
  enabled = false; refresh();
  assert.ok(originalParent.children.includes(dashboardButton), 'the original back action is restored on disable');
  assert.equal(harness.layoutRoot.attributes.has('data-rsi-hangar-layout'), false);
});

test('Ship upgrades stays compact in the Hangar header actions and returns to its original position on disable', () => {
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [pledgeRow('5802', 'Starter pledge')]);
  const originalParent = harness.upgradeAction.parentElement;
  let enabled = true;
  const refresh = installHangarSearch(() => enabled, harness.win, harness.doc); refresh();
  assert.ok(harness.actions.children.includes(harness.upgradeAction), 'Ship upgrades joins Hangar Log in the header action group');
  assert.ok(!originalParent.children.includes(harness.upgradeAction), 'the original standalone placement is cleared while the new header is active');
  assert.ok(originalParent.classList.contains('rsi-hangar-upgrade-origin-empty'), 'an empty native wrapper is hidden while its action is rehomed');
  enabled = false; refresh();
  assert.ok(originalParent.children.includes(harness.upgradeAction), 'Ship upgrades returns to its original location when Hangar styling is disabled');
  assert.ok(!originalParent.classList.contains('rsi-hangar-upgrade-origin-empty'), 'the temporary wrapper class is removed on disable');
});

test('native Hangar header links without an .actions wrapper are grouped and restored in place', () => {
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [pledgeRow('5807', 'Starter pledge')], null, false, false, true);
  const nativeOrder = [...harness.top.children];
  let enabled = true;
  const refresh = installHangarSearch(() => enabled, harness.win, harness.doc); refresh();
  const actions = harness.top.querySelector('.actions');
  assert.ok(actions, 'a compact action group is created when RSI supplies direct header links');
  assert.ok(actions.children.includes(harness.hangarLog), 'the native Hangar log joins the generated action group');
  assert.ok(actions.children.includes(harness.upgradeAction), 'Ship upgrades joins Hangar log in the generated action group');
  assert.equal(harness.host.afterElement.className, 'rsi-hangar-search-panel', 'the search panel remains a separate direct header child');
  enabled = false; refresh();
  assert.equal(harness.top.querySelector('.actions'), null, 'the temporary action group is removed when Hangar styling is disabled');
  assert.deepEqual(harness.top.children, nativeOrder, 'both native actions return to their original header positions');
});

test('Ship upgrades outside the title header is rehomed and its empty full-width row is hidden', () => {
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [pledgeRow('5803', 'Starter pledge')], null, true);
  const originalParent = harness.upgradeAction.parentElement;
  let enabled = true;
  const refresh = installHangarSearch(() => enabled, harness.win, harness.doc); refresh();
  assert.ok(harness.actions.children.includes(harness.upgradeAction), 'the existing Ship upgrades link joins Hangar Log even when it is outside the title header');
  assert.ok(originalParent.classList.contains('rsi-hangar-upgrade-origin-empty'), 'the now-empty row wrapper is marked for hiding');
  enabled = false; refresh();
  assert.ok(originalParent.children.includes(harness.upgradeAction), 'the link returns to its native location when Hangar styling is disabled');
  assert.ok(!originalParent.classList.contains('rsi-hangar-upgrade-origin-empty'), 'the temporary wrapper styling is removed on disable');
});

test('Ship upgrades outside the inner content is still found and restored', () => {
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [pledgeRow('5804', 'Starter pledge')], null, true, true);
  const originalParent = harness.upgradeAction.parentElement;
  let enabled = true;
  const refresh = installHangarSearch(() => enabled, harness.win, harness.doc); refresh();
  assert.ok(harness.actions.children.includes(harness.upgradeAction), 'the existing action is found across the whole Hangar container');
  assert.ok(originalParent.classList.contains('rsi-hangar-upgrade-origin-empty'), 'the row wrapper is hidden even outside inner content');
  enabled = false; refresh();
  assert.ok(originalParent.children.includes(harness.upgradeAction), 'the original native placement is restored on disable');
  assert.ok(!originalParent.classList.contains('rsi-hangar-upgrade-origin-empty'), 'the temporary wrapper styling is cleared on disable');
});

test('a replacement Ship upgrades link is rehomed on refresh and restored without duplicating the old link', () => {
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [pledgeRow('5805', 'Starter pledge')]);
  let enabled = true;
  const refresh = installHangarSearch(() => enabled, harness.win, harness.doc); refresh();
  harness.upgradeAction.remove();
  const replacement = new Element('a'); replacement.textContent = 'Ship upgrades';
  replacement.classList.add('ship-upgrade'); replacement.classList.add('js-open-ship-upgrades');
  harness.actionWrapper.append(replacement);
  harness.upgradeCandidates.push(replacement);
  refresh();
  assert.ok(harness.actions.children.includes(replacement), 'a late RSI replacement joins the header action row on refresh');
  enabled = false; refresh();
  assert.ok(harness.actionWrapper.children.includes(replacement), 'the newest native link returns to its original wrapper on disable');
  assert.ok(!harness.actionWrapper.children.includes(harness.upgradeAction), 'a stale replaced link is not restored beside the current native link');
});

test('a replacement Ship upgrades link in a new wrapper does not revive the detached old link', () => {
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [pledgeRow('5806', 'Starter pledge')]);
  let enabled = true;
  const refresh = installHangarSearch(() => enabled, harness.win, harness.doc); refresh();
  harness.upgradeAction.remove();
  const replacementWrapper = new Element('div'), replacement = new Element('a'); replacement.textContent = 'Ship upgrades';
  replacement.classList.add('ship-upgrade'); replacement.classList.add('js-open-ship-upgrades');
  replacementWrapper.append(replacement);
  harness.host.append(replacementWrapper);
  harness.upgradeCandidates.push(replacement);
  refresh();
  assert.ok(harness.actions.children.includes(replacement), 'the replacement in a different RSI wrapper joins the header action row');
  enabled = false; refresh();
  assert.ok(replacementWrapper.children.includes(replacement), 'the current button returns to its new native wrapper');
  assert.ok(!harness.actionWrapper.children.includes(harness.upgradeAction), 'the disconnected older button is not revived');
});

for (const paint of [false, true]) test(`native category starts an all-items index for ${paint ? 'Ship Paint' : 'search'}`, async () => {
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges?type=ships&page=3', [pledgeRow('301', 'Aurora')]);
  harness.win.fetch = async page => {
    harness.fetched.push(page);
    return { ok: true, url: page, text: async () => new URL(page).searchParams.get('page') || '1' };
  };
  const previousParser = globalThis.DOMParser;
  globalThis.DOMParser = class { parseFromString(page) {
    return {
      querySelector: () => ({}),
      querySelectorAll: selector => selector === '#billing.pledges .list-items .row'
        ? [pledgeRow(`${page}01`, page === '2' ? 'Gladius - Foundation Paint' : 'Aurora')]
        : selector === 'a[href]' && page === '1' ? [{ getAttribute: () => '?page=2' }] : [],
    };
  } };
  try {
    const refresh = installHangarSearch(() => true, harness.win, harness.doc); refresh();
    const [input, results] = harness.host.afterElement.children;
    if (paint) harness.doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: SHIP_PAINT_FILTER_VALUE } });
    else { input.value = 'Foundation'; input.dispatch('input'); }
    await new Promise(resolve => setTimeout(resolve, 350));
    assert.deepEqual(harness.fetched, ['https://robertsspaceindustries.com/en/account/pledges', 'https://robertsspaceindustries.com/en/account/pledges?page=2'], 'fetch unfiltered page one and discover its pagination, retaining the locale');
    if (paint) assert.equal(harness.list.children[0].querySelector('h3').textContent, 'Gladius - Foundation Paint');
    else assert.equal(results.children.find(child => child.tagName === 'A')?.href, 'https://robertsspaceindustries.com/en/account/pledges?page=2#rsi-pledge-201');
  } finally {
    if (previousParser === undefined) delete globalThis.DOMParser; else globalThis.DOMParser = previousParser;
  }
});

test('refresh keeps both preserved package and enhanced ship titles searchable', () => {
  const row = pledgeRow('101', 'Package - Aurora Starter', 'Contains: game access');
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [row]);
  const refresh = installHangarSearch(() => true, harness.win, harness.doc); refresh();
  const querySelector = row.querySelector;
  row.querySelector = selector => selector === 'h3' ? {
    childNodes: [{ nodeType: 1, textContent: 'Constellation' }],
    querySelector: name => ({ textContent: name === '.rsi-hangar-package-title' ? 'Package - Aurora Starter' : 'Constellation' }),
  } : querySelector(selector);
  refresh();
  const [input, results] = harness.host.afterElement.children;
  for (const query of ['Aurora', 'Constellation']) {
    input.value = query; input.dispatch('focus');
    const link = results.children.find(child => child.tagName === 'A');
    assert.ok(link, `${query} remains searchable after title enhancement`);
    assert.match(link.textContent, /Package - Aurora Starter/);
  }
});

test('paint rendering explicitly refreshes enhancements after cards are connected', async () => {
  const row = pledgeRow('101', 'Gladius Paint');
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [row]);
  const refreshed = [];
  let enabled = true;
  const modes = [];
  const refresh = installHangarSearch(() => enabled, harness.win, harness.doc, paintMode => {
    modes.push(paintMode); refreshed.push([...harness.list.children]);
  }); refresh();
  harness.doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: SHIP_PAINT_FILTER_VALUE } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(refreshed.length > 0, 'paint rendering calls the enhancement callback');
  assert.deepEqual(refreshed.at(-1), [row], 'enhancements see the actual displayed native cards');
  assert.equal(modes.at(-1), true, 'enhancements receive the active paint-only mode');
  harness.doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: '' } });
  assert.equal(modes.at(-1), false, 'filter exit restores normal enhancements after restoring native cards');
  harness.doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: SHIP_PAINT_FILTER_VALUE } });
  enabled = false; refresh();
  assert.equal(modes.at(-1), false, 'module or route disable clears paint-only enhancement mode');
});

test('entering Ship Paint clears the global favourites presentation before capturing the native list', async () => {
  const paint = pledgeRow('101', 'Gladius Paint'), nonpaint = pledgeRow('102', 'Aurora');
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', [paint, nonpaint]);
  const references = new Element('ul'); references.append(pledgeRow('999', 'Saved Aurora reference'));
  harness.host.append(references);
  let showReferences = true;
  const querySelector = harness.doc.querySelector;
  harness.doc.querySelector = selector => selector === '#billing.pledges .list-items' && showReferences ? references : querySelector(selector);
  const refresh = installHangarSearch(() => true, harness.win, harness.doc, paintMode => { showReferences = !paintMode; });
  refresh();
  harness.doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: SHIP_PAINT_FILTER_VALUE } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(harness.list.children, [paint], 'the real native list is paint-filtered, not the preceding saved-reference list');
  harness.doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: '' } });
  assert.deepEqual(harness.list.children, [paint, nonpaint], 'filter exit restores the actual native list');
  assert.equal(showReferences, true, 'normal favourite references resume after exit');
});

test('paint filter exit and disable reset enhancement mode even before the native list appears', () => {
  const harness = integrationHarness('https://robertsspaceindustries.com/en/account/pledges', []);
  const querySelector = harness.doc.querySelector;
  harness.doc.querySelector = selector => selector === '#billing.pledges .list-items' ? null : querySelector(selector);
  const modes = [];
  let enabled = true;
  const refresh = installHangarSearch(() => enabled, harness.win, harness.doc, mode => modes.push(mode));
  refresh();
  harness.doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: SHIP_PAINT_FILTER_VALUE } });
  harness.doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: '' } });
  assert.deepEqual(modes, [true, false], 'native category exit resets mode without a captured list');
  harness.doc.dispatchEvent({ type: HANGAR_FILTER_CHANGE_EVENT, detail: { value: SHIP_PAINT_FILTER_VALUE } });
  enabled = false; refresh();
  assert.deepEqual(modes, [true, false, true, false], 'module or route cleanup also resets mode without a list');
});
