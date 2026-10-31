import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { installRoadmapLandingPreference, roadmapLandingPath } from '../src/content/roadmap-landing.ts';

function fixture({ path = '/roadmap', view = 'release-view', insideRoot = false, label = 'Roadmap', ready = Promise.resolve(), origin = 'https://robertsspaceindustries.com', modifiers = {} } = {}) {
  let clickHandler;
  const assignments = [];
  const anchor = {
    href: new URL(path, origin).href,
    textContent: label,
    target: '',
    download: '',
    closest: selector => selector === '#root' && insideRoot ? {} : null,
  };
  const target = { closest: selector => selector === 'a[href]' ? anchor : null };
  const document = {
    addEventListener(type, handler, capture) { assert.equal(type, 'click'); assert.equal(capture, true); clickHandler = handler; },
    removeEventListener() {},
  };
  const window = { location: { href: `${origin}/en/account/pledges`, origin, assign: path => assignments.push(path) } };
  const remove = installRoadmapLandingPreference(document, window, () => view, ready);
  const event = {
    target, button: 0, defaultPrevented: false,
    metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    ...modifiers,
    preventDefault() { this.defaultPrevented = true; },
  };
  clickHandler(event);
  return { assignments, event, remove, setView: next => { view = next; } };
}

test('Roadmap destinations retain locale and choose the requested page', () => {
  assert.equal(roadmapLandingPath('/roadmap', 'release-view'), '/roadmap/release-view');
  assert.equal(roadmapLandingPath('/en/roadmap', 'progress-tracker'), '/en/roadmap/progress-tracker/teams');
  assert.equal(roadmapLandingPath('/en/roadmap/', 'release-view'), '/en/roadmap/release-view');
});

test('main Roadmap entry follows the saved landing view', async () => {
  const release = fixture({ path: '/roadmap', view: 'release-view' });
  await new Promise(setImmediate);
  assert.equal(release.event.defaultPrevented, true);
  assert.deepEqual(release.assignments, ['/roadmap/release-view']);

  const tracker = fixture({ path: '/en/roadmap', view: 'progress-tracker' });
  await new Promise(setImmediate);
  assert.deepEqual(tracker.assignments, ['/en/roadmap/progress-tracker/teams']);
});

test('in-app Roadmap tabs are left to the page', async () => {
  const { assignments, event } = fixture({ path: '/roadmap/release-view', insideRoot: true, view: 'progress-tracker' });
  await new Promise(setImmediate);
  assert.equal(event.defaultPrevented, false);
  assert.deepEqual(assignments, []);
});

test('unrelated, modified, and cross-origin navigation stays native', async () => {
  for (const options of [
    { path: '/shop' },
    { path: '/roadmap', label: 'Other link' },
    { path: '/roadmap', modifiers: { ctrlKey: true } },
    { path: 'https://example.com/roadmap' },
  ]) {
    const { assignments, event } = fixture(options);
    await new Promise(setImmediate);
    assert.equal(event.defaultPrevented, false);
    assert.deepEqual(assignments, []);
  }
});

test('an early click waits for stored settings and reads the latest choice', async () => {
  let resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const pending = fixture({ path: '/roadmap', ready });
  assert.equal(pending.event.defaultPrevented, true);
  assert.deepEqual(pending.assignments, []);
  pending.setView('progress-tracker');
  resolveReady();
  await new Promise(setImmediate);
  assert.deepEqual(pending.assignments, ['/roadmap/progress-tracker/teams']);
});

test('content wiring does not couple the landing preference to Roadmap styling', async () => {
  const source = await readFile('src/content/index.ts', 'utf8');
  assert.match(source, /installRoadmapLandingPreference/);
  assert.match(source, /\(\)\s*=>\s*settings\.roadmapLandingView/);
});
