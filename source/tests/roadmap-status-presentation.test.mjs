import assert from 'node:assert/strict';
import { test } from 'node:test';
import { labelRoadmapReleaseNames, labelRoadmapStatuses, roadmapStatusFromText } from '../src/content/roadmap-status-presentation.ts';

test('Roadmap release headers prefix numbered patch names with Alpha only', () => {
  const headings = ['4.10', '4.10.1', 'Star Citizen 1.0'].map(textContent => ({
    textContent,
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
  }));
  labelRoadmapReleaseNames({ querySelectorAll: () => headings });

  assert.deepEqual(headings.map(heading => heading.getAttribute('data-rsi-roadmap-alpha')), ['true', 'true', null]);
});

test('Roadmap status text maps case-insensitively to the three color keys', () => {
  assert.equal(roadmapStatusFromText('Tentative, Q4 2026'), 'tentative');
  assert.equal(roadmapStatusFromText('Committed, Q1 2027'), 'committed');
  assert.equal(roadmapStatusFromText('Released'), 'released');
  assert.equal(roadmapStatusFromText('Unknown'), null);
});

test('Roadmap status elements receive semantic markers based on their visible label', () => {
  const elements = ['Tentative', 'Committed, Q1 2027', 'Released', 'Unannounced'].map(textContent => ({
    textContent,
    svg: createSvg(),
    attributes: new Map(),
    querySelector(selector) { return selector === 'svg' ? this.svg : null; },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  }));
  labelRoadmapStatuses({ querySelectorAll: () => elements });
  assert.deepEqual(elements.map(element => element.getAttribute('data-rsi-roadmap-status')), [
    'tentative', 'committed', 'released', null,
  ]);
});

test('Roadmap statuses use question, flag, and check icons', () => {
  const elements = ['Tentative', 'Committed', 'Released'].map(textContent => ({
    textContent,
    svg: createSvg(),
    attributes: new Map(),
    querySelector(selector) { return selector === 'svg' ? this.svg : null; },
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  }));
  labelRoadmapStatuses({ querySelectorAll: () => elements });

  const [tentative, committed, released] = elements.map(element => element.svg.childNodes);
  assert.deepEqual(tentative.map(node => node.localName), ['path', 'circle']);
  assert.equal(tentative[0].getAttribute('data-part'), '?');
  assert.deepEqual(committed.map(node => node.localName), ['path', 'path']);
  assert.equal(committed[0].getAttribute('data-part'), 'pole');
  assert.equal(committed[1].getAttribute('data-part'), 'flag');
  assert.deepEqual(released.map(node => node.localName), ['path']);
  assert.equal(released[0].getAttribute('data-part'), 'check');
});

function createSvg() {
  const attributes = new Map([['viewBox', '0 0 12 13']]);
  return {
    childNodes: [],
    ownerDocument: {
      createElementNS(_namespace, localName) {
        const nodeAttributes = new Map();
        return {
          localName,
          setAttribute(name, value) { nodeAttributes.set(name, value); },
          getAttribute(name) { return nodeAttributes.get(name) ?? null; },
        };
      },
    },
    getAttribute(name) { return attributes.get(name) ?? null; },
    setAttribute(name, value) { attributes.set(name, value); },
    replaceChildren(...children) { this.childNodes = children; },
  };
}
