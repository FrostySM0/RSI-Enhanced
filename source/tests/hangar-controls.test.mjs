import assert from 'node:assert/strict';
import { test } from 'node:test';
import { filterDestination, HANGAR_SHIP_PAINT_SESSION_KEY, installHangarControls } from '../src/content/hangar-controls.ts';

test('filter destinations accept real Hangar options, reject empty/unsafe URLs and avoid same-page reloads', () => {
  const current = 'https://robertsspaceindustries.com/en/account/pledges?type=all';
  assert.equal(filterDestination('?type=ships', current), 'https://robertsspaceindustries.com/en/account/pledges?type=ships');
  for (const value of ['', ' ', '?type=all', '#', 'javascript:alert(1)', 'https://example.com/account/pledges', '/account/pledges/reclaim', '/account/billing', '/account/roms', '/account/buy-back-pledges']) assert.equal(filterDestination(value, current), null, value);
});

test('Ship Paint is added as a local dropdown option and never navigates', () => {
  const choices = [
    { rel: '/en/account/pledges', textContent: 'All', getAttribute: name => name === 'rel' ? '/en/account/pledges' : null, classList: { contains: () => true } },
    { rel: '/en/account/pledges?type=ships', textContent: 'Standalone Ships', getAttribute: name => name === 'rel' ? '/en/account/pledges?type=ships' : null, classList: { contains: () => false } },
  ];
  let replaced = false, select, change;
  const original = {
    querySelectorAll: () => choices,
    querySelector: () => ({ value: '/en/account/pledges' }),
    replaceWith: value => { replaced = true; select = value; },
  };
  const events = [], destinations = [], session = new Map([[HANGAR_SHIP_PAINT_SESSION_KEY, '1']]);
  const doc = {
    readyState: 'complete',
    querySelectorAll: () => replaced ? [] : [original],
    createElement: name => name === 'select' ? {
      options: [],
      append(option) { this.options.push(option); },
      replaceWith() {},
      setAttribute() {},
      addEventListener: (name, listener) => { if (name === 'change') change = listener; },
      value: '',
    } : { selected: false, value: '', textContent: '' },
    dispatchEvent: event => { events.push(event); return true; },
    addEventListener() {},
  };
  const win = {
    location: { href: 'https://robertsspaceindustries.com/en/account/pledges', assign: value => destinations.push(value) },
    sessionStorage: {
      getItem: key => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, value),
      removeItem: key => session.delete(key),
    },
    addEventListener() {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  };
  let enabled = true;
  const refresh = installHangarControls(() => enabled, win, doc);
  refresh();
  const paintOptions = select.options.filter(option => option.value === 'rsi:ship-paint' && option.textContent === 'Ship Paint');
  assert.equal(paintOptions.length, 1);
  assert.equal(paintOptions[0].selected, true, 'Ship Paint remains selected after loading another Hangar page');

  select.value = 'rsi:ship-paint';
  change({ stopPropagation() {} });
  assert.equal(session.get(HANGAR_SHIP_PAINT_SESSION_KEY), '1');
  assert.deepEqual(destinations, []);
  assert.deepEqual(events.map(event => [event.type, event.detail.value]), [['rsi-hangar-filter-change', 'rsi:ship-paint']]);

  select.value = '/en/account/pledges';
  change({ stopPropagation() {} });
  assert.equal(session.has(HANGAR_SHIP_PAINT_SESSION_KEY), false, 'choosing a native category clears Ship Paint');
  enabled = false; session.set(HANGAR_SHIP_PAINT_SESSION_KEY, '1'); refresh();
  assert.equal(session.has(HANGAR_SHIP_PAINT_SESSION_KEY), false, 'disabling Hangar clears the temporary selection');
});

test('arrow fallback expands/collapses when native handling is absent, without double toggling when present', () => {
  const listeners = new Map();
  const doc = { readyState: 'loading', addEventListener() {} };
  const win = { addEventListener: (name, fn, capture) => listeners.set(`${name}:${!!capture}`, fn) };
  let enabled = true; let active = false;
  const row = { classList: { contains: () => active, toggle: (_, value) => { active = value; } } };
  const arrow = { closest: selector => selector === '#billing.pledges' ? {} : selector === '.row' ? row : null };
  const target = { closest: () => arrow };
  installHangarControls(() => enabled, win, doc);
  const click = native => {
    const event = { target, button: 0, preventDefault() { this.defaultPrevented = true; } };
    listeners.get('click:true')(event);
    if (native) active = !active;
    listeners.get('click:false')(event);
    return event;
  };
  assert.equal(click(false).defaultPrevented, true); assert.equal(active, true);
  click(false); assert.equal(active, false);
  click(true); assert.equal(active, true);
  click(true); assert.equal(active, false);
  enabled = false; click(false); assert.equal(active, false);
});

test('upgrade and header action clicks are left to RSI native handlers', () => {
  const listeners = new Map();
  const doc = { readyState: 'loading', addEventListener() {} };
  const win = { addEventListener: (name, fn, capture) => listeners.set(`${name}:${!!capture}`, fn) };
  const enabled = true;
  installHangarControls(() => enabled, win, doc);
  for (const name of ['.js-upgrade-log', '.js-hangar-log', '.js-ship-upgrades']) {
    const target = { closest: () => null, action: name };
    const event = { target, button: 0, preventDefault() { this.defaultPrevented = true; } };
    listeners.get('click:true')(event);
    listeners.get('click:false')(event);
    assert.equal(event.defaultPrevented, undefined, `${name} keeps native click behaviour`);
  }
});
