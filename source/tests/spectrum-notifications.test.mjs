import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifySpectrumNotification, installSpectrumNotificationFilters } from '../src/content/spectrum-notifications.ts';

class ElementStub {
  constructor(tagName = 'div', className = '', text = '') {
    this.tagName = tagName.toUpperCase();
    this.className = className;
    this.ownText = text;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.classList = {
      add: name => { if (!this.classList.contains(name)) this.className = `${this.className} ${name}`.trim(); },
      remove: name => { this.className = this.className.split(/\s+/).filter(item => item !== name).join(' '); },
      contains: name => this.className.split(/\s+/).includes(name),
    };
  }
  get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  append(...nodes) {
    for (const node of nodes) { node.parentElement = this; this.children.push(node); }
  }
  insertBefore(node, reference) {
    const index = this.children.indexOf(reference);
    node.parentElement = this;
    this.children.splice(index < 0 ? this.children.length : index, 0, node);
  }
  removeChild(node) {
    const index = this.children.indexOf(node);
    if (index >= 0) this.children.splice(index, 1);
    node.parentElement = null;
    return node;
  }
  remove() { this.parentElement?.removeChild(this); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) ?? [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }
  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(item => item !== callback));
  }
  click() { for (const callback of this.listeners.get('click') ?? []) callback({ currentTarget: this }); }
  matches(selector) {
    const classMatch = selector.match(/^\.([\w-]+)$/);
    if (classMatch) return this.classList.contains(classMatch[1]);
    return selector.toUpperCase() === this.tagName.toUpperCase();
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) {
    if (selector === '.item-text strong') return this.querySelector('.item-text')?.querySelector('strong') ?? null;
    if (selector === 'strong') return this.querySelectorAll('strong')[0] ?? null;
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

function notification(tagName, summary, detail) {
  const row = new ElementStub(tagName, 'notifications-item');
  const details = new ElementStub('div', 'item-details');
  const text = new ElementStub('div', 'item-text');
  text.append(new ElementStub('strong', '', summary), new ElementStub('span', '', detail));
  details.append(text);
  row.append(details);
  return row;
}

function panelFixture(rows, panelInitiallyMounted = true) {
  const header = new ElementStub('div', 'quick-access-header');
  const list = new ElementStub('div', 'notifications-list');
  list.append(...rows);
  const main = new ElementStub('div', 'notifications-main');
  main.append(header, list);
  const notifications = new ElementStub('div', 'quick-access notifications');
  notifications.append(main);
  const documentElement = new ElementStub('html');
  let currentPanel = panelInitiallyMounted ? notifications : null;
  if (currentPanel) documentElement.append(currentPanel);
  const doc = {
    documentElement,
    readyState: 'complete',
    createElement: tagName => new ElementStub(tagName),
    querySelector: selector => selector === 'aside.quick-access.notifications' ? currentPanel : null,
    addEventListener() {},
    removeEventListener() {},
  };
  return {
    doc, main, header, list, notifications,
    mountPanel() { currentPanel = notifications; documentElement.append(notifications); },
  };
}

test('notification filter buttons filter matching native rows and preserve their order', () => {
  const observers = [];
  class MutationObserverStub {
    constructor(callback) { this.callback = callback; this.isObserving = false; observers.push(this); }
    observe() { this.isObserving = true; }
    disconnect() { this.isObserving = false; }
    deliver(records) { if (this.isObserving) this.callback(records); }
  }
  const replies = notification('a', '2 new replies', ' in the thread Fixture topic');
  const votes = notification('a', '14 votes', ' for your reply in the thread Fixture topic');
  const mention = notification('a', 'Godin', ' mentioned you in general');
  const moderation = notification('div', 'Moderator has deleted', ' your reply');
  const { doc, main, header, list } = panelFixture([replies, votes, mention, moderation]);
  const win = { MutationObserver: MutationObserverStub };
  let enabled = true;
  const refresh = installSpectrumNotificationFilters(() => enabled, doc, win);

  refresh();

  const filters = main.querySelector('.rsi-notification-filters');
  const buttons = filters.querySelectorAll('.rsi-notification-filter');
  assert.deepEqual(buttons.map(button => button.textContent), ['All', 'Replies', 'Votes', 'Mentions', 'Moderation']);
  assert.equal(main.children[0], header, 'native header stays first');
  assert.equal(main.children[1], filters, 'filters sit between the native header and list');
  assert.equal(main.children[2], list, 'native notification list stays in place');

  const select = label => main.querySelector('.rsi-notification-filters')
    .querySelectorAll('.rsi-notification-filter').find(button => button.textContent === label).click();
  select('Votes');
  assert.deepEqual([replies, votes, mention, moderation].map(row => row.hidden), [true, false, true, true]);
  assert.deepEqual(list.children, [replies, votes, mention, moderation], 'filtered rows stay in Spectrum order');
  assert.equal(buttons.find(button => button.textContent === 'Votes').getAttribute('aria-pressed'), 'true');

  const lateReply = notification('a', '3 new replies', ' in the thread Another topic');
  list.append(lateReply);
  assert.ok(observers.at(-1).isObserving);
  observers.at(-1).deliver([{ type: 'childList', target: list, addedNodes: [lateReply] }]);
  assert.equal(lateReply.hidden, true, 'new React rows use the active filter');

  filters.remove();
  observers.at(-1).deliver([{ type: 'childList', target: main, removedNodes: [filters] }]);
  const remountedFilters = main.querySelector('.rsi-notification-filters');
  assert.ok(remountedFilters, 'React replacements do not remove the filter controls permanently');
  assert.equal(remountedFilters.querySelectorAll('.rsi-notification-filter')
    .find(button => button.textContent === 'Votes').getAttribute('aria-pressed'), 'true',
  'the active selection is retained when controls are remounted');

  select('All');
  assert.deepEqual([replies, votes, mention, moderation, lateReply].map(row => row.hidden), [false, false, false, false, false]);

  enabled = false;
  refresh();
  assert.equal(main.querySelector('.rsi-notification-filters'), null, 'controls are removed when the module is disabled');
  assert.equal(observers.at(-1).isObserving, false, 'the list observer is disconnected when disabled');
});

test('notification filters install when Spectrum mounts the bell panel after page load', () => {
  const observers = [];
  class MutationObserverStub {
    constructor(callback) { this.callback = callback; this.isObserving = false; observers.push(this); }
    observe() { this.isObserving = true; }
    disconnect() { this.isObserving = false; }
    deliver(records) { if (this.isObserving) this.callback(records); }
  }
  const fixture = panelFixture([], false);
  const win = {
    MutationObserver: MutationObserverStub,
    requestAnimationFrame: callback => callback(),
    setTimeout: () => 1,
    clearTimeout() {},
  };
  const refresh = installSpectrumNotificationFilters(() => true, fixture.doc, win);
  refresh();
  assert.equal(fixture.main.querySelector('.rsi-notification-filters'), null);

  fixture.mountPanel();
  observers[0].deliver([{ type: 'childList', target: fixture.doc.documentElement, addedNodes: [fixture.notifications] }]);
  assert.ok(fixture.main.querySelector('.rsi-notification-filters'), 'the filter bar is added when the popup appears');
  assert.equal(observers[0].isObserving, false, 'site-wide discovery stops after the popup is found');
});

test('notification types use the visible action text and recognize moderator notices', () => {
  assert.equal(classifySpectrumNotification(notification('a', '14 votes', ' for your reply')), 'votes');
  assert.equal(classifySpectrumNotification(notification('a', '2 new replies', ' in a thread')), 'replies');
  assert.equal(classifySpectrumNotification(notification('a', 'Godin', ' mentioned you in general')), 'mentions');
  assert.equal(classifySpectrumNotification(notification('div', 'Moderator has deleted', ' your reply')), 'moderation');
  assert.equal(classifySpectrumNotification(notification('div', 'Your reply was removed', ' by a moderator')), 'moderation');
  assert.equal(classifySpectrumNotification(notification('a', '1 new vote', ' for your reply')), 'votes');
  assert.equal(classifySpectrumNotification(notification('a', 'a new reply', ' to your thread')), 'replies');
  assert.equal(classifySpectrumNotification(notification('a', 'Replies', ' to your thread')), 'replies');
  assert.equal(classifySpectrumNotification(notification('a', 'Your guiding session', ' has now ended')), 'other');
});
