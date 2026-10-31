import './popup.css';
import { RSI_SECTIONS } from '../shared/site-sections.ts';
import { THEME_NAMES } from '../themes/palettes.ts';
import { FONT_FAMILY_STACKS, normalizeSettings, paletteFor } from '../shared/settings.ts';
import type { Settings } from '../shared/settings.ts';
import { readSettings, saveSettings } from '../shared/storage.ts';
import { startPrivacyGate } from './privacy-gate.ts';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const form = byId<HTMLFormElement>('settings');
const fields = byId<HTMLFieldSetElement>('settings-fields');
const status = byId<HTMLParagraphElement>('status');
const theme = byId<HTMLSelectElement>('theme');
const unit = byId<HTMLSelectElement>('forum-unit');
const width = byId<HTMLInputElement>('forum-width');
const accent = byId<HTMLInputElement>('accent');
const commentPreviewMounts = ['appearance-comment-preview', 'layout-comment-preview']
  .map((id) => byId<HTMLElement>(id));
const commentPreviewTemplate = byId<HTMLTemplateElement>('comment-preview-template');
for (const mount of commentPreviewMounts) mount.replaceChildren(commentPreviewTemplate.content.cloneNode(true));
const MODULE_KEYS = ['theme', 'forums', 'chat', 'messages', 'friends', 'savedThreads', 'notifications', 'blocks'] as const;
let overrideAccent = false;
byId('version').textContent = chrome.runtime.getManifest().version;
for (const [value, name] of Object.entries(THEME_NAMES)) theme.add(new Option(name, value));
for (const [key, name] of Object.entries(RSI_SECTIONS)) {
  const label = document.createElement('label'); label.className = 'toggle';
  const span = document.createElement('span'); span.textContent = name;
  const input = document.createElement('input'); input.type = 'checkbox'; input.id = 'rsi-' + key;
  label.append(span, input); byId('rsi-modules').append(label);
}
const SETTINGS_TABS = [
  ['tab-appearance', 'panel-appearance'],
  ['tab-layout', 'panel-layout'],
  ['tab-modules', 'panel-modules'],
  ['tab-rsi', 'panel-rsi'],
] as const;
function activateTab(index: number, moveFocus = false): void {
  SETTINGS_TABS.forEach(([tabId, panelId], tabIndex) => {
    const selected = tabIndex === index;
    const tab = byId<HTMLButtonElement>(tabId);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    byId<HTMLElement>(panelId).hidden = !selected;
  });
  if (moveFocus) byId<HTMLButtonElement>(SETTINGS_TABS[index][0]).focus();
}
SETTINGS_TABS.forEach(([tabId], index) => {
  const tab = byId<HTMLButtonElement>(tabId);
  tab.addEventListener('click', () => activateTab(index));
  tab.addEventListener('keydown', (event: KeyboardEvent) => {
    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % SETTINGS_TABS.length;
    if (event.key === 'ArrowLeft') next = (index + SETTINGS_TABS.length - 1) % SETTINGS_TABS.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = SETTINGS_TABS.length - 1;
    if (next !== null) {
      event.preventDefault();
      activateTab(next, true);
    }
  });
});
activateTab(0);
function setStatus(text: string, error = false): void {
  status.textContent = text; status.dataset.error = String(error);
}
function widthBounds(): void {
  width.min = unit.value === '%' ? '50' : '800'; width.max = unit.value === '%' ? '100' : '3000';
}
function draft(): Settings {
  return normalizeSettings({
    rsi: Object.fromEntries(Object.keys(RSI_SECTIONS).map(key => [key, byId<HTMLInputElement>('rsi-' + key).checked])),
    theme: theme.value, accent: overrideAccent ? accent.value : null,
    forumUnit: unit.value, forumWidth: width.valueAsNumber,
    density: byId<HTMLSelectElement>('density').value,
    commentLayout: byId<HTMLSelectElement>('comment-layout').value,
    roadmapLandingView: byId<HTMLSelectElement>('roadmap-landing-view').value,
    fontSize: byId<HTMLInputElement>('font-size').valueAsNumber,
    fontFamily: byId<HTMLSelectElement>('font-family').value,
    avatar: byId<HTMLSelectElement>('avatar').value,
    devTextColor: byId<HTMLSelectElement>('dev-text-color').value,
    modules: Object.fromEntries(MODULE_KEYS.map((key) => [key, byId<HTMLInputElement>(`module-${key}`).checked])),
  });
}
function preview(): void {
  const value = draft(); const palette = paletteFor(value);
  byId('preview').dataset.theme = value.theme;
  for (const key of ['surface', 'raised', 'hover', 'text', 'muted', 'accent', 'border'] as const) byId('preview').style.setProperty(`--preview-${key}`, palette[key]);
  if (!overrideAccent) accent.value = palette.accent;
  byId('preview-note').textContent = THEME_NAMES[value.theme];
  const fontLabel = byId<HTMLSelectElement>('font-family').selectedOptions[0]?.textContent ?? 'Site default';
  const layoutLabel = byId<HTMLSelectElement>('comment-layout').selectedOptions[0]?.textContent ?? 'Threaded';
  const fontStack = FONT_FAMILY_STACKS[value.fontFamily] ?? 'Arial, Helvetica, sans-serif';
  for (const mount of commentPreviewMounts) {
    const sample = mount.querySelector<HTMLElement>('.comment-preview');
    if (!sample) continue;
    sample.dataset.theme = value.theme;
    sample.dataset.layout = value.commentLayout;
    sample.style.fontFamily = fontStack;
    sample.style.fontSize = `${value.fontSize}px`;
    for (const key of ['surface', 'raised', 'hover', 'text', 'muted', 'accent', 'border'] as const) sample.style.setProperty(`--preview-${key}`, palette[key]);
    const choice = sample.querySelector<HTMLElement>('.comment-preview-choice');
    if (choice) choice.textContent = `${fontLabel} · ${layoutLabel}`;
  }
}
function render(value: Settings): void {
  theme.value = value.theme; overrideAccent = value.accent !== null;
  accent.value = value.accent ?? paletteFor(value).accent;
  unit.value = value.forumUnit; width.value = String(value.forumWidth); widthBounds();
  byId<HTMLSelectElement>('density').value = value.density;
  byId<HTMLSelectElement>('comment-layout').value = value.commentLayout;
  byId<HTMLSelectElement>('roadmap-landing-view').value = value.roadmapLandingView;
  byId<HTMLInputElement>('font-size').value = String(value.fontSize);
  byId<HTMLSelectElement>('font-family').value = value.fontFamily;
  byId<HTMLSelectElement>('avatar').value = value.avatar;
  byId<HTMLSelectElement>('dev-text-color').value = value.devTextColor;
  for (const key of MODULE_KEYS) byId<HTMLInputElement>(`module-${key}`).checked = value.modules[key];
  for (const key of Object.keys(RSI_SECTIONS) as (keyof typeof RSI_SECTIONS)[]) byId<HTMLInputElement>('rsi-' + key).checked = value.rsi[key];
  preview();
}
async function load(): Promise<void> {
  fields.disabled = true; byId('retry').hidden = true; setStatus('Loading preferences…');
  try {
    render(await readSettings()); fields.disabled = false;
    setStatus('Ready. Save to update open RSI tabs.');
  } catch {
    setStatus('Could not load preferences. Retry before editing.', true); byId('retry').hidden = false;
  }
}
async function persist(value: Settings, message: string): Promise<void> {
  fields.disabled = true; setStatus('Saving…');
  try { render(await saveSettings(value)); setStatus(message); }
  catch { setStatus('Could not save. Your changes are still here; please retry.', true); }
  finally { fields.disabled = false; }
}
form.addEventListener('input', (event) => {
  if (event.target === accent) overrideAccent = true;
  preview(); setStatus('Unsaved changes');
});
unit.addEventListener('change', () => { widthBounds(); width.value = unit.value === '%' ? '100' : '1200'; preview(); });
theme.addEventListener('change', preview);
byId('theme-accent').addEventListener('click', () => { overrideAccent = false; preview(); setStatus('Unsaved changes'); });
form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (fields.disabled) return;
  const invalidInput = [width, byId<HTMLInputElement>('font-size')].find((input) => !input.checkValidity());
  if (invalidInput) {
    activateTab(1, true);
    invalidInput.reportValidity();
    return;
  }
  if (form.reportValidity()) void persist(draft(), 'Saved. Open RSI tabs updated.');
});
byId('reset').addEventListener('click', () => { if (!fields.disabled) void persist(normalizeSettings(), 'Defaults restored. Open RSI tabs updated.'); });
byId('retry').addEventListener('click', () => { void load(); });
startPrivacyGate({
  disclosure: byId('privacy-gate'),
  settingsArea: byId('settings-area'),
  fields,
  agree: byId<HTMLButtonElement>('privacy-agree'),
  notNow: byId<HTMLButtonElement>('privacy-not-now'),
  status: byId('privacy-status'),
}, chrome.storage.local, chrome.storage.onChanged, () => { void load(); });
