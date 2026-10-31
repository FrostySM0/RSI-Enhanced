export const HANGAR_FAVORITES_KEY = 'rsiEnhanced.hangarFavorites';

export interface HangarFavorite {
  id: string;
  page: number;
  type: string | null;
  title: string;
  subtitle: string;
  imageUrl: string | null;
}

function safeImage(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function normalizeHangarFavorites(value: unknown): HangarFavorite[] {
  if (!Array.isArray(value)) return [];
  const items = new Map<string, HangarFavorite>();
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const item = entry as Partial<HangarFavorite>;
    if (typeof item.id !== 'string' || !/^\d{1,12}$/.test(item.id) || !Number.isSafeInteger(item.page) || (item.page as number) < 1 || (item.page as number) > 10000) continue;
    if (typeof item.title !== 'string' || !item.title.trim()) continue;
    const type = item.type === null ? null : typeof item.type === 'string' && /^[a-z0-9_-]{1,40}$/i.test(item.type) ? item.type : null;
    if (item.type !== null && type === null) continue;
    items.set(item.id, {
      id: item.id,
      page: item.page as number,
      type,
      title: item.title.trim().slice(0, 240),
      subtitle: typeof item.subtitle === 'string' ? item.subtitle.trim().slice(0, 240) : '',
      imageUrl: safeImage(item.imageUrl),
    });
    if (items.size >= 150) break;
  }
  return [...items.values()];
}
