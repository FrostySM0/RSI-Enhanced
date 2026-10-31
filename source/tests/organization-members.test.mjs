import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';

const css = (await readFile('src/styles/rsi/organizations.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const packagedCss = (await readFile('dist/rsi.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
const profileRuntime = await readFile('src/content/organization-profile.ts', 'utf8');

function ruleBody(source, selector) {
  for (const [, selectors, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(',').some(candidate => candidate.trim() === selector)) return body;
  }
  return '';
}

function ruleBodies(source, selector) {
  const bodies = [];
  for (const [, selectors, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (selectors.split(',').some(candidate => candidate.trim() === selector)) bodies.push(body);
  }
  return bodies.join('\n');
}

const page = '#organization-page #bodyWrapper #organization.public:has(#members-data)';

test('native member search and filters are restyled without replacing their controls', () => {
  const form = ruleBody(css, `${page} form.search-members`);
  const filters = ruleBody(css, `${page} form.search-members .filter-members`);
  const options = ruleBody(css, `${page} form.search-members .filter-members label.radio`);

  assert.match(form, /display:\s*grid/);
  assert.match(form, /grid-template-columns:/);
  assert.match(filters, /display:\s*block/);
  assert.match(options, /display:\s*inline-flex/);
  assert.ok(css.includes(`${page} form.search-members fieldset.name :is(.js-send, .js-reset)`));
  const actions = css.match(/#organization-page #bodyWrapper #organization\.public:has\(#members-data\) form\.search-members fieldset\.name :is\(\.js-send, \.js-reset\)\s*\{([^}]*)\}/)?.[1] ?? '';
  assert.match(actions, /display:\s*inline-flex/);
});

test('first Rank and Role filter choices align with the options below them', () => {
  const firstOptions = ruleBody(css, `${page} form.search-members .filter-members > .inner > label.radio:first-child`);

  assert.match(firstOptions, /margin-left:\s*-7px\s*!important/);
  assert.match(firstOptions, /transform:\s*none\s*!important/);
});

test('native member list is the three-column grid so scroll-appended entries inherit the card layout', () => {
  const list = ruleBody(css, `${page} #members-data`);
  const item = ruleBody(css, `${page} #members-data > .member-item`);
  const card = ruleBody(css, `${page} #members-data > .member-item > .membercard`);

  assert.match(list, /display:\s*grid/);
  assert.match(list, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(list, /gap:\s*12px/);
  assert.match(item, /min-width:\s*0/);
  assert.match(card, /display:\s*grid/);
  assert.match(card, /grid-template-columns:\s*54px\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(css, /#members-data\s*>\s*\.member-item:first-child/);
});

test('member cards preserve avatars and links while presenting rank, role, and membership', () => {
  const anchor = ruleBody(css, `${page} #members-data > .member-item > .membercard`);
  const avatar = ruleBody(css, `${page} #members-data .membercard .thumb img`);
  const facts = ruleBody(css, `${page} #members-data .membercard > .right`);
  const rank = ruleBody(css, `${page} #members-data .membercard .rank::before`);
  const emptyRole = ruleBody(css, `${page} #members-data .membercard .rolelist:not(:has(li))::after`);
  const membershipLabel = ruleBodies(css, `${page} #members-data > .member-item.org-main > .membercard > .right::before`);
  const membershipValue = ruleBodies(css, `${page} #members-data > .member-item.org-main > .membercard > .right::after`);

  assert.match(anchor, /display:\s*grid/);
  assert.match(anchor, /text-decoration:\s*none/);
  assert.match(avatar, /object-fit:\s*cover/);
  assert.match(facts, /display:\s*grid/);
  assert.match(facts, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)\s+auto\s+auto/);
  assert.match(rank, /content:\s*["']Rank/);
  assert.match(emptyRole, /content:\s*["']Member/);
  assert.match(membershipLabel, /content:\s*["']Membership/);
  assert.match(membershipValue, /content:\s*["']Main/);
});

test('member redesign is organization-generic, confined to the page body, and packaged', () => {
  assert.doesNotMatch(css, /ITCN|Interstellar Trading Corporation/);
  assert.doesNotMatch(css, /^#organization-page\s+(?!#bodyWrapper)[^{]*\{/m);
  assert.ok(packagedCss.includes('@scope (:root[data-rsi-section="organizations"]:not([data-rsi-organizations="off"]))'));
  assert.ok(packagedCss.includes('#members-data > .member-item'));
  assert.match(css, /@media\s*\(max-width:\s*1040px\)/);
  const memberStart = css.indexOf('#organization-page #bodyWrapper > .page-wrapper > #contentbody:has(#members-data)');
  const memberRedesign = css.slice(memberStart);
  assert.notEqual(memberStart, -1);
  assert.doesNotMatch(memberRedesign, /@media\s*\(max-width:\s*680px\)/);
});

test('member hero fills its banner and sizes the identity and join controls like the mockup', () => {
  const hero = ruleBody(css, `${page} .wrapper > .heading`);
  const banner = ruleBody(css, `${page} .wrapper > .heading .banner`);
  const image = ruleBody(css, `${page} .wrapper > .heading .banner img`);
  const identity = ruleBody(css, `${page} .wrapper > .heading .inner`);
  const logo = ruleBody(css, `${page} .wrapper > .heading .logo`);
  const join = ruleBody(css, `${page} > .wrapper > .subnav-wrapper > .holobtn:has(.holobtn-top)`);
  const joinFace = ruleBody(css, `${page} > .wrapper > .subnav-wrapper > .holobtn:has(.holobtn-top) .holobtn-top`);
  const tabs = ruleBody(css, `${page} > .wrapper > .subnav-wrapper`);
  const tabCount = ruleBody(css, `${page} > .wrapper > .subnav-wrapper .rsi-org-tab-count`);
  const directoryLabel = ruleBody(css, `${page} > .wrapper > .subnav-wrapper::after`);
  const activityCaption = ruleBody(css, `${page} .wrapper > .heading .focus li .rsi-tooltip`);
  const filterHeading = ruleBody(css, `${page} form.search-members .filter-members > .heading`);

  assert.match(hero, /grid-template-rows:\s*clamp\(260px,\s*26vw,\s*370px\)\s+auto/);
  assert.equal(ruleBody(css, `${page} .heading`), '', 'hero rules must not affect the nested Rank, Role, or Membership headings');
  assert.match(profileRuntime, /#organization-page #organization\.public:has\(#members-data\)/);
  assert.match(profileRuntime, /const root = isMembersPage\s*\?\s*memberOrganization\s*:/);
  assert.match(profileRuntime, /const headingRoot = isMembersPage\s*\?\s*root\.querySelector<HTMLElement>\(':scope > \.wrapper'\)/);
  assert.match(profileRuntime, /const subnavWrapper = isMembersPage\s*\?\s*headingRoot\.querySelector<HTMLElement>\(':scope > \.subnav-wrapper'\)/);
  assert.match(profileRuntime, /\(!isMembersPage && !joinUs\)/);
  assert.match(css, /#organization-page #bodyWrapper #contentbody:has\(#members-data\) > \.rsi-org-profile-breadcrumb/);
  assert.match(css, /#organization-page #bodyWrapper #organization\.public:has\(#members-data\) > \.wrapper > \.subnav-wrapper/);
  assert.doesNotMatch(css, /\.content-wrapper\s*>\s*\.heading/);
  assert.match(banner, /width:\s*100%/);
  assert.match(image, /width:\s*100%/);
  assert.match(image, /height:\s*100%/);
  assert.match(image, /object-fit:\s*cover/);
  assert.match(identity, /grid-template-columns:\s*144px\s+minmax\(300px,\s*1fr\)\s+390px\s+154px/);
  assert.match(logo, /width:\s*144px/);
  assert.match(logo, /height:\s*144px/);
  assert.match(join, /min-height:\s*54px/);
  assert.match(join, /height:\s*54px/);
  assert.match(join, /background:\s*linear-gradient\(180deg,\s*#314557,\s*#1b2936 82%\)\s*!important/);
  assert.doesNotMatch(join, /background-image:\s*none\s*!important/);
  assert.match(join, /display:\s*inline-flex/);
  assert.match(join, /position:\s*absolute/);
  assert.match(join, /right:\s*58px\s*!important/);
  assert.match(join, /top:\s*calc\(clamp\(260px,\s*26vw,\s*370px\)\s*\+\s*44px\)/);
  assert.match(joinFace, /position:\s*static/);
  assert.match(joinFace, /opacity:\s*1/);
  assert.match(tabs, /position:\s*static/);
  assert.match(tabCount, /display:\s*inline-flex/);
  assert.match(directoryLabel, /content:\s*["']MEMBER DIRECTORY["']/);
  assert.match(activityCaption, /position:\s*static/);
  assert.match(filterHeading, /display:\s*block/);
  assert.match(filterHeading, /min-height:\s*0/);
  assert.match(filterHeading, /height:\s*auto/);
});
