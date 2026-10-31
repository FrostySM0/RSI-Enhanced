export interface FundingHistoryEntry {
  timestamp: number;
  totalPledge: number;
  deltaPledge: number;
  totalCitizens: number;
  deltaCitizens: number;
}

export interface FundingTimelinePoint {
  timestamp: number;
  label: string;
  amount: number | null;
}

export interface FundingYearlyTotal {
  year: number;
  amount: number;
}

export interface FundingYearlyTotalsResponse {
  totals: FundingYearlyTotal[];
  fetchedAt: number;
  stale: boolean;
}

export interface FundingHistoryStorage {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export interface FundingHistoryResponse {
  entries: FundingHistoryEntry[];
  fetchedAt: number;
  fullFetchedAt?: number;
  stale: boolean;
}

export const FUNDING_HISTORY_REQUEST = 'rsiEnhanced.getFundingHistory';
export const FUNDING_YEARLY_REQUEST = 'rsiEnhanced.getYearlyFundingTotals';
export const FUNDING_HISTORY_CACHE_KEY = 'rsiEnhanced.fundingHistoryCache';
export const FUNDING_YEARLY_CACHE_KEY = 'rsiEnhanced.fundingYearlyTotalsCache';
export const FUNDING_SHEET_ID = '1n96sotjICGR8pw7SL74KTwrCHO6hoqRuAc2Y_fbIJaA';
export const FUNDING_SHEET_GID = '0';
export const FUNDING_HISTORY_CACHE_TTL_MS = 10 * 60 * 1000;
export const FUNDING_HISTORY_RETENTION_MS = 400 * 24 * 60 * 60 * 1000;
export const FUNDING_HISTORY_MAX_AGE_MS = 2 * 60 * 60 * 1000;
export const FUNDING_LATEST_CHECK_CACHE_TTL_MS = 45 * 1000;
export const FUNDING_HISTORY_REFRESH_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const FUNDING_BUCKET_MIN_COVERAGE = 0.8;
const HISTORY_BASELINE_DRIFT_MS = 2 * 60 * 60 * 1000;
const FUNDING_FETCH_TIMEOUT_MS = 12 * 1000;
const MAX_FUNDING_CSV_CHARS = 8 * 1024 * 1024;

export function formatFundingDelta(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}$${Math.abs(rounded).toLocaleString('en-US')}`;
}

/** Parses sheet cells that may use either US or European thousands/decimal separators. */
function parseSheetInteger(value: string, allowNegative: boolean): number | null {
  let raw = value.trim().replace(/[\s\u00a0\u202f$€£]/g, '');
  if (!raw) return null;
  let sign = 1;
  if (raw.startsWith('-') || raw.startsWith('−')) {
    if (!allowNegative) return null;
    sign = -1;
    raw = raw.slice(1);
  } else if (raw.startsWith('+')) {
    raw = raw.slice(1);
  }
  if (!raw || /[^\d,.'’]/.test(raw)) return null;

  const separators = [...raw.matchAll(/[,.']/g)].map(match => ({ char: match[0], index: match.index! }));
  let integerPart = raw;
  if (separators.length) {
    const kinds = new Set(separators.map(separator => separator.char));
    if (kinds.size > 1) {
      const decimal = separators.at(-1)!;
      const fraction = raw.slice(decimal.index + 1);
      if (!fraction || !/^0+$/.test(fraction)) return null;
      integerPart = raw.slice(0, decimal.index);
    } else {
      const separator = separators[0]!.char;
      const groups = raw.split(separator);
      const thousands = groups.length > 1
        && groups[0]!.length >= 1 && groups[0]!.length <= 3
        && groups.slice(1).every(group => group.length === 3);
      if (thousands) integerPart = raw;
      else {
        const fraction = groups.at(-1)!;
        if (!fraction || !/^0+$/.test(fraction)) return null;
        integerPart = groups.slice(0, -1).join('');
      }
    }
  }

  const digits = integerPart.replace(/[,.'’]/g, '');
  if (!/^\d+$/.test(digits)) return null;
  const parsed = Number(digits) * sign;
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseSheetTimestamp(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const isoLike = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?))?$/);
  const normalized = isoLike ? `${isoLike[1]}T${isoLike[2] ?? '00:00:00'}Z` : raw;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Handles quoted commas/newlines and doubled quotes in a Google Sheets CSV response. */
function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(cell);
      cell = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += character;
  }
  if (quoted) return [];
  if (cell || row.length) {
    row.push(cell);
    if (row.some(value => value.trim() !== '')) rows.push(row);
  }
  return rows;
}

/** Converts the sheet's hourly CSV into validated UTC snapshots. */
export function parseFundingHistoryCsv(csv: string): FundingHistoryEntry[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ''));
  const headers = rows.shift()?.map(value => value.trim().toLowerCase().replace(/\s+/g, ' '));
  if (!headers) return [];
  const columns = {
    timestamp: headers.indexOf('datetime utc'),
    totalPledge: headers.indexOf('total pledge'),
    deltaPledge: headers.indexOf('delta pledge'),
    totalCitizens: headers.indexOf('total citizens'),
    deltaCitizens: headers.indexOf('delta citizens'),
  };
  if (Object.values(columns).some(index => index < 0)) return [];

  const byTimestamp = new Map<number, FundingHistoryEntry>();
  for (const row of rows) {
    const timestamp = parseSheetTimestamp(row[columns.timestamp] ?? '');
    const totalPledge = parseSheetInteger(row[columns.totalPledge] ?? '', false);
    const deltaPledge = parseSheetInteger(row[columns.deltaPledge] ?? '', true);
    const totalCitizens = parseSheetInteger(row[columns.totalCitizens] ?? '', false);
    const deltaCitizens = parseSheetInteger(row[columns.deltaCitizens] ?? '', true);
    if (timestamp === null || totalPledge === null || deltaPledge === null
      || totalCitizens === null || deltaCitizens === null) continue;
    byTimestamp.set(timestamp, { timestamp, totalPledge, deltaPledge, totalCitizens, deltaCitizens });
  }
  return [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
}

/** Uses the nearest hourly totals around a day-old reading, never local install age. */
export function calculate24HourHistoryChanges(
  entries: readonly FundingHistoryEntry[],
  now = Date.now(),
): { fundingDelta: number; citizenDelta: number; asOf: number } | null {
  if (!Number.isFinite(now)) return null;
  const valid = entries.filter(entry => Number.isFinite(entry.timestamp)
    && Number.isSafeInteger(entry.totalPledge) && entry.totalPledge >= 0
    && Number.isSafeInteger(entry.totalCitizens) && entry.totalCitizens >= 0
    && entry.timestamp <= now).sort((left, right) => left.timestamp - right.timestamp);
  const latest = valid.at(-1);
  if (!latest || now - latest.timestamp > FUNDING_HISTORY_MAX_AGE_MS) return null;
  const target = latest.timestamp - DAY_MS;
  let baseline: FundingHistoryEntry | null = null;
  let distance = Number.POSITIVE_INFINITY;
  for (const entry of valid) {
    if (entry.timestamp >= latest.timestamp) break;
    const candidateDistance = Math.abs(entry.timestamp - target);
    if (candidateDistance < distance) {
      distance = candidateDistance;
      baseline = entry;
    }
  }
  if (!baseline || distance > HISTORY_BASELINE_DRIFT_MS) return null;
  return {
    fundingDelta: latest.totalPledge - baseline.totalPledge,
    citizenDelta: latest.totalCitizens - baseline.totalCitizens,
    asOf: latest.timestamp,
  };
}

/** Uses the newest fresh sheet row's hourly deltas for the short-range live change. */
export function calculateLatestHourlyHistoryChanges(
  entries: readonly FundingHistoryEntry[],
  now = Date.now(),
): { fundingDelta: number; citizenDelta: number; asOf: number } | null {
  if (!Number.isFinite(now)) return null;
  const latest = entries
    .filter(entry => Number.isFinite(entry.timestamp)
      && Number.isSafeInteger(entry.deltaPledge)
      && Number.isSafeInteger(entry.deltaCitizens)
      && Number.isSafeInteger(entry.totalPledge) && entry.totalPledge >= 0
      && Number.isSafeInteger(entry.totalCitizens) && entry.totalCitizens >= 0
      && entry.timestamp <= now)
    .sort((left, right) => left.timestamp - right.timestamp)
    .at(-1);
  if (!latest || now - latest.timestamp > FUNDING_HISTORY_MAX_AGE_MS) return null;
  return {
    fundingDelta: latest.deltaPledge,
    citizenDelta: latest.deltaCitizens,
    asOf: latest.timestamp,
  };
}

/** Reuses a tab's last successful history after refresh failure without overstating its freshness. */
export function getFundingHistoryFallback(
  entries: readonly FundingHistoryEntry[],
  now = Date.now(),
): { stale: true; changes: ReturnType<typeof calculate24HourHistoryChanges> } | null {
  return entries.length ? { stale: true, changes: calculate24HourHistoryChanges(entries, now) } : null;
}

/** Quarterly shows the current calendar year's Q1-Q4 funding; Year shows annual totals. */
export function buildFundingTimeline(
  entries: readonly FundingHistoryEntry[],
  range: 'quarter' | 'year',
  now = Date.now(),
  yearlyTotals: readonly FundingYearlyTotal[] = [],
): FundingTimelinePoint[] {
  if (!Number.isFinite(now)) return [];
  if (range === 'year') {
    const currentYear = new Date(now).getUTCFullYear();
    return yearlyTotals
      .filter(point => Number.isSafeInteger(point.year) && point.year <= currentYear && Number.isSafeInteger(point.amount))
      .sort((left, right) => left.year - right.year)
      .map(point => ({ timestamp: Date.UTC(point.year, 0, 1), label: String(point.year), amount: point.amount }));
  }

  const valid = entries.filter(entry => Number.isFinite(entry.timestamp)
    && entry.timestamp <= now
    && Number.isSafeInteger(entry.deltaPledge)).sort((left, right) => left.timestamp - right.timestamp);
  const currentYear = new Date(now).getUTCFullYear();
  return Array.from({ length: 4 }, (_, index) => {
    const bucketStart = Date.UTC(currentYear, index * 3, 1);
    const bucketEnd = Date.UTC(currentYear, (index + 1) * 3, 1);
    const bucketEntries = valid.filter(entry => entry.timestamp >= bucketStart && entry.timestamp < bucketEnd);
    const expectedHours = Math.max(0, Math.ceil((Math.min(bucketEnd, now) - bucketStart) / HOUR_MS));
    const sufficientlyCovered = expectedHours > 0
      && bucketEntries.length >= Math.ceil(expectedHours * FUNDING_BUCKET_MIN_COVERAGE);
    return {
      timestamp: bucketStart,
      label: `Q${index + 1}`,
      amount: sufficientlyCovered ? bucketEntries.reduce((sum, entry) => sum + entry.deltaPledge, 0) : null,
    };
  });
}

/** Adds chart headroom while keeping positive-only funding totals grounded at zero. */
export function getFundingTimelineScale(values: readonly number[]): { min: number; max: number } {
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(0, ...values);
  const padding = Math.max(1, (maxValue - minValue) * .12);
  return {
    min: minValue < 0 ? minValue - padding : 0,
    max: maxValue + padding,
  };
}

/** Generates a Google Visualization query for a bounded, recent history window. */
export function buildFundingHistoryQueryUrl(now = Date.now()): string {
  const since = new Date(now - FUNDING_HISTORY_RETENTION_MS).toISOString().slice(0, 10);
  const query = `select A, B, C, D, E where A >= datetime '${since} 00:00:00' order by A`;
  const url = new URL(`https://docs.google.com/spreadsheets/d/${FUNDING_SHEET_ID}/gviz/tq`);
  url.searchParams.set('gid', FUNDING_SHEET_GID);
  url.searchParams.set('tqx', 'out:csv');
  url.searchParams.set('tq', query);
  return url.toString();
}

/** Queries only the newest available snapshot, with a changing UTC bound to avoid stale URL caches. */
export function buildFundingLatestQueryUrl(now = Date.now()): string {
  const asOf = new Date(now).toISOString().slice(0, 19).replace('T', ' ');
  const query = `select A, B, C, D, E where A <= datetime '${asOf}' order by A desc limit 1`;
  const url = new URL(`https://docs.google.com/spreadsheets/d/${FUNDING_SHEET_ID}/gviz/tq`);
  url.searchParams.set('gid', FUNDING_SHEET_GID);
  url.searchParams.set('tqx', 'out:csv');
  url.searchParams.set('tq', query);
  return url.toString();
}

export function buildFundingHistoryExportUrl(): string {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${FUNDING_SHEET_ID}/export`);
  url.searchParams.set('format', 'csv');
  url.searchParams.set('gid', FUNDING_SHEET_GID);
  return url.toString();
}

/** Queries compact annual funding sums without downloading the full hourly sheet. */
export function buildFundingYearlyQueryUrl(now = Date.now()): string {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${FUNDING_SHEET_ID}/gviz/tq`);
  const asOf = new Date(now).toISOString().slice(0, 19).replace('T', ' ');
  url.searchParams.set('gid', FUNDING_SHEET_GID);
  url.searchParams.set('tqx', 'out:csv');
  url.searchParams.set('tq', `select year(A), sum(C) where A <= datetime '${asOf}' group by year(A) order by year(A)`);
  return url.toString();
}

/** Parses the compact two-column year/sum result from the Google Visualization query. */
export function parseFundingYearlyTotalsCsv(csv: string): FundingYearlyTotal[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ''));
  const byYear = new Map<number, number>();
  for (const row of rows.slice(1)) {
    const year = parseSheetInteger(row[0] ?? '', false);
    const amount = parseSheetInteger(row[1] ?? '', true);
    if (year === null || year < 2000 || year > 2200 || amount === null) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + amount);
  }
  return [...byYear].map(([year, amount]) => ({ year, amount }))
    .sort((left, right) => left.year - right.year);
}

function validCachedHistory(value: unknown): FundingHistoryResponse | null {
  if (!value || typeof value !== 'object') return null;
  const cache = value as Partial<FundingHistoryResponse>;
  if (!Array.isArray(cache.entries) || !Number.isFinite(cache.fetchedAt)) return null;
  const entries = cache.entries.filter((entry): entry is FundingHistoryEntry => Boolean(entry)
    && Number.isSafeInteger(entry.timestamp) && Number.isSafeInteger(entry.totalPledge) && entry.totalPledge >= 0
    && Number.isSafeInteger(entry.deltaPledge) && Number.isSafeInteger(entry.totalCitizens) && entry.totalCitizens >= 0
    && Number.isSafeInteger(entry.deltaCitizens));
  return entries.length ? {
    entries,
    fetchedAt: cache.fetchedAt!,
    fullFetchedAt: Number.isFinite(cache.fullFetchedAt) ? cache.fullFetchedAt : cache.fetchedAt!,
    stale: false,
  } : null;
}

function validCachedYearlyTotals(value: unknown): FundingYearlyTotalsResponse | null {
  if (!value || typeof value !== 'object') return null;
  const cache = value as Partial<FundingYearlyTotalsResponse>;
  if (!Array.isArray(cache.totals) || !Number.isFinite(cache.fetchedAt)) return null;
  const totals = cache.totals.filter((point): point is FundingYearlyTotal => Boolean(point)
    && Number.isSafeInteger(point.year) && point.year >= 2000 && point.year <= 2200
    && Number.isSafeInteger(point.amount));
  return totals.length ? { totals, fetchedAt: cache.fetchedAt!, stale: false } : null;
}

function mergeFundingHistory(
  previous: readonly FundingHistoryEntry[],
  incoming: readonly FundingHistoryEntry[],
  now: number,
): FundingHistoryEntry[] {
  const cutoff = now - FUNDING_HISTORY_RETENTION_MS;
  const byTimestamp = new Map<number, FundingHistoryEntry>();
  for (const entry of previous) {
    if (entry.timestamp >= cutoff && entry.timestamp <= now + 5 * 60 * 1000) byTimestamp.set(entry.timestamp, entry);
  }
  for (const entry of incoming) byTimestamp.set(entry.timestamp, entry);
  return [...byTimestamp.values()].sort((left, right) => left.timestamp - right.timestamp);
}

/** Checks the newest row every minute, refreshes full history less often, and preserves last-good data. */
export async function loadFundingHistory(
  storage: FundingHistoryStorage,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<FundingHistoryResponse> {
  let stored: Record<string, unknown> = {};
  try { stored = await storage.get(FUNDING_HISTORY_CACHE_KEY); } catch { /* Fetch the public sheet even if local cache is unavailable. */ }
  const cached = validCachedHistory(stored[FUNDING_HISTORY_CACHE_KEY]);
  const currentTime = now();
  const fullFetchedAt = cached?.fullFetchedAt ?? cached?.fetchedAt ?? Number.NEGATIVE_INFINITY;
  const fullCacheAge = currentTime - fullFetchedAt;
  const latestCheckAge = cached ? currentTime - cached.fetchedAt : Number.POSITIVE_INFINITY;
  const hasUsableCachedHistory = Boolean(cached && calculate24HourHistoryChanges(cached.entries, currentTime));
  if (cached && latestCheckAge >= 0 && latestCheckAge < FUNDING_LATEST_CHECK_CACHE_TTL_MS
    && fullCacheAge >= 0 && fullCacheAge < FUNDING_HISTORY_CACHE_TTL_MS && hasUsableCachedHistory) return cached;
  let lastError: unknown;
  const requestAndParse = async (url: string): Promise<FundingHistoryEntry[]> => {
    const response = await fetcher(url, {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(FUNDING_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Funding history request failed (${response.status})`);
    const csv = await response.text();
    if (csv.length > MAX_FUNDING_CSV_CHARS) throw new Error('Funding history response is unexpectedly large');
    return parseFundingHistoryCsv(csv)
      .filter(entry => entry.timestamp >= currentTime - FUNDING_HISTORY_RETENTION_MS && entry.timestamp <= currentTime + 5 * 60 * 1000);
  };

  if (cached && fullCacheAge >= 0 && fullCacheAge < FUNDING_HISTORY_CACHE_TTL_MS && hasUsableCachedHistory) {
    try {
      const latestEntries = await requestAndParse(buildFundingLatestQueryUrl(currentTime));
      if (latestEntries.length !== 1) throw new Error('Latest funding query did not return exactly one valid row');
      const entries = mergeFundingHistory(cached.entries, latestEntries, currentTime);
      if (!calculate24HourHistoryChanges(entries, currentTime)) {
        throw new Error('Latest funding row cannot be matched to the cached 24-hour baseline');
      }
      const result: FundingHistoryResponse = {
        entries,
        fetchedAt: currentTime,
        fullFetchedAt,
        stale: false,
      };
      try { await storage.set({ [FUNDING_HISTORY_CACHE_KEY]: result }); } catch { /* Fresh fetched data remains usable for this page. */ }
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  const urls = [buildFundingHistoryQueryUrl(currentTime), buildFundingHistoryExportUrl()];
  for (const url of urls) {
    try {
      const entries = await requestAndParse(url);
      if (entries.length < 2) throw new Error('Funding history response contained too few valid rows');
      if (!calculate24HourHistoryChanges(entries, currentTime)) {
        throw new Error('Funding history is missing a fresh total and nearby 24-hour baseline');
      }
      const result: FundingHistoryResponse = {
        entries: mergeFundingHistory(cached?.entries ?? [], entries, currentTime),
        fetchedAt: currentTime,
        fullFetchedAt: currentTime,
        stale: false,
      };
      try { await storage.set({ [FUNDING_HISTORY_CACHE_KEY]: result }); } catch { /* Fresh fetched data remains usable for this page. */ }
      return result;
    } catch (error) {
      lastError = error;
    }
  }
  if (cached) return { ...cached, stale: true };
  throw lastError ?? new Error('Funding history is unavailable');
}

/** Fetches/caches compact yearly sums independently, keeping the default live view fast. */
export async function loadFundingYearlyTotals(
  storage: FundingHistoryStorage,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<FundingYearlyTotalsResponse> {
  let stored: Record<string, unknown> = {};
  try { stored = await storage.get(FUNDING_YEARLY_CACHE_KEY); } catch { /* Fetch the public sheet even if local cache is unavailable. */ }
  const cached = validCachedYearlyTotals(stored[FUNDING_YEARLY_CACHE_KEY]);
  const currentTime = now();
  const cacheAge = cached ? currentTime - cached.fetchedAt : Number.POSITIVE_INFINITY;
  if (cached && cacheAge >= 0 && cacheAge < FUNDING_HISTORY_CACHE_TTL_MS) return cached;

  try {
    const response = await fetcher(buildFundingYearlyQueryUrl(currentTime), {
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(FUNDING_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Yearly funding request failed (${response.status})`);
    const csv = await response.text();
    if (csv.length > MAX_FUNDING_CSV_CHARS) throw new Error('Yearly funding response is unexpectedly large');
    const currentYear = new Date(currentTime).getUTCFullYear();
    const totals = parseFundingYearlyTotalsCsv(csv).filter(point => point.year <= currentYear);
    if (!totals.length) throw new Error('Yearly funding response contained no valid totals');
    const result: FundingYearlyTotalsResponse = { totals, fetchedAt: currentTime, stale: false };
    try { await storage.set({ [FUNDING_YEARLY_CACHE_KEY]: result }); } catch { /* Fetched values remain usable for this request. */ }
    return result;
  } catch (error) {
    if (cached) return { ...cached, stale: true };
    throw error;
  }
}

export function formatCitizenDelta(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '−' : '+';
  return `${sign}${Math.abs(rounded).toLocaleString('en-US')}`;
}

/** Formats sheet timestamps in UTC, matching the spreadsheet's Datetime UTC column. */
export function formatFundingTimestamp(timestamp: number): string {
  return `${new Date(timestamp).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
  })} UTC`;
}

/** Makes spreadsheet lag visible instead of treating a successful check as a new snapshot. */
export function formatFundingSnapshotAge(timestamp: number, now = Date.now()): string {
  const elapsedMinutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes}m old`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ${elapsedMinutes % 60}m old`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays}d ${elapsedHours % 24}h old`;
}

/** Formats the clock portion of a sheet timestamp in UTC. */
export function formatFundingClockTime(timestamp: number): string {
  return `${new Date(timestamp).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC',
  })} UTC`;
}
