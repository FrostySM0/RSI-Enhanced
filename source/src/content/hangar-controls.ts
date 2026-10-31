import { sectionForPath } from '../shared/site-sections.ts';

export const SHIP_PAINT_FILTER_VALUE = 'rsi:ship-paint';
export const HANGAR_FILTER_CHANGE_EVENT = 'rsi-hangar-filter-change';
export const HANGAR_SHIP_PAINT_SESSION_KEY = 'rsiEnhanced.hangarShipPaintFilter';

function readPaintPreference(win: Window): boolean {
  try { return win.sessionStorage.getItem(HANGAR_SHIP_PAINT_SESSION_KEY) === '1'; }
  catch { return false; }
}

function writePaintPreference(win: Window, selected: boolean): void {
  try {
    if (selected) win.sessionStorage.setItem(HANGAR_SHIP_PAINT_SESSION_KEY, '1');
    else win.sessionStorage.removeItem(HANGAR_SHIP_PAINT_SESSION_KEY);
  } catch { /* Storage may be unavailable; current-page filtering still works. */ }
}

function hangarURL(value: string, current: string): URL | null {
  if (!value.trim()) return null;
  try {
    const base = new URL(current);
    const url = new URL(value, base);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== base.origin || url.username || url.password || sectionForPath(url.pathname) !== 'hangar' || !/\/account\/pledges\/?$/i.test(url.pathname)) return null;
    url.hash = '';
    return url;
  } catch { return null; }
}

export function filterDestination(value: string, current: string): string | null {
  const url = hangarURL(value, current);
  const base = new URL(current); base.hash = '';
  return url && url.href !== base.href ? url.href : null;
}

// RSI uses .active for expansion, li[rel] for filter URLs, and navigates on change.
// Keep normal arrow handlers first; supply the missing state change only if needed.
export function installHangarControls(enabled: () => boolean, win: Window = window, doc: Document = document): () => void {
  const pending = new WeakMap<Event, { row: HTMLElement; arrow: Element; open: boolean }>();
  const replacements = new Map<HTMLSelectElement, HTMLElement>();
  win.addEventListener('click', event => {
    if (!enabled() || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target as Element | null;
    const arrow = typeof target?.closest === 'function' ? target.closest('.js-expand-arrow') : null;
    const row = arrow?.closest<HTMLElement>('.row');
    if (row && arrow?.closest('#billing.pledges')) pending.set(event, { row, arrow, open: row.classList.contains('active') });
  }, true);
  win.addEventListener('click', event => {
    const state = pending.get(event);
    if (!state || !enabled()) return;
    event.preventDefault();
    if (state.row.classList.contains('active') === state.open) state.row.classList.toggle('active', !state.open);
    state.arrow.setAttribute?.('aria-expanded', String(state.row.classList.contains('active')));
  });

  const refresh = () => {
    for (const [select, original] of replacements) {
      if (!enabled()) select.replaceWith(original);
      if (!enabled() || !select.isConnected) replacements.delete(select);
    }
    if (!enabled()) { writePaintPreference(win, false); return; }
    if (doc.readyState === 'loading') return;
    // Replace only the verified Hangar product-type custom widget. No observers,
    // remote requests, guessed options or financial/action handlers are involved.
    for (const original of doc.querySelectorAll<HTMLElement>('#billing.pledges .js-product-type-filter .js-selectlist, #billing.pledges .js-product-type-filter.js-selectlist')) {
      const choices = [...original.querySelectorAll<HTMLElement>('li[rel]')].map(li => ({ li, url: hangarURL(li.getAttribute('rel') ?? '', win.location.href) })).filter(choice => choice.url && choice.li.textContent?.trim());
      if (!choices.length) continue;
      const select = doc.createElement('select');
      select.className = 'rsi-hangar-filter';
      select.setAttribute('aria-label', 'Filter Hangar items');
      const inputValue = original.querySelector<HTMLInputElement>('input')?.value;
      const selected = choices.find(choice => choice.url?.href === new URL(win.location.href).href)
        ?? choices.find(choice => choice.li.classList.contains('selected'))
        ?? choices.find(choice => choice.url?.href === hangarURL(inputValue ?? '', win.location.href)?.href)
        ?? choices[0];
      for (const choice of choices) {
        const option = doc.createElement('option');
        option.value = choice.url!.href;
        option.textContent = choice.li.textContent!.trim();
        option.selected = choice === selected;
        select.append(option);
      }
      const paintOption = doc.createElement('option');
      paintOption.value = SHIP_PAINT_FILTER_VALUE;
      paintOption.textContent = 'Ship Paint';
      paintOption.selected = readPaintPreference(win);
      select.append(paintOption);
      select.addEventListener('change', event => {
        event.stopPropagation(); // Do not also run RSI's delegated navigation handler.
        const paintFilter = select.value === SHIP_PAINT_FILTER_VALUE;
        writePaintPreference(win, paintFilter);
        doc.dispatchEvent(new CustomEvent(HANGAR_FILTER_CHANGE_EVENT, { detail: { value: paintFilter ? SHIP_PAINT_FILTER_VALUE : '' } }));
        if (paintFilter) return;
        const destination = filterDestination(select.value, win.location.href);
        if (destination) win.location.assign(destination);
      });
      original.replaceWith(select);
      replacements.set(select, original);
    }
  };
  doc.addEventListener('DOMContentLoaded', refresh, { once: true });
  return refresh;
}
