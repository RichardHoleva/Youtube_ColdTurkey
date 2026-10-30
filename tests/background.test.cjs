'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { src, read } = require('./helpers.cjs');

process.env.TZ = 'Europe/Bratislava';
const day = { start: '08:00', end: '20:00' };
const night = { start: '22:00', end: '06:00' };
const every = (window) => (window ? [{ days: [1, 2, 3, 4, 5, 6, 0], start: window.start, end: window.end }] : window);
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function event() {
  const listeners = [];
  return {
    addListener(listener) { listeners.push(listener); },
    emit(...args) { return listeners.map(listener => listener(...args)); },
    listeners
  };
}

async function worker({ initial = {}, time = '2026-10-24T14:00:00', brokenTabs = false } = {}) {
  let currentTime = new Date(time).getTime();
  let failStorage = false;
  const storage = clone(initial);
  const alarms = new Map();
  const broadcasts = [];
  const badges = [];
  const titles = [];
  const writes = [];
  const errors = [];
  const onChanged = event();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [currentTime])); }
    static now() { return currentTime; }
  }
  const chrome = {
    runtime: { onMessage: event(), onInstalled: event(), onStartup: event() },
    storage: {
      onChanged,
      local: {
        async get(keys) {
          if (failStorage) throw new Error('Storage unavailable');
          return Object.fromEntries([].concat(keys).map(key => [key, clone(storage[key])]));
        },
        async set(update) {
          if (failStorage) throw new Error('Storage unavailable');
          const changes = {};
          for (const [key, value] of Object.entries(update)) {
            changes[key] = { oldValue: clone(storage[key]), newValue: clone(value) };
            storage[key] = clone(value);
          }
          writes.push(clone(update));
          onChanged.emit(changes, 'local');
        },
        async remove(keys) {
          if (failStorage) throw new Error('Storage unavailable');
          const changes = {};
          for (const key of [].concat(keys)) {
            if (!(key in storage)) continue;
            changes[key] = { oldValue: clone(storage[key]) };
            delete storage[key];
          }
          if (Object.keys(changes).length) onChanged.emit(changes, 'local');
        },      }
    },
    alarms: {
      onAlarm: event(),
      async get(name) { return alarms.get(name); },
      async clear(name) { return alarms.delete(name); },
      async create(name, details) {
        alarms.set(name, { name, scheduledTime: details.when ?? currentTime + details.periodInMinutes * 60000, ...details });
      }
    },
    action: {
      async setBadgeText(value) { badges.push(value.text); },
      async setBadgeBackgroundColor() {},
      async setTitle(value) { titles.push(value.title); }
    },
    tabs: {
      async query(query) {
        assert.ok(query.url.every(url => url.includes('youtube.com')));
        return [{ id: 1 }, { id: 2 }];
      },
      async sendMessage(id, value) {
        if (brokenTabs && id === 2) throw new Error('No receiving content script');
        broadcasts.push({ id, message: clone(value) });
      }
    }
  };
  let context;
  context = vm.createContext({
    chrome,
    Date: Clock,
    console: { error(...args) { errors.push(args); } },
    importScripts(...files) {
      for (const file of files) {
        const code = fs.readFileSync(path.resolve(src('background'), file), 'utf8');
        vm.runInContext(code, context, { filename: file });
      }
    }
  });
  vm.runInContext(read('background', 'background.js'), context, { filename: 'background.js' });
  async function flush() {
    for (let count = 0; count < 8; count += 1) {
      const promise = vm.runInContext('pending', context);
      await promise;
      if (vm.runInContext('pending', context) === promise) return;
    }
    throw new Error('Worker queue did not settle');
  }
  await flush();
  return {
    chrome, storage, alarms, broadcasts, badges, titles, writes, errors, flush,
    setTime(time) { currentTime = new Date(time).getTime(); },
    setStorageFailure(value) { failStorage = value; },
    async message(message) {
      return clone(await new Promise((resolve, reject) => {
        const result = chrome.runtime.onMessage.listeners[0](message, { id: 'test' }, resolve);
        if (result !== true) reject(new Error('Message not accepted'));
      }));
    }
  };
}

test('fresh install is not locked: nothing is stored, no boundary alarm, badge asks for setup', async () => {
  // 14:00 is inside the old default window, which used to lock a new user immediately.
  const app = await worker();
  assert.equal(app.storage.occasions, undefined);
  assert.equal(app.writes.length, 0);
  assert.equal(app.alarms.get('focus-clock-check').periodInMinutes, 1);
  assert.equal(app.alarms.has('focus-next-transition'), false);
  assert.equal(app.badges.at(-1), 'SET');
  assert.equal(app.titles.at(-1), 'Focus Lock: set your focus hours');
  assert.equal(app.broadcasts.at(-1).message.state.active, false);
  assert.equal(app.broadcasts.at(-1).message.state.occasions, null);
  const response = await app.message({ type: 'GET_STATE' });
  assert.equal(response.ok, true);
  assert.equal(response.state.occasions, null);
  assert.equal(response.state.active, false);
  assert.equal(response.state.nextChange, null);
  assert.equal(app.writes.length, 0);
});

test('first save starts the lock right away when the window includes now', async () => {
  const app = await worker();
  const response = await app.message({ type: 'SAVE_OCCASIONS', occasions: every(day) });
  assert.equal(response.ok, true);
  assert.equal(response.state.active, true);
  assert.deepEqual(app.storage.occasions, every(day));
  await app.flush();
  assert.equal(app.badges.at(-1), 'ON');
  assert.equal(app.broadcasts.at(-1).message.state.active, true);
  assert.equal(app.alarms.get('focus-next-transition').scheduledTime, new Date('2026-10-24T20:00:00').getTime());
  const locked = await app.message({ type: 'SAVE_OCCASIONS', occasions: every(night) });
  assert.equal(locked.code, 'LOCKED');
  assert.equal(locked.message, 'Locked until 20:00.');
  assert.deepEqual(app.storage.occasions, every(day));
});

test('first save outside the window arms the lock for its start without locking yet', async () => {
  const app = await worker({ time: '2026-10-24T21:00:00' });
  const response = await app.message({ type: 'SAVE_OCCASIONS', occasions: every(day) });
  assert.equal(response.ok, true);
  assert.equal(response.state.active, false);
  await app.flush();
  assert.equal(app.badges.at(-1), '');
  assert.equal(app.titles.at(-1), 'Focus Lock: feed is open until 08:00');
  assert.equal(app.alarms.get('focus-next-transition').scheduledTime, new Date('2026-10-25T08:00:00').getTime());
  app.setTime('2026-10-25T08:00:00');
  app.chrome.alarms.onAlarm.emit({ name: 'focus-next-transition' });
  await app.flush();
  assert.equal(app.badges.at(-1), 'ON');
  assert.equal((await app.message({ type: 'SAVE_OCCASIONS', occasions: every(night) })).code, 'LOCKED');
});

test('unreadable stored schedule counts as not set up and is left alone', async () => {
  const app = await worker({ initial: { schedule: { start: '25:00', end: '20:00' } } });
  assert.equal((await app.message({ type: 'GET_STATE' })).state.occasions, null);
  assert.equal(app.badges.at(-1), 'SET');
  assert.equal(app.writes.length, 0);
  assert.equal((await app.message({ type: 'SAVE_OCCASIONS', occasions: every(night) })).ok, true);
});

test('active lock rejects schedule writes at the worker boundary', async () => {
  const app = await worker({ initial: { occasions: every(day) } });
  const response = await app.message({ type: 'SAVE_OCCASIONS', occasions: every(night) });
  assert.equal(response.ok, false);
  assert.equal(response.code, 'LOCKED');
  assert.equal(response.state.active, true);
  assert.deepEqual(app.storage.occasions, every(day));
  assert.equal(app.writes.length, 0);
});

test('stale unlocked popup cannot save after the active interval begins', async () => {
  const app = await worker({ initial: { occasions: every(day) }, time: '2026-10-24T07:59:59' });
  assert.equal((await app.message({ type: 'GET_STATE' })).state.active, false);
  app.setTime('2026-10-24T08:00:00');
  assert.equal((await app.message({ type: 'SAVE_OCCASIONS', occasions: every(night) })).code, 'LOCKED');
  assert.deepEqual(app.storage.occasions, every(day));
});

test('inactive schedule can be saved and immediately becomes active when appropriate', async () => {
  const app = await worker({ initial: { occasions: every(night) } });
  const response = await app.message({ type: 'SAVE_OCCASIONS', occasions: every(day) });
  assert.equal(response.ok, true);
  assert.equal(response.state.active, true);
  assert.deepEqual(app.storage.occasions, every(day));
  await app.flush();
  assert.equal(app.broadcasts.at(-1).message.state.active, true);
  assert.equal((await app.message({ type: 'SAVE_OCCASIONS', occasions: every(night) })).code, 'LOCKED');
});

test('concurrent popups cannot overwrite a newly active schedule', async () => {
  const app = await worker({ initial: { occasions: every(night) } });
  const [first, second] = await Promise.all([
    app.message({ type: 'SAVE_OCCASIONS', occasions: every(day) }),
    app.message({ type: 'SAVE_OCCASIONS', occasions: every({ start: '09:00', end: '21:00' }) })
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.code, 'LOCKED');
  assert.deepEqual(app.storage.occasions, every(day));
});

test('malformed requests are rejected without modifying inactive storage', async () => {
  const app = await worker({ initial: { occasions: every(night) } });
  for (const schedule of [{ start: '08:00', end: '08:00' }, { start: '99:00', end: '20:00' }, null]) {
    const response = await app.message({ type: 'SAVE_OCCASIONS', occasions: every(schedule) });
    assert.equal(response.code, 'INVALID');
  }
  assert.deepEqual(app.storage.occasions, every(night));
  assert.equal(app.writes.length, 0);
});

test('alarms recompute actual current time after a delayed wake and schedule the next boundary', async () => {
  const app = await worker({ initial: { occasions: every(day) } });
  app.setTime('2026-10-24T21:30:00');
  app.alarms.delete('focus-next-transition');
  app.chrome.alarms.onAlarm.emit({ name: 'focus-next-transition' });
  await app.flush();
  assert.equal(app.badges.at(-1), '');
  assert.equal(app.broadcasts.at(-1).message.state.active, false);
  assert.equal(app.alarms.get('focus-next-transition').scheduledTime, new Date('2026-10-25T08:00:00').getTime());
});

test('restart preserves the schedule and recreates missing alarms', async () => {
  const first = await worker({ initial: { occasions: every(night) }, time: '2026-10-24T14:00:00' });
  const restarted = await worker({ initial: first.storage, time: '2026-10-25T00:30:00' });
  assert.deepEqual(restarted.storage.occasions, every(night));
  assert.equal((await restarted.message({ type: 'GET_STATE' })).state.active, true);
  assert.equal(restarted.alarms.size, 2);
  assert.equal(restarted.alarms.get('focus-next-transition').scheduledTime, new Date('2026-10-25T06:00:00').getTime());
  assert.equal(restarted.writes.length, 0);
});

test('toolbar title and rejection messages are English and use the real next transition', async () => {
  const app = await worker({ initial: { occasions: every(day) } });
  assert.equal(app.titles.at(-1), 'Focus Lock: no feed until 20:00');
  const locked = await app.message({ type: 'SAVE_OCCASIONS', occasions: every(night) });
  assert.equal(locked.message, 'Locked until 20:00.');
  app.setTime('2026-10-24T21:30:00');
  app.chrome.alarms.onAlarm.emit({ name: 'focus-clock-check' });
  await app.flush();
  assert.equal(app.titles.at(-1), 'Focus Lock: feed is open until 08:00');
  const invalid = await app.message({ type: 'SAVE_OCCASIONS', occasions: every({ start: '08:00', end: '08:00' }) });
  assert.equal(invalid.message, 'Give every occasion at least one day, and two different times as HH:mm.');
});

test('night schedule title and lock message name the end after midnight', async () => {
  const app = await worker({ initial: { occasions: every(night) }, time: '2026-10-24T23:00:00' });
  assert.equal(app.titles.at(-1), 'Focus Lock: no feed until 06:00');
  assert.equal((await app.message({ type: 'SAVE_OCCASIONS', occasions: every(day) })).message, 'Locked until 06:00.');
});

test('unreachable YouTube tabs do not break state updates', async () => {
  const app = await worker({ initial: { occasions: every(day) }, brokenTabs: true });
  assert.equal((await app.message({ type: 'GET_STATE' })).ok, true);
  assert.equal(app.errors.length, 0);
  assert.equal(app.broadcasts.length, 1);
});

test('storage errors return a visible failure instead of falsely reporting a save', async () => {
  const app = await worker({ initial: { occasions: every(night) } });
  app.setStorageFailure(true);
  const response = await app.message({ type: 'SAVE_OCCASIONS', occasions: every(day) });
  assert.equal(response.ok, false);
  assert.equal(response.code, 'ERROR');
  assert.deepEqual(app.storage.occasions, every(night));
});

test('switches start off and travel with the state', async () => {
  const app = await worker();
  assert.deepEqual((await app.message({ type: 'GET_STATE' })).state.options, { sidebar: false, shorts: false, subscriptions: false });
  assert.deepEqual(app.broadcasts.at(-1).message.state.options, { sidebar: false, shorts: false, subscriptions: false });
});

test('switches can be saved while unlocked and leave the schedule alone', async () => {
  const app = await worker({ initial: { occasions: every(night) } });
  const response = await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: false, shorts: false, subscriptions: true } });
  assert.equal(response.ok, true);
  assert.deepEqual(response.state.options, { sidebar: false, shorts: false, subscriptions: true });
  assert.deepEqual(app.storage.options, { sidebar: false, shorts: false, subscriptions: true });
  assert.deepEqual(app.storage.occasions, every(night));
  await app.flush();
  assert.equal(app.broadcasts.at(-1).message.state.options.subscriptions, true);
});

test('a switch that is on cannot be turned off during the lock', async () => {
  const locked = { sidebar: false, shorts: false, subscriptions: true };
  const app = await worker({ initial: { occasions: every(day), options: locked } });
  const response = await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: false, shorts: false, subscriptions: false } });
  assert.equal(response.ok, false);
  assert.equal(response.code, 'LOCKED');
  assert.equal(response.message, 'Blocked items stay blocked until 20:00.');
  assert.deepEqual(app.storage.options, locked);
  assert.equal(app.writes.length, 0);
});

test('more can be blocked during the lock, and it stays blocked', async () => {
  const app = await worker({ initial: { occasions: every(day), options: { sidebar: false, shorts: false, subscriptions: false } } });
  const response = await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: false, shorts: false, subscriptions: true } });
  assert.equal(response.ok, true);
  assert.deepEqual(app.storage.options, { sidebar: false, shorts: false, subscriptions: true });
  assert.deepEqual(app.storage.occasions, every(day));
  await app.flush();
  assert.equal(app.broadcasts.at(-1).message.state.options.subscriptions, true);
  const undo = await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: false, shorts: false, subscriptions: false } });
  assert.equal(undo.code, 'LOCKED');
  assert.equal(app.storage.options.subscriptions, true);
});

test('saving the same switches again during the lock is harmless', async () => {
  const kept = { sidebar: false, shorts: false, subscriptions: true };
  const app = await worker({ initial: { occasions: every(day), options: kept } });
  assert.equal((await app.message({ type: 'SAVE_OPTIONS', options: kept })).ok, true);
  assert.deepEqual(app.storage.options, kept);
});

test('adding one block cannot be combined with dropping another during the lock', async () => {
  const kept = { sidebar: false, shorts: false, subscriptions: true };
  const app = await worker({ initial: { occasions: every(day), options: kept } });
  const response = await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: false, shorts: true, subscriptions: false } });
  assert.equal(response.code, 'LOCKED');
  assert.deepEqual(app.storage.options, kept);
  assert.equal(app.writes.length, 0);
});

test('the hours stay locked even though blocks can be added', async () => {
  const app = await worker({ initial: { occasions: every(day), options: { sidebar: false, shorts: false, subscriptions: false } } });
  await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: false, shorts: true, subscriptions: false } });
  assert.equal((await app.message({ type: 'SAVE_OCCASIONS', occasions: every(night) })).code, 'LOCKED');
  assert.deepEqual(app.storage.occasions, every(day));
});

test('a popup with a stale clock cannot switch something off once the lock has begun', async () => {
  const app = await worker({ initial: { occasions: every(day), options: { sidebar: false, shorts: false, subscriptions: true } }, time: '2026-10-24T07:59:59' });
  assert.equal((await app.message({ type: 'GET_STATE' })).state.active, false);
  app.setTime('2026-10-24T08:00:00');
  const response = await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: false, shorts: false, subscriptions: false } });
  assert.equal(response.code, 'LOCKED');
  assert.equal(app.storage.options.subscriptions, true);
});

test('malformed switch requests are rejected without touching storage', async () => {
  const app = await worker({ initial: { occasions: every(night) } });
  for (const options of [null, {}, { shorts: true }, { shorts: 'yes', subscriptions: false }, [true, false]]) {
    assert.equal((await app.message({ type: 'SAVE_OPTIONS', options })).code, 'INVALID', JSON.stringify(options));
  }
  assert.equal(app.storage.options, undefined);
  assert.equal(app.writes.length, 0);
});

test('switches survive a restart and reach YouTube tabs while the lock is on', async () => {
  const first = await worker({ initial: { occasions: every(night) } });
  await first.message({ type: 'SAVE_OPTIONS', options: { sidebar: false, shorts: false, subscriptions: true } });
  const restarted = await worker({ initial: first.storage, time: '2026-10-24T23:00:00' });
  const message = restarted.broadcasts.at(-1).message;
  assert.equal(message.state.active, true);
  assert.deepEqual(message.state.options, { sidebar: false, shorts: false, subscriptions: true });
});

test('the Sidebar switch follows the same add-only rule as the others', async () => {
  const app = await worker({ initial: { occasions: every(day), options: { sidebar: false, shorts: false, subscriptions: false } } });
  const added = await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: true, shorts: false, subscriptions: false } });
  assert.equal(added.ok, true);
  assert.equal(app.storage.options.sidebar, true);
  const undo = await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: false, shorts: false, subscriptions: false } });
  assert.equal(undo.code, 'LOCKED');
  assert.equal(undo.message, 'Blocked items stay blocked until 20:00.');
  assert.equal(app.storage.options.sidebar, true);
});

test('options saved before the Sidebar switch existed still load, with the new one off', async () => {
  const app = await worker({ initial: { occasions: every(day), options: { shorts: true, subscriptions: false } } });
  assert.deepEqual((await app.message({ type: 'GET_STATE' })).state.options, { sidebar: false, shorts: true, subscriptions: false });
  const added = await app.message({ type: 'SAVE_OPTIONS', options: { sidebar: true, shorts: true, subscriptions: false } });
  assert.equal(added.ok, true);
});

// 2026-10-24 is a Saturday: 10-26 is Monday, 10-27 Tuesday.
const weekdays = { days: [1, 2, 3, 4, 5], start: '08:00', end: '20:00' };
const weekend = { days: [6, 0], start: '10:00', end: '14:00' };

test('a plan with different times per occasion is stored whole and locks only on its own days', async () => {
  const app = await worker({ time: '2026-10-24T15:00:00' }); // Saturday, after the weekend window
  const response = await app.message({ type: 'SAVE_OCCASIONS', occasions: [weekdays, weekend] });
  assert.equal(response.ok, true);
  assert.equal(response.state.active, false);
  assert.deepEqual(app.storage.occasions, [weekdays, weekend]);
  assert.equal(response.state.nextChange, new Date('2026-10-25T10:00:00').getTime(), 'Sunday morning is next');
  await app.flush();
  assert.equal(app.alarms.get('focus-next-transition').scheduledTime, new Date('2026-10-25T10:00:00').getTime());
  assert.equal(app.titles.at(-1), 'Focus Lock: feed is open until 10:00');
});

test('the lock follows the day: on in the weekend window, open in the weekday gap', async () => {
  const saturday = await worker({ initial: { occasions: [weekdays, weekend] }, time: '2026-10-24T11:00:00' });
  assert.equal((await saturday.message({ type: 'GET_STATE' })).state.active, true);
  assert.equal(saturday.titles.at(-1), 'Focus Lock: no feed until 14:00');
  assert.equal(saturday.badges.at(-1), 'ON');
  const saturdayMorning = await worker({ initial: { occasions: [weekdays, weekend] }, time: '2026-10-24T09:00:00' });
  assert.equal((await saturdayMorning.message({ type: 'GET_STATE' })).state.active, false, 'weekend starts at 10:00');
  const monday = await worker({ initial: { occasions: [weekdays, weekend] }, time: '2026-10-26T09:00:00' });
  assert.equal((await monday.message({ type: 'GET_STATE' })).state.active, true);
  assert.equal(monday.titles.at(-1), 'Focus Lock: no feed until 20:00');
});

test('the lock covers every occasion: a weekday plan cannot be rewritten during the weekend window either', async () => {
  const app = await worker({ initial: { occasions: [weekdays, weekend] }, time: '2026-10-24T11:00:00' });
  const response = await app.message({ type: 'SAVE_OCCASIONS', occasions: every(night) });
  assert.equal(response.code, 'LOCKED');
  assert.equal(response.message, 'Locked until 14:00.');
  assert.deepEqual(app.storage.occasions, [weekdays, weekend]);
});

test('on a day with no occasion nothing is locked, so the plan can be changed', async () => {
  const mondayOnly = [{ days: [1], start: '08:00', end: '20:00' }];
  const app = await worker({ initial: { occasions: mondayOnly }, time: '2026-10-27T12:00:00' }); // Tuesday
  assert.equal((await app.message({ type: 'GET_STATE' })).state.active, false);
  assert.equal((await app.message({ type: 'SAVE_OCCASIONS', occasions: [weekdays] })).ok, true);
});

test('plans that are not valid are refused and nothing is written', async () => {
  const app = await worker({ time: '2026-10-24T15:00:00' });
  const six = [1, 2, 3, 4, 5, 6].map((day) => ({ days: [day], start: '08:00', end: '20:00' }));
  for (const occasions of [null, [], [{ ...weekdays, days: [] }], [weekdays, { ...weekend, days: [5, 6] }], [{ ...weekdays, end: '08:00' }], six]) {
    const response = await app.message({ type: 'SAVE_OCCASIONS', occasions });
    assert.equal(response.code, 'INVALID', JSON.stringify(occasions));
  }
  assert.equal(app.writes.length, 0);
});

test('a single window saved by an earlier version is read as an every-day plan', async () => {
  const app = await worker({ initial: { schedule: day }, time: '2026-10-24T14:00:00' });
  const state = (await app.message({ type: 'GET_STATE' })).state;
  assert.deepEqual(state.occasions, every(day));
  assert.equal(state.active, true);
  assert.equal(app.titles.at(-1), 'Focus Lock: no feed until 20:00');
});

test('saving a plan replaces the leftover single window', async () => {
  const app = await worker({ initial: { schedule: night }, time: '2026-10-24T14:00:00' });
  const response = await app.message({ type: 'SAVE_OCCASIONS', occasions: [weekdays, weekend] });
  assert.equal(response.ok, true);
  assert.deepEqual(app.storage.occasions, [weekdays, weekend]);
  assert.equal('schedule' in app.storage, false);
});

test('the content script is told the plan, not a single window', async () => {
  const app = await worker({ initial: { occasions: [weekdays, weekend] }, time: '2026-10-26T09:00:00' });
  const state = app.broadcasts.at(-1).message.state;
  assert.deepEqual(state.occasions, [weekdays, weekend]);
  assert.equal('schedule' in state, false);
});
