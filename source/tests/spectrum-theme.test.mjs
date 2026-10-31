import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { applySettings } from '../src/content/apply-settings.ts';
import { normalizeSettings } from '../src/shared/settings.ts';

test('theme is packaged and injected only on Spectrum paths', async () => {
  const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
  const themed = manifest.content_scripts.filter((entry) => entry.css?.includes('spectrum.css'));
  assert.equal(themed.length, 1);
  assert.deepEqual(themed[0].matches, ['https://robertsspaceindustries.com/spectrum/*']);
  for (const path of themed[0].css) {
    const css = await readFile(`dist/${path}`, 'utf8');
    assert.ok(css.length > 0);
    assert.doesNotMatch(css, /@import|url\(/i, 'theme must not fetch runtime assets');
  }
});

test('developer text colour follows the saved preference in forum lists, original posts and replies independently of theme styling', async () => {
  const source = await readFile('src/styles/spectrum-dev-text.css', 'utf8');
  const build = await readFile('scripts/build.mjs', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-forums.html', 'utf8');
  assert.match(source, /:root\[data-rsi-dev-text-color="white"\]\s*\{\s*--rsi-dev-post-text:\s*#fff;/);
  assert.match(source, /:root\[data-rsi-dev-text-color="off-white"\]\s*\{\s*--rsi-dev-post-text:\s*#d6d9dd;/);
  assert.match(source, /:root:is\(\[data-rsi-dev-text-color="white"\], \[data-rsi-dev-text-color="off-white"\]\)/);
  assert.match(source, /\.thread-list-screen[\s\S]*?:has\(\.orion-tavern-c-ThreadListItem__role-line\)/);
  assert.match(source, /\.orion-tavern-c-ThreadListItem__last-reply :is\(a, \.displayname, \.nickname\)\s*\{[^}]*color:\s*var\(--rsi-dev-post-text\)/);
  assert.match(source, /\.forum-thread\.discussion \.forum-thread-item:has\(> \.content > \.content-main \.content-header \.member-name > \.displayname:is\(\[style\*="191, 167, 57" i\], \[style\*="191,167,57" i\], \[style\*="#bfa739" i\]\)\)\s*> \.content > \.content-main/);
  assert.match(source, /\.forum-thread-subject,[\s\S]*?\.content-blocks \.content-block\.text :not\(a, a \*\)[\s\S]*?color:\s*var\(--rsi-dev-post-text\) !important/);
  assert.doesNotMatch(source, /\.lobby-message|\.lobby-presence|\.lobby-users/);
  assert.match(build, /src\/styles\/spectrum-dev-text\.css', null/);
  assert.match(packaged, /:scope:is\(\[data-rsi-dev-text-color="white"\], \[data-rsi-dev-text-color="off-white"\]\) #react \.thread-list-screen[\s\S]*?:has\(\.orion-tavern-c-ThreadListItem__role-line\)/);
  assert.match(packaged, /:scope\[data-rsi-dev-text-color="off-white"\]\s*\{\s*--rsi-dev-post-text:\s*#d6d9dd;/);
  assert.match(packaged, /:is\(\[data-rsi-dev-text-color="white"\], \[data-rsi-dev-text-color="off-white"\]\) #react \.thread-list-screen/);
  assert.match(packaged, /\.forum-thread\.discussion \.forum-thread-item:has\(> \.content > \.content-main \.content-header \.member-name > \.displayname:is\(\[style\*="191, 167, 57" i\], \[style\*="191,167,57" i\], \[style\*="#bfa739" i\]\)\)\s*> \.content > \.content-main/);
  assert.match(fixture, /orion-tavern-c-ThreadListItem__role-line/);
  assert.match(fixture, /orion-tavern-c-ThreadListItem__last-reply[\s\S]*?DevReplyAuthor/);
  assert.match(fixture, /forum-thread-member-info[\s\S]*?style="color: rgb\(191, 167, 57\);"[\s\S]*?Fixture Dev[\s\S]*?forum-thread-subject[\s\S]*?Developer post body/);
  assert.match(fixture, /style="color: rgb\(191,167,57\);"[\s\S]*?Second Dev[\s\S]*?Developer reply body/);
  assert.match(fixture, /style="color: rgb\(80, 160, 220\);"[\s\S]*?Regular User[\s\S]*?Regular post body/);
});

test('saved thread controls use a dedicated setting-guarded stylesheet', async () => {
  const source = await readFile('src/styles/spectrum-saved-threads.css', 'utf8').catch(() => '');
  const build = await readFile('scripts/build.mjs', 'utf8');
  assert.match(source, /\.rsi-saved-thread-toggle/);
  assert.match(source, /\.rsi-saved-threads__link/);
  assert.match(build, /spectrum-saved-threads\.css', 'saved-threads'/);
});

test('bubble replies use compact theme-aware message surfaces', async () => {
  const source = await readFile('src/styles/spectrum-forums.css', 'utf8');
  const bubble = source.match(/:scope\[data-rsi-comment-layout="bubbles"\][\s\S]*?\.forum-thread-item\.type-forum_thread_reply > \.content > \.content-main\s*\{([^}]+)\}/);
  assert.ok(bubble, 'Bubble mode must style the native reply content surface');
  assert.match(bubble[1], /width:\s*fit-content/);
  assert.match(bubble[1], /max-width:\s*min\(100%,\s*880px\)/);
  assert.match(bubble[1], /background:\s*var\(--rsi-raised\)/);
});

test('threaded mode styles top-level replies outside the native replies wrapper without flattening nested replies', async () => {
  const source = await readFile('src/styles/spectrum-forums.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const rootReplies = source.match(/:scope\[data-rsi-comment-layout="threaded"\] #react #page\.forum-thread :where\(\.forum-thread-item\.type-forum_thread_reply:not\(\.forum-thread-item-children-replies \.forum-thread-item\)\)\s*\{([^}]+)\}/);
  assert.ok(rootReplies, 'threaded surfaces cover top-level replies even when Spectrum inserts them outside .forum-thread-replies');
  assert.match(rootReplies[1], /padding-inline-start:\s*30px/);
  assert.match(rootReplies[1], /background-color:\s*var\(--rsi-surface\)/);
  assert.match(packaged, /:scope\[data-rsi-comment-layout="threaded"\] #react #page\.forum-thread :where\(\.forum-thread-item\.type-forum_thread_reply:not\(\.forum-thread-item-children-replies \.forum-thread-item\)\)/,
    'the standalone top-level reply styling is present in the packaged Spectrum stylesheet');
  const fixture = await readFile('tests/fixtures/spectrum-forums.html', 'utf8');
  assert.match(fixture, /class="forum-thread-replies"[\s\S]*?<\/div>\s*<div class="forum-thread-item type-forum_thread_reply depth-0" id="late-top-level-reply"/,
    'the fixture includes a late top-level reply outside the native replies wrapper');
  assert.match(source, /#react #page \.forum-thread-item-children-replies > \.forum-thread-item\s*\{[^}]*padding:\s*16px 0 0 26px;[^}]*background-color:\s*transparent;/s,
    'native nested replies keep their indentation and transparent threaded surface');
});

test('threaded reply cards keep their layout when hidden-author handling is enabled', async () => {
  const source = await readFile('src/styles/spectrum-blocks.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const collapsedRow = source.match(/:root\[data-rsi-enhanced-blocks="on"\]:not\(\[data-rsi-comment-layout="threaded"\]\) #react #page \.forum-thread-item\.rsi-remove-author\s*\{([^}]+)\}/);
  assert.ok(collapsedRow, 'hidden-author rows retain the compact reset outside Threaded mode only');
  assert.match(collapsedRow[1], /padding:\s*0/);
  assert.match(collapsedRow[1], /background:\s*transparent !important/);
  assert.match(source, /\.forum-thread-item\.rsi-remove-author > \.content > \.content-main \{ display: none !important/,
    'the hidden author content remains hidden in Threaded mode');
  assert.match(packaged, /:scope\[data-rsi-enhanced-blocks="on"\]:not\(\[data-rsi-comment-layout="threaded"\]\) #react #page \.forum-thread-item\.rsi-remove-author/,
    'the packaged stylesheet preserves Threaded geometry for hidden-author rows');
});

test('compact threaded and conversation stream are packaged with theme and Extend conversation support', async () => {
  const source = await readFile('src/styles/spectrum-forums.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  for (const layout of ['compact', 'conversation']) {
    assert.match(source, new RegExp(`data-rsi-comment-layout="${layout}"`));
    assert.match(packaged, new RegExp(`data-rsi-comment-layout="${layout}"`));
  }
  assert.match(packaged, /data-rsi-comment-layout="conversation"[^\n]*\.forum-thread-item-children-replies[^{]*\{\s*display:\s*contents/);
  assert.match(packaged, /data-rsi-comment-layout="conversation"[^\n]*\.forum-thread-item-children-replies\[hidden\][^{]*\{\s*display:\s*none !important/);
  assert.match(packaged, /data-rsi-comment-layout="conversation"[^\n]*\.rsi-reply-context[\s\S]*?color:\s*var\(--rsi-muted\)[\s\S]*?background:\s*var\(--rsi-raised\)/);
  assert.match(packaged, /#react #page\.forum-thread \.forum-thread-item\.rsi-conversation-target\.rsi-conversation-nested-target/,
    'Extend conversation keeps its target ancestry cue after the layout-specific rules');
  assert.match(packaged, /#react #page \.rsi-conversation-context\s*\{[^}]*background:\s*var\(--rsi-surface\)/,
    'the reconstructed Extend conversation panel keeps its independent themed surface');
});

test('theme palette reaches the outer Spectrum shell and overrides native dark-root tokens', async () => {
  const css = await readFile('src/themes/spectrum-enhanced.css', 'utf8');
  const foundation = await readFile('src/styles/spectrum-foundation.css', 'utf8');
  const selector = css.match(/([^{}]+)\s*\{/s)?.[1] ?? '';
  assert.match(selector, /:root\[data-rsi-preset\]/);
  assert.match(selector, /#react/);
  assert.match(selector, /\.theme-dark/);
  assert.match(css, /--theme-header-bg-color:\s*var\(--rsi-surface\)/);
  assert.match(css, /--sidebar-bg-color:\s*var\(--rsi-background\)/);
  assert.match(css, /--sidebar-header-bg-color:\s*var\(--rsi-surface\)/);
  const shell = foundation.match(/:root\[data-rsi-preset\] #react :is\(([^)]+)\)\s*\{([^}]+)\}/);
  assert.ok(shell, 'the page shell background follows the selected palette');
  assert.match(shell[1], /\.mainLayout(?:,|$)/,
    'the outer Spectrum layout receives the same palette as its body and content');
  assert.doesNotMatch(shell[1], /\.mainLayout__(?:left|right)/,
    'the shared sidebar columns keep their existing appearance');
  assert.match(shell[2], /background-color:\s*var\(--rsi-background\)/);
});

test('developer-thread marker uses the theme highlight token while preserving the legacy gold palette', async () => {
  const source = await readFile('src/styles/spectrum-forums.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const palettes = await readFile('src/themes/palettes.ts', 'utf8');
  const tokens = await readFile('src/themes/tokens.css', 'utf8');
  assert.match(source, /\.orion-tavern-c-ThreadListItem:has\(\.orion-tavern-c-ThreadListItem__role-line\)::before\s*\{[^}]*background:\s*var\(--rsi-highlight\);/s);
  assert.match(packaged, /\.orion-tavern-c-ThreadListItem:has\(\.orion-tavern-c-ThreadListItem__role-line\)::before\s*\{[^}]*background:\s*var\(--rsi-highlight\);/s);
  assert.match(palettes, /enhanced:\s*\{[^}]*highlight:\s*'#bfa739'/s);
  assert.match(tokens, /--rsi-highlight:\s*#bfa739/);
  assert.match(packaged, /--rsi-highlight:\s*#bfa739/);
});

test('Spectrum MOTD uses a full-width announcement card without changing native layout', async () => {
  const source = await readFile('src/styles/spectrum-chat.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-chat.html', 'utf8');
  const card = source.match(/#react #page\.lobby \.lobby-message--motd\s*\{([^}]+)\}/);
  assert.ok(card, 'The MOTD wrapper must stay scoped to the lobby');
  for (const declaration of [
    /background-color:\s*var\(--rsi-surface\)/,
    /color:\s*var\(--rsi-text\)/,
    /border:\s*1px solid var\(--rsi-border\)/,
    /border-inline-start:\s*4px solid var\(--rsi-accent\)/,
    /border-radius:\s*8px/,
    /padding:\s*14px 52px 14px 16px/,
    /line-height:\s*1\.55/,
  ]) assert.match(card[1], declaration);
  assert.doesNotMatch(card[1], /\b(?:display|position|overflow|width|max-width|pointer-events)\s*:/i);
  const nestedReset = source.match(/#react #page\.lobby #page-main \.lobby-message--motd :where\(\*\)\s*\{([^}]+)\}/);
  assert.ok(nestedReset, 'MOTD nested native surfaces must be visually neutralized');
  assert.match(nestedReset[1], /background(?:-color)?:\s*transparent/);
  assert.match(nestedReset[1], /border-color:\s*transparent/);
  assert.match(nestedReset[1], /box-shadow:\s*none/);
  assert.match(source, /#react #page\.lobby #page-main \.lobby-message--motd :is\(button, \[role="button"\]\)\s*\{[^}]*background-color:\s*transparent/);
  assert.match(source, /#react #page\.lobby #page-main \.lobby-message--motd :is\(button, \[role="button"\]\):hover\s*\{[^}]*background-color:\s*var\(--rsi-hover\)/);
  assert.match(source, /#react #page\.lobby \.lobby-message--motd a\s*\{/);
  assert.match(source, /#react #page\.lobby \.lobby-message--motd :is\(a, button, \[role="button"\]\):focus-visible\s*\{/);
  assert.match(fixture, /class="lobby-message--motd"[\s\S]*?class="motd-content"[\s\S]*?aria-label="Dismiss message"/);
  assert.match(fixture, /native MOTD panel and close control styling/);
  assert.match(packaged, /#react #page\.lobby #page-main \.lobby-message--motd :where\(\*\)\s*\{[^}]*border-color:\s*transparent/);
  assert.match(packaged, /#react #page\.lobby \.lobby-message--motd\s*\{[^}]*border-inline-start:\s*4px solid var\(--rsi-accent\)/);
});

test('Spectrum current-user mentions highlight their live chat message', async () => {
  const source = await readFile('src/styles/spectrum-chat.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-chat.html', 'utf8');
  const message = source.match(/#react #page\.lobby #page-main \.message-item:not\(\.edit-mode\):has\(\.mention\.current-member\)\s*\{([^}]+)\}/);
  assert.ok(message, 'a current-user mention should highlight its entire lobby message');
  assert.match(message[1], /background-color:\s*color-mix\(in srgb, var\(--rsi-accent\) 9%, var\(--rsi-surface\)\)/);
  assert.match(message[1], /box-shadow:\s*inset 3px 0 var\(--rsi-accent\)/);
  const badge = source.match(/#react #page\.lobby #page-main \.message-item:not\(\.edit-mode\):has\(\.mention\.current-member\) > \.content > \.top::after\s*\{([^}]+)\}/);
  assert.ok(badge, 'the author line should label the highlighted message');
  assert.match(badge[1], /content:\s*["']Mentioned you["']/);
  assert.match(source, /#react #page\.lobby \.message-item \.mention\.current-member\s*\{[^}]*border:\s*1px solid/);
  assert.match(fixture, /class="mention current-member"/);
});

test('Spectrum selected-bookmark cue covers forum and lobby bookmarks', async () => {
  const source = await readFile('src/styles/spectrum-chat.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-chat.html', 'utf8');
  const selectedRule = source.match(/#react\s+\.orion-tavern-c-SidebarLeftBookmark\.-isSelected\s*\{([^}]+)\}/);
  assert.ok(selectedRule, 'selected bookmark styling should not depend on a lobby route or URL');
  assert.match(selectedRule[1], /background-color:\s*var\(--rsi-raised\)/);
  assert.match(selectedRule[1], /box-shadow:\s*inset 3px 0 var\(--rsi-accent\)/);
  assert.match(fixture, /class="orion-tavern-c-SidebarLeftBookmark -isSelected" href="\/spectrum\/community\/SC\/lobby\/1"/);
  assert.match(fixture, /class="orion-tavern-c-SidebarLeftBookmark -isSelected" href="\/spectrum\/community\/SC\/forum\/3"/);
  assert.match(packaged, /#react \.orion-tavern-c-SidebarLeftBookmark\.-isSelected\s*\{[^}]*box-shadow:\s*inset 3px 0 var\(--rsi-accent\)/);
});

test('Spectrum Online Users roster is redesigned without changing native row or status behavior', async () => {
  const source = await readFile('src/styles/spectrum-chat.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-chat.html', 'utf8');
  const root = '#react:has(#page.lobby) .quick-access.lobby-users';
  for (const selector of [
    `${root} .quick-access-panel {`,
    `${root} .quick-access-header-title {`,
    `${root} .lobby-member-presences .search {`,
    `${root} .members-list-group-header {`,
    `${root} .lobby-presence-item {`,
    `${root} .lobby-presence-item .member-avatar .avatar {`,
  ]) assert.ok(source.includes(selector), `missing Online Users redesign rule: ${selector}`);
  const header = source.match(/#react:has\(#page\.lobby\) \.quick-access\.lobby-users \.quick-access-header\s*\{([^}]+)\}/);
  assert.ok(header);
  assert.match(header[1], /padding:\s*9px 11px/);
  assert.match(header[1], /background-color:\s*var\(--rsi-surface\)/,
    'Online Users header should use the same dark surface as the panel');
  const search = source.match(/#react:has\(#page\.lobby\) \.quick-access\.lobby-users \.lobby-member-presences \.search\s*\{([^}]+)\}/);
  assert.ok(search);
  assert.match(search[1], /margin:\s*8px 9px/);
  const group = source.match(/#react:has\(#page\.lobby\) \.quick-access\.lobby-users \.members-list-group-header\s*\{([^}]+)\}/);
  assert.ok(group);
  assert.match(group[1], /font:\s*700 12px\/1\.2/);
  const groupInfo = source.match(/#react:has\(#page\.lobby\) \.quick-access\.lobby-users \.members-list-group-info\s*\{([^}]+)\}/);
  assert.ok(groupInfo);
  assert.match(groupInfo[1], /text-transform:\s*uppercase/);
  const row = source.match(/#react:has\(#page\.lobby\) \.quick-access\.lobby-users \.lobby-presence-item\s*\{([^}]+)\}/);
  assert.ok(row, 'Online Users rows should receive the aligned roster treatment');
  assert.match(row[1], /gap:\s*7px/);
  assert.match(row[1], /padding-inline:\s*7px/);
  assert.doesNotMatch(row[1], /\b(?:height|min-height|max-height|margin-block|padding-block)\s*:/,
    'row styling must preserve React virtualization dimensions');
  const avatar = source.match(/#react:has\(#page\.lobby\) \.quick-access\.lobby-users \.lobby-presence-item \.member-avatar \.avatar\s*\{([^}]+)\}/);
  assert.ok(avatar);
  assert.match(avatar[1], /border-radius:\s*var\(--rsi-avatar-radius,\s*50%\)/,
    'Online Users avatars should follow the selected shape');
  assert.match(source, /#react:has\(#page\.lobby\) \.quick-access\.lobby-users \.lobby-presence-item \.member-name\s*\{[^}]*font:\s*13px\/1\.25/);
  const rosterCss = source.slice(source.indexOf(root), source.indexOf('/* Friends shares'));
  assert.doesNotMatch(rosterCss, /\.member-presence\.(?:online|offline|away|dnd|invisible|playing)\b[^{}]*\{/,
    'native presence-state selectors should remain untouched');
  const presenceRules = [...rosterCss.matchAll(/[^{}]*\.lobby-presence-item[^{}]*\.member-presence\s*\{([^}]+)\}/g)];
  for (const rule of presenceRules) assert.doesNotMatch(rule[1], /\b(?:color|fill|opacity)\s*:/,
    'native status icon colors must remain intact');
  assert.match(fixture, /class="quick-access[^\"]*lobby-users[\s\S]*?class="[^"]*lobby-presence-item/,
    'the fixture keeps native Online Users markup available for regression checks');
  assert.match(fixture, /placeholder="Filter users in this lobby"/);
  assert.match(fixture, /class="members-list-group-header"[\s\S]*?class="members-list-group-name">staff/);
  assert.match(packaged, /#react:has\(#page\.lobby\) \.quick-access\.lobby-users \.lobby-presence-item \.member-avatar \.avatar\s*\{[^}]*border-radius:\s*var\(--rsi-avatar-radius,\s*50%\)/);
});

test('Spectrum friends panel follows the roster design without altering native presence or virtualized rows', async () => {
  const source = await readFile('src/styles/spectrum-friends.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-chat.html', 'utf8');
  const root = ':root:has(#react) .quick-access-panel:has(.lobby-member-presences .search input[placeholder="Filter friends"])';
  assert.ok(source.includes(`${root} .quick-access-header-title {`), 'Friends styling should be scoped by its native search field');
  assert.ok(source.includes(`${root} .lobby-presence-item {`), 'Friends rows should receive the aligned roster treatment');
  assert.ok(source.includes(`${root} .lobby-presence-item .member-presence-info {`), 'offline last-online detail should remain readable');
  const row = source.match(new RegExp(`${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \.lobby-presence-item \\{([^}]+)\\}`));
  assert.ok(row);
  assert.doesNotMatch(row[1], /\b(?:height|min-height|max-height|margin-block|padding-block)\s*:/, 'friends row styling must not change React virtualization dimensions');
  const avatar = source.match(new RegExp(`${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \.lobby-presence-item \.member-avatar \.avatar \\{([^}]+)\\}`));
  assert.ok(avatar);
  assert.match(avatar[1], /border-radius:\s*var\(--rsi-avatar-radius,\s*6px\)/, 'friend avatars should follow the selected shape');
  const avatarImage = source.match(new RegExp(`${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \.lobby-presence-item \.member-avatar \.avatar img \\{([^}]+)\\}`));
  assert.ok(avatarImage);
  assert.match(avatarImage[1], /border-radius:\s*var\(--rsi-avatar-radius,\s*6px\)/, 'friend images should clip to the selected avatar shape');
  const friendsCss = source.slice(source.indexOf(root), source.indexOf('/* Restyle the native notification popup'));
  assert.doesNotMatch(friendsCss, /\.member-presence\.(?:online|offline)\b[^{}]*\{/, 'friend styles should leave native status-state selectors untouched');
  const presenceRules = [...friendsCss.matchAll(/[^{}]*\.lobby-presence-item[^{}]*\.member-presence\s*\{([^}]+)\}/g)];
  for (const rule of presenceRules) assert.doesNotMatch(rule[1], /\b(?:color|fill|opacity)\s*:/, 'native online/offline colors must remain intact');
  const friendsFixture = fixture.match(/<div class="quick-access friends">([\s\S]*?)<aside class="quick-access notifications">/)?.[1];
  assert.ok(friendsFixture, 'fixture should contain the Friends quick-access panel');
  assert.match(friendsFixture, /placeholder="Filter friends"/);
  assert.match(friendsFixture, /style="height: 36px;[^"]*">\s*<span class="member-profile-openable lobby-presence-item lobby-presence-item--online"/);
  assert.match(friendsFixture, /style="height: 36px;[^"]*">\s*<span class="member-profile-openable lobby-presence-item lobby-presence-item--offline"[\s\S]*?Last online 8 months ago/);
  assert.match(packaged, /:scope:has\(#react\) \.quick-access-panel:has\(\.lobby-member-presences \.search input\[placeholder="Filter friends"\]\) \.lobby-presence-item \.member-avatar \.avatar\s*\{[^}]*border-radius:\s*var\(--rsi-avatar-radius,\s*6px\)/);
});

test('Spectrum Friends settings popover uses theme surfaces and keeps native option states', async () => {
  const source = await readFile('src/styles/spectrum-friends.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-chat.html', 'utf8');
  const root = ':root:has(#react) .quick-access-settings';
  const menu = source.match(/:root:has\(#react\) \.quick-access-settings\s*\{([^}]+)\}/);
  assert.ok(menu, 'the Friends settings popover should have a themed surface');
  assert.match(menu[1], /background-color:\s*var\(--rsi-surface\)/);
  assert.doesNotMatch(menu[1], /\b(?:position|top|right|bottom|left|inset)\s*:/, 'native popup anchoring should remain unchanged');
  assert.ok(source.includes(`${root} a {`), 'Friends settings links should receive the same theme treatment');
  assert.ok(source.includes(`${root} .smart-checkbox {`), 'Native friend options should read as aligned settings rows');
  const settingsCss = source.slice(source.indexOf(root), source.indexOf('/* Restyle the native notification popup'));
  assert.match(settingsCss, /\.quick-access-settings \.smart-checkbox:hover\s*\{[^}]*background-color:\s*var\(--rsi-hover\)/);
  assert.doesNotMatch(settingsCss, /\.widget\.(?:allow|disallow)\b/, 'native checked and unchecked colors should remain intact');
  assert.match(packaged, /:scope:has\(#react\) \.quick-access-settings\s*\{[^}]*background-color:\s*var\(--rsi-surface\)/);

  const friendsFixture = fixture.match(/<div class="quick-access friends">([\s\S]*?)<aside class="quick-access notifications">/)?.[1];
  assert.ok(friendsFixture, 'fixture should contain the Friends quick-access panel');
  assert.match(friendsFixture, /<div class="quick-access-settings">/);
  assert.match(friendsFixture, /href="\/spectrum\/settings\/friends"/);
  assert.match(friendsFixture, /class="widget allow"[\s\S]*?Show offline/i);
  assert.match(friendsFixture, /class="widget disallow"[\s\S]*?Group by org/i);
});

test('Spectrum notifications popup is restyled without changing native list behavior', async () => {
  const source = await readFile('src/styles/spectrum-notifications.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-chat.html', 'utf8');
  for (const selector of [
    /:root:has\(#react\) aside\.quick-access\.notifications\s*\{/,
    /:root:has\(#react\) aside\.quick-access\.notifications \.quick-access-header-title\s*\{/,
    /:root:has\(#react\) aside\.quick-access\.notifications \.action-button\.action-button--outline\s*\{/,
    /:root:has\(#react\) aside\.quick-access\.notifications a\.notifications-item:hover\s*\{/,
    /:root:has\(#react\) aside\.quick-access\.notifications \.item-avatar\s*\{/,
    /:root:has\(#react\) aside\.quick-access\.notifications \.item-timestamp\s*\{/,
    /:root:has\(#react\) aside\.quick-access\.notifications \.item-menu\s*\{/,
  ]) assert.match(source, selector);
  const avatar = source.match(/:root:has\(#react\) aside\.quick-access\.notifications \.item-avatar\s*\{([^}]+)\}/);
  assert.ok(avatar);
  assert.match(avatar[1], /border-radius:\s*var\(--rsi-avatar-radius,\s*6px\)/, 'notification avatars should follow the selected Spectrum avatar shape');
  assert.match(packaged, /:scope:has\(#react\) aside\.quick-access\.notifications \.item-avatar\s*\{[^}]*border-radius:\s*var\(--rsi-avatar-radius,\s*6px\)/, 'notification avatar shape rule should be packaged');
  assert.match(packaged, /@scope \(:root\[data-rsi-section="spectrum"\]:not\(\[data-rsi-notifications="off"\]\)\)/,
    'notification styles should have an independent Spectrum scope');
  const variables = new Map();
  const root = { style: { setProperty: (key, value) => variables.set(key, value) }, dataset: {}, setAttribute() {} };
  for (const [shape, radius] of Object.entries({ circle: '50%', rounded: '8px', square: '0px' })) {
    applySettings(normalizeSettings({ avatar: shape }), root);
    assert.equal(variables.get('--rsi-avatar-radius'), radius, `${shape} should flow to notification avatars`);
  }
  const listRules = [...source.matchAll(/:root:has\(#react\) aside\.quick-access\.notifications[^{}]*\.notifications-list\s*\{([^}]+)\}/g)];
  for (const rule of listRules) assert.doesNotMatch(rule[1], /\b(?:height|min-height|max-height|overflow|position|display)\s*:/, 'native notification list sizing and scrolling must remain intact');
  assert.match(fixture, /class="quick-access notifications"/);
  assert.match(fixture, /class="action-button action-button--outline"[^>]*>[\s\S]*?Clear all/);
  assert.match(source, /aside\.quick-access\.notifications \.rsi-notification-filters\s*\{/);
  assert.match(source, /aside\.quick-access\.notifications \.rsi-notification-filter\[aria-pressed="true"\]/);
  assert.match(source, /notifications-list > \.notifications-item\[hidden\]\s*\{\s*display:\s*none\s*!important/s);
  const moderationFilter = source.match(/\.rsi-notification-filter-marker\s*\{([^}]+)\}/);
  assert.ok(moderationFilter);
  assert.match(moderationFilter[1], /background-color:\s*#e6ad45/i, 'moderation filter marker stays amber across themes');
  assert.doesNotMatch(moderationFilter[1], /var\(--rsi-/i);
  assert.match(fixture, /class="quick-access-header"[\s\S]*?class="rsi-notification-filters"[\s\S]*?class="notifications-list"/,
    'filter controls should fit between the native header and list');
  assert.match(fixture, /class="notifications-item" href="#thread"/);
  assert.match(fixture, /class="item-menu action reset" title="Hide"/);
  assert.match(fixture, /<div class="notifications-item">[\s\S]*?Moderator has/);
    const moderator = source.match(/:root:has\(#react\) aside\.quick-access\.notifications \.notifications-list > div\.notifications-item\s*\{([^}]+)\}/);
    assert.ok(moderator, 'non-link moderator notices should have a distinct treatment');
    assert.match(moderator[1], /background-color:\s*#30271a/i);
    assert.match(moderator[1], /box-shadow:\s*inset 3px 0 #e6ad45/i, 'amber marker should not change native row dimensions');
    assert.doesNotMatch(moderator[1], /var\(--rsi-/, 'moderator colors should stay fixed across theme changes');
    assert.match(source, /:root:has\(#react\) aside\.quick-access\.notifications \.notifications-list > div\.notifications-item \.item-text strong\s*\{[^}]*color:\s*#ffd27a/i);
    assert.match(source, /:root:has\(#react\) aside\.quick-access\.notifications \.notifications-list > div\.notifications-item \.item-timestamp,\s*:root:has\(#react\) aside\.quick-access\.notifications \.notifications-list > div\.notifications-item \.item-timestamp \.icon\s*\{[^}]*color:\s*#d7c092/i);
    assert.match(packaged, /:scope:has\(#react\) aside\.quick-access\.notifications \.notifications-list > div\.notifications-item\s*\{[^}]*background-color:\s*#30271a/i);
});

test('Spectrum styles are restricted to Spectrum routes and independently gated panel modules', async () => {
  const build = await readFile('scripts/build.mjs', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const chat = await readFile('src/styles/spectrum-chat.css', 'utf8');
  const friends = await readFile('src/styles/spectrum-friends.css', 'utf8');
  assert.match(build, /src\/styles\/spectrum-friends\.css', 'friends'/);
  assert.match(build, /src\/styles\/spectrum-messages\.css', 'messages'/);
  assert.doesNotMatch(chat, /Friends shares the native virtualized roster markup/,
    'Friends panel styling is no longer bundled with Chat');
  assert.match(friends, /quick-access-panel:has\(\.lobby-member-presences \.search input\[placeholder="Filter friends"\]\)/,
    'the independent Friends module retains the verified Friends panel selector');
  assert.match(friends, /quick-access-settings/,
    'the Friends module also styles its detached native settings popover');
  assert.match(build, /data-rsi-section="spectrum"/);
  assert.match(packaged, /@scope \(:root\[data-rsi-section="spectrum"\]\)/);
  assert.match(packaged, /@scope \(:root\[data-rsi-section="spectrum"\]:not\(\[data-rsi-friends="off"\]\)\)/);
  assert.match(packaged, /@scope \(:root\[data-rsi-section="spectrum"\]:not\(\[data-rsi-messages="off"\]\)\)/);
  assert.match(packaged, /@scope \(:root\[data-rsi-section="spectrum"\]:not\(\[data-rsi-notifications="off"\]\)\)/);
  assert.match(packaged, /@scope \(:root\[data-rsi-section="spectrum"\]:not\(\[data-rsi-blocks="off"\]\)\)/);
});

test('enhanced profile action matches native option sizing and uses the native icon slot for its skull', async () => {
  const runtime = await readFile('src/content/spectrum-blocks.ts', 'utf8');
  const source = await readFile('src/styles/spectrum-blocks.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const actionRule = source.match(/button\.profile-action\.rsi-enhanced-block-control\s*\{([^}]+)\}/);
  assert.ok(actionRule, 'the enhanced action should be scoped to Spectrum profile menu buttons');
  assert.match(actionRule[1], /display:\s*inline-flex/);
  assert.match(actionRule[1], /width:\s*auto/);
  assert.match(actionRule[1], /padding:\s*0\s+0\s+0\s+10px/, 'the icon and label share the native action text inset');
  assert.doesNotMatch(actionRule[1], /font(?:-size)?\s*:/, 'the native profile-action class supplies the option text size');
  assert.doesNotMatch(actionRule[1], /gap\s*:/, 'the native icon styling supplies the spacing before its label');
  assert.match(runtime, /doc\.createElementNS\('http:\/\/www\.w3\.org\/2000\/svg',\s*'svg'\)/);
  assert.match(runtime, /icon\.setAttribute\('class',\s*'icon rsi-enhanced-block-icon'\)/);
  assert.match(runtime, /icon\.setAttribute\('viewBox',\s*'0 0 12 12'\)/);
  assert.match(runtime, /icon\.setAttribute\('fill',\s*'currentColor'\)/, 'the skull inherits the native profile-action icon colour');
  assert.match(runtime, /skullPath\.setAttribute\('d',/);
  assert.match(runtime, /icon\.setAttribute\('aria-hidden',\s*'true'\)/);
  assert.match(source, /\.rsi-enhanced-block-icon\s*\{[^}]*width:\s*12px;[^}]*height:\s*12px;[^}]*flex:\s*0 0 12px/s);
  assert.match(runtime, /label\.textContent\s*=\s*text/);
  assert.match(packaged, /button\.profile-action\.rsi-enhanced-block-control\s*\{[^}]*width:\s*auto/);
});

test('foundation text and accent meet WCAG AA contrast on every base surface', async () => {
  const css = await readFile('src/themes/tokens.css', 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--rsi-([\w-]+):\s*(#[\da-f]{6})/gi)].map((m) => [m[1], m[2]]));
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
      .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  for (const surface of ['background', 'surface', 'raised', 'hover']) {
    assert.ok(tokens[surface], `missing ${surface} token`);
    for (const text of ['text', 'muted', 'accent']) {
      assert.ok(tokens[text], `missing ${text} token`);
      const values = [luminance(tokens[surface]), luminance(tokens[text])].sort((a, b) => b - a);
      assert.ok((values[0] + 0.05) / (values[1] + 0.05) >= 4.5, `${text} on ${surface}`);
    }
  }
});
