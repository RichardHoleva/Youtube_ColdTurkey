'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./helpers.cjs');

const css = read('content', 'content.css').replace(/\/\*[\s\S]*?\*\//g, '');

// Every selector of every rule that hides something with `display: none !important`.
const hiding = [...css.matchAll(/([^{}]+)\{\s*display:\s*none\s*!important;\s*\}/g)]
  .flatMap((match) => match[1].split(',').map((selector) => selector.trim().replace(/\s+/g, ' ')))
  .filter((selector) => selector && !selector.includes('yfl-focus-notice'));
const routeFree = hiding.filter((selector) => !selector.includes('data-yfl-page'));
const subscriptions = hiding.filter((selector) => /subscriptions/.test(selector));
const SHORTS = /shorts|reel|m13\.467 1\.19/i; // the Shorts icon's path counts too: that rule never says "shorts"
const shorts = hiding.filter((selector) => SHORTS.test(selector));

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

test('route-independent rules can only ever match the home feed, the watch sidebar or subscriptions', () => {
  // A bare "ytd-browse ytd-rich-grid-renderer" would also hide channel Videos tabs, so it
  // must stay behind the home-route flag.
  const allowed = /ytd-browse\[page-subtype="(home|subscriptions)"\]|ytd-watch-flexy|ytd-watch-grid|ytd-watch-next-secondary-results-renderer|ytd-(mini-)?guide-entry-renderer:has\(a\[href="\/feed\/subscriptions"\]\)/;
  const others = routeFree.filter((selector) => !shorts.includes(selector));
  assert.ok(others.length > 0);
  for (const selector of others) {
    assert.ok(selector.startsWith('html[data-yfl-active="true"]'), `must require an active interval: ${selector}`);
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

test('subscriptions are only hidden when their switch is on', () => {
  assert.ok(subscriptions.length > 0);
  for (const selector of subscriptions) {
    assert.ok(selector.includes('[data-yfl-block-subscriptions="true"]'), `needs the Subscriptions switch: ${selector}`);
  }
});

test('no other rule can reach the subscriptions page or its sidebar links', () => {
  const others = hiding.filter((selector) => !subscriptions.includes(selector));
  for (const selector of others) assert.ok(!/subscriptions/.test(selector), selector);
});

test('Shorts are only hidden when their switch is on', () => {
  assert.ok(shorts.length > 0);
  for (const selector of shorts) {
    assert.ok(selector.startsWith('html[data-yfl-active="true"][data-yfl-block-shorts="true"]'), `needs the lock and the Shorts switch: ${selector}`);
  }
});

test('every Shorts rule names something that is a Short, so it can never hide ordinary videos', () => {
  // A bare "ytd-rich-item-renderer" or "ytd-video-renderer" would hide every video on the page;
  // each one must be narrowed to the ones that link to /shorts/.
  const aShort = /ytd-shorts$|ytd-reel-shelf-renderer$|ytd-rich-shelf-renderer\[is-shorts\]$|ytm-shorts-lockup-view-model(-v2)?(\)?)$|yt-tab-shape\[tab-title="Shorts"\]$|:has\(a\[(href\^="\/shorts\/?"|title="Shorts")\]\)$|:has\(path\[d\^="m13\.467 1\.19-8 4\.7"\]\)$/;
  for (const selector of shorts) assert.match(selector, aShort, `not clearly a Short: ${selector}`);
});

test('no other rule can reach Shorts', () => {
  const others = hiding.filter((selector) => !shorts.includes(selector));
  for (const selector of others) assert.ok(!SHORTS.test(selector), selector);
});

test('the notice card takes every color from variables, with a dark set', () => {
  // A hard-coded color on the card would ignore the mode picked in the popup.
  const card = css.slice(css.indexOf('#yfl-focus-notice {'))
    .replace(/#yfl-focus-notice\s*\{[^}]*--yfl-[^}]*\}/g, '')
    .replace(/html\[data-yfl-theme="dark"\] #yfl-focus-notice\s*\{[^}]*\}/, '');
  assert.doesNotMatch(card, /#[0-9a-f]{3,8}\b/i, 'card rules must use var(--yfl-*), not literal colors');
  for (const name of ['bg', 'ink', 'muted', 'rule', 'accent']) {
    assert.match(css, new RegExp(`html\\[data-yfl-theme="dark"\\] #yfl-focus-notice\\s*\\{[^}]*--yfl-${name}:`), `dark value for --yfl-${name}`);
  }
});

test('the notice card is shown only through the notice flag', () => {
  assert.match(css, /html\[data-yfl-notice="true"\] #yfl-focus-notice\s*\{\s*display:\s*block\s*!important/);
  assert.match(css, /(^|\})\s*#yfl-focus-notice\s*\{[^}]*display:\s*none\s*!important/);
});
