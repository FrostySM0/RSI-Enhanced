// Local-only fixture server for manual/computed-style theme verification.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { hangarPageHtml } from './fixtures/hangar-pages.mjs';

const routes = new Map([
  ['/spectrum/community/SC/forum/3/blocks-fixture', ['tests/fixtures/spectrum-blocks.html', 'text/html']],
  ['/spectrum-messages-native.css', ['tests/fixtures/spectrum-messages-native.css', 'text/css']],
  ['/spectrum/messages-preview', ['tests/fixtures/spectrum-messages.html', 'text/html']],
  ['/spectrum/messages-empty-preview', ['tests/fixtures/spectrum-messages-empty.html', 'text/html']],
  ['/comment-layouts', ['tests/fixtures/spectrum-comment-layouts.html', 'text/html']],
  ['/comment-layout-concepts', ['tests/fixtures/spectrum-comment-layout-concepts.html', 'text/html']],
  ['/spectrum/community/SC/forum/3/thread/mock-thread/4', ['tests/fixtures/spectrum-conversation.html', 'text/html']],
  ['/account/pledges', ['tests/fixtures/hangar.html', 'text/html']],
  ...['/account/game-access-management','/account/roms','/account/rsvp','/electronic-access'].map(path => [path, ['tests/fixtures/hangar-categories.html', 'text/html']]),
  ['/account/buy-back-pledges', ['tests/fixtures/buyback-action.html', 'text/html']],
  ['/hangar-image.svg', ['tests/fixtures/hangar-image.svg', 'image/svg+xml']],
  ['/en/account/pledges', ['tests/fixtures/hangar.html', 'text/html']],
  ['/roadmap/release-view', ['tests/fixtures/roadmap-release.html', 'text/html']],
  ['/en/patch-notes', ['tests/fixtures/patch-notes.html', 'text/html']],
  ['/en/community/devtracker', ['tests/fixtures/devtracker.html', 'text/html']],
  ...['/en/pledge', '/en/ship-matrix', '/en/community/orgs', '/en/comm-link'].map(path => [path, ['tests/fixtures/rsi-public.html', 'text/html']]),
  ['/spectrum/community/SC', ['tests/fixtures/spectrum-home.html', 'text/html']],
  ['/rsi.css', ['dist/rsi.css', 'text/css']],
  ['/', ['tests/fixtures/spectrum-foundation.html', 'text/html']],
  ['/forums', ['tests/fixtures/spectrum-forums.html', 'text/html']],
  ['/spectrum-home', ['tests/fixtures/spectrum-home.html', 'text/html']],
  ['/chat', ['tests/fixtures/spectrum-chat.html', 'text/html']],
  ['/spectrum/community/SC/forum/3', ['tests/fixtures/spectrum-forums.html', 'text/html']],
  ['/spectrum/community/SC/lobby/1', ['tests/fixtures/spectrum-chat.html', 'text/html']],
  ['/src/popup/index.html', ['dist/src/popup/index.html', 'text/html']],
  ['/content.js', ['dist/content.js', 'text/javascript']],
  ['/extension-api.js', ['tests/fixtures/extension-api.js', 'text/javascript']],
  ['/spectrum.css', ['dist/spectrum.css', 'text/css']],
]);
const requestedPort = Number(process.env.RSI_ENHANCED_FIXTURE_PORT ?? 4173);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (request.method === 'POST' && ['/api/spectrum/forum/thread/nested', '/api/spectrum/forum/thread/reply'].includes(pathname)) {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const input = JSON.parse(raw);
    const text = value => [{ type: 'text', data: { blocks: [{ text: value, type: 'unstyled' }] } }];
    const rows = {
      '4': { id: '4', thread_id: '10', parent_reply_id: '3' },
      '3': { id: '3', thread_id: '10', parent_reply_id: '2', member: { displayname: 'Second parent' }, content_blocks: text('Second parent reply in the chain.') },
      '2': { id: '2', thread_id: '10', parent_reply_id: '', member: { displayname: 'First parent' }, content_blocks: text('First parent reply in the chain. <script>stays plain text</script>') },
    };
    const data = pathname.endsWith('/nested') ? { id: '10', content_reply_id: '1', subject: 'Original topic', member: { displayname: 'Original author' }, content_blocks: text('Original post at the start of the conversation.') } : rows[input.reply_id];
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ success: data ? 1 : 0, data })); return;
  }
  const asset = routes.get(pathname) ?? (/^\/roadmap\/release-view(?:\/|$)/.test(pathname) ? routes.get('/roadmap/release-view') : undefined) ?? (/^\/assets\/[\w-]+\.(css|js|png|svg|webp)$/.test(pathname)
    ? [`dist${pathname}`, pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.svg') ? 'image/svg+xml' : pathname.endsWith('.webp') ? 'image/webp' : 'image/png'] : undefined);
  if (!asset) { response.writeHead(404).end(); return; }
  try {
    let content = await readFile(new URL(`../${asset[0]}`, import.meta.url));
    if (pathname === '/extension-api.js') {
      const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
      content = Buffer.from(content.toString().replace('__RSI_ENHANCED_VERSION__', manifest.version));
    }
    if (pathname === '/en/account/pledges' && new URL(request.url, 'http://127.0.0.1').searchParams.get('log') === '1') {
      const logFixture = await readFile(new URL('../tests/fixtures/hangar-log.html', import.meta.url), 'utf8');
      content = Buffer.from(content.toString().replace('</body>', `${logFixture}</body>`));
    }
    if (/\/account\/pledges$/.test(pathname) && new URL(request.url, 'http://127.0.0.1').searchParams.get('toolbar') === 'nested') {
      content = Buffer.from(content.toString().replace('<div class="billing-title-pager-wrapper"><div class="js-product-type-filter">','<div class="native-toolbar"><div class="pager"><div class="js-product-type-filter">').replace('<div class="pager"><div class="right">','<div class="right">'));
    }
    // Second Hangar page supplies a distinct item for cross-page search checks.
    if (/\/account\/pledges$/.test(pathname) && new URL(request.url, 'http://127.0.0.1').searchParams.get('page') === '2') {
      content = Buffer.from(content.toString().replaceAll('Phoenix Insignia Display', 'Carrack Expedition').replace('value="101"', 'value="201"').replace('value="102"', 'value="202"'));
    }
    if (/\/account\/pledges$/.test(pathname) && new URL(request.url, 'http://127.0.0.1').searchParams.get('page') === '15') {
      content = Buffer.from(hangarPageHtml(content.toString(), 15));
    }
    if (asset[1] === 'text/html' && (pathname.startsWith('/spectrum/') || pathname === '/src/popup/index.html')) {
      let html = content.toString().replace(/(<title>.*?<\/title>)/, '$1<script src="/extension-api.js"></script>');
      if (pathname.startsWith('/spectrum/')) {
        const end = html.lastIndexOf('</html>');
        const script = '<script src="/content.js"></script>';
        html = end < 0 ? `${html}${script}` : `${html.slice(0, end)}${script}${html.slice(end)}`;
      }
      content = Buffer.from(html);
    }
    response.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` }).end(content);
  } catch {
    response.writeHead(500).end('Build the extension before previewing.');
  }
});
server.listen(requestedPort, '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : requestedPort;
  console.log(`Theme fixture: http://127.0.0.1:${port}`);
});
