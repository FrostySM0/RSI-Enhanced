import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { installRoadmapImageViewer, roadmapImageUrl } from '../src/content/roadmap-image-viewer.ts';

test('Roadmap image viewer backdrop matches the native card pop-out', async () => {
  const css = await readFile('src/styles/rsi/roadmap.css', 'utf8');
  const backdrop = css.match(/:scope dialog\.rsi-roadmap-image-dialog::backdrop\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(backdrop, /background:\s*rgb\(5\s+11\s+18\s*\/\s*20%\)\s*!important/);
  assert.match(backdrop, /backdrop-filter:\s*blur\(4px\)\s*!important/);
  assert.match(backdrop, /-webkit-backdrop-filter:\s*blur\(4px\)\s*!important/);
});

class FakeNode {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = document;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.closestNodes = new Map();
    this.className = '';
    this.isConnected = true;
  }

  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.children.push(node); return node; }
  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  closest(selector) { return this.closestNodes.get(selector) ?? null; }
  querySelector(selector) {
    const matches = node => selector.startsWith('.')
      ? node.className.split(/\s+/).includes(selector.slice(1))
      : selector === 'figure[media]'
        ? node.tagName === 'FIGURE' && node.getAttribute('media') !== null
        : ['h2', 'h3'].includes(selector) && node.tagName === selector.toUpperCase();
    const visit = node => {
      for (const child of node.children) {
        if (matches(child)) return child;
        const nested = visit(child);
        if (nested) return nested;
      }
      return null;
    };
    return visit(this);
  }
  focus() { this.focused = true; }
  remove() { this.isConnected = false; }
  showModal() { this.open = true; }
  close() {
    this.open = false;
    for (const listener of this.listeners.get('close') ?? []) listener();
  }
}

function fakePage() {
  const doc = { createElement: tag => new FakeNode(tag, doc), body: null };
  doc.body = new FakeNode('body', doc);
  const win = {
    location: { href: 'https://robertsspaceindustries.com/roadmap/release-view', pathname: '/roadmap/release-view', origin: 'https://robertsspaceindustries.com' },
    getComputedStyle: () => ({ backgroundImage: 'none' }),
    listeners: new Map(),
    addEventListener(name, listener) { this.listeners.set(name, listener); },
  };
  const anchor = new FakeNode('a', doc);
  anchor.href = 'https://robertsspaceindustries.com/roadmap/release-view/123-card';
  anchor.setAttribute('href', '/roadmap/release-view/123-card');
  const figure = new FakeNode('figure', doc);
  figure.setAttribute('media', 'https://media.robertsspaceindustries.com/cards/product_thumb_large.jpg?rev=2');
  figure.closestNodes.set('figure[media]', figure);
  figure.closestNodes.set('a[href]', anchor);
  anchor.children.push(figure);
  const heading = new FakeNode('h3', doc);
  heading.textContent = 'Sample roadmap card';
  anchor.children.push(heading);
  return { doc, win, anchor, figure, heading };
}

test('roadmap image URL prefers media and upgrades the verified thumbnail path', () => {
  assert.equal(
    roadmapImageUrl('https://media.robertsspaceindustries.com/cards/product_thumb_large.jpg?rev=2', 'url(https://example.test/fallback.jpg)', 'https://robertsspaceindustries.com/roadmap/release-view'),
    'https://media.robertsspaceindustries.com/cards/source.jpg?rev=2',
  );
});

test('roadmap image URL falls back to safe CSS media and rejects unsafe URLs', () => {
  assert.equal(
    roadmapImageUrl('', 'url("/media/preview.jpg")', 'https://robertsspaceindustries.com/roadmap/release-view'),
    'https://robertsspaceindustries.com/media/preview.jpg',
  );
  assert.equal(roadmapImageUrl('javascript:alert(1)', '', 'https://robertsspaceindustries.com/roadmap/release-view'), null);
  assert.equal(roadmapImageUrl('https://user:pass@example.com/image.jpg', '', 'https://robertsspaceindustries.com/roadmap/release-view'), null);
});

test('artwork clicks open a source-image dialog while card detail clicks remain native', () => {
  const { doc, win, figure, heading } = fakePage();
  installRoadmapImageViewer(() => true, win, doc);
  const click = win.listeners.get('click');
  let prevented = false;
  let stopped = false;
  click({
    button: 0,
    target: figure,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
  });
  assert.equal(prevented, true);
  assert.equal(stopped, true);
  const dialog = doc.body.children[0];
  assert.equal(dialog.className, 'rsi-roadmap-image-dialog');
  assert.equal(dialog.open, true);
  assert.equal(dialog.querySelector('.rsi-roadmap-image-source').src, 'https://media.robertsspaceindustries.com/cards/source.jpg?rev=2');
  assert.equal(dialog.querySelector('h2').textContent, 'Sample roadmap card');

  prevented = false;
  stopped = false;
  click({
    button: 0,
    target: heading,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault() { prevented = true; },
    stopPropagation() { stopped = true; },
  });
  assert.equal(prevented, false);
  assert.equal(stopped, false);
  assert.equal(doc.body.children.length, 1);
});

test('closing the artwork viewer removes it and restores focus to its card', () => {
  const { doc, win, anchor, figure } = fakePage();
  installRoadmapImageViewer(() => true, win, doc);
  win.listeners.get('click')({
    button: 0,
    target: figure,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault() {},
    stopPropagation() {},
  });
  const dialog = doc.body.children[0];
  dialog.close();
  assert.equal(dialog.isConnected, false);
  assert.equal(anchor.focused, true);
});
