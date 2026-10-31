import assert from 'node:assert/strict';
import { test } from 'node:test';
import { installCommLinkControls } from '../src/content/commlink-controls.ts';

function classes(...initial) {
  const values = new Set(initial);
  return {
    add: value => values.add(value),
    contains: value => values.has(value),
    remove: value => values.delete(value),
    toggle(value, force) {
      if (force === true || (force === undefined && !values.has(value))) values.add(value);
      else values.delete(value);
      return values.has(value);
    },
  };
}

function createControl({ labelText = 'All', inputValue = '', selectedIndex = 0, choices = null, extraClass = '' } = {}) {
  const menu = {
    style: { display: 'none' },
    attributes: new Map(),
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  };
  const label = { textContent: labelText };
  const input = { value: inputValue };
  const optionChoices = choices ?? [
    { textContent: 'All', value: '' },
    { textContent: 'Transmission', value: 'transmission' },
  ];
  const options = optionChoices.map((choice, index) => ({
    textContent: choice.textContent,
    getAttribute: name => name === 'rel' ? choice.value : null,
    classList: classes(...(index === selectedIndex ? ['selected'] : [])),
  }));
  const anchorClasses = classes('js-selectlist', ...(extraClass ? [extraClass] : []));
  const anchor = {
    href: '',
    classList: anchorClasses,
    attributes: new Map(),
    querySelector: selector => selector === ':scope > .scrollable.body' ? menu
      : selector === ':scope > span' ? label
        : selector === 'input[type="hidden"]' ? input : null,
    querySelectorAll: selector => selector.includes('.js-option[rel]') ? options : [],
    contains: element => element === menu || options.includes(element) || element === label || element === input,
    getAttribute(name) { return this.attributes.get(name) ?? null; },
    setAttribute(name, value) { this.attributes.set(name, value); },
    removeAttribute(name) { this.attributes.delete(name); },
  };
  const targetFor = element => ({
    closest(selector) {
      if (selector === '#channel #hub-search .js-selectlist') return anchor;
      if (selector === '.js-option[rel]') return options.includes(element) ? element : null;
      return null;
    },
  });
  return { anchor, input, label, menu, options, targetFor };
}

function setup(enabled = () => true, options = {}) {
  const listeners = new Map();
  const control = createControl(options);
  const sortControl = createControl({
    labelText: 'New',
    inputValue: 'new',
    selectedIndex: 0,
    extraClass: 'js-sort',
    choices: [{ textContent: 'New', value: 'new' }, { textContent: 'Old', value: 'old' }],
  });
  const form = {
    handlers: new Map(),
    querySelector: selector => selector === '.js-sort' ? sortControl.anchor : null,
    addEventListener(type, listener) { this.handlers.set(type, listener); },
  };
  const doc = {
    querySelectorAll: () => [control.anchor, sortControl.anchor],
    querySelector: selector => selector === '#channel #hub-search' ? form : null,
  };
  const win = {
    addEventListener: (type, listener, capture = false) => listeners.set(`${type}:${capture}`, listener),
    getComputedStyle: element => ({ display: element.style.display }),
  };
  installCommLinkControls(enabled, win, doc);
  const click = (target, nativeAction = null) => {
    const event = {
      target,
      button: 0,
      defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; },
    };
    listeners.get('click:true')(event);
    nativeAction?.(event);
    listeners.get('click:false')(event);
    return event;
  };
  return { ...control, sortControl, form, click };
}

test('Comm-Link filter fallback prevents empty-link reloads and updates the native form fields', () => {
  const control = setup();
  const opened = control.click(control.targetFor(control.anchor));
  assert.equal(opened.defaultPrevented, true, 'clicking the empty-href filter does not reload the page');
  assert.equal(control.menu.style.display, 'block');
  assert.equal(control.anchor.getAttribute('aria-expanded'), 'true');

  const selected = control.click(control.targetFor(control.options[1]));
  assert.equal(selected.defaultPrevented, true);
  assert.equal(control.input.value, 'transmission');
  assert.equal(control.label.textContent, 'Transmission');
  assert.equal(control.options[0].classList.contains('selected'), false);
  assert.equal(control.options[1].classList.contains('selected'), true);
  assert.equal(control.menu.style.display, 'none');
  assert.equal(control.anchor.getAttribute('aria-expanded'), 'false');
});

test('Comm-Link fallback does not double-toggle a filter handled by RSI', () => {
  const control = setup();
  const click = control.click(control.targetFor(control.anchor), event => {
    control.menu.style.display = 'block';
    control.anchor.classList.add('active');
    control.anchor.setAttribute('aria-expanded', 'true');
  });
  assert.equal(click.defaultPrevented, true);
  assert.equal(control.menu.style.display, 'block');
  assert.equal(control.anchor.classList.contains('active'), true);
});

test('Comm-Link fallback leaves the native anchor alone when its module is disabled', () => {
  const control = setup(() => false);
  const click = control.click(control.targetFor(control.anchor));
  assert.equal(click.defaultPrevented, false);
  assert.equal(control.menu.style.display, 'none');
});

test('Comm-Link labels recover from blank native text when the extension or page starts', () => {
  const control = setup(() => true, { labelText: '', inputValue: 'transmission', selectedIndex: 0 });
  assert.equal(control.label.textContent, 'Transmission');
  assert.equal(control.sortControl.label.textContent, 'New');
});

test('Comm-Link search submits the selected newest sort even if its hidden field is stale', () => {
  const control = setup();
  control.sortControl.input.value = 'old';
  control.form.handlers.get('submit')({});
  assert.equal(control.sortControl.input.value, 'new');
  assert.equal(control.sortControl.label.textContent, 'New');
});
