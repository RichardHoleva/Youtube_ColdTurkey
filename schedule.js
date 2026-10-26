/* Shared local-clock rules. No stored "active" flag can become stale. */
(function (root) {
  "use strict";

  const DEFAULT_SCHEDULE = Object.freeze({ start: "08:00", end: "20:00" });
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

  function minutes(time) {
    return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  }

  function pad(number) {
    return String(number).padStart(2, "0");
  }

  function minutesOfDay(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  // Local 24-hour "HH:mm", independent of the browser's locale.
  function timeLabel(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // Accepts what people actually type ("8", "8:00", "800", "2000") and returns
  // strict "HH:mm", or null when it is not a real 24-hour time.
  function parseTime(text) {
    if (typeof text !== "string") return null;
    const value = text.trim();
    const match = /^(\d{1,2}):?$/.exec(value) || /^(\d{1,2}):(\d{2})$/.exec(value) || /^(\d{1,2})(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const mins = match[2] === undefined ? 0 : Number(match[2]);
    return hours < 24 && mins < 60 ? `${pad(hours)}:${pad(mins)}` : null;
  }

  // The focus interval as [from, to] minute pairs on a 0-1440 axis.
  // An overnight interval is split at midnight into two pairs.
  function segments(value) {
    const schedule = normalize(value);
    const start = minutes(schedule.start);
    const end = minutes(schedule.end);
    const pairs = start < end ? [[start, end]] : [[start, 1440], [0, end]];
    return pairs.filter(([from, to]) => to > from);
  }

  function isActive(value, now = new Date()) {
    const schedule = normalize(value);
    const current = now.getHours() * 60 + now.getMinutes();
    const start = minutes(schedule.start);
    const end = minutes(schedule.end);
    // Start is inclusive, end exclusive; an overnight window crosses midnight.
    return start < end ? current >= start && current < end : current >= start || current < end;
  }

  function nextTransition(value, now = new Date()) {
    const schedule = normalize(value);
    const active = isActive(schedule, now);
    // Walk real minutes, including repeated/skipped local minutes at DST changes.
    // A direct setHours() would miss the second occurrence of a fall-back hour.
    let timestamp = Math.floor(now.getTime() / 60000) * 60000 + 60000;
    for (let count = 0; count < 3 * 24 * 60; count += 1, timestamp += 60000) {
      const candidate = new Date(timestamp);
      if (isActive(schedule, candidate) !== active) return candidate;
    }
    throw new Error("No schedule transition found.");
  }

  const api = Object.freeze({ DEFAULT_SCHEDULE, validate, normalize, isActive, nextTransition, minutesOfDay, timeLabel, parseTime, segments });
  root.FocusSchedule = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
