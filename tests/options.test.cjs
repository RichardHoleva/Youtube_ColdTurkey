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
  assert.deepEqual(plain(options.KEYS), ['sidebar', 'shorts', 'subscriptions', 'history']);
  assert.deepEqual(plain(options.normalize()), { sidebar: false, shorts: false, subscriptions: false, history: false });
});

test('normalize keeps real booleans and treats everything else as off', () => {
  assert.deepEqual(plain(options.normalize({ sidebar: false, shorts: true, subscriptions: false, history: false })), { sidebar: false, shorts: true, subscriptions: false, history: false });
  assert.deepEqual(plain(options.normalize({ subscriptions: true, history: false })), { sidebar: false, shorts: false, subscriptions: true, history: false });
  for (const value of [null, 'yes', 1, [], { shorts: 'true', subscriptions: 1 }]) {
    assert.deepEqual(plain(options.normalize(value)), { sidebar: false, shorts: false, subscriptions: false, history: false }, JSON.stringify(value));
  }
});

test('removes is true only when something that was on gets switched off', () => {
  const on = { sidebar: false, shorts: false, subscriptions: true, history: false };
  assert.equal(options.removes(on, { sidebar: false, shorts: false, subscriptions: false, history: false }), true);
  assert.equal(options.removes(on, { sidebar: false, shorts: true, subscriptions: false, history: false }), true);
  assert.equal(options.removes(on, on), false);
  assert.equal(options.removes(on, { sidebar: false, shorts: true, subscriptions: true, history: false }), false);
  assert.equal(options.removes(undefined, { sidebar: false, shorts: false, subscriptions: false, history: false }), false);
});

test('switches hide things only while the lock is on', () => {
  const saved = { sidebar: false, shorts: true, subscriptions: false, history: true };
  assert.deepEqual(plain(options.blocked(saved, true, null)), saved);
  assert.deepEqual(plain(options.blocked(saved, false, null)), { sidebar: false, shorts: false, subscriptions: false, history: false });
  assert.deepEqual(plain(options.blocked(undefined, true, null)), { sidebar: false, shorts: false, subscriptions: false, history: false });
});

test('a preview shows what its switches would do, even when the lock is off', () => {
  const draft = { sidebar: false, shorts: true, subscriptions: false, history: false };
  assert.deepEqual(plain(options.blocked(undefined, false, draft)), draft);
  assert.deepEqual(plain(options.blocked({ sidebar: false, shorts: false, subscriptions: false, history: false }, false, { ...draft, shorts: false })), { sidebar: false, shorts: false, subscriptions: false, history: false }, 'switched back: nothing is hidden');
});

test('a preview only adds to what the lock already hides', () => {
  const saved = { sidebar: false, shorts: true, subscriptions: false, history: false };
  const draft = { sidebar: false, shorts: false, subscriptions: true, history: false };
  assert.deepEqual(plain(options.blocked(saved, true, draft)), { sidebar: false, shorts: true, subscriptions: true, history: false });
  assert.deepEqual(plain(options.blocked(saved, false, draft)), draft, 'unlocked: the draft alone');
});

test('a preview that is not complete still reads as off for what is missing', () => {
  assert.deepEqual(plain(options.blocked(undefined, false, { shorts: true })), { sidebar: false, shorts: true, subscriptions: false, history: false });
  assert.deepEqual(plain(options.blocked(undefined, false, 'nonsense')), { sidebar: false, shorts: false, subscriptions: false, history: false });
});

test('validate demands a boolean for every switch and nothing else', () => {
  assert.equal(options.validate({ sidebar: false, shorts: false, subscriptions: true, history: false }), true);
  for (const value of [undefined, null, [], {}, { shorts: true }, { shorts: 'true', subscriptions: false, history: false }, { shorts: 1, subscriptions: 0 }]) {
    assert.equal(options.validate(value), false, JSON.stringify(value));
  }
});
