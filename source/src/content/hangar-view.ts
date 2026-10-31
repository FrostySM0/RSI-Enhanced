export const HANGAR_VIEW_KEY = 'rsiEnhanced.hangarView';
export const HANGAR_PAGE_SIZE_KEY = 'rsiEnhanced.hangarPageSize';
export const HANGAR_PAGE_SIZE_CHANGE_EVENT = 'rsi-hangar-page-size-change';
export const HANGAR_SORT_CHANGE_EVENT = 'rsi-hangar-sort-change';
export const HANGAR_INDEX_STATUS_EVENT = 'rsi-hangar-index-status';
type View = 'list' | 'grid';
export type HangarPageSize = '9' | '18' | '36' | 'all';
export type HangarSort = 'default' | 'newest' | 'name' | 'value';
export function normalizeHangarPageSize(value: unknown): HangarPageSize {
  return value === '18' || value === '36' || value === 'all' ? value : '9';
}
export function normalizeHangarSort(value: unknown): HangarSort {
  return value === 'newest' || value === 'name' || value === 'value' ? value : 'default';
}
export async function readHangarView(): Promise<View> {
  return (await chrome.storage.local.get(HANGAR_VIEW_KEY))[HANGAR_VIEW_KEY] === 'grid' ? 'grid' : 'list';
}
export async function saveHangarView(view: View): Promise<void> {
  await chrome.storage.local.set({[HANGAR_VIEW_KEY]:view});
}
export async function readHangarPageSize(): Promise<HangarPageSize> {
  return normalizeHangarPageSize((await chrome.storage.local.get(HANGAR_PAGE_SIZE_KEY))[HANGAR_PAGE_SIZE_KEY]);
}
export async function saveHangarPageSize(pageSize: HangarPageSize): Promise<void> {
  await chrome.storage.local.set({[HANGAR_PAGE_SIZE_KEY]:pageSize});
}

export function installHangarView(enabled: () => boolean, doc: Document = document): () => void {
  let view: View = 'list', pageSize: HangarPageSize = '9', sort: HangarSort = 'default';
  let control: HTMLElement | null = null, pageSizeControl: HTMLLabelElement | null = null, pageSizeSelect: HTMLSelectElement | null = null;
  let sortControl: HTMLLabelElement | null = null, sortSelect: HTMLSelectElement | null = null, countBadge: HTMLSpanElement | null = null;
  let started = false, countListenerAttached = false, viewRevision = 0, pageSizeRevision = 0;
  let host: HTMLElement | null = null;
  let filterSlot: HTMLElement | null = null, filterMarker: Comment | null = null;
  let headingRow: HTMLElement | null = null, headingTitle: HTMLElement | null = null, gearTitle: HTMLElement | null = null, headingControls: HTMLElement | null = null, headingMarker: Comment | null = null;
  let pagination: HTMLElement | null = null, nativePager: HTMLElement | null = null, pagerMarker: Comment | null = null;
  let rangeBadge: HTMLElement | null = null;
  const restore = () => {
    if (filterMarker?.isConnected && filterSlot) filterMarker.before(...filterSlot.childNodes);
    filterSlot?.remove(); filterMarker?.remove(); filterSlot = null; filterMarker = null;
    if (pagerMarker?.isConnected && nativePager) pagerMarker.before(nativePager);
    pagerMarker?.remove(); pagerMarker = null; nativePager = null;
    pagination?.classList.remove('rsi-hangar-pagination-rehomed'); pagination = null;
    if (gearTitle && headingMarker?.isConnected) headingMarker.before(gearTitle);
    headingRow?.remove(); headingMarker?.remove(); headingRow = null; headingTitle = null; gearTitle = null; headingMarker = null;
    pageSizeControl?.remove(); pageSizeControl = null; pageSizeSelect = null;
    sortControl?.remove(); sortControl = null; sortSelect = null; countBadge = null; headingControls = null;
    rangeBadge?.remove(); rangeBadge = null;
    if (countListenerAttached) doc.removeEventListener(HANGAR_INDEX_STATUS_EVENT, onIndexStatus);
    countListenerAttached = false;
  };
  const apply = () => {
    doc.documentElement.setAttribute('data-rsi-hangar-view', enabled() ? view : 'list');
    if (enabled()) doc.documentElement.setAttribute('data-rsi-hangar-page-size', pageSize);
    else doc.documentElement.removeAttribute('data-rsi-hangar-page-size');
    for (const button of control?.querySelectorAll<HTMLButtonElement>('button') || []) button.setAttribute('aria-pressed', String(button.dataset.view === view));
    if (pageSizeSelect && pageSizeSelect.value !== pageSize) pageSizeSelect.value = pageSize;
    if (sortSelect && sortSelect.value !== sort) sortSelect.value = sort;
  };
  const publishPageSize = (next: HangarPageSize) => {
    const CustomEventType = doc.defaultView?.CustomEvent ?? globalThis.CustomEvent;
    if (CustomEventType) doc.dispatchEvent(new CustomEventType(HANGAR_PAGE_SIZE_CHANGE_EVENT, { detail: { pageSize: next } }));
  };
  const publishSort = (next: HangarSort) => {
    const CustomEventType = doc.defaultView?.CustomEvent ?? globalThis.CustomEvent;
    if (CustomEventType) doc.dispatchEvent(new CustomEventType(HANGAR_SORT_CHANGE_EVENT, { detail: { sort: next } }));
  };
  const onIndexStatus = (event: Event) => {
    if (!countBadge) return;
    const detail = (event as CustomEvent<{ itemCount?: number; pageCount?: number; pagesChecked?: number; state?: string }>).detail;
    const count = Math.max(0, Number(detail?.itemCount) || 0), pages = Math.max(0, Number(detail?.pageCount) || 0), checked = Math.max(0, Number(detail?.pagesChecked) || 0);
    const state = detail?.state || 'idle';
    countBadge.dataset.state = state;
    countBadge.textContent = state === 'ready' ? `${count.toLocaleString()} items`
      : state === 'error' ? `${count.toLocaleString()} items · some pages unavailable`
        : state === 'loading' ? `${count.toLocaleString()} items · ${checked}/${pages} pages`
          : 'Item count loads in the background';
    if (rangeBadge) {
      const currentPage = Math.max(1, Number(/(?:\?|&)page=(\d+)/.exec(doc.defaultView?.location.search || '')?.[1] || 1));
      if (state === 'ready' && pageSize === '9') {
        const first = count ? (currentPage - 1) * 9 + 1 : 0;
        const last = Math.min(currentPage * 9, count);
        rangeBadge.textContent = `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${count.toLocaleString()}`;
      } else if (state === 'loading') rangeBadge.textContent = 'Loading item range…';
      else rangeBadge.textContent = 'Showing this page';
    }
  };
  const refresh = () => {
    if (!enabled()) { restore(); control?.remove(); control = null; host?.classList.remove('rsi-hangar-view-toolbar'); host = null; if (started) apply(); return; }
    if (doc.readyState === 'loading') return;
    const filter = doc.querySelector<HTMLElement>('#billing.pledges .rsi-hangar-filter, #billing.pledges .js-product-type-filter');
    const toolbar = host?.isConnected ? host : filter?.closest<HTMLElement>('.pager') || filter?.closest<HTMLElement>('.billing-title-pager-wrapper') || filter?.parentElement;
    if (!toolbar) { control?.remove(); control = null; return; }
    if (!headingRow?.isConnected) {
      // RSI has used different element types for this label. Search inside its
      // native title/pager wrapper first so the toolbar still works if it is a
      // div.title rather than an h2, then fall back to the known heading nodes.
      const nativePagination = doc.querySelector<HTMLElement>('#billing.pledges .billing-title-pager-wrapper');
      const isGearTitle = (node: HTMLElement) => /^my\s+gear$/i.test(node.textContent?.trim() || '')
        && !node.closest('.list-items') && !node.closest('.more');
      const nativeTitleCandidates = nativePagination?.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6,[class*="title"],[class*="heading"]') || [];
      const title = [...nativeTitleCandidates].find(isGearTitle)
        || [...(nativePagination?.querySelectorAll<HTMLElement>('*') || [])].find(isGearTitle)
        || [...doc.querySelectorAll<HTMLElement>('#billing.pledges .inner-content h1, #billing.pledges .inner-content h2, #billing.pledges .inner-content h3, #billing.pledges h1, #billing.pledges h2, #billing.pledges h3')].find(isGearTitle);
      if (title) {
        pagination = title.closest<HTMLElement>('.billing-title-pager-wrapper') || nativePagination;
        gearTitle = title;
        headingMarker = doc.createComment('RSI Enhanced original gear heading'); title.before(headingMarker);
        headingRow = doc.createElement('div'); headingRow.className = 'rsi-hangar-heading';
        countBadge = doc.createElement('span'); countBadge.className = 'rsi-hangar-item-count'; countBadge.textContent = 'Item count loads in the background';
        headingTitle = doc.createElement('div'); headingTitle.className = 'rsi-hangar-title'; headingTitle.append(title, countBadge);
        headingControls = doc.createElement('div'); headingControls.className = 'rsi-hangar-heading-controls';
        rangeBadge = doc.createElement('span'); rangeBadge.className = 'rsi-hangar-range'; rangeBadge.textContent = 'Showing this page';
        nativePager = pagination?.querySelector<HTMLElement>('.pager') || null;
        if (pagination && nativePager) {
          pagerMarker = doc.createComment('RSI Enhanced original pagination location'); nativePager.before(pagerMarker);
          pagination.classList.add('rsi-hangar-pagination-rehomed');
        }
        if (pagination) pagination.before(headingRow); else headingMarker.before(headingRow);
      }
    }
    if (headingRow) { host?.classList.remove('rsi-hangar-view-toolbar'); host = null; }
    if (!started) {
      started = true;
      chrome.storage.onChanged.addListener((changes,area)=>{
        if (area !== 'local' || (!Object.hasOwn(changes,HANGAR_VIEW_KEY) && !Object.hasOwn(changes,HANGAR_PAGE_SIZE_KEY))) return;
        if (Object.hasOwn(changes,HANGAR_VIEW_KEY)) { viewRevision++; view = changes[HANGAR_VIEW_KEY].newValue === 'grid' ? 'grid' : 'list'; }
        if (Object.hasOwn(changes,HANGAR_PAGE_SIZE_KEY)) {
          pageSizeRevision++;
          const next = normalizeHangarPageSize(changes[HANGAR_PAGE_SIZE_KEY].newValue);
          const changed = pageSize !== next; pageSize = next; apply();
          if (changed) publishPageSize(next);
        } else apply();
      });
      const currentViewRevision = viewRevision;
      void readHangarView().then(saved=>{ if (currentViewRevision === viewRevision) { view = saved; apply(); } }).catch(()=>{});
      const currentPageSizeRevision = pageSizeRevision;
      void readHangarPageSize().then(saved=>{ if (currentPageSizeRevision === pageSizeRevision) { const changed = pageSize !== saved; pageSize = saved; apply(); if (changed) publishPageSize(saved); } }).catch(()=>{});
    }
    if (!control?.isConnected) {
      if (!headingRow) { host?.classList.remove('rsi-hangar-view-toolbar'); host = toolbar; host.classList.add('rsi-hangar-view-toolbar'); }
      control = doc.createElement('div'); control.className = 'rsi-hangar-view'; control.setAttribute('role','group'); control.setAttribute('aria-label','Hangar view');
      for (const mode of ['list','grid'] as const) {
        const button = doc.createElement('button'); button.type = 'button'; button.dataset.view = mode; button.textContent = mode === 'grid' ? 'Grid' : 'List';
        button.addEventListener('click',async()=>{
          const group = control!;
          for (const child of group.querySelectorAll('button')) child.disabled = true;
          try { await saveHangarView(mode); view = mode; apply(); group.removeAttribute('title'); }
          catch { group.title = 'Could not save view. Please try again.'; }
          finally { for (const child of group.querySelectorAll('button')) child.disabled = false; }
        });
        control.append(button);
      }
    }
    if (!pageSizeControl?.isConnected) {
      pageSizeControl = doc.createElement('label'); pageSizeControl.className = 'rsi-hangar-page-size';
      const label = doc.createElement('span'); label.textContent = 'Items per page';
      pageSizeSelect = doc.createElement('select'); pageSizeSelect.setAttribute('aria-label', 'Items per page');
      for (const [value, text] of [['9','9 items'],['18','18 items'],['36','36 items'],['all','All items']] as const) {
        const option = doc.createElement('option'); option.value = value; option.textContent = text; pageSizeSelect.append(option);
      }
      pageSizeSelect.addEventListener('change', () => {
        const next = normalizeHangarPageSize(pageSizeSelect!.value); pageSizeRevision++; pageSize = next; apply(); publishPageSize(next);
        void saveHangarPageSize(next).catch(() => { pageSizeControl!.title = 'Could not save this page size preference.'; });
      });
      pageSizeControl.append(label, pageSizeSelect);
    }
    if (!sortControl?.isConnected) {
      sortControl = doc.createElement('label'); sortControl.className = 'rsi-hangar-sort';
      const label = doc.createElement('span'); label.textContent = 'Sort by';
      sortSelect = doc.createElement('select'); sortSelect.setAttribute('aria-label', 'Sort Hangar items');
      for (const [value, text] of [['default','Recently added'],['name','Name A–Z'],['value','Highest value']] as const) {
        const option = doc.createElement('option'); option.value = value; option.textContent = text; sortSelect.append(option);
      }
      sortSelect.addEventListener('change', () => { sort = normalizeHangarSort(sortSelect!.value); apply(); publishSort(sort); });
      sortControl.append(label, sortSelect);
    }
    const search = doc.querySelector<HTMLElement>('#billing.pledges .rsi-hangar-search');
    const existingFilterSlot = doc.querySelector<HTMLElement>('#billing.pledges .rsi-hangar-filter-slot');
    if (search && filter && !filterSlot?.isConnected) {
      const widget = filter.closest<HTMLElement>('.js-product-type-filter') || filter;
      filterMarker = doc.createComment('RSI Enhanced original filter location'); widget.before(filterMarker);
      filterSlot = existingFilterSlot || doc.createElement('div'); filterSlot.className = 'rsi-hangar-filter-slot';
      if (!existingFilterSlot) search.after(filterSlot);
      filterSlot.append(widget);
    }
    const sortSlot = doc.querySelector<HTMLElement>('#billing.pledges .rsi-hangar-search-sort-slot');
    if (headingControls) {
      headingRow!.append(control!, headingTitle!, headingControls);
      if (sortSlot) sortSlot.append(sortControl!); else headingControls.append(sortControl!);
      headingControls.append(pageSizeControl!);
      if (rangeBadge) headingControls.append(rangeBadge);
      if (nativePager) headingControls.append(nativePager);
    } else toolbar.prepend(control!, sortControl!, pageSizeControl!);
    if (!countListenerAttached) { doc.addEventListener(HANGAR_INDEX_STATUS_EVENT, onIndexStatus); countListenerAttached = true; }
    apply();
  };
  // Search controls may be inserted after the Hangar toolbar on hydrated pages.
  // Re-run placement once the search panel is attached so sorting lands beside search.
  doc.addEventListener('rsi-hangar-search-ready', refresh);
  return refresh;
}
