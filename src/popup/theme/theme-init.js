// Runs in <head> before anything is painted, so the popup never flashes the wrong colors.
// localStorage is a synchronous copy of the saved choice; chrome.storage (read later by
// theme-switch.js) is the real one, because the YouTube card needs it too.
(() => {
  let saved = null;
  try {
    saved = localStorage.getItem("theme");
  } catch {
    // Storage can be blocked; the system setting decides.
  }
  document.documentElement.dataset.theme = FocusTheme.resolve(saved, matchMedia("(prefers-color-scheme: dark)").matches);
})();
