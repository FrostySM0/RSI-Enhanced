export const SAVED_THREADS_KEY = 'rsiEnhanced.savedThreads';
const MAX_SAVED_THREADS = 500;
const MAX_TITLE_LENGTH = 240;
const THREAD_PATH = /^\/spectrum\/community\/SC\/forum\/[^/]+\/thread\/[^/]+(?:\/\d+)?\/?$/i;
type SavedThreadsLockManager = Pick<LockManager, 'request'>;
let localWriteQueue: Promise<void> = Promise.resolve();

export interface SavedThread {
  url: string;
  title: string;
  savedAt: number;
}

export function normalizeThreadUrl(value: unknown, baseUrl: string): string | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const base = new URL(baseUrl);
    const url = new URL(value, base);
    if (url.origin !== base.origin || url.username || url.password || !THREAD_PATH.test(url.pathname)) return null;
    url.search = '';
    url.hash = '';
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  // Spectrum can render its notification choices inside the subject container.
  // Older extension builds read textContent and accidentally persisted those labels.
  const notificationOptions = /(?:disabled)?\s*(?:you will not receive (?:any\s+)?notifications|you will receive (?:all\s+)?(?:activity\s+)?notifications?|notifications?\s+(?:are\s+)?(?:enabled|disabled|on|off)|only my replies|watch all)[\s\S]*$/i;
  const marker = notificationOptions.exec(normalized)?.index;
  const title = (marker === undefined ? normalized : normalized.slice(0, marker)).trim().slice(0, MAX_TITLE_LENGTH);
  return title || null;
}

export function normalizeSavedThreads(value: unknown, baseUrl: string): SavedThread[] {
  if (!Array.isArray(value)) return [];
  const result: SavedThread[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    const url = normalizeThreadUrl(item.url, baseUrl);
    const title = cleanTitle(item.title);
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    result.push({
      url,
      title,
      savedAt: typeof item.savedAt === 'number' && Number.isFinite(item.savedAt) && item.savedAt >= 0 ? item.savedAt : 0,
    });
    if (result.length === MAX_SAVED_THREADS) break;
  }
  return result;
}

export function toggleSavedThread(items: unknown, candidate: { url: unknown; title: unknown }, baseUrl: string, savedAt = Date.now()): SavedThread[] {
  const current = normalizeSavedThreads(items, baseUrl);
  const url = normalizeThreadUrl(candidate.url, baseUrl);
  const title = cleanTitle(candidate.title);
  if (!url || !title) return current;
  if (current.some(item => item.url === url)) return current.filter(item => item.url !== url);
  return [{ url, title, savedAt: Number.isFinite(savedAt) && savedAt >= 0 ? savedAt : Date.now() }, ...current].slice(0, MAX_SAVED_THREADS);
}

export async function readSavedThreads(baseUrl: string): Promise<SavedThread[]> {
  const stored = await chrome.storage.local.get(SAVED_THREADS_KEY);
  return normalizeSavedThreads(stored[SAVED_THREADS_KEY], baseUrl);
}

export async function writeSavedThreads(items: unknown, baseUrl: string): Promise<SavedThread[]> {
  const normalized = normalizeSavedThreads(items, baseUrl);
  await chrome.storage.local.set({ [SAVED_THREADS_KEY]: normalized });
  return normalized;
}

function serializeLocally<T>(operation: () => Promise<T>): Promise<T> {
  const result = localWriteQueue.then(operation, operation);
  localWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

/**
 * Apply one thread's desired saved state against the latest stored list. Web Locks
 * serialize this read-modify-write across extension tabs; the local queue is a
 * safe fallback for older or restricted execution contexts.
 */
export async function setSavedThreadState(
  candidate: { url: unknown; title: unknown },
  shouldSave: boolean,
  baseUrl: string,
  locks: SavedThreadsLockManager | null = globalThis.navigator?.locks ?? null,
): Promise<SavedThread[]> {
  const url = normalizeThreadUrl(candidate.url, baseUrl);
  const title = cleanTitle(candidate.title);
  if (!url || (shouldSave && !title)) return readSavedThreads(baseUrl);

  const apply = async (): Promise<SavedThread[]> => {
    const current = await readSavedThreads(baseUrl);
    const existing = current.find(item => item.url === url);
    let next: SavedThread[];
    if (shouldSave) {
      if (existing) {
        next = existing.title === title ? current : current.map(item => item.url === url ? { ...item, title: title! } : item);
      } else {
        next = [{ url, title: title!, savedAt: Date.now() }, ...current].slice(0, MAX_SAVED_THREADS);
      }
    } else {
      next = existing ? current.filter(item => item.url !== url) : current;
    }
    if (next !== current) await chrome.storage.local.set({ [SAVED_THREADS_KEY]: next });
    return next;
  };

  if (!locks) return serializeLocally(apply);
  let enteredLock = false;
  try {
    return await locks.request('rsiEnhanced.savedThreads', { mode: 'exclusive' }, () => {
      enteredLock = true;
      return apply();
    });
  } catch (error) {
    if (enteredLock) throw error;
    return serializeLocally(apply);
  }
}
