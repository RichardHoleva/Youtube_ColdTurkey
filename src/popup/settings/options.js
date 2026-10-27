import { setAttribute } from "../dom.js";

const inputs = Array.from(document.querySelectorAll(".option-input"));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const SHAKE = [0, -4, 4, -3, 0].map((x) => ({ transform: `translateX(${x}px)` }));

export function readOptions() {
  return Object.fromEntries(inputs.map((input) => [input.dataset.option, input.checked]));
}

export function showOptions(options) {
  for (const input of inputs) input.checked = options[input.dataset.option] === true;
}

// During the lock a switch that is on can't be turned off; the ones that are off stay free.
export function setOptionsLocked(locked) {
  for (const input of inputs) setAttribute(input, "aria-disabled", String(locked && input.checked));
}

function shake(input) {
  if (reduceMotion.matches) return;
  input.closest(".option").querySelector(".toggle").animate(SHAKE, { duration: 320, easing: "ease-out" });
}

// onChange gets the new options after the user flips a switch; onRefused runs when they try to
// switch off a block during the lock.
export function listenToOptions({ isLocked, onChange, onRefused }) {
  for (const input of inputs) {
    // Not `disabled`: a disabled control swallows the click, and then nobody learns why.
    // Cancelling the click also covers Space and puts the switch back where it was. By the time
    // this runs `checked` already holds the new value, so unchecked means it was just switched off.
    input.addEventListener("click", (event) => {
      if (!isLocked() || input.checked) return;
      event.preventDefault();
      shake(input);
      onRefused();
    });
    input.addEventListener("change", () => onChange(readOptions()));
  }
}
