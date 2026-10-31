import { COLOR_KEYS } from '../themes/palettes.ts';
import { FONT_FAMILY_STACKS, paletteFor } from '../shared/settings.ts';
import type { Settings } from '../shared/settings.ts';

export function applyAvatarShape(settings: Pick<Settings, 'avatar'>, root: HTMLElement): void {
  root.style.setProperty('--rsi-avatar-radius', { circle: '50%', rounded: '8px', square: '0px' }[settings.avatar]);
  root.dataset.rsiAvatar = settings.avatar;
}

export function applySettings(settings: Settings, root: HTMLElement): void {
  const palette = paletteFor(settings);
  root.setAttribute('data-rsi-preset', settings.theme);
  root.setAttribute('data-rsi-dev-text-color', settings.devTextColor);
  for (const [key, enabled] of Object.entries(settings.rsi)) root.setAttribute(`data-rsi-${key}`, enabled ? 'on' : 'off');
  for (const key of COLOR_KEYS) root.style.setProperty(`--rsi-${key}`, palette[key]);
  root.style.setProperty('--rsi-forum-width', `${settings.forumWidth}${settings.forumUnit}`);
  root.style.setProperty('--rsi-font-size', `${settings.fontSize}px`);
  const fontFamily = FONT_FAMILY_STACKS[settings.fontFamily];
  if (fontFamily) root.style.setProperty('--rsi-selected-font-family', fontFamily);
  else if (typeof root.style.removeProperty === 'function') root.style.removeProperty('--rsi-selected-font-family');
  else root.style.setProperty('--rsi-selected-font-family', '');
  applyAvatarShape(settings, root);
  root.dataset.rsiDensity = settings.density;
  root.dataset.rsiCommentLayout = settings.commentLayout;
  for (const key of ['theme', 'forums', 'chat', 'messages', 'friends', 'savedThreads', 'notifications', 'blocks'] as const) {
    root.setAttribute(`data-rsi-${key === 'savedThreads' ? 'saved-threads' : key}`, settings.modules[key] ? 'on' : 'off');
  }
}
