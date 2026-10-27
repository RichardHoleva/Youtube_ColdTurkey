/* Daily focus window rules, shared by the background worker, the content script and the popup.
   Nothing here stores an "active" flag: it is always computed from the local clock. */
(function (root) {
  "use strict";

  const DEFAULT_SCHEDULE = Object.freeze({ start: "08:00", end: "20:00" });
  const DAY_MINUTES = 24 * 60;
  const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

  function validate(value) {
    return Boolean(value && !Array.isArray(value) &&
      typeof value.start === "string" && typeof value.end === "string" &&
      value.start.length === 5 && value.end.length === 5 &&
      TIME.test(value.start) && TIME.test(value.end) && value.start !== value.end);
  }

  function normalize(value) {
    const schedule = validate(value) ? value : DEFAULT_SCHEDULE;
    return { start: schedule.start, end: schedule.end };
  }

  // Unlike normalize(), never falls back to the default: no lock until the user saves.
  function saved(value) {
    return validate(value) ? { start: value.start, end: value.end } : null;
  }

  function minutes(time) {
    return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function minutesOfDay(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function timeLabel(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // Accepts what people type ("8", "8:00", "800", "2000") and returns "HH:mm", or null.
  function parseTime(text) {
    if (typeof text !== "string") return null;
    const value = text.trim();
    const match = /^(\d{1,2}):?$/.exec(value) || /^(\d{1,2}):(\d{2})$/.exec(value) || /^(\d{1,2})(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const mins = match[2] === undefined ? 0 : Number(match[2]);
    return hours < 24 && mins < 60 ? `${pad(hours)}:${pad(mins)}` : null;
  }

  // Minutes since midnight back to "HH:mm". Wraps around midnight in both directions.
  function fromMinutes(total) {
    const wrapped = ((Math.round(total) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
    return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
  }

  // Slides the whole window by `delta` minutes, keeping its length.
  function shift(value, delta) {
    const schedule = normalize(value);
    return { start: fromMinutes(minutes(schedule.start) + delta), end: fromMinutes(minutes(schedule.end) + delta) };
  }

  // The window as [from, to] minute pairs on a 0-1440 axis; an overnight window is split at midnight.
  function segments(value) {
    const schedule = normalize(value);
    const start = minutes(schedule.start);
    const end = minutes(schedule.end);
    const pairs = start < end ? [[start, end]] : [[start, DAY_MINUTES], [0, end]];
    return pairs.filter(([from, to]) => to > from);
  }

  // The start is inclusive and the end exclusive.
  function isActive(value, now = new Date()) {
    if (!validate(value)) return false;
    const current = minutesOfDay(now);
    const start = minutes(value.start);
    const end = minutes(value.end);
    return start < end ? current >= start && current < end : current >= start || current < end;
  }

  // Null when nothing is saved. Walks real minutes rather than calling setHours(), which
  // would miss the second occurrence of an hour repeated by a daylight-saving change.
  function nextTransition(value, now = new Date()) {
    if (!validate(value)) return null;
    const schedule = normalize(value);
    const active = isActive(schedule, now);
    let timestamp = Math.floor(now.getTime() / 60000) * 60000 + 60000;
    for (let count = 0; count < 3 * DAY_MINUTES; count += 1, timestamp += 60000) {
      const candidate = new Date(timestamp);
      if (isActive(schedule, candidate) !== active) return candidate;
    }
    throw new Error("No schedule transition found.");
  }

  const api = Object.freeze({
    DEFAULT_SCHEDULE, DAY_MINUTES, validate, normalize, saved,
    isActive, nextTransition, minutesOfDay, timeLabel, parseTime, segments,
    toMinutes: minutes, fromMinutes, shift
  });
  root.FocusSchedule = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
