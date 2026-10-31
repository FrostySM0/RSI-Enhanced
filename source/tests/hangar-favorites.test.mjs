import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findHangarList, hangarFavoriteTitle, installHangarFavorites, isHangarListItem } from '../src/content/hangar-favorites.ts';
import { HANGAR_FAVORITES_KEY } from '../src/shared/hangar-favorites.ts';

test('upgraded ship package titles remain eligible and keep the package name', () => {
  assert.deepEqual(hangarFavoriteTitle({
    originalTitle: 'Package - Aurora MR Starter Pack',
    upgradedShipTitle: 'Constellation Mk V Centaurus',
    containedShips: ['Constellation Mk V Centaurus'],
    type: null,
  }), { title: 'Constellation Mk V Centaurus', subtitle: 'Package - Aurora MR Starter Pack' });
});

test('standalone ships with loaded ship metadata are eligible', () => {
  assert.deepEqual(hangarFavoriteTitle({
    originalTitle: 'Avenger Titan', upgradedShipTitle: '', containedShips: ['Avenger Titan'], type: null,
  }), { title: 'Avenger Titan', subtitle: '' });
});

test('standalone ships remain eligible on the Ships filter before contents load', () => {
  assert.deepEqual(hangarFavoriteTitle({
    originalTitle: 'Avenger Titan', upgradedShipTitle: '', containedShips: [], type: 'ships',
  }), { title: 'Avenger Titan', subtitle: '' });
});

test('non-ship equipment without package or ship metadata is excluded', () => {
  assert.equal(hangarFavoriteTitle({
    originalTitle: 'Phoenix Insignia Display', upgradedShipTitle: '', containedShips: [], type: null,
  }), null);
});

test('Hangar cards are recognized by their LI tag across DOM wrappers', () => {
  assert.equal(isHangarListItem({ tagName: 'LI' }), true);
  assert.equal(isHangarListItem({ tagName: 'DIV' }), false);
});

test('favorite discovery accepts the native list when a wrapper sits inside the items panel', () => {
  const wrappedList = { querySelector: () => null };
  const nativeList = { querySelector: selector => selector === ':scope > li > .row' ? {} : null };
  const doc = {
    querySelectorAll: selector => {
      assert.equal(selector, '#billing.pledges .list-items:not(.rsi-hangar-favorite-references)');
      return [wrappedList, nativeList];
    },
  };
  assert.equal(findHangarList(doc), nativeList);
});

test('paint cards keep favourite toggles without global favourite references, including storage updates and filter exit', async t => {
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = new Map();
      this.isConnected = true; this.listeners = new Map();
      this.classList = { add() {}, remove() {} };
    }
    append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
    remove() { this.isConnected = false; if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
    setAttribute(key, value) { this.attributes.set(key, value); }
    addEventListener(key, callback) { this.listeners.set(key, callback); }
    querySelector() { return null; }
    querySelectorAll() { return []; }
    before(child) { this.parentElement.append(child); }
    get childElementCount() { return this.children.length; }
  }
  const root = new Element(), list = new Element('ul'), item = new Element('li'), row = new Element();
  const heading = new Element('h3'); heading.childNodes = [{ nodeType: 3, textContent: 'Package - Aurora with Paint' }];
  root.append(list); list.append(item); item.append(row); row.append(heading);
  row.querySelector = selector => selector === '.js-pledge-id' ? { value: '101' } : selector === '.title-col h3' ? heading : null;
  let visibleRow = row;
  list.querySelector = () => visibleRow; list.querySelectorAll = () => [visibleRow];
  const created = [];
  const doc = {
    readyState: 'complete', baseURI: 'https://robertsspaceindustries.com/en/account/pledges',
    createElement: tag => { const element = new Element(tag); created.push(element); return element; },
    querySelectorAll: selector => selector.includes('list-items:not') ? [list] : [],
  };
  const saved = [{ id: '999', page: 2, type: null, title: 'Non-paint Aurora', subtitle: '', imageUrl: null }];
  const previousChrome = globalThis.chrome, previousNode = globalThis.Node;
  let storageChanged, paintMode = true, enabled = true;
  globalThis.Node = { TEXT_NODE: 3 };
  globalThis.chrome = { storage: {
    local: { get: async () => ({ [HANGAR_FAVORITES_KEY]: saved }), set: async () => {} },
    onChanged: { addListener: listener => { storageChanged = listener; } },
  } };
  try {
    const refresh = installHangarFavorites(() => enabled, { location: { href: doc.baseURI } }, doc, () => paintMode);
    refresh(); await new Promise(resolve => setTimeout(resolve, 0));
    let star = heading.children.find(element => element.tagName === 'BUTTON');
    assert.ok(star, 'the displayed paint-containing package retains its favourite toggle');
    const sections = () => created.filter(element => element.className === 'rsi-hangar-favorites' && element.isConnected);
    assert.equal(sections().length, 0, 'paint mode must not render non-paint saved references');
    star.listeners.get('click')({ preventDefault() {}, stopPropagation() {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(star.attributes.get('aria-pressed'), 'true', 'the displayed card can still be favourited');
    await t.test('paint page 1 → page 2 → page 1 reconnects a favourited native card with exactly one working star', async () => {
      const secondItem = new Element('li'), secondRow = new Element(), secondHeading = new Element('h3');
      secondHeading.childNodes = [{ nodeType: 3, textContent: 'Package - Arrow with Paint' }];
      secondItem.append(secondRow); secondRow.append(secondHeading);
      secondRow.querySelector = selector => selector === '.js-pledge-id' ? { value: '202' } : selector === '.title-col h3' ? secondHeading : null;
      heading.isConnected = false; list.children = [secondItem]; visibleRow = secondRow;
      refresh();
      secondHeading.isConnected = false; heading.isConnected = true; list.children = [item]; visibleRow = row;
      refresh();
      const stars = heading.children.filter(element => element.tagName === 'BUTTON');
      assert.equal(stars.length, 1, 'returning to the same native card must not duplicate its star');
      star = stars[0];
      assert.equal(star.attributes.get('aria-pressed'), 'true', 'the reconnected card keeps its saved favourite state');
      star.listeners.get('click')({ preventDefault() {}, stopPropagation() {} });
      await new Promise(resolve => setTimeout(resolve, 0));
      assert.equal(star.attributes.get('aria-pressed'), 'false', 'the reconnected toggle can remove its favourite');
    });
    storageChanged({ [HANGAR_FAVORITES_KEY]: { newValue: saved } }, 'local');
    assert.equal(sections().length, 0, 'storage updates must keep the paint-only presentation');
    paintMode = false; refresh();
    assert.equal(sections().length, 1, 'exiting paint mode restores the regular favourites section');
    paintMode = true; refresh();
    assert.equal(sections().length, 0, 're-entering paint mode removes the regular favourites section');
    enabled = false; refresh();
    assert.equal(heading.children.includes(star), false, 'module disable removes favourite controls');
    assert.equal(sections().length, 0);
  } finally {
    if (previousChrome === undefined) delete globalThis.chrome; else globalThis.chrome = previousChrome;
    if (previousNode === undefined) delete globalThis.Node; else globalThis.Node = previousNode;
  }
});
