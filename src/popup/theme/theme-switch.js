const button = document.querySelector(".theme-switch");

function cache(theme) {
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Only the first paint of the popup depends on this copy.
  }
}

function showTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  button.setAttribute("aria-checked", String(dark));
  button.title = dark ? "Switch to light mode" : "Switch to dark mode";
}

// chrome.storage holds the choice the YouTube card reads. If it has none yet but this popup
// remembers one from before, hand that over; otherwise adopt what is stored.
async function syncWithStorage() {
  const stored = FocusTheme.normalize((await chrome.storage.local.get("theme")).theme);
  if (!stored) {
    const remembered = FocusTheme.normalize(localStorage.getItem("theme"));
    if (remembered) await chrome.storage.local.set({ theme: remembered });
  } else if (stored !== document.documentElement.dataset.theme) {
    showTheme(stored);
    cache(stored);
  }
}

button.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  showTheme(next);
  cache(next);
  void chrome.storage.local.set({ theme: next });
});

showTheme(document.documentElement.dataset.theme);
syncWithStorage().catch(() => {});
