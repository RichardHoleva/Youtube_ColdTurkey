/* The headline of the card YouTube shows in place of the home feed. The user can rename it. */
(function (root) {
  "use strict";

  const DEFAULT_TITLE = "No feed";
  const MAX_LENGTH = 24;

  // What was typed, tidied: one line, trimmed, at most MAX_LENGTH characters. Anything empty
  // or unusable becomes the default.
  function normalize(value) {
    if (typeof value !== "string") return DEFAULT_TITLE;
    const characters = Array.from(value.replace(/[\u0000-\u001f\u007f\s]+/g, " ").trim());
    return characters.slice(0, MAX_LENGTH).join("").trim() || DEFAULT_TITLE;
  }

  const api = Object.freeze({ DEFAULT_TITLE, MAX_LENGTH, normalize });
  root.FocusTitle = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
