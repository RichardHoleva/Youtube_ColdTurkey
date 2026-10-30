/* The extra things the user can choose to block during a focus window. */
(function (root) {
  "use strict";

  const KEYS = Object.freeze(["sidebar", "shorts", "subscriptions", "history"]);

  function validate(value) {
    return Boolean(value && typeof value === "object" && !Array.isArray(value) &&
      KEYS.every((key) => typeof value[key] === "boolean"));
  }

  // Anything missing or malformed counts as "not blocked".
  function normalize(value) {
    const options = {};
    for (const key of KEYS) options[key] = Boolean(value && value[key] === true);
    return options;
  }

  // True when `next` switches off something that `current` has on.
  function removes(current, next) {
    const before = normalize(current);
    const after = normalize(next);
    return KEYS.some((key) => before[key] && !after[key]);
  }

  // What to hide right now: every saved switch that is on while the lock is on, plus the switches the
  // popup is previewing (its unsaved draft). A preview only ever adds to what the lock hides.
  function blocked(saved, active, preview) {
    const real = normalize(saved);
    const draft = preview ? normalize(preview) : null;
    return Object.fromEntries(KEYS.map((key) => [key, Boolean((active && real[key]) || (draft && draft[key]))]));
  }

  const api = Object.freeze({ KEYS, validate, normalize, removes, blocked });
  root.FocusOptions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
