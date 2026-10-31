import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  roadmapCardHrefForModal,
  roadmapCardMetadata,
  roadmapMetadataMutationIsRelevant,
  roadmapUpdatedLabelText,
  shouldClearRoadmapCardIdentity,
} from '../src/content/roadmap-card-metadata.ts';

const page = 'https://robertsspaceindustries.com/roadmap/release-view';

test('reads the CIG updated date and slug from a native Roadmap card', () => {
  assert.deepEqual(
    roadmapCardMetadata(
      '/roadmap/release-view/1580-Heavy-Combat-Armor-Monolith?source=release-view',
      'Updated Aug. 26th 2026',
      page,
    ),
    { modified: 'Aug. 26th 2026', slug: '1580-Heavy-Combat-Armor-Monolith' },
  );
});

test('does not invent a modified date or accept slugs outside the native Roadmap route', () => {
  assert.deepEqual(roadmapCardMetadata('/roadmap/release-view/123-card', 'Description only', page), {
    modified: null,
    slug: '123-card',
  });
  assert.deepEqual(roadmapCardMetadata('https://example.test/roadmap/release-view/123-card', 'Updated Aug. 26th 2026', page), {
    modified: 'Aug. 26th 2026',
    slug: null,
  });
});

test('does not mistake a date mentioned inside the description for the native Modified field', () => {
  assert.deepEqual(
    roadmapCardMetadata(
      '/roadmap/release-view/123-card',
      'Implementing updates. Updated Aug. 26th 2026. More description follows.',
      page,
    ),
    { modified: null, slug: '123-card' },
  );
});

test('reads only the native Updated/date label candidates from the modal', () => {
  const candidates = [
    { textContent: 'Implementing improvements. Updated Sep. 9th 2026.' },
    { textContent: 'Updated Aug. 26th 2026' },
  ];
  const modal = {
    querySelectorAll: selector => {
      assert.match(selector, /Date/i);
      assert.match(selector, /Updated/i);
      return candidates;
    },
  };
  assert.equal(roadmapUpdatedLabelText(modal), 'Updated Aug. 26th 2026');
});

test('uses the clicked card identity when titles are duplicated and rejects stale clicked cards', () => {
  const clickedHref = '/roadmap/release-view/456-duplicate-title';
  assert.equal(roadmapCardHrefForModal(clickedHref, 'Same title', 'Same title', page), clickedHref);
  assert.equal(roadmapCardHrefForModal('/roadmap/release-view/old-card', 'Old title', 'New title', page), page);
  const firstModal = {};
  const replacementModal = {};
  assert.equal(shouldClearRoadmapCardIdentity(firstModal, null, page, page, false), true);
  assert.equal(shouldClearRoadmapCardIdentity(firstModal, replacementModal, page, page, false), true);
  assert.equal(shouldClearRoadmapCardIdentity(firstModal, replacementModal, page, page, true), false);
  assert.equal(shouldClearRoadmapCardIdentity(firstModal, firstModal, page, `${page}/456-duplicate-title`, false), true);
  assert.equal(shouldClearRoadmapCardIdentity(firstModal, firstModal, page, page, true), false);
});

test('refreshes metadata for modal lifecycle changes but ignores unrelated and injected mutations', () => {
  const modal = {
    nodeType: 1,
    matches: selector => selector.includes('Modal__ModalInner'),
    querySelector: () => null,
    closest: selector => selector.includes('Modal__ModalInner') ? modal : null,
    contains: node => node === modal,
  };
  const body = {
    nodeType: 1,
    matches: () => false,
    querySelector: () => null,
    closest: () => null,
  };
  const wrapper = {
    nodeType: 1,
    matches: () => false,
    querySelector: () => modal,
  };
  const metadata = { contains: node => node === metadata };
  const nativeContent = { nodeType: 1, matches: () => false, querySelector: () => null };
  const record = (target, addedNodes = [], removedNodes = []) => ({ target, addedNodes, removedNodes });

  assert.equal(roadmapMetadataMutationIsRelevant([record(body)]), false);
  assert.equal(roadmapMetadataMutationIsRelevant([record({ nodeType: 3, parentElement: modal })]), true);
  assert.equal(roadmapMetadataMutationIsRelevant([record(body, [wrapper])]), true);
  assert.equal(roadmapMetadataMutationIsRelevant([record(body, [], [modal])]), true);
  assert.equal(roadmapMetadataMutationIsRelevant([record(modal, [metadata])], metadata), false);
  assert.equal(roadmapMetadataMutationIsRelevant([record(modal, [metadata, nativeContent])], metadata), true);
  assert.equal(roadmapMetadataMutationIsRelevant([record(modal, [], [metadata])], metadata), true);
});
