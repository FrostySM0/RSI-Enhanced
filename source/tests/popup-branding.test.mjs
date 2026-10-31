import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('settings popup includes the requested maker mark as a packaged local asset', async () => {
  const source = await readFile('src/popup/index.html', 'utf8');
  const sourceCss = await readFile('src/popup/popup.css', 'utf8');
  const built = await readFile('dist/src/popup/index.html', 'utf8');

  assert.match(source, /Made by Frosty assisted with AI/);
  assert.match(source, /class="maker-mark__logo"[^>]*alt=""/,
    'the neighboring text supplies the badge meaning for assistive technology');
  assert.match(sourceCss, /\.maker-mark\s*\{[^}]*position:\s*absolute;[^}]*top:[^;]+;[^}]*right:[^;]+;/s,
    'the maker mark sits in the settings header’s top-right corner');
  assert.match(sourceCss, /\.maker-mark__logo\s*\{[^}]*width:\s*36px;[^}]*height:\s*36px;/s,
    'the seal remains compact in the popup header');

  const image = built.match(/class="maker-mark__logo"[^>]*src="([^"]+)"/);
  assert.ok(image, 'the built settings page includes the maker seal image');
  await access(new URL(image[1], new URL('../dist/src/popup/index.html', import.meta.url)));
  assert.match(built, /Made by Frosty assisted with AI/);
});
