import { sourceImageUrl } from './hangar-image.ts';
import { HANGAR_FAVORITES_KEY, normalizeHangarFavorites, type HangarFavorite } from '../shared/hangar-favorites.ts';

interface CardRecord { heading: HTMLHeadingElement; row: HTMLElement; item: HTMLLIElement; button: HTMLButtonElement; favorite: HangarFavorite; }

export function hangarFavoriteTitle(input: { originalTitle: string; upgradedShipTitle: string; containedShips: string[]; type: string | null }): { title: string; subtitle: string } | null {
  const originalTitle = input.originalTitle.trim();
  const upgradedShipTitle = input.upgradedShipTitle.trim();
  const containedShips = [...new Set(input.containedShips.map(title => title.trim()).filter(Boolean))];
  const title = upgradedShipTitle || containedShips.join(' · ') || originalTitle;
  const isPackage = /^package\b/i.test(originalTitle);
  const isShipsFilter = /^(?:ship|ships)$/i.test(input.type || '');
  if (!title || (!isPackage && !upgradedShipTitle && !containedShips.length && !isShipsFilter)) return null;
  return { title: title.slice(0, 240), subtitle: isPackage && title !== originalTitle ? originalTitle.slice(0, 240) : '' };
}

export function isHangarListItem(element: Element | null): element is HTMLLIElement {
  return element?.tagName.toLowerCase() === 'li';
}

function pageContext(win: Window): { page: number; type: string | null } | null {
  const url = new URL(win.location.href);
  if (!/\/account\/pledges\/?$/i.test(url.pathname)) return null;
  const rawPage = url.searchParams.get('page');
  if (rawPage !== null && !/^[1-9]\d{0,4}$/.test(rawPage)) return null;
  const page = rawPage === null ? 1 : Number(rawPage);
  const type = url.searchParams.get('type');
  if (type !== null && !/^[a-z0-9_-]{1,40}$/i.test(type)) return null;
  return { page, type };
}

export function findHangarList(doc: Pick<Document, 'querySelectorAll'>): HTMLElement | null {
  const candidates = doc.querySelectorAll<HTMLElement>('#billing.pledges .list-items:not(.rsi-hangar-favorite-references)');
  for (const list of candidates) if (list.querySelector(':scope > li > .row')) return list;
  return null;
}

function favoriteFromRow(row: HTMLElement, context: { page: number; type: string | null }, base: string): HangarFavorite | null {
  const id = row.querySelector<HTMLInputElement>('.js-pledge-id')?.value;
  const heading = row.querySelector<HTMLHeadingElement>('.title-col h3');
  if (!id || !/^\d{1,12}$/.test(id) || !heading) return null;
  const shipTitle = heading.querySelector('.rsi-hangar-ship-title')?.textContent?.trim() || '';
  const packageTitle = heading.querySelector('.rsi-hangar-package-title')?.textContent?.trim() || '';
  const directTitle = [...heading.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(' ').trim().replace(/\s+/g, ' ');
  const originalTitle = packageTitle || directTitle;
  const includedShips = [...row.querySelectorAll<HTMLElement>('.more .with-images .item')]
    .filter(item => item.querySelector('.text .kind, .kind')?.textContent?.trim().toLocaleLowerCase() === 'ship')
    .map(item => item.querySelector('.text .title, .title')?.textContent?.trim() || '')
    .filter(Boolean);
  const title = hangarFavoriteTitle({ originalTitle, upgradedShipTitle: shipTitle, containedShips: includedShips, type: context.type });
  if (!title) return null;
  const surface = row.querySelector<HTMLElement>('.item-image-wrapper .image');
  const image = surface?.querySelector<HTMLImageElement>('img') || row.querySelector<HTMLImageElement>('.item-image-wrapper img');
  const background = surface?.style.backgroundImage || (surface && surface.ownerDocument.defaultView?.getComputedStyle(surface).backgroundImage) || '';
  return {
    id,
    page: context.page,
    type: context.type,
    title: title.title,
    subtitle: title.subtitle,
    imageUrl: sourceImageUrl(image?.currentSrc || image?.src || '', background, base),
  };
}

export function installHangarFavorites(enabled: () => boolean, win: Window = window, doc: Document = document, paintOnly: () => boolean = () => false): () => void {
  let favorites: HangarFavorite[] = [];
  let loaded = false, started = false, saving = false, revision = 0, saveError = false;
  const records = new Map<HTMLHeadingElement, CardRecord>();
  const promoted = new Map<HTMLLIElement, Comment>();
  let section: HTMLElement | null = null;

  const setButtonState = (button: HTMLButtonElement, favorite: HangarFavorite) => {
    const isFavorite = favorites.some(item => item.id === favorite.id);
    button.textContent = isFavorite ? '★' : '☆';
    button.setAttribute('aria-pressed', String(isFavorite));
    button.setAttribute('aria-label', `${isFavorite ? 'Remove' : 'Add'} ${favorite.title} ${isFavorite ? 'from' : 'to'} favourites`);
    button.title = `${isFavorite ? 'Remove from' : 'Add to'} favourites${saveError ? ' · Could not save your favourites' : ''}`;
    button.disabled = saving;
  };

  const syncButtons = () => {
    for (const record of records.values()) setButtonState(record.button, record.favorite);
    for (const button of doc.querySelectorAll<HTMLButtonElement>('.rsi-hangar-favorite-reference .rsi-hangar-favorite-toggle')) {
      const id = button.dataset.favoriteId;
      const favorite = favorites.find(item => item.id === id);
      if (favorite) setButtonState(button, favorite);
    }
  };

  let render: () => void;
  const toggle = async (favorite: HangarFavorite) => {
    if (saving) return;
    saving = true; saveError = false;
    const previous = favorites;
    favorites = favorites.some(item => item.id === favorite.id)
      ? favorites.filter(item => item.id !== favorite.id)
      : [favorite, ...favorites.filter(item => item.id !== favorite.id)];
    render();
    try { await chrome.storage.local.set({ [HANGAR_FAVORITES_KEY]: favorites }); }
    catch { favorites = previous; saveError = true; }
    finally { saving = false; render(); }
  };

  const makeStar = (favorite: HangarFavorite) => {
    const button = doc.createElement('button');
    button.type = 'button'; button.className = 'rsi-hangar-favorite-toggle'; button.dataset.favoriteId = favorite.id;
    button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); void toggle(favorite); });
    setButtonState(button, favorite);
    return button;
  };

  const restorePromoted = () => {
    for (const [item, marker] of promoted) {
      if (marker.isConnected) marker.before(item);
      marker.remove();
    }
    promoted.clear();
  };

  const clearUi = () => {
    restorePromoted(); section?.remove(); section = null;
    for (const record of records.values()) {
      record.button.remove();
      record.heading.classList.remove('rsi-hangar-favorite-heading');
    }
    records.clear();
  };

  const makeReference = (favorite: HangarFavorite) => {
    const li = doc.createElement('li');
    const article = doc.createElement('article'); article.className = 'row rsi-hangar-favorite-reference';
    const link = doc.createElement('a'); link.className = 'rsi-hangar-favorite-reference-link';
    const target = new URL(win.location.href); target.search = '';
    if (favorite.type) target.searchParams.set('type', favorite.type);
    if (favorite.page > 1) target.searchParams.set('page', String(favorite.page));
    target.hash = `rsi-pledge-${favorite.id}`; link.href = target.href;
    const imageSlot = doc.createElement('span'); imageSlot.className = 'rsi-hangar-favorite-image';
    if (favorite.imageUrl) { const image = doc.createElement('img'); image.src = favorite.imageUrl; image.alt = ''; image.loading = 'lazy'; imageSlot.append(image); }
    else { imageSlot.textContent = '✦'; imageSlot.setAttribute('aria-hidden', 'true'); }
    const copy = doc.createElement('span'); copy.className = 'rsi-hangar-favorite-copy';
    const title = doc.createElement('strong'); title.textContent = favorite.title; copy.append(title);
    if (favorite.subtitle) { const subtitle = doc.createElement('small'); subtitle.textContent = favorite.subtitle; copy.append(subtitle); }
    const destination = doc.createElement('small'); destination.textContent = `Page ${favorite.page} · Open item`; copy.append(destination);
    link.append(imageSlot, copy);
    article.append(link, makeStar(favorite));
    li.append(article);
    return li;
  };

  render = () => {
    if (!enabled()) { clearUi(); return; }
    if (doc.readyState === 'loading' || !loaded) return;
    restorePromoted(); section?.remove(); section = null;
    for (const [heading, record] of records) if (!heading.isConnected) {
      record.button.remove();
      heading.classList.remove('rsi-hangar-favorite-heading');
      records.delete(heading);
    }
    const list = findHangarList(doc);
    const context = pageContext(win);
    if (!list || !context) { clearUi(); return; }

    const cards = new Map<string, { item: HTMLLIElement; favorite: HangarFavorite }>();
    const activeHeadings = new Set<HTMLHeadingElement>();
    for (const row of list.querySelectorAll<HTMLElement>(':scope > li > .row')) {
      const heading = row.querySelector<HTMLHeadingElement>('.title-col h3');
      const item = row.parentElement;
      if (!heading || !isHangarListItem(item)) continue;
      const favorite = favoriteFromRow(row, context, doc.baseURI);
      const existing = records.get(heading);
      if (!favorite) {
        existing?.button.remove(); heading.classList.remove('rsi-hangar-favorite-heading'); records.delete(heading); continue;
      }
      activeHeadings.add(heading);
      if (existing) { existing.favorite = favorite; }
      else {
        const button = makeStar(favorite);
        const titleStack = heading.querySelector('.rsi-hangar-title-stack');
        if (titleStack) titleStack.after(button); else heading.append(button);
        heading.classList.add('rsi-hangar-favorite-heading');
        records.set(heading, { heading, row, item, button, favorite });
      }
      const record = records.get(heading)!;
      record.row = row; record.item = item; record.favorite = favorite;
      if (!cards.has(favorite.id)) cards.set(favorite.id, { item, favorite });
    }
    for (const [heading, record] of records) if (!activeHeadings.has(heading)) {
      record.button.remove(); heading.classList.remove('rsi-hangar-favorite-heading'); records.delete(heading);
    }
    syncButtons();
    // Keep stars on the displayed paint cards, but never reintroduce unrelated
    // saved references or reorder a page owned by the Ship Paint filter.
    if (paintOnly() || context.page !== 1 || favorites.length === 0) return;

    section = doc.createElement('section'); section.className = 'rsi-hangar-favorites';
    const heading = doc.createElement('h2'); heading.textContent = `Favourites (${favorites.length})`; section.append(heading);
    const references = doc.createElement('ul'); references.className = 'list-items rsi-hangar-favorite-references';
    const localItems: HTMLLIElement[] = [];
    for (const favorite of favorites) {
      const card = cards.get(favorite.id);
      if (card && card.favorite.type === favorite.type) localItems.push(card.item);
      else references.append(makeReference(favorite));
    }
    if (references.childElementCount) section.append(references);
    list.before(section);
    for (const item of [...localItems].reverse()) {
      const marker = doc.createComment('RSI Enhanced favourite card position');
      item.before(marker); promoted.set(item, marker); list.prepend(item);
    }
  };

  return () => {
    if (!enabled()) { clearUi(); return; }
    if (doc.readyState === 'loading') return;
    if (!started) {
      started = true;
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !Object.hasOwn(changes, HANGAR_FAVORITES_KEY)) return;
        revision++;
        favorites = normalizeHangarFavorites(changes[HANGAR_FAVORITES_KEY].newValue);
        loaded = true; render();
      });
      const current = revision;
      void chrome.storage.local.get(HANGAR_FAVORITES_KEY).then(values => {
        if (current === revision) favorites = normalizeHangarFavorites(values[HANGAR_FAVORITES_KEY]);
        loaded = true; render();
      }).catch(() => { loaded = true; render(); });
    }
    render();
  };
}
