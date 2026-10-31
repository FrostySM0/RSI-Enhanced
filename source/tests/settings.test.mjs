import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';
import { DEFAULT_SETTINGS, FONT_FAMILY_STACKS, normalizeSettings, paletteFor } from '../src/shared/settings.ts';
import { COLOR_KEYS, PALETTES, THEME_NAMES } from '../src/themes/palettes.ts';
import { applySettings } from '../src/content/apply-settings.ts';

test('removed-user controls are not duplicated in the popup', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const popupRuntime = await readFile('src/popup/index.ts', 'utf8');
  const blocklistRuntime = await readFile('src/content/spectrum-blocks.ts', 'utf8');
  assert.doesNotMatch(popup, /Removed Spectrum users|hidden-users|block-j3pt/i);
  assert.doesNotMatch(popupRuntime, /hidden-users|block-j3pt|readHiddenUsers|setUserHidden|initializeHiddenUsers/i);
  assert.match(blocklistRuntime, /rsi-remove-posts-toggle/);
  assert.match(blocklistRuntime, /rsi-j3pt-block/);
});

test('Chris Roberts selection persists through normalization and clears when switching presets', () => {
  const attributes = new Map();
  const root = { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attributes.set(key, value) };
  const settings = normalizeSettings(JSON.parse(JSON.stringify({ theme: 'chrisRoberts' })));
  assert.equal(settings.theme, 'chrisRoberts');
  applySettings(settings, root);
  assert.equal(attributes.get('data-rsi-preset'), 'chrisRoberts');
  applySettings(normalizeSettings({ theme: 'oled' }), root);
  assert.equal(attributes.get('data-rsi-preset'), 'oled');
});

test('Roadmap module preference applies its independent root guard', () => {
  const attributes = new Map();
  const root = { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attributes.set(key, value) };
  applySettings(normalizeSettings({ rsi: { roadmap: false } }), root);
  assert.equal(attributes.get('data-rsi-roadmap'), 'off');
  applySettings(normalizeSettings({ rsi: { roadmap: true } }), root);
  assert.equal(attributes.get('data-rsi-roadmap'), 'on');
});

test('Roadmap landing preference defaults to Release View and validates saved choices', () => {
  assert.equal(DEFAULT_SETTINGS.roadmapLandingView, 'release-view');
  assert.equal(normalizeSettings().roadmapLandingView, 'release-view');
  assert.equal(normalizeSettings({ roadmapLandingView: 'progress-tracker' }).roadmapLandingView, 'progress-tracker');
  assert.equal(normalizeSettings({ roadmapLandingView: 'unknown' }).roadmapLandingView, 'release-view');
});

test('legacy Roadmap update preferences are ignored while Roadmap appearance remains configurable', () => {
  const settings = normalizeSettings({ roadmapTools: false, rsi: { roadmap: true } });
  assert.equal('roadmapTools' in settings, false);
  const attributes = new Map();
  const root = { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attributes.set(key, value) };
  applySettings(settings, root);
  assert.equal(attributes.get('data-rsi-roadmap'), 'on');
  applySettings(normalizeSettings({ roadmapTools: true, rsi: { roadmap: false } }), root);
  assert.equal(attributes.get('data-rsi-roadmap'), 'off');
  assert.equal(attributes.has('data-rsi-roadmap-tools'), false);
});

test('defaults preserve approved desktop appearance and return independent objects', () => {
  const a = normalizeSettings();
  assert.equal(a.theme, 'enhanced');
  assert.equal(a.forumWidth, 100);
  assert.equal(a.forumUnit, '%');
  assert.equal(a.avatar, 'circle');
  assert.equal(a.fontSize, 15);
  assert.equal(a.commentLayout, 'threaded');
  assert.equal(a.rsi.roadmap, true);
  assert.equal(normalizeSettings({ rsi: { roadmap: false } }).rsi.roadmap, false);
  a.modules.chat = false;
  assert.equal(normalizeSettings().modules.chat, true);
});

test('comment layout accepts all six saved modes and applies the choice to the root', () => {
  for (const layout of ['threaded', 'compact', 'flat', 'cards', 'bubbles', 'conversation']) {
    const settings = normalizeSettings({ commentLayout: layout });
    assert.equal(settings.commentLayout, layout);
    const attributes = new Map();
    const root = { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attributes.set(key, value) };
    applySettings(settings, root);
    assert.equal(root.dataset.rsiCommentLayout, layout);
  }
  assert.equal(normalizeSettings({ commentLayout: 'chat' }).commentLayout, 'threaded');
});

test('comment layout preference is saved and restored by the popup', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const popupRuntime = await readFile('src/popup/index.ts', 'utf8');
  assert.match(popup, /<label for="comment-layout">Comment layout<\/label>[\s\S]*?<select id="comment-layout">[\s\S]*?value="threaded"[\s\S]*?value="compact"[\s\S]*?value="flat"[\s\S]*?value="cards"[\s\S]*?value="bubbles"[\s\S]*?value="conversation"/);
  assert.match(popupRuntime, /commentLayout:\s*byId<HTMLSelectElement>\('comment-layout'\)\.value/);
  assert.match(popupRuntime, /byId<HTMLSelectElement>\('comment-layout'\)\.value\s*=\s*value\.commentLayout/);
});

test('Roadmap landing preference is offered in the RSI website settings panel', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const runtime = await readFile('src/popup/index.ts', 'utf8');
  assert.match(popup, /<label for="roadmap-landing-view">Roadmap opens to<\/label>[\s\S]*?<select id="roadmap-landing-view">[\s\S]*?value="release-view"[\s\S]*?value="progress-tracker"/);
  assert.match(runtime, /roadmapLandingView:\s*byId<HTMLSelectElement>\('roadmap-landing-view'\)\.value/);
  assert.match(runtime, /byId<HTMLSelectElement>\('roadmap-landing-view'\)\.value\s*=\s*value\.roadmapLandingView/);
});

test('six comment layouts use theme variables and preserve the native threaded default', async () => {
  const css = await readFile('src/styles/spectrum-forums.css', 'utf8');
  for (const layout of ['compact', 'flat', 'cards', 'bubbles', 'conversation']) assert.match(css, new RegExp(`data-rsi-comment-layout="${layout}"`));
  assert.match(css, /var\(--rsi-(?:surface|raised|border)\)/);
  assert.match(css, /#react #page\.forum-thread \.forum-thread-replies > \.forum-thread-item\.type-forum_thread_reply/);
  assert.match(css, /#react #page\.forum-thread \.forum-thread-item\.rsi-conversation-target\.rsi-conversation-nested-target/,
    'Extend conversation keeps the linked reply ancestry cue in every layout');
  const stream = css.match(/\/\* Conversation stream[\s\S]*?\/\* Extend conversation[\s\S]*?\n\}/)?.[0];
  assert.ok(stream, 'Conversation stream styles must exist');
  assert.doesNotMatch(stream, /\.rsi-conversation-context|\.rsi-conversation-card/,
    'native reply layout rules must not flatten the separate Extend conversation panel');
});

test('conversation stream parent labels are text-only, idempotent and scoped to forum replies', async () => {
  const runtime = await readFile('src/content/spectrum-reply-context.ts', 'utf8');
  const entry = await readFile('src/content/index.ts', 'utf8');
  assert.match(runtime, /\.forum-thread-item-children-replies/);
  assert.match(runtime, /\.member-handle/);
  assert.match(runtime, /textContent\s*=/);
  assert.match(runtime, /rsi-reply-context/);
  assert.match(runtime, /\.remove\(\)/);
  assert.match(entry, /installReplyContexts/);
  assert.match(entry, /settings\.commentLayout\s*===\s*'conversation'/);
});

test('saved forum threads default on and apply an independent module attribute', () => {
  assert.equal(DEFAULT_SETTINGS.modules.savedThreads, true);
  assert.equal(normalizeSettings({ modules: { savedThreads: false } }).modules.savedThreads, false);
  assert.equal(normalizeSettings({ modules: { savedThreads: 'false' } }).modules.savedThreads, true);
  const attributes = new Map();
  const root = { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attributes.set(key, value) };
  applySettings(normalizeSettings({ modules: { savedThreads: false } }), root);
  assert.equal(attributes.get('data-rsi-saved-threads'), 'off');
  applySettings(normalizeSettings({ modules: { savedThreads: true } }), root);
  assert.equal(attributes.get('data-rsi-saved-threads'), 'on');
});

test('notification filters and enhanced blocks have independent settings and root guards', () => {
  const defaults = DEFAULT_SETTINGS.modules;
  assert.equal(defaults.notifications, true);
  assert.equal(defaults.blocks, true);
  assert.equal(normalizeSettings({ modules: { notifications: false, blocks: false } }).modules.notifications, false);
  assert.equal(normalizeSettings({ modules: { notifications: false, blocks: false } }).modules.blocks, false);
  const attributes = new Map();
  const root = { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attributes.set(key, value) };
  applySettings(normalizeSettings({ modules: { notifications: false, blocks: false } }), root);
  assert.equal(attributes.get('data-rsi-notifications'), 'off');
  assert.equal(attributes.get('data-rsi-blocks'), 'off');
});

test('Messages and Friends panels default on and have independent settings and root guards', async () => {
  assert.equal(DEFAULT_SETTINGS.modules.messages, true);
  assert.equal(DEFAULT_SETTINGS.modules.friends, true);
  const settings = normalizeSettings({ modules: { theme: false, chat: false, messages: false, friends: false } });
  assert.equal(settings.modules.messages, false);
  assert.equal(settings.modules.friends, false);
  assert.equal(settings.modules.theme, false);
  assert.equal(settings.modules.chat, false);
  assert.equal(normalizeSettings({ modules: {} }).modules.messages, true);
  assert.equal(normalizeSettings({ modules: {} }).modules.friends, true);

  const attributes = new Map();
  const root = { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attributes.set(key, value) };
  applySettings(settings, root);
  assert.equal(attributes.get('data-rsi-messages'), 'off');
  assert.equal(attributes.get('data-rsi-friends'), 'off');
  assert.equal(attributes.get('data-rsi-theme'), 'off');
  assert.equal(attributes.get('data-rsi-chat'), 'off');
  const independent = normalizeSettings({ modules: { theme: false, chat: false } });
  applySettings(independent, root);
  assert.equal(attributes.get('data-rsi-theme'), 'off');
  assert.equal(attributes.get('data-rsi-chat'), 'off');
  assert.equal(attributes.get('data-rsi-messages'), 'on');
  assert.equal(attributes.get('data-rsi-friends'), 'on');

  const popup = await readFile('src/popup/index.html', 'utf8');
  const runtime = await readFile('src/popup/index.ts', 'utf8');
  const content = await readFile('src/content/index.ts', 'utf8');
  const build = await readFile('scripts/build.mjs', 'utf8');
  assert.match(popup, /id="module-messages"/);
  assert.match(popup, /id="module-friends"/);
  assert.match(popup, /Messages panel styling/);
  assert.match(popup, /Friends panel styling/);
  assert.match(runtime, /'theme', 'forums', 'chat', 'messages', 'friends', 'savedThreads'/);
  assert.match(content, /refreshSpectrumMessagesSummary\(activeSection === 'spectrum' && settings\.modules\.messages\)/);
  assert.match(build, /src\/styles\/spectrum-messages\.css', 'messages'/);
  assert.match(build, /src\/styles\/spectrum-friends\.css', 'friends'/);
});

test('popup exposes independent notification-filter and enhanced-blocks toggles', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const runtime = await readFile('src/popup/index.ts', 'utf8');
  const content = await readFile('src/content/index.ts', 'utf8');
  assert.match(popup, /id="module-notifications"/);
  assert.match(popup, /id="module-blocks"/);
  assert.match(runtime, /'notifications', 'blocks'/);
  assert.match(content, /settings\.modules\.notifications/);
  assert.match(content, /settings\.modules\.blocks/);
});

test('forum quick filters are removed from settings, popup and content packaging', async () => {
  const settings = normalizeSettings({ modules: { quickFilters: true } });
  assert.equal('quickFilters' in settings.modules, false);
  const attributes = new Map();
  const root = { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attributes.set(key, value) };
  applySettings(settings, root);
  assert.equal(attributes.has('data-rsi-forum-quick-filters'), false);

  const popup = await readFile('src/popup/index.html', 'utf8');
  const popupRuntime = await readFile('src/popup/index.ts', 'utf8');
  const content = await readFile('src/content/index.ts', 'utf8');
  const build = await readFile('scripts/build.mjs', 'utf8');
  assert.doesNotMatch(popup, /Forum quick filters|module-quickFilters/);
  assert.doesNotMatch(popupRuntime, /quickFilters/);
  assert.doesNotMatch(content, /quickFilters|installSpectrumQuickFilters/);
  assert.doesNotMatch(build, /spectrum-quick-filters/);
});

test('popup exposes the saved forum threads module toggle', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const popupRuntime = await readFile('src/popup/index.ts', 'utf8');
  assert.match(popup, /id="module-savedThreads"/);
  assert.match(popup, /Saved forum threads/);
  assert.match(popupRuntime, /'savedThreads'/);
});

test('developer text colour defaults to gold and accepts the three supported colours', () => {
  assert.equal(DEFAULT_SETTINGS.devTextColor, 'gold');
  assert.equal(normalizeSettings().devTextColor, 'gold');
  assert.equal(normalizeSettings({ devTextColor: 'white' }).devTextColor, 'white');
  assert.equal(normalizeSettings({ devTextColor: 'off-white' }).devTextColor, 'off-white');
  assert.equal(normalizeSettings({ devTextColor: 'chartreuse' }).devTextColor, 'gold');
});

test('developer text colour is applied as an extension-owned root setting', () => {
  const attributes = new Map();
  const root = { style: { setProperty() {} }, dataset: {}, setAttribute: (key, value) => attributes.set(key, value) };
  applySettings(normalizeSettings({ devTextColor: 'white' }), root);
  assert.equal(attributes.get('data-rsi-dev-text-color'), 'white');
  applySettings(normalizeSettings({ devTextColor: 'off-white' }), root);
  assert.equal(attributes.get('data-rsi-dev-text-color'), 'off-white');
  applySettings(normalizeSettings(), root);
  assert.equal(attributes.get('data-rsi-dev-text-color'), 'gold');
});

test('untrusted stored settings are validated and bounded, with safe fallbacks', () => {
  const value = normalizeSettings({ theme: 'injected', accent: 'url(evil)', fontSize: 999, forumWidth: -2,
    modules: { chat: false, forums: 'false' }, custom: { background: '</style>', accent: '#AABBCC' } });
  assert.equal(value.theme, 'enhanced');
  assert.equal(value.accent, null);
  assert.equal(value.fontSize, 20);
  assert.equal(value.forumWidth, 50);
  assert.equal(value.modules.chat, false);
  assert.equal(value.modules.forums, true);
  assert.equal('custom' in value, false);
  assert.equal(normalizeSettings({ fontSize: NaN, forumWidth: Infinity }).fontSize, 15);
  assert.equal(normalizeSettings(null).forumWidth, 100);
});

test('legacy custom theme falls back to Spectrum Enhanced and retains other valid settings', () => {
  const value = normalizeSettings({ theme: 'custom', accent: '#AABBCC', custom: { surface: '#112233' },
    fontSize: 18, rsi: { roadmap: false } });
  assert.equal(value.theme, 'enhanced');
  assert.equal(value.accent, '#aabbcc');
  assert.equal(value.fontSize, 18);
  assert.equal(value.rsi.roadmap, false);
  assert.equal('custom' in value, false);
});

test('all built-in presets resolve complete safe palettes, with optional accent override', () => {
  assert.equal(Object.keys(PALETTES).length, 16);
  assert.deepEqual(Object.keys(PALETTES).slice(-9), ['drake', 'crusader', 'rsi', 'nebula', 'aurora', 'eclipse', 'xianJade', 'pyroEmber', 'terraFrontier']);
  assert.deepEqual(Object.keys(THEME_NAMES), Object.keys(PALETTES));
  assert.equal('custom' in THEME_NAMES, false);
  for (const theme of Object.keys(PALETTES)) {
    const palette = paletteFor(normalizeSettings({ theme }));
    assert.equal(Object.keys(palette).length, 9);
    for (const value of Object.values(palette)) assert.match(value, /^#[0-9a-f]{6}$/);
  }
  assert.equal(paletteFor(normalizeSettings({ theme: 'oled', accent: '#123456' })).accent, '#123456');
});

test('new theme presets use the preview colours and keep warm highlights separate from custom accent', () => {
  assert.deepEqual(
    Object.fromEntries(['xianJade', 'pyroEmber', 'terraFrontier'].map((id) => [id, THEME_NAMES[id]])),
    { xianJade: 'Xi’an Jade', pyroEmber: 'Pyro Ember', terraFrontier: 'Terra Frontier' },
  );
  assert.deepEqual(COLOR_KEYS, ['background', 'surface', 'raised', 'hover', 'text', 'muted', 'accent', 'border', 'highlight']);
  assert.deepEqual(PALETTES.xianJade, {
    background: '#0b1118', surface: '#121b23', raised: '#1a2930', hover: '#263b3b',
    text: '#e7f0ee', muted: '#aabbb7', accent: '#43d6b0', border: '#34474c', highlight: '#d5b879',
  });
  assert.deepEqual(PALETTES.pyroEmber, {
    background: '#100e0c', surface: '#191614', raised: '#25201c', hover: '#352a22',
    text: '#f3e9de', muted: '#b9aaa0', accent: '#f28a55', border: '#514038', highlight: '#f1bb73',
  });
  assert.deepEqual(PALETTES.terraFrontier, {
    background: '#131712', surface: '#1b211b', raised: '#293127', hover: '#394635',
    text: '#eceee3', muted: '#b6beaa', accent: '#a9c66f', border: '#46513f', highlight: '#d8bd8b',
  });
  const palette = paletteFor(normalizeSettings({ theme: 'xianJade', accent: '#123456' }));
  assert.equal(palette.accent, '#123456');
  assert.equal(palette.highlight, '#d5b879');
  const variables = new Map();
  const root = { style: { setProperty: (key, value) => variables.set(key, value) }, dataset: {}, setAttribute() {} };
  applySettings(normalizeSettings({ theme: 'pyroEmber' }), root);
  assert.equal(variables.get('--rsi-background'), '#100e0c');
  assert.equal(variables.get('--rsi-highlight'), '#f1bb73');
  applySettings(normalizeSettings(), root);
  assert.equal(variables.get('--rsi-highlight'), '#bfa739');
});

test('popup exposes presets and the accent override without the custom palette editor', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const popupRuntime = await readFile('src/popup/index.ts', 'utf8');
  assert.match(popup, /id="accent"/);
  assert.match(popupRuntime, /Object\.entries\(THEME_NAMES\).*theme\.add/);
  assert.doesNotMatch(popup, /custom-colours|Custom palette/i);
  assert.doesNotMatch(popupRuntime, /colour-fields|custom-colours|custom-/i);
});

test('popup exposes the saved developer text colour dropdown', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const popupRuntime = await readFile('src/popup/index.ts', 'utf8');
  assert.match(popup, /<section id="panel-layout"[\s\S]*?<label for="dev-text-color">Developer post text<\/label>[\s\S]*?<select id="dev-text-color"><option value="gold">Gold<\/option><option value="white">White<\/option><option value="off-white">Off-white<\/option>/);
  assert.match(popupRuntime, /devTextColor: byId<HTMLSelectElement>\('dev-text-color'\)\.value/);
  assert.match(popupRuntime, /byId<HTMLSelectElement>\('dev-text-color'\)\.value = value\.devTextColor/);
});

test('settings popup uses stable dimensions and a scrollable settings viewport', async () => {
  const css = await readFile('src/popup/popup.css', 'utf8');
  assert.match(css, /body\s*\{[^}]*width:\s*540px;[^}]*height:\s*600px;/s);
  assert.doesNotMatch(css, /body\s*\{[^}]*width:\s*100vw/);
  assert.match(css, /\.settings-panels\s*\{[^}]*overflow-y:\s*auto;/s);
});

test('pixel width and enum settings survive valid normalization', () => {
  const value = normalizeSettings({ forumUnit: 'px', forumWidth: 1700, density: 'compact', avatar: 'rounded' });
  assert.equal(value.forumWidth, 1700);
  assert.equal(value.forumUnit, 'px');
  assert.equal(value.density, 'compact');
  assert.equal(value.avatar, 'rounded');
});

test('website font validates saved choices and defaults legacy or invalid values to Site default', () => {
  const values = ['default', 'arial', 'segoe-ui', 'verdana', 'tahoma', 'trebuchet-ms', 'system-ui', 'comic-sans'];
  assert.equal(DEFAULT_SETTINGS.fontFamily, 'default');
  assert.equal(normalizeSettings().fontFamily, 'default');
  assert.equal(normalizeSettings({}).fontFamily, 'default');
  assert.equal(normalizeSettings({ fontFamily: 'Comic Sans MS' }).fontFamily, 'default');
  for (const fontFamily of values) assert.equal(normalizeSettings({ fontFamily }).fontFamily, fontFamily);
  assert.deepEqual(Object.keys(FONT_FAMILY_STACKS), values);
  assert.equal(FONT_FAMILY_STACKS['comic-sans'], '"Comic Sans MS", "Comic Sans", "Segoe UI", sans-serif');
});

test('website font applies a shared CSS family and clears it for Site default', () => {
  const properties = new Map();
  const root = {
    style: {
      setProperty: (key, value) => properties.set(key, value),
      removeProperty: key => properties.delete(key),
    },
    dataset: {},
    setAttribute() {},
  };
  for (const [fontFamily, stack] of Object.entries(FONT_FAMILY_STACKS)) {
    if (!stack) continue;
    applySettings(normalizeSettings({ fontFamily }), root);
    assert.equal(properties.get('--rsi-selected-font-family'), stack);
  }
  applySettings(normalizeSettings(), root);
  assert.equal(properties.has('--rsi-selected-font-family'), false);
});

test('font selector is in Appearance settings, starts with Site default, and loads and saves the setting', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const runtime = await readFile('src/popup/index.ts', 'utf8');
  const appearance = popup.match(/<section id="panel-appearance"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(appearance, /<label for="font-family">Website font<\/label>[\s\S]*?<select id="font-family">\s*<option value="default">Site default<\/option>[\s\S]*?<option value="arial">Arial<\/option>[\s\S]*?<option value="segoe-ui">Segoe UI<\/option>[\s\S]*?<option value="verdana">Verdana<\/option>[\s\S]*?<option value="tahoma">Tahoma<\/option>[\s\S]*?<option value="trebuchet-ms">Trebuchet MS<\/option>[\s\S]*?<option value="system-ui">System UI<\/option>[\s\S]*?<option value="comic-sans">Comic Sans<\/option>/);
  assert.match(runtime, /fontFamily:\s*byId<HTMLSelectElement>\('font-family'\)\.value/);
  assert.match(runtime, /byId<HTMLSelectElement>\('font-family'\)\.value\s*=\s*value\.fontFamily/);
});

test('settings preview updates the selected font and all six comment layouts beside their controls', async () => {
  const popup = await readFile('src/popup/index.html', 'utf8');
  const runtime = await readFile('src/popup/index.ts', 'utf8');
  const css = await readFile('src/popup/popup.css', 'utf8');
  const appearance = popup.match(/<section id="panel-appearance"[\s\S]*?<\/section>/)?.[0] ?? '';
  const layout = popup.match(/<section id="panel-layout"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(appearance, /id="appearance-comment-preview"/);
  assert.match(layout, /id="layout-comment-preview"/);
  assert.match(popup, /<template id="comment-preview-template">[\s\S]*?sample-comment--reply[\s\S]*?<\/template>/);
  assert.match(runtime, /commentPreviewMounts[\s\S]*?sample\.dataset\.layout\s*=\s*value\.commentLayout/);
  assert.match(runtime, /sample\.style\.fontFamily\s*=/);
  for (const value of ['threaded', 'compact', 'flat', 'cards', 'bubbles', 'conversation']) {
    assert.match(css, new RegExp(`\\.comment-preview\\[data-layout="${value}"\\]`), `${value} preview styling is missing`);
  }
});

test('Spectrum and RSI font declarations use the shared selection with their current families as fallback, except fixed icon glyphs', async () => {
  const spectrumFiles = [
    ...(await readdir('src/themes')).filter(file => file.endsWith('.css')).map(file => `src/themes/${file}`),
    ...(await readdir('src/styles')).filter(file => file.endsWith('.css')).map(file => `src/styles/${file}`),
  ];
  const rsiFiles = (await readdir('src/styles/rsi')).filter(file => file.endsWith('.css')).map(file => `src/styles/rsi/${file}`);
  const tokens = await readFile('src/themes/tokens.css', 'utf8');
  const fontFiles = [...spectrumFiles.filter(path => path !== 'src/themes/tokens.css'), ...rsiFiles];
  const styleSources = await Promise.all(fontFiles.map(path => readFile(path, 'utf8')));
  assert.match(tokens, /--rsi-font:\s*var\(--rsi-selected-font-family,\s*system-ui,\s*-apple-system,\s*"Segoe UI",\s*sans-serif\)/);
  const forums = styleSources[fontFiles.indexOf('src/styles/spectrum-forums.css')];
  const chat = styleSources[fontFiles.indexOf('src/styles/spectrum-chat.css')];
  const funding = styleSources[fontFiles.indexOf('src/styles/rsi/funding.css')];
  const roadmap = styleSources[fontFiles.indexOf('src/styles/rsi/roadmap.css')];
  assert.match(forums, /--rsi-forum-font:\s*var\(--rsi-selected-font-family,\s*Arial,\s*Helvetica,\s*sans-serif\)/);
  assert.match(chat, /--rsi-chat-font:\s*var\(--rsi-selected-font-family,\s*Arial,\s*Helvetica,\s*sans-serif\)/);
  const dollarGlyph = funding.match(/\.wrapper:has\(> h1\.page-title\):has\(> \.column\.numbers\):has\(> \.column\.timeline\) > \.page-title::before\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(dollarGlyph, /content:\s*"\$"/);
  assert.match(dollarGlyph, /font:\s*700 28px\/1 Arial, Helvetica, sans-serif/,
    'the large Funding dollar glyph keeps its fixed font and size regardless of the selected website font');
  const roadmapSearchGlyph = roadmap.match(/:scope article\[class\*="Board__Wrapper-"\] \.rsi-roadmap-search-input-wrap::before\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(roadmapSearchGlyph, /content:\s*"⌕"/);
  assert.match(roadmapSearchGlyph, /font:\s*22px\/1 Arial, sans-serif/,
    'the Roadmap search glyph keeps its fixed icon font and size regardless of the selected website font');
  for (const [index, css] of styleSources.entries()) {
    for (const match of css.matchAll(/(?:^|[;{])\s*(?:font-family|font)\s*:\s*([^;{}]*)/g)) {
      if (/\bArial\b|\bsystem-ui\b/i.test(match[1])) {
        const isFundingDollarGlyph = fontFiles[index] === 'src/styles/rsi/funding.css' && match[1].trim() === '700 28px/1 Arial, Helvetica, sans-serif';
        const isRoadmapSearchGlyph = fontFiles[index] === 'src/styles/rsi/roadmap.css' && match[1].trim() === '22px/1 Arial, sans-serif';
        if (isFundingDollarGlyph || isRoadmapSearchGlyph) continue;
        assert.match(match[1], /var\(--rsi-selected-font-family,/,
          `${fontFiles[index]} must route ${match[1].trim()} through the shared choice`);
      }
    }
  }
});

test('notification fonts use the shared selection without depending on the chat module', async () => {
  const css = await readFile('src/styles/spectrum-notifications.css', 'utf8');
  assert.doesNotMatch(css, /var\(--rsi-chat-font\)/);
  assert.match(css, /var\(--rsi-selected-font-family,\s*Arial,\s*Helvetica,\s*sans-serif\)/);
});

test('preset text meets 4.5:1 contrast and visual highlights meet 3:1 on every surface', () => {
  const luminance = (hex) => {
    const rgb = hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
  };
  for (const [name, palette] of Object.entries(PALETTES)) {
    for (const surface of ['background', 'surface', 'raised', 'hover']) {
      for (const foreground of ['text', 'muted', 'accent', 'highlight']) {
        const [a, b] = [luminance(palette[surface]), luminance(palette[foreground])].sort((a, b) => b - a);
        const minimum = foreground === 'highlight' ? 3 : 4.5;
        assert.ok((a + .05) / (b + .05) >= minimum, `${name}: ${foreground} on ${surface}`);
      }
    }
  }
});
