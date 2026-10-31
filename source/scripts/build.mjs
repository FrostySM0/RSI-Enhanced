import { build } from 'vite';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Resolve paths from this file so builds also work outside the project directory.
const root = fileURLToPath(new URL('../', import.meta.url));
const watch = process.argv.includes('--watch') ? {} : null;
const iconSizes = [16, 32, 48, 128];
const spectrumStyles = [
  ['src/themes/tokens.css', null],
  ['src/styles/avatar-shapes.css', null],
  ['src/styles/spectrum-dev-text.css', null],
  ['src/themes/spectrum-enhanced.css', 'theme'],
  ['src/styles/spectrum-foundation.css', 'theme'],
  ['src/styles/spectrum-home.css', 'theme'],
  ['src/styles/spectrum-messages.css', 'messages'],
  ['src/styles/spectrum-forums.css', 'forums'],
  ['src/styles/spectrum-saved-threads.css', 'saved-threads'],
  ['src/styles/spectrum-chat.css', 'chat'],
  ['src/styles/spectrum-friends.css', 'friends'],
  ['src/styles/spectrum-notifications.css', 'notifications'],
  ['src/themes/chris-roberts.css', 'theme'],
  ['src/styles/spectrum-blocks.css', 'blocks'],
];

const rsiStyles = ['store', 'matrix', 'organizations', 'commlink', 'account', 'hangar', 'roadmap', 'funding', 'devtracker'];
await build({
  configFile: false,
  root,
  base: './',
  publicDir: false,
  plugins: [{
    name: 'extension-assets',
    async writeBundle() {
      await copyFile(new URL('../extension/manifest.json', import.meta.url), new URL('../dist/manifest.json', import.meta.url));
      await copyFile(new URL('../release/privacy-policy.html', import.meta.url), new URL('../dist/privacy-policy.html', import.meta.url));
      await mkdir(new URL('../dist/icons/', import.meta.url), { recursive: true });
      await Promise.all(iconSizes.map(size => copyFile(
        new URL(`../extension/icons/icon${size}.png`, import.meta.url),
        new URL(`../dist/icons/icon${size}.png`, import.meta.url),
      )));
      const css = await Promise.all(spectrumStyles.map(async ([path, module]) => {
        const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
        const scope = module
          ? `:root[data-rsi-section="spectrum"]:not([data-rsi-${module}="off"])`
          : ':root[data-rsi-section="spectrum"]';
        return `@scope (${scope}) {\n${source.replaceAll(':root', ':scope')}\n}`;
      }));
      await writeFile(new URL('../dist/spectrum.css', import.meta.url), css.join('\n'));
      const rsi = await Promise.all(rsiStyles.map(async module => {
        const source = await readFile(new URL('../src/styles/rsi/' + module + '.css', import.meta.url), 'utf8');
        return '@scope (:root[data-rsi-section="' + module + '"]:not([data-rsi-' + module + '="off"])) {\n' + source + '\n}';
      }));
      const sharedAvatarStyles = await readFile(new URL('../src/styles/avatar-shapes.css', import.meta.url), 'utf8');
      const consentGatedAvatarStyles = `@scope (:root[data-rsi-consent="accepted"]) {\n${sharedAvatarStyles.replaceAll(':root', ':scope')}\n}`;
      await writeFile(new URL('../dist/rsi.css', import.meta.url), [...rsi, consentGatedAvatarStyles].join('\n'));
    },
    buildStart() {
      this.addWatchFile(fileURLToPath(new URL('../extension/manifest.json', import.meta.url)));
      this.addWatchFile(fileURLToPath(new URL('../release/privacy-policy.html', import.meta.url)));
      for (const size of iconSizes) this.addWatchFile(fileURLToPath(new URL(`../extension/icons/icon${size}.png`, import.meta.url)));
      this.addWatchFile(fileURLToPath(new URL('../src/styles/avatar-shapes.css', import.meta.url)));
      for (const module of rsiStyles) this.addWatchFile(fileURLToPath(new URL('../src/styles/rsi/' + module + '.css', import.meta.url)));
      for (const [path] of spectrumStyles) this.addWatchFile(fileURLToPath(new URL(`../${path}`, import.meta.url)));
    },
  }],
  build: {
    target: 'es2022',
    watch,
    emptyOutDir: !watch,
    rolldownOptions: { input: fileURLToPath(new URL('../src/popup/index.html', import.meta.url)) },
  },
});

// The service worker is narrowly scoped to the public, read-only funding sheet.
await build({
  configFile: false,
  root,
  publicDir: false,
  build: {
    target: 'es2022',
    watch,
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('../src/background/funding-history.ts', import.meta.url)),
      name: 'RSIEnhancedFundingHistory',
      formats: ['iife'],
      fileName: () => 'background.js',
    },
  },
});

// Content scripts need a self-contained classic script, separate from popup ESM.
await build({
  configFile: false,
  root,
  publicDir: false,
  build: {
    target: 'es2022',
    watch,
    emptyOutDir: false,
    lib: {
      entry: fileURLToPath(new URL('../src/content/index.ts', import.meta.url)),
      name: 'RSIEnhanced',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
