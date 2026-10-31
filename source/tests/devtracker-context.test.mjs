import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { devTrackerContextView, devTrackerReplyHref, devTrackerReplyRoute, installDevTrackerContext } from '../src/content/devtracker-context.ts';

class FakeElement {
  constructor(tagName, className = '') {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.className = className;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.isConnected = true;
    this.hidden = false;
    this.textContent = '';
  }
  get classList() { return { contains: name => this.className.split(/\s+/).includes(name) }; }
  append(...nodes) { for (const node of nodes) this.insertBefore(node, null); }
  insertBefore(node, reference) {
    node.remove();
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
    node.parentElement = this;
    node.isConnected = this.isConnected;
    return node;
  }
  replaceChildren(...nodes) { for (const child of this.children) child.remove(); this.children = []; this.append(...nodes); }
  replaceWith(node) { if (this.parentElement) this.parentElement.insertBefore(node, this); this.remove(); }
  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    this.parentElement = null;
    this.isConnected = false;
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  click() {
    const event = {
      defaultPrevented:false,
      propagationStopped:false,
      preventDefault() { this.defaultPrevented = true; },
      stopPropagation() { this.propagationStopped = true; },
    };
    for (const listener of this.listeners.get('click') ?? []) listener(event);
    return event;
  }
  matches(selector) {
    const match = /^(?:(\w+))?(?:\.([\w-]+))?$/.exec(selector);
    return Boolean(match && (!match[1] || this.tagName === match[1].toUpperCase()) && (!match[2] || this.classList.contains(match[2])));
  }
  descendants() { return this.children.flatMap(child => [child, ...child.descendants()]); }
  querySelectorAll(selector) { return this.descendants().filter(node => node.matches(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

function makeCard(replyId) {
  const anchor = new FakeElement('a', 'devpost');
  anchor.href = `https://robertsspaceindustries.com/spectrum/community/SC/forum/5/thread/topic/${replyId}`;
  anchor.setAttribute('href', `/spectrum/community/SC/forum/5/thread/topic/${replyId}`);
  const wrapper = new FakeElement('div', 'devpost-wrapper');
  wrapper.append(new FakeElement('div', 'topic'), new FakeElement('p', 'details'));
  anchor.append(wrapper);
  return anchor;
}

function makeBrowser() {
  const observers = [];
  const timers = [];
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.target = null; observers.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.target = null; }
    trigger(records) { if (this.target) this.callback(records); }
  }
  const html = new FakeElement('html');
  const body = new FakeElement('body');
  const title = new FakeElement('div', 'glow-hub-title');
  const heading = new FakeElement('h1');
  const titleLink = new FakeElement('a');
  titleLink.textContent = 'Devtracker';
  heading.append(titleLink);
  title.append(heading);
  const feed = new FakeElement('div', 'devtracker-list js-devtracker-list');
  const group = new FakeElement('div', 'devtracker-list');
  feed.append(group);
  body.append(title, feed);
  html.append(body);
  const document = {
    readyState: 'complete', body, documentElement: html,
    createElement: tag => new FakeElement(tag),
    querySelector: selector => selector === '.glow-hub-title h1 a' ? titleLink : html.querySelector(selector),
  };
  const calls = [];
  const window = {
    location: { pathname:'/en/community/devtracker', href:'https://robertsspaceindustries.com/en/community/devtracker' },
    MutationObserver: FakeMutationObserver,
    setTimeout: callback => { const timer = { callback, cleared:false }; timers.push(timer); return timer; },
    clearTimeout: timer => { if (timer) timer.cleared = true; },
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push([url, body]);
      const data = body.reply_id === '42'
        ? { id:'42', thread_id:'10', parent_reply_id:'41' }
        : { id:'41', thread_id:'10', member:{displayname:'Wendigo',avatar:'/media/wendigo.jpg'}, lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:'Actual Spectrum parent text.'}]}]}}) };
      return { ok:true, json:async () => ({ success:1, data }) };
    },
  };
  return { window, document, feed, group, titleLink, observers, calls, timers };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

test('Dev Tracker heading uses the full product name while enabled and restores the native title when disabled', () => {
  const { window, document, titleLink } = makeBrowser();
  let enabled = true;
  const refresh = installDevTrackerContext(() => enabled, window, document);
  refresh();
  assert.equal(titleLink.textContent, 'Star Citizen Dev Tracker');
  refresh();
  assert.equal(titleLink.textContent, 'Star Citizen Dev Tracker', 'route refresh keeps the renamed title');
  enabled = false;
  refresh();
  assert.equal(titleLink.textContent, 'Devtracker');
});

test('Dev Tracker heading uses balanced line metrics and tighter title spacing', async () => {
  const css = await readFile(new URL('../src/styles/rsi/devtracker.css', import.meta.url), 'utf8');
  const titleRule = css.match(/body\.devtracker-hub \.glow-hub-title h1\s*\{([^}]+)\}/);
  const titleLinkRule = css.match(/body\.devtracker-hub \.glow-hub-title h1 a\s*\{([^}]+)\}/);
  assert.ok(titleRule, 'the title has a dedicated typography rule');
  assert.ok(titleLinkRule, 'the title link has a dedicated optical alignment rule');
  assert.match(titleRule[1], /font:\s*700 17px\/1\s/, 'use a compact line box to align the title glyphs evenly');
  assert.match(titleRule[1], /letter-spacing:\s*\.04em/, 'keep the product name from looking unevenly spread');
  assert.match(titleLinkRule[1], /inset-block-start:\s*\.2em/, 'lower the title glyphs to align with the centered arrow');
});

test('Dev Tracker date and post content use balanced modest vertical spacing', async () => {
  const css = await readFile(new URL('../src/styles/rsi/devtracker.css', import.meta.url), 'utf8');
  const rule = selector => css.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1] ?? '';
  const dateHeading = rule('body\\.devtracker-hub \\.js-devtracker-list > h3\\.clearfix');
  const card = rule('body\\.devtracker-hub \\.devpost-wrapper');
  const response = rule('body\\.devtracker-hub \\.rsi-devtracker-response');
  const context = rule('body\\.devtracker-hub \\.rsi-devtracker-context');
  const dateMargins = dateHeading.match(/margin:\s*(\d+)px 0;/);
  const cardPadding = card.match(/padding:\s*(\d+)px 16px (\d+)px;/);
  const responsePadding = response.match(/padding:\s*9px 14px (\d+)px;/);
  assert.ok(dateMargins, 'date heading has symmetric vertical margins');
  assert.equal(dateMargins[1], '10', 'date heading spacing stays modest');
  assert.ok(cardPadding && responsePadding, 'card and response define their vertical insets');
  assert.equal(Number(cardPadding[1]) + 1, Number(cardPadding[2]) + Number(responsePadding[1]) + 2,
    'title top inset equals the developer response bottom inset, including both borders');
  assert.match(rule('body\\.devtracker-hub \\.devpost \\.topic'), /grid-column:\s*2/);
  assert.match(context, /grid-column:\s*2/, 'title and response stay in one shared right-hand grid column');
});

test('Dev Tracker enlarges developer details without shrinking the post and response column', async () => {
  const css = await readFile(new URL('../src/styles/rsi/devtracker.css', import.meta.url), 'utf8');
  const rule = selector => css.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1] ?? '';
  assert.match(rule('body\\.devtracker-hub \\.devpost-wrapper'), /grid-template-columns:\s*minmax\(220px, 280px\) minmax\(0, 1fr\)/);
  assert.match(rule('body\\.devtracker-hub \\.devpost \\.info'), /grid-template-columns:\s*69px/);
  assert.match(rule('body\\.devtracker-hub \\.devpost \\.info'), /column-gap:\s*11px/);
  assert.match(rule('body\\.devtracker-hub \\.devpost \\.info'), /padding-inline-end:\s*16px/);
  assert.match(rule('body\\.devtracker-hub \\.devpost \\.info > img'), /width:\s*69px !important/);
  assert.match(rule('body\\.devtracker-hub \\.devpost \\.nickname'), /font:\s*700 23px\/1\.35/);
  assert.match(rule('body\\.devtracker-hub \\.devpost \\.handle'), /font:\s*18px\/1\.35/);
  assert.match(rule('body\\.devtracker-hub \\.devpost \\.date \\.label'), /font:\s*700 15px\/1\.25/);
  assert.match(rule('body\\.devtracker-hub \\.devpost \\.date \\.time'), /font:\s*18px\/1\.4/);
});

test('Dev Tracker indents the user reply relative to the developer response', async () => {
  const css = await readFile(new URL('../src/styles/rsi/devtracker.css', import.meta.url), 'utf8');
  const parentRule = css.match(/body\.devtracker-hub \.rsi-devtracker-parent\s*\{([^}]+)\}/);
  assert.ok(parentRule, 'the user reply keeps a dedicated layout rule');
  assert.match(parentRule[1], /margin:\s*14px/);
  assert.doesNotMatch(parentRule[1], /margin-inline-start:/, 'the quote should have an even outer gap on every side');
  assert.match(parentRule[1], /padding-inline-start:\s*12px/);
  assert.match(parentRule[1], /border:\s*1px solid color-mix\(in srgb, var\(--rsi-border\)/, 'frame the user reply with a neutral border');
  assert.match(parentRule[1], /background:/, 'give the user reply a distinct inset surface');
  assert.doesNotMatch(parentRule[1], /border-inline-start:/, 'the inset should come from spacing, without a colored rail');
});

test('Dev Tracker context accepts only same-origin links to an exact Spectrum reply', () => {
  assert.deepEqual(
    devTrackerReplyRoute('https://robertsspaceindustries.com/spectrum/community/SC/forum/5/thread/topic/9203432', 'https://robertsspaceindustries.com/en/community/devtracker'),
    { slug:'topic', replyId:'9203432', threadPath:'/spectrum/community/SC/forum/5/thread/topic' },
  );
  assert.equal(devTrackerReplyRoute('https://example.com/spectrum/community/SC/forum/5/thread/topic/9203432', 'https://robertsspaceindustries.com/en/community/devtracker'), null);
  assert.equal(devTrackerReplyRoute('/spectrum/community/SC/forum/5/thread/topic', 'https://robertsspaceindustries.com/en/community/devtracker'), null);
  assert.equal(devTrackerReplyHref('/spectrum/community/SC/forum/5/thread/topic/9203432', 'https://robertsspaceindustries.com/en/community/devtracker'), '/spectrum/community/SC/forum/5/thread/topic/9203432?rsi-enhanced-reply=1');
  assert.equal(devTrackerReplyHref('https://example.com/spectrum/community/SC/forum/5/thread/topic/9203432', 'https://robertsspaceindustries.com/en/community/devtracker'), null);
});

test('Dev Tracker context uses the parent post text, real author name and safe avatar', () => {
  const data = devTrackerContextView({
    id:'41', thread_id:'10',
    member:{displayname:'Wendigo',nickname:'Wendigo',avatar:'/media/wendigo.jpg'},
    lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:'Exact parent reply text.'}]}]}}),
  }, 'https://robertsspaceindustries.com/en/community/devtracker');
  assert.deepEqual(data, {
    name:'Wendigo',
    avatar:'https://robertsspaceindustries.com/media/wendigo.jpg',
    fallbackAvatar:'https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg',
    text:'Exact parent reply text.',
  });
  assert.equal(devTrackerContextView({id:'1',member:{displayname:'Pilot',avatar:'javascript:alert(1)'}}, 'https://robertsspaceindustries.com/en/community/devtracker').avatar, 'https://cdn.robertsspaceindustries.com/static/images/account/avatar_default_big.jpg');
});

test('Dev Tracker decorates initial and Auto Loaded reply cards, then cleans up when disabled', async () => {
  const { window, document, feed, group, observers, calls } = makeBrowser();
  const first = makeCard('42');
  group.append(first);
  let enabled = true;
  const refresh = installDevTrackerContext(() => enabled, window, document);
  refresh();
  await flush();
  const firstContext = first.querySelector('.rsi-devtracker-context');
  assert.equal(firstContext.dataset.state, 'ready');
  assert.equal(firstContext.querySelector('.rsi-devtracker-context-author').textContent, 'Wendigo');
  assert.equal(firstContext.querySelector('.rsi-devtracker-context-avatar').src, 'https://robertsspaceindustries.com/media/wendigo.jpg');
  assert.equal(firstContext.querySelector('.rsi-devtracker-context-text').textContent, 'Actual Spectrum parent text.');
  assert.equal(first.querySelector('.rsi-devtracker-response-label').textContent, 'DEVELOPER RESPONSE');
  const unifiedPanel = first.querySelector('.rsi-devtracker-context');
  const responseSection = first.querySelector('.rsi-devtracker-response');
  assert.equal(responseSection.parentElement, unifiedPanel);
  assert.equal(first.querySelector('.rsi-devtracker-response-label').parentElement, responseSection);
  assert.equal(first.querySelector('.details').parentElement, responseSection);
  assert.equal(first.querySelector('.rsi-devtracker-context-toggle'), null);
  assert.equal(first.querySelector('.rsi-devtracker-response-toggle'), null);
  assert.match(first.getAttribute('href'), /[?&]rsi-enhanced-reply=1$/);
  assert.equal(calls.length, 2);

  const second = makeCard('42');
  group.append(second);
  observers.find(observer => observer.target === feed).trigger([{ addedNodes:[second] }]);
  await flush();
  assert.equal(second.querySelector('.rsi-devtracker-context-author').textContent, 'Wendigo');
  assert.equal(calls.length, 4);

  enabled = false;
  refresh();
  assert.equal(first.querySelector('.rsi-devtracker-context'), null);
  assert.equal(second.querySelector('.rsi-devtracker-context'), null);
  assert.equal(first.dataset.rsiContextState, undefined);
  assert.equal(first.getAttribute('href'), '/spectrum/community/SC/forum/5/thread/topic/42');
  assert.equal(second.getAttribute('href'), '/spectrum/community/SC/forum/5/thread/topic/42');
});

test('Dev Tracker reports unavailable context when Spectrum does not return a valid parent', async () => {
  const { window, document, group } = makeBrowser();
  window.fetch = async () => ({ ok:true, json:async () => ({ success:0 }) });
  const card = makeCard('42');
  group.append(card);
  const refresh = installDevTrackerContext(() => true, window, document);
  refresh();
  await flush();
  assert.equal(card.querySelector('.rsi-devtracker-context').dataset.state, 'unavailable');
  assert.match(card.querySelector('.rsi-devtracker-context-status').textContent, /REPLY CONTEXT UNAVAILABLE/);
  assert.equal(card.querySelector('.rsi-devtracker-context-author'), null);
});

test('Dev Tracker changes a timed-out parent lookup from loading to unavailable', async () => {
  const { window, document, group, timers } = makeBrowser();
  window.fetch = (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('request aborted')), { once:true });
  });
  const card = makeCard('42');
  group.append(card);
  const refresh = installDevTrackerContext(() => true, window, document);
  refresh();
  const timeout = timers.find(timer => !timer.cleared);
  assert.ok(timeout);
  timeout.callback();
  await flush();
  await flush();
  assert.equal(card.querySelector('.rsi-devtracker-context').dataset.state, 'unavailable');
  assert.match(card.querySelector('.rsi-devtracker-context-status').textContent, /REPLY CONTEXT UNAVAILABLE/);
});

test('long parent context and developer replies each expand inline without opening the post', async () => {
  const { window, document, group } = makeBrowser();
  const parentText = 'This is the complete parent Spectrum message. '.repeat(12).trim();
  const responseText = 'This is the complete developer response. '.repeat(12).trim();
  const responseExcerpt = 'The Skarnov rifle leaves the target with an electrified pulse that chains to nearby targets, causing...';
  window.fetch = async (_url, options) => {
    const { reply_id } = JSON.parse(options.body);
    const data = reply_id === '42'
      ? { id:'42', thread_id:'10', parent_reply_id:'41', lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:responseText}]}]}}) }
      : { id:'41', thread_id:'10', member:{displayname:'Wendigo',avatar:'/media/wendigo.jpg'}, lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:parentText}]}]}}) };
    return { ok:true, json:async () => ({ success:1, data }) };
  };
  const card = makeCard('42');
  const details = card.querySelector('.details');
  details.textContent = responseExcerpt;
  group.append(card);
  let enabled = true;
  const refresh = installDevTrackerContext(() => enabled, window, document);
  refresh();
  await flush();

  const contextText = card.querySelector('.rsi-devtracker-context-text');
  const contextToggle = card.querySelector('.rsi-devtracker-context-toggle');
  assert.ok(contextText.textContent.length < parentText.length);
  assert.match(contextText.textContent, /…$/);
  assert.equal(contextToggle.textContent, 'Show more');
  const contextClick = contextToggle.click();
  assert.equal(contextClick.defaultPrevented, true);
  assert.equal(contextClick.propagationStopped, true);
  assert.equal(contextText.textContent, parentText);
  assert.equal(details.hidden, true);
  assert.equal(contextToggle.textContent, 'Show less');
  contextToggle.click();
  assert.match(contextText.textContent, /…$/);
  assert.equal(contextToggle.textContent, 'Show more');

  const responsePreview = card.querySelector('.rsi-devtracker-response-preview');
  const responseToggle = card.querySelector('.rsi-devtracker-response-toggle');
  const responseFull = card.querySelector('.rsi-devtracker-response-full');
  assert.equal(responsePreview.textContent, responseExcerpt);
  assert.equal(details.hidden, true);
  assert.equal(responseToggle.textContent, 'Show more');
  assert.equal(responseFull.textContent, responseText);
  assert.equal(responseFull.hidden, true);
  const responseClick = responseToggle.click();
  assert.equal(responseClick.defaultPrevented, true);
  assert.equal(responseClick.propagationStopped, true);
  assert.equal(details.hidden, true);
  assert.equal(responsePreview.hidden, true);
  assert.equal(responseFull.hidden, false);
  assert.equal(responseFull.textContent, responseText);
  assert.equal(responseToggle.textContent, 'Show less');
  responseToggle.click();
  assert.equal(details.hidden, true);
  assert.equal(responsePreview.hidden, false);
  assert.equal(responseFull.hidden, true);
  assert.equal(responseToggle.textContent, 'Show more');

  enabled = false;
  refresh();
  assert.equal(details.hidden, false);
  assert.equal(card.querySelector('.rsi-devtracker-context-toggle'), null);
  assert.equal(card.querySelector('.rsi-devtracker-response-toggle'), null);
  assert.equal(details.parentElement, card.querySelector('.devpost-wrapper'));
});

test('Dev Tracker offers full text when a short native developer excerpt has no ellipsis', async () => {
  const { window, document, group } = makeBrowser();
  const responseText = 'The complete developer answer includes additional context beyond the short excerpt shown in the feed, even though it is under the normal preview limit.';
  const responseExcerpt = responseText.slice(0, 74);
  window.fetch = async (_url, options) => {
    const { reply_id } = JSON.parse(options.body);
    const data = reply_id === '42'
      ? { id:'42', thread_id:'10', parent_reply_id:'41', lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:responseText}]}]}}) }
      : { id:'41', thread_id:'10', member:{displayname:'Wendigo'}, lexical_content:JSON.stringify({root:{type:'root',children:[{type:'paragraph',children:[{text:'Original post.'}]}]}}) };
    return { ok:true, json:async () => ({ success:1, data }) };
  };
  const card = makeCard('42');
  card.querySelector('.details').textContent = responseExcerpt;
  group.append(card);
  installDevTrackerContext(() => true, window, document)();
  await flush();

  const preview = card.querySelector('.rsi-devtracker-response-preview');
  const full = card.querySelector('.rsi-devtracker-response-full');
  const toggle = card.querySelector('.rsi-devtracker-response-toggle');
  assert.ok(toggle);
  assert.equal(preview.textContent, responseExcerpt);
  assert.equal(full.textContent, responseText);
  toggle.click();
  assert.equal(full.hidden, false);
});

test('Dev Tracker fixture and packaged runtime include the context and selected-font treatment', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = await readFile('tests/fixtures/devtracker.html', 'utf8');
  const css = await readFile('dist/rsi.css', 'utf8');
  const runtime = await readFile('dist/content.js', 'utf8');
  assert.match(fixture, /class="devpost-wrapper"/);
  assert.match(css, /\.rsi-devtracker-context/);
  assert.match(css, /\.rsi-devtracker-response-full/);
  assert.match(css, /var\(--rsi-selected-font-family/);
  assert.match(runtime, /REPLY CONTEXT UNAVAILABLE/);
  assert.match(runtime, /rsi-devtracker-context-toggle/);
  assert.match(runtime, /rsi-devtracker-response-toggle/);
  assert.match(runtime, /rsi-enhanced-reply/);
});
