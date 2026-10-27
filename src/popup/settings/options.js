const inputs = Array.from(document.querySelectorAll(".option-input"));
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
const SHAKE = [0, -4, 4, -3, 0].map((x) => ({ transform: `translateX(${x}px)` }));

export function readOptions() {
  return Object.fromEntries(inputs.map((input) => [input.dataset.option, input.checked]));
}

export function showOptions(options) {
  for (const input of inputs) input.checked = options[input.dataset.option] === true;
}

export function setOptionsLocked(locked) {
  for (const input of inputs) input.setAttribute("aria-disabled", String(locked));
}

function shake(input) {
  if (reduceMotion.matches) return;
  input.closest(".option").querySelector(".toggle").animate(SHAKE, { duration: 320, easing: "ease-out" });
}

// onChange gets the new options after the user flips a switch; onRefused runs when they try
// while locked.
export function listenToOptions({ isLocked, onChange, onRefused }) {
  for (const input of inputs) {
    // Not `disabled`: a disabled control swallows the click, and then nobody learns why.
    // Cancelling the click also covers Space and puts the switch back where it was.
    input.addEventListener("click", (event) => {
      if (!isLocked()) return;
      event.preventDefault();
      shake(input);
      onRefused();
    });
    input.addEventListener("change", () => onChange(readOptions()));
  }
}
