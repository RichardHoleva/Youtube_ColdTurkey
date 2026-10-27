const button = document.querySelector(".theme-switch");

function showTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  button.setAttribute("aria-checked", String(dark));
  button.title = dark ? "Switch to light mode" : "Switch to dark mode";
}

button.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  showTheme(next);
  try {
    localStorage.setItem("theme", next);
  } catch {
    // The choice just won't be remembered.
  }
});

showTheme(document.documentElement.dataset.theme);
