import { normalizeSettings, STORAGE_KEY } from './settings.ts';
import type { Settings } from './settings.ts';

export async function readSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeSettings(stored[STORAGE_KEY]);
}

export async function saveSettings(value: unknown): Promise<Settings> {
  const settings = normalizeSettings(value);
  await chrome.storage.local.set({ [STORAGE_KEY]: settings });
  return settings;
}

// Subscribe before reading so an older in-flight read cannot replace a fresh change.
export async function watchSettings(apply: (settings: Settings) => void): Promise<() => void> {
  let changed = false;
  let stopped = false;
  const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local' || !Object.hasOwn(changes, STORAGE_KEY)) return;
    changed = true;
    if (!stopped) apply(normalizeSettings(changes[STORAGE_KEY].newValue));
  };
  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    chrome.storage.onChanged.removeListener(listener);
  };
  chrome.storage.onChanged.addListener(listener);
  try {
    const settings = await readSettings();
    if (!changed && !stopped) apply(settings);
    return cleanup;
  } catch (error) {
    cleanup();
    if (!changed) throw error;
    return cleanup;
  }
}
