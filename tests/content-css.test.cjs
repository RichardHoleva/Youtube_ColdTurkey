'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const parent = path.resolve(__dirname, '..');
const extension = fs.existsSync(path.join(parent, 'manifest.json'))
  ? parent
  : path.join(parent, 'youtube-focus-lock');
const css = fs.readFileSync(path.join(extension, 'content.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Every selector of every rule that hides something with `display: none !important`.
const hiding = [...css.matchAll(/([^{}]+)\{\s*display:\s*none\s*!important;\s*\}/g)]
  .flatMap((match) => match[1].split(',').map((selector) => selector.trim().replace(/\s+/g, ' ')))
  .filter((selector) => selector && !selector.includes('yfl-focus-notice'));
const routeFree = hiding.filter((selector) => !selector.includes('data-yfl-page'));

test('home feed and watch sidebar are hidden regardless of the route flag', () => {
  // YouTube keeps the old page painted for a moment after the URL changes, and the
  // route flag flips immediately. A route-only rule lets the old feed flash through.
  for (const selector of [
    'html[data-yfl-active="true"] ytd-browse[page-subtype="home"] ytd-rich-grid-renderer',
    'html[data-yfl-active="true"] ytd-browse[page-subtype="home"] ytd-rich-section-renderer',
    'html[data-yfl-active="true"] ytd-browse[page-subtype="home"] #primary',
    'html[data-yfl-active="true"] ytd-watch-flexy #related',
    'html[data-yfl-active="true"] ytd-watch-next-secondary-results-renderer'
  ]) {
    assert.ok(routeFree.includes(selector), `missing route-independent rule: ${selector}`);
  }
});

test('route-independent rules can only ever match the home feed or the watch sidebar', () => {
  // A bare "ytd-browse ytd-rich-grid-renderer" would also hide channel Videos tabs, so it
  // must stay behind the home-route flag.
  const allowed = /ytd-browse\[page-subtype="home"\]|ytd-watch-flexy|ytd-watch-grid|ytd-watch-next-secondary-results-renderer/;
  assert.ok(routeFree.length > 0);
  for (const selector of routeFree) {
    assert.ok(selector.startsWith('html[data-yfl-active="true"] '), `must require an active interval: ${selector}`);
    assert.match(selector, allowed, `too broad for a route-independent rule: ${selector}`);
  }
});

test('generic feed selectors stay limited to the home route', () => {
  const generic = hiding.filter((selector) => /ytd-browse ytd-rich-(grid|section)-renderer|ytd-two-column-browse-results-renderer/.test(selector) && !selector.includes('page-subtype'));
  assert.ok(generic.length > 0);
  for (const selector of generic) assert.ok(selector.includes('[data-yfl-page="home"]'), selector);
});

test('nothing outside an active interval is hidden', () => {
  for (const selector of hiding) assert.ok(selector.includes('[data-yfl-active="true"]'), selector);
});
