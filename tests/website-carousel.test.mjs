import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';

const rootDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const siteDir = resolve(rootDir, 'website');
const scriptPath = resolve(siteDir, 'gallery-carousel.js');

class Element {
  constructor(dataset = {}, inside = false) {
    this.dataset = dataset;
    this.inside = inside;
    this.attributes = new Map();
    this.textContent = '';
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      add: (name) => this.classes.add(name),
      remove: (name) => this.classes.delete(name),
      contains: (name) => this.classes.has(name),
    };
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, handler) { this.listeners.set(type, handler); }
  removeEventListener(type, handler) { if (this.listeners.get(type) === handler) this.listeners.delete(type); }
  dispatch(type) { this.listeners.get(type)?.({ type, target: this }); }
  closest() { return this; }
}

function createHarness({ reducedMotion = false, assetBase = 'assets/' } = {}) {
  assert.ok(existsSync(scriptPath), 'the carousel runtime should exist so its real behavior can be exercised');
  const source = readFileSync(scriptPath, 'utf8');
  const image = new Element();
  image.setAttribute('src', 'assets/spectrum-community.png');
  const title = new Element();
  const description = new Element();
  const counter = new Element();
  const announcement = new Element();
  const dots = Array.from({ length: 10 }, (_, index) => new Element({ carouselSlide: String(index) }, true));
  const elements = new Map([
    ['[data-carousel-image]', image],
    ['[data-carousel-title]', title],
    ['[data-carousel-description]', description],
    ['[data-carousel-count]', counter],
    ['[data-carousel-announcement]', announcement],
  ]);
  const root = new Element({ carouselAssetBase: assetBase });
  root.listeners = new Map();
  root.querySelector = (selector) => elements.get(selector) ?? null;
  root.querySelectorAll = (selector) => selector === '[data-carousel-slide]' ? dots : [];
  root.contains = (element) => Boolean(element?.inside);
  const timerMap = new Map();
  let nextTimerId = 1;
  const windowListeners = new Map();
  const documentListeners = new Map();
  const mediaListeners = new Map();
  const media = {
    matches: reducedMotion,
    addEventListener(type, callback) { mediaListeners.set(type, callback); },
  };
  const document = {
    hidden: false,
    querySelector: (selector) => selector === '[data-feature-carousel]' ? root : null,
    addEventListener(type, callback) { documentListeners.set(type, callback); },
  };
  const window = {
    matchMedia: () => media,
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      timerMap.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timerMap.delete(id); },
  };

  vm.runInNewContext(source, { document, window }, { filename: scriptPath });

  const fireTimer = () => {
    assert.equal(timerMap.size, 1, 'exactly one autoplay timer should be active');
    const [id, timer] = timerMap.entries().next().value;
    timerMap.delete(id);
    assert.equal(timer.delay, 7000, 'autoplay should wait seven seconds between slides');
    timer.callback();
  };
  const dispatch = (type, target = root, extra = {}) => {
    const listener = root.listeners.get(type) ?? documentListeners.get(type) ?? mediaListeners.get(type);
    assert.ok(listener, `expected a ${type} listener`);
    listener({ type, target, ...extra });
  };

  return { image, title, description, counter, announcement, dots, root, media, document, timerMap, fireTimer, dispatch };
}

test('feature carousel shows one labelled slide, ten accessible selectors, and the theme caveat', () => {
  const html = readFileSync(resolve(siteDir, 'index.html'), 'utf8');
  const css = readFileSync(resolve(siteDir, 'site.css'), 'utf8');
  const section = html.match(/<section\b[^>]*id="screenshots"[^>]*>[\s\S]*?<\/section>/i)?.[0] ?? '';

  assert.match(section, /data-feature-carousel[^>]*role="region"/i);
  assert.match(section, /aria-roledescription="carousel"/i);
  assert.match(section, /data-carousel-image[^>]*src="assets\/spectrum-community\.png"/i);
  assert.equal([...section.matchAll(/<img\b/gi)].length, 1,
    'non-selected screenshots should not be embedded and fetched in advance');
  assert.equal([...section.matchAll(/data-carousel-slide="(?:[0-9])"/g)].length, 10,
    'there should be one selector for each of the ten feature slides');
  assert.match(section, /explore ten parts/i);
  assert.match(section, /different included themes/i,
    'visitors should know the screenshots show different included themes');
  assert.match(section, /data-carousel-action="previous"[^>]*aria-label="Previous screenshot"/i);
  assert.match(section, /data-carousel-action="next"[^>]*aria-label="Next screenshot"/i);
  assert.doesNotMatch(section, /class="shot"/, 'the four small screenshot tiles should be removed');
  const compactRules = css.match(/@media\s*\(max-width:\s*620px\)\s*\{([\s\S]*?)\n\s{4}\}/i)?.[1] ?? '';
  assert.match(compactRules, /\.carousel-dots\s*\{[^}]*gap:\s*5px/i,
    'the ten selectors should fit beside the arrows on narrow screens');
  assert.match(compactRules, /\.carousel-dot\s*\{[^}]*width:\s*8px[^}]*height:\s*8px/i);
  assert.match(compactRules, /\.carousel-dot\[aria-current="true"\]\s*\{[^}]*width:\s*18px/i);
});

test('carousel starts with the Spectrum screenshot and only loads the active slide', () => {
  const { image, title, description, counter, dots, timerMap } = createHarness();

  assert.equal(image.getAttribute('src'), 'assets/spectrum-community.png');
  assert.equal(image.getAttribute('alt'), 'Spectrum community with forums, chat lobbies, saved threads and the RSI Enhanced sidebar');
  assert.equal(title.textContent, 'Spectrum Community');
  assert.match(description.textContent, /forums, chat lobbies and saved threads/i);
  assert.equal(counter.textContent, '01 / 10');
  assert.equal(dots[0].getAttribute('aria-current'), 'true');
  assert.equal(dots[0].getAttribute('aria-label'), 'Show Spectrum Community');
  assert.equal(dots[1].getAttribute('aria-current'), null);
  assert.equal(timerMap.size, 1);
});

test('manual navigation updates the slide and wraps at both ends', () => {
  const { image, title, description, counter, announcement, dots, dispatch } = createHarness();
  const next = new Element({ carouselAction: 'next' }, true);
  const previous = new Element({ carouselAction: 'previous' }, true);

  dispatch('click', next);
  assert.equal(image.getAttribute('src'), 'assets/funding-stats.png');
  assert.equal(image.classList.contains('is-changing'), true, 'new screenshots should fade in after loading');
  image.dispatch('load');
  assert.equal(image.classList.contains('is-changing'), false);
  assert.equal(title.textContent, 'Funding Stats');
  assert.match(description.textContent, /live totals and open detailed history charts/i);
  assert.equal(counter.textContent, '02 / 10');
  assert.equal(dots[1].getAttribute('aria-current'), 'true');
  assert.match(announcement.textContent, /Funding Stats/);

  dispatch('click', previous);
  assert.equal(title.textContent, 'Spectrum Community');
  dispatch('click', dots[2]);
  assert.equal(title.textContent, 'Roadmap Release View');
  assert.equal(counter.textContent, '03 / 10');
  assert.equal(dots[2].getAttribute('aria-current'), 'true');
  dispatch('click', previous);
  assert.equal(image.getAttribute('src'), 'assets/funding-stats.png');
  dispatch('click', previous);
  assert.equal(image.getAttribute('src'), 'assets/spectrum-community.png');
  dispatch('click', previous);
  assert.equal(image.getAttribute('src'), 'assets/personal-dashboard.png');
  assert.equal(title.textContent, 'Personal Dashboard');
  assert.equal(counter.textContent, '10 / 10');
  dispatch('click', next);
  assert.equal(title.textContent, 'Spectrum Community');
});

test('all ten feature captions are concise and each screenshot asset exists locally', () => {
  const { image, title, description, dots, dispatch } = createHarness();
  const expected = [
    ['Spectrum Community', 'spectrum-community.png'],
    ['Funding Stats', 'funding-stats.png'],
    ['Roadmap Release View', 'roadmap-release-view.png'],
    ['Dev Tracker', 'dev-tracker.png'],
    ['Pledge Store: Ships', 'pledge-store-ships.png'],
    ['Pledge Store: Gear', 'pledge-store-gear.png'],
    ['Organizations', 'organizations.png'],
    ['Comm-Link', 'comm-link.png'],
    ['My Hangar', 'my-hangar.png'],
    ['Personal Dashboard', 'personal-dashboard.png'],
  ];

  expected.forEach(([expectedTitle, filename], index) => {
    dispatch('click', dots[index]);
    assert.equal(title.textContent, expectedTitle);
    assert.equal(image.getAttribute('src'), `assets/${filename}`);
    assert.ok(description.textContent.length > 12 && description.textContent.length < 100,
      `${expectedTitle} should have a short, useful description`);
    assert.ok(existsSync(resolve(siteDir, 'assets', filename)), `${filename} should be packaged locally`);
  });
});

test('both entry pages reference the matching ten-slide gallery and carousel script', () => {
  const rootHtml = readFileSync(resolve(rootDir, 'index.html'), 'utf8');
  const websiteHtml = readFileSync(resolve(siteDir, 'index.html'), 'utf8');
  for (const [html, imagePath, assetBase, scriptPath] of [
    [rootHtml, 'website/assets/spectrum-community.png', 'website/assets/', 'website/gallery-carousel.js'],
    [websiteHtml, 'assets/spectrum-community.png', 'assets/', 'gallery-carousel.js'],
  ]) {
    const section = html.match(/<section\b[^>]*id="screenshots"[^>]*>[\s\S]*?<\/section>/i)?.[0] ?? '';
    assert.ok(section.includes(`src="${imagePath}"`));
    assert.ok(section.includes(`data-carousel-asset-base="${assetBase}"`));
    assert.equal([...section.matchAll(/data-carousel-slide="(?:[0-9])"/g)].length, 10);
    assert.ok(html.includes(`<script src="${scriptPath}" defer></script>`));
  }
});

test('Pages-root carousel resolves slides from its website asset folder', () => {
  const { image, dispatch } = createHarness({ assetBase: 'website/assets/' });
  const next = new Element({ carouselAction: 'next' }, true);

  dispatch('click', next);
  assert.equal(image.getAttribute('src'), 'website/assets/funding-stats.png');
});

test('autoplay pauses for hover, focus, hidden pages and reduced motion, then resumes safely', () => {
  const carousel = createHarness();
  const { timerMap, dispatch, document, media, title, fireTimer } = carousel;

  assert.equal(timerMap.size, 1);
  fireTimer();
  assert.equal(title.textContent, 'Funding Stats');

  dispatch('pointerenter');
  assert.equal(timerMap.size, 0);
  dispatch('pointerleave');
  assert.equal(timerMap.size, 1);
  dispatch('focusin', new Element({}, true));
  assert.equal(timerMap.size, 0);
  dispatch('focusout', new Element({}, true), { relatedTarget: new Element({}, true) });
  assert.equal(timerMap.size, 0, 'moving focus between carousel controls should keep autoplay paused');
  dispatch('focusout', new Element({}, true), { relatedTarget: null });
  assert.equal(timerMap.size, 1);

  document.hidden = true;
  dispatch('visibilitychange', document);
  assert.equal(timerMap.size, 0);
  document.hidden = false;
  dispatch('visibilitychange', document);
  assert.equal(timerMap.size, 1);

  media.matches = true;
  dispatch('change');
  assert.equal(timerMap.size, 0);
  assert.equal(carousel.image.classList.contains('is-changing'), false,
    'enabling reduced motion should cancel an in-progress slide fade');
  media.matches = false;
  dispatch('change');
  assert.equal(timerMap.size, 1);

  const reduced = createHarness({ reducedMotion: true });
  assert.equal(reduced.timerMap.size, 0, 'reduced-motion users should never start autoplay');
});
