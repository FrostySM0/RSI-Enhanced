import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const css = await readFile('src/styles/rsi/organizations.css', 'utf8');
const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, '');
const packagedCss = (await readFile('dist/rsi.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');

function ruleBodies(selector, source = cleanCss) {
  const bodies = [];
  for (const [, selectors, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(',').some((candidate) => candidate.trim() === selector)) bodies.push(body);
  }
  return bodies;
}

function ruleBody(selector) {
  return ruleBodies(selector)[0] ?? '';
}

test('Organizations hub widens its real page shell and layers the title over the native hero', () => {
  const shell = ruleBody('#organization-page #bodyWrapper > .page-wrapper > #contentbody > #channel > #organization.hub > .wrapper');
  assert.match(shell, /width:\s*min\(1600px,\s*calc\(100%\s*-\s*48px\)\)/);
  assert.match(shell, /max-width:\s*none/);
  assert.match(shell, /margin:\s*26px auto 44px/);

  const title = ruleBody('#organization-page #bodyWrapper #organization.hub > .wrapper > .page-title');
  const hero = ruleBody('#organization-page #bodyWrapper #organization.hub > .wrapper > .header');
  assert.match(title, /grid-area:\s*hero/);
  assert.match(title, /z-index:\s*2/);
  assert.match(hero, /grid-area:\s*hero/);
  assert.match(hero, /min-height:\s*236px/);
  assert.doesNotMatch(css, /width:\s*min\(1560px,\s*calc\(100vw/);
  assert.doesNotMatch(css, /margin-inline:\s*calc\(50%\s*-\s*50vw/);
});

test('Organizations hub title keeps its logo beside the text and removes native line decorations', () => {
  const selector = '#organization-page #bodyWrapper #organization.hub > .wrapper > .page-title';
  const lines = ['.top-line', '.inner-line', '.bottom-line'].map(className => `${selector} > ${className}`);
  const icon = `${selector} > .icon`;
  for (const source of [cleanCss, packagedCss]) {
    const title = ruleBodies(selector, source)[0] ?? '';
    const logo = ruleBodies(icon, source)[0] ?? '';

    assert.match(title, /display:\s*flex/);
    assert.match(title, /align-items:\s*center/);
    assert.match(title, /gap:\s*16px/);
    for (const line of lines) assert.match(ruleBodies(line, source)[0] ?? '', /display:\s*none\s*!important/);
    assert.match(logo, /position:\s*relative\s*!important/);
    assert.match(logo, /inset:\s*auto\s*!important/);
    assert.match(logo, /display:\s*block\s*!important/);
    assert.match(logo, /transform:\s*translateY\(4px\)\s*!important/);
    assert.match(logo, /background:\s*none\s*!important/);
    assert.match(logo, /flex:\s*0 0 40px/);
    const groupMark = ruleBodies(`${icon}::before`, source)[0] ?? '';
    assert.equal((groupMark.match(/radial-gradient\(/g) ?? []).length, 6);
    assert.match(groupMark, /background:[\s\S]*var\(--rsi-accent\)/);
    assert.doesNotMatch(`${logo}${groupMark}`, /url\(|modal_title_icon\.png/);
  }
});

test('native New & Rising, Most Active, and Largest feeds form three separate columns', () => {
  const feed = ruleBody('#organization-page #bodyWrapper #organization.hub .content-block1');
  const left = ruleBody('#organization-page #bodyWrapper #organization.hub .content-block1 > .listing-wrapper.left');
  const right = ruleBody('#organization-page #bodyWrapper #organization.hub .content-block1 > .listing-wrapper.right');
  assert.match(feed, /display:\s*grid/);
  assert.match(feed, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(left, /grid-column:\s*1/);
  assert.match(left, /float:\s*none/);
  assert.match(right, /grid-column:\s*2\s*\/\s*4/);
  assert.match(right, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /\.listing-wrapper\.right > \.heading\.pad \+ \.orgs-listing/);

  const cards = ruleBody('#organization-page #bodyWrapper #organization.hub .org-cell > a');
  assert.match(cards, /min-width:\s*0/);
  assert.match(cards, /background:[^;]*var\(--rsi-surface\)/);
});

test('hub hero actions render cleanly and the title follows the extension accent hierarchy', () => {
  const title = ruleBody('#organization-page #bodyWrapper #organization.hub > .wrapper > .page-title');
  const icon = ruleBody('#organization-page #bodyWrapper #organization.hub > .wrapper > .header .links .icon');
  const label = ruleBody('#organization-page #bodyWrapper #organization.hub > .wrapper > .header .links .label');

  assert.match(title, /color:\s*var\(--rsi-accent\)/);
  assert.match(title, /font:\s*700\s+clamp\(26px,\s*2\.5vw,\s*38px\)/);
  assert.match(icon, /display:\s*none/);
  assert.match(label, /font:\s*700\s+14px/);
});

test('List All, Find, and Create share the same neutral hero-button style', () => {
  assert.doesNotMatch(css, /\.header \.links a\[href\*="\/community\/orgs\/listing"\]/);
});

test('organization card identity, metadata, and section actions remain readable at desktop width', () => {
  const name = ruleBody('#organization-page #bodyWrapper #organization.hub .org-cell .name');
  const symbol = ruleBody('#organization-page #bodyWrapper #organization.hub .org-cell .symbol');
  const metadata = ruleBody('#organization-page #bodyWrapper #organization.hub .org-cell .infocontainer');
  const info = ruleBody('#organization-page #bodyWrapper #organization.hub .org-cell .infoitem');
  const viewAll = ruleBody('#organization-page #bodyWrapper #organization.hub .listing-wrapper .heading a');

  assert.match(name, /font:\s*700\s+16px/);
  assert.match(symbol, /font:\s*600\s+12px/);
  assert.match(metadata, /display:\s*grid/);
  assert.match(metadata, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(info, /font:\s*400\s+12px/);
  assert.match(viewAll, /font:\s*650\s+13px/);
});

test('directory search, filters, sorting, and result cards stay native and use the expanded shell', () => {
  const listingShell = ruleBody('#organization-page #bodyWrapper > .page-wrapper > #contentbody > #channel > #organization.public.search > .wrapper');
  const search = ruleBody('#organization-page #bodyWrapper #search-orgs');
  const searchBarFilters = ruleBodies('#organization-page #bodyWrapper #search-orgs .search-bar-filters').at(-1) ?? '';
  const packagedSearchBarFilters = ruleBodies('#organization-page #bodyWrapper #search-orgs .search-bar-filters', packagedCss).at(-1) ?? '';
  const results = ruleBody('#organization-page #bodyWrapper #orgs-search-listing');
  assert.match(listingShell, /width:\s*min\(1600px,\s*calc\(100%\s*-\s*48px\)\)/);
  assert.match(search, /background:/);
  assert.match(searchBarFilters, /padding:\s*0/);
  assert.match(packagedSearchBarFilters, /padding:\s*0/);
  assert.match(results, /display:\s*grid/);
  assert.match(results, /grid-template-columns:\s*repeat\(auto-fit/);
  assert.match(css, /#organization-page #bodyWrapper #search-orgs :is\(input, select, textarea, button\)\s*\{[^}]*font-family:\s*var\(--rsi-selected-font-family/s);
  const languageSelect = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group select').at(-1) ?? '';
  const languageControl = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist').at(-1) ?? '';
  const packagedLanguageControl = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist', packagedCss).at(-1) ?? '';
  const languageValue = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist > span').at(-1) ?? '';
  const packagedLanguageValue = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist > span', packagedCss).at(-1) ?? '';
  const languageArrow = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist > .arrow').at(-1) ?? '';
  const packagedLanguageArrow = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist > .arrow', packagedCss).at(-1) ?? '';
  const refineArrow = ruleBodies('#organization-page #bodyWrapper #search-orgs .search-bar-title .js-expand-searchform .arrow').at(-1) ?? '';
  const packagedRefineArrow = ruleBodies('#organization-page #bodyWrapper #search-orgs .search-bar-title .js-expand-searchform .arrow', packagedCss).at(-1) ?? '';
  const languageMenu = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist .scrollable').at(-1) ?? '';
  const languageViewport = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist .scrollable .viewport').at(-1) ?? '';
  const packagedLanguageViewport = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist .scrollable .viewport', packagedCss).at(-1) ?? '';
  const languageMenuContent = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist .scrollable .viewport .content, #organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist .scrollable .viewport .content > ul').at(-1) ?? '';
  const packagedLanguageMenuContent = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist .scrollable .viewport .content, #organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist .scrollable .viewport .content > ul', packagedCss).at(-1) ?? '';
  const languageItems = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist .scrollable .viewport .content > ul > .js-option').at(-1) ?? '';
  const packagedLanguageItems = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .js-selectlist .scrollable .viewport .content > ul > .js-option', packagedCss).at(-1) ?? '';
  const refineTitle = ruleBodies('#organization-page #bodyWrapper #search-orgs .search-bar-title').at(-1) ?? '';
  const packagedRefineTitle = ruleBodies('#organization-page #bodyWrapper #search-orgs .search-bar-title', packagedCss).at(-1) ?? '';
  const refineLink = ruleBodies('#organization-page #bodyWrapper #search-orgs .search-bar-title .title').at(-1) ?? '';
  const packagedRefineLink = ruleBodies('#organization-page #bodyWrapper #search-orgs .search-bar-title .title', packagedCss).at(-1) ?? '';
  const nativeCheckboxMarker = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .checkbox > span').at(-1) ?? '';
  const packagedNativeCheckboxMarker = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .checkbox > span', packagedCss).at(-1) ?? '';
  const checkboxLabel = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .checkbox').at(-1) ?? '';
  const packagedCheckboxLabel = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group > .checkbox', packagedCss).at(-1) ?? '';
  const resetLink = ruleBodies('#organization-page #bodyWrapper #search-orgs .reset-filters').at(-1) ?? '';
  const packagedResetLink = ruleBodies('#organization-page #bodyWrapper #search-orgs .reset-filters', packagedCss).at(-1) ?? '';
  const resetDecoration = css.match(/#organization-page #bodyWrapper #search-orgs \.reset-filters :is\(\.icon, \.left-section, \.right-section\)\s*\{([^}]+)\}/)?.[1] ?? '';
  const filterCheckbox = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group input[type="checkbox"]').at(-1) ?? '';
  const packagedCheckbox = ruleBodies('#organization-page #bodyWrapper #search-orgs .filter-group input[type="checkbox"]', packagedCss).at(-1) ?? '';
  const searchButton = css.match(/#organization-page #bodyWrapper #search-orgs :is\(input\[type="submit"\], input\[type="reset"\], button\)\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(languageSelect, /width:\s*100%/);
  assert.match(languageSelect, /min-width:\s*0/);
  assert.match(languageControl, /width:\s*100%/);
  assert.match(languageControl, /flex:\s*1\s+1\s+100%/);
  assert.match(languageControl, /height:\s*42px/);
  assert.match(languageControl, /margin:\s*0/);
  assert.match(packagedLanguageControl, /width:\s*100%/);
  assert.match(packagedLanguageControl, /height:\s*42px/);
  assert.match(languageValue, /height:\s*40px/);
  assert.match(languageValue, /padding-block:\s*0/);
  assert.match(languageValue, /line-height:\s*40px/);
  assert.match(packagedLanguageValue, /line-height:\s*40px/);
  assert.match(languageArrow, /height:\s*40px/);
  assert.match(packagedLanguageArrow, /height:\s*40px/);
  assert.match(refineArrow, /filter:\s*brightness\(1\.55\) drop-shadow\(/);
  assert.match(packagedRefineArrow, /filter:\s*brightness\(1\.55\) drop-shadow\(/);
  assert.match(refineTitle, /display:\s*flex/);
  assert.match(refineTitle, /align-items:\s*center/);
  assert.match(refineTitle, /min-height:\s*42px/);
  assert.match(packagedRefineTitle, /align-items:\s*center/);
  assert.match(refineLink, /display:\s*inline-flex/);
  assert.match(refineLink, /align-items:\s*center/);
  assert.match(refineLink, /min-height:\s*42px/);
  assert.match(refineLink, /padding:\s*0/);
  assert.match(packagedRefineLink, /padding:\s*0/);
  assert.doesNotMatch(languageMenu, /(?:left|width|min-width|max-width|overflow):/);
  assert.doesNotMatch(languageViewport, /width:/);
  assert.doesNotMatch(packagedLanguageViewport, /width:/);
  assert.doesNotMatch(languageMenuContent, /(?:width|min-width|max-width|margin):/);
  assert.doesNotMatch(packagedLanguageMenuContent, /(?:width|min-width|max-width|margin):/);
  assert.match(languageItems, /color:\s*var\(--rsi-text\)/);
  assert.match(packagedLanguageItems, /color:\s*var\(--rsi-text\)/);
  assert.doesNotMatch(languageItems, /(?:display:\s*none|visibility:\s*hidden|color:\s*transparent)/);
  assert.match(filterCheckbox, /width:\s*16px/);
  assert.match(filterCheckbox, /border:\s*1px solid var\(--rsi-border\)/);
  assert.match(filterCheckbox, /opacity:\s*1\s*!important/);
  assert.match(packagedCheckbox, /opacity:\s*1\s*!important/);
  assert.match(nativeCheckboxMarker, /background-image:\s*none\s*!important/);
  assert.match(nativeCheckboxMarker, /padding:\s*0\s*!important/);
  assert.match(packagedNativeCheckboxMarker, /background-image:\s*none\s*!important/);
  assert.match(packagedNativeCheckboxMarker, /padding:\s*0\s*!important/);
  assert.match(checkboxLabel, /gap:\s*10px/);
  assert.match(packagedCheckboxLabel, /gap:\s*10px/);
  assert.match(searchButton, /border:\s*1px solid var\(--rsi-accent\)/);
  assert.match(resetLink, /border:\s*1px solid var\(--rsi-border\)/);
  assert.match(resetLink, /background:\s*var\(--rsi-raised\)/);
  assert.match(resetLink, /width:\s*100%/);
  assert.match(packagedResetLink, /border:\s*1px solid var\(--rsi-border\)/);
  assert.match(packagedResetLink, /width:\s*100%/);
  assert.match(resetDecoration, /display:\s*none/);
  assert.match(ruleBody('#organization-page #bodyWrapper #organization.public.search .org-cell > a'), /min-height:\s*104px/);
});

test('List All title marker and directory cards have enough room for all native metadata', () => {
  const title = ruleBodies('#organization-page #bodyWrapper #organization.public.search > .wrapper > .page-title').find((body) => /display:\s*flex/.test(body)) ?? '';
  const marker = ruleBody('#organization-page #bodyWrapper #organization.public.search > .wrapper > .page-title::before');
  const card = ruleBodies('#organization-page #bodyWrapper #organization.public.search .org-cell > a').find((body) => /display:\s*grid/.test(body)) ?? '';
  const cardShell = ruleBodies('#organization-page #bodyWrapper #organization.public.search .org-cell').at(-1) ?? '';
  const identity = ruleBodies('#organization-page #bodyWrapper #organization.public.search .org-cell .left').find((body) => /grid-column:\s*1/.test(body)) ?? '';
  const details = ruleBody('#organization-page #bodyWrapper #organization.public.search .org-cell > a .right');
  const metadata = ruleBodies('#organization-page #bodyWrapper #organization.public.search .org-cell .infocontainer').find((body) => /display:\s*contents\s*!important/.test(body)) ?? '';
  const infoItems = ruleBodies('#organization-page #bodyWrapper #organization.public.search .org-cell .infoitem').find((body) => /overflow-wrap:\s*anywhere/.test(body)) ?? '';

  assert.match(title, /display:\s*flex/);
  assert.match(title, /align-items:\s*center/);
  assert.match(marker, /content:\s*""/);
  assert.match(marker, /border-left:\s*12px solid var\(--rsi-accent\)/);
  assert.match(cardShell, /height:\s*auto\s*!important/);
  assert.match(cardShell, /max-height:\s*none\s*!important/);
  assert.match(cardShell, /overflow:\s*visible\s*!important/);
  assert.match(details, /position:\s*static/);
  assert.match(details, /inset:\s*auto/);
  assert.match(details, /display:\s*grid\s*!important/);
  assert.match(details, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(details, /grid-auto-flow:\s*row/);
  assert.match(card, /display:\s*grid/);
  assert.match(card, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(card, /height:\s*auto\s*!important/);
  assert.match(card, /max-height:\s*none\s*!important/);
  assert.match(card, /min-height:\s*170px/);
  assert.match(card, /overflow:\s*visible\s*!important/);
  assert.match(identity, /grid-column:\s*1/);
  assert.match(details, /width:\s*100%/);
  assert.match(details, /margin:\s*0\s*!important/);
  assert.match(details, /height:\s*auto/);
  assert.match(details, /min-height:\s*0/);
  assert.match(details, /align-content:\s*start/);
  assert.match(metadata, /position:\s*static/);
  assert.match(metadata, /inset:\s*auto/);
  assert.match(metadata, /height:\s*auto\s*!important/);
  assert.match(metadata, /margin:\s*0\s*!important/);
  assert.match(metadata, /padding:\s*0\s*!important/);
  assert.match(metadata, /grid-template-columns:\s*none/);
  assert.match(infoItems, /position:\s*static\s*!important/);
  assert.match(infoItems, /inset:\s*auto\s*!important/);
  assert.match(infoItems, /height:\s*auto\s*!important/);
  assert.match(infoItems, /margin:\s*0\s*!important/);
});

test('directory title keeps its arrow in flow and removes the cyan top rule', () => {
  const selector = '#organization-page #bodyWrapper #organization.public.search > .wrapper > .page-title';
  for (const source of [cleanCss, packagedCss]) {
    const title = ruleBodies(selector, source)[0] ?? '';
    const marker = ruleBodies(`${selector}::before`, source)[0] ?? '';

    assert.match(title, /border-top:\s*0/);
    assert.match(title, /gap:\s*16px/);
    assert.match(marker, /position:\s*relative\s*!important/);
    assert.match(marker, /inset:\s*auto\s*!important/);
    assert.match(marker, /align-self:\s*center/);
    assert.match(marker, /transform:\s*translateY\(4px\)\s*!important/);
  }
});

test('Organizations styles do not reach the shared RSI header and keep selected fonts and theme tokens', () => {
  assert.doesNotMatch(css, /#platform-bar-(?:head|navigation)|\.o-navigation(?:Head|Bar)/);
  assert.doesNotMatch(css, /^#organization-page\s+(?!#bodyWrapper)[^{]*\{/m);
  assert.match(css, /var\(--rsi-selected-font-family/);
  assert.match(css, /var\(--rsi-accent\)/);
  assert.match(css, /#organization-page #bodyWrapper #organization \.content-tab/);
  assert.match(css, /#organization-page #bodyWrapper #organization \.tab-title/);
});

test('public organization profiles use the widened hero and preserve the selected site font', () => {
  const shell = ruleBodies('#organization-page #bodyWrapper > .page-wrapper > #contentbody.public.profile > #organization.public > .wrapper').find((body) => /width:\s*min\(1560px/.test(body)) ?? '';
  const content = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content-wrapper').find((body) => /display:\s*grid/.test(body)) ?? '';
  const identity = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .heading .inner').find((body) => /var\(--rsi-selected-font-family/.test(body)) ?? '';

  assert.match(shell, /width:\s*min\(1560px,\s*calc\(100%\s*-\s*64px\)\)/);
  assert.match(shell, /max-width:\s*none/);
  assert.match(content, /display:\s*grid/);
  assert.match(css, /#organization-page #bodyWrapper #contentbody\.public\.profile #organization\.public \.heading\s*\{[^}]*display:\s*grid/s);
  assert.match(identity, /var\(--rsi-selected-font-family/);
  assert.match(css, /#organization-page #bodyWrapper #contentbody\.public\.profile #organization\.public/);
});

test('organization profile banners fill the hero area', () => {
  const selector = '#organization-page #bodyWrapper #contentbody.public.profile #organization.public .heading .banner img';
  const bannerImages = [ruleBodies(selector).at(-1) ?? '', ruleBodies(selector, packagedCss).at(-1) ?? ''];

  for (const [index, bannerImage] of bannerImages.entries()) {
    const source = index === 0 ? 'source CSS' : 'packaged CSS';
    assert.match(bannerImage, /width:\s*100%/, `${source} fills the hero width`);
    assert.match(bannerImage, /height:\s*100%/, `${source} fills the hero height`);
    assert.match(bannerImage, /object-fit:\s*cover/, `${source} covers the hero frame`);
  }
});

test('organization profile tabs and authored text stay in natural readable flow', () => {
  const description = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content.block.description').find((body) => /font-family:/.test(body)) ?? '';
  const tabContent = ruleBody('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content-tab-wrapper');
  const article = ruleBody('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content-tab .markitup-text');

  assert.match(description, /font-family:\s*var\(--rsi-selected-font-family/);
  assert.match(tabContent, /overflow:\s*visible/);
  assert.match(article, /line-height:\s*1\.7/);
  assert.doesNotMatch(description, /height:\s*\d+px/);
});

test('organization profile removes the native divider between the text tabs and content', () => {
  const separator = ruleBody('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content.block.description > hr');
  assert.match(separator, /display:\s*none\s*!important/);
});

test('profile uses the approved hero and two-column overview hierarchy with grouped media', () => {
  const content = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content-wrapper').find((body) => /grid-template-areas:[^;]*"hero hero"/s.test(body)) ?? '';
  const hero = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .heading').find((body) => /grid-area:\s*hero/.test(body)) ?? '';
  const identity = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .heading .inner').find((body) => /grid-template-columns:\s*144px[^;]*154px/.test(body)) ?? '';
  const mission = ruleBody('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .rsi-org-mission-panel');
  const tabs = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content.join-us .subnav-wrapper').find((body) => /grid-area:\s*tabs/.test(body)) ?? '';
  const description = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content.block.description').at(-1) ?? '';
  const aside = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .rsi-org-overview-sidebar').find((body) => /grid-area:\s*aside/.test(body)) ?? '';
  const mediaPanel = ruleBody('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .rsi-org-media-panel');
  const mediaCaption = ruleBody('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .rsi-org-media-caption');
  const mediaGrid = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .rsi-org-media-grid').find((body) => /grid-template-columns:\s*repeat\(2/.test(body)) ?? '';
  const image = ruleBody('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content.block.cover .rsi-org-media-visual img');
  const playerContainer = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content.block.youtube .embed-container').at(-1) ?? '';
  const player = ruleBodies('#organization-page #bodyWrapper #contentbody.public.profile #organization.public .content.block.youtube .embed-container #ytplayer').at(-1) ?? '';

  assert.match(content, /grid-template-columns:\s*minmax\(0,\s*1\.9fr\)\s+minmax\(300px,\s*\.8fr\)/);
  assert.match(content, /grid-template-areas:[^;]*"hero hero"[^;]*"tabs tabs"[^;]*"mission aside"[^;]*"sections aside"[^;]*"media media"/s);
  assert.match(hero, /grid-area:\s*hero/);
  assert.match(identity, /grid-template-columns:\s*144px\s+minmax\(300px,\s*1fr\)\s+minmax\(265px,\s*390px\)\s+154px/);
  assert.match(mission, /grid-area:\s*mission/);
  assert.match(tabs, /grid-area:\s*tabs/);
  assert.match(description, /grid-area:\s*sections/);
  assert.match(aside, /grid-area:\s*aside/);
  assert.match(mediaPanel, /grid-area:\s*media/);
  assert.match(mediaCaption, /display:\s*flex/);
  assert.match(mediaCaption, /justify-content:\s*space-between/);
  assert.match(mediaGrid, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(image, /height:\s*100%/);
  assert.match(image, /object-fit:\s*contain/);
  assert.match(playerContainer, /aspect-ratio:\s*16\s*\/\s*9/);
  assert.match(player, /width:\s*100%/);
  assert.match(player, /height:\s*100%/);
  assert.doesNotMatch(player, /display:\s*none/);
});

test('profile overrides native floats and intrinsic widths that break the mockup layout', () => {
  const selector = '#organization-page #bodyWrapper #contentbody.public.profile #organization.public';
  const identity = ruleBodies(`${selector} .heading .inner`).at(-1) ?? '';
  const identityGrid = ruleBodies(`${selector} .heading .inner`).find((body) => /grid-template-columns:\s*144px[^;]*154px/.test(body)) ?? '';
  const title = ruleBodies(`${selector} .heading h1`).at(-1) ?? '';
  const sidebar = ruleBodies(`${selector} .rsi-org-overview-sidebar`).at(-1) ?? '';
  const logo = ruleBodies(`${selector} .heading .logo`).find((body) => /width:\s*144px\s*!important/.test(body)) ?? '';
  const identityCopy = ruleBodies(`${selector} .rsi-org-identity-copy`).find((body) => /grid-column:\s*2/.test(body)) ?? '';
  const identityStats = ruleBodies(`${selector} .rsi-org-identity-stats`).find((body) => /grid-column:\s*3/.test(body)) ?? '';
  const joinAction = ruleBodies(`${selector} .content.join-us .subnav-wrapper > .holobtn`).find((body) => /position:\s*absolute/.test(body)) ?? '';
  const tabNav = ruleBodies(`${selector} .content.block.description .nav`).at(-1) ?? '';
  const tabItem = ruleBodies(`${selector} .content.block.description .nav li`).at(-1) ?? '';
  const tabButton = ruleBodies(`${selector} .content.block.description .nav a`).at(-1) ?? '';
  const memberTab = ruleBodies(`${selector} .content.join-us .subnav a`).at(-1) ?? '';
  const memberCount = ruleBodies(`${selector} .rsi-org-tab-count`).at(-1) ?? '';
  const tabWrapper = ruleBodies(`${selector} .content-tab-wrapper`).at(-1) ?? '';
  const tabContent = ruleBodies(`${selector} .content.block.description .content-tab`).at(-1) ?? '';

  assert.match(identity, /width:\s*100%/);
  assert.match(identityGrid, /grid-template-columns:\s*144px\s+minmax\(300px,\s*1fr\)\s+minmax\(265px,\s*390px\)\s+154px/);
  assert.match(title, /float:\s*none\s*!important/);
  assert.match(title, /width:\s*100%\s*!important/);
  assert.match(logo, /position:\s*relative\s*!important/);
  assert.match(logo, /box-sizing:\s*border-box\s*!important/);
  assert.match(logo, /grid-column:\s*1/);
  assert.match(logo, /grid-row:\s*1/);
  assert.match(logo, /width:\s*144px\s*!important/);
  assert.match(logo, /height:\s*144px\s*!important/);
  assert.match(logo, /margin:\s*-46px\s+0\s+0\s*!important/);
  assert.match(identityCopy, /grid-column:\s*2/);
  assert.match(identityStats, /grid-column:\s*3/);
  assert.match(sidebar, /align-content:\s*start/);
  assert.match(sidebar, /align-self:\s*start/);
  assert.match(joinAction, /width:\s*154px\s*!important/);
  assert.match(tabNav, /float:\s*none\s*!important/);
  assert.match(tabNav, /width:\s*100%\s*!important/);
  assert.match(tabItem, /width:\s*auto\s*!important/);
  assert.match(tabNav, /min-height:\s*52px\s*!important/);
  assert.match(tabNav, /flex-wrap:\s*wrap\s*!important/);
  assert.match(tabItem, /flex:\s*0\s+0\s+auto\s*!important/);
  assert.match(tabItem, /max-width:\s*none\s*!important/);
  assert.match(tabButton, /width:\s*auto\s*!important/);
  assert.match(tabButton, /height:\s*auto\s*!important/);
  assert.match(tabButton, /min-height:\s*35px\s*!important/);
  assert.match(tabButton, /flex-direction:\s*row\s*!important/);
  assert.doesNotMatch(cleanCss, /\.content\.block\.description \.nav (?:a|button)\s*>\s*:first-child:not\(:last-child\)/,
    'tab labels must not be hidden by guessing that the first child is an icon');
  for (const pseudoTarget of ['li::before', 'li::after', 'a::before', 'a::after', 'button::before', 'button::after']) {
    const tabDecoration = ruleBodies(`${selector} .content.block.description .nav ${pseudoTarget}`).at(-1) ?? '';
    assert.match(tabDecoration, /display:\s*none\s*!important/, `${pseudoTarget} must not render native tile/marker decoration`);
  }
  for (const pseudoTarget of ['::before', '::after']) {
    const tabDecoration = ruleBodies(`${selector} .content.block.description .nav${pseudoTarget}`).at(-1) ?? '';
    assert.match(tabDecoration, /display:\s*none\s*!important/, `nav${pseudoTarget} must not render the native divider/hex artwork`);
  }
  const tabIcon = ruleBodies(`${selector} .content.block.description .nav a > .ico`).at(-1) ?? '';
  assert.match(tabIcon, /display:\s*none\s*!important/);
  const activeTab = ruleBodies(`${selector} .content.block.description .nav li.active > a`).at(-1) ?? '';
  assert.match(activeTab, /border:/);
  assert.match(activeTab, /background:/);
  assert.match(memberTab, /display:\s*inline-flex\s*!important/);
  assert.match(memberTab, /flex-direction:\s*row\s*!important/);
  assert.match(memberCount, /display:\s*inline-flex\s*!important/);
  assert.match(memberCount, /position:\s*static\s*!important/);
  assert.match(memberCount, /white-space:\s*nowrap\s*!important/);
  assert.match(tabWrapper, /clear:\s*both/);
  assert.match(tabWrapper, /float:\s*none\s*!important/);
  assert.match(tabWrapper, /height:\s*auto\s*!important/);
  assert.match(tabContent, /float:\s*none\s*!important/);
});

test('built Organizations stylesheet includes the in-flow logo and compact inline profile tabs', () => {
  const selector = '#organization-page #bodyWrapper #contentbody.public.profile #organization.public';
  const packagedLogo = ruleBodies(`${selector} .heading .logo`, packagedCss).find((body) => /width:\s*144px\s*!important/.test(body)) ?? '';
  const packagedTabNav = ruleBodies(`${selector} .content.block.description .nav`, packagedCss).at(-1) ?? '';
  const packagedTabItem = ruleBodies(`${selector} .content.block.description .nav li`, packagedCss).at(-1) ?? '';
  const packagedTabButton = ruleBodies(`${selector} .content.block.description .nav a`, packagedCss).at(-1) ?? '';
  const packagedMemberTab = ruleBodies(`${selector} .content.join-us .subnav a`, packagedCss).at(-1) ?? '';
  const packagedMemberCount = ruleBodies(`${selector} .rsi-org-tab-count`, packagedCss).at(-1) ?? '';
  const packagedMediaHeading = ruleBodies(`${selector} .rsi-org-media-panel > .rsi-org-panel-heading`, packagedCss).at(-1) ?? '';
  const packagedActiveTab = ruleBodies(`${selector} .content.block.description .nav li.active > a`, packagedCss).at(-1) ?? '';

  assert.match(packagedLogo, /position:\s*relative\s*!important/);
  assert.match(packagedLogo, /grid-column:\s*1/);
  assert.match(packagedLogo, /width:\s*144px\s*!important/);
  assert.match(packagedTabNav, /min-height:\s*52px\s*!important/);
  assert.match(packagedTabItem, /flex:\s*0\s+0\s+auto\s*!important/);
  assert.match(packagedTabItem, /max-width:\s*none\s*!important/);
  assert.match(packagedTabButton, /height:\s*auto\s*!important/);
  assert.match(packagedTabButton, /flex-direction:\s*row\s*!important/);
  assert.doesNotMatch(packagedCss, /\.content\.block\.description \.nav (?:a|button)\s*>\s*:first-child:not\(:last-child\)/);
  for (const pseudoTarget of ['li::before', 'li::after', 'a::before', 'a::after', 'button::before', 'button::after']) {
    const packagedTabDecoration = ruleBodies(`${selector} .content.block.description .nav ${pseudoTarget}`, packagedCss).at(-1) ?? '';
    assert.match(packagedTabDecoration, /display:\s*none\s*!important/, `packaged ${pseudoTarget} must not render native tile/marker decoration`);
  }
  for (const pseudoTarget of ['::before', '::after']) {
    const packagedTabDecoration = ruleBodies(`${selector} .content.block.description .nav${pseudoTarget}`, packagedCss).at(-1) ?? '';
    assert.match(packagedTabDecoration, /display:\s*none\s*!important/, `packaged nav${pseudoTarget} must not render native divider/hex artwork`);
  }
  const packagedTabSeparator = ruleBodies(`${selector} .content.block.description > hr`, packagedCss).at(-1) ?? '';
  assert.match(packagedTabSeparator, /display:\s*none\s*!important/);
  const packagedTabIcon = ruleBodies(`${selector} .content.block.description .nav a > .ico`, packagedCss).at(-1) ?? '';
  assert.match(packagedTabIcon, /display:\s*none\s*!important/);
  assert.match(packagedActiveTab, /background:/);
  assert.match(packagedMemberTab, /flex-direction:\s*row\s*!important/);
  assert.match(packagedMemberCount, /display:\s*inline-flex\s*!important/);
  assert.match(packagedMediaHeading, /padding-block:\s*14px/);
});
