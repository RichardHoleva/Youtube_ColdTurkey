import { byId, setAttribute } from "../dom.js";

const inputs = Array.from(document.querySelectorAll(".option-input"));
const saveButton = byId("drawer-save");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const SHAKE = [0, -4, 4, -3, 0].map((x) => ({ transform: `translateX(${x}px)` }));

export function readOptions() {
  return Object.fromEntries(inputs.map((input) => [input.dataset.option, input.checked]));
}

export function showOptions(options) {
  for (const input of inputs) input.checked = options[input.dataset.option] === true;
}

// True when the switches show something other than the saved options.
export function optionsDiffer(saved) {
  return inputs.some((input) => input.checked !== (saved[input.dataset.option] === true));
}

// A sealed switch is one that is saved as on during the lock: it can't be turned off.
export function showSealed(isSealed) {
  for (const input of inputs) setAttribute(input, "aria-disabled", String(isSealed(input.dataset.option)));
}

export function setOptionsBusy(busy) {
  if (saveButton.disabled !== busy) saveButton.disabled = busy;
}

function shake(input) {
  if (reduceMotion.matches) return;
  input.closest(".option").querySelector(".toggle").animate(SHAKE, { duration: 320, easing: "ease-out" });
}

// Flipping a switch only changes the draft. onEdit runs after each flip, onRefused when someone
// tries to switch off a sealed one, and onSave gets the options when Save is pressed.
export function listenToOptions({ isSealed, onEdit, onRefused, onSave }) {
  for (const input of inputs) {
    // Not `disabled`: a disabled control swallows the click, and then nobody learns why.
    // Cancelling the click also covers Space and puts the switch back where it was. By the time
    // this runs `checked` already holds the new value, so unchecked means it was just switched off.
    input.addEventListener("click", (event) => {
      if (input.checked || !isSealed(input.dataset.option)) return;
      event.preventDefault();
      shake(input);
      onRefused();
    });
    input.addEventListener("change", onEdit);
  }
  saveButton.addEventListener("click", () => onSave(readOptions()));
}
