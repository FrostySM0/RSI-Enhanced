export interface RoadmapCardMetadata {
  modified: string | null;
  slug: string | null;
}

const CARD_SELECTOR = 'a[class*="Card__StyledNavLink-"][href]';
const MODAL_SELECTOR = '[class*="Modal__ModalInner-"]';
const SIDEBAR_SELECTOR = '[class*="ModalLayout__ModalSidebar-"]';
const UPDATED_DATE_SELECTOR = 'time, [class*="Date" i], [class*="Updated" i]';
const METADATA_CLASS = 'rsi-roadmap-card-metadata';

const textOf = (element: Element | null | undefined): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

export function roadmapCardMetadata(href: string, updatedLabelText: string, base: string): RoadmapCardMetadata {
  let slug: string | null = null;
  try {
    const baseUrl = new URL(base);
    const cardUrl = new URL(href, baseUrl);
    if (cardUrl.origin === baseUrl.origin) {
      const match = cardUrl.pathname.match(/\/roadmap\/release-view\/([^/]+)\/?$/i);
      if (match) slug = decodeURIComponent(match[1]);
    }
  } catch {
    // Invalid or malformed links do not have a displayable Roadmap slug.
  }

  const month = 'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';
  const date = updatedLabelText.match(new RegExp(`^Updated\\s*:?[ \\t]+((?:${month})\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+\\d{4})\\s*$`, 'i'))?.[1] ?? null;
  return { modified: date, slug };
}

export function roadmapCardHrefForModal(
  clickedHref: string | null,
  clickedTitle: string | null,
  modalTitle: string,
  currentHref: string,
): string {
  return clickedHref && clickedTitle && modalTitle && clickedTitle === modalTitle ? clickedHref : currentHref;
}

export function shouldClearRoadmapCardIdentity(
  previousModal: Element | null,
  modal: Element | null,
  previousHref: string,
  currentHref: string,
  hasFreshCardClick: boolean,
): boolean {
  return previousModal !== null
    && !hasFreshCardClick
    && (modal !== previousModal || currentHref !== previousHref);
}

export function roadmapUpdatedLabelText(modal: Element): string {
  for (const element of modal.querySelectorAll<HTMLElement>(UPDATED_DATE_SELECTOR)) {
    const value = textOf(element);
    if (/^Updated\b/i.test(value)) return value;
  }
  return '';
}

type RoadmapMetadataMutation = Pick<MutationRecord, 'target' | 'addedNodes' | 'removedNodes'>;

function nodeIsModal(node: Node): boolean {
  if (node.nodeType !== 1) return false;
  const element = node as Element;
  return element.matches(MODAL_SELECTOR) || Boolean(element.querySelector(MODAL_SELECTOR));
}

function nodeIsInsideModal(node: Node): boolean {
  const element = node.nodeType === 1 ? node as Element : (node as CharacterData).parentElement;
  return Boolean(element?.closest(MODAL_SELECTOR));
}

export function roadmapMetadataMutationIsRelevant(
  records: readonly RoadmapMetadataMutation[],
  metadataElement: Element | null = null,
): boolean {
  return records.some(record => {
    const addedNodes = [...record.addedNodes];
    const removedNodes = [...record.removedNodes];
    const metadata = metadataElement;
    const ownInsertion = metadata !== null
      && addedNodes.length > 0
      && removedNodes.length === 0
      && addedNodes.every(node => node === metadata || metadata.contains(node));
    if (metadata && (metadata.contains(record.target) || ownInsertion)) return false;

    if (nodeIsInsideModal(record.target)) return true;
    return [...addedNodes, ...removedNodes].some(nodeIsModal);
  });
}

function eventElement(target: EventTarget | null): Element | null {
  return target && typeof (target as Element).closest === 'function' ? target as Element : null;
}

function cardTitle(anchor: HTMLAnchorElement): string {
  return textOf(anchor.querySelector('[class*="Card__TitleBar-"] h1, [class*="Card__TitleBar-"] h2, [class*="Card__TitleBar-"] h3'))
    || textOf(anchor.querySelector('h1, h2, h3'));
}

export function installRoadmapCardMetadata(
  enabled: () => boolean,
  win: Window = window,
  doc: Document = document,
): () => void {
  const browserWindow = win as Window & typeof globalThis;
  let observer: MutationObserver | null = null;
  let active = false;
  let clickedCard: HTMLAnchorElement | null = null;
  let cardClickGeneration = 0;
  let observedCardClickGeneration = 0;
  let lastObservedModal: Element | null = null;
  let lastObservedHref = win.location.href;
  let metadataElement: HTMLElement | null = null;
  let metadataModal: Element | null = null;
  let metadataSignature = '';

  const removeMetadata = (): void => {
    metadataElement?.remove();
    metadataElement = null;
    metadataModal = null;
    metadataSignature = '';
  };

  const modalTitle = (modal: Element): string => textOf(modal.querySelector('[class*="Card__TitleBar-"] h1, [class*="Card__TitleBar-"] h2, [class*="Card__TitleBar-"] h3'))
    || textOf(modal.querySelector('[class*="ModalHeader-"] h1, [class*="ModalHeader-"] h2, [class*="ModalHeader-"] h3'));

  const createMetadataElement = (): HTMLElement => {
    const section = doc.createElement('section');
    section.className = METADATA_CLASS;
    section.setAttribute('aria-label', 'Roadmap card information');
    return section;
  };

  const render = (modal: Element, sidebar: HTMLElement, values: RoadmapCardMetadata): void => {
    if (!values.modified && !values.slug) {
      removeMetadata();
      return;
    }

    const signature = JSON.stringify(values);
    if (metadataElement?.parentElement === sidebar && metadataModal === modal && metadataSignature === signature) return;
    removeMetadata();

    const section = createMetadataElement();
    const heading = doc.createElement('h3');
    heading.className = 'rsi-roadmap-card-metadata-heading';
    heading.textContent = 'Card information';
    const list = doc.createElement('dl');
    list.className = 'rsi-roadmap-card-metadata-list';

    for (const [label, value, className] of [
      ['Modified', values.modified, 'rsi-roadmap-card-metadata-value'],
      ['Slug', values.slug, 'rsi-roadmap-card-metadata-value rsi-roadmap-card-metadata-value--slug'],
    ] as const) {
      if (!value) continue;
      const row = doc.createElement('div');
      row.className = 'rsi-roadmap-card-metadata-row';
      const term = doc.createElement('dt');
      term.textContent = label;
      const description = doc.createElement('dd');
      description.className = className;
      description.textContent = value;
      row.append(term, description);
      list.append(row);
    }

    section.append(heading, list);
    sidebar.append(section);
    metadataElement = section;
    metadataModal = modal;
    metadataSignature = signature;
  };

  const apply = (): void => {
    if (!enabled()) return;
    const modal = doc.querySelector(MODAL_SELECTOR);
    const sidebar = modal?.querySelector<HTMLElement>(SIDEBAR_SELECTOR) ?? null;
    const currentHref = win.location.href;
    const title = modal ? modalTitle(modal) : '';
    const clickedCardMatches = Boolean(clickedCard?.isConnected && title && cardTitle(clickedCard) === title);
    const hasFreshCardClick = cardClickGeneration !== observedCardClickGeneration;
    if (shouldClearRoadmapCardIdentity(lastObservedModal, modal ?? null, lastObservedHref, currentHref, hasFreshCardClick)) {
      clickedCard = null;
    }
    lastObservedModal = modal ?? null;
    lastObservedHref = currentHref;
    if (!hasFreshCardClick || clickedCardMatches || !clickedCard?.isConnected) {
      observedCardClickGeneration = cardClickGeneration;
    }
    if (!modal || !modal.querySelector('[class*="StatusBar-"]') || !sidebar) {
      removeMetadata();
      return;
    }

    const clickedHref = clickedCard?.isConnected ? clickedCard.href : null;
    const clickedTitle = clickedCard?.isConnected ? cardTitle(clickedCard) : null;
    const href = roadmapCardHrefForModal(clickedHref, clickedTitle, title, win.location.href);
    const values = roadmapCardMetadata(href, roadmapUpdatedLabelText(modal), win.location.href);
    render(modal, sidebar, values);
  };

  const onCardClick = (event: Event): void => {
    if (!enabled()) return;
    const target = eventElement(event.target);
    if (!target || target.closest('figure[media]')) return;
    const anchor = target.closest<HTMLAnchorElement>(CARD_SELECTOR);
    if (anchor) {
      clickedCard = anchor;
      cardClickGeneration += 1;
      win.requestAnimationFrame(() => apply());
    }
  };

  const start = (): void => {
    if (observer) return;
    const nextObserver = new browserWindow.MutationObserver(records => {
      if (roadmapMetadataMutationIsRelevant(records, metadataElement)) apply();
    });
    nextObserver.observe(doc.body ?? doc.documentElement, { childList: true, characterData: true, subtree: true });
    observer = nextObserver;
    win.addEventListener('click', onCardClick, true);
    active = true;
    apply();
  };

  const stop = (): void => {
    observer?.disconnect();
    observer = null;
    win.removeEventListener('click', onCardClick, true);
    removeMetadata();
    clickedCard = null;
    cardClickGeneration = 0;
    observedCardClickGeneration = 0;
    lastObservedModal = null;
    lastObservedHref = win.location.href;
    active = false;
  };

  return () => {
    if (!enabled()) {
      if (active) stop();
      return;
    }
    start();
    apply();
  };
}
