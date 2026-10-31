import {
  normalizeSavedThreads,
  normalizeThreadUrl,
  readSavedThreads,
  toggleSavedThread,
  setSavedThreadState,
} from '../shared/saved-threads.ts';
import type { SavedThread } from '../shared/saved-threads.ts';

const THREAD_ROW_SELECTOR = '#react .thread-list-screen .orion-tavern-c-ThreadListItem';
const SIDEBAR_BOOKMARK_SELECTOR = '#react a.orion-tavern-c-SidebarLeftBookmark';
const THREAD_BOOKMARK_SELECTOR = '#react .subject-actions button.reset.bookmark';
const THREAD_BOOKMARK_MATCH = 'button.reset.bookmark';
const THREAD_BOOKMARK_ATTRIBUTES = ['data-tip', 'title', 'aria-label', 'aria-pressed', 'data-rsi-saved-thread-state'] as const;

interface ThreadCandidate { url: string; title: string; }
interface RowControl extends ThreadCandidate { button: HTMLButtonElement; }
type SavedThreadsWindow = Pick<Window, 'location' | 'requestAnimationFrame' | 'setTimeout' | 'clearTimeout'> & { MutationObserver: typeof MutationObserver };
interface PendingNativeBookmarkRemoval { timer: number; thread: ThreadCandidate; sidebarWasPresent: boolean; }
const LEGACY_BOOKMARK_REMOVAL_TIMEOUT_MS = 1800;

export function installSpectrumSavedThreads(enabled: () => boolean, win: SavedThreadsWindow = window, doc: Document = document): () => void {
  let saved: SavedThread[] = [];
  let loaded = false, started = false, writing = false, storageError = false;
  let revision = 0, framePending = false;
  let observer: MutationObserver | null = null;
  let observedRoot: Element | null = null;
  let sidebarHost: Element | null = null;
  let sidebarSection: HTMLElement | null = null;
  let sidebarSignature = '';
  const controls = new Map<HTMLAnchorElement, RowControl>();
  const nativeBookmarkOriginals = new Map<HTMLElement, Map<string, string | null>>();
  let nativeButtonObserver: MutationObserver | null = null;
  let nativeObservedButton: HTMLElement | null = null;
  let nativeBookmarkStates = new WeakMap<HTMLElement, boolean>();
  const pendingNativeBookmarkRemovals = new Map<HTMLElement, PendingNativeBookmarkRemoval>();
  const queuedNativeToggles: ThreadCandidate[] = [];
  const queuedLegacyBookmarkRemovals: ThreadCandidate[] = [];
  let drainingNativeToggles = false;

  const currentThread = (): ThreadCandidate | null => {
    const url = normalizeThreadUrl(win.location.href, win.location.href);
    if (!url) return null;
    const heading = doc.querySelector<HTMLElement>('#react #page.forum-thread .forum-thread-subject');
    const titleCopy = heading?.cloneNode(true) as HTMLElement | undefined;
    if (titleCopy) {
      // Read only the heading itself. Spectrum can append interactive bookmark and
      // notification controls (including their menu copy) inside the subject node.
      for (const child of [...titleCopy.querySelectorAll('*')]) {
        const className = typeof child.className === 'string' ? child.className : '';
        const role = child.getAttribute('role') ?? '';
        const hasControlLabel = ['aria-label', 'title', 'data-tip'].some(name => child.hasAttribute(name));
        if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(child.tagName)
          || /^(button|menuitem|menu|switch|checkbox)$/.test(role)
          || hasControlLabel
          || /notification|subscription|subject-actions?|bookmark-control/i.test(className)) child.remove();
      }
    }
    const fromHeading = (titleCopy?.textContent || heading?.innerText || heading?.textContent)?.replace(/\s+/g, ' ').trim();
    const slug = url.match(/\/thread\/([^/]+)/i)?.[1] ?? '';
    let fallback = slug;
    try { fallback = decodeURIComponent(slug); } catch { /* retain the URL-safe slug */ }
    const title = (fromHeading || fallback.replace(/[-_]+/g, ' ')).trim().slice(0, 240);
    return title ? { url, title } : null;
  };

  const restoreNativeBookmark = (button: HTMLElement, attributes: Map<string, string | null>) => {
    for (const [name, value] of attributes) {
      if (value === null) button.removeAttribute(name);
      else button.setAttribute(name, value);
    }
  };

  const hasNativeThreadBookmark = (thread: ThreadCandidate): boolean =>
    [...doc.querySelectorAll<HTMLAnchorElement>(SIDEBAR_BOOKMARK_SELECTOR)].some(bookmark =>
      normalizeThreadUrl(bookmark.href || bookmark.getAttribute('href'), win.location.href) === thread.url);

  const readNativeBookmarkAttributeState = (button: HTMLElement): boolean | null => {
    const tip = button.getAttribute('data-tip') ?? '';
    if (/remove\s+(?:from\s+)?bookmarks?|unbookmark/i.test(tip)) return true;
    if (/add\s+(?:to\s+)?bookmarks?|save\s+(?:to\s+)?bookmarks?/i.test(tip)) return false;
    const pressed = button.getAttribute('aria-pressed');
    if (pressed === 'false') return false;
    if (pressed === 'true') return true;
    const labels = ['title', 'aria-label'].map(name => button.getAttribute(name) ?? '').join(' ');
    if (/remove\s+(?:from\s+)?bookmarks?|unbookmark/i.test(labels)) return true;
    if (/add\s+(?:to\s+)?bookmarks?|save\s+(?:to\s+)?bookmarks?/i.test(labels)) return false;
    return null;
  };

  const confirmNativeBookmarkRemoved = (button: HTMLElement) => {
    const pending = pendingNativeBookmarkRemovals.get(button);
    if (pending) win.clearTimeout(pending.timer);
    pendingNativeBookmarkRemovals.delete(button);
    nativeBookmarkStates.set(button, false);
    markNativeBookmarkConfirmedRemoved(button);
  };

  const isNativeBookmarkActive = (button: HTMLElement, thread: ThreadCandidate): boolean => {
    const listedInSidebar = hasNativeThreadBookmark(thread);
    const pending = pendingNativeBookmarkRemovals.get(button);
    if (pending) {
      const buttonState = readNativeBookmarkAttributeState(button);
      if (buttonState === false || (pending.sidebarWasPresent && !listedInSidebar)) {
        confirmNativeBookmarkRemoved(button);
        return false;
      }
      return true;
    }
    if (listedInSidebar) {
      nativeBookmarkStates.set(button, true);
      return true;
    }
    if (nativeBookmarkStates.has(button)) {
      const knownState = nativeBookmarkStates.get(button)!;
      if (knownState && readNativeBookmarkAttributeState(button) === false) {
        confirmNativeBookmarkRemoved(button);
        return false;
      }
      return knownState;
    }

    const original = nativeBookmarkOriginals.get(button);
    const nativeLabel = ['data-tip', 'title', 'aria-label']
      .map(name => original?.get(name) ?? button.getAttribute(name) ?? '')
      .join(' ');
    const nativePressed = original?.get('aria-pressed') ?? button.getAttribute('aria-pressed');
    const active = nativePressed === 'true' || /remove\s+(?:from\s+)?bookmarks?|unbookmark/i.test(nativeLabel);
    nativeBookmarkStates.set(button, active);
    return active;
  };

  const markNativeBookmarkRemoved = (button: HTMLElement, thread: ThreadCandidate) => {
    nativeBookmarkStates.set(button, true);
    const pending: PendingNativeBookmarkRemoval = { timer: 0, thread, sidebarWasPresent: hasNativeThreadBookmark(thread) };
    const original = nativeBookmarkOriginals.get(button);
    if (original) restoreNativeBookmark(button, original);
    // Keep the live button in a known native-active state while Spectrum handles
    // the click, without changing the exact attributes saved for later restoration.
    for (const name of ['data-tip', 'title', 'aria-label']) button.setAttribute(name, 'Remove from bookmarks');
    button.setAttribute('aria-pressed', 'true');
    pending.timer = win.setTimeout(() => {
      if (pendingNativeBookmarkRemovals.get(button) !== pending) return;
      pendingNativeBookmarkRemovals.delete(button);
      const removed = readNativeBookmarkAttributeState(button) === false
        || (pending.sidebarWasPresent && !hasNativeThreadBookmark(pending.thread));
      nativeBookmarkStates.set(button, !removed);
      if (removed) markNativeBookmarkConfirmedRemoved(button);
      scheduleRender();
    }, LEGACY_BOOKMARK_REMOVAL_TIMEOUT_MS);
    pendingNativeBookmarkRemovals.set(button, pending);
  };

  const markNativeBookmarkConfirmedRemoved = (button: HTMLElement) => {
    const original = nativeBookmarkOriginals.get(button);
    if (!original) return;
    for (const name of ['data-tip', 'title', 'aria-label']) {
      const value = original.get(name);
      if (value && /remove\s+(?:from\s+)?bookmarks?|unbookmark/i.test(value)) {
        original.set(name, value.replace(/remove\s+from/i, 'Add to').replace(/unbookmark/i, 'Add to bookmarks').replace(/remove/i, 'Add'));
      }
    }
    if (original.get('aria-pressed') !== null) original.set('aria-pressed', 'false');
  };

  const removeSavedThread = async (thread: ThreadCandidate): Promise<void> => {
    if (writing || !saved.some(item => item.url === thread.url)) return;
    const previous = saved;
    saved = saved.filter(item => item.url !== thread.url);
    await persist(thread, false, previous);
  };

  const renderNativeBookmark = () => {
    const thread = currentThread();
    const buttons = thread ? [...doc.querySelectorAll<HTMLElement>(THREAD_BOOKMARK_SELECTOR)] : [];
    const observedButton = buttons[0] ?? null;
    if (observedButton !== nativeObservedButton) {
      nativeButtonObserver?.disconnect();
      nativeButtonObserver = null;
      nativeObservedButton = observedButton;
      if (observedButton) {
        nativeButtonObserver = new win.MutationObserver(() => {
          if (nativeBookmarkStates.get(observedButton) !== true) return;
          if (readNativeBookmarkAttributeState(observedButton) !== false) return;
          confirmNativeBookmarkRemoved(observedButton);
          scheduleRender();
        });
        nativeButtonObserver.observe(observedButton, { attributes: true, attributeFilter: ['data-tip', 'title', 'aria-label', 'aria-pressed'] });
      }
    }
    const active = new Set(buttons);
    for (const [button, originals] of nativeBookmarkOriginals) if (!active.has(button)) {
      restoreNativeBookmark(button, originals);
      nativeBookmarkOriginals.delete(button);
      nativeBookmarkStates.delete(button);
      const pending = pendingNativeBookmarkRemovals.get(button);
      if (pending) win.clearTimeout(pending.timer);
      pendingNativeBookmarkRemovals.delete(button);
    }
    if (!thread) return;
    for (const button of buttons) {
      if (!nativeBookmarkOriginals.has(button)) {
        nativeBookmarkOriginals.set(button, new Map(THREAD_BOOKMARK_ATTRIBUTES.map(name => [name, button.getAttribute(name)])));
      }
      if (pendingNativeBookmarkRemovals.has(button)) continue;
      const extensionSaved = saved.some(item => item.url === thread.url);
      const nativeSaved = isNativeBookmarkActive(button, thread);
      const isSaved = extensionSaved || nativeSaved;
      const action = nativeSaved && !extensionSaved ? 'Remove existing Spectrum bookmark' : `${isSaved ? 'Remove from' : 'Save to'} Saved Threads`;
      button.setAttribute('data-tip', action);
      button.setAttribute('title', `${action}${storageError ? ' · Could not save changes' : ''}`);
      button.setAttribute('aria-label', `${action}: ${thread.title}`);
      button.setAttribute('aria-pressed', String(isSaved));
      button.setAttribute('data-rsi-saved-thread-state', isSaved ? 'saved' : 'unsaved');
    }
  };

  const toggleNativeThread = async (thread: ThreadCandidate): Promise<void> => {
    if (writing || !enabled()) return;
    const shouldSave = !saved.some(item => item.url === thread.url);
    const previous = saved;
    saved = toggleSavedThread(saved, thread, win.location.href);
    storageError = false;
    await persist(thread, shouldSave, previous);
  };

  const drainNativeToggles = async () => {
    if (drainingNativeToggles || !loaded) return;
    drainingNativeToggles = true;
    try {
      while ((queuedNativeToggles.length || queuedLegacyBookmarkRemovals.length) && enabled()) {
        if (queuedLegacyBookmarkRemovals.length) {
          const thread = queuedLegacyBookmarkRemovals.shift()!;
          await removeSavedThread(thread);
        } else {
          const thread = queuedNativeToggles.shift()!;
          await toggleNativeThread(thread);
        }
      }
      if (!enabled()) {
        queuedNativeToggles.length = 0;
        queuedLegacyBookmarkRemovals.length = 0;
      }
    } finally {
      drainingNativeToggles = false;
    }
  };

  const captureNativeThreadBookmark = (event: MouseEvent) => {
    if (!enabled()) return;
    const target = event.target as (Element & { closest?: (selector: string) => Element | null }) | null;
    const button = target?.closest?.(THREAD_BOOKMARK_MATCH) as HTMLElement | null;
    const react = doc.querySelector('#react');
    if (!button || !button.closest('.subject-actions') || !react?.contains(button)) return;
    const thread = currentThread();
    if (!thread) return;
    if (pendingNativeBookmarkRemovals.has(button)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (writing) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    // Users may have native thread bookmarks left by earlier extension versions.
    // Let Spectrum remove those stale entries instead of turning the same click into
    // a second, local Saved Threads entry. If both stores contain it, clear both.
    const nativeSaved = isNativeBookmarkActive(button, thread);
    if (nativeSaved) {
      markNativeBookmarkRemoved(button, thread);
      if (!loaded) queuedLegacyBookmarkRemovals.push(thread);
      else if (saved.some(item => item.url === thread.url)) void removeSavedThread(thread);
      return;
    }

    // Spectrum's React click handler is delegated above this button. Capture and stop it
    // before it can add the thread to Spectrum's separate Bookmarks list.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!loaded) {
      queuedNativeToggles.push(thread);
      return;
    }
    void toggleNativeThread(thread);
  };

  const setButtonState = (button: HTMLButtonElement, thread: Pick<RowControl, 'url' | 'title'>) => {
    const isSaved = saved.some(item => item.url === thread.url);
    button.textContent = isSaved ? '★' : '☆';
    button.setAttribute('aria-pressed', String(isSaved));
    button.setAttribute('aria-label', `${isSaved ? 'Remove' : 'Save'} thread: ${thread.title}`);
    button.title = `${isSaved ? 'Remove from' : 'Save to'} Saved Threads${storageError ? ' · Could not save changes' : ''}`;
    button.disabled = writing;
  };

  const clearUi = () => {
    for (const { button } of controls.values()) button.remove();
    controls.clear();
    queuedNativeToggles.length = 0;
    queuedLegacyBookmarkRemovals.length = 0;
    for (const [button, pending] of pendingNativeBookmarkRemovals) {
      win.clearTimeout(pending.timer);
      const removed = readNativeBookmarkAttributeState(button) === false
        || (pending.sidebarWasPresent && !hasNativeThreadBookmark(pending.thread));
      if (removed) markNativeBookmarkConfirmedRemoved(button);
    }
    nativeButtonObserver?.disconnect(); nativeButtonObserver = null; nativeObservedButton = null;
    for (const [button, originals] of nativeBookmarkOriginals) restoreNativeBookmark(button, originals);
    nativeBookmarkOriginals.clear();
    nativeBookmarkStates = new WeakMap();
    pendingNativeBookmarkRemovals.clear();
    sidebarSection?.remove(); sidebarSection = null; sidebarHost = null; sidebarSignature = '';
  };

  const renderRows = () => {
    const activeLinks = new Set<HTMLAnchorElement>();
    for (const row of doc.querySelectorAll<HTMLElement>(THREAD_ROW_SELECTOR)) {
      const link = row.querySelector<HTMLAnchorElement>('a.title__link');
      if (!link) continue;
      const url = normalizeThreadUrl(link.href || link.getAttribute('href'), win.location.href);
      const title = link.textContent?.replace(/\s+/g, ' ').trim().slice(0, 240) || '';
      if (!url || !title) continue;
      activeLinks.add(link);
      let record = controls.get(link);
      if (!record || record.button.parentElement !== link.parentElement) {
        record?.button.remove();
        const button = doc.createElement('button');
        button.type = 'button'; button.className = 'rsi-saved-thread-toggle';
        const nextRecord = { button, url, title };
        button.addEventListener('click', event => {
          event.preventDefault(); event.stopPropagation();
          if (writing) return;
          const shouldSave = !saved.some(item => item.url === nextRecord.url);
          const previous = saved;
          saved = toggleSavedThread(saved, { url: nextRecord.url, title: nextRecord.title }, win.location.href);
          storageError = false;
          persist(nextRecord, shouldSave, previous);
        });
        link.after(button);
        record = nextRecord;
        controls.set(link, nextRecord);
      }
      record.url = url; record.title = title;
      setButtonState(record.button, record);
    }
    for (const [link, record] of controls) if (!activeLinks.has(link)) {
      record.button.remove(); controls.delete(link);
    }
  };

  const findSidebarHost = (): Element | null => {
    const bookmarks = [...doc.querySelectorAll<HTMLAnchorElement>(SIDEBAR_BOOKMARK_SELECTOR)];
    const react = doc.querySelector('#react');
    const last = bookmarks.at(-1);
    let ancestor = last?.parentElement ?? null;
    while (ancestor && ancestor !== react) {
      if (bookmarks.every(bookmark => ancestor!.contains(bookmark))) return ancestor;
      ancestor = ancestor.parentElement;
    }
    // A saved thread should remain discoverable even before the user has native bookmarks.
    // The supplied sidebar markup identifies the Bookmarks heading, but its wrapper has not
    // been inspected live, so use its parent container as the conservative fallback anchor.
    const heading = [...(react?.querySelectorAll('*') ?? [])].find(element =>
      element.children.length === 0 && element.textContent?.trim().toLowerCase() === 'bookmarks');
    return heading?.parentElement?.parentElement ?? heading?.parentElement ?? null;
  };

  const renderSidebar = () => {
    const host = findSidebarHost();
    if (!host || saved.length === 0) {
      sidebarSection?.remove(); sidebarSection = null; sidebarHost = null; sidebarSignature = '';
      return;
    }
    if (sidebarSection && (sidebarHost !== host || !sidebarSection.parentElement)) {
      sidebarSection.remove(); sidebarSection = null; sidebarSignature = '';
    }
    if (!sidebarSection) {
      sidebarSection = doc.createElement(host.tagName === 'UL' || host.tagName === 'OL' ? 'li' : 'div');
      sidebarSection.className = 'rsi-saved-threads';
      sidebarHost = host;
      if (host.tagName === 'UL' || host.tagName === 'OL') {
        const lastBookmark = [...doc.querySelectorAll<HTMLAnchorElement>(SIDEBAR_BOOKMARK_SELECTOR)].at(-1);
        const lastRow = lastBookmark?.closest('li');
        if (lastRow?.parentElement === host) lastRow.after(sidebarSection);
        else host.append(sidebarSection);
      } else host.after(sidebarSection);
    }
    const currentUrl = normalizeThreadUrl(win.location.href, win.location.href);
    const signature = JSON.stringify([currentUrl, writing, saved.map(item => [item.url, item.title])]);
    if (sidebarSignature === signature) return;
    sidebarSection.replaceChildren();
    const heading = doc.createElement('div'); heading.className = 'rsi-saved-threads__heading'; heading.textContent = 'Saved Threads';
    const links = doc.createElement('div'); links.className = 'rsi-saved-threads__list';
    for (const item of saved) {
      const safeUrl = normalizeThreadUrl(item.url, win.location.href);
      if (!safeUrl) continue;
      const entry = doc.createElement('div');
      entry.className = 'rsi-saved-threads__item';
      const link = doc.createElement('a');
      link.className = 'rsi-saved-threads__link';
      link.href = new URL(safeUrl, win.location.href).href;
      link.textContent = item.title;
      link.title = item.title;
      if (safeUrl === currentUrl) link.classList.add('rsi-saved-threads__link--active');
      const remove = doc.createElement('button');
      remove.type = 'button';
      remove.className = 'rsi-saved-threads__remove';
      remove.textContent = '★';
      remove.setAttribute('aria-label', `Remove saved thread: ${item.title}`);
      remove.title = 'Remove from Saved Threads';
      remove.disabled = writing;
      remove.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        if (writing) return;
        const previous = saved;
        saved = toggleSavedThread(saved, item, win.location.href);
        storageError = false;
        persist(item, false, previous);
      });
      entry.append(link, remove);
      links.append(entry);
    }
    sidebarSection.append(heading, links);
    sidebarSignature = signature;
  };

  const isOwnedNode = (node: Node): boolean => {
    const element = node.nodeType === 1 ? node as Element : node.parentElement;
    return Boolean(element?.closest('.rsi-saved-threads, .rsi-saved-thread-toggle'));
  };
  const isRelevantNode = (node: Node): boolean => {
    const element = node.nodeType === 1 ? node as Element : node.parentElement;
    if (!element) return false;
    const selector = '.thread-list-screen, .thread-list-screen__thread-list, .orion-tavern-c-ThreadListItem, .subject-actions, .orion-tavern-c-SidebarLeftBookmark';
    return Boolean(element.closest(selector) || element.querySelector(selector));
  };

  async function persist(candidate: Pick<SavedThread, 'url' | 'title'>, shouldSave: boolean, previous: SavedThread[]): Promise<void> {
    writing = true;
    render();
    try {
      saved = await setSavedThreadState(candidate, shouldSave, win.location.href);
      storageError = false;
    } catch {
      try { saved = await readSavedThreads(win.location.href); }
      catch { saved = previous; }
      storageError = true;
    } finally {
      writing = false;
      render();
    }
  }

  const render = () => {
    if (!enabled()) {
      observer?.disconnect(); observer = null; observedRoot = null;
      clearUi();
      return;
    }
    if (!started) {
      started = true;
      doc.addEventListener('click', captureNativeThreadBookmark, true);
      chrome.storage.onChanged.addListener((changes, area) => {
        const change = changes['rsiEnhanced.savedThreads'];
        if (area !== 'local' || !change) return;
        revision++;
        saved = normalizeSavedThreads(change.newValue, win.location.href);
        loaded = true;
        render();
        void drainNativeToggles();
      });
      const readRevision = revision;
      void readSavedThreads(win.location.href).then(items => {
        if (revision === readRevision) saved = items;
        loaded = true;
        render();
        void drainNativeToggles();
      }).catch(() => { loaded = true; storageError = true; render(); void drainNativeToggles(); });
      doc.addEventListener('DOMContentLoaded', scheduleRender, { once: true });
    }
    const root = doc.querySelector('#react') || doc.documentElement;
    if (root && root !== observedRoot) {
      observer?.disconnect();
      const nextObserver = new win.MutationObserver(records => {
        const relevant = records.some(record => {
          const nodes = [...record.addedNodes, ...record.removedNodes];
          return nodes.length === 0 ? isRelevantNode(record.target)
            : nodes.some(node => !isOwnedNode(node) && isRelevantNode(node));
        });
        if (relevant) scheduleRender();
      });
      nextObserver.observe(root, { childList: true, subtree: true });
      observer = nextObserver;
      observedRoot = root;
    }
    if (!loaded || doc.readyState === 'loading') return;
    renderRows();
    renderSidebar();
    renderNativeBookmark();
  };

  function scheduleRender(): void {
    if (framePending) return;
    framePending = true;
    win.requestAnimationFrame(() => { framePending = false; render(); });
  }

  render();
  return render;
}
