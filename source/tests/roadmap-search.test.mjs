import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installRoadmapSearch, roadmapSearchMatches } from '../src/content/roadmap-search.ts';

class FakeElement {
  constructor(tagName, className = '', document) {
    this.tagName = tagName.toUpperCase();
    this.className = className;
    this.ownerDocument = document;
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.nativeDisplay = null;
    this.text = undefined;
    this.clickCount = 0;
    this.replaceChildrenCount = 0;
    this.scrollCalls = [];
    this.classList = {
      add: value => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), value])].join(' '); },
      remove: value => { this.className = this.className.split(/\s+/).filter(part => part && part !== value).join(' '); },
      contains: value => this.className.split(/\s+/).includes(value),
    };
  }

  get textContent() { return this.text ?? this.children.map(child => child.textContent).filter(Boolean).join(' '); }
  set textContent(value) { this.text = String(value); this.children = []; }
  get isConnected() {
    let node = this;
    while (node.parentElement) node = node.parentElement;
    return node === this.ownerDocument?.body;
  }
  get nextElementSibling() {
    const siblings = this.parentElement?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.children.push(node); } }
  appendChild(node) { this.append(node); return node; }
  prepend(...nodes) { for (const node of [...nodes].reverse()) { node.remove(); node.parentElement = this; this.children.unshift(node); } }
  replaceChildren(...nodes) { this.replaceChildrenCount++; for (const child of this.children) child.parentElement = null; this.children = []; this.append(...nodes); }
  insertBefore(node, before) { node.remove(); node.parentElement = this; const index = this.children.indexOf(before); this.children.splice(index < 0 ? this.children.length : index, 0, node); }
  remove() { if (!this.parentElement) return; this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) {
    const className = /^\.([\w-]+)/.exec(selector);
    if (className) return this.classList.contains(className[1]);
    const classMatch = /\[class\*=["']([^"']+)["']\]/.exec(selector);
    if (classMatch && !this.className.includes(classMatch[1])) return false;
    const tagMatch = /^([a-z][a-z0-9]*)/i.exec(selector);
    if (tagMatch && this.tagName !== tagMatch[1].toUpperCase()) return false;
    return Boolean(classMatch || tagMatch);
  }
  closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
  querySelectorAll(selector) {
    const matches = [];
    const visit = node => { for (const child of node.children) { if (child.matches(selector)) matches.push(child); visit(child); } };
    visit(this);
    return matches;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  addEventListener(name, listener) { const group = this.listeners.get(name) ?? []; group.push(listener); this.listeners.set(name, group); }
  dispatch(name, details = {}) {
    const event = {
      type: name,
      target: this,
      relatedTarget: null,
      key: '',
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
      ...details,
    };
    for (const listener of this.listeners.get(name) ?? []) listener(event);
    return event;
  }
  click() { this.clickCount++; this.dispatch('click'); }
  focus() { this.ownerDocument.activeElement = this; this.dispatch('focus'); }
  blur() { if (this.ownerDocument.activeElement === this) this.ownerDocument.activeElement = null; }
  scrollIntoView(options) { this.scrollCalls.push(options); }
  getBoundingClientRect() { return { width: this.hidden ? 0 : 100, height: this.hidden ? 0 : 100, top: 0, left: 0, right: 100, bottom: 100 }; }
}

class FakeDocument {
  constructor() {
    this.activeElement = null;
    this.body = new FakeElement('body', '', this);
    this.listeners = new Map();
  }
  createElement(tagName) { return new FakeElement(tagName, '', this); }
  querySelector(selector) { return this.body.querySelector(selector); }
  querySelectorAll(selector) { return this.body.querySelectorAll(selector); }
  addEventListener(name, listener) { const group = this.listeners.get(name) ?? []; group.push(listener); this.listeners.set(name, group); }
  removeEventListener(name, listener) { this.listeners.set(name, (this.listeners.get(name) ?? []).filter(item => item !== listener)); }
  dispatch(name, details = {}) {
    const event = { type: name, target: this.body, key: '', ctrlKey: false, metaKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...details };
    for (const listener of this.listeners.get(name) ?? []) listener(event);
    return event;
  }
}

class FakeMutationObserver {
  static instances = [];
  constructor(callback) { this.callback = callback; this.disconnected = false; FakeMutationObserver.instances.push(this); }
  observe(target, options) { this.target = target; this.options = options; }
  disconnect() { this.disconnected = true; }
  notify() { if (!this.disconnected) this.callback([]); }
}

function fakePage({ attachBoard = true, categoryExpanded = false, categoryHeaderHasAriaExpanded = true, categoryCollapseNotReflected = false, cardTitle = 'Dynamic Server Meshing', deferArchive = false, previousReleasesExpanded = false, deferFrames = false, lazyArchiveCategory = false, archiveCardTitle = 'Archived Dynamic Meshing Systems', archiveCategoryName = 'Core Tech' } = {}) {
  const doc = new FakeDocument();
  const timeoutCallbacks = new Map();
  const timeoutDelays = new Map();
  const animationFrameCallbacks = new Map();
  let nextTimeout = 0;
  let nextFrame = 0;
  const win = {
    MutationObserver: FakeMutationObserver,
    requestAnimationFrame(callback) {
      if (!deferFrames) { callback(); return 1; }
      const id = ++nextFrame;
      animationFrameCallbacks.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { animationFrameCallbacks.delete(id); },
    setTimeout(callback, delay = 0) { const id = ++nextTimeout; timeoutCallbacks.set(id, callback); timeoutDelays.set(id, delay); return id; },
    clearTimeout(id) { timeoutCallbacks.delete(id); timeoutDelays.delete(id); },
    getComputedStyle(element) {
      const board = element.closest('article[class*="Board__Wrapper-"]');
      const category = element.closest('section[class*="Category__Wrapper-"]');
      const hiddenForIndex = board?.classList.contains('rsi-roadmap-search-indexing')
        && element.className.includes('Category__Cards-')
        && !category?.classList.contains('rsi-roadmap-search-indexing-target');
      const collapsedStateNotReflected = categoryCollapseNotReflected && element.className.includes('Category__Cards-');
      return { display: hiddenForIndex ? 'none' : collapsedStateNotReflected ? 'flex' : element.nativeDisplay ?? (element.hidden ? 'none' : 'block'), visibility: 'visible' };
    },
    flushFrames() { for (const callback of [...animationFrameCallbacks.values()]) callback(); animationFrameCallbacks.clear(); },
    flushTimeouts() { for (const callback of timeoutCallbacks.values()) callback(); timeoutCallbacks.clear(); timeoutDelays.clear(); },
  };
  const element = (tag, className, parent) => {
    const node = doc.createElement(tag);
    node.className = className;
    parent?.append(node);
    return node;
  };
  const board = element('article', 'Board__Wrapper-test');
  const header = element('header', 'Board__Header-test', board);
  element('div', 'Board__NameAndLastModified-test', header);
  element('div', 'Board__Description-test', header);
  const controls = element('div', 'Controls-sc-test', header);
  const nativeControls = element('div', 'Group-sc-test', controls);
  const expandButton = element('button', 'Button-sc-1i76va4-test', nativeControls);
  expandButton.textContent = 'Expand all categories';
  expandButton.disabled = categoryExpanded;
  const collapseButton = element('button', 'Button-sc-1i76va4-test', nativeControls);
  collapseButton.textContent = 'Collapse all categories';
  collapseButton.disabled = !categoryExpanded;
  const releases = element('div', 'Board__Releases-test', board);
  let categoryHeader = null;
  let categoryOpen = categoryExpanded;
  expandButton.addEventListener('click', () => {
    for (const category of releases.querySelectorAll('section[class*="Category__Wrapper-"]')) {
      const header = category.querySelector('header[class*="Category__Header-"]');
      const expanded = header === categoryHeader
        ? categoryOpen
        : header?.getAttribute('aria-expanded') === 'true';
      if (!expanded) header?.click();
    }
    expandButton.disabled = true;
    collapseButton.disabled = false;
  });
  collapseButton.addEventListener('click', () => {
    for (const category of releases.querySelectorAll('section[class*="Category__Wrapper-"]')) {
      const header = category.querySelector('header[class*="Category__Header-"]');
      if (header?.getAttribute('aria-expanded') === 'true') header.click();
    }
    expandButton.disabled = false;
    collapseButton.disabled = true;
  });
  const previousReleasesButton = element('button', 'TogglePreviousReleases-test', releases);
  previousReleasesButton.setAttribute('aria-expanded', String(previousReleasesExpanded));
  previousReleasesButton.textContent = previousReleasesExpanded ? 'Hide Previous Releases' : 'Show Previous Releases';
  let archiveRelease = null;
  let archiveCategoryHeader = null;
  let archiveAnchor = null;
  let archiveCards = null;
  let delayArchiveCategoryMount = false;
  let mountArchiveCategoryCard = () => {};
  let attachArchive = () => {};
  previousReleasesButton.addEventListener('click', () => {
    const expanded = previousReleasesButton.getAttribute('aria-expanded') === 'true';
    previousReleasesButton.setAttribute('aria-expanded', String(!expanded));
    previousReleasesButton.textContent = expanded ? 'Show Previous Releases' : 'Hide Previous Releases';
    if (expanded || archiveRelease || deferArchive) return;
    attachArchive();
  });
  attachArchive = () => {
    if (archiveRelease) return;
    archiveRelease = element('section', 'Release__Wrapper-test');
    const archiveHeading = element('h2', 'ReleaseHeader__ReleaseHeaderName-test', archiveRelease);
    archiveHeading.textContent = '4.5';
    element('div', 'Release__Scroller-test', archiveRelease);
    const archiveCategory = element('section', 'Category__Wrapper-test', archiveRelease);
    archiveCategoryHeader = element('header', 'Category__Header-test', archiveCategory);
    archiveCategoryHeader.setAttribute('aria-expanded', String(!lazyArchiveCategory));
    if (lazyArchiveCategory) expandButton.disabled = false;
    const archiveCategoryText = element('div', 'Category__HeaderText-test', archiveCategoryHeader);
    const archiveCategoryHeading = element('h3', '', archiveCategoryText);
    archiveCategoryHeading.textContent = archiveCategoryName;
    const archiveCategoryCount = element('span', '', archiveCategoryText);
    archiveCategoryCount.textContent = '1 Entry';
    archiveCards = element('div', 'Category__Cards-test', archiveCategory);
    const archiveWrapper = element('section', 'Card__Wrapper-test');
    mountArchiveCategoryCard = () => archiveCards.append(archiveWrapper);
    const archiveDrag = element('div', 'Card__DragZone-test', archiveWrapper);
    archiveAnchor = element('a', 'Card__StyledNavLink-test', archiveDrag);
    const archiveStatus = element('div', 'StatusBar-test', archiveAnchor);
    archiveStatus.textContent = 'Released';
    const archiveTitleBar = element('header', 'Card__TitleBar-test', archiveAnchor);
    const archiveTitle = element('h3', '', archiveTitleBar);
    archiveTitle.textContent = archiveCardTitle;
    const archiveDescription = element('p', 'Card__Description-test', archiveAnchor);
    archiveDescription.textContent = 'An older release card kept in the Roadmap archive.';
    if (!lazyArchiveCategory) archiveCards.append(archiveWrapper);
    archiveCategoryHeader.addEventListener('click', () => {
      const expanded = archiveCategoryHeader.getAttribute('aria-expanded') === 'true';
      archiveCategoryHeader.setAttribute('aria-expanded', String(!expanded));
      archiveCards.hidden = expanded;
      if (lazyArchiveCategory) {
        if (expanded) archiveWrapper.remove();
        else if (!delayArchiveCategoryMount) mountArchiveCategoryCard();
      }
    });
    releases.append(archiveRelease);
  };
  if (previousReleasesExpanded) attachArchive();
  const release = element('section', 'Release__Wrapper-test', releases);
  const releaseHeading = element('h2', 'ReleaseHeader__ReleaseHeaderName-test', release);
  releaseHeading.textContent = 'Star Citizen 1.0';
  element('div', 'Release__Scroller-test', release);
  const category = element('section', 'Category__Wrapper-test', release);
  categoryHeader = element('header', 'Category__Header-test', category);
  if (categoryHeaderHasAriaExpanded) categoryHeader.setAttribute('aria-expanded', String(categoryExpanded));
  let cards = null;
  let cardWrapper = null;
  categoryHeader.addEventListener('click', () => {
    const expanded = categoryOpen;
    categoryOpen = !expanded;
    if (categoryHeaderHasAriaExpanded) categoryHeader.setAttribute('aria-expanded', String(categoryOpen));
    if (cards) {
      cards.hidden = categoryHeaderHasAriaExpanded ? expanded : false;
      cards.nativeDisplay = categoryOpen ? 'flex' : 'none';
    }
    if (lazyArchiveCategory) {
      if (expanded) cardWrapper?.remove();
      else if (cardWrapper) cards?.append(cardWrapper);
    }
  });
  const categoryTitle = element('div', 'Category__HeaderText-test', categoryHeader);
  const categoryHeading = element('h3', '', categoryTitle);
  categoryHeading.textContent = 'Core Tech';
  cards = element('div', 'Category__Cards-test', category);
  cards.hidden = categoryHeaderHasAriaExpanded && !categoryExpanded;
  cards.nativeDisplay = categoryExpanded ? 'flex' : 'none';
  cardWrapper = element('section', 'Card__Wrapper-test');
  const drag = element('div', 'Card__DragZone-test', cardWrapper);
  const anchor = element('a', 'Card__StyledNavLink-test', drag);
  anchor.href = '/roadmap/release-view/123-dynamic-server-meshing';
  let nativeCardClicks = 0;
  anchor.addEventListener('click', () => { nativeCardClicks++; });
  const status = element('div', 'StatusBar-test', anchor);
  status.textContent = 'Tentative';
  const titlebar = element('header', 'Card__TitleBar-test', anchor);
  const title = element('h3', '', titlebar);
  title.textContent = cardTitle;
  const description = element('p', 'Card__Description-test', anchor);
  description.textContent = 'A feature using dynamic server meshing across the universe.';
  if (!lazyArchiveCategory || categoryExpanded) cards.append(cardWrapper);
  const attach = () => doc.body.append(board);
  if (attachBoard) attach();
  return { doc, win, timeoutDelays, board, header, controls, releases, release, category, categoryHeader, cards, anchor, get categoryOpen() { return categoryOpen; }, get nativeCardClicks() { return nativeCardClicks; }, attach, attachArchive, expandButton, collapseButton, previousReleasesButton, get archiveRelease() { return archiveRelease; }, get archiveCategoryHeader() { return archiveCategoryHeader; }, get archiveAnchor() { return archiveAnchor; }, get archiveCards() { return archiveCards; }, set delayArchiveCategoryMount(value) { delayArchiveCategoryMount = value; }, mountArchiveCategoryCard: () => mountArchiveCategoryCard() };
}

function openFilterPopover(doc) {
  const button = doc.querySelector('.rsi-roadmap-search-filter-button');
  assert.ok(button, 'search has a filter popover button');
  button.click();
  return button;
}

test('Roadmap search matches every query word across card and release details', () => {
  const card = { title: 'Dynamic Server Meshing', description: 'A connected universe', release: 'Star Citizen 1.0', category: 'Core Tech', status: 'Tentative' };
  assert.equal(roadmapSearchMatches(card, 'CORE dynamic 1.0'), true);
  assert.equal(roadmapSearchMatches(card, 'server tentative'), true);
  assert.equal(roadmapSearchMatches(card, 'server ships'), false);
  assert.equal(roadmapSearchMatches(card, '  '), false);
});

test('Roadmap search matches text anywhere inside a native card', () => {
  const page = fakePage();
  const detail = page.doc.createElement('div');
  detail.textContent = 'Quantum drive updates';
  page.anchor.append(detail);
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'Quantum';
  input.dispatch('input');
  const matches = page.doc.querySelectorAll('.rsi-roadmap-search-result');
  assert.equal(matches.length, 1);
  assert.match(matches[0].textContent, /Dynamic Server Meshing/);
  refresh();
});

test('Roadmap search shortcut and results prompt match the compact navigation design', () => {
  const page = fakePage();
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  assert.equal(page.doc.querySelector('.rsi-roadmap-search-shortcut').textContent, 'Ctrl K');
  input.value = 'dynamic meshing';
  input.dispatch('input');
  const summary = page.doc.querySelector('.rsi-roadmap-search-summary');
  assert.match(summary.textContent, /2 matching cards/i);
  assert.match(summary.textContent, /enter to jump/i);
  const shortcut = page.doc.dispatch('keydown', { key: 'k', ctrlKey: true });
  assert.equal(shortcut.defaultPrevented, true);
  assert.equal(page.doc.activeElement, input);
  page.doc.querySelector('.rsi-roadmap-search-result').click();
  assert.equal(page.anchor.scrollCalls.length, 1);
  refresh();
});

test('Roadmap search loads previous releases on first use and picks up later archive batches', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ deferArchive: true });
  let enabled = true;
  const refresh = installRoadmapSearch(() => enabled, page.win, page.doc);
  refresh();
  assert.equal(page.previousReleasesButton.clickCount, 0, 'the native archive waits until search is opened');

  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  input.value = 'quantum';
  input.dispatch('input');
  assert.equal(page.previousReleasesButton.clickCount, 1, 'the native archive loads on first search use');
  const archiveObserver = FakeMutationObserver.instances.find(observer => observer.target === page.releases);
  assert.ok(archiveObserver, 'the complete native release track is observed while archive cards preload');
  page.attachArchive();
  archiveObserver.notify();
  page.win.flushTimeouts();

  const lateCard = page.doc.createElement('a');
  lateCard.className = 'Card__StyledNavLink-test';
  const lateTitle = page.doc.createElement('h3');
  lateTitle.textContent = 'Quantum Drive Overhaul';
  lateCard.append(lateTitle);
  page.archiveCards.append(lateCard);
  archiveObserver.notify();
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 1, 'late previous-release cards update the open search without requiring another keystroke');
  assert.match(results.textContent, /Quantum Drive Overhaul/);
  enabled = false;
  refresh();
  assert.equal(archiveObserver.disconnected, true, 'the archive observer is removed when the module stops');
});

test('search indexes lazy previous-release cards without leaving categories expanded', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();

  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  input.value = 'quantum';
  input.dispatch('input');
  page.win.flushTimeouts();

  assert.match(page.archiveCategoryHeader.textContent, /1 Entry/, 'the fixture exposes its lazy-card count in the category header');
  assert.equal(page.archiveCategoryHeader.clickCount, 2, 'lazy archive indexing temporarily expands and restores its category');
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 1, 'collapsed archive categories are included in search');
  assert.equal(page.archiveCategoryHeader.getAttribute('aria-expanded'), 'false', 'search restores the previous-release category to its collapsed state');
  assert.equal(page.archiveAnchor.isConnected, false, 'the cached card may remain unmounted until selected');

  results.querySelector('.rsi-roadmap-search-result').click();
  assert.equal(page.archiveCategoryHeader.getAttribute('aria-expanded'), 'true', 'selecting a result leaves its category expanded');
  assert.equal(page.archiveAnchor.isConnected, true, 'selection mounts the target card in its native category');
  assert.equal(page.archiveAnchor.scrollCalls.length, 1, 'the mounted native card is scrolled into view');
  refresh();
});

test('focusing search expands current and previous-release categories', () => {
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');

  assert.equal(page.previousReleasesButton.clickCount, 0, 'previous releases are not loaded until the user opens search');
  input.focus();
  page.win.flushTimeouts();

  assert.equal(page.previousReleasesButton.clickCount, 1, 'opening search loads previous releases');
  assert.equal(page.categoryOpen, true, 'focusing search expands current categories');
  assert.equal(page.archiveCategoryHeader.getAttribute('aria-expanded'), 'true', 'focusing search expands previous-release categories too');
  assert.equal(page.expandButton.clickCount, 1, 'search uses the native expand-all control once');
  assert.equal(page.board.classList.contains('rsi-roadmap-search-indexing'), false, 'search no longer hides cards while indexing');
  refresh();
});

test('search focus expands previous-release categories that arrive later', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ deferArchive: true, lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.focus();
  page.attachArchive();

  const observer = FakeMutationObserver.instances.find(item => item.target === page.releases);
  assert.ok(observer, 'search observes the previous-release list while it loads');
  observer.notify();

  assert.equal(page.archiveCategoryHeader.getAttribute('aria-expanded'), 'true', 'categories mounted after search focus are expanded too');
  refresh();
});

test('search trusts the native expand-all control when collapsed state is not exposed', () => {
  const page = fakePage({ categoryHeaderHasAriaExpanded: false, categoryCollapseNotReflected: true });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  page.doc.querySelector('.rsi-roadmap-search-input').focus();

  assert.equal(page.expandButton.clickCount, 1, 'search activates RSI expand-all while its control is enabled');
  assert.equal(page.categoryOpen, true, 'the native control opens categories even when local state checks cannot detect collapse');
  refresh();
});

test('clicking an already-focused search expands categories that were collapsed again', () => {
  const page = fakePage();
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.focus();
  page.categoryHeader.click();
  page.expandButton.disabled = false;
  assert.equal(page.categoryOpen, false, 'the fixture collapses the category while search retains focus');

  input.click();

  assert.equal(page.categoryOpen, true, 'clicking search invokes expansion again without relying on a second focus event');
  refresh();
});

test('Collapse All Categories stays collapsed after search previously expanded the board', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ deferArchive: true });
  let enabled = true;
  const refresh = installRoadmapSearch(() => enabled, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.focus();
  assert.equal(page.categoryOpen, true, 'search focus expands current categories');

  page.collapseButton.click();
  page.doc.dispatch('click', { target: page.collapseButton });
  FakeMutationObserver.instances.find(observer => observer.target === page.releases)?.notify();

  assert.equal(page.categoryOpen, false, "archive mutations do not undo the user's collapse-all action");
  input.click();
  assert.equal(page.categoryOpen, true, 'opening search again expands categories for searching');
  enabled = false;
  refresh();
  assert.equal(page.doc.listeners.get('click')?.length ?? 0, 0, 'disabling search removes the native-control listener');
});

test('typing searches the cached roadmap index without rescanning the page DOM', () => {
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.focus();
  page.win.flushTimeouts();

  let boardScans = 0;
  const querySelectorAll = page.board.querySelectorAll.bind(page.board);
  page.board.querySelectorAll = selector => {
    boardScans++;
    return querySelectorAll(selector);
  };
  for (const query of ['q', 'qu', 'qua', 'quantum']) {
    input.value = query;
    input.dispatch('input');
  }
  page.win.flushTimeouts();

  assert.equal(boardScans, 0, 'keystrokes use the cached card index rather than traversing the full Roadmap DOM');
  assert.equal(page.expandButton.clickCount, 1, 'search focus uses the native expand-all control once');
  assert.equal(page.categoryOpen, true, 'search focus expands the current category');
  assert.equal(page.doc.querySelectorAll('.rsi-roadmap-search-result').length, 1);
  refresh();
});

test('rapid typing coalesces result rendering into one animation frame', () => {
  const page = fakePage({ deferFrames: true });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.focus();
  const list = page.doc.querySelector('.rsi-roadmap-search-list');
  const initialRenders = list.replaceChildrenCount;

  for (const query of ['d', 'dy', 'dyn', 'dynamic']) {
    input.value = query;
    input.dispatch('input');
  }

  assert.equal(list.replaceChildrenCount, initialRenders, 'keystrokes do not synchronously rebuild the result list');
  page.win.flushFrames();
  assert.equal(list.replaceChildrenCount, initialRenders + 1, 'one result list update handles the rapid input burst');
  assert.equal(list.querySelectorAll('.rsi-roadmap-search-result').length, 2);
  refresh();
});

test('broad searches count all matches while rendering a bounded result list', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage();
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.focus();
  for (let index = 0; index < 45; index++) {
    const anchor = page.doc.createElement('a');
    anchor.className = 'Card__StyledNavLink-test';
    const title = page.doc.createElement('h3');
    title.textContent = `Quantum Card ${index}`;
    anchor.append(title);
    page.cards.append(anchor);
  }
  FakeMutationObserver.instances.find(observer => observer.target === page.releases)?.notify();
  input.value = 'quantum';
  input.dispatch('input');

  assert.match(page.doc.querySelector('.rsi-roadmap-search-count').textContent, /^45 matching cards$/);
  assert.equal(page.doc.querySelectorAll('.rsi-roadmap-search-result').length, 40, 'the dropdown avoids building an unbounded list while typing');
  assert.match(page.doc.querySelector('.rsi-roadmap-search-enter-hint').textContent, /narrow your search/i);
  refresh();
});

test('selecting a result while previous releases load keeps its category open', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'quantum';
  input.dispatch('input');
  page.doc.querySelector('.rsi-roadmap-search-result').click();
  assert.equal(page.win.getComputedStyle(page.archiveCards).display, 'block', 'the selected archive category is revealed before the search scrolls to it');
  page.win.flushTimeouts();

  assert.equal(page.archiveCategoryHeader.getAttribute('aria-expanded'), 'true', 'the selection keeps the category expanded');
  assert.equal(page.archiveAnchor.isConnected, true, 'the selected card remains mounted');
  assert.equal(page.archiveAnchor.scrollCalls.length, 1);
  refresh();
});

test('expanding categories preserves a category already open without native aria state', () => {
  const page = fakePage({ categoryExpanded: true, categoryHeaderHasAriaExpanded: false });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();

  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'dynamic';
  input.dispatch('input');
  page.doc.querySelector('.rsi-roadmap-search-result').click();
  assert.equal(page.categoryOpen, true, 'search selection does not toggle an already-open category');
  assert.equal(page.win.getComputedStyle(page.cards).display, 'flex', 'the category stays visible during search');
  page.win.flushTimeouts();
  assert.equal(page.categoryOpen, true, 'search loading does not toggle the already-open category closed');
  refresh();
});

test('selecting a lazy card waits for its native category content to mount', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'quantum';
  input.dispatch('input');
  page.delayArchiveCategoryMount = true;
  page.doc.querySelector('.rsi-roadmap-search-result').click();
  assert.equal(page.archiveAnchor.scrollCalls.length, 0, 'selection waits rather than failing when the first animation frame has no card');

  const selectionObserver = FakeMutationObserver.instances.find(observer => observer.target === page.archiveCards && !observer.disconnected);
  assert.ok(selectionObserver, 'selection observes the native category for its lazy card');
  page.mountArchiveCategoryCard();
  selectionObserver.notify();
  assert.equal(page.archiveAnchor.scrollCalls.length, 1, 'the card scrolls into view when RSI mounts it');
  assert.equal(page.archiveAnchor.classList.contains('rsi-roadmap-search-highlight'), true);
  refresh();
});

test('Roadmap search watches an already-expanded archive for cards that render later', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ deferArchive: true, previousReleasesExpanded: true });
  let enabled = true;
  const refresh = installRoadmapSearch(() => enabled, page.win, page.doc);
  refresh();
  assert.equal(page.previousReleasesButton.clickCount, 0, 'an already-open native archive is left open');

  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  input.value = 'quantum';
  input.dispatch('input');
  const archiveObserver = FakeMutationObserver.instances.find(observer => observer.target === page.releases);
  assert.ok(archiveObserver, 'already-open archives are also observed for later cards');
  const lateCard = page.doc.createElement('a');
  lateCard.className = 'Card__StyledNavLink-test';
  const lateTitle = page.doc.createElement('h3');
  lateTitle.textContent = 'Quantum Drive Overhaul';
  lateCard.append(lateTitle);
  page.archiveCards.append(lateCard);
  archiveObserver.notify();
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 1);
  enabled = false;
  refresh();
  assert.equal(archiveObserver.disconnected, true);
});

test('late archive updates do not reopen dismissed results', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ deferArchive: true, previousReleasesExpanded: true });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  input.value = 'quantum';
  input.dispatch('input');
  const observer = FakeMutationObserver.instances.find(item => item.target === page.releases);
  input.dispatch('keydown', { key: 'Escape' });
  assert.equal(results.hidden, true);

  const lateCard = page.doc.createElement('a');
  lateCard.className = 'Card__StyledNavLink-test';
  const title = page.doc.createElement('h3');
  title.textContent = 'Quantum Drive Overhaul';
  lateCard.append(title);
  page.archiveCards.append(lateCard);
  observer.notify();
  assert.equal(results.hidden, true, 'background indexing does not undo an explicit dismissal');
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 1);
  refresh();
});

test('focusout and result selection remain dismissed through archive updates', () => {
  for (const dismissal of ['focusout', 'selection']) {
    FakeMutationObserver.instances = [];
    const page = fakePage({ deferArchive: true, previousReleasesExpanded: true });
    const refresh = installRoadmapSearch(() => true, page.win, page.doc);
    refresh();
    const input = page.doc.querySelector('.rsi-roadmap-search-input');
    const results = page.doc.querySelector('.rsi-roadmap-search-results');
    input.value = 'dynamic';
    input.dispatch('input');
    const observer = FakeMutationObserver.instances.find(item => item.target === page.releases);
    if (dismissal === 'focusout') page.doc.querySelector('.rsi-roadmap-search').dispatch('focusout');
    else page.doc.querySelector('.rsi-roadmap-search-result').click();
    assert.equal(results.hidden, true, `${dismissal} hides the result panel`);

    const lateCard = page.doc.createElement('a');
    lateCard.className = 'Card__StyledNavLink-test';
    const title = page.doc.createElement('h3');
    title.textContent = 'Archived Dynamic Meshing';
    lateCard.append(title);
    page.archiveCards.append(lateCard);
    observer.notify();
    assert.equal(results.hidden, true, `${dismissal} stays in effect after archive indexing`);
    refresh();
  }
});

test('late archive updates preserve keyboard focus on the same result', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ deferArchive: true, previousReleasesExpanded: true });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'meshing';
  input.dispatch('input');
  const observer = FakeMutationObserver.instances.find(item => item.target === page.releases);
  const first = page.doc.querySelector('.rsi-roadmap-search-result');
  const focusedLabel = first.getAttribute('aria-label');
  first.focus();

  const lateCard = page.doc.createElement('a');
  lateCard.className = 'Card__StyledNavLink-test';
  const title = page.doc.createElement('h3');
  title.textContent = 'Archived Meshing Improvements';
  lateCard.append(title);
  page.archiveCards.append(lateCard);
  observer.notify();
  assert.equal(page.doc.activeElement.getAttribute('aria-label'), focusedLabel);
  assert.equal(page.doc.activeElement.isConnected, true, 'the focused result remains attached after refreshing matches');
  refresh();
});

test('archive preload reports a searching state instead of a premature no-results message', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ deferArchive: true });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  input.value = 'quantum';
  input.dispatch('input');
  assert.match(results.textContent, /searching previous releases/i);
  assert.equal(page.doc.querySelector('.rsi-roadmap-search-empty').hidden, true);
  page.win.flushTimeouts();
  assert.equal(page.doc.querySelector('.rsi-roadmap-search-loading').hidden, true);
  assert.equal(page.doc.querySelector('.rsi-roadmap-search-empty').hidden, false);
  refresh();
});

test('Roadmap search mounts when the native board arrives after route activation', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ attachBoard: false });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const waiter = FakeMutationObserver.instances[0];
  assert.ok(waiter, 'a short-lived observer waits for the React Roadmap header');
  page.attach();
  waiter.notify();
  assert.ok(page.doc.querySelector('.rsi-roadmap-search-input'));
  assert.equal(waiter.disconnected, true);
  refresh();
});

test('Roadmap search reads new cards from the live DOM and reports empty searches', () => {
  const page = fakePage();
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  input.value = 'dynamic meshing';
  input.dispatch('input');
  assert.equal(page.previousReleasesButton.clickCount, 1, 'the native archive is opened before the first query');
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 2);
  assert.match(results.textContent, /Star Citizen 1\.0/);
  assert.match(results.textContent, /Core Tech/);
  assert.match(results.textContent, /Tentative/);
  assert.match(results.textContent, /Archived Dynamic Meshing Systems/);
  assert.match(results.textContent, /4\.5/);

  const secondWrapper = page.doc.createElement('section');
  secondWrapper.className = 'Card__Wrapper-test';
  const secondAnchor = page.doc.createElement('a');
  secondAnchor.className = 'Card__StyledNavLink-test';
  const secondTitlebar = page.doc.createElement('header');
  secondTitlebar.className = 'Card__TitleBar-test';
  const secondTitle = page.doc.createElement('h3');
  secondTitle.textContent = 'Instancing Dynamic Meshing Support';
  secondTitlebar.append(secondTitle);
  secondAnchor.append(secondTitlebar);
  secondWrapper.append(secondAnchor);
  page.cards.append(secondWrapper);
  FakeMutationObserver.instances.find(observer => observer.target === page.releases)?.notify();
  input.value = 'dynamic meshing';
  input.dispatch('input');
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 3, 'new current and archived cards are indexed on the next query');

  input.value = 'no matching card';
  input.dispatch('input');
  assert.match(results.textContent, /No Roadmap cards match/);
  input.value = '   ';
  input.dispatch('input');
  assert.equal(results.hidden, true, 'an empty query hides the dropdown');
  assert.equal(input.getAttribute('aria-expanded'), 'false');
  refresh();
});

test('Roadmap search waits for asynchronously rendered previous-release cards', () => {
  FakeMutationObserver.instances = [];
  const page = fakePage({ deferArchive: true });
  let enabled = true;
  const refresh = installRoadmapSearch(() => enabled, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  input.value = 'archived meshing';
  input.dispatch('input');
  assert.equal(page.previousReleasesButton.clickCount, 1);
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 0, 'archive content has not arrived yet');
  const archiveObserver = FakeMutationObserver.instances.find(observer => observer.target === page.releases);
  assert.ok(archiveObserver, 'the board is observed while the native archive expands');
  page.attachArchive();
  archiveObserver.notify();
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 1);
  assert.match(results.textContent, /Archived Dynamic Meshing Systems/);
  const lateCard = page.doc.createElement('a');
  lateCard.className = 'Card__StyledNavLink-test';
  const lateTitle = page.doc.createElement('h3');
  lateTitle.textContent = 'Archived Dynamic Meshing Refinements';
  lateCard.append(lateTitle);
  page.archiveCards.append(lateCard);
  archiveObserver.notify();
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 2, 'later archive batches are picked up until the native release list settles');
  assert.match(results.textContent, /Archived Dynamic Meshing Refinements/);
  assert.equal(archiveObserver.disconnected, false, 'the observer stays active while archived cards are still arriving');
  page.win.flushTimeouts();
  assert.equal(archiveObserver.disconnected, false, 'archive indexing remains active after a quiet period');
  enabled = false;
  refresh();
  assert.equal(archiveObserver.disconnected, true);
});

test('Roadmap search supports keyboard navigation and dismisses the results', () => {
  const page = fakePage();
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'dynamic';
  input.dispatch('input');
  const first = page.doc.querySelector('.rsi-roadmap-search-result');
  const down = input.dispatch('keydown', { key: 'ArrowDown' });
  assert.equal(down.defaultPrevented, true);
  assert.equal(page.doc.activeElement, first);
  first.dispatch('keydown', { key: 'Escape' });
  assert.equal(page.doc.querySelector('.rsi-roadmap-search-results').hidden, true);
  assert.equal(page.doc.activeElement, input);
  refresh();
});

test('selecting a result expands its collapsed category, scrolls and highlights without opening the native card', () => {
  const page = fakePage({ categoryExpanded: false });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'dynamic';
  input.dispatch('input');
  page.doc.querySelector('.rsi-roadmap-search-result').click();
  assert.equal(page.categoryHeader.clickCount, 1);
  assert.equal(page.release.scrollCalls.length, 1);
  assert.equal(page.anchor.scrollCalls.length, 1);
  assert.equal(page.doc.activeElement, page.anchor, 'keyboard focus moves from the dismissed result to the target card');
  assert.equal(page.anchor.classList.contains('rsi-roadmap-search-highlight'), true);
  assert.ok([...page.timeoutDelays.values()].includes(5000), 'the bright card outline remains visible long enough to find the result');
  assert.equal(page.nativeCardClicks, 0, 'search selection does not activate the native detail link');
  page.win.flushTimeouts();
  assert.equal(page.anchor.classList.contains('rsi-roadmap-search-highlight'), false, 'the search highlight is temporary');
  page.anchor.click();
  assert.equal(page.nativeCardClicks, 1, 'the native card link remains clickable');
  refresh();
});

test('selecting a previous-release result jumps to the archived patch and card', () => {
  const page = fakePage();
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'archived meshing';
  input.dispatch('input');
  const results = page.doc.querySelectorAll('.rsi-roadmap-search-result');
  assert.equal(results.length, 1);
  results[0].click();
  assert.equal(page.archiveRelease.scrollCalls.length, 1);
  assert.equal(page.archiveAnchor.scrollCalls.length, 1);
  assert.equal(page.archiveAnchor.classList.contains('rsi-roadmap-search-highlight'), true);
  assert.equal(page.previousReleasesButton.getAttribute('aria-expanded'), 'true', 'the selected archived patch stays visible');
  refresh();
});

test('disabling search before the selection frame prevents stale scrolling and highlighting', () => {
  const page = fakePage({ deferFrames: true });
  let enabled = true;
  const refresh = installRoadmapSearch(() => enabled, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'dynamic';
  input.dispatch('input');
  page.win.flushFrames();
  page.doc.querySelector('.rsi-roadmap-search-result').click();
  enabled = false;
  refresh();
  page.win.flushFrames();
  assert.equal(page.release.scrollCalls.length, 0);
  assert.equal(page.anchor.scrollCalls.length, 0);
  assert.equal(page.anchor.classList.contains('rsi-roadmap-search-highlight'), false);
});

test('selecting a result in an expanded category does not collapse it and disabling search removes the UI', () => {
  const page = fakePage({ categoryExpanded: true });
  let enabled = true;
  const refresh = installRoadmapSearch(() => enabled, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'dynamic';
  input.dispatch('input');
  page.doc.querySelector('.rsi-roadmap-search-result').click();
  assert.equal(page.categoryHeader.clickCount, 0, 'already expanded categories are left open');
  enabled = false;
  refresh();
  assert.equal(page.doc.querySelector('.rsi-roadmap-search'), null);
  assert.equal(page.anchor.classList.contains('rsi-roadmap-search-highlight'), false);
});

test('Roadmap filter popover opens with all statuses selected and leaves categories collapsed', () => {
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();

  const filterButton = page.doc.querySelector('.rsi-roadmap-search-filter-button');
  assert.ok(filterButton, 'search has a filter popover button');
  filterButton.click();

  const popover = page.doc.querySelector('.rsi-roadmap-search-filter-popover');
  assert.equal(popover.hidden, false, 'the filter popover opens');
  assert.equal(filterButton.getAttribute('aria-expanded'), 'true');
  assert.deepEqual(page.doc.querySelectorAll('.rsi-roadmap-search-filter-status').map(status => status.checked), [true, true, true]);
  assert.equal(page.previousReleasesButton.clickCount, 1, 'opening filters prepares previous-release search data');
  assert.equal(page.categoryOpen, false, 'opening filters does not expand current categories');
  assert.equal(page.archiveCategoryHeader.getAttribute('aria-expanded'), 'false', 'opening filters leaves previous-release categories collapsed');
  refresh();
});

test('category options include roadmap headings even when their cards are not indexed', () => {
  const page = fakePage({ archiveCategoryName: 'Gameplay' });
  page.cards.replaceChildren();
  const categoryText = page.doc.createElement('div');
  categoryText.className = 'Category__HeaderText-test';
  const entryCount = page.doc.createElement('span');
  entryCount.textContent = '1 Entry';
  categoryText.append(entryCount);
  const categoryName = page.doc.createElement('span');
  categoryName.textContent = 'Core Tech';
  page.categoryHeader.replaceChildren(categoryText, categoryName);
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();

  openFilterPopover(page.doc);
  const category = page.doc.querySelector('.rsi-roadmap-search-filter-category');
  const labels = category.children.map(option => option.textContent);

  assert.ok(labels.includes('Core Tech'), 'collapsed current categories are available as filter choices');
  assert.ok(labels.includes('Gameplay'), 'categories with indexed previous-release cards remain available');
  assert.equal(labels.some(label => /^\d+ entries?$/i.test(label)), false, 'entry counts are never offered as category names');
  refresh();
});

test('Roadmap filters intersect status, category, and text matches across previous releases', () => {
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements', archiveCategoryName: 'Gameplay' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'quantum';
  input.dispatch('input');

  openFilterPopover(page.doc);
  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  const released = page.doc.querySelectorAll('.rsi-roadmap-search-filter-status').find(status => status.value === 'released');
  assert.ok(released, 'the filter popover has a Released status option');
  released.checked = false;
  released.dispatch('change');
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 0, 'unchecking Released removes the archived Released result');

  released.checked = true;
  released.dispatch('change');
  const category = page.doc.querySelector('.rsi-roadmap-search-filter-category');
  assert.ok(category.children.some(option => option.textContent === 'Gameplay'), 'categories include previous-release cards');
  category.value = 'Gameplay';
  category.dispatch('change');
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 1);
  assert.match(results.textContent, /Quantum Travel Improvements/);
  assert.match(results.textContent, /Gameplay/);
  assert.equal(page.archiveCategoryHeader.getAttribute('aria-expanded'), 'false', 'filtering keeps previous-release categories collapsed');
  refresh();
});

test('category filters show matching cards when the text query is empty', () => {
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements', archiveCategoryName: 'Gameplay' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  openFilterPopover(page.doc);
  const category = page.doc.querySelector('.rsi-roadmap-search-filter-category');
  category.value = 'Gameplay';
  category.dispatch('change');

  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  assert.equal(page.doc.querySelector('.rsi-roadmap-search-input').value, '');
  assert.equal(results.hidden, false, 'active filters open results without a text query');
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 1);
  assert.match(results.textContent, /Quantum Travel Improvements/);
  refresh();
});

test('Escape from a keyboard-focused result closes the filter popover too', () => {
  const page = fakePage();
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'dynamic';
  input.dispatch('input');
  openFilterPopover(page.doc);
  const result = page.doc.querySelector('.rsi-roadmap-search-result');
  input.dispatch('keydown', { key: 'ArrowDown' });

  result.dispatch('keydown', { key: 'Escape' });

  assert.equal(page.doc.querySelector('.rsi-roadmap-search-filter-popover').hidden, true);
  assert.equal(page.doc.querySelector('.rsi-roadmap-search-results').hidden, true);
  refresh();
});

test('refocusing search reopens results when filters are active and the query is empty', () => {
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements', archiveCategoryName: 'Gameplay' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  openFilterPopover(page.doc);
  const category = page.doc.querySelector('.rsi-roadmap-search-filter-category');
  category.value = 'Gameplay';
  category.dispatch('change');
  const search = page.doc.querySelector('.rsi-roadmap-search');
  const results = page.doc.querySelector('.rsi-roadmap-search-results');
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 1);

  search.dispatch('focusout', { relatedTarget: page.doc.body });
  assert.equal(results.hidden, true, 'leaving search dismisses its results');
  page.doc.querySelector('.rsi-roadmap-search-input').focus();

  assert.equal(results.hidden, false, 'returning to search restores the active filter results');
  assert.equal(results.querySelectorAll('.rsi-roadmap-search-result').length, 1);
  refresh();
});

test('clearing every status produces no matches', () => {
  const page = fakePage();
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  openFilterPopover(page.doc);
  for (const status of page.doc.querySelectorAll('.rsi-roadmap-search-filter-status')) {
    status.checked = false;
    status.dispatch('change');
  }

  assert.equal(page.doc.querySelectorAll('.rsi-roadmap-search-result').length, 0);
  assert.match(page.doc.querySelector('.rsi-roadmap-search-count').textContent, /^0 matching cards$/);
  refresh();
});

test('disabling Roadmap search removes the filter outside-click listener', () => {
  const page = fakePage();
  let enabled = true;
  const refresh = installRoadmapSearch(() => enabled, page.win, page.doc);
  refresh();
  openFilterPopover(page.doc);
  assert.equal(page.doc.listeners.get('pointerdown').length, 1);

  enabled = false;
  refresh();

  assert.equal(page.doc.listeners.get('pointerdown').length, 0);
  assert.equal(page.doc.querySelector('.rsi-roadmap-search'), null);
});

test('clearing roadmap filters restores defaults without clearing the search query', () => {
  const page = fakePage({ lazyArchiveCategory: true, archiveCardTitle: 'Quantum Travel Improvements', archiveCategoryName: 'Gameplay' });
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const input = page.doc.querySelector('.rsi-roadmap-search-input');
  input.value = 'quantum';
  input.dispatch('input');
  openFilterPopover(page.doc);
  const category = page.doc.querySelector('.rsi-roadmap-search-filter-category');
  category.value = 'Gameplay';
  category.dispatch('change');
  page.doc.querySelector('.rsi-roadmap-search-filter-clear').click();

  assert.equal(input.value, 'quantum', 'clearing filters keeps the text query');
  assert.equal(category.value, '', 'clearing filters restores All categories');
  assert.deepEqual(page.doc.querySelectorAll('.rsi-roadmap-search-filter-status').map(status => status.checked), [true, true, true]);
  assert.equal(page.doc.querySelectorAll('.rsi-roadmap-search-result').length, 1);
  refresh();
});

test('filter popover closes on Escape and outside pointer interaction', () => {
  const page = fakePage();
  const refresh = installRoadmapSearch(() => true, page.win, page.doc);
  refresh();
  const filterButton = openFilterPopover(page.doc);
  const popover = page.doc.querySelector('.rsi-roadmap-search-filter-popover');
  popover.dispatch('keydown', { key: 'Escape' });
  assert.equal(popover.hidden, true, 'Escape closes the popover');
  assert.equal(filterButton.getAttribute('aria-expanded'), 'false');

  filterButton.click();
  page.doc.dispatch('pointerdown', { target: page.doc.body });
  assert.equal(popover.hidden, true, 'an outside pointer closes the popover');
  refresh();
});
