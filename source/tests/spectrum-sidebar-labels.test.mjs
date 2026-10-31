import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

let createSpectrumChannelLabelController;
try {
  ({ createSpectrumChannelLabelController } = await import('../src/content/spectrum-sidebar-labels.ts'));
} catch {
  // The first test run is expected to fail until the new helper is implemented.
}

function observerHarness() {
  const observers = [];
  const timers = [];
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = [];
      observers.push(this);
    }

    observe(target, options) {
      this.targets.push({ target, options });
    }

    disconnect() {
      this.targets = [];
    }

    trigger(records = []) {
      this.callback(records, this);
    }

    triggerAt(target, records = []) {
      const observed = this.targets.some(item => item.target === target && records.every(record => {
        if (record.type === 'attributes') {
          return item.options.attributes === true
            && (!item.options.attributeFilter || item.options.attributeFilter.includes(record.attributeName));
        }
        return item.options[record.type] === true;
      }));
      if (observed) this.callback(records, this);
    }
  }

  return {
    observers,
    timers,
    window: {
      MutationObserver: FakeMutationObserver,
      setTimeout(callback, delay) {
        timers.push({ callback, delay });
        return timers.length;
      },
      clearTimeout() {},
    },
  };
}

test('chat bookmark labels are clearer while their native text is restored when chat styling is disabled', async () => {
  assert.equal(typeof createSpectrumChannelLabelController, 'function', 'chat label controller should be available');

  const label = (textContent, isTitle = false, isBookmark = false) => ({
    textContent,
    parentElement: {},
    nodeType: 1,
    matches: selector => (isTitle && selector.includes('.lobby-name'))
      || (isBookmark && selector.includes('.orion-tavern-c-SidebarLeftBookmark__names')),
    querySelector: () => null,
  });
  const general = label('#general');
  const testing = label('#sc-testing-chat');
  const other = label('#helpdesk-volunteers');
  const generalTitle = label('#general', true);
  const testingTitle = label('#sc-testing-chat', true);
  const reusedTitle = label('#general', true);
  const selectorCalls = [];
  const observerHost = observerHarness();
  const documentRoot = {};
  const bookmarkSelector = 'a.orion-tavern-c-SidebarLeftBookmark[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names';
  const titleSelector = '#react #page.lobby .lobby-name';
  const doc = {
    querySelectorAll(selector) {
      selectorCalls.push(selector);
      if (selector === bookmarkSelector) return [general, testing, other];
      if (selector === titleSelector) return [generalTitle, testingTitle, reusedTitle];
      return [];
    },
    documentElement: documentRoot,
  };
  const update = createSpectrumChannelLabelController(doc, () => true, observerHost.window);

  update(true);
  assert.equal(general.textContent, 'SC General');
  assert.equal(testing.textContent, 'SC testing chat');
  assert.equal(other.textContent, '#helpdesk-volunteers');
  assert.equal(generalTitle.textContent, 'SC General');
  assert.equal(testingTitle.textContent, 'SC testing chat');
  update(true);
  assert.equal(generalTitle.textContent, 'SC General', 'reapplying labels should leave the active title mapped');
  generalTitle.textContent = '#sc-testing-chat';
  update(true);
  assert.equal(generalTitle.textContent, 'SC testing chat', 'the top title should follow a React channel change');
  reusedTitle.textContent = '#helpdesk-volunteers';
  assert.ok(observerHost.observers.length, 'observe React title changes');
  observerHost.observers.at(-1).trigger();
  assert.equal(reusedTitle.textContent, '#helpdesk-volunteers', 'a reused title should keep an unrelated native channel name');
  update(false);
  assert.equal(general.textContent, '#general');
  assert.equal(testing.textContent, '#sc-testing-chat');
  assert.equal(other.textContent, '#helpdesk-volunteers');
  assert.equal(generalTitle.textContent, '#sc-testing-chat', 'disabling the module should restore the current channel title');
  assert.equal(testingTitle.textContent, '#sc-testing-chat');
  assert.equal(reusedTitle.textContent, '#helpdesk-volunteers', 'disabling the module should not restore a stale channel title');
  assert.ok(selectorCalls.every(selector => selector === bookmarkSelector
    || selector === 'a.orion-tavern-c-SidebarLeftBookmark.-isSelected[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names'
    || selector === titleSelector || selector === '#react #page.lobby .lobby-header'));

  const entry = await readFile('src/content/index.ts', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-chat.html', 'utf8');
  assert.match(entry, /createSpectrumChannelLabelController\(\s*document,\s*\(\) => location\.pathname\.toLowerCase\(\)\.includes\('\/lobby\/'\),\s*window,/);
  assert.match(entry, /refreshChannelLabels\(activeSection === 'spectrum' && settings\.modules\.chat\)/);
  assert.match(entry, /window\.requestAnimationFrame\(\(\) => \{\s*refreshChannelLabels\(sectionForPath\(location\.pathname\) === 'spectrum' && settings\.modules\.chat\);\s*\}\)/);
  assert.match(fixture, /href="\/spectrum\/community\/SC\/lobby\/1"><span class="orion-tavern-c-SidebarLeftBookmark__names">#general<\/span>/);
  assert.match(fixture, /href="\/spectrum\/community\/SC\/lobby\/8"><span class="orion-tavern-c-SidebarLeftBookmark__names">#sc-testing-chat<\/span>/);
});

test('a late React chat title is found and relabelled without another route event', () => {
  assert.equal(typeof createSpectrumChannelLabelController, 'function', 'chat label controller should be available');
  const observerHost = observerHarness();
  const documentRoot = {};
  let title = null;
  let bookmarks = [];
  const doc = {
    documentElement: documentRoot,
    querySelectorAll(selector) {
      if (selector === 'a.orion-tavern-c-SidebarLeftBookmark[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names') return bookmarks;
      if (selector === '#react #page.lobby .lobby-name') return title ? [title] : [];
      return [];
    },
  };
  const update = createSpectrumChannelLabelController(doc, () => true, observerHost.window);

  update(true);
  assert.ok(observerHost.observers.length, 'observe until React mounts the title');
  assert.equal(observerHost.observers.at(-1).targets[0].target, documentRoot, 'wait for a title that React has not mounted yet');
  title = {
    textContent: '#general',
    parentElement: {},
    nodeType: 1,
    matches: selector => selector.includes('.lobby-name'),
    querySelector: () => null,
  };
  observerHost.observers.at(-1).trigger([{ addedNodes: [title] }]);
  assert.equal(title.textContent, 'SC General');
  assert.ok(observerHost.observers.at(-1).targets.some(item => item.target === documentRoot), 'keep discovering while the sidebar is also missing');

  const bookmark = {
    textContent: '#general',
    parentElement: {},
    nodeType: 1,
    matches: selector => selector.includes('.orion-tavern-c-SidebarLeftBookmark__names'),
    querySelector: () => null,
  };
  bookmarks = [bookmark];
  observerHost.observers.at(-1).trigger([{ addedNodes: [bookmark] }]);
  assert.equal(bookmark.textContent, 'SC General', 'a late sidebar bookmark should be relabelled');
  const observedTargets = observerHost.observers.at(-1).targets.map(item => item.target);
  assert.ok(observedTargets.includes(title.parentElement), 'watch the small title container after discovery');
  assert.ok(observedTargets.includes(bookmark.parentElement), 'watch the bookmark container after discovery');
  update(false);
  assert.equal(title.textContent, '#general');
  assert.equal(bookmark.textContent, '#general');
});

test('the active chat title follows React replacing its title subtree or header during a channel switch', () => {
  assert.equal(typeof createSpectrumChannelLabelController, 'function', 'chat label controller should be available');
  const observerHost = observerHarness();
  const documentRoot = {};
  const lobbyContainer = {};
  let lobbyHeader = { parentElement: lobbyContainer };
  let title;
  const titleSelector = '#react #page.lobby .lobby-name';
  const headerSelector = '#react #page.lobby .lobby-header';
  const bookmarkSelector = 'a.orion-tavern-c-SidebarLeftBookmark[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names';
  const bookmark = { textContent: 'SC General', parentElement: {} };
  const doc = {
    documentElement: documentRoot,
    querySelectorAll(selector) {
      if (selector === bookmarkSelector) return [bookmark];
      if (selector === titleSelector) return title ? [title] : [];
      if (selector === headerSelector) return [lobbyHeader];
      return [];
    },
  };
  const makeTitle = textContent => ({ textContent, parentElement: {}, nodeType: 1 });
  title = makeTitle('#general');
  const update = createSpectrumChannelLabelController(doc, () => true, observerHost.window);

  update(true);
  assert.equal(title.textContent, 'SC General');

  title = makeTitle('#sc-testing-chat');
  observerHost.observers.at(-1).triggerAt(lobbyHeader, [{
    type: 'childList',
    target: lobbyHeader,
    addedNodes: [title],
    removedNodes: [],
  }]);
  assert.equal(title.textContent, 'SC testing chat', 'a replaced active title should use the new channel label');

  const previousHeader = lobbyHeader;
  lobbyHeader = { parentElement: lobbyContainer };
  title = makeTitle('#general');
  observerHost.observers.at(-1).triggerAt(lobbyContainer, [{
    type: 'childList',
    target: lobbyContainer,
    addedNodes: [lobbyHeader],
    removedNodes: [previousHeader],
  }]);
  assert.equal(title.textContent, 'SC General', 'replacing the whole header should still follow the active channel');

  title = makeTitle('#sc-testing-chat');
  observerHost.observers.at(-1).triggerAt(lobbyHeader, [{
    type: 'childList',
    target: lobbyHeader,
    addedNodes: [title],
    removedNodes: [],
  }]);
  assert.equal(title.textContent, 'SC testing chat', 'the title should follow a later switch back to testing chat');
  update(false);
  assert.equal(title.textContent, '#sc-testing-chat', 'disabling the module restores the current native channel name');
});

test('the selected sidebar channel corrects the active title when Spectrum leaves it stale', () => {
  assert.equal(typeof createSpectrumChannelLabelController, 'function', 'chat label controller should be available');
  const observerHost = observerHarness();
  const documentRoot = {};
  const header = {};
  const generalAnchor = {};
  const testingAnchor = {};
  const general = { textContent: '#general', parentElement: generalAnchor, nodeType: 1 };
  const testing = { textContent: '#sc-testing-chat', parentElement: testingAnchor, nodeType: 1 };
  const title = { textContent: '#general', parentElement: {}, nodeType: 1 };
  let active = general;
  const bookmarkSelector = 'a.orion-tavern-c-SidebarLeftBookmark[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names';
  const selectedBookmarkSelector = 'a.orion-tavern-c-SidebarLeftBookmark.-isSelected[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names';
  const titleSelector = '#react #page.lobby .lobby-name';
  const headerSelector = '#react #page.lobby .lobby-header';
  const doc = {
    documentElement: documentRoot,
    querySelectorAll(selector) {
      if (selector === bookmarkSelector) return [general, testing];
      if (selector === selectedBookmarkSelector) return [active];
      if (selector === titleSelector) return [title];
      if (selector === headerSelector) return [header];
      return [];
    },
  };
  const update = createSpectrumChannelLabelController(doc, () => true, observerHost.window);

  update(true);
  assert.equal(title.textContent, 'SC General');
  active = testing;
  observerHost.observers.at(-1).triggerAt(testingAnchor, [{
    type: 'attributes',
    attributeName: 'class',
    target: testingAnchor,
    addedNodes: [],
    removedNodes: [],
  }]);
  assert.equal(title.textContent, 'SC testing chat', 'the selected sidebar label should replace a stale active title');

  active = general;
  observerHost.observers.at(-1).triggerAt(generalAnchor, [{
    type: 'attributes',
    attributeName: 'class',
    target: generalAnchor,
    addedNodes: [],
    removedNodes: [],
  }]);
  assert.equal(title.textContent, 'SC General', 'the selected sidebar label should also correct a return switch');
  update(false);
  assert.equal(title.textContent, '#general', 'disabling the module restores the native active channel title');
});

test('a replaced selected sidebar bookmark still corrects the active title after discovery', () => {
  const observerHost = observerHarness();
  const documentRoot = {};
  const sidebar = {};
  const generalAnchor = { parentElement: sidebar };
  const testingAnchor = { parentElement: sidebar };
  const general = { textContent: '#general', parentElement: generalAnchor, nodeType: 1 };
  const testing = { textContent: '#sc-testing-chat', parentElement: testingAnchor, nodeType: 1 };
  const title = { textContent: '#general', parentElement: {}, nodeType: 1 };
  let bookmarks = [general, testing];
  let active = general;
  const bookmarkSelector = 'a.orion-tavern-c-SidebarLeftBookmark[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names';
  const selectedBookmarkSelector = 'a.orion-tavern-c-SidebarLeftBookmark.-isSelected[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names';
  const titleSelector = '#react #page.lobby .lobby-name';
  const headerSelector = '#react #page.lobby .lobby-header';
  const doc = {
    documentElement: documentRoot,
    querySelectorAll(selector) {
      if (selector === bookmarkSelector) return bookmarks;
      if (selector === selectedBookmarkSelector) return [active];
      if (selector === titleSelector) return [title];
      if (selector === headerSelector) return [];
      return [];
    },
  };
  const update = createSpectrumChannelLabelController(doc, () => true, observerHost.window);
  update(true);
  assert.equal(title.textContent, 'SC General');

  const replacementAnchor = { parentElement: sidebar };
  const replacement = { textContent: '#sc-testing-chat', parentElement: replacementAnchor, nodeType: 1 };
  bookmarks = [general, replacement];
  active = replacement;
  observerHost.observers.at(-1).triggerAt(sidebar, [{
    type: 'childList', target: sidebar, addedNodes: [replacement], removedNodes: [],
  }]);

  assert.equal(replacement.textContent, 'SC testing chat', 'a newly rendered selected bookmark is relabelled');
  assert.equal(title.textContent, 'SC testing chat', 'the new selected bookmark corrects the stale General title');
  update(false);
  assert.equal(title.textContent, '#sc-testing-chat', 'the replacement title restores to its native channel name');
});

test('a title-only channel switch is relabelled while waiting for the sidebar to mount', () => {
  assert.equal(typeof createSpectrumChannelLabelController, 'function', 'chat label controller should be available');
  const observerHost = observerHarness();
  const documentRoot = {};
  const lobbyHeader = {
    contains: target => target === title,
  };
  let title = {
    textContent: '#general',
    parentElement: {},
    nodeType: 1,
  };
  const titleSelector = '#react #page.lobby .lobby-name';
  const headerSelector = '#react #page.lobby .lobby-header';
  const bookmarkSelector = 'a.orion-tavern-c-SidebarLeftBookmark[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names';
  const doc = {
    documentElement: documentRoot,
    querySelectorAll(selector) {
      if (selector === bookmarkSelector) return [];
      if (selector === titleSelector) return [title];
      if (selector === headerSelector) return [lobbyHeader];
      return [];
    },
  };
  const update = createSpectrumChannelLabelController(doc, () => true, observerHost.window);

  update(true);
  assert.equal(title.textContent, 'SC General');
  const discoveryTimerCount = observerHost.timers.length;
  title.textContent = '#sc-testing-chat';
  observerHost.observers.at(-1).trigger([{
    type: 'childList',
    target: title,
    addedNodes: [{ nodeType: 3 }],
    removedNodes: [],
  }]);
  assert.equal(title.textContent, 'SC testing chat', 'known title changes should pass discovery filtering');
  assert.equal(observerHost.timers.length, discoveryTimerCount, 'title updates should not restart the bounded discovery timer');

  observerHost.timers.at(-1).callback();
  assert.ok(!observerHost.observers.at(-1).targets.some(item => item.target === documentRoot), 'discovery stops observing the full document at its deadline');
  title.textContent = '#general';
  observerHost.observers.at(-1).trigger([{
    type: 'childList',
    target: title,
    addedNodes: [{ nodeType: 3 }],
    removedNodes: [],
  }]);
  assert.equal(title.textContent, 'SC General', 'the active title continues updating after bounded discovery ends');
  assert.ok(!observerHost.observers.at(-1).targets.some(item => item.target === documentRoot), 'a later title update does not restart document discovery');
  assert.equal(observerHost.timers.length, discoveryTimerCount, 'a later title update does not create another discovery timer');
});

test('a late sidebar is found on a Spectrum forum route', () => {
  assert.equal(typeof createSpectrumChannelLabelController, 'function', 'chat label controller should be available');
  const observerHost = observerHarness();
  const documentRoot = {};
  let bookmarks = [];
  const doc = {
    documentElement: documentRoot,
    querySelectorAll(selector) {
      if (selector === 'a.orion-tavern-c-SidebarLeftBookmark[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names') return bookmarks;
      return [];
    },
  };
  const update = createSpectrumChannelLabelController(doc, () => false, observerHost.window);

  update(true);
  assert.equal(observerHost.observers.at(-1).targets[0].target, documentRoot);
  const bookmark = {
    textContent: '#sc-testing-chat',
    parentElement: {},
    nodeType: 1,
    matches: selector => selector.includes('.orion-tavern-c-SidebarLeftBookmark__names'),
    querySelector: () => null,
  };
  bookmarks = [bookmark];
  observerHost.observers.at(-1).trigger([{ addedNodes: [bookmark] }]);
  assert.equal(bookmark.textContent, 'SC testing chat');
  update(false);
  assert.equal(bookmark.textContent, '#sc-testing-chat');
});
