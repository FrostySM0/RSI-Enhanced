type RoadmapSearchRecord = {
  anchor: HTMLAnchorElement;
  href: string;
  title: string;
  description: string;
  cardText: string;
  release: string;
  category: string;
  status: string;
  releaseElement: HTMLElement | null;
  categoryElement: HTMLElement | null;
  categoryHeader: HTMLElement | null;
  categoryCards: HTMLElement | null;
  searchText: string;
};

const CARD_SELECTOR = 'a[class*="Card__StyledNavLink-"]';
const RELEASE_SELECTOR = 'section[class*="Release__Wrapper-"]';
const CATEGORY_SELECTOR = 'section[class*="Category__Wrapper-"]';
const STATUS_SELECTOR = '[class*="StatusBar-"]';
const SEARCH_CLASS = 'rsi-roadmap-search';
const INPUT_CLASS = 'rsi-roadmap-search-input';
const FILTER_BUTTON_CLASS = 'rsi-roadmap-search-filter-button';
const FILTER_POPOVER_CLASS = 'rsi-roadmap-search-filter-popover';
const FILTER_STATUS_CLASS = 'rsi-roadmap-search-filter-status';
const FILTER_CATEGORY_CLASS = 'rsi-roadmap-search-filter-category';
const FILTER_CLEAR_CLASS = 'rsi-roadmap-search-filter-clear';
const RESULTS_CLASS = 'rsi-roadmap-search-results';
const RESULT_CLASS = 'rsi-roadmap-search-result';
const HIGHLIGHT_CLASS = 'rsi-roadmap-search-highlight';
const MAX_VISIBLE_RESULTS = 40;
const FILTER_STATUSES = [
  { label: 'Tentative', value: 'tentative' },
  { label: 'Committed', value: 'committed' },
  { label: 'Released', value: 'released' },
] as const;
type SearchableRoadmapFields = Pick<RoadmapSearchRecord, 'title' | 'description' | 'cardText' | 'release' | 'category' | 'status'> & { searchText?: string };

const textOf = (element: Element | null | undefined): string => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();
const hrefOf = (anchor: HTMLAnchorElement): string => anchor.getAttribute('href') ?? anchor.href ?? '';
const statusValue = (status: string): string => status.toLocaleLowerCase().match(/tentative|committed|released/)?.[0] ?? '';

function categoryNameFromHeader(header: Element | null | undefined): string {
  const textContainer = header?.querySelector('[class*="Category__HeaderText-"]');
  const candidates = [
    textOf(textContainer?.querySelector('h3')),
    textOf(textContainer?.querySelector('h2')),
    textOf(textContainer),
    textOf(header),
  ];
  for (const candidate of candidates) {
    const name = candidate
      .replace(/\b\d+\s+entr(?:y|ies)\b/gi, '')
      .replace(/[⌃⌄▴▾]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name) return name;
  }
  return '';
}

export function roadmapSearchMatches(record: SearchableRoadmapFields, query: string): boolean {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const searchable = record.searchText ?? [record.title, record.description, record.cardText, record.release, record.category, record.status]
    .join(' ')
    .toLocaleLowerCase();
  return words.every(word => searchable.includes(word));
}

function isPreviousReleasesExpanded(button: HTMLButtonElement): boolean {
  const expanded = button.getAttribute('aria-expanded');
  if (expanded === 'true') return true;
  if (expanded === 'false') return false;
  const pressed = button.getAttribute('aria-pressed');
  if (pressed === 'true') return true;
  if (pressed === 'false') return false;
  const state = button.getAttribute('data-state');
  if (state === 'open' || state === 'expanded') return true;
  if (state === 'closed' || state === 'collapsed') return false;
  const label = `${button.getAttribute('aria-label') ?? ''} ${textOf(button)}`.toLowerCase();
  if (/\b(show|expand)\b/.test(label)) return false;
  if (/\b(hide|collapse)\b/.test(label)) return true;
  return false;
}

function collectRoadmapCards(board: HTMLElement): RoadmapSearchRecord[] {
  return [...board.querySelectorAll<HTMLAnchorElement>(CARD_SELECTOR)].map(anchor => {
    const release = anchor.closest<HTMLElement>(RELEASE_SELECTOR);
    const category = anchor.closest<HTMLElement>(CATEGORY_SELECTOR);
    const titleBar = anchor.querySelector('[class*="Card__TitleBar-"]');
    const title = textOf(titleBar?.querySelector('h3')) || textOf(titleBar?.querySelector('h2'))
      || textOf(anchor.querySelector('h3')) || textOf(anchor.querySelector('h2'));
    const description = textOf(anchor.querySelector('[class*="Card__Description-"]'));
    const releaseName = textOf(release?.querySelector('[class*="ReleaseHeaderName-"]'));
    const categoryHeader = category?.querySelector<HTMLElement>('[class*="Category__Header-"]');
    const categoryName = categoryNameFromHeader(categoryHeader);
    const statusBar = anchor.querySelector(STATUS_SELECTOR);
    const status = textOf(statusBar) || textOf(release?.querySelector('[class*="ReleaseHeaderStatus-"]'));
    const record = {
      anchor,
      href: hrefOf(anchor),
      title,
      description,
      cardText: textOf(anchor),
      release: releaseName,
      category: categoryName,
      status,
      releaseElement: release,
      categoryElement: category,
      categoryHeader,
      categoryCards: category?.querySelector<HTMLElement>('[class*="Category__Cards-"]') ?? null,
    };
    return {
      ...record,
      searchText: [record.title, record.description, record.cardText, record.release, record.category, record.status]
        .join(' ')
        .toLocaleLowerCase(),
    };
  });
}

function cardKey(record: RoadmapSearchRecord): string {
  return record.href || [record.release, record.category, record.title, record.description, record.cardText].join('\u0000');
}

function categoryIsCollapsed(header: HTMLElement, cards: HTMLElement | null, win: Window): boolean {
  const expanded = header.getAttribute('aria-expanded');
  if (expanded === 'true') return false;
  if (expanded === 'false') return true;
  if (!cards) return false;
  if (cards.hidden || cards.getAttribute('aria-hidden') === 'true') return true;
  const style = win.getComputedStyle(cards);
  return style.display === 'none' || style.visibility === 'hidden' || cards.getBoundingClientRect().height === 0;
}

export function installRoadmapSearch(
  isEnabled: () => boolean,
  win: Window = window,
  doc: Document = document,
): () => void {
  const browserWindow = win as Window & typeof globalThis;
  let board: HTMLElement | null = null;
  let search: HTMLElement | null = null;
  let input: HTMLInputElement | null = null;
  let filterButton: HTMLButtonElement | null = null;
  let filterPopover: HTMLElement | null = null;
  let categorySelect: HTMLSelectElement | null = null;
  let filterCount: HTMLElement | null = null;
  let results: HTMLElement | null = null;
  let resultSummary: HTMLElement | null = null;
  let resultCount: HTMLElement | null = null;
  let resultHint: HTMLElement | null = null;
  let resultList: HTMLElement | null = null;
  let noResults: HTMLElement | null = null;
  let loadingState: HTMLElement | null = null;
  let boardWaiter: MutationObserver | null = null;
  let archiveWaiter: MutationObserver | null = null;
  let archiveObservedTarget: HTMLElement | null = null;
  let highlighted: HTMLElement | null = null;
  let highlightTimeout: number | null = null;
  let archiveLoading = false;
  let archiveQuietTimeout: number | null = null;
  let archiveMaximumTimeout: number | null = null;
  let archiveMutationFrame: number | null = null;
  let renderFrame: number | null = null;
  let selectionFrame: number | null = null;
  let selectionWaiter: MutationObserver | null = null;
  let selectionTimeout: number | null = null;
  let resultsDismissed = false;
  let filterPopoverOpen = false;
  let selectedStatuses = new Set<string>(FILTER_STATUSES.map(status => status.value));
  let selectedCategory = '';
  const statusInputs = new Map<string, HTMLInputElement>();
  let active = false;
  let searchPrepared = false;
  let expandCategoriesOnSearch = false;
  let knownCategoryHeaders = new WeakSet<HTMLElement>();
  const indexedCards = new Map<string, RoadmapSearchRecord>();
  const resultAnchors = new WeakMap<HTMLButtonElement, HTMLAnchorElement>();

  const activeFilterCount = (): number => (selectedStatuses.size < FILTER_STATUSES.length ? 1 : 0) + (selectedCategory ? 1 : 0);

  const updateFilterButton = (): void => {
    const count = activeFilterCount();
    if (filterCount) {
      filterCount.textContent = String(count);
      filterCount.hidden = count === 0;
    }
    filterButton?.setAttribute('aria-label', count ? `Filters, ${count} active` : 'Filters');
    filterButton?.setAttribute('data-active-count', String(count));
    filterButton?.setAttribute('aria-expanded', String(filterPopoverOpen));
  };

  const refreshCategoryOptions = (): void => {
    if (!categorySelect) return;
    const categories = [...new Set([
      ...[...indexedCards.values()].map(record => record.category),
      ...getCategoryHeaders().map(categoryNameFromHeader),
    ].filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
    if (selectedCategory && !categories.includes(selectedCategory)) selectedCategory = '';
    const allCategories = doc.createElement('option');
    allCategories.value = '';
    allCategories.textContent = 'All categories';
    const options = categories.map(category => {
      const option = doc.createElement('option');
      option.value = category;
      option.textContent = category;
      return option;
    });
    categorySelect.replaceChildren(allCategories, ...options);
    categorySelect.value = selectedCategory;
    updateFilterButton();
  };

  const filtersAreActive = (): boolean => activeFilterCount() > 0;

  const setFilterPopoverOpen = (open: boolean): void => {
    filterPopoverOpen = open;
    if (filterPopover) filterPopover.hidden = !open;
    updateFilterButton();
  };

  const setExpanded = (expanded: boolean): void => {
    input?.setAttribute('aria-expanded', String(expanded));
    if (results) results.hidden = !expanded;
  };

  const stopArchiveWait = (): void => {
    archiveWaiter?.disconnect();
    archiveWaiter = null;
    archiveObservedTarget = null;
  };

  const clearSelectionWait = (): void => {
    selectionWaiter?.disconnect();
    selectionWaiter = null;
    if (selectionTimeout !== null) win.clearTimeout(selectionTimeout);
    selectionTimeout = null;
  };

  const clearArchiveLoadingTimers = (): void => {
    if (archiveQuietTimeout !== null) win.clearTimeout(archiveQuietTimeout);
    if (archiveMaximumTimeout !== null) win.clearTimeout(archiveMaximumTimeout);
    archiveQuietTimeout = null;
    archiveMaximumTimeout = null;
  };

  const finishArchiveLoading = (): void => {
    if (!archiveLoading) return;
    clearArchiveLoadingTimers();
    archiveLoading = false;
    scheduleRender();
  };

  const resetArchiveQuietTimeout = (): void => {
    if (archiveQuietTimeout !== null) win.clearTimeout(archiveQuietTimeout);
    archiveQuietTimeout = win.setTimeout(finishArchiveLoading, 900);
    if (archiveMaximumTimeout === null) archiveMaximumTimeout = win.setTimeout(finishArchiveLoading, 10000);
  };

  const beginArchiveLoading = (): void => {
    archiveLoading = true;
    resetArchiveQuietTimeout();
  };

  const cacheCardsFrom = (scope: HTMLElement): void => {
    for (const record of collectRoadmapCards(scope)) indexedCards.set(cardKey(record), record);
  };

  const cacheVisibleCards = (): void => {
    if (board) cacheCardsFrom(board);
    refreshCategoryOptions();
  };

  const getCategoryHeaders = (): HTMLElement[] => board
    ? [...board.querySelectorAll<HTMLElement>(CATEGORY_SELECTOR)]
      .map(category => category.querySelector<HTMLElement>('[class*="Category__Header-"]'))
      .filter((header): header is HTMLElement => header !== null)
    : [];

  const categoryHeaderIsCollapsed = (header: HTMLElement): boolean => {
    const category = header.closest<HTMLElement>(CATEGORY_SELECTOR);
    const cards = category?.querySelector<HTMLElement>('[class*="Category__Cards-"]') ?? null;
    return categoryIsCollapsed(header, cards, win);
  };

  const expandAllCategoryHeaders = (): void => {
    if (!board) return;
    const headers = getCategoryHeaders();
    if (headers.length === 0) return;

    const expandAll = [...board.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => /expand\s+all\s+categories/i.test(`${button.getAttribute('aria-label') ?? ''} ${textOf(button)}`));
    if (expandAll && !expandAll.disabled) expandAll.click();

    // Keep categories open even when the native bulk control only covers the
    // current release or is unavailable on a particular Roadmap version.
    for (const header of getCategoryHeaders()) {
      if (categoryHeaderIsCollapsed(header)) header.click();
    }
  };

  const indexCollapsedCategory = (header: HTMLElement): void => {
    const category = header.closest<HTMLElement>(CATEGORY_SELECTOR);
    if (!category) return;
    if (!categoryHeaderIsCollapsed(header)) {
      cacheCardsFrom(category);
      return;
    }
    if (category.querySelectorAll(CARD_SELECTOR).length > 0) {
      cacheCardsFrom(category);
      return;
    }
    const entries = Number(/(\d+)\s+entr(?:y|ies)\b/i.exec(textOf(header))?.[1] ?? 0);
    if (entries <= 0) return;

    // Some RSI categories mount their cards only while expanded. Hydrate those
    // cards synchronously, cache them, and restore the user's collapsed state
    // before the browser paints the board.
    header.click();
    cacheCardsFrom(category);
    const currentHeader = category.querySelector<HTMLElement>('[class*="Category__Header-"]');
    const currentCards = category.querySelector<HTMLElement>('[class*="Category__Cards-"]') ?? null;
    if (currentHeader && !categoryIsCollapsed(currentHeader, currentCards, win)) currentHeader.click();
  };

  const indexNewCategories = (): void => {
    if (expandCategoriesOnSearch) expandAllCategoryHeaders();
    for (const header of getCategoryHeaders()) {
      if (knownCategoryHeaders.has(header)) continue;
      knownCategoryHeaders.add(header);
      if (expandCategoriesOnSearch && categoryHeaderIsCollapsed(header)) header.click();
      indexCollapsedCategory(header);
    }
    refreshCategoryOptions();
  };

  const handleArchiveMutation = (): void => {
    if (archiveMutationFrame !== null) return;
    let completed = false;
    const frame = browserWindow.requestAnimationFrame(() => {
      completed = true;
      archiveMutationFrame = null;
      if (!active || !board) return;
      indexNewCategories();
      cacheVisibleCards();
      if (archiveLoading) resetArchiveQuietTimeout();
      scheduleRender();
    });
    if (!completed) archiveMutationFrame = frame;
  };

  const dismissResults = (): void => {
    resultsDismissed = true;
    setExpanded(false);
  };

  const clearHighlight = (): void => {
    if (highlightTimeout !== null) win.clearTimeout(highlightTimeout);
    highlightTimeout = null;
    highlighted?.classList.remove(HIGHLIGHT_CLASS);
    highlighted = null;
  };

  const renderResults = (): void => {
    if (!active || !input || !results || !resultSummary || !resultCount || !resultHint || !resultList || !noResults || !loadingState) return;
    const query = input.value.trim();
    const queryWords = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const filtersActive = filtersAreActive();
    if (queryWords.length === 0 && !filtersActive) {
      resultCount.textContent = '';
      resultHint.textContent = '';
      resultList.replaceChildren();
      noResults.hidden = true;
      loadingState.hidden = true;
      resultsDismissed = false;
      setExpanded(false);
      return;
    }

    const matches = [...indexedCards.values()].filter(record => {
      const textMatches = queryWords.length === 0 || queryWords.every(word => record.searchText.includes(word));
      const recordStatus = statusValue(record.status);
      const statusMatches = selectedStatuses.size === FILTER_STATUSES.length || selectedStatuses.has(recordStatus);
      const categoryMatches = !selectedCategory || record.category === selectedCategory;
      return textMatches && statusMatches && categoryMatches;
    });
    const visibleMatches = matches.slice(0, MAX_VISIBLE_RESULTS);
    const focusedResult = [...resultList.querySelectorAll<HTMLButtonElement>(`.${RESULT_CLASS}`)]
      .find(result => result === doc.activeElement);
    const focusedAnchor = focusedResult ? resultAnchors.get(focusedResult) : null;
    resultCount.textContent = `${matches.length} matching card${matches.length === 1 ? '' : 's'}`;
    resultHint.textContent = matches.length > MAX_VISIBLE_RESULTS
      ? `Showing first ${MAX_VISIBLE_RESULTS} · narrow your search`
      : matches.length ? 'Enter to jump' : '';
    loadingState.hidden = !archiveLoading;
    noResults.hidden = matches.length > 0 || archiveLoading;
    const resultElements: HTMLButtonElement[] = [];
    for (const record of visibleMatches) {
      const result = doc.createElement('button');
      result.type = 'button';
      result.className = RESULT_CLASS;
      result.setAttribute('role', 'option');
      result.setAttribute('aria-selected', 'false');
      result.setAttribute('aria-label', `${record.title}, ${record.release}, ${record.category}, ${record.status}`);

      const title = doc.createElement('span');
      title.className = 'rsi-roadmap-search-result-title';
      title.textContent = record.title || 'Untitled Roadmap card';
      const metadata = doc.createElement('span');
      metadata.className = 'rsi-roadmap-search-result-meta';
      metadata.textContent = [record.release, record.category].filter(Boolean).join(' · ');
      const status = doc.createElement('span');
      status.className = `rsi-roadmap-search-result-status rsi-roadmap-search-result-status--${record.status.toLowerCase().match(/tentative|committed|released/)?.[0] ?? 'unknown'}`;
      status.textContent = record.status || 'Roadmap';
      result.append(title, metadata, status);
      resultAnchors.set(result, record.anchor);
      result.addEventListener('click', () => selectResult(record));
      result.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          setFilterPopoverOpen(false);
          input?.focus();
          dismissResults();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const options = [...(resultList?.querySelectorAll<HTMLButtonElement>(`.${RESULT_CLASS}`) ?? [])];
          const index = options.indexOf(result);
          const next = options[index + (event.key === 'ArrowDown' ? 1 : -1)];
          (next ?? (event.key === 'ArrowUp' ? input : options[0]))?.focus();
        }
      });
      resultElements.push(result);
    }
    resultList.replaceChildren(...resultElements);
    if (focusedAnchor) {
      resultElements.find(result => resultAnchors.get(result) === focusedAnchor)?.focus();
    }
    setExpanded(!resultsDismissed);
  };

  const scheduleRender = (): void => {
    if (!active || renderFrame !== null) return;
    let completed = false;
    const frame = browserWindow.requestAnimationFrame(() => {
      completed = true;
      renderFrame = null;
      renderResults();
    });
    if (!completed) renderFrame = frame;
  };

  const flushRender = (): void => {
    if (renderFrame === null) return;
    browserWindow.cancelAnimationFrame(renderFrame);
    renderFrame = null;
    renderResults();
  };

  const indexCategories = (): void => {
    for (const header of getCategoryHeaders()) {
      knownCategoryHeaders.add(header);
      indexCollapsedCategory(header);
    }
    refreshCategoryOptions();
  };

  const prepareSearchIndex = (expandAll = false): void => {
    if (!board) return;
    if (expandAll) expandCategoriesOnSearch = true;
    if (searchPrepared) {
      if (expandCategoriesOnSearch) expandAllCategoryHeaders();
      cacheVisibleCards();
      return;
    }
    searchPrepared = true;
    const nativeToggle = board.querySelector<HTMLButtonElement>('button[class*="TogglePreviousReleases-"]');
    const toggle = nativeToggle ?? [...board.querySelectorAll<HTMLButtonElement>('button')]
      .find(button => /previous\s+releases/i.test(`${button.getAttribute('aria-label') ?? ''} ${textOf(button)}`));
    if (toggle) {
      const releaseTrack = toggle.closest<HTMLElement>('[class*="Board__Releases-"]')
        ?? board.querySelector<HTMLElement>('[class*="Board__Releases-"]')
        ?? board;
      if (archiveObservedTarget !== releaseTrack) {
        stopArchiveWait();
        beginArchiveLoading();
        const observer = new browserWindow.MutationObserver(handleArchiveMutation);
        observer.observe(releaseTrack, { childList: true, characterData: true, subtree: true });
        archiveWaiter = observer;
        archiveObservedTarget = releaseTrack;
      }
      if (!isPreviousReleasesExpanded(toggle)) toggle.click();
      resetArchiveQuietTimeout();
    }
    if (expandCategoriesOnSearch) expandAllCategoryHeaders();
    indexCategories();
    cacheVisibleCards();
  };

  const handleSearchShortcut = (event: KeyboardEvent): void => {
    if (!active || !isEnabled() || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
    event.preventDefault();
    input?.focus();
  };

  const handleCollapseAllCategories = (event: MouseEvent): void => {
    if (!active || !isEnabled() || !board) return;
    const target = event.target as HTMLElement | null;
    const button = target?.closest?.('button');
    if (!button || !board.contains(button)) return;
    const label = `${button.getAttribute('aria-label') ?? ''} ${textOf(button)}`;
    if (/collapse\s+all\s+categories/i.test(label)) expandCategoriesOnSearch = false;
  };

  const dismissFilterOnEscape = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || !filterPopoverOpen) return;
    event.preventDefault();
    setFilterPopoverOpen(false);
    filterButton?.focus();
  };

  const handleOutsidePointerDown = (event: Event): void => {
    if (!filterPopoverOpen || !search) return;
    const target = event.target;
    if (target && search.contains(target as Node)) return;
    setFilterPopoverOpen(false);
  };

  function selectResult(record: RoadmapSearchRecord): void {
    if (!active || !board) return;
    clearSelectionWait();
    setFilterPopoverOpen(false);
    const category = record.categoryElement?.isConnected
      ? record.categoryElement
      : [...board.querySelectorAll<HTMLElement>(CATEGORY_SELECTOR)].find(candidate => {
        const categoryName = categoryNameFromHeader(candidate.querySelector('[class*="Category__Header-"]'));
        const release = candidate.closest<HTMLElement>(RELEASE_SELECTOR);
        const releaseName = textOf(release?.querySelector('[class*="ReleaseHeaderName-"]'));
        return categoryName === record.category && releaseName === record.release;
      }) ?? null;
    const categoryHeader = record.categoryHeader?.isConnected
      ? record.categoryHeader
      : category?.querySelector<HTMLElement>('[class*="Category__Header-"]') ?? null;
    const categoryCards = record.categoryCards?.isConnected
      ? record.categoryCards
      : category?.querySelector<HTMLElement>('[class*="Category__Cards-"]') ?? null;
    if (categoryHeader && categoryIsCollapsed(categoryHeader, categoryCards, win)) categoryHeader.click();

    dismissResults();
    clearHighlight();
    if (selectionFrame !== null) browserWindow.cancelAnimationFrame(selectionFrame);
    const findAnchor = (): HTMLAnchorElement | null => {
      const scope = category?.isConnected ? category : board;
      if (!scope) return null;
      const candidates = collectRoadmapCards(scope);
      return record.anchor.isConnected
        ? record.anchor
        : candidates.find(candidate => record.href && candidate.href === record.href)?.anchor
          ?? candidates.find(candidate => candidate.title === record.title
            && candidate.category === record.category && candidate.release === record.release)?.anchor
          ?? null;
    };
    const completeSelection = (): boolean => {
      if (!active || !isEnabled() || !board) return true;
      const anchor = findAnchor();
      if (!anchor) return false;
      clearSelectionWait();
      const release = (record.releaseElement?.isConnected ? record.releaseElement : null)
        ?? anchor.closest<HTMLElement>(RELEASE_SELECTOR);
      release?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      anchor.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      anchor.focus({ preventScroll: true });
      anchor.classList.add(HIGHLIGHT_CLASS);
      highlighted = anchor;
      highlightTimeout = win.setTimeout(clearHighlight, 5000);
      return true;
    };
    let completed = false;
    const frame = browserWindow.requestAnimationFrame(() => {
      completed = true;
      selectionFrame = null;
      if (completeSelection()) return;
      const waitTarget = categoryCards?.isConnected ? categoryCards : category?.isConnected ? category : board;
      if (!waitTarget) return;
      const observer = new browserWindow.MutationObserver(() => {
        completeSelection();
      });
      observer.observe(waitTarget, { childList: true, subtree: true });
      selectionWaiter = observer;
      selectionTimeout = win.setTimeout(clearSelectionWait, 3000);
      completeSelection();
    });
    if (!completed) selectionFrame = frame;
  }

  const mount = (nextBoard: HTMLElement): void => {
    const header = nextBoard.querySelector<HTMLElement>(':scope > [class*="Board__Header-"]');
    const controls = header?.querySelector<HTMLElement>('[class*="Controls-sc-"]');
    if (!controls) return;
    board = nextBoard;
    search = doc.createElement('div');
    search.className = SEARCH_CLASS;
    search.setAttribute('role', 'search');
    input = doc.createElement('input');
    input.type = 'search';
    input.className = INPUT_CLASS;
    input.placeholder = 'Search roadmap cards…';
    input.setAttribute('aria-label', 'Search Roadmap cards, including previous releases');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'rsi-roadmap-search-results');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('role', 'combobox');
    const toolbar = doc.createElement('div');
    toolbar.className = 'rsi-roadmap-search-toolbar';
    const inputWrap = doc.createElement('div');
    inputWrap.className = 'rsi-roadmap-search-input-wrap';
    const shortcutHint = doc.createElement('kbd');
    shortcutHint.className = 'rsi-roadmap-search-shortcut';
    shortcutHint.setAttribute('aria-hidden', 'true');
    shortcutHint.textContent = 'Ctrl K';
    inputWrap.append(input, shortcutHint);

    filterButton = doc.createElement('button');
    filterButton.type = 'button';
    filterButton.className = FILTER_BUTTON_CLASS;
    filterButton.setAttribute('aria-haspopup', 'dialog');
    filterButton.setAttribute('aria-expanded', 'false');
    filterButton.setAttribute('aria-controls', 'rsi-roadmap-search-filter-popover');
    const filterButtonLabel = doc.createElement('span');
    filterButtonLabel.textContent = 'Filters';
    filterCount = doc.createElement('span');
    filterCount.className = 'rsi-roadmap-search-filter-count';
    filterCount.setAttribute('aria-hidden', 'true');
    filterCount.hidden = true;
    filterButton.append(filterButtonLabel, filterCount);
    updateFilterButton();

    filterPopover = doc.createElement('div');
    filterPopover.id = 'rsi-roadmap-search-filter-popover';
    filterPopover.className = FILTER_POPOVER_CLASS;
    filterPopover.setAttribute('role', 'dialog');
    filterPopover.setAttribute('aria-label', 'Roadmap filters');
    filterPopover.hidden = true;
    const filterTitle = doc.createElement('div');
    filterTitle.className = 'rsi-roadmap-search-filter-title';
    filterTitle.textContent = 'Filter roadmap cards';
    const statusFieldset = doc.createElement('fieldset');
    statusFieldset.className = 'rsi-roadmap-search-filter-statuses';
    const statusLegend = doc.createElement('legend');
    statusLegend.textContent = 'Status';
    statusFieldset.append(statusLegend);
    for (const status of FILTER_STATUSES) {
      const option = doc.createElement('label');
      option.className = 'rsi-roadmap-search-filter-status-option';
      const checkbox = doc.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = FILTER_STATUS_CLASS;
      checkbox.value = status.value;
      checkbox.checked = true;
      checkbox.setAttribute('aria-label', status.label);
      const label = doc.createElement('span');
      label.textContent = status.label;
      option.append(checkbox, label);
      statusFieldset.append(option);
      statusInputs.set(status.value, checkbox);
      checkbox.addEventListener('change', () => {
        selectedStatuses = new Set([...statusInputs.entries()]
          .filter(([, statusInput]) => statusInput.checked)
          .map(([value]) => value));
        resultsDismissed = false;
        updateFilterButton();
        scheduleRender();
      });
    }
    const categoryLabel = doc.createElement('label');
    categoryLabel.className = 'rsi-roadmap-search-filter-category-label';
    categoryLabel.textContent = 'Category';
    categorySelect = doc.createElement('select');
    categorySelect.className = FILTER_CATEGORY_CLASS;
    categorySelect.setAttribute('aria-label', 'Category');
    categoryLabel.append(categorySelect);
    categorySelect.addEventListener('change', () => {
      selectedCategory = categorySelect?.value ?? '';
      resultsDismissed = false;
      updateFilterButton();
      scheduleRender();
    });
    const clearFiltersButton = doc.createElement('button');
    clearFiltersButton.type = 'button';
    clearFiltersButton.className = FILTER_CLEAR_CLASS;
    clearFiltersButton.textContent = 'Clear filters';
    clearFiltersButton.addEventListener('click', () => {
      selectedStatuses = new Set(FILTER_STATUSES.map(status => status.value));
      for (const statusInput of statusInputs.values()) statusInput.checked = true;
      selectedCategory = '';
      if (categorySelect) categorySelect.value = '';
      resultsDismissed = false;
      updateFilterButton();
      scheduleRender();
    });
    filterPopover.append(filterTitle, statusFieldset, categoryLabel, clearFiltersButton);
    refreshCategoryOptions();

    results = doc.createElement('div');
    results.id = 'rsi-roadmap-search-results';
    results.className = RESULTS_CLASS;
    results.setAttribute('role', 'listbox');
    results.hidden = true;
    resultSummary = doc.createElement('div');
    resultSummary.className = 'rsi-roadmap-search-summary';
    resultSummary.setAttribute('aria-live', 'polite');
    resultCount = doc.createElement('span');
    resultCount.className = 'rsi-roadmap-search-count';
    resultHint = doc.createElement('span');
    resultHint.className = 'rsi-roadmap-search-enter-hint';
    resultSummary.append(resultCount, resultHint);
    resultList = doc.createElement('div');
    resultList.className = 'rsi-roadmap-search-list';
    noResults = doc.createElement('p');
    noResults.className = 'rsi-roadmap-search-empty';
    noResults.textContent = 'No Roadmap cards match that search.';
    noResults.hidden = true;
    loadingState = doc.createElement('p');
    loadingState.className = 'rsi-roadmap-search-loading';
    loadingState.textContent = 'Searching previous releases…';
    loadingState.hidden = true;
    results.append(resultSummary, loadingState, resultList, noResults);
    toolbar.append(inputWrap, filterButton);
    search.append(toolbar, filterPopover, results);
    controls.prepend(search);

    filterButton.addEventListener('click', () => {
      if (filterPopoverOpen) {
        setFilterPopoverOpen(false);
        return;
      }
      setFilterPopoverOpen(true);
      prepareSearchIndex();
      refreshCategoryOptions();
      resultsDismissed = false;
      scheduleRender();
    });
    filterButton.addEventListener('keydown', dismissFilterOnEscape);
    filterPopover.addEventListener('keydown', dismissFilterOnEscape);
    doc.addEventListener('pointerdown', handleOutsidePointerDown);

    input.addEventListener('focus', () => {
      prepareSearchIndex(true);
      if (input?.value.trim() || filtersAreActive()) {
        resultsDismissed = false;
        scheduleRender();
      }
    });
    input.addEventListener('click', () => {
      if (expandCategoriesOnSearch) expandAllCategoryHeaders();
      else prepareSearchIndex(true);
    });
    input.addEventListener('input', () => {
      resultsDismissed = false;
      if (input?.value.trim() && !searchPrepared) {
        prepareSearchIndex();
      }
      scheduleRender();
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        flushRender();
        const first = resultList?.querySelector<HTMLButtonElement>(`.${RESULT_CLASS}`);
        if (first) {
          event.preventDefault();
          first.focus();
        }
      } else if (event.key === 'Escape') {
        setFilterPopoverOpen(false);
        dismissResults();
      } else if (event.key === 'Enter') {
        prepareSearchIndex();
        flushRender();
        const first = resultList?.querySelector<HTMLButtonElement>(`.${RESULT_CLASS}`);
        if (first) {
          event.preventDefault();
          first.click();
        }
      }
    });
    search.addEventListener('focusout', event => {
      if (!search?.contains(event.relatedTarget as Node | null)) {
        setFilterPopoverOpen(false);
        dismissResults();
      }
    });
    active = true;
    doc.addEventListener('keydown', handleSearchShortcut);
    doc.addEventListener('click', handleCollapseAllCategories, true);
  };

  const stop = (): void => {
    boardWaiter?.disconnect();
    boardWaiter = null;
    stopArchiveWait();
    if (archiveMutationFrame !== null) browserWindow.cancelAnimationFrame(archiveMutationFrame);
    archiveMutationFrame = null;
    searchPrepared = false;
    expandCategoriesOnSearch = false;
    knownCategoryHeaders = new WeakSet<HTMLElement>();
    indexedCards.clear();
    clearArchiveLoadingTimers();
    archiveLoading = false;
    if (renderFrame !== null) browserWindow.cancelAnimationFrame(renderFrame);
    if (selectionFrame !== null) browserWindow.cancelAnimationFrame(selectionFrame);
    clearSelectionWait();
    renderFrame = null;
    selectionFrame = null;
    clearHighlight();
    doc.removeEventListener('keydown', handleSearchShortcut);
    doc.removeEventListener('click', handleCollapseAllCategories, true);
    doc.removeEventListener('pointerdown', handleOutsidePointerDown);
    search?.remove();
    selectedStatuses = new Set(FILTER_STATUSES.map(status => status.value));
    selectedCategory = '';
    statusInputs.clear();
    filterPopoverOpen = false;
    board = null;
    search = null;
    input = null;
    filterButton = null;
    filterPopover = null;
    categorySelect = null;
    filterCount = null;
    results = null;
    resultSummary = null;
    resultCount = null;
    resultHint = null;
    resultList = null;
    noResults = null;
    loadingState = null;
    resultsDismissed = false;
    active = false;
  };

  return () => {
    if (!isEnabled()) {
      if (active || boardWaiter || archiveWaiter) stop();
      return;
    }
    const nextBoard = doc.querySelector<HTMLElement>('article[class*="Board__Wrapper-"]');
    if (active && board !== nextBoard) stop();
    if (nextBoard && !active) {
      boardWaiter?.disconnect();
      boardWaiter = null;
      mount(nextBoard);
    } else if (!nextBoard && !boardWaiter) {
      const observer = new browserWindow.MutationObserver(() => {
        const mountedBoard = doc.querySelector<HTMLElement>('article[class*="Board__Wrapper-"]');
        if (mountedBoard) {
          observer.disconnect();
          boardWaiter = null;
          mount(mountedBoard);
        }
      });
      observer.observe(doc.body ?? doc.documentElement, { childList: true, subtree: true });
      boardWaiter = observer;
    }
  };
}
