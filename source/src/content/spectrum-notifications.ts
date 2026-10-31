const PANEL_SELECTOR = 'aside.quick-access.notifications';
const DISCOVERY_TIMEOUT_MS = 15_000;
const NOTIFICATION_FILTERS = [
  ['all', 'All'],
  ['replies', 'Replies'],
  ['votes', 'Votes'],
  ['mentions', 'Mentions'],
  ['moderation', 'Moderation'],
] as const;

export type SpectrumNotificationFilter = typeof NOTIFICATION_FILTERS[number][0];
export type SpectrumNotificationKind = Exclude<SpectrumNotificationFilter, 'all'> | 'other';

type NotificationElement = Pick<HTMLElement, 'tagName' | 'textContent' | 'querySelector'>;
type FilterWindow = Pick<Window, 'requestAnimationFrame' | 'setTimeout' | 'clearTimeout'>
  & { MutationObserver: typeof MutationObserver };

export function classifySpectrumNotification(item: NotificationElement): SpectrumNotificationKind {
  const body = item.querySelector('.item-text');
  const text = (body?.textContent ?? item.textContent ?? '').replace(/\s+/g, ' ').trim();
  const summary = body?.querySelector('strong')?.textContent?.trim() ?? '';

  if (/\bmoderator\b.*\b(?:deleted|removed|moderation)\b/i.test(text)
    || /\b(?:deleted|removed)\b.*\bmoderator\b/i.test(text)
    || /\b(?:moderation|moderator notice)\b/i.test(summary)) return 'moderation';
  if (/^\s*(?:\d[\d,]*|one|a|an)\s+(?:new\s+)?votes?\b/i.test(summary)) return 'votes';
  if (/\bmentioned you\b/i.test(text)) return 'mentions';
  if (/^\s*(?:\d[\d,]*|one|a|an)\s+(?:new\s+)?repl(?:y|ies)\b/i.test(summary)
    || /\b(?:replied to you|has quoted you|quoted you|repl(?:y|ies) to your thread)\b/i.test(text)) return 'replies';
  return 'other';
}

export function installSpectrumNotificationFilters(
  enabled: () => boolean,
  doc: Document = document,
  win: FilterWindow = window,
): () => void {
  let panel: HTMLElement | null = null;
  let notificationRoot: HTMLElement | null = null;
  let main: HTMLElement | null = null;
  let list: HTMLElement | null = null;
  let controls: HTMLElement | null = null;
  let status: HTMLElement | null = null;
  let selectedFilter: SpectrumNotificationFilter = 'all';
  let observer: MutationObserver | null = null;
  let discoveryObserver: MutationObserver | null = null;
  let discoveryTimer: number | undefined;
  let listening = false;
  let awaitingReady = false;

  const seenRows = new WeakSet<HTMLElement>();
  const nativelyHiddenRows = new WeakSet<HTMLElement>();
  const filteredRows = new WeakSet<HTMLElement>();

  const stopDiscovery = (): void => {
    discoveryObserver?.disconnect();
    discoveryObserver = null;
    if (discoveryTimer !== undefined) {
      win.clearTimeout(discoveryTimer);
      discoveryTimer = undefined;
    }
  };

  const onDocumentReady = (): void => {
    awaitingReady = false;
    refresh();
  };

  const waitForDocumentReady = (): void => {
    if (doc.readyState !== 'loading' || awaitingReady) return;
    doc.addEventListener('DOMContentLoaded', onDocumentReady, { once: true });
    awaitingReady = true;
  };

  const restoreFilteredRows = (): void => {
    for (const row of list?.querySelectorAll<HTMLElement>('.notifications-item') ?? []) {
      if (!filteredRows.has(row)) continue;
      row.hidden = nativelyHiddenRows.has(row);
      filteredRows.delete(row);
    }
  };

  const detachPanel = (): void => {
    restoreFilteredRows();
    observer?.disconnect();
    observer = null;
    controls?.remove();
    panel = notificationRoot = main = list = controls = status = null;
  };

  const updateRows = (): void => {
    if (!list || !controls) return;
    const rows = Array.from(list.querySelectorAll<HTMLElement>('.notifications-item'));
    let visible = 0;

    for (const row of rows) {
      if (!seenRows.has(row)) {
        seenRows.add(row);
        if (row.hidden) nativelyHiddenRows.add(row);
      }

      if (nativelyHiddenRows.has(row)) continue;
      const matches = selectedFilter === 'all' || classifySpectrumNotification(row) === selectedFilter;
      if (matches) {
        if (filteredRows.has(row)) {
          row.hidden = false;
          filteredRows.delete(row);
        }
        visible += 1;
      } else {
        row.hidden = true;
        filteredRows.add(row);
      }
    }

    for (const button of controls.querySelectorAll<HTMLButtonElement>('.rsi-notification-filter')) {
      button.setAttribute('aria-pressed', String(button.dataset.filter === selectedFilter));
    }
    if (status) {
      status.textContent = visible > 0
        ? `${visible} shown`
        : selectedFilter === 'all' ? 'No notifications yet.' : 'No notifications match this filter.';
    }
  };

  const createControls = (): HTMLElement => {
    const bar = doc.createElement('div');
    bar.className = 'rsi-notification-filters';
    const group = doc.createElement('div');
    group.className = 'rsi-notification-filter-group';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Filter notifications by type');

    for (const [filter, label] of NOTIFICATION_FILTERS) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'rsi-notification-filter';
      button.dataset.filter = filter;
      button.setAttribute('aria-pressed', String(filter === selectedFilter));
      if (filter === 'moderation') {
        const marker = doc.createElement('span');
        marker.className = 'rsi-notification-filter-marker';
        marker.setAttribute('aria-hidden', 'true');
        button.append(marker);
      }
      const text = doc.createElement('span');
      text.textContent = label;
      button.append(text);
      button.addEventListener('click', () => {
        selectedFilter = filter;
        updateRows();
      });
      group.append(button);
    }

    const liveStatus = doc.createElement('span');
    liveStatus.className = 'rsi-notification-filter-status';
    liveStatus.setAttribute('role', 'status');
    liveStatus.setAttribute('aria-live', 'polite');
    bar.append(group, liveStatus);
    status = liveStatus;
    return bar;
  };

  const syncObserver = (): void => {
    if (!panel || !notificationRoot || !main || !list) return;
    if (!observer) {
      observer = new win.MutationObserver(() => {
        if (!enabled()) { refresh(); return; }
        mountPanel();
      });
    }
    const activeObserver = observer;
    activeObserver.disconnect();
    if (panel.parentElement) activeObserver.observe(panel.parentElement, { childList: true });
    activeObserver.observe(panel, { childList: true });
    if (notificationRoot !== panel) activeObserver.observe(notificationRoot, { childList: true });
    activeObserver.observe(main, { childList: true });
    activeObserver.observe(list, { childList: true, subtree: true, characterData: true });
  };

  function mountPanel(): void {
    const nextPanel = doc.querySelector<HTMLElement>(PANEL_SELECTOR);
    if (!nextPanel) {
      detachPanel();
      startDiscovery();
      return;
    }

    stopDiscovery();
    if (panel && panel !== nextPanel) detachPanel();
    panel = nextPanel;
    notificationRoot = panel.querySelector<HTMLElement>('#notifications') ?? panel;
    main = panel.querySelector<HTMLElement>('.notifications-main');
    list = panel.querySelector<HTMLElement>('.notifications-list');
    if (!main || !list) return;

    if (!controls || controls.parentElement !== main) {
      controls?.remove();
      controls = createControls();
      main.insertBefore(controls, list);
    }
    syncObserver();
    updateRows();
  }

  function startDiscovery(): void {
    if (discoveryObserver || !doc.documentElement) return;
    const activeDiscoveryObserver = new win.MutationObserver(() => {
      if (!enabled()) { refresh(); return; }
      if (doc.querySelector<HTMLElement>(PANEL_SELECTOR)) mountPanel();
    });
    discoveryObserver = activeDiscoveryObserver;
    activeDiscoveryObserver.observe(doc.documentElement, { childList: true, subtree: true });
    discoveryTimer = win.setTimeout(stopDiscovery, DISCOVERY_TIMEOUT_MS);
  }

  const onDocumentClick = (): void => {
    if (!enabled()) { refresh(); return; }
    if (panel && doc.querySelector<HTMLElement>(PANEL_SELECTOR) === panel) return;
    win.requestAnimationFrame(() => {
      if (!enabled()) return;
      mountPanel();
      if (!panel) win.setTimeout(() => { if (enabled()) mountPanel(); }, 200);
    });
  };

  function refresh(): void {
    if (!enabled()) {
      stopDiscovery();
      detachPanel();
      selectedFilter = 'all';
      if (awaitingReady) {
        doc.removeEventListener('DOMContentLoaded', onDocumentReady);
        awaitingReady = false;
      }
      if (listening) {
        doc.removeEventListener('click', onDocumentClick, true);
        listening = false;
      }
      return;
    }

    if (!listening) {
      doc.addEventListener('click', onDocumentClick, true);
      listening = true;
    }
    waitForDocumentReady();
    mountPanel();
    if (!panel) startDiscovery();
  }

  return refresh;
}
