const RIGHT_SIDEBAR_SELECTOR = '.mainLayout__sidebar.mainLayout__right';
const MESSAGES_TITLE_SELECTOR = '.orion-tavern-c-sidebarRightHeader__title[title="Messages"]';
const HEADER_TOP_SELECTOR = '.orion-tavern-c-sidebarRightHeader__top';
const HEADER_COUNTER_SELECTOR = '.orion-tavern-c-sidebarRightHeader__counter';
const CONVERSATION_SELECTOR = 'a.orion-tavern-c-SidebarRightDirectMessage';
const ROW_COUNTER_SELECTOR = '.orion-tavern-c-SidebarRightDirectMessage__counter';
const ROW_COUNTER_TEXT_SELECTOR = '.orion-tavern-c-SidebarRightDirectMessage__counter p';
const SUMMARY_CLASS = 'rsi-spectrum-message-summary';
const DISCOVERY_TIMEOUT_MS = 15_000;

type MessagesDocument = Pick<Document, 'documentElement' | 'querySelector' | 'createElement'>;
type MessagesWindow = Pick<Window, 'setTimeout' | 'clearTimeout'> & { MutationObserver: typeof MutationObserver };

function unreadFromHeader(sidebar: HTMLElement): number | null {
  const counter = sidebar.querySelector<HTMLElement>(HEADER_COUNTER_SELECTOR);
  if (!counter) return null;
  const text = `${counter.getAttribute('title') ?? ''} ${counter.textContent ?? ''}`;
  const match = text.match(/([\d,]+)\s+unread\b/i);
  return match ? Number(match[1].replaceAll(',', '')) : null;
}

function unreadFromRows(sidebar: HTMLElement): number {
  return Array.from(sidebar.querySelectorAll<HTMLElement>(CONVERSATION_SELECTOR)).reduce((total, row) => {
    const counter = row.querySelector<HTMLElement>(ROW_COUNTER_SELECTOR);
    if (!counter) return total;
    const text = row.querySelector<HTMLElement>(ROW_COUNTER_TEXT_SELECTOR)?.textContent ?? counter.textContent ?? '';
    const match = text.match(/[\d,]+/);
    return total + (match ? Number(match[0].replaceAll(',', '')) : 1);
  }, 0);
}

function formatSummary(conversationCount: number, unreadCount: number): string {
  const conversationLabel = conversationCount === 1 ? 'conversation' : 'conversations';
  return `${conversationCount} ${conversationLabel} · ${unreadCount} unread`;
}

export function createSpectrumMessagesSummaryController(
  doc: MessagesDocument,
  observerWindow: MessagesWindow = window,
): (enabled: boolean) => void {
  let enabled = false;
  let observedSidebar: HTMLElement | null = null;
  let observedMount: HTMLElement | null = null;
  let observer: MutationObserver | null = null;
  let mountObserver: MutationObserver | null = null;
  let discoveryObserver: MutationObserver | null = null;
  let discoveryTimer: number | undefined;
  let discoveryExpired = false;
  let renderedSummary: HTMLElement | null = null;

  const removeSummary = (): void => {
    renderedSummary?.remove();
    renderedSummary = null;
  };

  const stopDiscovery = (): void => {
    discoveryObserver?.disconnect();
    discoveryObserver = null;
    if (discoveryTimer !== undefined) observerWindow.clearTimeout(discoveryTimer);
    discoveryTimer = undefined;
  };

  const stopSidebarObservers = (): void => {
    observer?.disconnect();
    observer = null;
    mountObserver?.disconnect();
    mountObserver = null;
    observedSidebar = null;
    observedMount = null;
  };

  const syncSummary = (sidebar: HTMLElement): void => {
    const title = sidebar.querySelector<HTMLElement>(MESSAGES_TITLE_SELECTOR);
    const top = title ? sidebar.querySelector<HTMLElement>(HEADER_TOP_SELECTOR) : null;
    if (!top) {
      removeSummary();
      return;
    }

    if (renderedSummary?.parentElement !== top) {
      removeSummary();
      renderedSummary = doc.createElement('span');
      renderedSummary.className = SUMMARY_CLASS;
      renderedSummary.setAttribute('data-rsi-spectrum-message-summary', 'true');
      renderedSummary.setAttribute('role', 'status');
      renderedSummary.setAttribute('aria-live', 'polite');
      top.append(renderedSummary);
    }

    const conversationCount = sidebar.querySelectorAll<HTMLElement>(CONVERSATION_SELECTOR).length;
    const unreadCount = unreadFromHeader(sidebar) ?? unreadFromRows(sidebar);
    const nextText = formatSummary(conversationCount, unreadCount);
    if (renderedSummary.textContent !== nextText) renderedSummary.textContent = nextText;
  };

  const watchForSidebar = (): void => {
    if (!enabled || discoveryExpired || discoveryObserver) return;
    const root = doc.querySelector<HTMLElement>('#react') ?? doc.documentElement;
    if (!root) return;
    discoveryObserver = new observerWindow.MutationObserver(() => {
      if (!enabled || !doc.querySelector<HTMLElement>(RIGHT_SIDEBAR_SELECTOR)) return;
      stopDiscovery();
      syncObserver();
    });
    discoveryObserver.observe(root, { childList: true, subtree: true });
    discoveryTimer = observerWindow.setTimeout(() => {
      stopDiscovery();
      discoveryExpired = true;
    }, DISCOVERY_TIMEOUT_MS);
  };

  const syncObserver = (): void => {
    if (!enabled) return;
    const sidebar = doc.querySelector<HTMLElement>(RIGHT_SIDEBAR_SELECTOR);
    if (!sidebar) {
      removeSummary();
      stopSidebarObservers();
      watchForSidebar();
      return;
    }

    stopDiscovery();
    if (sidebar !== observedSidebar) {
      removeSummary();
      stopSidebarObservers();
      observedSidebar = sidebar;
      observer = new observerWindow.MutationObserver(() => {
        if (!enabled) return;
        syncObserver();
      });
      observer.observe(sidebar, { childList: true, subtree: true, characterData: true, attributes: true });
    }

    const mount = sidebar.parentElement;
    if (mount && mount !== observedMount) {
      mountObserver?.disconnect();
      observedMount = mount;
      mountObserver = new observerWindow.MutationObserver(() => {
        if (!enabled) return;
        syncObserver();
      });
      mountObserver.observe(mount, { childList: true });
    }
    syncSummary(sidebar);
  };

  return shouldEnable => {
    if (!shouldEnable) {
      enabled = false;
      stopDiscovery();
      stopSidebarObservers();
      removeSummary();
      discoveryExpired = false;
      return;
    }

    if (!enabled) discoveryExpired = false;
    enabled = true;
    syncObserver();
  };
}
