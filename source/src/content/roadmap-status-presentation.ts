export type RoadmapStatus = 'tentative' | 'committed' | 'released';

const STATUS_SELECTOR = '[class*="ReleaseHeaderStatus-"], [class*="StatusBar-"]';
const STATUS_ATTRIBUTE = 'data-rsi-roadmap-status';
const RELEASE_NAME_SELECTOR = '[class*="ReleaseHeaderName-"]';
const RELEASE_NAME_ATTRIBUTE = 'data-rsi-roadmap-alpha';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const STATUS_ICON_PARTS = {
  tentative: [
    { tagName: 'path', attributes: { 'data-part': '?', d: 'M3.2 3.1a1.9 1.9 0 1 1 3.1 1.4c-.8.7-1.3 1-1.3 2.3', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.35', 'stroke-linecap': 'round' } },
    { tagName: 'circle', attributes: { cx: '5', cy: '8.8', r: '.65', fill: 'currentColor' } },
  ],
  committed: [
    { tagName: 'path', attributes: { 'data-part': 'pole', d: 'M2.4 1.3v7.4', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.4', 'stroke-linecap': 'round' } },
    { tagName: 'path', attributes: { 'data-part': 'flag', d: 'M3.1 1.8h5.2L7 3.6l1.3 1.8H3.1z', fill: 'currentColor' } },
  ],
  released: [
    { tagName: 'path', attributes: { 'data-part': 'check', d: 'M2.1 5.2 4.3 7.4 8.4 2.8', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } },
  ],
} as const;

type StatusIcon = { icon: SVGSVGElement; children: Node[]; viewBox: string | null; status: RoadmapStatus | null };

function renderRoadmapStatusIcon(icon: SVGSVGElement, status: RoadmapStatus): void {
  const children = STATUS_ICON_PARTS[status].map(part => {
    const node = icon.ownerDocument.createElementNS(SVG_NAMESPACE, part.tagName);
    for (const [name, value] of Object.entries(part.attributes)) node.setAttribute(name, value);
    return node;
  });
  icon.setAttribute('viewBox', '0 0 10 10');
  icon.replaceChildren(...children);
}

export function roadmapStatusFromText(text: string): RoadmapStatus | null {
  const match = text.match(/\b(tentative|committed|released)\b/i)?.[1]?.toLowerCase();
  return match === 'tentative' || match === 'committed' || match === 'released' ? match : null;
}

export function labelRoadmapReleaseNames(root: Pick<ParentNode, 'querySelectorAll'>): void {
  for (const element of root.querySelectorAll<HTMLElement>(RELEASE_NAME_SELECTOR)) {
    const name = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (/^\d+(?:\.\d+)+$/.test(name)) element.setAttribute(RELEASE_NAME_ATTRIBUTE, 'true');
    else element.removeAttribute(RELEASE_NAME_ATTRIBUTE);
  }
}

export function labelRoadmapStatuses(root: Pick<ParentNode, 'querySelectorAll'>): void {
  for (const element of root.querySelectorAll<HTMLElement>(STATUS_SELECTOR)) {
    const status = roadmapStatusFromText(element.textContent ?? '');
    if (status) {
      element.setAttribute(STATUS_ATTRIBUTE, status);
      const icon = element.querySelector<SVGSVGElement>('svg');
      if (icon) renderRoadmapStatusIcon(icon, status);
    }
    else element.removeAttribute(STATUS_ATTRIBUTE);
  }
}

export function installRoadmapStatusPresentation(
  isEnabled: () => boolean,
  win: Window = window,
  doc: Document = document,
): () => void {
  const browserWindow = win as Window & typeof globalThis;
  const previousAttributes = new Map<HTMLElement, string | null>();
  const previousIcons = new Map<HTMLElement, StatusIcon>();
  const previousReleaseNameAttributes = new Map<HTMLElement, string | null>();
  let observer: MutationObserver | null = null;
  let legend: HTMLElement | null = null;
  let active = false;

  const restoreStatus = (element: HTMLElement): void => {
    const previous = previousAttributes.get(element);
    if (previous === null || previous === undefined) element.removeAttribute(STATUS_ATTRIBUTE);
    else element.setAttribute(STATUS_ATTRIBUTE, previous);
    previousAttributes.delete(element);

    const previousIcon = previousIcons.get(element);
    if (previousIcon) {
      previousIcon.icon.replaceChildren(...previousIcon.children);
      if (previousIcon.viewBox === null) previousIcon.icon.removeAttribute('viewBox');
      else previousIcon.icon.setAttribute('viewBox', previousIcon.viewBox);
      previousIcons.delete(element);
    }
  };

  const ensureLegend = (): void => {
    const board = doc.querySelector<HTMLElement>('article[class*="Board__Wrapper-"]');
    const header = board?.querySelector<HTMLElement>(':scope > [class*="Board__Header-"]');
    const description = header?.querySelector<HTMLElement>('[class*="Board__Description-"]');
    if (!header || !description) return;

    if (!legend) {
      legend = doc.createElement('div');
      legend.className = 'rsi-roadmap-status-legend';
      legend.setAttribute('role', 'list');
      legend.setAttribute('aria-label', 'Release status colors');
      for (const status of ['tentative', 'committed', 'released'] as const) {
        const item = doc.createElement('span');
        item.className = `rsi-roadmap-status-legend-item rsi-roadmap-status-legend-item--${status}`;
        item.setAttribute('role', 'listitem');
        const swatch = doc.createElement('span');
        swatch.className = `rsi-roadmap-status-legend-swatch rsi-roadmap-status-legend-swatch--${status}`;
        swatch.setAttribute('aria-hidden', 'true');
        const label = doc.createElement('span');
        label.textContent = status[0].toUpperCase() + status.slice(1);
        item.append(swatch, label);
        legend.append(item);
      }
    }

    if (legend.parentElement !== header || legend.previousElementSibling !== description) {
      description.insertAdjacentElement('afterend', legend);
    }
  };

  const apply = (): void => {
    if (!isEnabled()) return;

    const releaseNames = [...doc.querySelectorAll<HTMLElement>(RELEASE_NAME_SELECTOR)];
    const currentReleaseNames = new Set(releaseNames);
    for (const element of releaseNames) {
      if (!previousReleaseNameAttributes.has(element)) {
        previousReleaseNameAttributes.set(element, element.getAttribute(RELEASE_NAME_ATTRIBUTE));
      }
    }
    labelRoadmapReleaseNames({ querySelectorAll: () => releaseNames });
    for (const element of previousReleaseNameAttributes.keys()) {
      if (currentReleaseNames.has(element)) continue;
      const previous = previousReleaseNameAttributes.get(element);
      if (previous === null || previous === undefined) element.removeAttribute(RELEASE_NAME_ATTRIBUTE);
      else element.setAttribute(RELEASE_NAME_ATTRIBUTE, previous);
      previousReleaseNameAttributes.delete(element);
    }

    const elements = [...doc.querySelectorAll<HTMLElement>(STATUS_SELECTOR)];
    const current = new Set(elements);
    for (const element of elements) {
      const status = roadmapStatusFromText(element.textContent ?? '');
      if (!status) {
        if (previousAttributes.has(element)) restoreStatus(element);
        continue;
      }
      if (!previousAttributes.has(element)) previousAttributes.set(element, element.getAttribute(STATUS_ATTRIBUTE));
      if (element.getAttribute(STATUS_ATTRIBUTE) !== status) element.setAttribute(STATUS_ATTRIBUTE, status);

      const icon = element.querySelector<SVGSVGElement>('svg');
      let iconState = previousIcons.get(element);
      if (iconState && iconState.icon !== icon) {
        restoreIcon(element, iconState);
        previousIcons.delete(element);
        iconState = undefined;
      }
      if (icon && !iconState) {
        iconState = { icon, children: [...icon.childNodes], viewBox: icon.getAttribute('viewBox'), status: null };
        previousIcons.set(element, iconState);
      }
      if (icon && iconState && iconState.status !== status) {
        renderRoadmapStatusIcon(icon, status);
        iconState.status = status;
      }
    }
    for (const element of previousAttributes.keys()) {
      if (!current.has(element)) restoreStatus(element);
    }
    ensureLegend();
  };

  const restoreIcon = (element: HTMLElement, iconState: StatusIcon): void => {
    iconState.icon.replaceChildren(...iconState.children);
    if (iconState.viewBox === null) iconState.icon.removeAttribute('viewBox');
    else iconState.icon.setAttribute('viewBox', iconState.viewBox);
    if (previousIcons.get(element) === iconState) previousIcons.delete(element);
  };

  const containsRoadmapTarget = (node: Node): boolean => {
    if (node.nodeType !== browserWindow.Node.ELEMENT_NODE) return false;
    const element = node as Element;
    return element.matches(`${STATUS_SELECTOR}, ${RELEASE_NAME_SELECTOR}, article[class*="Board__Wrapper-"]`)
      || Boolean(element.querySelector(`${STATUS_SELECTOR}, ${RELEASE_NAME_SELECTOR}, article[class*="Board__Wrapper-"]`));
  };

  const isRelevantMutation = (record: MutationRecord): boolean => {
    const target = record.target.nodeType === browserWindow.Node.ELEMENT_NODE
      ? record.target as Element
      : record.target.parentElement;
    if (target?.closest(`${STATUS_SELECTOR}, ${RELEASE_NAME_SELECTOR}`)) return true;
    return [...record.addedNodes].some(containsRoadmapTarget);
  };

  const start = (): void => {
    if (observer) return;
    const nextObserver = new browserWindow.MutationObserver((records: MutationRecord[]) => {
      if (records.some(isRelevantMutation)) apply();
    });
    nextObserver.observe(doc.body ?? doc.documentElement, { childList: true, characterData: true, subtree: true });
    observer = nextObserver;
    active = true;
    apply();
  };

  const stop = (): void => {
    observer?.disconnect();
    observer = null;
    active = false;
    for (const element of previousAttributes.keys()) restoreStatus(element);
    for (const [element, previous] of previousReleaseNameAttributes) {
      if (previous === null) element.removeAttribute(RELEASE_NAME_ATTRIBUTE);
      else element.setAttribute(RELEASE_NAME_ATTRIBUTE, previous);
    }
    previousReleaseNameAttributes.clear();
    legend?.remove();
    legend = null;
  };

  return () => {
    if (!isEnabled()) {
      if (active) stop();
      return;
    }
    start();
    apply();
  };
}
