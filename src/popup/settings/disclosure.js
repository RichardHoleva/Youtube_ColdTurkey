/* Opens and closes panels in place. The styling lives in disclosure.css.

   Every button.disclosure[aria-controls] toggles the panel it points at. The attribute
   aria-expanded is the single source of truth: CSS animates from it, and screen readers
   announce it. A closed panel is also `inert`, so Tab and clicks cannot reach inside it. */
(() => {
  "use strict";

  for (const button of document.querySelectorAll("button.disclosure[aria-controls]")) {
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    if (!panel) continue;

    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(open));
      panel.inert = !open;
    });
  }
})();
