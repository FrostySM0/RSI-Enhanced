import { sourceImageUrl } from './hangar-image.ts';
import { HANGAR_FILTER_CHANGE_EVENT, HANGAR_SHIP_PAINT_SESSION_KEY, SHIP_PAINT_FILTER_VALUE } from './hangar-controls.ts';
import { HANGAR_INDEX_STATUS_EVENT, HANGAR_PAGE_SIZE_CHANGE_EVENT, HANGAR_SORT_CHANGE_EVENT, normalizeHangarPageSize, normalizeHangarSort, type HangarPageSize, type HangarSort } from './hangar-view.ts';
import {
  createHangarCache, filterHangarRecords, formatPledgeValue, hangarCsv, hangarTransferShips,
  normalizeHangarPledge, readHangarCache, readHangarPledgeRow,
  type HangarFilters, type HangarPledgeRecord, type HangarStatusFilter,
} from './hangar-data.ts';

export const HANGAR_INDEX_STORAGE_KEY = 'rsiEnhanced.hangarIndex';

export function hangarPage(value: string, base: string): string | null {
  try {
    const url = new URL(value, base), current = new URL(base);
    const hangarRoute = (pathname: string) => pathname.match(/^\/(?:([a-z]{2}(?:-[a-z]{2,4})?)\/)?account\/pledges\/?$/i);
    const targetRoute = hangarRoute(url.pathname), currentRoute = hangarRoute(current.pathname);
    // RSI's pager drops the locale prefix (e.g. /account/pledges?page=2)
    // even when the visible page is localized (/en/account/pledges). Treat
    // those as the same verified route, then keep requests on the current locale.
    if (url.origin !== current.origin || url.username || url.password || !targetRoute || !currentRoute
      || (targetRoute[1] && currentRoute[1] && targetRoute[1].toLowerCase() !== currentRoute[1].toLowerCase())) return null;
    url.pathname = current.pathname;
    // Only follow pagination, never filters or pledge action URLs.
    if ([...url.searchParams.keys()].some(key => key !== 'page')) return null;
    const page = url.searchParams.get('page');
    if (page !== null && !/^[1-9]\d*$/.test(page)) return null;
    url.hash = '';
    return url.href;
  } catch { return null; }
}

export function matchesHangarSearch(text: string, query: string): boolean {
  const normalized = text.normalize('NFKC').toLowerCase();
  const words = query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
  return words.length > 0 && words.every(word => normalized.includes(word));
}

export function isShipPaintTitle(title: string): boolean {
  return /\bpaints?\b/i.test(title);
}

export function isShipPaintCard(title: string, details: string): boolean {
  return isShipPaintTitle(title) || isShipPaintTitle(details);
}

export function hangarResultHref(page: string, id: string): string {
  const safePage = hangarPage(page, page);
  if (!safePage || !/^\d+$/.test(id)) return '';
  return `${safePage}#rsi-pledge-${id}`;
}

function canonicalPage(value: string, base: string): string | null {
  const safe = hangarPage(value, base);
  if (!safe) return null;
  const url = new URL(safe);
  if (url.searchParams.get('page') === '1') url.searchParams.delete('page');
  return url.href;
}

interface Entry { id: string; title: string; details: string; image: string | null; page: string; card: HTMLElement | null; record: HangarPledgeRecord; }

export function hangarIndexFingerprint(records: HangarPledgeRecord[], pageCount: number): string {
  const source = `${pageCount}|${records.map(record => `${record.id}:${record.basePledge || record.title}:${record.valueText || ''}:${record.created}`).sort().join('|')}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return `${pageCount}:${(hash >>> 0).toString(16)}:${records.length}`;
}

function storageForHangar(win: Window) {
  const local = (win as Window & { chrome?: { storage?: { local?: {
    get(key: string): Promise<Record<string, unknown>>;
    set(items: Record<string, unknown>): Promise<void>;
    remove(key: string): Promise<void>;
  } } } }).chrome?.storage?.local;
  return local || null;
}

function downloadHangarFile(win: Window, doc: Document, name: string, type: string, contents: string): boolean {
  const browser = win as Window & typeof globalThis;
  const URLApi = browser.URL;
  if (!URLApi?.createObjectURL || !URLApi?.revokeObjectURL) return false;
  const blob = new browser.Blob([contents], { type });
  const href = URLApi.createObjectURL(blob);
  const link = doc.createElement('a');
  link.href = href; link.download = name; link.hidden = true;
  doc.body.append(link); link.click(); link.remove();
  win.setTimeout(() => URLApi.revokeObjectURL(href), 0);
  return true;
}

export function paginateHangarEntries<T>(entries: T[], page: number, pageSize: number): { entries: T[]; page: number; pageSize: number; totalPages: number } {
  const safePageSize = Math.max(1, Math.floor(pageSize) || 1);
  const totalPages = Math.max(1, Math.ceil(entries.length / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.floor(page) || 1));
  const start = (safePage - 1) * safePageSize;
  return { entries: entries.slice(start, start + safePageSize), page: safePage, pageSize: safePageSize, totalPages };
}

export function sortHangarEntries<T extends { title: string; page: string; record: Pick<HangarPledgeRecord, 'created' | 'pledgeValue'> }>(entries: T[], sort: HangarSort): T[] {
  const originalPosition = new Map(entries.map((entry, index) => [entry, index]));
  const pageNumber = (entry: T) => Number(new URL(entry.page).searchParams.get('page') || '1');
  const date = (entry: T) => Date.parse(entry.record.created);
  return [...entries].sort((left, right) => {
    if (sort === 'name') return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' }) || originalPosition.get(left)! - originalPosition.get(right)!;
    if (sort === 'newest') {
      const leftDate = date(left), rightDate = date(right);
      const leftValid = Number.isFinite(leftDate), rightValid = Number.isFinite(rightDate);
      if (leftValid !== rightValid) return leftValid ? -1 : 1;
      if (leftValid && leftDate !== rightDate) return rightDate - leftDate;
    }
    if (sort === 'value') {
      const leftValue = left.record.pledgeValue, rightValue = right.record.pledgeValue;
      if ((leftValue !== null) !== (rightValue !== null)) return leftValue === null ? 1 : -1;
      if (leftValue !== null && rightValue !== null && leftValue !== rightValue) return rightValue - leftValue;
    }
    return pageNumber(left) - pageNumber(right) || originalPosition.get(left)! - originalPosition.get(right)!;
  });
}

export function filterHangarEntries<T extends Pick<Entry, 'title' | 'details'>>(
  entries: T[], query: string,
): T[] {
  return entries.filter(entry => !query || matchesHangarSearch(`${entry.title} ${entry.details}`, query));
}

export function installHangarSearch(enabled: () => boolean, win: Window = window, doc: Document = document, refreshPaintEnhancements: (paintMode: boolean) => void = () => {}): () => void {
  let ui: HTMLElement | null = null, input: HTMLInputElement | null = null, results: HTMLElement | null = null, advanced: HTMLDetailsElement | null = null;
  let abort: AbortController | null = null, indexing = false, complete = false, failed = false, cardsLoaded = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let paintMode = false, paintEnhancementsActive = false, pageSize: HangarPageSize = '9', sort: HangarSort = 'default';
  let filterListener: ((event: Event) => void) | null = null, pageSizeListener: ((event: Event) => void) | null = null, sortListener: ((event: Event) => void) | null = null;
  const filterControls = new Map<string, HTMLSelectElement | HTMLInputElement>();
  const entries = new Map<string, Entry>();
  const visited = new Set<string>();
  const failedPages = new Map<string, string>();
  const marked = new Map<HTMLElement, string>();
  let pageKey = '';
  let description: HTMLElement | null = null, originalDescription = '';
  let dashboardBack: HTMLElement | null = null, dashboardMarker: Comment | null = null, dashboardLayoutRoot: HTMLElement | null = null;
  const headerActionMoves: Array<{ action: HTMLElement; marker: Comment; originParent: HTMLElement; kind: 'hangar-log' | 'ship-upgrade' }> = [];
  const createdActionGroups: HTMLElement[] = [];
  let paintList: HTMLElement | null = null, nativeCards: HTMLElement[] | null = null;
  let nativeListHidden = false, nativePagers: HTMLElement[] = [];
  let paintStatus: HTMLElement | null = null, paintPagination: HTMLElement | null = null, indexStatus: HTMLElement | null = null, indexStatusText: HTMLElement | null = null;
  let paintPage = 1, nativePageSize = 1, paintRenderRevision = 0;
  const metadata = new Map<HTMLElement, HTMLElement>();
  let indexFingerprint = '';
  let indexPageCount = 1;
  let pendingExport: 'csv' | 'transfer' | null = null;
  const entryFromRecord = (record: HangarPledgeRecord, card: HTMLElement | null = null): Entry => ({
    id: record.id, title: record.title, details: record.details, image: record.image, page: record.page, card, record,
  });
  const filtersFromUi = (): HangarFilters => ({
    category: (filterControls.get('category') as HTMLSelectElement | undefined)?.value as HangarFilters['category'] || 'all',
    lti: (filterControls.get('lti') as HTMLSelectElement | undefined)?.value as HangarStatusFilter || 'any',
    giftable: (filterControls.get('giftable') as HTMLSelectElement | undefined)?.value as HangarStatusFilter || 'any',
    meltable: (filterControls.get('meltable') as HTMLSelectElement | undefined)?.value as HangarStatusFilter || 'any',
    warbond: (filterControls.get('warbond') as HTMLSelectElement | undefined)?.value as HangarStatusFilter || 'any',
    minValue: parseOptionalNumber((filterControls.get('minValue') as HTMLInputElement | undefined)?.value || ''),
    maxValue: parseOptionalNumber((filterControls.get('maxValue') as HTMLInputElement | undefined)?.value || ''),
  });
  const filtersActive = () => {
    const filters = filtersFromUi();
    return filters.category !== 'all' || filters.lti !== 'any' || filters.giftable !== 'any'
      || filters.meltable !== 'any' || filters.warbond !== 'any' || filters.minValue !== null || filters.maxValue !== null;
  };
  const matchingEntries = () => {
    const filters = filtersFromUi();
    const records = filterHangarRecords([...entries.values()].map(entry => entry.record), filters);
    const allowed = new Set(records.map(record => record.id));
    const query = input?.value.trim() || '';
    const candidates = [...entries.values()].filter(entry => allowed.has(entry.id)).map(entry => ({
      ...entry,
      title: [entry.title, entry.record.basePledge, entry.id, ...entry.record.ships.map(ship => ship.nickname || ship.name)].filter(Boolean).join(' '),
      details: [entry.details, entry.record.category, entry.record.warbond ? 'warbond' : ''].filter(Boolean).join(' '),
    }));
    const matchingIds = new Set(filterHangarEntries(candidates, query).map(entry => entry.id));
    return [...entries.values()].filter(entry => matchingIds.has(entry.id));
  };
  const showMessage = (message: string) => {
    if (!results) return;
    results.replaceChildren(); results.hidden = false;
    const status = doc.createElement('p'); status.className = 'rsi-hangar-search-status'; status.setAttribute('role', 'status'); status.textContent = message; results.append(status);
  };
  const exportRecords = (format: 'csv' | 'transfer') => {
    if (!complete || indexing) {
      pendingExport = format;
      showMessage('Loading every Hangar page first. Your export will download when indexing finishes.');
      if (!indexing) void index();
      return;
    }
    if (failed) { showMessage('Some Hangar pages could not be loaded. Retry the index before exporting a complete file.'); return; }
    const selected = matchingEntries().map(entry => entry.record);
    const csv = format === 'csv';
    const contents = csv ? hangarCsv(selected) : JSON.stringify(hangarTransferShips(selected), null, 2);
    const name = csv ? 'my-hangar.csv' : 'my-hangar-transfer.json';
    const ok = downloadHangarFile(win, doc, name, csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8', contents);
    showMessage(ok ? `Exported ${selected.length} ${selected.length === 1 ? 'pledge' : 'pledges'} to ${name}.` : 'This browser could not start the Hangar export download.');
  };
  const finishPendingExport = () => {
    if (!pendingExport || !complete || failed || indexing) return;
    const format = pendingExport; pendingExport = null; exportRecords(format);
  };
  const renderIndexStatus = () => {
    if (!indexStatus) return;
    let state: 'idle' | 'loading' | 'ready' | 'error';
    if (indexing) { state = 'loading'; indexStatusText!.textContent = `Indexing Hangar pages… ${Math.min(visited.size, indexPageCount)} of ${indexPageCount} checked`; }
    else if (failed) { state = 'error'; indexStatusText!.textContent = `${entries.size} items loaded; ${failedPages.size} page${failedPages.size === 1 ? '' : 's'} could not be loaded. Use Refresh to retry.`; }
    else if (complete) { state = 'ready'; indexStatusText!.textContent = `All ${indexPageCount} Hangar pages indexed · ${entries.size} items`; }
    else { state = 'idle'; indexStatusText!.textContent = 'Search or use filters and export to index Hangar pages.'; }
    indexStatus.setAttribute('data-state', state);
    const CustomEventType = doc.defaultView?.CustomEvent ?? globalThis.CustomEvent;
    if (CustomEventType && typeof doc.dispatchEvent === 'function') doc.dispatchEvent(new CustomEventType(HANGAR_INDEX_STATUS_EVENT, { detail: { itemCount: entries.size, pageCount: indexPageCount, pagesChecked: Math.min(visited.size, indexPageCount), state } }));
  };
  const hydrateCache = (cache: NonNullable<ReturnType<typeof readHangarCache>>, pageOne: string) => {
    const currentEntries = new Map(entries);
    entries.clear();
    for (const record of cache.records) entries.set(record.id, entryFromRecord(record, currentEntries.get(record.id)?.card || null));
    indexPageCount = cache.pageCount; visited.clear(); failedPages.clear();
    for (let number = 1; number <= cache.pageCount; number++) {
      const url = new URL(pageOne); if (number > 1) url.searchParams.set('page', String(number));
      visited.add(url.href);
    }
    indexFingerprint = cache.fingerprint; complete = true; failed = false; cardsLoaded = false;
  };
  const tryLoadCache = async (fingerprint: string, pageOne: string): Promise<boolean> => {
    const local = storageForHangar(win);
    if (!local) return false;
    try {
      const saved = await local.get(HANGAR_INDEX_STORAGE_KEY);
      const raw = saved[HANGAR_INDEX_STORAGE_KEY];
      const cached = readHangarCache(raw, fingerprint);
      if (abort?.signal.aborted) return false;
      if (!cached) {
        const expiresAt = raw && typeof raw === 'object' && 'expiresAt' in raw ? (raw as { expiresAt?: unknown }).expiresAt : null;
        if (typeof expiresAt === 'number' && expiresAt <= Date.now()) await local.remove(HANGAR_INDEX_STORAGE_KEY);
        return false;
      }
      hydrateCache(cached, pageOne);
      return true;
    } catch { return false; }
  };
  const parseOptionalNumber = (value: string): number | null => {
    if (!value.trim()) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  };
  const addMetadata = (row: HTMLElement, record: HangarPledgeRecord) => {
    const title = row.querySelector<HTMLElement>('.title-col');
    if (!title || metadata.has(row)) return;
    const line = doc.createElement('div'); line.className = 'rsi-hangar-pledge-meta';
    const items = [
      ['Pledge ID', record.id],
      ['Base pledge', record.basePledge || 'Not listed'],
      ['Melt value', formatPledgeValue(record.pledgeValue, record.currency)],
      ['LTI', record.lti === null ? 'Not listed' : record.lti ? 'Yes' : 'No'],
      ['Giftable', record.giftable === null ? 'Not listed' : record.giftable ? 'Yes' : 'No'],
      ['Meltable', record.meltable === null ? 'Not listed' : record.meltable ? 'Yes' : 'No'],
    ];
    for (const [label, value] of items) {
      const item = doc.createElement('span'); item.textContent = `${label}: ${value}`; line.append(item);
    }
    title.append(line); metadata.set(row, line);
  };
  const restorePaintMode = () => {
    paintRenderRevision++;
    const restoreEnhancements = paintEnhancementsActive;
    if (paintList && nativeCards) {
      paintList.replaceChildren(...nativeCards);
      paintList.hidden = nativeListHidden;
    }
    for (const pager of nativePagers) pager.classList.remove('rsi-hangar-native-pager-hidden');
    paintStatus?.remove(); paintStatus = null;
    paintPagination?.remove(); paintPagination = null;
    paintList = null; nativeCards = null; nativePagers = [];
    paintEnhancementsActive = false;
    if (restoreEnhancements) refreshPaintEnhancements(false);
  };
  const combinedModeActive = () => paintMode || pageSize !== '9' || sort !== 'default';
  const renderPaintPage = () => {
    if (!combinedModeActive()) return;
    if (!paintList?.isConnected) {
      if (!paintEnhancementsActive) { paintEnhancementsActive = true; refreshPaintEnhancements(true); }
      paintList = doc.querySelector<HTMLElement>('#billing.pledges .list-items');
      if (!paintList) return;
      nativeCards = Array.from(paintList.children) as HTMLElement[];
      nativeListHidden = Boolean(paintList.hidden);
      nativePageSize = Math.max(1, doc.querySelectorAll<HTMLElement>('#billing.pledges .list-items .row').length, nativeCards.length);
      nativePagers = Array.from(doc.querySelectorAll<HTMLElement>('#billing.pledges .pager'));
      for (const pager of nativePagers) pager.classList.add('rsi-hangar-native-pager-hidden');
      paintStatus = doc.createElement('p'); paintStatus.className = 'rsi-hangar-page-status';
      paintStatus.setAttribute('role', 'status'); paintList.after(paintStatus);
    }
    if (!nativeCards) return;
    if (indexing) {
      paintStatus!.textContent = `Loading Hangar cards… ${Math.min(visited.size, indexPageCount)} of ${indexPageCount} pages checked`;
      return;
    }
    const displayed = sortHangarEntries([...entries.values()]
      .filter(entry => Boolean(entry.card) && (!paintMode || isShipPaintCard(entry.title, entry.details))), sort);
    const selectedPageSize = pageSize === 'all' ? Math.max(1, displayed.length) : Number(pageSize);
    const effectivePageSize = paintMode && pageSize === '9' ? nativePageSize : selectedPageSize;
    const page = paginateHangarEntries(displayed, paintPage, effectivePageSize);
    paintPage = page.page;
    const renderRevision = ++paintRenderRevision;
    const cards = page.entries.map(entry => entry.card!);
    const finalStatus = paintStatus!.textContent;
    if (cards.length > 24) {
      paintList.replaceChildren();
      let offset = 0;
      const appendBatch = () => {
        if (renderRevision !== paintRenderRevision || !paintList?.isConnected) return;
        const end = Math.min(offset + 24, cards.length);
        paintList.append(...cards.slice(offset, end));
        offset = end;
        if (offset < cards.length) {
          paintStatus!.textContent = `Rendering Hangar cards… ${offset.toLocaleString()} of ${cards.length.toLocaleString()}`;
          const schedule = win.requestAnimationFrame?.bind(win) || ((callback: FrameRequestCallback) => globalThis.setTimeout(() => callback(Date.now()), 0));
          schedule(appendBatch);
        } else paintStatus!.textContent = finalStatus;
      };
      appendBatch();
    } else paintList.replaceChildren(...cards);
    paintList.hidden = nativeListHidden;
    if (failed) paintStatus!.textContent = `${displayed.length} ${paintMode ? 'paint-containing pledges' : 'Hangar items'} loaded so far. Some pages could not be loaded; refresh all pages to retry.`;
    else if (!complete) paintStatus!.textContent = `Loading all ${indexPageCount} Hangar pages before showing the full item list…`;
    else {
      const first = displayed.length ? (page.page - 1) * effectivePageSize + 1 : 0;
      const last = Math.min(page.page * effectivePageSize, displayed.length);
      paintStatus!.textContent = displayed.length
        ? page.totalPages > 1 ? `${displayed.length.toLocaleString()} ${paintMode ? 'paint-containing pledges' : 'items'} loaded · Page ${page.page} of ${page.totalPages}`
          : `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${displayed.length.toLocaleString()} ${paintMode ? 'paint-containing pledges' : 'items'}`
        : `No ${paintMode ? 'paint-containing pledges' : 'Hangar items'} found`;
    }

    if (!paintPagination) {
      paintPagination = doc.createElement('nav'); paintPagination.className = 'rsi-hangar-page-pagination';
      paintPagination.setAttribute('aria-label', 'Hangar item pages'); paintList.before(paintPagination);
    }
    paintPagination.setAttribute('aria-label', paintMode ? 'Ship Paint result pages' : 'Hangar item pages');
    paintPagination.replaceChildren();
    if (page.totalPages > 1) {
      const previous = doc.createElement('button'); previous.type = 'button'; previous.textContent = '‹';
      previous.setAttribute('aria-label', 'Previous Hangar items'); previous.disabled = page.page <= 1;
      previous.addEventListener('click', () => { paintPage = Math.max(1, paintPage - 1); renderPaintPage(); });
      const first = displayed.length ? (page.page - 1) * effectivePageSize + 1 : 0;
      const last = Math.min(page.page * effectivePageSize, displayed.length);
      const label = doc.createElement('span'); label.textContent = `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${displayed.length.toLocaleString()}`;
      label.title = `Page ${page.page} of ${page.totalPages}`;
      const next = doc.createElement('button'); next.type = 'button'; next.textContent = '›';
      next.setAttribute('aria-label', 'Next Hangar items'); next.disabled = page.page >= page.totalPages;
      next.addEventListener('click', () => { paintPage = Math.min(page.totalPages, paintPage + 1); renderPaintPage(); });
      paintPagination.append(previous, label, next);
    } else { paintPagination.remove(); paintPagination = null; }
    refreshPaintEnhancements(true);
  };
  const enterPaintMode = () => {
    if (!paintMode) return;
    paintPage = 1;
    // Restore the normal list order and remove saved-reference lists before
    // capturing the native cards that this temporary filter will restore.
    paintEnhancementsActive = true;
    refreshPaintEnhancements(true);
    renderPaintPage();
    if (complete && !failed && cardsLoaded) renderPaintPage();
    else if (!indexing) void index(true);
  };
  const leavePaintMode = () => {
    paintMode = false;
    if (pageSize === '9') restorePaintMode();
    else renderPaintPage();
  };
  const cleanup = (preservePaintPreference = false) => {
    abort?.abort(); abort = null; if (timer !== undefined) clearTimeout(timer);
    ui?.remove(); ui = null; input = null; results = null; indexStatus = null; indexStatusText = null;
    const latestHeaderActionByOrigin = new Map<HTMLElement, Map<typeof headerActionMoves[number]['kind'], typeof headerActionMoves[number]>>();
    for (const move of headerActionMoves) {
      if (!move.marker.isConnected || !move.action.isConnected) continue;
      let latestByKind = latestHeaderActionByOrigin.get(move.originParent);
      if (!latestByKind) { latestByKind = new Map(); latestHeaderActionByOrigin.set(move.originParent, latestByKind); }
      latestByKind.set(move.kind, move);
    }
    for (const move of headerActionMoves) {
      if (move.marker.isConnected && move.action.isConnected && latestHeaderActionByOrigin.get(move.originParent)?.get(move.kind) === move) move.marker.before(move.action);
      else move.action.remove();
      move.originParent.classList.remove('rsi-hangar-upgrade-origin-empty');
      move.marker.remove();
    }
    headerActionMoves.length = 0;
    if (dashboardBack && dashboardMarker?.isConnected) dashboardMarker.before(dashboardBack);
    dashboardBack?.classList.remove('rsi-hangar-dashboard-back'); dashboardBack = null;
    dashboardMarker?.remove(); dashboardMarker = null;
    for (const actions of createdActionGroups) actions.remove();
    createdActionGroups.length = 0;
    dashboardLayoutRoot?.removeAttribute?.('data-rsi-hangar-layout'); dashboardLayoutRoot = null;
    if (description) description.textContent = originalDescription;
    description = null; originalDescription = '';
    advanced = null; filterControls.clear(); pendingExport = null;
    if (filterListener) doc.removeEventListener(HANGAR_FILTER_CHANGE_EVENT, filterListener);
    filterListener = null;
    if (pageSizeListener) doc.removeEventListener(HANGAR_PAGE_SIZE_CHANGE_EVENT, pageSizeListener);
    pageSizeListener = null;
    if (sortListener) doc.removeEventListener(HANGAR_SORT_CHANGE_EVENT, sortListener);
    sortListener = null; sort = 'default'; paintMode = false; restorePaintMode();
    if (!preservePaintPreference) {
      try { win.sessionStorage.removeItem(HANGAR_SHIP_PAINT_SESSION_KEY); } catch { /* Storage may be unavailable. */ }
    }
    for (const line of metadata.values()) line.remove(); metadata.clear();
    for (const [row, id] of marked) { row.id = id; row.classList.remove('rsi-hangar-search-target'); }
    marked.clear(); entries.clear(); visited.clear(); failedPages.clear(); indexing = false; complete = false; failed = false; cardsLoaded = false; indexFingerprint = ''; indexPageCount = 1;
  };
  const scan = (page: Document, url: string, live = false) => {
    const rows = page.querySelectorAll<HTMLElement>('#billing.pledges .list-items .row');
    nativePageSize = Math.max(nativePageSize, rows.length);
    const recordPage = canonicalPage(url, url) || url;
    for (const row of rows) {
      const id = row.querySelector<HTMLInputElement>('.js-pledge-id')?.value;
      // Stable native pledge IDs are required to navigate to the exact card.
      if (!id || !/^\d+$/.test(id)) continue;
      const heading = row.querySelector('h3');
      const titleNodes = heading?.childNodes;
      const name = heading?.querySelector('.rsi-hangar-package-title')?.textContent?.trim()
        || (titleNodes ? [...titleNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join(' ').trim() : '');
      const shipTitle = heading?.querySelector('.rsi-hangar-ship-title')?.textContent?.trim();
      const image = row.querySelector<HTMLElement>('.item-image-wrapper .image');
      const entryTitle = name || heading?.textContent?.trim() || 'Hangar item';
      const details = [shipTitle, row.querySelector('.items-col')?.textContent, row.querySelector('.more')?.textContent].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      const card = row.parentElement?.tagName === 'LI' ? row.parentElement : row;
      const record = readHangarPledgeRow(row, recordPage) || normalizeHangarPledge({
        id, title: entryTitle, basePledge: row.querySelector<HTMLInputElement>('.js-pledge-name')?.value || entryTitle,
        valueText: row.querySelector<HTMLInputElement>('.js-pledge-value')?.value || null,
        created: row.querySelector<HTMLElement>('.date-col')?.textContent || '', details,
        page: recordPage, image: sourceImageUrl(image?.querySelector('img')?.getAttribute('src') || '', image?.style.backgroundImage || '', url),
        items: [],
      });
      const entry = entryFromRecord(record, card);
      entries.set(id, entry);
      addMetadata(row, record);
      if (live) { if (!marked.has(row)) marked.set(row, row.id); row.id = `rsi-pledge-${id}`; }
    }
  };
  const reveal = () => {
    const match = /^#rsi-pledge-(\d+)$/.exec(win.location.hash);
    if (!match) return;
    const row = doc.getElementById(`rsi-pledge-${match[1]}`);
    if (row) { row.scrollIntoView({ block: 'center' }); row.classList.add('rsi-hangar-search-target'); }
  };
  const render = () => {
    if (!results || !input) return;
    renderIndexStatus();
    results.replaceChildren();
    const query = input.value.trim(), activeFilters = filtersActive(); results.hidden = !query && !activeFilters;
    if (!query && !activeFilters) return;
    const hits = matchingEntries();
    const status = doc.createElement('p'); status.className = 'rsi-hangar-search-status'; status.setAttribute('role', 'status');
    const count = `${hits.length} match${hits.length === 1 ? '' : 'es'}`;
    status.textContent = failed
      ? `${count} · Some pages could not be searched (${[...failedPages].map(([url, reason]) => `page ${new URL(url).searchParams.get('page') || '1'}: ${reason}`).join('; ')}); change the search to retry`
      : indexing || !complete
        ? `${hits.length} match${hits.length === 1 ? '' : 'es'} so far · Searching all Hangar pages… ${visited.size} checked`
        : `${count} across ${indexPageCount} Hangar pages`;
    results.append(status);
    for (const entry of hits) {
      const href = hangarResultHref(entry.page, entry.id); if (!href) continue;
      const link = doc.createElement('a'); link.className = 'rsi-hangar-search-result'; link.href = href;
      if (entry.image) { const image = doc.createElement('img'); image.src = entry.image; image.alt = ''; image.loading = 'lazy'; link.append(image); }
      const text = doc.createElement('span'), title = doc.createElement('strong'), details = doc.createElement('small');
      title.textContent = entry.title;
      const value = formatPledgeValue(entry.record.pledgeValue, entry.record.currency);
      details.textContent = `Pledge ${entry.id} · ${value} · Page ${new URL(entry.page).searchParams.get('page') || '1'}${entry.details ? ` · ${entry.details}` : ''}`;
      text.append(title, details); link.append(text);
      link.addEventListener('click', event => {
        const destination = new URL(link.href), current = new URL(win.location.href); current.hash = '';
        if (paintMode) {
          leavePaintMode();
          try { win.sessionStorage.removeItem(HANGAR_SHIP_PAINT_SESSION_KEY); } catch { /* Storage may be unavailable. */ }
          const nativeFilter = doc.querySelector<HTMLSelectElement>('#billing.pledges select.rsi-hangar-filter');
          const nativeValue = nativeFilter && Array.from(nativeFilter.options).find(option => option.value !== SHIP_PAINT_FILTER_VALUE)?.value;
          if (nativeFilter && nativeValue) nativeFilter.value = nativeValue;
        }
        if (destination.origin + destination.pathname + destination.search === current.href) {
          event.preventDefault(); win.location.hash = destination.hash;
          reveal(); results!.hidden = true;
        }
      });
      results.append(link);
    }
  };
  const index = async (forceFetch = false) => {
    if (indexing) return;
    if (complete && !failed && !forceFetch) { if (combinedModeActive()) renderPaintPage(); return; }
    if (forceFetch) { complete = false; cardsLoaded = false; visited.clear(); failedPages.clear(); }
    if (failed) { visited.clear(); failedPages.clear(); }
    indexing = true; failed = false;
    const controller = new AbortController(); abort = controller;
    const seed = new URL(win.location.href);
    const category = seed.searchParams.get('type');
    const categoryURL = category !== null && /^[a-z0-9_-]{1,40}$/i.test(category)
      && [...seed.searchParams.keys()].every(key => key === 'page' || key === 'type')
      && seed.searchParams.getAll('type').length === 1 && seed.searchParams.getAll('page').length <= 1
      && (seed.searchParams.get('page') === null || /^[1-9]\d*$/.test(seed.searchParams.get('page')!));
    if (categoryURL) { seed.searchParams.delete('type'); seed.searchParams.delete('page'); }
    const currentPage = canonicalPage(seed.href, win.location.href);
    if (!currentPage) {
      indexing = false; failed = true; complete = false;
      failedPages.set(win.location.href, 'Current URL is not a plain Hangar page');
      render();
      if (combinedModeActive() && paintStatus) paintStatus.textContent = 'Could not find the Hangar page address to search.';
      return;
    }
    const queue: string[] = categoryURL ? [currentPage] : [];
    const queued = new Set([currentPage]);
    const discover = (page: Document, base: string) => {
      // RSI has rendered the same Hangar pagination links outside `.pager` in
      // some account layouts. Search all anchors, then rely on the strict URL
      // validator below to accept only same-origin, page-only Hangar URLs.
      const pageUrls = new Set<string>();
      let lastPage = 1;
      for (const link of page.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        const url = canonicalPage(link.getAttribute('href') || '', base);
        if (!url) continue;
        pageUrls.add(url);
        const number = Number(new URL(url).searchParams.get('page') || '1');
        if (Number.isSafeInteger(number)) lastPage = Math.max(lastPage, number);
      }
      // RSI's pager only shows a small sliding window of numbered links plus a
      // last-page (») link. Do not rely on every fetched page returning the
      // next window: enumerate the complete range advertised by that link.
      if (lastPage > 1 && lastPage <= 1000) {
        const pageBase = new URL(base);
        for (let number = 2; number <= lastPage; number++) {
          const target = new URL(pageBase.href);
          target.search = '';
          target.searchParams.set('page', String(number));
          const url = canonicalPage(target.href, base);
          if (url) pageUrls.add(url);
        }
      }
      indexPageCount = Math.max(indexPageCount, lastPage);
      for (const url of pageUrls) {
        if (!queued.has(url) && !visited.has(url)) { queued.add(url); queue.push(url); }
      }
      return lastPage;
    };
    // The visible page was already scanned into entries. Reuse its DOM for page
    // discovery instead of refetching it, which can fail or return a restricted
    // shell and otherwise stop the search at the current page's results.
    // A native category is only a subset of all items, with different page
    // positions. Fetch unfiltered page one instead of marking that subset read.
    if (categoryURL) entries.clear();
    else visited.add(currentPage);
    const pageOne = new URL(currentPage); pageOne.search = ''; pageOne.hash = '';
    if (forceFetch && !categoryURL) {
      indexPageCount = 1;
      visited.add(currentPage);
    }
    discover(doc, currentPage);
    if (!categoryURL && currentPage === pageOne.href) {
      const firstRecords = [...entries.values()].filter(entry => entry.page === pageOne.href).map(entry => entry.record);
      indexFingerprint = hangarIndexFingerprint(firstRecords, indexPageCount);
      if (!forceFetch && await tryLoadCache(indexFingerprint, pageOne.href)) {
        indexing = false; render(); if (combinedModeActive()) renderPaintPage();
        finishPendingExport();
        if (combinedModeActive() && !cardsLoaded) void index(true);
        return;
      }
    }
    render();
    let cacheLoaded = false;
    try {
      while (queue.length) {
        if (controller.signal.aborted) return;
        const url = queue.shift()!; if (visited.has(url)) continue;
        try {
          let loaded: Document | null = null;
          for (let attempt = 0; attempt < 2 && !loaded; attempt++) {
            try {
              const response = await win.fetch(url, {
                credentials: 'same-origin', signal: controller.signal,
                headers: { Accept: 'text/html,application/xhtml+xml' },
              });
              if (!response.ok) {
                if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
                  await new Promise(resolve => setTimeout(resolve, 250));
                  continue;
                }
                throw new Error(`Hangar page returned ${response.status || 'an error'}`);
              }
              const responsePage = canonicalPage(response.url || url, currentPage);
              if (!responsePage || responsePage !== url) throw new Error('Hangar page redirected outside pagination');
              const html = await response.text();
              if (controller.signal.aborted) return;
              const page = new DOMParser().parseFromString(html, 'text/html');
              if (!page.querySelector('#billing.pledges .list-items')) throw new Error('Hangar page did not contain pledge cards');
              loaded = page;
            } catch (error) {
              if (controller.signal.aborted) return;
              if (attempt === 1) throw error;
              await new Promise(resolve => setTimeout(resolve, 250));
            }
          }
          if (!loaded) throw new Error('Hangar page unavailable');
          scan(loaded, url); visited.add(url); failedPages.delete(url); discover(loaded, url);
          if (url === pageOne.href) {
            const firstRecords = [...entries.values()].filter(entry => entry.page === pageOne.href).map(entry => entry.record);
            indexFingerprint = hangarIndexFingerprint(firstRecords, indexPageCount);
            if (!forceFetch && await tryLoadCache(indexFingerprint, pageOne.href)) {
              cacheLoaded = true; queue.length = 0; break;
            }
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          // A single stale or inaccessible page must not prevent scanning other
          // pagination links discovered from the live page or earlier responses.
          failedPages.set(url, error instanceof Error ? error.message : 'request failed'); failed = true;
        }
        render();
        if (combinedModeActive()) renderPaintPage();
      }
      if (!cacheLoaded) {
        failed = failedPages.size > 0;
        complete = !failed;
        cardsLoaded = complete;
      }
      if (!cacheLoaded && complete && indexFingerprint) {
        const local = storageForHangar(win);
        const cache = createHangarCache([...entries.values()].map(entry => entry.record), indexFingerprint, Date.now(), indexPageCount);
        if (local && cache) void local.set({ [HANGAR_INDEX_STORAGE_KEY]: cache }).catch(() => {});
      }
    } finally {
      if (abort === controller) { indexing = false; render(); if (combinedModeActive()) renderPaintPage(); finishPendingExport(); }
    }
  };
  const refresh = () => {
    if (!enabled()) { cleanup(); return; }
    if (doc.readyState === 'loading') return;
    if (!/\/account\/pledges\/?$/i.test(win.location.pathname)) { cleanup(); return; }
    const key = win.location.pathname + win.location.search;
    if (pageKey && pageKey !== key) cleanup(true); pageKey = key;
    const innerContent = doc.querySelector<HTMLElement>('#billing.pledges .inner-content');
    const top = doc.querySelector<HTMLElement>('#billing.pledges .inner-content > .top');
    // RSI can render the standalone Ship upgrades link outside #billing.
    // Its native classes identify that control without matching other actions.
    const billingContainer = doc.querySelector<HTMLElement>('#billing.pledges');
    const upgradeScope = typeof billingContainer?.querySelectorAll === 'function' ? billingContainer : innerContent || top;
    let headerActions = top?.querySelector?.<HTMLElement>('.actions') || null;
    const nativeUpgradeLinks = typeof doc.querySelectorAll === 'function'
      ? [...doc.querySelectorAll<HTMLAnchorElement>('a.ship-upgrade.js-open-ship-upgrades')]
      : [];
    const candidates = nativeUpgradeLinks.length
      ? nativeUpgradeLinks
      : [...(upgradeScope?.querySelectorAll<HTMLAnchorElement>('a') || [])];
    const upgrade = candidates.find(link => link.parentElement && /ship upgrades/i.test(link.textContent || '') && link.parentElement !== headerActions);
    const mountAnchor = upgrade || candidates.find(link => link.parentElement && /ship upgrades/i.test(link.textContent || ''));
    const nativeTopActions = [...(top?.querySelectorAll<HTMLElement>('a, button') || [])];
    const hangarLog = nativeTopActions.find(action =>
      action.parentElement !== headerActions && (action.classList?.contains('js-pledge-log') || action.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() === 'hangar log'));
    if (!headerActions && top && (hangarLog || upgrade) && (typeof top.insertBefore === 'function' || typeof top.append === 'function')) {
      headerActions = doc.createElement('div');
      headerActions.classList.add('actions');
      const firstNativeAction = [hangarLog, upgrade].find(action => action?.parentElement === top) || null;
      const description = top.querySelector?.<HTMLElement>('p') || null;
      const mountPoint = firstNativeAction || description || top.querySelector?.<HTMLElement>('.separator') || null;
      if (mountPoint && typeof top.insertBefore === 'function') top.insertBefore(headerActions, mountPoint);
      else if (typeof top.append === 'function') top.append(headerActions);
      createdActionGroups.push(headerActions);
    }
    const moveHeaderAction = (action: HTMLElement | null | undefined, kind: typeof headerActionMoves[number]['kind']) => {
      if (!action?.parentElement || !headerActions || action.parentElement === headerActions) return;
      const originParent = action.parentElement;
      const marker = doc.createComment(`RSI Enhanced original ${kind} action location`);
      action.before(marker);
      headerActions.append(action);
      headerActionMoves.push({ action, marker, originParent, kind });
      if (originParent !== top && originParent !== headerActions && originParent.childElementCount === 0) {
        originParent.classList.add('rsi-hangar-upgrade-origin-empty');
      }
    };
    moveHeaderAction(hangarLog, 'hangar-log');
    moveHeaderAction(upgrade, 'ship-upgrade');
    const hasUpgrade = Boolean(mountAnchor);
    if (ui?.isConnected) {
      if (!paintMode) scan(doc, win.location.href, true);
      reveal();
      if (combinedModeActive()) { renderPaintPage(); if (!indexing && (!complete || failed || !cardsLoaded)) void index(true); }
      return;
    }
    if (!hasUpgrade) return;
    const dashboard = headerActions ? [...doc.querySelectorAll<HTMLElement>('a, button')].find(element =>
      element.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() === 'back to dashboard' && !headerActions.contains(element)) : null;
    if (dashboard && headerActions) {
      dashboardMarker = doc.createComment('RSI Enhanced original dashboard link location');
      dashboard.before(dashboardMarker);
      dashboardBack = dashboard;
      dashboard.classList.add('rsi-hangar-dashboard-back');
      headerActions.append(dashboard);
      dashboardLayoutRoot = doc.querySelector<HTMLElement>('#contentbody.account-section') || doc.querySelector<HTMLElement>('.account-section');
      dashboardLayoutRoot?.setAttribute('data-rsi-hangar-layout', 'compact');
    }
    description = top?.querySelector?.<HTMLElement>('p') || null; originalDescription = description?.textContent || '';
    if (description) description.textContent = 'Your pledges, ships, and rewards in one place.';
    ui = doc.createElement('div'); ui.className = 'rsi-hangar-search-panel';
    input = doc.createElement('input'); input.className = 'rsi-hangar-search'; input.type = 'search'; input.placeholder = 'Search ships, items, pledge names or IDs…'; input.setAttribute('aria-label', 'Search all Hangar pages'); input.autocomplete = 'off';
    results = doc.createElement('section'); results.className = 'rsi-hangar-search-results'; results.hidden = true; results.setAttribute('aria-label', 'Hangar search results');
    const quickFilters = doc.createElement('details'); quickFilters.className = 'rsi-hangar-quick-filters';
    const quickSummary = doc.createElement('summary'); quickSummary.textContent = 'Filters';
    const quickFilterContent = doc.createElement('div'); quickFilterContent.className = 'rsi-hangar-quick-filter-content';
    const filterSlot = doc.createElement('div'); filterSlot.className = 'rsi-hangar-filter-slot'; quickFilterContent.append(filterSlot); quickFilters.append(quickSummary, quickFilterContent);
    const sortSlot = doc.createElement('div'); sortSlot.className = 'rsi-hangar-search-sort-slot';
    advanced = doc.createElement('details'); advanced.className = 'rsi-hangar-tools';
    const summary = doc.createElement('summary'); summary.textContent = 'Filters, pledge details & export';
    const fields = doc.createElement('div'); fields.className = 'rsi-hangar-tool-fields';
    const addSelect = (key: string, label: string, options: Array<[string, string]>) => {
      const wrapper = doc.createElement('label'); wrapper.className = 'rsi-hangar-tool-field'; wrapper.textContent = label;
      const select = doc.createElement('select'); select.setAttribute('aria-label', label);
      for (const [value, text] of options) { const option = doc.createElement('option'); option.value = value; option.textContent = text; select.append(option); }
      filterControls.set(key, select); wrapper.append(select); fields.append(wrapper);
      select.addEventListener('change', () => { render(); if (filtersActive()) void index(); });
    };
    const statusOptions: Array<[string, string]> = [['any', 'Any'], ['yes', 'Yes'], ['no', 'No'], ['unknown', 'Not listed']];
    addSelect('category', 'Type', [['all', 'All types'], ['ship', 'Ships'], ['package', 'Packages'], ['upgrade', 'Upgrades'], ['paint', 'Paints'], ['other', 'Other']]);
    addSelect('lti', 'Lifetime insurance', statusOptions);
    addSelect('giftable', 'Giftable', statusOptions);
    addSelect('meltable', 'Meltable', statusOptions);
    addSelect('warbond', 'Warbond', [['any', 'Any'], ['yes', 'Yes'], ['no', 'No']]);
    for (const [key, label] of [['minValue', 'Minimum pledge value'], ['maxValue', 'Maximum pledge value']] as const) {
      const wrapper = doc.createElement('label'); wrapper.className = 'rsi-hangar-tool-field'; wrapper.textContent = label;
      const number = doc.createElement('input'); number.type = 'number'; number.min = '0'; number.step = '1'; number.placeholder = 'Any'; number.setAttribute('aria-label', label);
      filterControls.set(key, number); wrapper.append(number); fields.append(wrapper);
      number.addEventListener('input', () => { render(); if (filtersActive()) void index(); });
    }
    const actions = doc.createElement('div'); actions.className = 'rsi-hangar-tool-actions';
    const addButton = (label: string, action: () => void, className = '') => {
      const button = doc.createElement('button'); button.type = 'button'; button.className = className; button.textContent = label;
      button.addEventListener('click', action); actions.append(button); return button;
    };
    addButton('Export current results (CSV)', () => exportRecords('csv'));
    addButton('Export Hangar Transfer (JSON)', () => exportRecords('transfer'));
    const refreshIndex = () => {
      abort?.abort(); abort = null; indexing = false;
      void storageForHangar(win)?.remove(HANGAR_INDEX_STORAGE_KEY).catch(() => {});
      entries.clear(); visited.clear(); failedPages.clear(); complete = false; failed = false; cardsLoaded = false; indexFingerprint = ''; indexPageCount = 1;
      scan(doc, win.location.href, true); render(); if (combinedModeActive()) renderPaintPage(); void index(true);
    };
    addButton('Refresh all pages', refreshIndex);
    advanced.append(summary, fields, actions);
    indexStatus = doc.createElement('div'); indexStatus.className = 'rsi-hangar-index-status'; indexStatus.setAttribute('role', 'status'); indexStatus.setAttribute('aria-live', 'polite');
    indexStatusText = doc.createElement('span'); indexStatusText.className = 'rsi-hangar-index-status-text';
    const refreshButton = doc.createElement('button'); refreshButton.type = 'button'; refreshButton.className = 'rsi-hangar-refresh'; refreshButton.textContent = 'Refresh'; refreshButton.setAttribute('aria-label', 'Refresh all Hangar pages');
    refreshButton.addEventListener('click', refreshIndex);
    indexStatus.append(indexStatusText, refreshButton);
    ui.append(input, results, advanced, indexStatus, quickFilters, sortSlot);
    if (typeof (top as HTMLElement).append === 'function') (top as HTMLElement).append(ui);
    else if (mountAnchor) mountAnchor.after(ui);
    const SearchReadyEvent = doc.defaultView?.Event ?? globalThis.Event;
    if (SearchReadyEvent && typeof doc.dispatchEvent === 'function') doc.dispatchEvent(new SearchReadyEvent('rsi-hangar-search-ready'));
    filterListener = event => {
      if (!enabled()) return;
      const value = (event as CustomEvent<{ value?: string }>).detail?.value;
      const wasPaintMode = paintMode;
      paintMode = value === SHIP_PAINT_FILTER_VALUE;
      try {
        if (paintMode) win.sessionStorage.setItem(HANGAR_SHIP_PAINT_SESSION_KEY, '1');
        else win.sessionStorage.removeItem(HANGAR_SHIP_PAINT_SESSION_KEY);
      } catch { /* Storage may be unavailable; current-page results still work. */ }
      if (wasPaintMode && !paintMode) {
        if (pageSize === '9') restorePaintMode();
        else renderPaintPage();
      }
      if (paintMode) enterPaintMode();
      render();
    };
    doc.addEventListener(HANGAR_FILTER_CHANGE_EVENT, filterListener);
    pageSizeListener = event => {
      if (!enabled()) return;
      pageSize = normalizeHangarPageSize((event as CustomEvent<{ pageSize?: unknown }>).detail?.pageSize);
      paintPage = 1;
      if (!paintMode && pageSize === '9') { restorePaintMode(); return; }
      renderPaintPage();
      if (!indexing && (!complete || failed || !cardsLoaded)) void index(true);
    };
    doc.addEventListener(HANGAR_PAGE_SIZE_CHANGE_EVENT, pageSizeListener);
    sortListener = event => {
      if (!enabled()) return;
      const next = normalizeHangarSort((event as CustomEvent<{ sort?: unknown }>).detail?.sort);
      if (sort === next) return;
      sort = next; paintPage = 1;
      if (!paintMode && pageSize === '9' && sort === 'default') { restorePaintMode(); return; }
      renderPaintPage();
      if (!indexing && (!complete || failed || !cardsLoaded)) void index(true);
    };
    doc.addEventListener(HANGAR_SORT_CHANGE_EVENT, sortListener);
    try { paintMode = win.sessionStorage.getItem(HANGAR_SHIP_PAINT_SESSION_KEY) === '1'; }
    catch { paintMode = false; }
    scan(doc, win.location.href, true); reveal();
    if (paintMode) enterPaintMode();
    else if (pageSize !== '9') { renderPaintPage(); if (!indexing && (!complete || failed || !cardsLoaded)) void index(true); }
    render();
    input.addEventListener('input', () => { clearTimeout(timer); render(); if (input?.value.trim()) timer = setTimeout(() => { void index(); }, 250); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Escape') results!.hidden = true;
      if (event.key === 'ArrowDown') { event.preventDefault(); results?.querySelector<HTMLAnchorElement>('a')?.focus(); }
      if (event.key === 'Enter') { event.preventDefault(); results?.querySelector<HTMLAnchorElement>('a')?.click(); }
    });
    ui.addEventListener('focusout', event => { if (!ui?.contains(event.relatedTarget as Node | null)) results!.hidden = true; });
    input.addEventListener('focus', render);
  };
  win.addEventListener('hashchange', () => { if (enabled()) refresh(); });
  return refresh;
}
