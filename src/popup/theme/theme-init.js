// Runs in <head> before anything is painted, so the popup never flashes the wrong colors.
// With no saved choice it follows the operating system.
(() => {
  let dark = false;
  try {
    const saved = localStorage.getItem("theme");
    dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    // Storage can be blocked; fall back to light.
  }
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
