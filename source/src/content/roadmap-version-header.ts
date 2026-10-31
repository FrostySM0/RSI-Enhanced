export interface RoadmapVersionEntry {
  text: string;
  href: string | null;
}

export interface RoadmapVersionPart {
  text: string;
  href?: string | null;
}

export interface RoadmapVersionCard {
  id: 'live' | 'roundup' | 'ptu';
  label: string;
  value: string;
  href: string | null;
  actionLabel: string | null;
}

const VERSION_FIELDS = [
  { id: 'live', label: 'Live Version', expression: /^Live Version\s*:\s*(.*)$/i },
  { id: 'roundup', label: 'Latest Roadmap Roundup', expression: /^Latest Roadmap Roundup\s*:\s*(.*)$/i },
  { id: 'ptu', label: 'PTU Version', expression: /^PTU Version\s*:\s*(.*)$/i },
] as const;

function cleanValue(value: string): string {
  return value.replace(/\s*\(?more info\)?\s*$/i, '').trim();
}

function ptuIsClosed(value: string): boolean {
  return value === '' || /^(?:0|ø|none|closed|unavailable|n\/a|[-—])$/i.test(value.trim());
}

function formatRoundupDate(value: string): string {
  return value.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, '$1 / $2 / $3');
}

export function roadmapVersionCards(entries: readonly RoadmapVersionEntry[]): RoadmapVersionCard[] {
  const parsed = new Map<string, { value: string; href: string | null }>();
  for (const entry of entries) {
    const text = entry.text.replace(/\s+/g, ' ').trim();
    for (const field of VERSION_FIELDS) {
      const match = text.match(field.expression);
      if (!match) continue;
      parsed.set(field.id, { value: cleanValue(match[1]), href: entry.href });
      break;
    }
  }

  return VERSION_FIELDS.flatMap(field => {
    const info = parsed.get(field.id);
    if (!info && field.id !== 'ptu') return [];
    const rawValue = info?.value ?? '';
    const closed = field.id === 'ptu' && ptuIsClosed(rawValue);
    const value = closed ? 'PTU closed' : field.id === 'roundup' ? formatRoundupDate(rawValue) : rawValue;
    const href = closed ? null : info?.href ?? null;
    return [{
      id: field.id,
      label: field.label,
      value,
      href,
      actionLabel: href ? 'More info ↗' : null,
    }];
  });
}

function entriesFromParts(parts: readonly RoadmapVersionPart[]): RoadmapVersionEntry[] {
  let text = '';
  const links: Array<{ start: number; text: string; href: string | null }> = [];
  for (const part of parts) {
    const start = text.length;
    text += part.text;
    if (part.href) links.push({ start, text: part.text, href: part.href });
  }

  const labelPattern = /Live Version\s*:|Latest Roadmap Roundup\s*:|PTU Version\s*:/gi;
  const labels = [...text.matchAll(labelPattern)];
  const entries = labels.map((label, index): RoadmapVersionEntry => {
    const start = label.index ?? 0;
    const end = labels[index + 1]?.index ?? text.length;
    const fieldText = text.slice(start, end).replace(/[\s·▪•]+$/u, '');
    const infoLink = links.find(link => link.start >= start && link.start < end && /more info/i.test(link.text));
    return { text: fieldText, href: infoLink?.href ?? null };
  });

  return entries;
}

/** Parse RSI's live header, where labels are text nodes and each info link is a separate anchor. */
export function roadmapVersionCardsFromParts(parts: readonly RoadmapVersionPart[]): RoadmapVersionCard[] {
  return roadmapVersionCards(entriesFromParts(parts));
}

const DESCRIPTION_SELECTOR = 'article[class*="Board__Wrapper-"] [class*="Board__Header-"] [class*="Board__Description-"]';
const CARDS_CLASS = 'rsi-roadmap-version-cards';

function readVersionEntries(description: Element): RoadmapVersionEntry[] {
  const parts: RoadmapVersionPart[] = [];
  const visit = (node: Node): void => {
    if (node.nodeType === 3) {
      parts.push({ text: node.nodeValue ?? '' });
      return;
    }
    if (node.nodeType !== 1) return;

    const element = node as Element;
    if (element.classList.contains(CARDS_CLASS)) return;
    if (element.tagName.toLowerCase() === 'a') {
      parts.push({ text: element.textContent ?? '', href: element.getAttribute('href') });
      return;
    }
    for (const child of [...element.childNodes]) visit(child);
  };
  for (const child of [...description.childNodes]) visit(child);

  return entriesFromParts(parts);
}

function createCard(card: RoadmapVersionCard, doc: Document): HTMLElement {
  const element = doc.createElement('div');
  element.className = `rsi-roadmap-version-card rsi-roadmap-version-card--${card.id}`;
  element.setAttribute('role', 'listitem');

  const icon = doc.createElement('span');
  icon.className = 'rsi-roadmap-version-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = card.id === 'live' ? '↙' : card.id === 'roundup' ? '↗' : '◌';

  const content = doc.createElement('div');
  content.className = 'rsi-roadmap-version-content';
  const label = doc.createElement('span');
  label.className = 'rsi-roadmap-version-label';
  label.textContent = card.label;
  const value = doc.createElement('strong');
  value.className = 'rsi-roadmap-version-value';
  value.textContent = card.value;
  content.append(label, value);

  if (card.href && card.actionLabel) {
    const action = doc.createElement('a');
    action.className = 'rsi-roadmap-version-action';
    action.href = card.href;
    action.textContent = card.actionLabel;
    action.setAttribute('aria-label', `${card.label}: ${card.actionLabel}`);
    content.append(action);
  }
  element.append(icon, content);
  return element;
}

export function installRoadmapVersionHeader(
  enabled: () => boolean,
  win: Window = window,
  doc: Document = document,
): () => void {
  const browserWindow = win as Window & typeof globalThis;
  let observer: MutationObserver | null = null;
  let active = false;

  const apply = (): void => {
    if (!enabled()) return;
    const description = doc.querySelector<HTMLElement>(DESCRIPTION_SELECTOR);
    if (!description) return;
    const cards = roadmapVersionCards(readVersionEntries(description));
    if (!cards.some(card => card.id === 'live') || !cards.some(card => card.id === 'roundup')) return;

    let container = description.querySelector<HTMLElement>(`:scope > .${CARDS_CLASS}`);
    if (!container) {
      container = doc.createElement('div');
      container.className = CARDS_CLASS;
      container.setAttribute('role', 'list');
      container.setAttribute('aria-label', 'Roadmap version information');
      description.append(container);
    }

    const signature = JSON.stringify(cards);
    if (container.dataset.signature === signature) return;
    container.replaceChildren(...cards.map(card => createCard(card, doc)));
    container.dataset.signature = signature;
  };

  const containsDescription = (node: Node): boolean => {
    if (node.nodeType !== browserWindow.Node.ELEMENT_NODE) return false;
    const element = node as Element;
    return element.matches(DESCRIPTION_SELECTOR) || Boolean(element.querySelector(DESCRIPTION_SELECTOR));
  };

  const isRelevantMutation = (record: MutationRecord): boolean => {
    const target = record.target.nodeType === browserWindow.Node.ELEMENT_NODE
      ? record.target as Element
      : record.target.parentElement;
    if (target?.closest(`.${CARDS_CLASS}`)) return false;
    const isInDescription = Boolean(target?.closest(DESCRIPTION_SELECTOR));
    if (isInDescription) {
      const changedNodes = [...record.addedNodes, ...record.removedNodes];
      if (target?.matches(DESCRIPTION_SELECTOR)
        && changedNodes.length > 0
        && changedNodes.every(node => node.nodeType === browserWindow.Node.ELEMENT_NODE && (node as Element).matches(`.${CARDS_CLASS}`))) {
        return false;
      }
      return true;
    }
    return [...record.addedNodes, ...record.removedNodes].some(containsDescription);
  };

  const start = (): void => {
    if (observer) return;
    observer = new browserWindow.MutationObserver((records: MutationRecord[]) => {
      if (records.some(isRelevantMutation)) apply();
    });
    observer.observe(doc.body ?? doc.documentElement, { childList: true, characterData: true, subtree: true });
    active = true;
    apply();
  };

  const stop = (): void => {
    observer?.disconnect();
    observer = null;
    active = false;
    doc.querySelectorAll(`.${CARDS_CLASS}`).forEach(element => element.remove());
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
