import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { test } from 'node:test';
import vm from 'node:vm';

test('built MV3 manifest references packaged popup and classic content script', async () => {
  const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, '1.0.0');
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://robertsspaceindustries.com/*']);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.deepEqual(manifest.host_permissions, ['https://docs.google.com/*']);
  assert.deepEqual(manifest.background, { service_worker: 'background.js' });
  await access(`dist/${manifest.action.default_popup}`);
  const background = await readFile(`dist/${manifest.background.service_worker}`, 'utf8');
  assert.doesNotThrow(() => new vm.Script(background), 'funding worker must be a classic service worker');
  const source = await readFile(`dist/${manifest.content_scripts[0].js[0]}`, 'utf8');
  assert.doesNotThrow(() => new vm.Script(source), 'content entry must remain a classic script');
});

test('browser and Web Store icons are packaged as correctly sized PNGs', async () => {
  const manifest = JSON.parse(await readFile('dist/manifest.json', 'utf8'));
  const paths = {
    16: 'icons/icon16.png',
    32: 'icons/icon32.png',
    48: 'icons/icon48.png',
    128: 'icons/icon128.png',
  };
  assert.deepEqual(manifest.icons, paths);
  assert.deepEqual(manifest.action.default_icon, paths);

  for (const [size, path] of Object.entries(paths)) {
    const png = await readFile(`dist/${path}`);
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), Number(size));
    assert.equal(png.readUInt32BE(20), Number(size));
  }

  const storeIcon = await readFile('release/CHROME-WEB-STORE-ICON-128.png');
  assert.equal(storeIcon.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(storeIcon.readUInt32BE(16), 128);
  assert.equal(storeIcon.readUInt32BE(20), 128);
});

test('popup contains only packaged script and stylesheet references', async () => {
  const html = await readFile('dist/src/popup/index.html', 'utf8');
  assert.doesNotMatch(html, /https?:\/\//);
  const paths = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(paths.some((path) => path.endsWith('.js')));
  assert.ok(paths.some((path) => path.endsWith('.css')));
  assert.ok(paths.includes('../../privacy-policy.html'));
  for (const path of paths) {
    await access(new URL(path, new URL('../dist/src/popup/index.html', import.meta.url)));
  }
  const [packagedPolicy, releasePolicy] = await Promise.all([
    readFile('dist/privacy-policy.html', 'utf8'),
    readFile('release/privacy-policy.html', 'utf8'),
  ]);
  assert.equal(packagedPolicy, releasePolicy);
});
