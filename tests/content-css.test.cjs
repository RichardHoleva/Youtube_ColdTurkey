'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./helpers.cjs');

const css = read('content', 'content.css').replace(/\/\*[\s\S]*?\*\//g, '');

// A selector list split on the commas between selectors, not the ones inside :has(...) or :not(...).
function splitSelectors(list) {
  const selectors = [];
  let depth = 0;
  let current = '';
  for (const character of list) {
    if (character === '(' || character === '[') depth += 1;
    if (character === ')' || character === ']') depth -= 1;
    if (character === ',' && depth === 0) {
      selectors.push(current);
      current = '';
    } else {
      current += character;
    }
  }
  return [...selectors, current];
}

// Every selector of every rule that hides something with `display: none !important`.
const hiding = [...css.matchAll(/([^{}]+)\{\s*display:\s*none\s*!important;\s*\}/g)]
  .flatMap((match) => splitSelectors(match[1]).map((selector) => selector.trim().replace(/\s+/g, ' ')))
  .filter((selector) => selector && !selector.includes('yfl-focus-notice'));
const routeFree = hiding.filter((selector) => !selector.includes('data-yfl-page'));
const SUBSCRIPTIONS = /subscriptions|feed\/channels/; // the channel list is found by its "All subscriptions" link
const subscriptions = hiding.filter((selector) => SUBSCRIPTIONS.test(selector));
// The History page and its own sidebar entry. (A rule that merely mentions the History link to stay
// away from the "You" section, like the channel list one, is not a History rule.)
const HISTORY = /block-history|page-subtype="history"|data-yfl-page="history"|feed\/history"\]\)$/;
const historyRules = hiding.filter((selector) => HISTORY.test(selector));
const SHORTS = /shorts|reel|m13\.467 1\.19/i; // the Shorts icon's path counts too: that rule never says "shorts"
const shorts = hiding.filter((selector) => SHORTS.test(selector));
const SIDEBAR = /tp-yt-app-drawer#guide|ytd-mini-guide-renderer|#guide-button/; // the menu itself, not its entries
const sidebar = hiding.filter((selector) => SIDEBAR.test(selector));

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

test('the always-on rules can only ever match the home feed or the watch sidebar', () => {
  // A bare "ytd-browse ytd-rich-grid-renderer" would also hide channel Videos tabs, so it
  // must stay behind the home-route flag. Each switch has its own group of rules, checked below.
  const allowed = /ytd-browse\[page-subtype="home"\]|ytd-watch-flexy|ytd-watch-grid|ytd-watch-next-secondary-results-renderer/;
  const others = routeFree.filter((selector) => ![shorts, sidebar, subscriptions, historyRules].some((group) => group.includes(selector)));
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

const CHANNEL_SECTIONS = [
  'ytd-guide-section-renderer:has(a[href="/feed/channels"])',
  'ytd-guide-section-renderer:has(a[href^="/@"]):not(:has(a[href="/feed/history"], a[href="/"]))',
  'ytd-guide-section-renderer[data-yfl-channels]'
];

test('every Subscriptions rule names the feed page, its sidebar link or the list of channels', () => {
  const aSubscriptionsThing = /ytd-browse\[page-subtype="subscriptions"\] #(primary|header)$|\[data-yfl-page="subscriptions"\] ytd-browse #(primary|header)$|ytd-(mini-)?guide-entry-renderer:has\(a\[href="\/feed\/subscriptions"\]\)$/;
  const channelSection = (selector) => CHANNEL_SECTIONS.some((section) => selector.endsWith(section));
  for (const selector of subscriptions) {
    assert.ok(aSubscriptionsThing.test(selector) || channelSection(selector), `not clearly Subscriptions: ${selector}`);
  }
});

test('the channel list rules take only a section of channels, never the whole menu or the sections around it', () => {
  // A bare "ytd-guide-section-renderer" would hide the whole menu. A section that holds channel
  // links must also not be the main one (Home) or the "You" one (History and "Your channel").
  const section = subscriptions.filter((selector) => selector.includes('ytd-guide-section-renderer'));
  assert.equal(section.length, CHANNEL_SECTIONS.length);
  for (const wanted of CHANNEL_SECTIONS) assert.ok(section.some((selector) => selector.endsWith(wanted)), wanted);
  const byLinks = section.find((selector) => selector.includes('a[href^="/@"]'));
  assert.ok(byLinks.includes(':not(:has(a[href="/feed/history"], a[href="/"]))'), 'the channel-links rule must spare the You and main sections');
});

test('no other rule can reach the subscriptions page, its sidebar links or the channel list', () => {
  const others = hiding.filter((selector) => !subscriptions.includes(selector));
  for (const selector of others) assert.ok(!SUBSCRIPTIONS.test(selector), selector);
});

test('History is only hidden when its switch is on', () => {
  assert.ok(historyRules.length > 0);
  for (const selector of historyRules) {
    assert.ok(selector.startsWith('html[data-yfl-active="true"][data-yfl-block-history="true"]'), `needs the lock and the History switch: ${selector}`);
  }
});

test('every History rule names the history page or its own sidebar entry', () => {
  // The exact link matters: the "report history" entry links to /reporthistory and must stay.
  const aHistoryThing = /ytd-browse\[page-subtype="history"\] #(primary|header)$|\[data-yfl-page="history"\] ytd-browse #(primary|header)$|ytd-guide-entry-renderer:has\(a\[href="\/feed\/history"\]\)$/;
  for (const selector of historyRules) assert.match(selector, aHistoryThing, `not clearly History: ${selector}`);
  assert.ok(!css.includes('*="history"') && !css.includes('reporthistory'), 'no loose history match');
});

test('no other rule can reach History', () => {
  const others = hiding.filter((selector) => !historyRules.includes(selector));
  for (const selector of others) assert.ok(!HISTORY.test(selector), selector);
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

test('the sidebar is only hidden when its switch is on', () => {
  assert.ok(sidebar.length > 0);
  for (const selector of sidebar) {
    assert.ok(selector.startsWith('html[data-yfl-active="true"][data-yfl-block-sidebar="true"]'), `needs the lock and the Sidebar switch: ${selector}`);
  }
});

test('the sidebar rules only touch the menu: the drawer, the icon strip and the button that opens it', () => {
  for (const selector of sidebar) {
    assert.match(selector, /(tp-yt-app-drawer#guide|ytd-mini-guide-renderer|ytd-masthead #guide-button)$/, selector);
  }
});

test('the page only takes the menu\'s room back when the Sidebar switch is on', () => {
  // YouTube leaves a margin beside the page for the menu. Taking it back is a layout change, so
  // it must never apply on its own.
  const margins = [...css.matchAll(/([^{}]+)\{[^}]*margin-left[^}]*\}/g)].map((match) => match[1].trim().replace(/\s+/g, ' '));
  assert.ok(margins.length > 0);
  for (const selector of margins) {
    assert.equal(selector, 'html[data-yfl-active="true"][data-yfl-block-sidebar="true"] ytd-page-manager', selector);
  }
});

test('no other rule can reach the menu', () => {
  const others = hiding.filter((selector) => !sidebar.includes(selector));
  for (const selector of others) assert.ok(!SIDEBAR.test(selector), selector);
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
