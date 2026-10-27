'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { read } = require('./helpers.cjs');

const context = vm.createContext({ console });
vm.runInContext(read('shared', 'card-title.js'), context);
const title = context.FocusTitle;

test('the default title is what the card said before it could be renamed', () => {
  assert.equal(title.DEFAULT_TITLE, 'No feed');
  assert.equal(title.normalize(undefined), 'No feed');
});

test('a normal title is kept as typed', () => {
  assert.equal(title.normalize('Study time'), 'Study time');
  assert.equal(title.normalize('Deep work, no scrolling'), 'Deep work, no scrolling');
});

test('whitespace is tidied into a single line', () => {
  assert.equal(title.normalize('   Study   time  '), 'Study time');
  assert.equal(title.normalize('Study\ntime\t!'), 'Study time !');
});

test('empty, blank and non-text values fall back to the default', () => {
  for (const value of ['', '   ', '\n\t', null, undefined, 42, {}, [], true]) {
    assert.equal(title.normalize(value), 'No feed', JSON.stringify(value));
  }
});

test('a long title is cut at the limit and the cut leaves no trailing space', () => {
  assert.equal(title.MAX_LENGTH, 40);
  const long = 'x'.repeat(100);
  assert.equal(title.normalize(long), 'x'.repeat(40));
  assert.equal(title.normalize('a'.repeat(39) + ' b'), 'a'.repeat(39));
  assert.equal(Array.from(title.normalize('a'.repeat(40))).length, 40);
});

test('a title of exactly the limit is kept whole, and so is a sentence of that length', () => {
  assert.equal(title.normalize('Deep work now, no scrolling until done!'), 'Deep work now, no scrolling until done!');
  assert.equal(Array.from('Deep work now, no scrolling until done!').length, 39);
  assert.equal(title.normalize('1234567890'.repeat(4)), '1234567890'.repeat(4));
});

test('the limit counts characters, so an emoji is not split in half', () => {
  const emoji = '😀'.repeat(50);
  assert.equal(title.normalize(emoji), '😀'.repeat(40));
});

test('control characters never reach the card', () => {
  assert.equal(title.normalize('Hi\u0000there\u0007'), 'Hi there');
});

test('the YouTube page loads the title rules before the script that uses them', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
  const scripts = manifest.content_scripts[0].js;
  assert.ok(scripts.includes('src/shared/card-title.js'));
  assert.ok(scripts.indexOf('src/shared/card-title.js') < scripts.indexOf('src/content/content.js'));
});
