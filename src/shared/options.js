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

  const api = Object.freeze({ KEYS, validate, normalize, removes });
  root.FocusOptions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
