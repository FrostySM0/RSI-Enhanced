import { sourceImageUrl } from './hangar-image.ts';

export const HANGAR_CACHE_VERSION = 1;
export const HANGAR_CACHE_TTL_MS = 15 * 60 * 1000;
export const HANGAR_CACHE_MAX_RECORDS = 5_000;

export type HangarCategory = 'ship' | 'package' | 'upgrade' | 'paint' | 'other';
export type HangarStatusFilter = 'any' | 'yes' | 'no' | 'unknown';

export interface HangarShipRecord {
  name: string;
  kind: string;
  manufacturerCode: string;
  manufacturerName: string;
  nickname: string;
}

export interface HangarPledgeInput {
  id: string;
  title: string;
  basePledge?: string | null;
  valueText?: string | null;
  created?: string | null;
  details?: string | null;
  actionsText?: string | null;
  hasActionMarkup?: boolean;
  reclaimable?: boolean | null;
  page: string;
  image?: string | null;
  items?: Array<Partial<HangarShipRecord>>;
}

export function readHangarPledgeRow(row: HTMLElement, page: string): HangarPledgeRecord | null {
  const id = row.querySelector<HTMLInputElement>('.js-pledge-id')?.value?.trim() || '';
  if (!/^\d{1,12}$/.test(id)) return null;
  const heading = row.querySelector<HTMLHeadingElement>('.title-col h3') || row.querySelector<HTMLHeadingElement>('h3');
  const enhancedTitle = heading?.querySelector<HTMLElement>('.rsi-hangar-package-title')?.textContent?.trim();
  const textTitle = heading ? [...heading.childNodes]
    .filter(node => node.nodeType === 3)
    .map(node => node.textContent || '').join(' ').trim() : '';
  const title = enhancedTitle || textTitle || heading?.textContent?.trim() || 'Hangar item';
  const value = row.querySelector<HTMLInputElement>('.js-pledge-value');
  const valueText = value?.value || value?.getAttribute('value') || null;
  const dateText = row.querySelector<HTMLElement>('.date-col')?.textContent?.replace(/^\s*created\s*:\s*/i, '').trim() || '';
  const details = [heading?.querySelector<HTMLElement>('.rsi-hangar-ship-title')?.textContent, row.querySelector<HTMLElement>('.rsi-hangar-ship-title')?.textContent, row.querySelector<HTMLElement>('.items-col')?.textContent, row.querySelector<HTMLElement>('.more')?.textContent]
    .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const more = row.querySelector<HTMLElement>('.more');
  const actionElements = more ? [...(more.querySelectorAll?.<HTMLElement>('.js-reclaim,.js-gift,.js-exchange,.label') || [])].filter(element => element.textContent?.trim()) : [];
  const actionText = more ? actionElements.map(item => item.textContent || '').join(' ') : null;
  const reclaimable = row.querySelector('.js-reclaim') ? true : null;
  const items = [...(row.querySelectorAll?.<HTMLElement>('.more .with-images .item') || [])].map(item => {
    const name = item.querySelector<HTMLElement>('.text .title, .title')?.textContent?.trim() || '';
    const kind = item.querySelector<HTMLElement>('.text .kind, .kind')?.textContent?.trim() || '';
    const manufacturer = item.querySelector<HTMLElement>('.liner');
    const image = item.querySelector<HTMLElement>('.image');
    const nickname = item.querySelector<HTMLElement>('.custom-name-text, .custom-name')?.textContent?.trim() || '';
    return {
      name, kind,
      manufacturerCode: manufacturer?.querySelector('span')?.textContent?.trim() || '',
      manufacturerName: manufacturer?.textContent?.replace(/\([^)]*\)/g, '').trim() || '',
      nickname,
    };
  });
  const image = row.querySelector<HTMLElement>('.item-image-wrapper .image');
  const imageUrl = image ? sourceImageUrl(image.querySelector<HTMLImageElement>('img')?.getAttribute('src') || '', image.style.backgroundImage || '', page) : null;
  return normalizeHangarPledge({
    id, title, basePledge: row.querySelector<HTMLInputElement>('.js-pledge-name')?.value || title,
    valueText, created: dateText, details, actionsText: actionText, hasActionMarkup: actionElements.length > 0,
    reclaimable, page, image: imageUrl, items,
  });
}

export interface HangarPledgeRecord {
  id: string;
  title: string;
  basePledge: string | null;
  created: string;
  details: string;
  valueText: string | null;
  pledgeValue: number | null;
  currency: string | null;
  category: HangarCategory;
  lti: boolean | null;
  giftable: boolean | null;
  meltable: boolean | null;
  warbond: boolean;
  ships: HangarShipRecord[];
  page: string;
  image: string | null;
}

export interface HangarFilters {
  category?: 'all' | HangarCategory;
  lti?: HangarStatusFilter;
  giftable?: HangarStatusFilter;
  meltable?: HangarStatusFilter;
  warbond?: HangarStatusFilter;
  minValue?: number | null;
  maxValue?: number | null;
}

export interface HangarCache {
  version: number;
  fingerprint: string;
  savedAt: number;
  expiresAt: number;
  pageCount: number;
  records: HangarPledgeRecord[];
}

function safeImage(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function parseMoney(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const normalized = value.replace(/,/g, '');
  const match = normalized.match(/(?:^|[^\d])(?:[$€£]\s*)?([0-9]+(?:\.[0-9]{1,2})?)(?=$|\s|[A-Z]{3})/i);
  if (!match) return null;
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function readCurrency(value: string | null | undefined): string | null {
  if (!value) return null;
  const code = value.match(/\b(USD|EUR|GBP|AUD|CAD|JPY)\b/i)?.[1];
  if (code) return code.toUpperCase();
  if (value.includes('$')) return 'USD';
  if (value.includes('€')) return 'EUR';
  if (value.includes('£')) return 'GBP';
  return null;
}

export function formatPledgeValue(value: number | null, currency: string | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return 'Not listed';
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value); }
    catch { /* Use the explicit amount below for unknown currency codes. */ }
  }
  return `${value.toFixed(2)}${currency ? ` ${currency}` : ''}`;
}

function normalizeItems(items: HangarPledgeInput['items']): HangarShipRecord[] {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).flatMap(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim()) return [];
    return [{
      name: item.name.trim().slice(0, 240),
      kind: typeof item.kind === 'string' ? item.kind.trim().slice(0, 80) : '',
      manufacturerCode: typeof item.manufacturerCode === 'string' ? item.manufacturerCode.trim().slice(0, 60) : '',
      manufacturerName: typeof item.manufacturerName === 'string' ? item.manufacturerName.trim().slice(0, 120) : '',
      nickname: typeof item.nickname === 'string' ? item.nickname.trim().slice(0, 120) : '',
    }];
  });
}

function pledgeCategory(title: string, basePledge: string, details: string, items: HangarShipRecord[]): HangarCategory {
  const all = `${title} ${basePledge} ${details} ${items.map(item => `${item.name} ${item.kind}`).join(' ')}`;
  if (/\b(?:ship\s+upgrade|upgrade\s+to|ccu)\b/i.test(all) || items.some(item => /upgrade/i.test(item.kind))) return 'upgrade';
  if (/\bpaints?\b/i.test(all) || items.some(item => /paint|skin/i.test(item.kind))) return 'paint';
  const hasShip = items.some(item => /^(?:ship|vehicle)$/i.test(item.kind));
  if (/^(?:package|combo)\s*[-:]/i.test(`${basePledge} ${title}`) || (hasShip && items.length > 1)) return 'package';
  if (hasShip || /\bship\b/i.test(basePledge)) return 'ship';
  return 'other';
}

function insuranceState(value: string): boolean | null {
  if (/\b(?:lti|lifetime\s+insurance)\b/i.test(value)) return true;
  if (/\binsurance\b/i.test(value)) return false;
  return null;
}

export function normalizeHangarPledge(input: HangarPledgeInput): HangarPledgeRecord {
  const title = typeof input.title === 'string' ? input.title.trim().slice(0, 240) : '';
  const basePledge = typeof input.basePledge === 'string' && input.basePledge.trim()
    ? input.basePledge.trim().slice(0, 240) : null;
  const details = typeof input.details === 'string' ? input.details.trim().slice(0, 5_000) : '';
  const valueText = typeof input.valueText === 'string' && input.valueText.trim() ? input.valueText.trim().slice(0, 100) : null;
  const items = normalizeItems(input.items);
  const statusText = `${basePledge || ''} ${title} ${details} ${items.map(item => `${item.name} ${item.kind}`).join(' ')}`;
  const actionsText = typeof input.actionsText === 'string' ? input.actionsText : '';
  const currency = readCurrency(valueText);
  const giftable = /\b(?:not\s+giftable|cannot\s+be\s+gifted|non[- ]?giftable)\b/i.test(actionsText) ? false
    : /\bgift(?:able)?\b/i.test(actionsText) ? true : null;
  const meltable = typeof input.reclaimable === 'boolean' ? input.reclaimable
    : /\b(?:not\s+reclaimable|cannot\s+be\s+reclaimed|non[- ]?meltable)\b/i.test(actionsText) ? false : null;
  return {
    id: String(input.id || '').trim().slice(0, 12),
    title,
    basePledge,
    created: typeof input.created === 'string' ? input.created.trim().slice(0, 120) : '',
    details,
    valueText,
    pledgeValue: parseMoney(valueText),
    currency,
    category: pledgeCategory(title, basePledge || '', details, items),
    lti: insuranceState(statusText),
    giftable,
    meltable,
    warbond: /\bwar\s*bond\b/i.test(`${basePledge || ''} ${title}`),
    ships: items.filter(item => /^(?:ship|vehicle)$/i.test(item.kind)),
    page: input.page,
    image: safeImage(input.image),
  };
}

function matchesStatus(value: boolean | null, filter: HangarStatusFilter | undefined): boolean {
  if (!filter || filter === 'any') return true;
  if (filter === 'unknown') return value === null;
  return value === (filter === 'yes');
}

export function filterHangarRecords<T extends HangarPledgeRecord>(records: T[], filters: HangarFilters = {}): T[] {
  const min = typeof filters.minValue === 'number' && Number.isFinite(filters.minValue) ? filters.minValue : null;
  const max = typeof filters.maxValue === 'number' && Number.isFinite(filters.maxValue) ? filters.maxValue : null;
  return records.filter(record => {
    if (filters.category && filters.category !== 'all' && record.category !== filters.category) return false;
    if (!matchesStatus(record.lti, filters.lti) || !matchesStatus(record.giftable, filters.giftable)
      || !matchesStatus(record.meltable, filters.meltable) || !matchesStatus(record.warbond, filters.warbond)) return false;
    if (min !== null && (record.pledgeValue === null || record.pledgeValue < min)) return false;
    if (max !== null && (record.pledgeValue === null || record.pledgeValue > max)) return false;
    return true;
  });
}

function csvCell(value: string | number | boolean | null): string {
  let text = value === null ? '' : String(value);
  // Text from RSI can be opened directly in spreadsheet software. Prefix
  // formula-like text before CSV quoting so imported cells stay inert.
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+\-@]/u.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function statusText(value: boolean | null): string {
  return value === null ? 'Unknown' : value ? 'Yes' : 'No';
}

export function hangarCsv(records: HangarPledgeRecord[]): string {
  const rows: Array<Array<string | number | boolean | null>> = [[
    'Pledge ID', 'Name', 'Base pledge', 'Type', 'Melt value', 'Currency', 'LTI', 'Giftable', 'Meltable', 'Warbond', 'Created', 'Page', 'Ships',
  ]];
  for (const record of records) rows.push([
    record.id, record.title, record.basePledge, record.category, record.pledgeValue, record.currency,
    statusText(record.lti), statusText(record.giftable), statusText(record.meltable), statusText(record.warbond),
    record.created, new URL(record.page).searchParams.get('page') || '1', record.ships.map(ship => ship.nickname || ship.name).join('; '),
  ]);
  return `${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
}

export interface HangarTransferShip {
  entity_type: 'ship';
  ship_code: string;
  manufacturer_code: string;
  manufacturer_name: string;
  name: string;
  ship_name: string;
  lti: boolean;
  warbond: boolean;
  pledge_id: string;
  pledge_name: string;
  pledge_date: string;
  pledge_cost: string | null;
  lookup: string;
  unidentified?: string;
}

function shipSlug(value: string): string {
  return value.trim().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').replace(/_+/g, '_') || 'unknown_ship';
}

export function hangarTransferShips(records: HangarPledgeRecord[]): HangarTransferShip[] {
  return records.flatMap(record => record.ships.map(ship => {
    const name = ship.name;
    const code = [ship.manufacturerCode || ship.manufacturerName, name].filter(Boolean).map(shipSlug).join('_');
    return {
      entity_type: 'ship',
      ship_code: code,
      manufacturer_code: ship.manufacturerCode,
      manufacturer_name: ship.manufacturerName,
      name,
      ship_name: ship.nickname || name,
      lti: record.lti === true,
      warbond: record.warbond,
      pledge_id: record.id,
      pledge_name: record.basePledge || record.title,
      pledge_date: record.created,
      pledge_cost: record.valueText,
      lookup: name.toLowerCase(),
      unidentified: 'Ship code was not resolved from a ship catalogue; name and pledge data are preserved for review.',
    };
  }));
}

export function createHangarCache(records: HangarPledgeRecord[], fingerprint: string, now = Date.now(), pageCount = 1): HangarCache | null {
  if (!fingerprint || records.length > HANGAR_CACHE_MAX_RECORDS) return null;
  const cache: HangarCache = {
    version: HANGAR_CACHE_VERSION,
    fingerprint: fingerprint.slice(0, 1_000),
    savedAt: now,
    expiresAt: now + HANGAR_CACHE_TTL_MS,
    pageCount: Math.max(1, Math.min(1_000, Math.floor(pageCount) || 1)),
    records,
  };
  if (JSON.stringify(cache).length > 7_500_000) return null;
  return cache;
}

function isCachedRecord(value: unknown): value is HangarPledgeRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<HangarPledgeRecord>;
  if (typeof record.id !== 'string' || !/^\d{1,12}$/.test(record.id) || typeof record.title !== 'string'
    || typeof record.page !== 'string' || !['ship', 'package', 'upgrade', 'paint', 'other'].includes(record.category || '')
    || !(record.pledgeValue === null || typeof record.pledgeValue === 'number' && Number.isFinite(record.pledgeValue))
    || !(record.lti === null || typeof record.lti === 'boolean')
    || !(record.giftable === null || typeof record.giftable === 'boolean')
    || !(record.meltable === null || typeof record.meltable === 'boolean')
    || typeof record.warbond !== 'boolean' || !Array.isArray(record.ships)) return false;
  try {
    const page = new URL(record.page);
    if (!['http:', 'https:'].includes(page.protocol) || page.hostname.toLowerCase() !== 'robertsspaceindustries.com' || page.username || page.password || !/\/account\/pledges\/?$/i.test(page.pathname)) return false;
    if ([...page.searchParams.keys()].some(key => key !== 'page') || (page.searchParams.has('page') && !/^[1-9]\d*$/.test(page.searchParams.get('page') || ''))) return false;
  } catch { return false; }
  return true;
}

export function readHangarCache(value: unknown, fingerprint: string, now = Date.now()): HangarCache | null {
  if (!value || typeof value !== 'object') return null;
  const cache = value as Partial<HangarCache>;
  if (cache.version !== HANGAR_CACHE_VERSION || cache.fingerprint !== fingerprint
    || typeof cache.expiresAt !== 'number' || cache.expiresAt <= now
    || typeof cache.pageCount !== 'number' || !Number.isSafeInteger(cache.pageCount) || cache.pageCount < 1 || cache.pageCount > 1_000
    || !Array.isArray(cache.records) || cache.records.length > HANGAR_CACHE_MAX_RECORDS
    || !cache.records.every(isCachedRecord)) return null;
  return cache as HangarCache;
}

