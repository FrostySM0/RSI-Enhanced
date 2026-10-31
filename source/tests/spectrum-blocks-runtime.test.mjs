import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installEnhancedBlocks } from '../src/content/spectrum-blocks.ts';
import { HIDDEN_USER_PREFIX } from '../src/shared/hidden-users.ts';

// Minimal DOM contract for message identity, sibling order and observer delivery.
// Mutations are delivered explicitly so these tests exercise the real installer.
class ElementStub {
  constructor(classes = '', children = []) {
    this.classes = new Set(classes.split(' ').filter(Boolean));
    this.children = children;
    this.dataset = {};
    this.isConnected = true;
    this.classList = {
      toggle: (name, enabled) => enabled ? this.classes.add(name) : this.classes.delete(name),
      remove: name => this.classes.delete(name),
      contains: name => this.classes.has(name),
    };
    for (const child of children) child.parentElement = this;
  }
  matches(selector) {
    return selector.split(',').some(part => /^\.[\w.-]+$/.test(part.trim()) &&
      part.trim().slice(1).split('.').every(name => this.classes.has(name)));
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  get previousElementSibling() {
    const children = this.parentElement?.children || [];
    return children[children.indexOf(this) - 1] || null;
  }
  get nextElementSibling() {
    const children = this.parentElement?.children || [];
    return children[children.indexOf(this) + 1] || null;
  }
  get nextSibling() { return this.nextElementSibling; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) {
    if (selector === ':scope > .content > .top') return this.header || null;
    if (selector === ':scope > .content > .content-main') {
      const content = this.children.find(child => child.matches('.content'));
      return content?.children.find(child => child.matches('.content-main')) || null;
    }
    if (selector === ':scope > .content-header') return this.children.find(child => child.matches('.content-header')) || null;
    return this.querySelectorAll(selector)[0] || null;
  }
  setAttribute() {}
}
function message(handle, grouped = false) {
  const row = new ElementStub(`message-item${grouped ? ' type-small' : ''}`);
  if (!grouped) {
    const nickname = new ElementStub('member-nickname'); nickname.textContent = `@${handle}`;
    row.header = new ElementStub('top', [nickname]); row.header.parentElement = row;
    row.children = [row.header]; row.nickname = nickname;
  }
  return row;
}
async function harness(rows, run, { storageError, failStorageReads } = {}) {
  const names = ['Element', 'HTMLElement', 'MutationObserver', 'chrome'];
  const originals = names.map(name => globalThis[name]);
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const warnings = [];
  const infos = [];
  console.warn = (...args) => warnings.push(args);
  console.info = (...args) => infos.push(args);
  const list = new ElementStub('messages-items', rows);
  const body = new ElementStub('', [list]);
  let deliver, observing = false;
  const saved = {
    'rsiEnhanced.hiddenUsers.initialized': true,
    [HIDDEN_USER_PREFIX + 'hidden']: { handle: 'hidden', name: 'Hidden' },
  };
  let storageReads = 0;
  globalThis.Element = globalThis.HTMLElement = ElementStub;
  globalThis.MutationObserver = class {
    constructor(callback) { deliver = callback; }
    observe() { observing = true; }
    disconnect() { observing = false; }
  };
  globalThis.chrome = { storage: {
    local: { get: async () => {
      storageReads++;
      if (storageError && (failStorageReads === undefined || storageReads <= failStorageReads)) throw storageError;
      return saved;
    } }, onChanged: { addListener() {} },
  } };
  const doc = { readyState: 'complete', body, documentElement: new ElementStub(),
    querySelectorAll: selector => body.querySelectorAll(selector) };
  let enabled = true;
  const refresh = installEnhancedBlocks(() => enabled, doc);
  const flush = () => new Promise(setImmediate);
  try {
    refresh(); await flush();
    await run({ list, deliver: async record => { assert.ok(observing); deliver([record]); await flush(); },
      disable: () => { enabled = false; refresh(); }, warnings, infos, storageReadCount: () => storageReads });
  } finally {
    enabled = false; refresh();
    console.warn = originalWarn;
    console.info = originalInfo;
    names.forEach((name, index) => {
      if (originals[index] === undefined) delete globalThis[name]; else globalThis[name] = originals[index];
    });
  }
}
const removed = row => row.classes.has('rsi-remove-author');

test('hidden-user storage failures include the underlying error in the warning', async () => {
  const storageError = new Error('Storage access denied.');
  await harness([message('visible')], async ({ warnings, infos }) => {
    await new Promise(resolve => setTimeout(resolve, 400));
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0][0], '[RSI Enhanced] Could not load removed users.');
    assert.equal(warnings[0][1], storageError);
    assert.equal(infos.length, 0);
  }, { storageError });
});

test('a temporary hidden-user storage failure is retried and the saved users are applied', async () => {
  const storageError = new Error('Temporary storage failure.');
  const hiddenRow = message('hidden');
  await harness([hiddenRow], async ({ warnings, storageReadCount }) => {
    await new Promise(resolve => setTimeout(resolve, 180));
    assert.ok(storageReadCount() >= 3, 'retry initializes and reloads the saved user list');
    assert.equal(warnings.length, 0, 'a recovered read is not reported as a persistent error');
    assert.equal(removed(hiddenRow), true, 'the recovered hidden-user list is applied to the post');
  }, { storageError, failStorageReads: 1 });
});

test('extension reload invalidation asks for a page refresh without reporting a storage error', async () => {
  const storageError = new Error('Extension context invalidated.');
  await harness([message('visible')], async ({ warnings, infos }) => {
    assert.equal(warnings.length, 0);
    assert.deepEqual(infos, [[
      '[RSI Enhanced] The extension was reloaded. Refresh this page to reconnect removed users.',
    ]]);
  }, { storageError });
});

test('grouped messages follow changed author text and stop at the next full message', async () => {
  const lead = message('hidden'), first = message(null, true), second = message(null, true);
  const next = message('hidden'), nextGrouped = message(null, true);
  await harness([lead, first, second, next, nextGrouped], async ({ deliver, disable }) => {
    assert.deepEqual([lead, first, second, next, nextGrouped].map(removed), [true,true,true,true,true]);
    lead.nickname.textContent = '@visible';
    await deliver({ type: 'characterData', target: { parentElement: lead.nickname } });
    assert.deepEqual([lead, first, second, next, nextGrouped].map(removed), [false,false,false,true,true]);
    lead.nickname.textContent = '@hidden';
    await deliver({ type: 'childList', target: lead.nickname, addedNodes: [], removedNodes: [] });
    assert.ok(first.classes.has('type-small')); // Native grouping is unchanged.
    assert.ok(removed(first) && removed(second));
    disable(); assert.ok(!removed(first) && !removed(nextGrouped));
  });
});

test('grouped messages recompute after their full author message is replaced', async () => {
  const lead = message('visible'), grouped = message(null, true);
  await harness([lead, grouped], async ({ list, deliver }) => {
    assert.equal(removed(grouped), false);
    const replacement = message('hidden'); replacement.parentElement = list;
    list.children[0] = replacement; lead.parentElement = null; lead.isConnected = false;
    await deliver({ type: 'childList', target: list, addedNodes: [replacement], removedNodes: [lead], nextSibling: grouped });
    assert.equal(removed(grouped), true);
  });
});

test('removing a full author message restores orphan grouped messages', async () => {
  const lead = message('hidden'), first = message(null, true), second = message(null, true);
  await harness([lead, first, second], async ({ list, deliver }) => {
    assert.ok(removed(first) && removed(second));
    list.children.shift(); lead.parentElement = null; lead.isConnected = false;
    await deliver({ type: 'childList', target: list, addedNodes: [], removedNodes: [lead], nextSibling: first });
    assert.ok(!removed(first) && !removed(second));
  });
});

test('removing an author recomputes grouped messages from the surviving preceding group', async () => {
  const previous = message('hidden'), lead = message('visible'), grouped = message(null, true);
  await harness([previous, lead, grouped], async ({ list, deliver }) => {
    assert.equal(removed(grouped), false);
    list.children.splice(1, 1); lead.parentElement = null; lead.isConnected = false;
    await deliver({ type: 'childList', target: list, addedNodes: [], removedNodes: [lead], nextSibling: grouped });
    assert.equal(removed(grouped), true);
  });
});

test('forum posts still match blocked authors when RSI moves the author header', async () => {
  const post = new ElementStub('forum-thread-item');
  const content = new ElementStub('content'), main = new ElementStub('content-main');
  const metadata = new ElementStub('post-metadata'), author = new ElementStub('member-nickname');
  author.textContent = '@hidden';
  metadata.children.push(author); author.parentElement = metadata;
  main.children.push(metadata); metadata.parentElement = main;
  content.children.push(main); main.parentElement = content;
  post.children.push(content); content.parentElement = post;

  await harness([post], async () => {
    assert.ok(removed(post), 'the blocked author post should be hidden even when its header nesting changes');
  });
});

test('forum author fallback does not use a nested reply author for its parent', async () => {
  const post = new ElementStub('forum-thread-item');
  const content = new ElementStub('content'), main = new ElementStub('content-main');
  const parentAuthor = new ElementStub('member-nickname'); parentAuthor.textContent = '@visible';
  main.children.push(parentAuthor); parentAuthor.parentElement = main;
  const replies = new ElementStub('forum-thread-item-children-replies');
  const child = new ElementStub('forum-thread-item'), childContent = new ElementStub('content'), childMain = new ElementStub('content-main');
  const childAuthor = new ElementStub('member-nickname'); childAuthor.textContent = '@hidden';
  childMain.children.push(childAuthor); childAuthor.parentElement = childMain;
  childContent.children.push(childMain); childMain.parentElement = childContent;
  child.children.push(childContent); childContent.parentElement = child;
  replies.children.push(child); child.parentElement = replies;
  content.children.push(main, replies); main.parentElement = replies.parentElement = content;
  post.children.push(content); content.parentElement = post;

  await harness([post], async () => {
    assert.equal(removed(post), false, 'the visible parent should remain');
    assert.equal(removed(child), true, 'the hidden author reply should be removed');
  });
});

test('native blocked-user notice inherits removal from its hidden forum post', async () => {
  const post = new ElementStub('forum-thread-item');
  const content = new ElementStub('content'), main = new ElementStub('content-main');
  const author = new ElementStub('member-nickname'); author.textContent = '@hidden';
  main.children.push(author); author.parentElement = main;
  const notice = new ElementStub('blocked-content');
  notice.textContent = 'Post by a blocked user. Show anyway';
  content.children.push(main, notice); main.parentElement = notice.parentElement = content;
  post.children.push(content); content.parentElement = post;

  await harness([post], async () => {
    assert.equal(removed(post), true, 'the author’s post should be marked for removal');
    assert.equal(removed(notice), true, 'the native blocked-user notice should be removed with the post');
  });
});

test('native blocked notices without author metadata are removed by their RSI marker', async () => {
  const notice = new ElementStub('blocked-content blocked-content--block');
  notice.textContent = 'Post by a blocked user. Show anyway';

  await harness([notice], async () => {
    assert.equal(removed(notice), true, 'RSI marks this notice as content from a blocked user');
  });
});
