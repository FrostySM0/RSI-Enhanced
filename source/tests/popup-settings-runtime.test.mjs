import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from 'node:test';
import { STORAGE_KEY } from '../src/shared/settings.ts';

class Element {
  constructor(tag = 'div', ownerDocument = null) {
    this.tagName = tag.toUpperCase(); this.ownerDocument = ownerDocument; this.children = [];
    this.listeners = new Map(); this.style = { setProperty() {} }; this.dataset = {};
    this.attributes = new Map();
    this.value = ''; this.checked = false; this.hidden = false; this.disabled = false;
    this.selectedOptions = [{ textContent: '' }];
    if (this.tagName === 'TEMPLATE') this.content = { cloneNode: () => new Element('div', ownerDocument) };
    if (this.tagName === 'LINK') this.relList = { supports: () => true };
  }
  append(...children) {
    for (const child of children) {
      this.children.push(child);
      if (child.id) this.ownerDocument?.elements.set(child.id, child);
    }
  }
  replaceChildren(...children) { this.children = children; }
  querySelector() { return null; }
  add(option) { this.children.push(option); }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  dispatch(type, event = {}) {
    this.listeners.get(type)?.({ ...event, target: event.target ?? this, preventDefault() { this.defaultPrevented = true; } });
  }
  focus() { this.ownerDocument.activeElement = this; }
  checkValidity() {
    if (this.required && this.value.trim() === '') return false;
    if (this.type !== 'number' || this.value.trim() === '') return true;
    const value = Number(this.value);
    return Number.isFinite(value) && (!this.min || value >= Number(this.min)) && (!this.max || value <= Number(this.max));
  }
  reportValidity() { return this.checkValidity(); }
  get valueAsNumber() { return Number(this.value); }
}

test('packaged settings popup removes Roadmap update controls and ignores legacy preferences', async () => {
  const htmlUrl = new URL('../dist/src/popup/index.html', import.meta.url);
  const html = await readFile(htmlUrl, 'utf8');
  assert.doesNotMatch(html, /Roadmap Updates|roadmap-tools|Track new or changed releases/);
  const script = html.match(/<script[^>]+src="([^"]+\.js)"/i)?.[1];
  assert.ok(script, 'the packaged popup exposes its bundled runtime');

  const elements = new Map();
  const document = {
    elements,
    createElement: tag => new Element(tag, document),
    getElementById: id => elements.get(id) ?? null,
    querySelectorAll: () => [],
  };
  for (const match of html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) {
    const element = new Element(match[1], document);
    element.id = match[2];
    const tag = match[0];
    element.value = tag.match(/\bvalue="([^"]*)"/i)?.[1] ?? '';
    element.type = tag.match(/\btype="([^"]+)"/i)?.[1] ?? '';
    element.required = /\srequired(?:\s|\/?>)/i.test(tag);
    element.min = tag.match(/\bmin="([^"]+)"/i)?.[1] ?? '';
    element.max = tag.match(/\bmax="([^"]+)"/i)?.[1] ?? '';
    elements.set(element.id, element);
  }
  const saved = {};
  const context = {
    document,
    Option: class { constructor(label, value) { this.textContent = label; this.value = value; } },
    chrome: {
      runtime: { getManifest: () => ({ version: 'test' }) },
      storage: { local: {
        get: async key => ({ [key]: { roadmapTools: true, roadmapLandingView: 'progress-tracker', theme: 'navy', commentLayout: 'flat' } }),
        set: async value => Object.assign(saved, value),
      } },
    },
    console,
  };
  vm.runInNewContext(await readFile(fileURLToPath(new URL(script, htmlUrl)), 'utf8'), context);
  await new Promise(setImmediate);

  assert.equal(elements.get('comment-layout').value, 'flat', 'the saved comment layout is restored');
  assert.equal(elements.get('roadmap-landing-view').value, 'progress-tracker', 'the saved Roadmap landing view is restored');
  elements.get('comment-layout').value = 'bubbles';
  elements.get('roadmap-landing-view').value = 'release-view';
  const form = elements.get('settings');
  form.dispatch('submit');
  await new Promise(setImmediate);
  assert.equal(saved[STORAGE_KEY].theme, 'navy');
  assert.equal(saved[STORAGE_KEY].commentLayout, 'bubbles', 'the selected comment layout is saved');
  assert.equal(saved[STORAGE_KEY].roadmapLandingView, 'release-view', 'the selected Roadmap landing view is saved');
  assert.equal('roadmapTools' in saved[STORAGE_KEY], false, 'saving drops the retired preference');
  elements.get('roadmap-landing-view').value = 'progress-tracker';
  elements.get('reset').dispatch('click');
  await new Promise(setImmediate);
  assert.equal(saved[STORAGE_KEY].roadmapLandingView, 'release-view', 'reset restores the default Roadmap landing view');
  assert.equal(elements.get('roadmap-landing-view').value, 'release-view', 'the popup reflects the reset Roadmap landing view');
});

test('packaged settings popup switches categories by click and keyboard', async () => {
  const htmlUrl = new URL('../dist/src/popup/index.html', import.meta.url);
  const html = await readFile(htmlUrl, 'utf8');
  const script = html.match(/<script[^>]+src="([^"]+\.js)"/i)?.[1];
  assert.ok(script, 'the packaged popup exposes its bundled runtime');

  const elements = new Map();
  const document = {
    elements,
    activeElement: null,
    createElement: tag => new Element(tag, document),
    getElementById: id => elements.get(id) ?? null,
    querySelectorAll: () => [],
  };
  for (const match of html.matchAll(/<([a-z][\w-]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)) {
    const element = new Element(match[1], document);
    element.id = match[2];
    const tag = match[0];
    element.value = tag.match(/\bvalue="([^"]*)"/i)?.[1] ?? '';
    element.type = tag.match(/\btype="([^"]+)"/i)?.[1] ?? '';
    element.required = /\srequired(?:\s|\/?>)/i.test(tag);
    element.min = tag.match(/\bmin="([^"]+)"/i)?.[1] ?? '';
    element.max = tag.match(/\bmax="([^"]+)"/i)?.[1] ?? '';
    elements.set(element.id, element);
  }
  let saveCount = 0;
  const context = {
    document,
    Option: class { constructor(label, value) { this.textContent = label; this.value = value; } },
    chrome: {
      runtime: { getManifest: () => ({ version: 'test' }) },
      storage: { local: { get: async () => ({}), set: async () => { saveCount++; } } },
    },
    console,
  };
  vm.runInNewContext(await readFile(fileURLToPath(new URL(script, htmlUrl)), 'utf8'), context);
  await new Promise(setImmediate);

  assert.ok(elements.has('tab-appearance'), 'the packaged popup exposes settings category tabs');
  assert.equal(elements.get('panel-appearance').hidden, false);
  assert.equal(elements.get('panel-layout').hidden, true);
  elements.get('tab-layout').dispatch('click');
  assert.equal(elements.get('tab-layout').getAttribute('aria-selected'), 'true');
  assert.equal(elements.get('panel-layout').hidden, false);
  assert.equal(elements.get('panel-appearance').hidden, true);

  elements.get('tab-layout').dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, elements.get('tab-modules'));
  assert.equal(elements.get('panel-modules').hidden, false);
  assert.equal(elements.get('panel-layout').hidden, true);

  elements.get('font-size').value = '';
  elements.get('settings').dispatch('submit');
  await new Promise(setImmediate);
  assert.equal(elements.get('tab-layout').getAttribute('aria-selected'), 'true');
  assert.equal(elements.get('panel-layout').hidden, false);
  assert.equal(saveCount, 0, 'invalid hidden layout values are shown and not saved');
});
