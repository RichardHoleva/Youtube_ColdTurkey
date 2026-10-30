'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { read } = require('./helpers.cjs');

process.env.TZ = 'Europe/Bratislava';
const context = vm.createContext({ Date, console });
vm.runInContext(read('shared', 'schedule.js'), context);
vm.runInContext(read('shared', 'occasions.js'), context);
const plans = context.FocusOccasions;
const plain = (value) => JSON.parse(JSON.stringify(value));
const at = (value) => new Date(value);

// 2026-10-24 is a Saturday, so 10-26 is Monday and 10-30 is Friday.
const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0;
const weekdays = { days: [MON, TUE, WED, THU, FRI], start: '08:00', end: '20:00' };
const weekend = { days: [SAT, SUN], start: '10:00', end: '14:00' };
const week = [weekdays, weekend];

test('a plan needs 1 to 5 occasions, each with days and two different times', () => {
  assert.equal(plans.validate([weekdays]), true);
  assert.equal(plans.validate(week), true);
  assert.equal(plans.MAX_OCCASIONS, 5);
  const five = [MON, TUE, WED, THU, FRI].map((day) => ({ days: [day], start: '08:00', end: '20:00' }));
  assert.equal(plans.validate(five), true);
  assert.equal(plans.validate([...five, { days: [SAT], start: '08:00', end: '20:00' }]), false, 'six is too many');
  for (const value of [undefined, null, [], {}, 'x', [null], [{ ...weekdays, days: [] }], [{ ...weekdays, days: 'mon' }],
    [{ ...weekdays, days: [MON, MON] }], [{ ...weekdays, days: [7] }], [{ ...weekdays, days: [1.5] }],
    [{ ...weekdays, end: '08:00' }], [{ ...weekdays, start: '25:00' }], [{ days: [MON] }]]) {
    assert.equal(plans.validate(value), false, JSON.stringify(value));
  }
});

test('a day can belong to only one occasion', () => {
  assert.equal(plans.validate([weekdays, { ...weekend, days: [SAT, FRI] }]), false);
  assert.equal(plans.validate([weekdays, { ...weekend, days: [SUN] }]), true);
});

test('saved() and fromStored() never invent a plan', () => {
  assert.deepEqual(plain(plans.saved(week)), [{ ...weekdays }, { ...weekend }]);
  assert.equal(plans.saved([{ ...weekdays, end: '08:00' }]), null);
  assert.equal(plans.fromStored({}), null);
  assert.equal(plans.fromStored(undefined), null);
  assert.equal(plans.fromStored({ occasions: [] }), null);
});

test('days are kept in the order a week is shown, Monday first', () => {
  const [only] = plans.saved([{ days: [SUN, WED, MON], start: '08:00', end: '20:00' }]);
  assert.deepEqual(plain(only.days), [MON, WED, SUN]);
});

test('a single window saved by an earlier version becomes an every-day occasion', () => {
  const plan = plans.fromStored({ schedule: { start: '22:00', end: '06:00' } });
  assert.deepEqual(plain(plan), [{ days: [1, 2, 3, 4, 5, 6, 0], start: '22:00', end: '06:00' }]);
  assert.equal(plans.fromStored({ schedule: { start: '25:00', end: '20:00' } }), null);
});

test('a saved plan wins over a leftover single window', () => {
  const plan = plans.fromStored({ occasions: week, schedule: { start: '01:00', end: '02:00' } });
  assert.equal(plan.length, 2);
  assert.equal(plan[0].start, '08:00');
});

test('each day uses the occasion it belongs to', () => {
  assert.equal(plans.isActive(week, at('2026-10-26T09:00:00')), true, 'Monday morning');
  assert.equal(plans.isActive(week, at('2026-10-26T21:00:00')), false, 'Monday night');
  assert.equal(plans.isActive(week, at('2026-10-24T11:00:00')), true, 'Saturday inside the weekend window');
  assert.equal(plans.isActive(week, at('2026-10-24T15:00:00')), false, 'Saturday after it');
  assert.equal(plans.isActive(week, at('2026-10-24T09:00:00')), false, 'Saturday morning is not a weekday window');
  assert.equal(plans.isActive(week, at('2026-10-25T13:59:00')), true, 'Sunday, the last minute');
  assert.equal(plans.isActive(week, at('2026-10-25T14:00:00')), false, 'the end is exclusive');
});

test('a day with no occasion has no focus', () => {
  const mondayOnly = [{ days: [MON], start: '08:00', end: '20:00' }];
  assert.equal(plans.isActive(mondayOnly, at('2026-10-27T12:00:00')), false, 'Tuesday');
  assert.equal(plans.isActive(mondayOnly, at('2026-10-26T12:00:00')), true, 'Monday');
});

test('no plan means no lock', () => {
  for (const value of [null, undefined, [], [{ ...weekdays, days: [] }]]) {
    assert.equal(plans.isActive(value, at('2026-10-26T12:00:00')), false);
    assert.equal(plans.nextTransition(value, at('2026-10-26T12:00:00')), null);
  }
});

test('an overnight window belongs to the day it starts on and runs into the next morning', () => {
  const fridayNight = [{ days: [FRI], start: '22:00', end: '06:00' }];
  assert.equal(plans.isActive(fridayNight, at('2026-10-30T21:59:00')), false, 'Friday before it starts');
  assert.equal(plans.isActive(fridayNight, at('2026-10-30T23:00:00')), true, 'Friday night');
  assert.equal(plans.isActive(fridayNight, at('2026-10-31T03:00:00')), true, 'Saturday small hours');
  assert.equal(plans.isActive(fridayNight, at('2026-10-31T06:00:00')), false, 'Saturday at the end time');
  assert.equal(plans.isActive(fridayNight, at('2026-10-31T23:00:00')), false, 'Saturday night is not covered');
  assert.equal(plans.isActive(fridayNight, at('2026-11-01T03:00:00')), false, 'Sunday small hours');
});

test('the next change is the end of the window that is running', () => {
  assert.equal(plans.nextTransition(week, at('2026-10-26T09:00:00')).getTime(), at('2026-10-26T20:00:00').getTime());
  assert.equal(plans.nextTransition(week, at('2026-10-24T11:00:00')).getTime(), at('2026-10-24T14:00:00').getTime());
});

test('the next change is the start of the next window, even days away', () => {
  assert.equal(plans.nextTransition(week, at('2026-10-24T15:00:00')).getTime(), at('2026-10-25T10:00:00').getTime(), 'Saturday evening to Sunday');
  assert.equal(plans.nextTransition(week, at('2026-10-25T15:00:00')).getTime(), at('2026-10-26T08:00:00').getTime(), 'Sunday evening to Monday');
  const mondayOnly = [{ days: [MON], start: '08:00', end: '20:00' }];
  assert.equal(plans.nextTransition(mondayOnly, at('2026-10-27T12:00:00')).getTime(), at('2026-11-02T08:00:00').getTime(), 'Tuesday to next Monday');
});

test('windows that touch are one stretch, so the lock ends only when the second one does', () => {
  const touching = [
    { days: [MON], start: '22:00', end: '06:00' },
    { days: [TUE], start: '06:00', end: '12:00' }
  ];
  assert.equal(plans.isActive(touching, at('2026-10-27T06:00:00')), true);
  assert.equal(plans.nextTransition(touching, at('2026-10-26T23:00:00')).getTime(), at('2026-10-27T12:00:00').getTime());
});

test('the clocks changing do not break the walk to the next change', () => {
  // Europe/Bratislava: summer time ends on Sunday 2026-10-25 at 03:00 and the hour 02:00 repeats.
  const sundayNight = [{ days: [SAT], start: '22:00', end: '08:00' }];
  const end = plans.nextTransition(sundayNight, at('2026-10-24T23:00:00'));
  assert.equal(end.getHours(), 8);
  assert.equal(end.getMinutes(), 0);
  assert.equal(end.getDate(), 25);
});

test('occasions are named after their days', () => {
  const name = (days) => plans.label(days);
  assert.equal(name([MON, TUE, WED, THU, FRI, SAT, SUN]), 'Every day');
  assert.equal(name([MON, TUE, WED, THU, FRI]), 'Weekdays');
  assert.equal(name([SAT, SUN]), 'Weekend');
  assert.equal(name([SUN, SAT]), 'Weekend', 'order does not matter');
  assert.equal(name([WED]), 'Wednesday');
  assert.equal(name([]), 'No days');
  assert.equal(name([MON, WED, FRI]), 'Mon, Wed, Fri');
  assert.equal(name([MON, TUE]), 'Mon, Tue');
  assert.equal(name([MON, TUE, WED]), 'Mon–Wed');
  assert.equal(name([MON, TUE, WED, THU, SAT]), 'Mon–Thu, Sat');
  assert.equal(name([FRI, SAT, SUN]), 'Fri–Sun');
  assert.equal(name([MON, TUE, WED, THU, FRI, SAT]), 'Mon–Sat');
  assert.equal(name([TUE, WED, THU, SAT, SUN]), 'Tue–Thu, Sat, Sun');
});

test('giving a day to an occasion takes it from the one that had it', () => {
  const { occasions, selected } = plans.withDay(week, 1, FRI, true);
  assert.deepEqual(plain(occasions[0].days), [MON, TUE, WED, THU]);
  assert.deepEqual(plain(occasions[1].days), [FRI, SAT, SUN]);
  assert.equal(selected, 1);
  assert.deepEqual(plain(week[0].days), [MON, TUE, WED, THU, FRI], 'the original is untouched');
});

test('an occasion that loses its last day is dropped and the selection follows', () => {
  const three = [
    { days: [MON], start: '08:00', end: '20:00' },
    { days: [TUE], start: '09:00', end: '19:00' },
    { days: [WED], start: '10:00', end: '18:00' }
  ];
  const { occasions, selected } = plans.withDay(three, 2, MON, true);
  assert.equal(occasions.length, 2, 'Monday moved away from the first, which had nothing left');
  assert.deepEqual(plain(occasions.map((o) => o.days)), [[TUE], [MON, WED]]);
  assert.equal(selected, 1, 'the third occasion is now the second');
});

test('taking a day away keeps the occasion even with no days left, so it can be filled again', () => {
  const only = [{ days: [MON], start: '08:00', end: '20:00' }];
  const { occasions, selected } = plans.withDay(only, 0, MON, false);
  assert.deepEqual(plain(occasions[0].days), []);
  assert.equal(selected, 0);
  assert.equal(plans.label(occasions[0].days), 'No days');
});

test('new occasions start with no days and the times of the one they came from', () => {
  const added = plans.addOccasion(week, 1);
  assert.equal(added.length, 3);
  assert.deepEqual(plain(added[2]), { days: [], start: '10:00', end: '14:00' });
  assert.equal(plans.validate(added), false, 'it is a draft until it gets a day');
  assert.equal(plans.removeOccasion(added, 2).length, 2);
  assert.deepEqual(plain(plans.removeOccasion(week, 0)), [plain(weekend)]);
});

test('same() compares plans by content, not by the order of the days', () => {
  assert.equal(plans.same(week, [{ ...weekdays, days: [FRI, THU, WED, TUE, MON] }, weekend]), true);
  assert.equal(plans.same(week, [weekdays]), false);
  assert.equal(plans.same(week, [weekdays, { ...weekend, end: '15:00' }]), false);
  assert.equal(plans.same(null, null), true);
  assert.equal(plans.same(null, undefined), true);
  assert.equal(plans.same(null, week), false);
});

test('the popup opens on the occasion that is running, else today\'s, else the first', () => {
  assert.equal(plans.pickSelected(week, at('2026-10-24T11:00:00')), 1, 'Saturday, weekend window running');
  assert.equal(plans.pickSelected(week, at('2026-10-24T20:00:00')), 1, 'Saturday after it: still today\'s occasion');
  assert.equal(plans.pickSelected(week, at('2026-10-27T21:00:00')), 0, 'Tuesday night: today\'s is the weekday one');
  const fridayOnly = [{ days: [FRI], start: '08:00', end: '20:00' }];
  assert.equal(plans.pickSelected(fridayOnly, at('2026-10-26T12:00:00')), 0, 'no occasion today: the first');
  const overnight = [{ days: [MON], start: '22:00', end: '06:00' }, { days: [TUE], start: '08:00', end: '20:00' }];
  assert.equal(plans.pickSelected(overnight, at('2026-10-27T03:00:00')), 0, 'Tuesday 03:00 is still Monday night');
});

test('moments are described in plain words', () => {
  const now = at('2026-10-24T12:00:00');
  assert.equal(plans.when(at('2026-10-24T20:00:00'), now), 'today at 20:00');
  assert.equal(plans.when(at('2026-10-25T08:00:00'), now), 'tomorrow at 08:00');
  assert.equal(plans.when(at('2026-10-26T10:30:00'), now), 'Monday at 10:30');
  assert.equal(plans.when(at('2026-10-25T00:30:00'), at('2026-10-24T23:50:00')), 'tomorrow at 00:30');
});

test('the repeat wording is "every day" only when one occasion covers the whole week', () => {
  assert.equal(plans.repeats(plans.everyDay({ start: '08:00', end: '20:00' })), 'every day');
  assert.equal(plans.repeats(week), 'on the days you chose');
  assert.equal(plans.repeats([weekdays]), 'on the days you chose');
});
