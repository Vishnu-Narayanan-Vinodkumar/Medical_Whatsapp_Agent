const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/theme.js'), 'utf8');
function browser({ saved = null, dark = false, blocked = false } = {}) {
  const listeners = {};
  const preference = { matches: dark, addEventListener: (event, callback) => { listeners.media = callback; } };
  const root = { dataset: {} };
  const meta = {};
  let control;
  let value = saved;
  const localStorage = {
    getItem: () => { if (blocked) throw new Error('Storage blocked'); return value; },
    setItem: (key, selected) => { if (blocked) throw new Error('Storage blocked'); value = selected; },
  };
  const document = {
    documentElement: root,
    querySelector: selector => selector.startsWith('meta') ? meta : { prepend: button => { control = button; } },
    createElement: () => ({ dataset: {}, setAttribute(name, value) { this[name] = value; }, replaceChildren() {}, addEventListener(event, callback) { this[event] = callback; } }),
    addEventListener: (event, callback) => { listeners[event] = callback; },
  };
  const window = { matchMedia: () => preference, addEventListener: (event, callback) => { listeners[event] = callback; }, lucide: { createIcons() {} } };
  vm.runInNewContext(source, { document, window, localStorage });
  return { root, meta, preference, listeners, mount: () => { listeners.DOMContentLoaded(); return control; }, saved: () => value, store: selected => { value = selected; } };
}

test('theme initializes before rendering, follows system settings and persists explicit toggles', () => {
  const page = browser({ dark: true });
  assert.equal(page.root.dataset.theme, 'dark');
  const button = page.mount();
  assert.equal(button['aria-label'], 'Switch to light mode');
  button.click();
  assert.equal(page.root.dataset.theme, 'light');
  assert.equal(page.saved(), 'light');
  page.listeners.media();
  assert.equal(page.root.dataset.theme, 'light');
  assert.equal(browser({ saved: page.saved(), dark: true }).root.dataset.theme, 'light');
});

test('theme handles unavailable storage, system changes and cross-tab preferences', () => {
  const blocked = browser({ blocked: true });
  blocked.mount().click();
  assert.equal(blocked.root.dataset.theme, 'dark');
  const page = browser();
  page.mount();
  page.preference.matches = true;
  page.listeners.media();
  assert.equal(page.root.dataset.theme, 'dark');
  page.store('light');
  page.listeners.storage({ key: 'diagnobot-theme' });
  assert.equal(page.root.dataset.theme, 'light');
  page.store(null);
  page.listeners.storage({ key: null });
  assert.equal(page.root.dataset.theme, 'dark');
});