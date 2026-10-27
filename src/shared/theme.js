/* Light or dark. The popup saves the user's choice and the YouTube card follows it, so both
   decide the same way: a saved choice wins, and with none they follow the operating system. */
(function (root) {
  "use strict";

  const THEMES = Object.freeze(["light", "dark"]);

  function normalize(value) {
    return THEMES.includes(value) ? value : null;
  }

  function resolve(saved, systemPrefersDark) {
    return normalize(saved) ?? (systemPrefersDark ? "dark" : "light");
  }

  const api = Object.freeze({ THEMES, normalize, resolve });
  root.FocusTheme = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
