/* The "Also block" switches. They are visual only for now; what this file adds is the lock.

   While focus is active the switches refuse to change and say why. popup.js owns the lock
   and publishes it as <body data-state="locked">, which this file reads. A refused change is
   reported with a "settings-locked" event that popup.js turns into the message line, so the
   two files never call into each other. */
(() => {
  "use strict";

  const inputs = Array.from(document.querySelectorAll(".option-input"));
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const SHAKE = [0, -4, 4, -3, 0].map((x) => ({ transform: `translateX(${x}px)` }));

  const isLocked = () => document.body.dataset.state === "locked";

  // Screen readers should hear that the switches exist but cannot be changed right now.
  function syncAria() {
    for (const input of inputs) input.setAttribute("aria-disabled", String(isLocked()));
  }

  function refuse(input) {
    if (!reduceMotion.matches) {
      input.closest(".option").querySelector(".toggle").animate(SHAKE, { duration: 320, easing: "ease-out" });
    }
    document.dispatchEvent(new CustomEvent("settings-locked"));
  }

  for (const input of inputs) {
    // Not `disabled`: a disabled control swallows the click, and then nobody learns why.
    // Cancelling the click also covers Space on the keyboard and puts the switch back.
    input.addEventListener("click", (event) => {
      if (!isLocked()) return;
      event.preventDefault();
      refuse(input);
    });
  }

  new MutationObserver(syncAria).observe(document.body, { attributes: true, attributeFilter: ["data-state"] });
  syncAria();
})();
