const CHANNEL_LABEL_SELECTORS = [
  'a.orion-tavern-c-SidebarLeftBookmark[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names',
  '#react #page.lobby .lobby-name',
];
const BOOKMARK_LABEL_SELECTOR = CHANNEL_LABEL_SELECTORS[0];
const TITLE_SELECTOR = CHANNEL_LABEL_SELECTORS[1];
const SELECTED_BOOKMARK_SELECTOR = 'a.orion-tavern-c-SidebarLeftBookmark.-isSelected[href*="/lobby/"] .orion-tavern-c-SidebarLeftBookmark__names';
const TITLE_HEADER_SELECTOR = '#react #page.lobby .lobby-header';
const DISPLAY_LABELS = new Map([
  ['#general', 'SC General'],
  ['#sc-testing-chat', 'SC testing chat'],
]);
const DISCOVERY_TIMEOUT_MS = 15_000;

type StoredLabel = { original: string; display: string };
type ObserverWindow = Pick<Window, 'setTimeout' | 'clearTimeout'> & { MutationObserver: typeof MutationObserver };

export function createSpectrumChannelLabelController(
  doc: Pick<Document, 'documentElement' | 'querySelectorAll'>,
  isLobbyRoute: () => boolean = () => false,
  observerWindow: ObserverWindow = window,
): (enabled: boolean) => void {
  const originalLabels = new Map<HTMLElement, StoredLabel>();
  let enabled = false;
  let observer: MutationObserver | null = null;
  let watchingForLabels = false;
  let discoveryExpired = false;
  let discoveryTimer: number | undefined;

  const clearDiscoveryTimer = (): void => {
    if (discoveryTimer === undefined) return;
    observerWindow.clearTimeout(discoveryTimer);
    discoveryTimer = undefined;
  };

  const syncActiveTitle = (): void => {
    const activeBookmark = doc.querySelectorAll<HTMLElement>(SELECTED_BOOKMARK_SELECTOR)[0];
    if (!activeBookmark) return;

    const activeText = activeBookmark.textContent ?? '';
    const activeTracked = originalLabels.get(activeBookmark);
    const nativeLabel = activeTracked && activeText === activeTracked.display
      ? activeTracked.original
      : activeText;
    const desiredTitle = DISPLAY_LABELS.get(nativeLabel.trim().toLowerCase()) ?? nativeLabel;

    for (const title of doc.querySelectorAll<HTMLElement>(TITLE_SELECTOR)) {
      originalLabels.set(title, { original: nativeLabel, display: desiredTitle });
      if ((title.textContent ?? '') !== desiredTitle) title.textContent = desiredTitle;
    }
  };

  const applyLabels = (): void => {
    const hasSelectedBookmark = doc.querySelectorAll<HTMLElement>(SELECTED_BOOKMARK_SELECTOR).length > 0;
    for (const selector of CHANNEL_LABEL_SELECTORS) {
      // When the sidebar identifies the active channel, use it as the source of
      // truth instead of relabelling a possibly stale React header first.
      if (selector === TITLE_SELECTOR && hasSelectedBookmark) continue;
      for (const element of doc.querySelectorAll<HTMLElement>(selector)) {
        const current = element.textContent ?? '';
        const display = DISPLAY_LABELS.get(current.trim().toLowerCase());
        const tracked = originalLabels.get(element);

        if (display) {
          originalLabels.set(element, { original: current, display });
          if (current !== display) element.textContent = display;
        } else if (tracked && current !== tracked.display) {
          // React may reuse the active title for an unrelated channel.
          originalLabels.set(element, { original: current, display: tracked.display });
        }
      }
    }
    if (hasSelectedBookmark) syncActiveTitle();
  };

  const recordAddsChannelLabel = (records: MutationRecord[]): boolean => records.some(record =>
    Array.from(record.addedNodes).some(node => {
      if (node.nodeType !== 1) return false;
      const element = node as Element;
      return element.matches('.lobby-name, .orion-tavern-c-SidebarLeftBookmark__names')
        || Boolean(element.querySelector('.lobby-name, .orion-tavern-c-SidebarLeftBookmark__names'));
    }),
  );

  const recordTouchesTitleHeader = (records: MutationRecord[]): boolean => {
    const titleHeaders = doc.querySelectorAll<HTMLElement>(TITLE_HEADER_SELECTOR);
    return Array.from(titleHeaders).some(header => records.some(record =>
      record.target === header || header.contains(record.target),
    ));
  };

  const recordTouchesBookmarkSelection = (records: MutationRecord[]): boolean => {
    const bookmarkAnchors = Array.from(doc.querySelectorAll<HTMLElement>(BOOKMARK_LABEL_SELECTOR),
      label => label.parentElement ?? label);
    return records.some(record => record.type === 'attributes'
      && record.attributeName === 'class'
      && bookmarkAnchors.includes(record.target as HTMLElement));
  };

  const syncObserver = (): void => {
    if (!enabled) return;
    const activeObserver = observer ?? (observer = new observerWindow.MutationObserver(records => {
      if (!enabled || (watchingForLabels && !recordAddsChannelLabel(records)
        && !recordTouchesTitleHeader(records) && !recordTouchesBookmarkSelection(records))) return;
      applyLabels();
      syncObserver();
    }));

    activeObserver.disconnect();
    const targets = new Map<Element, MutationObserverInit>();
    const observeSubtree = (target: Element): void => {
      const options = targets.get(target);
      targets.set(target, { ...options, childList: true, characterData: true, subtree: true });
    };
    const observeDirectChildren = (target: Element): void => {
      if (!targets.has(target)) targets.set(target, { childList: true, subtree: false });
    };
    let titleFound = false;
    let bookmarksFound = false;
    const titleHeaders = doc.querySelectorAll<HTMLElement>(TITLE_HEADER_SELECTOR);

    for (const selector of CHANNEL_LABEL_SELECTORS) {
      const elements = doc.querySelectorAll<HTMLElement>(selector);
      if (selector === TITLE_SELECTOR && elements.length) titleFound = true;
      if (selector !== TITLE_SELECTOR && elements.length) bookmarksFound = true;
      for (const element of elements) {
        if (selector === TITLE_SELECTOR && titleHeaders.length) continue;
        const target = element.parentElement ?? element;
        observeSubtree(target);
        if (selector === BOOKMARK_LABEL_SELECTOR) {
          const options = targets.get(target);
          targets.set(target, { ...options, attributes: true, attributeFilter: ['class'] });
          // Keep watching the stable list container too; React may replace the
          // selected anchor instead of only toggling its selection class.
          if (target.parentElement) observeDirectChildren(target.parentElement);
        }
      }
    }
    for (const header of titleHeaders) {
      observeSubtree(header);
      if (header.parentElement) observeDirectChildren(header.parentElement);
    }

    const needsDiscovery = (isLobbyRoute() && !titleFound) || !bookmarksFound;
    watchingForLabels = needsDiscovery && !discoveryExpired;
    if (watchingForLabels) observeSubtree(doc.documentElement);

    for (const [target, options] of targets) activeObserver.observe(target, options);

    if (watchingForLabels && discoveryTimer === undefined) {
      discoveryTimer = observerWindow.setTimeout(() => {
        discoveryTimer = undefined;
        if (!enabled || !watchingForLabels) return;
        watchingForLabels = false;
        discoveryExpired = true;
        syncObserver();
      }, DISCOVERY_TIMEOUT_MS);
    } else if (!watchingForLabels) {
      clearDiscoveryTimer();
    }
  };

  return shouldEnable => {
    if (!shouldEnable) {
      enabled = false;
      observer?.disconnect();
      observer = null;
      watchingForLabels = false;
      discoveryExpired = false;
      clearDiscoveryTimer();
      for (const [element, tracked] of originalLabels) {
        if (element.textContent === tracked.display && element.textContent !== tracked.original) {
          element.textContent = tracked.original;
        }
      }
      originalLabels.clear();
      return;
    }

    if (!enabled) discoveryExpired = false;
    enabled = true;
    applyLabels();
    syncObserver();
  };
}
