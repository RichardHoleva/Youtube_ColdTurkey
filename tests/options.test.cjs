'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read } = require('./helpers.cjs');

const context = vm.createContext({ console });
vm.runInContext(read('shared', 'options.js'), context);
const options = context.FocusOptions;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('every switch defaults to not blocked', () => {
  assert.deepEqual(plain(options.KEYS), ['sidebar', 'shorts', 'subscriptions']);
  assert.deepEqual(plain(options.normalize()), { sidebar: false, shorts: false, subscriptions: false });
});

test('normalize keeps real booleans and treats everything else as off', () => {
  assert.deepEqual(plain(options.normalize({ sidebar: false, shorts: true, subscriptions: false })), { sidebar: false, shorts: true, subscriptions: false });
  assert.deepEqual(plain(options.normalize({ subscriptions: true })), { sidebar: false, shorts: false, subscriptions: true });
  for (const value of [null, 'yes', 1, [], { shorts: 'true', subscriptions: 1 }]) {
    assert.deepEqual(plain(options.normalize(value)), { sidebar: false, shorts: false, subscriptions: false }, JSON.stringify(value));
  }
});

test('removes is true only when something that was on gets switched off', () => {
  const on = { sidebar: false, shorts: false, subscriptions: true };
  assert.equal(options.removes(on, { sidebar: false, shorts: false, subscriptions: false }), true);
  assert.equal(options.removes(on, { sidebar: false, shorts: true, subscriptions: false }), true);
  assert.equal(options.removes(on, on), false);
  assert.equal(options.removes(on, { sidebar: false, shorts: true, subscriptions: true }), false);
  assert.equal(options.removes(undefined, { sidebar: false, shorts: false, subscriptions: false }), false);
});

test('validate demands a boolean for every switch and nothing else', () => {
  assert.equal(options.validate({ sidebar: false, shorts: false, subscriptions: true }), true);
  for (const value of [undefined, null, [], {}, { shorts: true }, { shorts: 'true', subscriptions: false }, { shorts: 1, subscriptions: 0 }]) {
    assert.equal(options.validate(value), false, JSON.stringify(value));
  }
});
