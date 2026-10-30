/* The week plan, shared by the background worker, the content script and the popup. An occasion
   is a daily window (start, end) that applies on certain days of the week. A plan holds one or
   more occasions, and a day belongs to at most one of them. As with a single window, nothing
   here stores an "active" flag: it is always computed from the local clock. Needs schedule.js. */
(function (root) {
  "use strict";

  const schedule = root.FocusSchedule;
  const MAX_OCCASIONS = 5;
  // The numbers are Date#getDay() values (0 is Sunday); the list is in the order a week is shown.
  const WEEK = Object.freeze([1, 2, 3, 4, 5, 6, 0]);
  const DAY_NAMES = Object.freeze(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
  const SHORT_NAMES = Object.freeze(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
  const LOOKAHEAD_MINUTES = 8 * schedule.DAY_MINUTES;

  const byWeek = (a, b) => WEEK.indexOf(a) - WEEK.indexOf(b);

  function validDays(days) {
    return Array.isArray(days) && days.length >= 1 && new Set(days).size === days.length &&
      days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
  }

  function validate(list) {
    if (!Array.isArray(list) || list.length < 1 || list.length > MAX_OCCASIONS) return false;
    if (!list.every((occasion) => occasion && validDays(occasion.days) && schedule.validate(occasion))) return false;
    const days = list.flatMap((occasion) => occasion.days);
    return new Set(days).size === days.length; // no day in two occasions
  }

  function normalize(list) {
    return list.map((occasion) => ({ days: [...occasion.days].sort(byWeek), start: occasion.start, end: occasion.end }));
  }

  // Null when nothing usable is stored: no plan means no lock.
  function saved(value) {
    return validate(value) ? normalize(value) : null;
  }

  function everyDay(window) {
    const { start, end } = schedule.normalize(window);
    return [{ days: [...WEEK], start, end }];
  }

  // What is in storage: the plan, or the single daily window an earlier version saved.
  function fromStored(stored) {
    const plan = saved(stored?.occasions);
    if (plan) return plan;
    const legacy = schedule.saved(stored?.schedule);
    return legacy ? everyDay(legacy) : null;
  }

  // Works on drafts too, which may have an occasion with no days yet.
  function same(a, b) {
    if (!a || !b) return (a ?? null) === (b ?? null);
    return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
  }

  // An overnight window belongs to the day it starts on and runs into the morning after.
  function windowActive(occasion, now) {
    const today = now.getDay();
    const yesterday = (today + 6) % 7;
    const current = schedule.minutesOfDay(now);
    const start = schedule.toMinutes(occasion.start);
    const end = schedule.toMinutes(occasion.end);
    if (start < end) return occasion.days.includes(today) && current >= start && current < end;
    return (occasion.days.includes(today) && current >= start) || (occasion.days.includes(yesterday) && current < end);
  }

  function activeAt(list, date) {
    return list.some((occasion) => windowActive(occasion, date));
  }

  function isActive(list, now = new Date()) {
    return validate(list) && activeAt(list, now);
  }

  // Null when there is no plan. Walks real minutes, like the single window did, so windows that
  // touch (Monday night into Tuesday morning) count as one and daylight-saving changes are safe.
  function nextTransition(list, now = new Date()) {
    if (!validate(list)) return null;
    const active = activeAt(list, now);
    let timestamp = Math.floor(now.getTime() / 60000) * 60000 + 60000;
    for (let count = 0; count < LOOKAHEAD_MINUTES; count += 1, timestamp += 60000) {
      if (activeAt(list, new Date(timestamp)) !== active) return new Date(timestamp);
    }
    throw new Error("No schedule transition found.");
  }

  // The occasion to show first: the one running now, else today's, else the first.
  function pickSelected(list, now = new Date()) {
    const running = list.findIndex((occasion) => windowActive(occasion, now));
    if (running !== -1) return running;
    const today = list.findIndex((occasion) => occasion.days.includes(now.getDay()));
    return today !== -1 ? today : 0;
  }

  // An occasion is named after its days: "Every day", "Weekdays", "Weekend", "Saturday",
  // "Mon-Thu, Sat". Three or more days in a row are shortened to a range.
  function label(days) {
    const sorted = [...days].sort(byWeek);
    if (sorted.length === 0) return "No days";
    if (sorted.length === 7) return "Every day";
    const key = sorted.join(",");
    if (key === "1,2,3,4,5") return "Weekdays";
    if (key === "6,0") return "Weekend";
    if (sorted.length === 1) return DAY_NAMES[sorted[0]];

    const parts = [];
    let from = 0;
    for (let at = 1; at <= sorted.length; at += 1) {
      const continues = at < sorted.length && WEEK.indexOf(sorted[at]) === WEEK.indexOf(sorted[at - 1]) + 1;
      if (continues) continue;
      const run = sorted.slice(from, at);
      parts.push(run.length >= 3 ? `${SHORT_NAMES[run[0]]}–${SHORT_NAMES[run.at(-1)]}` : run.map((day) => SHORT_NAMES[day]).join(", "));
      from = at;
    }
    return parts.join(", ");
  }

  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  // A moment in plain words, relative to `now`: "today at 08:00", "tomorrow at 08:00", "Saturday at 10:00".
  function when(date, now = new Date()) {
    const time = schedule.timeLabel(date);
    const days = Math.round((startOfDay(date) - startOfDay(now)) / 86400000);
    if (days === 0) return `today at ${time}`;
    if (days === 1) return `tomorrow at ${time}`;
    return `${DAY_NAMES[date.getDay()]} at ${time}`;
  }

  function repeats(list) {
    return list.length === 1 && list[0].days.length === 7 ? "every day" : "on the days you chose";
  }

  // Gives `day` to the occasion at `index`, or takes it away. Giving takes it from whichever
  // occasion had it, and an occasion left with no days by that is dropped, which can move the
  // selection, so both come back.
  function withDay(list, index, day, on) {
    const next = list.map((occasion, at) => {
      const days = at === index
        ? (on ? [...new Set([...occasion.days, day])] : occasion.days.filter((d) => d !== day))
        : (on ? occasion.days.filter((d) => d !== day) : occasion.days);
      return { ...occasion, days: [...days].sort(byWeek) };
    });
    const occasions = next.filter((occasion, at) => at === index || occasion.days.length > 0);
    return { occasions, selected: occasions.indexOf(next[index]) };
  }

  // A new occasion starts with no days and the times of the one it was made from.
  function addOccasion(list, from) {
    const { start, end } = list[from];
    return [...list, { days: [], start, end }];
  }

  function removeOccasion(list, index) {
    return list.filter((occasion, at) => at !== index);
  }

  const api = Object.freeze({
    MAX_OCCASIONS, WEEK, DAY_NAMES, SHORT_NAMES,
    validate, normalize, saved, everyDay, fromStored, same,
    isActive, nextTransition, pickSelected, label, when, repeats,
    withDay, addOccasion, removeOccasion
  });
  root.FocusOccasions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
