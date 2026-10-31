type FilterState = {
  anchor: HTMLAnchorElement;
  menu: HTMLElement;
  option: HTMLElement | null;
  display: string;
  active: boolean;
  expanded: string | null;
  input: HTMLInputElement | null;
  inputValue: string | null;
  label: HTMLSpanElement | null;
  labelText: string | null;
  selected: boolean[];
};

function displayed(menu: HTMLElement, win: Window): string {
  try { return win.getComputedStyle(menu).display; }
  catch { return menu.style.display; }
}

function menuFor(anchor: HTMLAnchorElement): HTMLElement | null {
  return anchor.querySelector<HTMLElement>(':scope > .scrollable.body');
}

function optionsFor(anchor: HTMLAnchorElement): HTMLElement[] {
  return [...anchor.querySelectorAll<HTMLElement>('.js-option[rel]')];
}

function optionFor(anchor: HTMLAnchorElement, inputFirst = false): HTMLElement | null {
  const options = optionsFor(anchor);
  const input = anchor.querySelector<HTMLInputElement>('input[type="hidden"]');
  const byValue = input ? options.find(option => option.getAttribute('rel') === input.value) : undefined;
  const selected = options.find(option => option.classList.contains('selected'));
  return inputFirst ? byValue ?? selected ?? null : selected ?? byValue ?? null;
}

function syncLabel(anchor: HTMLAnchorElement, inputFirst = false): void {
  const label = anchor.querySelector<HTMLSpanElement>(':scope > span');
  const option = optionFor(anchor, inputFirst);
  const text = option?.textContent?.trim();
  if (label && text) label.textContent = text;
}

function syncSortBeforeSubmit(form: HTMLFormElement): void {
  const anchor = form.querySelector<HTMLAnchorElement>('.js-sort');
  if (!anchor) return;
  const options = optionsFor(anchor);
  const input = anchor.querySelector<HTMLInputElement>('input[type="hidden"]');
  const selected = options.find(option => option.classList.contains('selected'));
  const byValue = input ? options.find(option => option.getAttribute('rel') === input.value) : undefined;
  const newest = options.find(option => option.textContent?.trim().toLowerCase() === 'new');
  const option = selected ?? byValue ?? newest;
  if (!option) return;
  if (input) input.value = option.getAttribute('rel') ?? '';
  syncLabel(anchor);
}

function isOpen(anchor: HTMLAnchorElement, menu: HTMLElement, win: Window): boolean {
  return anchor.getAttribute('aria-expanded') === 'true'
    || anchor.classList.contains('active')
    || displayed(menu, win) !== 'none';
}

function setOpen(anchor: HTMLAnchorElement, menu: HTMLElement, open: boolean): void {
  menu.style.display = open ? 'block' : 'none';
  anchor.classList.toggle('active', open);
  anchor.setAttribute('aria-expanded', String(open));
  if (open) menu.removeAttribute('aria-hidden');
  else menu.setAttribute('aria-hidden', 'true');
}

function captureState(anchor: HTMLAnchorElement, target: Element, win: Window): FilterState | null {
  const menu = menuFor(anchor);
  if (!menu) return null;
  const possibleOption = target.closest<HTMLElement>('.js-option[rel]');
  const option = possibleOption && anchor.contains(possibleOption) ? possibleOption : null;
  const input = anchor.querySelector<HTMLInputElement>('input[type="hidden"]');
  const label = anchor.querySelector<HTMLSpanElement>(':scope > span');
  const options = optionsFor(anchor);
  return {
    anchor,
    menu,
    option,
    display: displayed(menu, win),
    active: anchor.classList.contains('active'),
    expanded: anchor.getAttribute('aria-expanded'),
    input,
    inputValue: input?.value ?? null,
    label,
    labelText: label?.textContent ?? null,
    selected: options.map(candidate => candidate.classList.contains('selected')),
  };
}

function nativeChanged(state: FilterState, win: Window): boolean {
  const options = optionsFor(state.anchor);
  return displayed(state.menu, win) !== state.display
    || state.anchor.classList.contains('active') !== state.active
    || state.anchor.getAttribute('aria-expanded') !== state.expanded
    || (state.input !== null && state.input.value !== state.inputValue)
    || (state.label !== null && state.label.textContent !== state.labelText)
    || options.some((option, index) => option.classList.contains('selected') !== state.selected[index]);
}

function closeOtherMenus(anchor: HTMLAnchorElement, doc: Document, win: Window): void {
  for (const other of doc.querySelectorAll<HTMLAnchorElement>('#channel #hub-search .js-selectlist')) {
    if (other === anchor) continue;
    const menu = menuFor(other);
    if (menu && isOpen(other, menu, win)) setOpen(other, menu, false);
  }
}

function chooseOption(anchor: HTMLAnchorElement, menu: HTMLElement, option: HTMLElement): void {
  const value = option.getAttribute('rel') ?? '';
  const label = anchor.querySelector<HTMLSpanElement>(':scope > span');
  const input = anchor.querySelector<HTMLInputElement>('input[type="hidden"]');
  if (input) input.value = value;
  if (label) label.textContent = option.textContent?.trim() ?? '';
  for (const candidate of anchor.querySelectorAll<HTMLElement>('.js-option[rel]')) {
    candidate.classList.toggle('selected', candidate === option);
  }
  setOpen(anchor, menu, false);
}

// RSI's filter anchors use href="". Let its native handler run first; if it
// didn't prevent navigation or update the control, supply the same menu state
// changes locally while keeping the native form/Search button intact.
export function installCommLinkControls(enabled: () => boolean, win: Window = window, doc: Document = document): () => void {
  const pending = new WeakMap<Event, FilterState>();
  const submittedForms = new WeakSet<HTMLFormElement>();

  const refresh = (): void => {
    if (!enabled()) return;
    for (const anchor of doc.querySelectorAll<HTMLAnchorElement>('#channel #hub-search .js-selectlist')) {
      // Rebuild the visible value from the real form state when the extension
      // starts or the site replaces the listing during an in-page navigation.
      syncLabel(anchor, true);
    }
    const form = doc.querySelector<HTMLFormElement>('#channel #hub-search');
    if (!form || submittedForms.has(form)) return;
    submittedForms.add(form);
    form.addEventListener('submit', () => {
      if (enabled()) syncSortBeforeSubmit(form);
    }, true);
  };

  win.addEventListener('click', event => {
    if (!enabled() || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const target = event.target as Element | null;
    if (!target) return;
    const anchor = target.closest<HTMLAnchorElement>('#channel #hub-search .js-selectlist');
    if (!anchor) return;
    const state = captureState(anchor, target, win);
    if (state) pending.set(event, state);
  }, true);

  win.addEventListener('click', event => {
    const state = pending.get(event);
    if (!state || !enabled()) return;
    pending.delete(event);
    if (event.defaultPrevented) return;

    // The site handled the interaction but omitted preventDefault: preserve its
    // state changes while stopping the empty-href page reload.
    if (nativeChanged(state, win)) {
      syncLabel(state.anchor);
      event.preventDefault();
      return;
    }

    event.preventDefault();
    if (state.option) {
      chooseOption(state.anchor, state.menu, state.option);
      return;
    }

    const open = !isOpen(state.anchor, state.menu, win);
    closeOtherMenus(state.anchor, doc, win);
    setOpen(state.anchor, state.menu, open);
  });

  refresh();
  return refresh;
}
