import { byId } from "./dom.js";
import { draftSchedule, showSchedule, takeDraft } from "./schedule-form.js";

const chipsBox = byId("occasion-chips");
const dayButtons = Array.from(document.querySelectorAll(".day"));

let draft = FocusOccasions.everyDay(FocusSchedule.DEFAULT_SCHEDULE); // the plan being edited
let selected = 0; // the occasion the timeline and the From/To fields are showing
let painted = ""; // what the chips and days last showed: they are only redrawn when this changes

// The fields belong to the selected occasion: whenever they hold a valid pair it goes into the plan.
function syncFromInputs() {
  const window = draftSchedule();
  if (window) draft[selected] = { ...draft[selected], start: window.start, end: window.end };
}

function choose(index) {
  syncFromInputs();
  selected = index;
  showSchedule(draft[selected]);
}

export function selectedWindow() {
  syncFromInputs();
  const { start, end } = draft[selected];
  return { start, end };
}

export function currentOccasions() {
  syncFromInputs();
  return FocusOccasions.normalize(draft);
}

export const occasionsDiffer = (saved) => !FocusOccasions.same(currentOccasions(), saved);

// Starts editing `saved`, or a plan of one every-day occasion when nothing is saved yet. It opens on
// the occasion that is running or belongs to today, unless `keepSelection` stays where it was.
export function showOccasions(saved, keepSelection = false) {
  draft = FocusOccasions.normalize(saved ?? FocusOccasions.everyDay(FocusSchedule.DEFAULT_SCHEDULE));
  selected = keepSelection ? Math.min(selected, draft.length - 1) : FocusOccasions.pickSelected(draft, new Date());
  showSchedule(draft[selected]);
  painted = "";
}

// Tidies the typed times and returns { draft: the whole plan }, or { error } after pointing at the problem.
export function takeOccasions() {
  const { draft: window, error } = takeDraft();
  if (error) return { error };
  draft[selected] = { ...draft[selected], start: window.start, end: window.end };
  const empty = draft.findIndex((occasion) => occasion.days.length === 0);
  if (empty !== -1) {
    choose(empty);
    return { error: "Pick at least one day for this occasion, or remove it." };
  }
  return { draft: FocusOccasions.normalize(draft) };
}

function chip(label, attributes) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function drawChips({ labels, canAdd, canRemove }) {
  // Redrawing would drop keyboard focus from the chip that was just used, so give it back.
  const focused = chipsBox.contains(document.activeElement) ? document.activeElement.dataset.chip : null;
  chipsBox.replaceChildren();
  labels.forEach((label, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "occasion-chip";
    wrapper.dataset.selected = String(index === selected);
    wrapper.append(chip(label, { class: "chip-main", "data-chip": `pick-${index}`, "aria-pressed": String(index === selected) }));
    if (index === selected && canRemove) {
      wrapper.append(chip("×", { class: "chip-remove", "data-chip": "remove", "aria-label": `Remove ${label}`, title: `Remove ${label}` }));
    }
    chipsBox.append(wrapper);
  });
  if (canAdd) chipsBox.append(chip("+ Add", { class: "chip-add", "data-chip": "add", "aria-label": "Add an occasion with different times" }));
  if (focused) chipsBox.querySelector(`[data-chip="${focused}"]`)?.focus();
}

// `editable` is false while locked or saving: then the chips only let you look at each occasion.
export function renderOccasions({ editable }) {
  const labels = draft.map((occasion) => FocusOccasions.label(occasion.days));
  const canAdd = editable && draft.length < FocusOccasions.MAX_OCCASIONS && draft.every((occasion) => occasion.days.length > 0);
  const canRemove = editable && draft.length > 1;
  const owners = dayButtons.map((button) => {
    const owner = draft.findIndex((occasion) => occasion.days.includes(Number(button.dataset.day)));
    return owner === -1 ? "free" : owner === selected ? "mine" : "other";
  });

  const signature = JSON.stringify({ labels, selected, canAdd, canRemove, owners, editable });
  if (signature === painted) return;
  painted = signature;
  drawChips({ labels, canAdd, canRemove });
  dayButtons.forEach((button, index) => {
    button.dataset.owner = owners[index];
    button.setAttribute("aria-pressed", String(owners[index] === "mine"));
    button.disabled = !editable;
  });
}

function toggleDay(day) {
  syncFromInputs();
  const result = FocusOccasions.withDay(draft, selected, day, !draft[selected].days.includes(day));
  draft = result.occasions;
  selected = result.selected;
}

function addOccasion() {
  syncFromInputs();
  draft = FocusOccasions.addOccasion(draft, selected);
  selected = draft.length - 1;
  showSchedule(draft[selected]);
}

function removeOccasion() {
  draft = FocusOccasions.removeOccasion(draft, selected);
  selected = Math.min(selected, draft.length - 1);
  showSchedule(draft[selected]);
}

// onEdit runs after every change to the plan.
export function listenToOccasions({ onEdit }) {
  chipsBox.addEventListener("click", (event) => {
    const kind = event.target.closest("[data-chip]")?.dataset.chip;
    if (!kind) return;
    if (kind === "add") addOccasion();
    else if (kind === "remove") removeOccasion();
    else choose(Number(kind.slice("pick-".length)));
    onEdit();
  });
  for (const button of dayButtons) {
    button.addEventListener("click", () => {
      toggleDay(Number(button.dataset.day));
      onEdit();
    });
  }
}
