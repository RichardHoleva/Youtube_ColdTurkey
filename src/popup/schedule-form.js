import { byId, setText } from "./dom.js";

const form = byId("schedule-form");
const startInput = byId("start");
const endInput = byId("end");
const startValue = byId("start-value");
const endValue = byId("end-value");
const saveButton = byId("save");
const lockStatus = byId("lock-status");
const inputs = [startInput, endInput];

function markInvalid(...invalid) {
  for (const input of inputs) {
    if (invalid.includes(input)) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
}

// Each value is "HH:mm", or null while what's typed can't be read as a time.
export function readDraft() {
  return { start: FocusSchedule.parseTime(startInput.value), end: FocusSchedule.parseTime(endInput.value) };
}

// The typed hours as a schedule, or null while they aren't a valid pair.
export function draftSchedule() {
  const draft = readDraft();
  return FocusSchedule.validate(draft) ? draft : null;
}

// Puts a window into the fields. With nothing saved yet, the default hours are only a suggestion.
export function showSchedule(window) {
  const shown = window ?? FocusSchedule.DEFAULT_SCHEDULE;
  startInput.value = shown.start;
  endInput.value = shown.end;
  markInvalid();
}

// Puts a window picked on the timeline into the fields, as if it had been typed.
export function setDraft({ start, end }) {
  startInput.value = start;
  endInput.value = end;
  markInvalid();
}

// Tidies the typed times and returns { draft }, or { error } after pointing at the bad field.
export function takeDraft() {
  const draft = readDraft();
  if (draft.start) startInput.value = draft.start;
  if (draft.end) endInput.value = draft.end;
  if (FocusSchedule.validate(draft)) return { draft };

  const unreadable = inputs.filter((input) => !FocusSchedule.parseTime(input.value));
  markInvalid(...(unreadable.length ? unreadable : inputs));
  (unreadable[0] ?? startInput).focus();
  return { error: unreadable.length ? "Enter times as HH:mm, for example 08:00." : "From and To must be different." };
}

// Locked: plain saved values and a lock icon replace the inputs and the Save button.
export function renderForm({ schedule, locked, disabled, saving }) {
  startInput.disabled = endInput.disabled = saveButton.disabled = disabled;
  startInput.hidden = endInput.hidden = saveButton.hidden = locked;
  startValue.hidden = endValue.hidden = lockStatus.hidden = !locked;
  setText(startValue, schedule?.start ?? "");
  setText(endValue, schedule?.end ?? "");
  setText(saveButton, saving ? "Saving…" : "Save");
}

function stepTime(input, delta) {
  const current = FocusSchedule.parseTime(input.value) ?? FocusSchedule.DEFAULT_SCHEDULE.start;
  const minutes = (Number(current.slice(0, 2)) * 60 + Number(current.slice(3)) + delta + FocusSchedule.DAY_MINUTES) % FocusSchedule.DAY_MINUTES;
  const pad = (number) => String(number).padStart(2, "0");
  input.value = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function sanitize(input, event) {
  let value = input.value.replace(/[^\d:]/g, "").slice(0, 5);
  // "22" becomes "22:", but "81" stays so shorthand like "815" still reads as 08:15.
  if (/^\d{2}$/.test(value) && Number(value) < 24 && String(event.inputType).startsWith("insert")) value += ":";
  if (value !== input.value) input.value = value;
}

// onEdit runs after every change the user makes to the times.
export function listen({ onSubmit, onEdit, onBlur }) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSubmit();
  });

  for (const input of inputs) {
    input.addEventListener("input", (event) => {
      sanitize(input, event);
      markInvalid();
      onEdit();
    });

    input.addEventListener("blur", () => {
      const time = FocusSchedule.parseTime(input.value);
      if (time && time !== input.value) input.value = time;
      onBlur();
    });

    input.addEventListener("keydown", (event) => {
      const direction = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
      if (!direction || input.disabled) return;
      event.preventDefault();
      stepTime(input, direction * (event.shiftKey ? 60 : 1));
      markInvalid();
      onEdit();
    });
  }
}
