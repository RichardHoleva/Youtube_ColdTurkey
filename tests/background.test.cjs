'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

process.env.TZ = 'Europe/Bratislava';
const parent = path.resolve(__dirname, '..');
const extension = fs.existsSync(path.join(parent, 'manifest.json'))
  ? parent
  : path.join(parent, 'youtube-focus-lock');
const day = { start: '08:00', end: '20:00' };
const night = { start: '22:00', end: '06:00' };
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
        async get(key) {
          if (failStorage) throw new Error('Storage unavailable');
          return { [key]: clone(storage[key]) };
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
        }
      }
    },
    alarms: {
      onAlarm: event(),
      async get(name) { return alarms.get(name); },
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
    importScripts(file) { vm.runInContext(fs.readFileSync(path.join(extension, file), 'utf8'), context, { filename: file }); }
  });
  vm.runInContext(fs.readFileSync(path.join(extension, 'background.js'), 'utf8'), context, { filename: 'background.js' });
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

test('fresh worker persists defaults, creates alarms and publishes current state', async () => {
  const app = await worker();
  assert.deepEqual(app.storage.schedule, day);
  assert.equal(app.alarms.get('focus-clock-check').periodInMinutes, 1);
  assert.equal(app.alarms.get('focus-next-transition').scheduledTime, new Date('2026-10-24T20:00:00').getTime());
  assert.equal(app.badges.at(-1), 'ON');
  assert.equal(app.broadcasts.at(-1).message.state.active, true);
  const response = await app.message({ type: 'GET_STATE' });
  assert.equal(response.ok, true);
  assert.deepEqual(response.state.schedule, day);
  assert.equal(response.state.active, true);
  assert.equal(app.writes.length, 1);
});

test('active lock rejects schedule writes at the worker boundary', async () => {
  const app = await worker({ initial: { schedule: day } });
  const response = await app.message({ type: 'SAVE_SCHEDULE', schedule: night });
  assert.equal(response.ok, false);
  assert.equal(response.code, 'LOCKED');
  assert.equal(response.state.active, true);
  assert.deepEqual(app.storage.schedule, day);
  assert.equal(app.writes.length, 0);
});

test('stale unlocked popup cannot save after the active interval begins', async () => {
  const app = await worker({ initial: { schedule: day }, time: '2026-10-24T07:59:59' });
  assert.equal((await app.message({ type: 'GET_STATE' })).state.active, false);
  app.setTime('2026-10-24T08:00:00');
  assert.equal((await app.message({ type: 'SAVE_SCHEDULE', schedule: night })).code, 'LOCKED');
  assert.deepEqual(app.storage.schedule, day);
});

test('inactive schedule can be saved and immediately becomes active when appropriate', async () => {
  const app = await worker({ initial: { schedule: night } });
  const response = await app.message({ type: 'SAVE_SCHEDULE', schedule: day });
  assert.equal(response.ok, true);
  assert.equal(response.state.active, true);
  assert.deepEqual(app.storage.schedule, day);
  await app.flush();
  assert.equal(app.broadcasts.at(-1).message.state.active, true);
  assert.equal((await app.message({ type: 'SAVE_SCHEDULE', schedule: night })).code, 'LOCKED');
});

test('concurrent popups cannot overwrite a newly active schedule', async () => {
  const app = await worker({ initial: { schedule: night } });
  const [first, second] = await Promise.all([
    app.message({ type: 'SAVE_SCHEDULE', schedule: day }),
    app.message({ type: 'SAVE_SCHEDULE', schedule: { start: '09:00', end: '21:00' } })
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.code, 'LOCKED');
  assert.deepEqual(app.storage.schedule, day);
});

test('malformed requests are rejected without modifying inactive storage', async () => {
  const app = await worker({ initial: { schedule: night } });
  for (const schedule of [{ start: '08:00', end: '08:00' }, { start: '99:00', end: '20:00' }, null]) {
    const response = await app.message({ type: 'SAVE_SCHEDULE', schedule });
    assert.equal(response.code, 'INVALID');
  }
  assert.deepEqual(app.storage.schedule, night);
  assert.equal(app.writes.length, 0);
});

test('alarms recompute actual current time after a delayed wake and schedule the next boundary', async () => {
  const app = await worker({ initial: { schedule: day } });
  app.setTime('2026-10-24T21:30:00');
  app.alarms.delete('focus-next-transition');
  app.chrome.alarms.onAlarm.emit({ name: 'focus-next-transition' });
  await app.flush();
  assert.equal(app.badges.at(-1), '');
  assert.equal(app.broadcasts.at(-1).message.state.active, false);
  assert.equal(app.alarms.get('focus-next-transition').scheduledTime, new Date('2026-10-25T08:00:00').getTime());
});

test('restart preserves the schedule and recreates missing alarms', async () => {
  const first = await worker({ initial: { schedule: night }, time: '2026-10-24T14:00:00' });
  const restarted = await worker({ initial: first.storage, time: '2026-10-25T00:30:00' });
  assert.deepEqual(restarted.storage.schedule, night);
  assert.equal((await restarted.message({ type: 'GET_STATE' })).state.active, true);
  assert.equal(restarted.alarms.size, 2);
  assert.equal(restarted.alarms.get('focus-next-transition').scheduledTime, new Date('2026-10-25T06:00:00').getTime());
  assert.equal(restarted.writes.length, 0);
});

test('toolbar title and rejection messages are English and use the real next transition', async () => {
  const app = await worker({ initial: { schedule: day } });
  assert.equal(app.titles.at(-1), 'Focus Lock: no feed until 20:00');
  const locked = await app.message({ type: 'SAVE_SCHEDULE', schedule: night });
  assert.equal(locked.message, 'Schedule is locked until 20:00.');
  app.setTime('2026-10-24T21:30:00');
  app.chrome.alarms.onAlarm.emit({ name: 'focus-clock-check' });
  await app.flush();
  assert.equal(app.titles.at(-1), 'Focus Lock: feed is open until 08:00');
  const invalid = await app.message({ type: 'SAVE_SCHEDULE', schedule: { start: '08:00', end: '08:00' } });
  assert.equal(invalid.message, 'Enter two different times as HH:mm.');
});

test('night schedule title and lock message name the end after midnight', async () => {
  const app = await worker({ initial: { schedule: night }, time: '2026-10-24T23:00:00' });
  assert.equal(app.titles.at(-1), 'Focus Lock: no feed until 06:00');
  assert.equal((await app.message({ type: 'SAVE_SCHEDULE', schedule: day })).message, 'Schedule is locked until 06:00.');
});

test('unreachable YouTube tabs do not break state updates', async () => {
  const app = await worker({ initial: { schedule: day }, brokenTabs: true });
  assert.equal((await app.message({ type: 'GET_STATE' })).ok, true);
  assert.equal(app.errors.length, 0);
  assert.equal(app.broadcasts.length, 1);
});

test('storage errors return a visible failure instead of falsely reporting a save', async () => {
  const app = await worker({ initial: { schedule: night } });
  app.setStorageFailure(true);
  const response = await app.message({ type: 'SAVE_SCHEDULE', schedule: day });
  assert.equal(response.ok, false);
  assert.equal(response.code, 'ERROR');
  assert.deepEqual(app.storage.schedule, night);
});
