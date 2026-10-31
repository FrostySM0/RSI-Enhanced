import { conversationAuthor, conversationRoute, DEVTRACKER_REPLY_QUERY, loadReplyAndParent, replyText } from './spectrum-conversation.ts';

type SpectrumReply = Parameters<typeof replyText>[0];
export interface DevTrackerContextView {
  name: string;
  avatar: string;
  fallbackAvatar: string;
  text: string;
}

const PREVIEW_CHARACTER_LIMIT = 320;

function previewText(text: string): string | null {
  const characters = [...text];
  if (characters.length <= PREVIEW_CHARACTER_LIMIT) return null;
  const initial = characters.slice(0, PREVIEW_CHARACTER_LIMIT).join('');
  const lastSpace = initial.lastIndexOf(' ');
  const end = lastSpace >= PREVIEW_CHARACTER_LIMIT * 0.8 ? lastSpace : PREVIEW_CHARACTER_LIMIT;
  return `${characters.slice(0, end).join('').trimEnd()}…`;
}

function makeDisclosureButton(doc: Document, className: string, expand: () => void, collapse: () => void): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = `rsi-devtracker-expand ${className}`;
  button.textContent = 'Show more';
  button.setAttribute('aria-expanded', 'false');
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = button.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      collapse();
      button.textContent = 'Show more';
      button.setAttribute('aria-expanded', 'false');
    } else {
      expand();
      button.textContent = 'Show less';
      button.setAttribute('aria-expanded', 'true');
    }
  });
  return button;
}

export function devTrackerReplyRoute(href: string, base: string): { slug: string; replyId: string; threadPath: string } | null {
  try {
    const page = new URL(base);
    const target = new URL(href, page);
    if (target.origin !== page.origin) return null;
    const route = conversationRoute(target.pathname);
    return route ? { slug: route.slug, replyId: route.replyId, threadPath: route.threadPath } : null;
  } catch {
    return null;
  }
}

export function devTrackerReplyHref(href: string, base: string): string | null {
  try {
    const page = new URL(base);
    const target = new URL(href, page);
    if (!devTrackerReplyRoute(target.href, page.href)) return null;
    target.searchParams.set(DEVTRACKER_REPLY_QUERY, '1');
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export function devTrackerContextView(reply: SpectrumReply, base: string): DevTrackerContextView {
  const author = conversationAuthor(reply.member, base);
  return {
    name: author.name,
    avatar: author.avatar,
    fallbackAvatar: conversationAuthor(undefined, base).avatar,
    text: replyText(reply),
  };
}

interface TrackedCard {
  anchor: HTMLAnchorElement;
  originalHref: string | null;
  replyHref: string;
  route: { slug: string; replyId: string };
  panel: HTMLElement;
  details: HTMLElement;
  detailsParent: HTMLElement;
  detailsNextSibling: Node | null;
  detailsWasHidden: boolean | 'until-found';
}

function devTrackerPath(path: string): boolean {
  const normalized = path.replace(/^\/[a-z]{2}(?:-[a-z]{2})?(?=\/|$)/i, '').toLowerCase();
  return normalized === '/community/devtracker' || normalized === '/community/devtracker/';
}

function makeContextPanel(doc: Document, state: 'loading' | 'unavailable'): HTMLElement {
  const panel = doc.createElement('section');
  panel.className = 'rsi-devtracker-context';
  panel.dataset.state = state;
  panel.setAttribute('aria-label', 'Spectrum post and developer response');
  panel.setAttribute('aria-live', 'polite');
  const parent = doc.createElement('div');
  parent.className = 'rsi-devtracker-parent';
  const heading = doc.createElement('div');
  heading.className = 'rsi-devtracker-context-heading';
  const label = doc.createElement('span');
  label.className = 'rsi-devtracker-context-label';
  label.textContent = 'IN REPLY TO';
  heading.append(label);
  const status = doc.createElement('span');
  status.className = 'rsi-devtracker-context-status';
  status.textContent = state === 'loading' ? 'Loading Spectrum post…' : 'REPLY CONTEXT UNAVAILABLE';
  const message = doc.createElement('p');
  message.className = 'rsi-devtracker-context-text';
  message.textContent = state === 'loading' ? 'Retrieving the parent post and author.' : 'Open the Spectrum thread to view the conversation.';
  parent.append(heading, status, message);
  const divider = doc.createElement('div');
  divider.className = 'rsi-devtracker-context-divider';
  divider.setAttribute('aria-hidden', 'true');
  const response = doc.createElement('div');
  response.className = 'rsi-devtracker-response';
  const responseLabel = doc.createElement('div');
  responseLabel.className = 'rsi-devtracker-response-label';
  responseLabel.textContent = 'DEVELOPER RESPONSE';
  response.append(responseLabel);
  panel.append(parent, divider, response);
  return panel;
}

function renderDeveloperResponse(doc: Document, panel: HTMLElement, details: HTMLElement, responseText: string, detailsWasHidden: boolean | 'until-found'): void {
  const response = panel.querySelector<HTMLElement>('.rsi-devtracker-response');
  if (!response) return;
  const fullText = responseText.trim();
  const excerpt = details.textContent?.trim() || '';
  const preview = previewText(fullText);
  const normalizedFullText = fullText.replace(/\s+/g, ' ').trim();
  const normalizedExcerpt = excerpt.replace(/\s+/g, ' ').trim();
  const excerptIsEllipsized = /(?:…|\.{3})\s*$/.test(excerpt);
  const excerptPrefix = normalizedExcerpt.replace(/(?:…|\.{3})\s*$/, '').trim();
  const excerptHidesText = Boolean(excerptPrefix)
    && normalizedFullText.length > normalizedExcerpt.length
    && (excerptIsEllipsized || normalizedFullText.startsWith(excerptPrefix));
  if (!preview && !excerptHidesText) {
    details.hidden = detailsWasHidden;
    return;
  }

  const previewNode = doc.createElement('p');
  previewNode.className = 'rsi-devtracker-response-preview';
  previewNode.dir = 'auto';
  previewNode.textContent = excerptHidesText ? excerpt : (preview || fullText);
  const fullNode = doc.createElement('p');
  fullNode.className = 'rsi-devtracker-response-full';
  fullNode.dir = 'auto';
  fullNode.textContent = fullText;
  fullNode.hidden = true;
  details.hidden = true;
  response.insertBefore(previewNode, details);
  response.insertBefore(fullNode, details);
  const toggle = makeDisclosureButton(doc, 'rsi-devtracker-response-toggle',
    () => { previewNode.hidden = true; fullNode.hidden = false; },
    () => { fullNode.hidden = true; previewNode.hidden = false; });
  response.append(toggle);
}

function renderContextPanel(doc: Document, panel: HTMLElement, view: DevTrackerContextView, responseText: string, details: HTMLElement, detailsWasHidden: boolean | 'until-found'): void {
  const parent = panel.querySelector<HTMLElement>('.rsi-devtracker-parent');
  if (!parent) return;
  const heading = doc.createElement('div');
  heading.className = 'rsi-devtracker-context-heading';
  const label = doc.createElement('span');
  label.className = 'rsi-devtracker-context-label';
  label.textContent = 'IN REPLY TO';
  const avatar = doc.createElement('img');
  avatar.className = 'rsi-devtracker-context-avatar';
  avatar.alt = `${view.name}'s avatar`;
  avatar.loading = 'lazy';
  avatar.decoding = 'async';
  avatar.src = view.avatar;
  let fallbackTried = view.avatar === view.fallbackAvatar;
  avatar.addEventListener('error', () => {
    if (!fallbackTried) {
      fallbackTried = true;
      avatar.src = view.fallbackAvatar;
    } else {
      avatar.remove();
    }
  });
  const author = doc.createElement('span');
  author.className = 'rsi-devtracker-context-author';
  author.textContent = view.name;
  heading.append(label, avatar, author);
  const text = doc.createElement('p');
  text.className = 'rsi-devtracker-context-text';
  text.dir = 'auto';
  const preview = previewText(view.text);
  text.textContent = preview ?? view.text;
  parent.replaceChildren(heading, text);
  if (preview) {
    const toggle = makeDisclosureButton(doc, 'rsi-devtracker-context-toggle',
      () => { text.textContent = view.text; },
      () => { text.textContent = preview; });
    parent.append(toggle);
  }
  panel.dataset.state = 'ready';
  renderDeveloperResponse(doc, panel, details, responseText, detailsWasHidden);
}

export function installDevTrackerContext(
  enabled: () => boolean,
  win: Window = window,
  doc: Document = document,
): () => void {
  let currentPath = '';
  let feed: HTMLElement | null = null;
  let feedObserver: MutationObserver | null = null;
  let discoveryObserver: MutationObserver | null = null;
  let discoveryTimer: number | null = null;
  let titleLink: HTMLAnchorElement | null = null;
  let originalTitle: string | null = null;
  const tracked = new Map<HTMLAnchorElement, TrackedCard>();
  const queue: TrackedCard[] = [];
  const controllers = new Map<TrackedCard, AbortController>();
  const maxConcurrentReads = 2;

  const restoreTitle = () => {
    if (titleLink && originalTitle !== null) titleLink.textContent = originalTitle;
    titleLink = null;
    originalTitle = null;
  };

  const updateTitle = () => {
    const next = doc.querySelector<HTMLAnchorElement>('.glow-hub-title h1 a');
    if (!next) return;
    if (titleLink && titleLink !== next) restoreTitle();
    if (!titleLink) {
      titleLink = next;
      originalTitle = next.textContent || '';
    }
    if (next.textContent !== 'Star Citizen Dev Tracker') next.textContent = 'Star Citizen Dev Tracker';
  };

  const clearDiscovery = () => {
    discoveryObserver?.disconnect();
    discoveryObserver = null;
    if (discoveryTimer !== null) win.clearTimeout(discoveryTimer);
    discoveryTimer = null;
  };

  const clearFeed = () => {
    feedObserver?.disconnect();
    feedObserver = null;
    for (const controller of controllers.values()) controller.abort();
    controllers.clear();
    queue.length = 0;
    for (const [anchor, card] of tracked) {
      card.details.hidden = card.detailsWasHidden;
      const nextSibling = card.detailsNextSibling?.parentNode === card.detailsParent ? card.detailsNextSibling : null;
      card.detailsParent.insertBefore(card.details, nextSibling);
      if (anchor.getAttribute('href') === card.replyHref) {
        if (card.originalHref === null) anchor.removeAttribute('href');
        else anchor.setAttribute('href', card.originalHref);
      }
      card.panel.remove();
      delete anchor.dataset.rsiContextState;
    }
    tracked.clear();
    feed = null;
  };

  const stop = () => {
    clearDiscovery();
    clearFeed();
    restoreTitle();
    currentPath = '';
  };

  const setUnavailable = (card: TrackedCard) => {
    const parent = card.panel.querySelector<HTMLElement>('.rsi-devtracker-parent');
    if (parent) {
      const heading = doc.createElement('div');
      heading.className = 'rsi-devtracker-context-heading';
      const label = doc.createElement('span');
      label.className = 'rsi-devtracker-context-label';
      label.textContent = 'IN REPLY TO';
      const status = doc.createElement('span');
      status.className = 'rsi-devtracker-context-status';
      status.textContent = 'REPLY CONTEXT UNAVAILABLE';
      const message = doc.createElement('p');
      message.className = 'rsi-devtracker-context-text';
      message.textContent = 'Open the Spectrum thread to view the conversation.';
      heading.append(label);
      parent.replaceChildren(heading, status, message);
      card.panel.dataset.state = 'unavailable';
    }
    card.anchor.dataset.rsiContextState = 'unavailable';
  };

  const read = async (endpoint: string, body: Record<string, string>, signal: AbortSignal): Promise<unknown> => {
    const response = await win.fetch(`/api/spectrum${endpoint}`, {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body), signal,
    });
    if (!response.ok) throw new Error('Spectrum context unavailable');
    const payload = await response.json() as { success?: unknown; data?: unknown };
    if (payload.success !== 1 || !payload.data) throw new Error('Spectrum context unavailable');
    return payload.data;
  };

  const pump = () => {
    if (!enabled() || currentPath !== win.location.pathname) return;
    while (controllers.size < maxConcurrentReads && queue.length) {
      const card = queue.shift()!;
      if (tracked.get(card.anchor) !== card || !card.anchor.isConnected) continue;
      const controller = new AbortController();
      controllers.set(card, controller);
      let timedOut = false;
      const timeout = win.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 15000);
      void loadReplyAndParent(card.route.slug, card.route.replyId, (endpoint, body) => read(endpoint, body, controller.signal))
        .then(({ target, parent }) => {
          if (controller.signal.aborted || tracked.get(card.anchor) !== card) return;
          renderContextPanel(doc, card.panel, devTrackerContextView(parent, win.location.href), replyText(target), card.details, card.detailsWasHidden);
          card.anchor.dataset.rsiContextState = 'ready';
        })
        .catch(() => {
          if ((!controller.signal.aborted || timedOut) && tracked.get(card.anchor) === card) setUnavailable(card);
        })
        .finally(() => {
          win.clearTimeout(timeout);
          controllers.delete(card);
          pump();
        });
    }
  };

  const addCard = (anchor: HTMLAnchorElement) => {
    if (tracked.has(anchor)) return;
    const originalHref = anchor.getAttribute('href');
    const href = originalHref || anchor.href;
    const route = devTrackerReplyRoute(href, win.location.href);
    const replyHref = devTrackerReplyHref(href, win.location.href);
    if (!route || !replyHref) return;
    const wrapper = anchor.querySelector<HTMLElement>('.devpost-wrapper');
    const details = wrapper?.querySelector<HTMLElement>('.details');
    const detailsParent = details?.parentElement;
    if (!wrapper || !details || !detailsParent) return;
    anchor.setAttribute('href', replyHref);
    const panel = makeContextPanel(doc, 'loading');
    wrapper.insertBefore(panel, details);
    const response = panel.querySelector<HTMLElement>('.rsi-devtracker-response');
    if (!response) { panel.remove(); return; }
    const detailsWasHidden = details.hidden;
    const detailsNextSibling = details.nextSibling;
    response.append(details);
    const card = { anchor, originalHref, replyHref, route, panel, details, detailsParent, detailsNextSibling, detailsWasHidden };
    tracked.set(anchor, card);
    anchor.dataset.rsiContextState = 'loading';
    queue.push(card);
    pump();
  };

  const cardsWithin = (node: Node): HTMLAnchorElement[] => {
    if (node.nodeType !== 1) return [];
    const element = node as Element;
    const cards: HTMLAnchorElement[] = [];
    if (element.matches('a.devpost')) cards.push(element as HTMLAnchorElement);
    cards.push(...element.querySelectorAll<HTMLAnchorElement>('a.devpost'));
    return cards;
  };

  const attachFeed = (nextFeed: HTMLElement) => {
    if (feed === nextFeed && feedObserver) return;
    clearFeed();
    clearDiscovery();
    feed = nextFeed;
    const Observer = (win as Window & typeof globalThis).MutationObserver;
    const observer = new Observer(records => {
      if (!enabled() || currentPath !== win.location.pathname) { refresh(); return; }
      for (const record of records) for (const node of record.addedNodes) for (const card of cardsWithin(node)) addCard(card);
    });
    feedObserver = observer;
    observer.observe(feed, { childList: true, subtree: true });
    for (const card of feed.querySelectorAll<HTMLAnchorElement>('a.devpost')) addCard(card);
  };

  const waitForFeed = () => {
    if (discoveryObserver || !doc.body) return;
    const Observer = (win as Window & typeof globalThis).MutationObserver;
    const observer = new Observer(() => {
      if (!enabled() || currentPath !== win.location.pathname) { refresh(); return; }
      updateTitle();
      const found = doc.querySelector<HTMLElement>('.js-devtracker-list');
      if (found) attachFeed(found);
    });
    discoveryObserver = observer;
    observer.observe(doc.body, { childList: true, subtree: true });
    discoveryTimer = win.setTimeout(clearDiscovery, 15000);
  };

  const refresh = () => {
    if (!enabled() || !devTrackerPath(win.location.pathname)) { stop(); return; }
    if (doc.readyState === 'loading') return;
    if (currentPath !== win.location.pathname) {
      stop();
      currentPath = win.location.pathname;
    }
    updateTitle();
    const found = doc.querySelector<HTMLElement>('.js-devtracker-list');
    if (found) attachFeed(found);
    else waitForFeed();
  };

  return refresh;
}
