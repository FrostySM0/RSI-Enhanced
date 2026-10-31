import { PALETTES, THEME_NAMES } from '../themes/palettes.ts';
import type { Palette, ThemeId } from '../themes/palettes.ts';
import { RSI_SECTIONS } from './site-sections.ts';
import type { RsiSection } from './site-sections.ts';

export interface Settings {
  version: 1;
  theme: ThemeId;
  accent: string | null;
  forumWidth: number;
  forumUnit: '%' | 'px';
  density: 'compact' | 'balanced' | 'comfortable';
  commentLayout: 'threaded' | 'compact' | 'flat' | 'cards' | 'bubbles' | 'conversation';
  roadmapLandingView: 'release-view' | 'progress-tracker';
  fontSize: number;
  fontFamily: FontFamily;
  avatar: 'circle' | 'rounded' | 'square';
  devTextColor: 'gold' | 'white' | 'off-white';
  modules: { theme: boolean; forums: boolean; chat: boolean; messages: boolean; friends: boolean; savedThreads: boolean; notifications: boolean; blocks: boolean };
  rsi: Record<RsiSection, boolean>;
}

export const FONT_FAMILY_STACKS = {
  default: null,
  arial: 'Arial, Helvetica, sans-serif',
  'segoe-ui': '"Segoe UI", Tahoma, sans-serif',
  verdana: 'Verdana, Geneva, sans-serif',
  tahoma: 'Tahoma, Verdana, sans-serif',
  'trebuchet-ms': '"Trebuchet MS", Arial, sans-serif',
  'system-ui': 'system-ui, -apple-system, "Segoe UI", sans-serif',
  'comic-sans': '"Comic Sans MS", "Comic Sans", "Segoe UI", sans-serif',
} as const;
export type FontFamily = keyof typeof FONT_FAMILY_STACKS;

export const STORAGE_KEY = 'rsiEnhanced.settings';
export const DEFAULT_SETTINGS: Settings = {
  version: 1, theme: 'enhanced', accent: null,
  forumWidth: 100, forumUnit: '%', density: 'balanced', commentLayout: 'threaded', roadmapLandingView: 'release-view', fontSize: 15, fontFamily: 'default', avatar: 'circle',
  devTextColor: 'gold',
  modules: { theme: true, forums: true, chat: true, messages: true, friends: true, savedThreads: true, notifications: true, blocks: true },
  rsi: { store: true, matrix: true, organizations: true, commlink: true, account: true, hangar: true, roadmap: true, funding: true, devtracker: true },
};
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const number = (v: unknown, fallback: number, min: number, max: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
function option<T extends string>(v: unknown, choices: readonly T[], fallback: T): T {
  return typeof v === 'string' && choices.includes(v as T) ? v as T : fallback;
}

export function normalizeSettings(input?: unknown): Settings {
  const value = record(input);
  const modules = record(value.modules);
  const rsi = record(value.rsi);
  const forumUnit = option(value.forumUnit, ['%', 'px'], '%');
  return {
    version: 1,
    rsi: Object.fromEntries(Object.keys(RSI_SECTIONS).map(key => [key, typeof rsi[key] === 'boolean' ? rsi[key] : true])) as Record<RsiSection, boolean>,
    theme: option(value.theme, Object.keys(THEME_NAMES) as ThemeId[], 'enhanced'),
    accent: typeof value.accent === 'string' && /^#[0-9a-f]{6}$/i.test(value.accent) ? value.accent.toLowerCase() : null,
    forumUnit,
    forumWidth: number(value.forumWidth, forumUnit === '%' ? 100 : 1200, forumUnit === '%' ? 50 : 800, forumUnit === '%' ? 100 : 3000),
    density: option(value.density, ['compact', 'balanced', 'comfortable'], 'balanced'),
    commentLayout: option(value.commentLayout, ['threaded', 'compact', 'flat', 'cards', 'bubbles', 'conversation'], 'threaded'),
    roadmapLandingView: option(value.roadmapLandingView, ['release-view', 'progress-tracker'], 'release-view'),
    fontSize: number(value.fontSize, 15, 13, 20),
    fontFamily: option(value.fontFamily, Object.keys(FONT_FAMILY_STACKS) as FontFamily[], 'default'),
    avatar: option(value.avatar, ['circle', 'rounded', 'square'], 'circle'),
    devTextColor: option(value.devTextColor, ['gold', 'white', 'off-white'], 'gold'),
    modules: {
      theme: typeof modules.theme === 'boolean' ? modules.theme : true,
      forums: typeof modules.forums === 'boolean' ? modules.forums : true,
      chat: typeof modules.chat === 'boolean' ? modules.chat : true,
      messages: typeof modules.messages === 'boolean' ? modules.messages : true,
      friends: typeof modules.friends === 'boolean' ? modules.friends : true,
      savedThreads: typeof modules.savedThreads === 'boolean' ? modules.savedThreads : true,
      notifications: typeof modules.notifications === 'boolean' ? modules.notifications : true,
      blocks: typeof modules.blocks === 'boolean' ? modules.blocks : true,
    },
  };
}

export function paletteFor(settings: Settings): Palette {
  const palette = PALETTES[settings.theme];
  return { ...palette, accent: settings.accent ?? palette.accent };
}
