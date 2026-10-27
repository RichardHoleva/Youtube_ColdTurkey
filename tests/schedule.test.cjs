'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read } = require('./helpers.cjs');

process.env.TZ = 'Europe/Bratislava';
const context = vm.createContext({ Date, console });
vm.runInContext(read('shared', 'schedule.js'), context);
const schedule = context.FocusSchedule;
const day = { start: '08:00', end: '20:00' };
const night = { start: '22:00', end: '06:00' };
const local = (value) => new Date(value);
const plain = (value) => JSON.parse(JSON.stringify(value));

test('default schedule and normalization reject malformed storage safely', () => {
  assert.deepEqual(plain(schedule.DEFAULT_SCHEDULE), day);
  for (const value of [undefined, null, {}, '08:00', [], { start: '8:00', end: '20:00' }, { start: '24:00', end: '20:00' }]) {
    assert.deepEqual(plain(schedule.normalize(value)), day);
  }
  assert.deepEqual(plain(schedule.normalize(night)), night);
});

test('minutes and times convert both ways and wrap around midnight', () => {
  assert.equal(schedule.toMinutes('08:30'), 510);
  assert.equal(schedule.fromMinutes(510), '08:30');
  assert.equal(schedule.fromMinutes(0), '00:00');
  assert.equal(schedule.fromMinutes(1440), '00:00');
  assert.equal(schedule.fromMinutes(-5), '23:55');
  assert.equal(schedule.fromMinutes(1440 + 65), '01:05');
  for (const time of ['00:00', '06:15', '12:00', '23:59']) assert.equal(schedule.fromMinutes(schedule.toMinutes(time)), time);
});

test('shift slides the window and keeps its length, wrapping past midnight', () => {
  assert.deepEqual(plain(schedule.shift(day, 60)), { start: '09:00', end: '21:00' });
  assert.deepEqual(plain(schedule.shift(day, -480)), { start: '00:00', end: '12:00' });
  assert.deepEqual(plain(schedule.shift({ start: '20:00', end: '23:00' }, 180)), { start: '23:00', end: '02:00' });
  assert.deepEqual(plain(schedule.shift(night, 120)), { start: '00:00', end: '08:00' });
  assert.deepEqual(plain(schedule.shift(day, 1440)), day);
  assert.deepEqual(plain(schedule.shift(day, 0)), day);
});

test('nothing saved means no lock: saved() never falls back to the default', () => {
  assert.deepEqual(plain(schedule.saved(day)), day);
  assert.deepEqual(plain(schedule.saved({ ...night, extra: true })), night);
  for (const value of [undefined, null, {}, '08:00', [], { start: '08:00', end: '08:00' }, { start: '24:00', end: '20:00' }]) {
    assert.equal(schedule.saved(value), null, JSON.stringify(value));
    assert.equal(schedule.isActive(value, local('2026-10-24T14:00:00')), false, JSON.stringify(value));
    assert.equal(schedule.nextTransition(value, local('2026-10-24T14:00:00')), null, JSON.stringify(value));
  }
});

test('validation uses strict HH:MM and rejects a zero-length interval', () => {
  assert.equal(schedule.validate(day), true);
  assert.equal(schedule.validate(night), true);
  assert.equal(schedule.validate({ start: '08:00\n', end: '20:00' }), false);
  assert.equal(schedule.validate({ start: '08:00', end: '20:00\r\n' }), false);
  assert.equal(schedule.validate({ start: '00:00', end: '23:59' }), true);
  for (const value of [undefined, null, {}, { start: '08:00', end: '08:00' }, { start: '8:00', end: '20:00' }, { start: '08:60', end: '20:00' }, { start: '24:00', end: '20:00' }, { start: '08:00 ', end: '20:00' }, { start: 8, end: 20 }]) {
    assert.equal(schedule.validate(value), false, JSON.stringify(value));
  }
});

test('day interval includes its start and excludes its end', () => {
  for (const [time, expected] of [['07:59:59', false], ['08:00:00', true], ['19:59:59', true], ['20:00:00', false], ['23:59:59', false]]) {
    assert.equal(schedule.isActive(day, local(`2026-10-24T${time}`)), expected, time);
  }
});

test('overnight interval crosses midnight and follows the same boundary rule', () => {
  for (const [time, expected] of [['00:00:00', true], ['05:59:59', true], ['06:00:00', false], ['21:59:59', false], ['22:00:00', true], ['23:59:59', true]]) {
    assert.equal(schedule.isActive(night, local(`2026-10-24T${time}`)), expected, time);
  }
});

test('next transition is strictly after now, including across midnight', () => {
  for (const [value, now, expected] of [
    [day, '2026-10-24T07:59:59', '2026-10-24T08:00:00'],
    [day, '2026-10-24T08:00:00', '2026-10-24T20:00:00'],
    [day, '2026-10-24T20:00:00', '2026-10-25T08:00:00'],
    [night, '2026-10-24T23:00:00', '2026-10-25T06:00:00'],
    [night, '2026-10-24T06:00:00', '2026-10-24T22:00:00'],
  ]) {
    const result = schedule.nextTransition(value, local(now));
    assert.equal(result.getTime(), local(expected).getTime(), `${now} -> ${expected}`);
    assert.ok(result.getTime() > local(now).getTime());
  }
});

test('daily schedule follows local clock across daylight-saving changes', () => {
  assert.equal(new Date('2026-10-25T02:30:00+02:00').getHours(), 2);
  const narrow = { start: '02:15', end: '02:45' };
  assert.equal(schedule.isActive(narrow, new Date('2026-10-25T02:30:00+02:00')), true);
  assert.equal(schedule.isActive(narrow, new Date('2026-10-25T02:30:00+01:00')), true);
  assert.equal(schedule.isActive(narrow, new Date('2026-10-25T02:50:00+01:00')), false);
  assert.equal(schedule.nextTransition(day, local('2026-03-28T21:00:00')).getTime(), local('2026-03-29T08:00:00').getTime());
  assert.equal(schedule.nextTransition(day, local('2026-10-24T21:00:00')).getTime(), local('2026-10-25T08:00:00').getTime());
});

test('timeline segments map the saved interval onto a 0-1440 minute axis', () => {
  assert.deepEqual(plain(schedule.segments(day)), [[480, 1200]]);
  assert.deepEqual(plain(schedule.segments({ start: '00:00', end: '23:59' })), [[0, 1439]]);
  assert.deepEqual(plain(schedule.segments({ start: '06:30', end: '07:15' })), [[390, 435]]);
  assert.deepEqual(plain(schedule.segments(undefined)), [[480, 1200]]);
});

test('overnight timeline segments split at midnight without empty pieces', () => {
  assert.deepEqual(plain(schedule.segments(night)), [[1320, 1440], [0, 360]]);
  assert.deepEqual(plain(schedule.segments({ start: '22:00', end: '00:00' })), [[1320, 1440]]);
  assert.deepEqual(plain(schedule.segments({ start: '23:59', end: '00:01' })), [[1439, 1440], [0, 1]]);
});

test('timeline pieces always add up to the same length as the active minutes', () => {
  for (const value of [day, night, { start: '00:00', end: '12:00' }, { start: '12:00', end: '00:00' }, { start: '23:00', end: '01:00' }]) {
    const length = schedule.segments(value).reduce((sum, [from, to]) => sum + (to - from), 0);
    let active = 0;
    for (let minute = 0; minute < 1440; minute += 1) {
      if (schedule.isActive(value, local(`2026-10-24T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`))) active += 1;
    }
    assert.equal(length, active, JSON.stringify(value));
  }
});

test('local clock helpers give 24-hour HH:mm and minutes since midnight', () => {
  assert.equal(schedule.timeLabel(local('2026-10-24T00:05:59')), '00:05');
  assert.equal(schedule.timeLabel(local('2026-10-24T16:59:00')), '16:59');
  assert.equal(schedule.timeLabel(local('2026-10-24T23:59:59')), '23:59');
  assert.equal(schedule.minutesOfDay(local('2026-10-24T00:00:00')), 0);
  assert.equal(schedule.minutesOfDay(local('2026-10-24T21:30:45')), 1290);
});

test('time entry accepts common shorthand and returns strict HH:mm', () => {
  for (const [input, expected] of [['08:00', '08:00'], ['8:00', '08:00'], ['8', '08:00'], ['8:', '08:00'], ['20', '20:00'], ['800', '08:00'], ['815', '08:15'], ['0830', '08:30'], ['2000', '20:00'], [' 07:05 ', '07:05'], ['00:00', '00:00'], ['23:59', '23:59']]) {
    assert.equal(schedule.parseTime(input), expected, input);
  }
  for (const input of ['', ':', '24:00', '8:60', '99', '99:', '81:5', '12:3', '8:5', '2460', 'ab:cd', '08:00:00', '-1', '08.00', null, undefined, 800]) {
    assert.equal(schedule.parseTime(input), null, String(input));
  }
});

test('next transition detects a second repeated hour and the clock rollback itself', () => {
  const narrow = { start: '02:15', end: '02:45' };
  assert.equal(schedule.nextTransition(narrow, new Date('2026-10-25T02:50:00+02:00')).getTime(), new Date('2026-10-25T02:15:00+01:00').getTime());
  const rollback = { start: '01:30', end: '02:30' };
  assert.equal(schedule.nextTransition(rollback, new Date('2026-10-25T02:50:00+02:00')).getTime(), new Date('2026-10-25T02:00:00+01:00').getTime());
});
