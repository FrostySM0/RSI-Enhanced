const SIDEBAR_SELECTOR = '.spectrumSidebarLeft';
const GROUP_SELECTOR = '.orion-tavern-c-SidebarLeftContentGroup';
const HEADER_SELECTOR = '.orion-tavern-c-SidebarLeftContentGroup__header';
const LIST_SELECTOR = '.orion-tavern-c-SidebarLeftContentGroup__content';
const EMPTY_STATE_CLASS = 'rsi-spectrum-sidebar-empty-state';
const DISCOVERY_TIMEOUT_MS = 15_000;
const GROUP_ACTIONS = [
  {
    nativeLabel: 'Start a group',
    icon: 'people',
    title: 'No private groups yet.',
    description: 'Create a group to chat with your organisation or friends.',
    buttonLabel: 'Create Private Group',
  },
  {
    nativeLabel: 'Start a conversation',
    icon: 'thought-bubble',
    title: 'No recent messages yet.',
    description: 'Start a conversation to see messages here.',
    buttonLabel: 'New Message',
  },
] as const;

type SidebarDocument = Pick<Document, 'documentElement' | 'querySelector' | 'querySelectorAll' | 'createElement' | 'createElementNS'>;
type SidebarWindow = Pick<Window, 'setTimeout' | 'clearTimeout'> & { MutationObserver: typeof MutationObserver };
type RenderedState = { element: HTMLDivElement; nativeLabel: string };

function makeEmptyStateIcon(doc: SidebarDocument, iconKind: (typeof GROUP_ACTIONS)[number]['icon']): HTMLDivElement {
  const icon = doc.createElement('div');
  icon.className = `${EMPTY_STATE_CLASS}__icon`;
  icon.setAttribute('aria-hidden', 'true');

  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 48 48');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('data-icon', iconKind);

  const shapes: Array<[string, Record<string, string>]> = iconKind === 'people'
    ? [
      ['circle', { cx: '24', cy: '14', r: '4' }],
      ['circle', { cx: '12.5', cy: '18', r: '3.2' }],
      ['circle', { cx: '35.5', cy: '18', r: '3.2' }],
      ['path', { d: 'M16 36v-2c0-6 3.2-10 8-10s8 4 8 10v2H16Z' }],
      ['path', { d: 'M5.5 34v-1.2c0-4.5 2.5-7.3 6.5-7.3 1.6 0 3 .5 4.1 1.4M42.5 34v-1.2c0-4.5-2.5-7.3-6.5-7.3-1.6 0-3 .5-4.1 1.4' }],
    ]
    : [
      ['path', { d: 'M28.5 18.8c0-4-3.3-7.2-7.3-7.2-.8-3.3-3.8-5.7-7.3-5.7-4.1 0-7.4 3.3-7.4 7.4v.2C3.7 14 1.8 16.4 1.8 19.4c0 3.9 3.2 7.1 7.1 7.1h12.3c4 0 7.3-3.5 7.3-7.7Z' }],
      ['circle', { cx: '34', cy: '29.5', r: '2.2' }],
      ['circle', { cx: '39.5', cy: '36', r: '1.4' }],
      ['circle', { cx: '11', cy: '18', r: '0.8', fill: 'currentColor', stroke: 'none' }],
      ['circle', { cx: '16', cy: '18', r: '0.8', fill: 'currentColor', stroke: 'none' }],
      ['circle', { cx: '21', cy: '18', r: '0.8', fill: 'currentColor', stroke: 'none' }],
    ];

  for (const [tag, attributes] of shapes) {
    const shape = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, value] of Object.entries(attributes)) shape.setAttribute(name, value);
    svg.append(shape);
  }
  icon.append(svg);
  return icon;
}

function makeEmptyState(
  doc: SidebarDocument,
  header: HTMLElement,
  config: (typeof GROUP_ACTIONS)[number],
): HTMLDivElement {
  const state = doc.createElement('div');
  state.className = EMPTY_STATE_CLASS;
  state.setAttribute('data-rsi-spectrum-empty-state', config.nativeLabel);
  state.setAttribute('role', 'status');
  state.setAttribute('aria-live', 'polite');

  const title = doc.createElement('p');
  title.className = `${EMPTY_STATE_CLASS}__title`;
  title.textContent = config.title;
  const description = doc.createElement('p');
  description.className = `${EMPTY_STATE_CLASS}__description`;
  description.textContent = config.description;

  const action = doc.createElement('button');
  action.className = `${EMPTY_STATE_CLASS}__action`;
  action.type = 'button';
  action.setAttribute('aria-label', config.buttonLabel);
  const plus = doc.createElement('span');
  plus.className = `${EMPTY_STATE_CLASS}__plus`;
  plus.setAttribute('aria-hidden', 'true');
  plus.textContent = '+';
  const label = doc.createElement('span');
  label.textContent = config.buttonLabel;
  action.append(plus, label);
  action.addEventListener('click', () => {
    const nativeButton = header.querySelector<HTMLButtonElement>(`button[aria-label="${config.nativeLabel}"]`);
    if (nativeButton?.isConnected) nativeButton.click();
  });

  state.append(makeEmptyStateIcon(doc, config.icon), title, description, action);
  return state;
}

export function createSpectrumSidebarEmptyStateController(
  doc: SidebarDocument,
  observerWindow: SidebarWindow = window,
): (enabled: boolean) => void {
  const rendered = new Map<HTMLElement, RenderedState>();
  let enabled = false;
  let observer: MutationObserver | null = null;
  let discoveryObserver: MutationObserver | null = null;
  let discoveryTimer: number | undefined;
  let discoveryExpired = false;

  const stopDiscovery = (): void => {
    discoveryObserver?.disconnect();
    discoveryObserver = null;
    if (discoveryTimer !== undefined) observerWindow.clearTimeout(discoveryTimer);
    discoveryTimer = undefined;
  };

  const watchForSidebar = (): void => {
    if (!enabled || discoveryExpired || discoveryObserver) return;
    const root = doc.querySelector<HTMLElement>('#react') ?? doc.documentElement;
    if (!root) return;
    discoveryObserver = new observerWindow.MutationObserver(() => {
      if (!enabled || !doc.querySelector<HTMLElement>(SIDEBAR_SELECTOR)) return;
      stopDiscovery();
      syncStates();
      syncObserver();
    });
    discoveryObserver.observe(root, { childList: true, subtree: true });
    discoveryTimer = observerWindow.setTimeout(() => {
      stopDiscovery();
      discoveryExpired = true;
    }, DISCOVERY_TIMEOUT_MS);
  };

  const readGroups = (): HTMLElement[] => Array.from(
    doc.querySelectorAll<HTMLElement>(`${SIDEBAR_SELECTOR} ${GROUP_SELECTOR}`),
  );

  const syncStates = (): void => {
    const liveGroups = new Set(readGroups());
    for (const [group, entry] of rendered) {
      if (!liveGroups.has(group)) {
        entry.element.remove();
        rendered.delete(group);
      }
    }

    for (const group of liveGroups) {
      const current = rendered.get(group);
      const header = group.querySelector<HTMLElement>(`:scope > ${HEADER_SELECTOR}`);
      if (!header) {
        current?.element.remove();
        rendered.delete(group);
        continue;
      }
      const config = GROUP_ACTIONS.find(item => header.querySelector(`button[aria-label="${item.nativeLabel}"]`));
      if (!config) {
        current?.element.remove();
        rendered.delete(group);
        continue;
      }
      const list = group.querySelector<HTMLElement>(`:scope > ${LIST_SELECTOR}`);
      const isEmpty = !list || !list.querySelector(':scope > li');

      if (!isEmpty) {
        current?.element.remove();
        rendered.delete(group);
        continue;
      }

      if (current?.nativeLabel === config.nativeLabel && current.element.parentElement === group) continue;
      current?.element.remove();
      const element = makeEmptyState(doc, header, config);
      group.append(element);
      rendered.set(group, { element, nativeLabel: config.nativeLabel });
    }
  };

  const syncObserver = (): void => {
    if (!enabled) return;
    const sidebar = doc.querySelector<HTMLElement>(SIDEBAR_SELECTOR);
    if (!sidebar) {
      watchForSidebar();
      return;
    }
    stopDiscovery();
    const mountPoint = sidebar.parentElement;
    const activeObserver = observer ?? (observer = new observerWindow.MutationObserver(records => {
      if (!enabled) return;
      const relevant = records.some(record => {
        const target = record.target;
        if (target === mountPoint || target === sidebar) return true;
        if (target.nodeType === 1 && (target as Element).closest(`${SIDEBAR_SELECTOR} ${GROUP_SELECTOR}`)) return true;
        return Array.from(record.addedNodes).some(node => {
          if (node.nodeType !== 1) return false;
          const element = node as Element;
          return element.matches(GROUP_SELECTOR) || Boolean(element.querySelector(GROUP_SELECTOR));
        });
      });
      if (!relevant) return;
      syncStates();
      if (doc.querySelector<HTMLElement>(SIDEBAR_SELECTOR) !== sidebar) syncObserver();
    }));
    activeObserver.disconnect();

    if (mountPoint) activeObserver.observe(mountPoint, { childList: true });
    activeObserver.observe(sidebar, { childList: true, subtree: true });
  };

  return shouldEnable => {
    if (!shouldEnable) {
      enabled = false;
      observer?.disconnect();
      observer = null;
      stopDiscovery();
      discoveryExpired = false;
      for (const { element } of rendered.values()) element.remove();
      rendered.clear();
      return;
    }

    if (!enabled) discoveryExpired = false;
    enabled = true;
    syncStates();
    syncObserver();
  };
}
