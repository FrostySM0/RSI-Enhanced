// Focused artifact validation; deliberately does not run feature test suites.
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const output = new URL('dist/', root);
const read = path => readFile(new URL(path, output), 'utf8');
const manifest = JSON.parse(await read('manifest.json'));
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
assert.equal(manifest.version, pkg.version);
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.equal(manifest.minimum_chrome_version, '118');
assert.deepEqual(manifest.background, { service_worker: 'background.js' });
assert.deepEqual(manifest.host_permissions, ['https://docs.google.com/*']);
assert.equal(manifest.web_accessible_resources, undefined);
assert.equal(manifest.content_security_policy.extension_pages, "script-src 'self'; object-src 'self'");
assert.equal(Object.keys(pkg.dependencies ?? {}).length, 0);

const expected = new Set(['manifest.json', manifest.action.default_popup, 'privacy-policy.html']);
expected.add(manifest.background.service_worker);
for (const path of Object.values(manifest.icons ?? {})) expected.add(path);
for (const path of Object.values(manifest.action.default_icon ?? {})) expected.add(path);
for (const entry of manifest.content_scripts) {
  assert.ok(entry.matches.every(pattern => pattern.startsWith('https://robertsspaceindustries.com/')));
  assert.equal(entry.run_at, 'document_start');
  assert.ok(!entry.all_frames);
  for (const path of [...entry.js ?? [], ...entry.css ?? []]) expected.add(path);
}
const popup = await read(manifest.action.default_popup);
for (const match of popup.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const url = new URL(match[1], new URL(manifest.action.default_popup, output));
  assert.ok(url.href.startsWith(output.href), 'popup asset must be packaged locally');
  expected.add(decodeURIComponent(url.href.slice(output.href.length)));
}
const privacyPolicy = await read('privacy-policy.html');
const canonicalPrivacyPolicy = await readFile(new URL('release/privacy-policy.html', root), 'utf8');
assert.equal(privacyPolicy, canonicalPrivacyPolicy, 'packaged policy must match the release policy users can publish');
assert.match(privacyPolicy, /RSI Enhanced Privacy Policy/);
const files = await readdir(output, { recursive: true });
const sizes = {};
for (const file of files) {
  const path = file.replaceAll('\\', '/');
  const info = await stat(new URL(path, output));
  if (!info.isFile()) continue;
  assert.ok(expected.delete(path), `unexpected packaged file: ${path}`);
  sizes[path] = info.size;
  if (path.endsWith('.css')) assert.doesNotMatch(await read(path), /@import|url\(/i);
}
assert.equal(expected.size, 0, `missing packaged assets: ${[...expected]}`);
const content = await read('content.js');
assert.doesNotThrow(() => new vm.Script(content));
const background = await read(manifest.background.service_worker);
assert.doesNotThrow(() => new vm.Script(background));
assert.match(background, /1n96sotjICGR8pw7SL74KTwrCHO6hoqRuAc2Y_fbIJaA/);
// Current, documented modules use batched observers, bounded timers and
// same-origin requests; keep rejecting polling, legacy requests and eval.
assert.doesNotMatch(content, /\b(?:setInterval|XMLHttpRequest|eval)\s*\(/);
assert.doesNotMatch(content, /localhost|127\.0\.0\.1|extension-api\.js/);
console.log(`Release package ${manifest.version}: permissions, local assets, classic entry and runtime constraints passed.`);
console.log(JSON.stringify({ directory: fileURLToPath(output), bytes: sizes, totalBytes: Object.values(sizes).reduce((sum, size) => sum + size, 0) }, null, 2));
