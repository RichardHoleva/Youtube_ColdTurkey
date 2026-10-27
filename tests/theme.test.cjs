'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read } = require('./helpers.cjs');

const context = vm.createContext({ console });
vm.runInContext(read('shared', 'theme.js'), context);
const theme = context.FocusTheme;

test('only light and dark are valid choices', () => {
  assert.deepEqual(Array.from(theme.THEMES), ['light', 'dark']);
  assert.equal(theme.normalize('dark'), 'dark');
  assert.equal(theme.normalize('light'), 'light');
  for (const value of [undefined, null, '', 'Dark', 'blue', 1, {}]) assert.equal(theme.normalize(value), null, String(value));
});

test('a saved choice wins over the system setting', () => {
  assert.equal(theme.resolve('light', true), 'light');
  assert.equal(theme.resolve('dark', false), 'dark');
});

test('with no usable choice the system setting decides', () => {
  assert.equal(theme.resolve(null, true), 'dark');
  assert.equal(theme.resolve(undefined, false), 'light');
  assert.equal(theme.resolve('sepia', true), 'dark');
});
