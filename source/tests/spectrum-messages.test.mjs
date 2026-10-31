import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

test('the Messages drawer redesign is Spectrum-scoped and follows the observed native elements', async () => {
  const build = await readFile('scripts/build.mjs', 'utf8');
  assert.match(build, /src\/styles\/spectrum-messages\.css', 'messages'/,
    'the Messages styles are bundled behind their own module guard');
  const content = await readFile('src/content/index.ts', 'utf8');
  assert.match(content, /refreshSpectrumMessagesSummary\(activeSection === 'spectrum' && settings\.modules\.messages\)/,
    'the live Messages summary follows the independent Messages switch');

  const source = await readFile('src/styles/spectrum-messages.css', 'utf8');
  const packaged = await readFile('dist/spectrum.css', 'utf8');
  const fixture = await readFile('tests/fixtures/spectrum-messages.html', 'utf8');

  assert.match(fixture, /class="mainLayout__sidebar mainLayout__right mainLayout__right-open"[\s\S]*?sidebarRightHeader__title"[^>]*title="Messages"/,
    'the fixture records the user-supplied Messages drawer structure');
  assert.match(source, /\.mainLayout__sidebar\.mainLayout__right:has\(\.orion-tavern-c-sidebarRightHeader__title\[title="Messages"\]\)/,
    'selectors require the verified Messages header within the right sidebar');
  assert.match(source, /sidebarRightHeader__top\s*\{[^}]*background:\s*var\(--rsi-raised\);/s,
    'the Messages title strip uses the same solid raised surface as the Friends and Notifications headers');
  assert.doesNotMatch(source, /sidebarRightHeader__top\s*\{[^}]*repeating-linear-gradient/s,
    'the Messages title strip no longer uses the diagonal pattern');
  assert.match(source, /sidebarRightHeader__top\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;[^}]*grid-template-rows:\s*auto auto;/s,
    'the Messages header uses the Friends panel two-row title-and-action layout');
  assert.match(source, /sidebarRightHeader__heading\s*\{[^}]*display:\s*contents;/s,
    'the title and New action can occupy separate Friends-style header grid cells');
  assert.match(source, /sidebarRightHeader__title\[title="Messages"\][\s\S]*?font:\s*700 16px[\s\S]*?text-transform:\s*uppercase/,
    'the Messages title is enlarged to match the neighboring quick-panel headings');
  assert.match(source, /\.rsi-spectrum-message-summary\s*\{[^}]*grid-column:\s*1;[^}]*grid-row:\s*2;[^}]*font:\s*600 11px/s,
    'the conversation and unread totals sit below Messages like the Friends presence summary');
  assert.match(source, /top:has\(> \.rsi-spectrum-message-summary\)[^{}]*\.orion-tavern-c-sidebarRightHeader__counter\s*\{\s*display:\s*none;/s,
    'the native unread counter is hidden only while its extension-owned combined summary is shown');
  assert.match(source, /sidebarRightHeader__heading > div:has\(> \.a-button\.-filled\)[\s\S]*?grid-column:\s*2;[\s\S]*?grid-row:\s*1 \/ span 2;/,
    'the native New action sits to the right of both title rows');
  assert.match(source, /sidebarRightHeader__heading \.a-button\.-filled[\s\S]*?background:\s*var\(--rsi-accent\)/,
    'the New action uses the bright theme accent fill from the mockup');
  assert.match(source, /sidebarRightHeader__heading \.a-button\.-filled \.a-button__content[\s\S]*?color:\s*var\(--rsi-background\)/,
    'the button label overrides Spectrum’s dark native text with a contrasting label color');
  assert.match(source, /sidebarRightHeader__heading \.a-button\.-filled \.a-button__background[\s\S]*?display:\s*none;/,
    'the native overlay cannot cover the accent fill with Spectrum’s dark button surface');
  assert.match(source, /m-inputBase__input[\s\S]*?min-height:\s*44px[\s\S]*?border:\s*1px solid color-mix\(in srgb, var\(--rsi-accent\) 72%, var\(--rsi-border\)\)/,
    'the native conversation search uses the larger accented field from the mockup');
  assert.match(source, /input\[data-cy-id="input"\][\s\S]*?height:\s*32px/,
    'the native search input fits inside the compact field');
  assert.match(fixture, /orion-tavern-c-SidebarRightDirectMessage[\s\S]*?orion-tavern-c-SidebarRightDirectMessage__excerpt[\s\S]*?orion-tavern-c-SidebarRightDirectMessage__counter/,
    'the fixture records the populated native conversation row and unread counter');
  assert.match(source, /a\.orion-tavern-c-SidebarRightDirectMessage[\s\S]*?margin:\s*8px 10px[\s\S]*?border-radius:\s*8px[\s\S]*?background:\s*var\(--rsi-raised\)/,
    'populated conversations use the rounded individual cards shown in the mockup');
  assert.match(source, /SidebarRightDirectMessage__avatar[\s\S]*?width:\s*44px[\s\S]*?SidebarRightDirectMessage__excerpt[\s\S]*?font:\s*11px/,
    'conversation cards use the larger avatar and compact preview typography from the mockup');
  assert.match(source, /a\.orion-tavern-c-SidebarRightDirectMessage:has\(\.orion-tavern-c-SidebarRightDirectMessage__counter\)::after[\s\S]*?width:\s*4px[\s\S]*?background:\s*var\(--rsi-highlight\)/,
    'unread conversations show the mockup’s theme-independent signal bar');
  assert.match(source, /SidebarRightDirectMessage__counter[\s\S]*?background(?:-color)?:\s*var\(--rsi-raised\)[\s\S]*?SidebarRightDirectMessage__close-button/,
    'native unread and close controls remain visible in the compact row');
  assert.match(source, /\.m-emptyState\.t-messagesEmptyState[\s\S]*?background:/,
    'the observed Messages empty state uses the approved palette');
  assert.match(source, /\.m-emptyState__button[\s\S]*?background:\s*var\(--rsi-accent\)/,
    'the native empty-state New action is styled without replacing it');
  assert.match(source, /\.m-emptyState__text h2[\s\S]*?font:\s*700 26px[\s\S]*?\.m-emptyState__text p[\s\S]*?font:\s*14px/,
    'the empty state retains the mockup’s prominent title and readable description');
  assert.match(source, /var\(--rsi-(?:background|surface|raised|text|muted|accent|border)\)/,
    'the Messages surface follows the active theme palette');
  assert.doesNotMatch(source, /\.page\.lobby|\.messages-items|\.forum-thread/,
    'the drawer redesign does not reach chat or forum layouts');
  assert.match(packaged, /@scope \(:root\[data-rsi-section="spectrum"\]:not\(\[data-rsi-messages="off"\]\)\)[\s\S]*?mainLayout__sidebar\.mainLayout__right:has\(\.orion-tavern-c-sidebarRightHeader__title\[title="Messages"\]\)/,
    'the generated Messages style is limited to Spectrum while its own styling is enabled');
  assert.match(packaged, /\.m-emptyState__button \.a-button__background\s*\{\s*display:\s*none;/,
    'the generated Messages styles also suppress the native dark overlay');
});

test('local preview serves Messages states, routed home and current popup assets', async t => {
  const server = spawn(process.execPath, ['tests/preview-theme.mjs'], {
    env: { ...process.env, RSI_ENHANCED_FIXTURE_PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  server.stdout.setEncoding('utf8');
  server.stderr.setEncoding('utf8');
  server.stdout.on('data', chunk => { stdout += chunk; });
  server.stderr.on('data', chunk => { stderr += chunk; });
  t.after(async () => {
    if (server.exitCode === null) {
      const exited = new Promise(resolve => server.once('exit', resolve));
      server.kill();
      await exited;
    }
  });

  const started = new Promise((resolve, reject) => {
    server.stdout.on('data', chunk => {
      if (/Theme fixture: http:\/\/127\.0\.0\.1:\d+/.test(stdout)) resolve();
    });
    server.once('error', reject);
    server.once('exit', code => reject(new Error(`Preview server exited early (${code}): ${stderr}`)));
  });
  let timeout;
  try {
    await Promise.race([
      started,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error(`Preview server did not start: ${stderr}`)), 5000); }),
    ]);
  } finally {
    clearTimeout(timeout);
  }

  const port = Number(stdout.match(/Theme fixture: http:\/\/127\.0\.0\.1:(\d+)/)?.[1]);
  assert.ok(port > 0, `preview server must report its bound port: ${stdout}`);
  const origin = `http://127.0.0.1:${port}`;

  const populatedResponse = await fetch(`${origin}/spectrum/messages-preview`);
  assert.equal(populatedResponse.status, 200);
  const populated = await populatedResponse.text();
  assert.match(populated, /orion-tavern-c-SidebarRightDirectMessage/);
  assert.match(populated, /Unread message preview/);

  const emptyResponse = await fetch(`${origin}/spectrum/messages-empty-preview`);
  assert.equal(emptyResponse.status, 200);
  const empty = await emptyResponse.text();
  assert.match(empty, /href="\/spectrum-messages-native\.css"/);
  const nativeStylesResponse = await fetch(`${origin}/spectrum-messages-native.css`);
  assert.equal(nativeStylesResponse.status, 200);
  const nativeStyles = await nativeStylesResponse.text();
  assert.match(nativeStyles, /height:\s*100vh/);
  assert.match(empty, /emptyState-icon" width="178" height="178"/);
  assert.match(empty, /NO MESSAGES/);
  assert.match(empty, /m-emptyState__button/);
  assert.doesNotMatch(empty, /orion-tavern-c-SidebarRightDirectMessage/);

  const popupResponse = await fetch(`${origin}/src/popup/index.html`);
  assert.equal(popupResponse.status, 200);
  const popup = await popupResponse.text();
  const popupAssets = [...popup.matchAll(/(?:src|href)="(\.\.\/\.\.\/assets\/[^\"]+)"/g)]
    .map((match) => new URL(match[1], `${origin}/src/popup/index.html`).pathname);
  assert.ok(popupAssets.some((path) => /MadeByTheCommunity_White-[\w-]+\.png$/.test(path)),
    'the popup includes the community maker mark asset');
  for (const path of popupAssets) {
    assert.equal((await fetch(`${origin}${path}`)).status, 200, `preview asset must resolve: ${path}`);
  }
  const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
  const extensionApi = await (await fetch(`${origin}/extension-api.js`)).text();
  assert.ok(extensionApi.includes(`version: '${manifest.version}'`),
    'the preview settings footer follows the packaged extension version');

  const homeResponse = await fetch(`${origin}/spectrum/community/SC`);
  assert.equal(homeResponse.status, 200);
  const home = await homeResponse.text();
  assert.match(home, /data-rsi-spectrum-home="true"/);
  assert.match(home, /<script src="\/content\.js"><\/script>/,
    'the live-shaped Spectrum home fixture includes the extension runtime');
});
