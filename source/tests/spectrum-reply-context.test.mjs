import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installReplyContexts } from '../src/content/spectrum-reply-context.ts';

class FakeElement {
  constructor(className = '', textContent = '') {
    this.className = className;
    this.textContent = textContent;
    this.children = [];
    this.parentElement = null;
    this.attributes = new Map();
    this.nodeType = 1;
  }

  get classList() { return { contains: name => this.className.split(/\s+/).includes(name) }; }
  append(...children) { for (const child of children) this.insertBefore(child, null); }
  insertBefore(child, reference) {
    child.remove();
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    child.parentElement = this;
    return child;
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  matches(selector) {
    const classNames = selector.split('.').filter(Boolean);
    return classNames.every(name => this.classList.contains(name));
  }
  closest(selector) {
    for (let element = this; element; element = element.parentElement) if (element.matches(selector)) return element;
    return null;
  }
  descendants() {
    return this.children.flatMap(child => [child, ...child.descendants()]);
  }
  querySelectorAll(selector) { return this.descendants().filter(element => element.matches(selector)); }
  querySelector(selector) {
    if (selector === ':scope > .content > .content-main') {
      return this.children.find(child => child.classList.contains('content'))?.children.find(child => child.classList.contains('content-main')) ?? null;
    }
    if (selector.startsWith(':scope > .')) {
      const name = selector.slice(':scope > .'.length);
      return this.children.find(child => child.classList.contains(name)) ?? null;
    }
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

function authorContent(handle) {
  const main = new FakeElement('content-main');
  const header = new FakeElement('content-header');
  header.append(new FakeElement('member-handle', handle));
  main.append(header, new FakeElement('content-blocks'));
  return main;
}

function reply(handle, className = 'forum-thread-item type-forum_thread_reply') {
  const item = new FakeElement(className);
  const content = new FakeElement('content');
  content.append(authorContent(handle));
  item.append(content);
  return item;
}

test('conversation stream labels parent authors, follows late replies and cleans up when disabled', () => {
  const rootPost = reply('@OriginalAuthor', 'forum-thread-item type-forum_thread');
  const topReply = reply('@FirstReply');
  const nestedReply = reply('@NestedReply');
  const topChildren = new FakeElement('forum-thread-item-children-replies');
  topReply.querySelector('.content-main').append(topChildren);
  topChildren.append(nestedReply);
  const replies = new FakeElement('forum-thread-replies');
  replies.append(topReply);
  const thread = new FakeElement('forum-thread');
  thread.append(rootPost, replies);
  const documentRoot = new FakeElement('html');
  documentRoot.append(thread);
  const frames = [];
  let observer;
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; observer = this; }
    observe(target) { this.target = target; }
    disconnect() { this.target = null; }
    trigger() { this.callback([]); }
  }
  const document = {
    documentElement: documentRoot,
    querySelector: selector => selector === '#react #page.forum-thread' ? thread : null,
    querySelectorAll: selector => documentRoot.querySelectorAll(selector),
    createElement: () => new FakeElement(),
  };
  const window = {
    location: { pathname: '/spectrum/community/SC/forum/3/thread/example' },
    MutationObserver: FakeMutationObserver,
    requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
    cancelAnimationFrame() {},
  };
  let enabled = true;
  const refresh = installReplyContexts(() => enabled, window, document);

  refresh();
  const labels = () => document.querySelectorAll('.rsi-reply-context');
  assert.deepEqual(labels().map(label => label.textContent), [
    'Replying to @OriginalAuthor',
    'Replying to @FirstReply',
  ]);
  assert.equal(labels()[0].parentElement.classList.contains('content-main'), true);

  const lateReply = reply('@LateReply');
  const nestedChildren = new FakeElement('forum-thread-item-children-replies');
  nestedReply.querySelector('.content-main').append(nestedChildren);
  nestedChildren.append(lateReply);
  observer.trigger();
  frames.shift()();
  assert.equal(labels().at(-1).textContent, 'Replying to @NestedReply');

  enabled = false;
  refresh();
  assert.equal(labels().length, 0);
  assert.equal(observer.target, null);
});
