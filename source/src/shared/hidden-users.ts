export interface HiddenUser { handle: string; name: string; }
export const HIDDEN_USER_PREFIX = 'rsiEnhanced.hiddenUser.';
const INITIALIZED = 'rsiEnhanced.hiddenUsers.initialized';

export function normalizeHandle(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const handle = value.trim().replace(/^@/, '').toLowerCase();
  return /^[a-z0-9_.-]{1,64}$/.test(handle) ? handle : null;
}
export function hiddenUsersFromStorage(value: Record<string, unknown>): HiddenUser[] {
  return Object.entries(value).flatMap(([key, raw]) => {
    if (!key.startsWith(HIDDEN_USER_PREFIX) || !raw || typeof raw !== 'object') return [];
    const user = raw as Partial<HiddenUser>, handle = normalizeHandle(user.handle);
    return handle && key === HIDDEN_USER_PREFIX + handle ? [{handle, name: typeof user.name === 'string' && user.name.trim() ? user.name.trim().slice(0,100) : handle}] : [];
  });
}
export async function readHiddenUsers(): Promise<HiddenUser[]> {
  return hiddenUsersFromStorage(await chrome.storage.local.get(null));
}
export async function setUserHidden(handle: string, name: string, hidden: boolean): Promise<void> {
  const normalized = normalizeHandle(handle);
  if (!normalized) throw new Error('Invalid user handle');
  // Separate per-handle keys avoid concurrent tabs overwriting other users.
  await chrome.storage.local.set({ [HIDDEN_USER_PREFIX + normalized]: hidden ? {handle:normalized,name} : null });
}
export async function initializeHiddenUsers(): Promise<void> {
  const key = HIDDEN_USER_PREFIX + 'j3pt';
  const saved = await chrome.storage.local.get([INITIALIZED, key]);
  if (saved[INITIALIZED]) return;
  // One-time user-requested preset. A restored user is never added again.
  await chrome.storage.local.set({ [INITIALIZED]: true, ...(saved[key] === undefined ? {[key]:{handle:'j3pt',name:'J3PT'}} : {}) });
}
