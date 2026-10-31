import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roadmapVersionCards, roadmapVersionCardsFromParts } from '../src/content/roadmap-version-header.ts';

test('roadmap header cards preserve RSI values and their native information links', () => {
  const cards = roadmapVersionCards([
    { text: 'Live Version: 4.10.2 (more info)', href: '/en/comm-link/transmission/21334-Alpha-4102-RSI-Discovery-Month' },
    { text: 'Latest Roadmap Roundup: 21/10/2026 (more info)', href: '/spectrum/community/SC/forum/3/thread/roadmap-roundup-october-21-2026' },
    { text: 'PTU Version: ø', href: null },
  ]);

  assert.deepEqual(cards, [
    {
      id: 'live',
      label: 'Live Version',
      value: '4.10.2',
      href: '/en/comm-link/transmission/21334-Alpha-4102-RSI-Discovery-Month',
      actionLabel: 'More info ↗',
    },
    {
      id: 'roundup',
      label: 'Latest Roadmap Roundup',
      value: '21 / 10 / 2026',
      href: '/spectrum/community/SC/forum/3/thread/roadmap-roundup-october-21-2026',
      actionLabel: 'More info ↗',
    },
    { id: 'ptu', label: 'PTU Version', value: 'PTU closed', href: null, actionLabel: null },
  ]);
});

test('an active PTU card shows its patch number and only uses an RSI-provided patch-notes link', () => {
  const cards = roadmapVersionCards([
    { text: 'Live Version: 4.10.2 (more info)', href: '/patch-notes/live' },
    { text: 'Latest Roadmap Roundup: 21/10/2026 (more info)', href: '/roundup/latest' },
    { text: 'PTU Version: 4.10.3 (more info)', href: '/spectrum/community/SC/forum/3/thread/ptu-patch-notes' },
  ]);

  assert.deepEqual(cards[2], {
    id: 'ptu',
    label: 'PTU Version',
    value: '4.10.3',
    href: '/spectrum/community/SC/forum/3/thread/ptu-patch-notes',
    actionLabel: 'More info ↗',
  });
});

test('zero and empty PTU values are displayed as closed', () => {
  for (const value of ['0', '', 'ø']) {
    const cards = roadmapVersionCards([
      { text: 'PTU Version: ' + value, href: null },
    ]);
    assert.deepEqual(cards, [
      { id: 'ptu', label: 'PTU Version', value: 'PTU closed', href: null, actionLabel: null },
    ]);
  }
});

test('live header text nodes and separate info anchors are parsed into all three cards', () => {
  const cards = roadmapVersionCardsFromParts([
    { text: 'Live Version: 4.10.2 (' },
    { text: 'more info', href: '/en/comm-link/transmission/21334-Alpha-4102-RSI-Discovery-Month' },
    { text: ') ▪ Latest Roadmap Roundup: 21/10/2026 (' },
    { text: 'more info', href: '/spectrum/community/SC/forum/3/thread/roadmap-roundup-october-21-2026' },
    { text: ') ▪ PTU Version: ø' },
  ]);

  assert.deepEqual(cards.map(({ id, value, href }) => ({ id, value, href })), [
    { id: 'live', value: '4.10.2', href: '/en/comm-link/transmission/21334-Alpha-4102-RSI-Discovery-Month' },
    { id: 'roundup', value: '21 / 10 / 2026', href: '/spectrum/community/SC/forum/3/thread/roadmap-roundup-october-21-2026' },
    { id: 'ptu', value: 'PTU closed', href: null },
  ]);
});
