const listSelector = '#react #page.lobby #page-main .messages-items';
const rowSelector = '.message-item';
const handleSelector = '.member-nickname, .member-name > .nickname, .profile-member-nickname';

type GroupMarker = 'rsiChatSameAuthorNext' | 'rsiChatAuthorBoundaryAfter';

export function installSpectrumChatMessageGroups(enabled: () => boolean, doc: Document = document): () => void {
  let list: HTMLElement | null = null;
  let listObserver: MutationObserver | null = null;
  let mountObserver: MutationObserver | null = null;
  const tagged = new Set<HTMLElement>();

  const clearMarkers = (): void => {
    for (const row of tagged) {
      delete row.dataset.rsiChatSameAuthorNext;
      delete row.dataset.rsiChatAuthorBoundaryAfter;
    }
    tagged.clear();
  };

  const disconnectList = (): void => {
    listObserver?.disconnect();
    listObserver = null;
    list = null;
    clearMarkers();
  };

  const stopWaiting = (): void => {
    mountObserver?.disconnect();
    mountObserver = null;
  };

  const handleFor = (row: HTMLElement): string | null => {
    const handle = row.querySelector<HTMLElement>(handleSelector)?.textContent?.trim();
    return handle?.startsWith('@') ? handle.slice(1).trim().toLowerCase() || null : null;
  };

  const setMarker = (row: HTMLElement, marker: GroupMarker, active: boolean): void => {
    if (active) {
      if (row.dataset[marker] !== 'true') row.dataset[marker] = 'true';
      tagged.add(row);
    } else if (row.dataset[marker] === 'true') {
      delete row.dataset[marker];
      if (!row.dataset.rsiChatSameAuthorNext && !row.dataset.rsiChatAuthorBoundaryAfter) tagged.delete(row);
    }
  };

  const paint = (target: HTMLElement): void => {
    const rows = Array.from(target.children).filter(row => row.matches(rowSelector)) as HTMLElement[];
    const current = new Set(rows);
    for (const row of tagged) {
      if (!current.has(row)) {
        delete row.dataset.rsiChatSameAuthorNext;
        delete row.dataset.rsiChatAuthorBoundaryAfter;
        tagged.delete(row);
      }
    }

    const authors: Array<string | null> = [];
    let previous: string | null = null;
    for (const row of rows) {
      if (row.classList.contains('type-small')) authors.push(previous);
      else {
        previous = handleFor(row);
        authors.push(previous);
      }
    }

    rows.forEach((row, index) => {
      const author = authors[index];
      const nextAuthor = authors[index + 1];
      setMarker(row, 'rsiChatSameAuthorNext', author !== null && nextAuthor !== null && author === nextAuthor);
      setMarker(row, 'rsiChatAuthorBoundaryAfter', author !== null && nextAuthor !== null && author !== nextAuthor);
    });
  };

  const attach = (target: HTMLElement): void => {
    if (list === target) {
      paint(target);
      return;
    }
    disconnectList();
    list = target;
    listObserver = new MutationObserver(() => {
      if (enabled() && list === target) paint(target);
      else disconnectList();
    });
    listObserver.observe(target, { childList: true });
    paint(target);
  };

  const refresh = (): void => {
    if (!enabled()) {
      stopWaiting();
      disconnectList();
      return;
    }

    const target = doc.querySelector<HTMLElement>(listSelector);
    if (target) {
      stopWaiting();
      attach(target);
      return;
    }

    disconnectList();
    if (!mountObserver && doc.documentElement) {
      mountObserver = new MutationObserver(() => {
        if (!enabled()) {
          stopWaiting();
          return;
        }
        const mounted = doc.querySelector<HTMLElement>(listSelector);
        if (mounted) {
          stopWaiting();
          attach(mounted);
        }
      });
      mountObserver.observe(doc.documentElement, { childList: true, subtree: true });
    }
  };

  return refresh;
}
