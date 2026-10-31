import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sectionForPath, RSI_SECTIONS } from '../src/shared/site-sections.ts';
import { normalizeSettings } from '../src/shared/settings.ts';
import { readFile } from 'node:fs/promises';

test('funding goals is a bounded, locale-aware public RSI section', () => {
  for (const prefix of ['', '/en', '/de', '/en-GB']) {
    assert.equal(sectionForPath(`${prefix}/funding-goals`), 'funding');
    assert.equal(sectionForPath(`${prefix}/funding-goals/`), 'funding');
  }
  for (const path of ['/en/funding-goals-extra', '/en/funding', '/en/funding-goals/archive']) {
    assert.equal(sectionForPath(path), null, path);
  }
});

test('funding appearance has its own enabled-by-default, reversible preference', () => {
  assert.equal(RSI_SECTIONS.funding, 'Funding Goals');
  assert.equal(normalizeSettings().rsi.funding, true);
  assert.equal(normalizeSettings({ rsi: { funding: false, store: false } }).rsi.funding, false);
  assert.equal(normalizeSettings({ rsi: { funding: false, store: false } }).rsi.store, false);
});

test('Funding Stats uses a full-size standalone dollar icon in the selected accent', async () => {
  const sources = [
    await readFile('src/styles/rsi/funding.css', 'utf8'),
    await readFile('dist/rsi.css', 'utf8'),
  ];
  const genericArrow = /\.wrapper:has\(> h1\.page-title\) > \.page-title::before\s*\{([^}]+)\}/s;
  const statsIcon = /\.wrapper:has\(> h1\.page-title\):has\(> \.column\.numbers\):has\(> \.column\.timeline\) > \.page-title::before\s*\{([^}]+)\}/s;
  const goalsIcon = /\.wrapper:has\(> h1\.page-title\):not\(:has\(> \.column\.numbers\)\) > \.page-title::before\s*\{([^}]+)\}/s;

  for (const source of sources) {
    const arrow = source.match(genericArrow)?.[1] ?? '';
    const stats = source.match(statsIcon)?.[1] ?? '';
    const goals = source.match(goalsIcon)?.[1] ?? '';
    assert.match(arrow, /display:\s*none/,
      'the generic cyan triangle should no longer be the funding title icon');
    assert.match(stats, /content:\s*["']\$/,
      'Funding Stats should show a dollar sign without a surrounding ring');
    assert.match(stats, /width:\s*28px/);
    assert.match(stats, /height:\s*28px/);
    assert.match(stats, /font:\s*700 28px\/1/,
      'the dollar glyph should use the full 28px icon size');
    assert.match(stats, /color:\s*var\(--rsi-accent/,
      'the dollar icon should follow the selected extension accent');
    assert.match(stats, /border:\s*0/);
    assert.match(stats, /border-radius:\s*0/);
    assert.match(stats, /background:\s*none/);
    assert.doesNotMatch(source, /\.wrapper:has\(> h1\.page-title\):has\(> \.column\.numbers\):has\(> \.column\.timeline\) > \.page-title::after/,
      'Funding Stats should not layer a second dollar glyph over the icon');
    assert.match(goals, /radial-gradient\(/,
      'Stretch Goals should use a target mark');
    assert.match(goals, /var\(--rsi-accent/,
      'the Stretch Goals mark should follow the selected extension accent');
    assert.doesNotMatch(`${stats}${goals}`, /url\(/,
      'funding title icons should be drawn in CSS without image requests');
  }
});

test('funding page styles preserve RSI counters, native timeline controls and their chart', async () => {
  const css = await readFile('dist/rsi.css', 'utf8');
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  const runtime = await readFile('dist/content.js', 'utf8');
  const pageController = await readFile('src/content/funding-stats.ts', 'utf8');
  assert.ok(css.includes('@scope (:root[data-rsi-section="funding"]:not([data-rsi-funding="off"]))'));
  assert.match(css, /\.goal \.right \.goal-item/,
    'the scoped funding stylesheet should package the new stretch-goal card treatment');
  assert.doesNotMatch(css, /@import|url\(/i);
  assert.match(css, /grid-template-columns/);
  assert.match(runtime, /funds_raised_counter/);
  assert.match(runtime, /fans_counter/,
    'the native Star Citizens total should remain visible beside its hourly change');
  assert.match(runtime, /rsiEnhanced\.getFundingHistory/,
    'both changes should use the fixed hourly sheet-history request');
  assert.match(runtime, /last hour/,
    'the live totals should show the latest hourly sheet change');
  assert.match(runtime, /last 24h/,
    'the live totals should continue to show the rolling 24-hour change');
  assert.match(runtime, /Sheet checked/,
    'the live stats panel should show when the funding sheet was last checked');
  assert.match(runtime, /snapshot/,
    'the live stats panel should distinguish the latest sheet row from its fetch time');
  assert.match(runtime, /latest snapshot/,
    'the page should label the row timestamp separately from the successful check');
  assert.match(pageController, /last successful check/,
    'fallback data should identify the last successful request instead of implying a recent check');
  assert.match(pageController, /formatFundingSnapshotAge/,
    'the page should make the age of the data snapshot visible');
  assert.match(runtime, /UTC/,
    'funding sheet timestamps should use the timezone recorded by the sheet');
  assert.match(runtime, /rsi-funding-range/,
    'the timeline should add extension-owned Quarter and Year controls');
  assert.match(source, /rsi-funding-chart__line/);
  const historyHelpers = await readFile('src/shared/funding-stats.ts', 'utf8');
  assert.match(historyHelpers, /buildFundingTimeline/,
    'extended timelines should be built from the hourly sheet rows');
  assert.match(source, /\.column\.numbers \.number-block/);
  assert.match(source, /\.rsi-funding-change/);
  assert.match(source, /\.rsi-funding-updated/);
  assert.doesNotMatch(source, /content:\s*["']● LIVE["']/,
    'the redundant green LIVE badge should be removed from the stats heading');
  assert.match(source, /\.column\.timeline \.filters \.filter/);
  assert.match(source, /\.goal-item/,
    'stretch-goal cards should receive their own project-styled presentation');
  assert.match(source, /\.campaign-start-box/,
    'the existing campaign timeline rail should remain part of the page design');
  assert.match(source, /\.goal-item a\[href\*="\/comm-link\/transmission\/"\]/,
    'the Chairman letter anchor should be restyled in place, preserving its native destination');
  const goalCard = source.match(/\.goal \.right \.goal-item\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(goalCard, /border-radius:\s*6px/);
  assert.match(goalCard, /background:\s*linear-gradient/);
  const letterLink = source.match(/\.goal \.right \.goal-item a\[href\*="\/comm-link\/transmission\/"\]\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(letterLink, /min-height:\s*40px/);
  assert.match(letterLink, /border:\s*1px solid/);
  assert.doesNotMatch(source, /\.donut-container|\.percentage\s*\{|@keyframes\s+[^\s{]*(?:donut|percentage)/i,
    'the page-owned animated completion rings and labels must not be replaced or restyled');
  assert.doesNotMatch(source, /\.item-content\s*\{[^}]*\b(?:display|height|overflow)\s*:/s,
    'the redesign must not interfere with RSI expand/collapse content behavior');
});

test('funding history refreshes when the page resumes after browser throttling', async () => {
  const source = await readFile('src/content/funding-stats.ts', 'utf8');
  const onResume = source.match(/function onResume\(\): void \{([\s\S]*?)\n  \}/)?.[1] ?? '';
  assert.match(onResume, /requestHistory\(\)/,
    'a restored or visible Funding Goals tab should promptly request current sheet rows');
  assert.match(source, /historyFetchedAt/,
    'the page should track the fetch time separately from the latest row time');
  const history = await readFile('src/shared/funding-stats.ts', 'utf8');
  assert.match(history, /FUNDING_HISTORY_REFRESH_MS = 60 \* 1000/,
    'an active page should retry for new hourly rows at a one-minute cadence');
  assert.match(history, /buildFundingLatestQueryUrl/,
    'frequent checks should request only the newest row while retaining full history locally');
});

test('funding stats layout matches the approved proportions and resets native timeline control sizing', async () => {
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  const statsShell = source.match(/\.wrapper:has\(> h1\.page-title\):has\(> \.column\.numbers\):has\(> \.column\.timeline\)\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(statsShell, /grid-template-columns:\s*minmax\(220px,\s*\.78fr\)\s+minmax\(0,\s*1\.62fr\)/,
    'the funding card should use the approved mockup proportions');
  const pageShell = source.match(/\.wrapper:has\(> h1\.page-title\)\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(pageShell, /display:\s*block/,
    'the stretch-goal intro should flow as one column instead of inheriting the stats grid');
  assert.doesNotMatch(pageShell, /46px 46px/,
    'the funding shell should not repeat the old high-contrast square grid');
  const routeBackdrop = source.match(/:scope,\s*body:has\(\.wrapper > h1\.page-title\),\s*body:has\(\.wrapper > h1\.page-title\) :is\(#bodyWrapper, \.page-wrapper, #contentbody\)\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(routeBackdrop, /background-color:\s*#050d16\s*!important/,
    'the funding page background layers should all use one solid colour');
  assert.match(routeBackdrop, /background-image:\s*none\s*!important/,
    'the funding page background layers should remove inherited artwork');
  const routeBackdropDecoration = source.match(/body:has\(\.wrapper > h1\.page-title\)(?:\s+:is\(#bodyWrapper, \.page-wrapper, #contentbody\))?::(?:before|after)[\s\S]*?\{([^}]+)\}/)?.[1] ?? '';
  assert.match(routeBackdropDecoration, /background-color:\s*#050d16\s*!important/,
    'route-owned decorative background layers should be covered by the same solid funding backdrop');
  assert.match(routeBackdropDecoration, /background-image:\s*none\s*!important/,
    'route-owned decorative layers must not keep painting the RSI honeycomb image');
  assert.match(source, /body:has\(\.wrapper > h1\.page-title\) :is\(#bodyWrapper, \.page-wrapper, #contentbody\)::before,[\s\S]*?body:has\(\.wrapper > h1\.page-title\) :is\(#bodyWrapper, \.page-wrapper, #contentbody\)::after/,
    'the background override should cover decoration attached to each funding page container');
  assert.doesNotMatch(source, /\.wrapper:has\(> h1\.page-title\):has\(> \.column\.numbers\):has\(> \.column\.timeline\)::before/,
    'the Stats-only background band should not remain behind a page-wide solid background');
  const stretchIntro = source.match(/\.wrapper:has\(> h1\.page-title\):not\(:has\(> \.column\.numbers\)\) > p\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(stretchIntro, /font:\s*14px\/1\.55/,
    'stretch-goal intro paragraphs should have deliberate, readable spacing');
  const statsBody = source.match(/\.column\.numbers > \.body\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(statsBody, /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    'the two live totals should stack as full-width rows like the approved mockup');

  const filters = source.match(/\.column\.timeline \.filters\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(filters, /position:\s*static\s*!important/,
    'range controls must stay in the timeline header instead of inheriting RSI absolute positioning');
  assert.match(filters, /inset:\s*auto\s*!important/);
  assert.match(filters, /width:\s*auto\s*!important/);

  const filter = source.match(/\.column\.timeline \.filters \.filter\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(filter, /height:\s*31px\s*!important/,
    'range controls must use compact mockup-sized buttons');
  assert.match(filter, /max-height:\s*31px\s*!important/);
});

test('stretch goals keep a tight card footer, continuous rail, and native timeline chart identity', async () => {
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  const runtime = await readFile('src/content/funding-stats.ts', 'utf8');
  const goalCard = source.match(/\.goal \.right \.goal-item\s*\{([^}]+)\}/s)?.[1] ?? '';
  const goalFooter = source.match(/\.goal \.right \.goal-item \.bottom-line\s*\{([^}]+)\}/s)?.[1] ?? '';
  const railConnector = source.match(/\.goal \+ \.goal \.amount-bg::before\s*\{([^}]+)\}/s)?.[1] ?? '';
  const letterLink = source.match(/\.goal \.right \.goal-item a\[href\*="\/comm-link\/transmission\/"\]\s*\{([^}]+)\}/s)?.[1] ?? '';
  const extendedChart = source.match(/\.rsi-funding-extended-chart\s*\{([^}]+)\}/s)?.[1] ?? '';
  const chartLine = source.match(/\.rsi-funding-chart__line\s*\{([^}]+)\}/s)?.[1] ?? '';
  const chartPoint = source.match(/\.rsi-funding-chart__point\s*\{([^}]+)\}/s)?.[1] ?? '';
  const nativeFilter = source.match(/\.column\.timeline \.filters \.filter\s*\{([^}]+)\}/s)?.[1] ?? '';
  const extendedFilter = source.match(/\.column\.timeline \.filters \.rsi-funding-range\s*\{([^}]+)\}/s)?.[1] ?? '';

  assert.match(goalCard, /margin:\s*14px\s+0\s+10px/,
    'goal cards should leave a short, consistent gap for the connecting timeline rail');
  assert.match(goalFooter, /height:\s*14px/,
    'the decorative footer should not reserve a large blank region');
  assert.match(railConnector, /height:\s*10px/);
  assert.match(railConnector, /position:\s*absolute/);
  assert.match(letterLink, /min-height:\s*40px/,
    'the Chairman letter control should be comfortably sized beside the goal amount');
  const nativeTransition = nativeFilter.match(/transition:\s*([^;]+)/)?.[1] ?? '';
  const extendedTransition = extendedFilter.match(/transition:\s*([^;]+)/)?.[1] ?? '';
  assert.equal(extendedTransition, nativeTransition,
    'Quarter and Year controls should share the native filter hover and selection transitions');
  assert.match(runtime, /classList\.add\(['"]trans-03s['"]\)/,
    'Quarter and Year controls should use RSI’s native animated transition class');
  assert.match(extendedChart, /padding:\s*0/);
  assert.match(extendedChart, /border:\s*0/);
  assert.match(extendedChart, /background:\s*transparent/);
  assert.doesNotMatch(extendedChart, /border:\s*1px|background:\s*linear-gradient|background-color:/,
    'the extended graph should use the native timeline panel instead of a nested card');
  assert.match(chartLine, /stroke:\s*#21528a/i);
  assert.match(chartLine, /stroke-width:\s*1/);
  assert.doesNotMatch(chartLine, /filter:/,
    'the extended graph line should match RSI’s thin, unglowed native line');
  assert.match(chartPoint, /stroke-width:\s*2/);
  assert.match(chartPoint, /fill:\s*none/);
  assert.match(runtime, /circle\.setAttribute\('r',\s*'3'\)/,
    'extended chart markers should match native marker size');
  assert.match(source, /rsi-funding-chart__animate/,
    'range changes should retain a restrained chart entrance transition');
  assert.match(source, /rsi-funding-chart-enter \.3s ease both/,
    'the extended chart entrance should use the same 300ms easing as RSI’s timeline controls');
});

test('funding stat indicators sit below native values and keep RSI icon artwork', async () => {
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  const stat = source.match(/\.column\.numbers \.number-block\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(stat, /background-color:/);
  assert.doesNotMatch(stat, /(?:^|\n)\s*background\s*:/,
    'a background shorthand would erase the native funding and citizen icon artwork');

  const delta = source.match(/\.rsi-funding-change\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(delta, /clear:\s*both/,
    'the 24-hour indicator must clear RSI’s floated native counter');
  assert.match(delta, /width:\s*100%/);
});

test('funding change counts sit side by side while all text keeps its original size', async () => {
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  const packaged = await readFile('dist/rsi.css', 'utf8');
  const change = source.match(/\.rsi-funding-change\s*\{([^}]+)\}/s)?.[1] ?? '';
  const item = source.match(/\.rsi-funding-change__item\s*\{([^}]+)\}/s)?.[1] ?? '';
  const arrow = source.match(/\.rsi-funding-change__arrow\s*\{([^}]+)\}/s)?.[1] ?? '';
  const value = source.match(/\.rsi-funding-change__value\s*\{([^}]+)\}/s)?.[1] ?? '';
  const period = source.match(/\.rsi-funding-change__period\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(change, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    'last-hour and last-24-hour changes should use side-by-side columns');
  assert.match(item, /grid-template-areas:/,
    'each change should keep its amount beside the arrow and its period below');
  assert.match(value, /font-size:\s*13px/,
    'the count should keep its original size');
  assert.match(arrow, /font-size:\s*11px/,
    'the arrow should keep its original size');
  assert.match(period, /font-size:\s*10px/,
    'the period label should keep its original size');
  assert.match(packaged, /\.rsi-funding-change\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
    'the side-by-side layout must be present in the packaged RSI stylesheet');
});

test('funding tiles reserve space for native icons and preserve the native timeline plot geometry', async () => {
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  const stat = source.match(/\.column\.numbers \.number-block\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(stat, /padding:\s*10px\s+11px\s+10px\s+70px/,
    'tile labels and live values must start clear of RSI’s native icon');
  assert.match(stat, /background-position:\s*8px\s+center\s*!important/,
    'the native funding and citizen icon artwork should sit 8px inside the tile edge');
  assert.doesNotMatch(source, /\.column\s*>\s*\.body\s*>\s*\.cboth\s*\{\s*display:\s*none/s,
    'the broad clearfix rule must not hide RSI’s native timeline plot structure');
  assert.match(source, /\.column\.numbers\s*>\s*\.body\s*>\s*\.cboth/,
    'only the counters’ grid clearfix should be suppressed');
  const chart = source.match(/\.column\.timeline\s+#timeline-chart\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(chart, /repeating-linear-gradient\(to bottom/i,
    'the mockup’s horizontal chart guides should remain visible behind the native plot');
  assert.doesNotMatch(chart, /(?:^|\n)\s*(?:position|inset|float)\s*:/,
    'the native plot must keep RSI’s own coordinate system so its line stays inside its axes');
  assert.doesNotMatch(chart, /(?:^|\n)\s*width\s*:/,
    'the extension must not replace RSI’s chart dimensions or range-dependent sizing');
});

test('funding stat tiles fill the numbers panel with matching left and right insets', async () => {
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  const statsBody = source.match(/\.column\.numbers > \.body\s*\{([^}]+)\}/s)?.[1] ?? '';
  const stat = source.match(/\.column\.numbers \.number-block\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(statsBody, /padding-inline:\s*0/,
    'native body padding must not push the tiles farther from the left edge');
  assert.match(statsBody, /margin-inline:\s*0/,
    'the stat list must align evenly within the numbers panel');
  assert.match(stat, /justify-self:\s*stretch/);
  assert.match(stat, /width:\s*100%\s*!important/,
    'both stat tiles must fill the same available width inside the panel');
  assert.match(stat, /margin-inline:\s*0\s*!important/);
});

test('funding stat tiles keep equal top, side and bottom spacing within their panel', async () => {
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  const panel = source.match(/\.wrapper:has\(> h1\.page-title\) \.column\.numbers,\s*\.wrapper:has\(> h1\.page-title\) \.column\.timeline\s*\{([^}]+)\}/s)?.[1] ?? '';
  const statsBody = source.match(/\.wrapper:has\(> h1\.page-title\) \.column\.numbers > \.body\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(panel, /padding:\s*14px/,
    'the cards should keep the panel’s 14px left, right and bottom inset');
  assert.match(statsBody, /margin-top:\s*14px/,
    'the space above the first tile should match the panel’s outer inset');
});

test('funding timeline plot surface is centered without changing its native chart coordinates', async () => {
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  const body = source.match(/\.column\.timeline > \.body\s*\{([^}]+)\}/s)?.[1] ?? '';
  assert.match(body, /translate:\s*clamp\(0px,\s*7\.5%,\s*48px\)\s+0/,
    'the complete plot surface should move right into the center of the wider timeline card');
});

test('hourly funding ranges replace only the visible native plot while selected', async () => {
  const source = await readFile('src/styles/rsi/funding.css', 'utf8');
  assert.match(source, /data-rsi-funding-range\]\s*>\s*:is\(\.y-axis,\s*#timeline-chart,\s*\.x-axis,\s*\.cboth\)/,
    'the extension chart should hide native plot layers only in Quarter or Year mode');
  assert.match(source, /\.rsi-funding-extended-chart\s+svg/);
  assert.match(source, /\.rsi-funding-chart__line/);
  assert.match(source, /\.rsi-funding-chart__point/);
  assert.match(source, /\.rsi-funding-range\.on/);
});
