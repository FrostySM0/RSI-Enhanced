import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installSpectrumChatMessageGroups } from '../src/content/spectrum-chat-groups.ts';

class ElementStub {
  constructor(classes = '', children = []) {
    this.classes = new Set(classes.split(' ').filter(Boolean));
    this.children = children;
    this.dataset = {};
    this.isConnected = true;
    this.parentElement = null;
    for (const child of children) child.parentElement = this;
    this.classList = {
      contains: name => this.classes.has(name),
    };
  }

  matches(selector) {
    return selector.split(',').some(part => {
      const classes = part.trim().split('.').filter(Boolean);
      return classes.every(name => this.classes.has(name));
    });
  }

  querySelector(selector) {
    if (selector.includes('.member-nickname')) return this.nickname || null;
    return null;
  }
}

function message(handle, grouped = false) {
  const row = new ElementStub(`message-item${grouped ? ' type-small' : ''}`);
  if (!grouped) {
    row.nickname = { textContent: `@${handle}` };
  }
  return row;
}

test('chat separators group consecutive messages from the same handle and retain author boundaries', () => {
  const first = message('Fambaa');
  const followUp = message('unused', true);
  const repeated = message('fambaa');
  const nextAuthor = message('OtherCitizen');
  const list = new ElementStub('messages-items', [first, followUp, repeated, nextAuthor]);
  const originalObserver = globalThis.MutationObserver;
  const observers = [];
  globalThis.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(target, options) { this.target = target; this.options = options; }
    disconnect() { this.disconnected = true; }
    emit() { this.callback([{ type: 'childList', target: this.target }]); }
  };

  let enabled = true;
  const refresh = installSpectrumChatMessageGroups(() => enabled, {
    querySelector: selector => selector.includes('.messages-items') ? list : null,
    documentElement: new ElementStub(),
  });
  try {
    refresh();
    assert.equal(first.dataset.rsiChatSameAuthorNext, 'true');
    assert.equal(followUp.dataset.rsiChatSameAuthorNext, 'true');
    assert.equal(repeated.dataset.rsiChatAuthorBoundaryAfter, 'true');
    assert.equal(nextAuthor.dataset.rsiChatSameAuthorNext, undefined);

    const later = message('ThirdCitizen');
    later.parentElement = list;
    list.children.push(later);
    observers.at(-1).emit();
    assert.equal(nextAuthor.dataset.rsiChatAuthorBoundaryAfter, 'true');

    enabled = false;
    refresh();
    assert.equal(first.dataset.rsiChatSameAuthorNext, undefined);
    assert.equal(repeated.dataset.rsiChatAuthorBoundaryAfter, undefined);
    assert.equal(observers.at(-1).disconnected, true);
  } finally {
    enabled = false;
    refresh();
    if (originalObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = originalObserver;
  }
});

test('chat group separators stay inside the live chat module and leave the Online Users panel alone', async () => {
  const { readFile } = await import('node:fs/promises');
  const css = await readFile('src/styles/spectrum-chat.css', 'utf8');
  const packagedCss = await readFile('dist/spectrum.css', 'utf8');
  const packagedScript = await readFile('dist/content.js', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-chat.html', 'utf8');
  const entry = await readFile('src/content/index.ts', 'utf8');
  assert.match(css, /\.message-item\.status-default\[data-rsi-chat-same-author-next="true"\]/);
  assert.match(css, /\.message-item\.status-default\.type-small\[data-rsi-chat-author-boundary-after="true"\]/);
  assert.match(css, /@scope|#react #page\.lobby #page-main/);
  assert.match(entry, /installSpectrumChatMessageGroups/);
  assert.match(entry, /settings\.modules\.chat && location\.pathname\.toLowerCase\(\)\.includes\('\/lobby\/'\)/);
  assert.match(packagedCss, /#react #page\.lobby #page-main \.message-item\.status-default\[data-rsi-chat-same-author-next="true"\]/);
  assert.match(packagedScript, /rsiChatSameAuthorNext/);
  assert.match(fixture, /id="same-author-repeat"[\s\S]*?@Citizen[\s\S]*?id="author-change"[\s\S]*?@OtherCitizen/);
  assert.doesNotMatch(css.slice(css.indexOf('/* Online Users'), css.indexOf('/* Friends shares')), /data-rsi-chat-(?:same-author-next|author-boundary-after)/);
});
