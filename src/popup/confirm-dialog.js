import { byId, setText } from "./dom.js";

const dialog = byId("confirm");
const title = byId("confirm-title");
const body = byId("confirm-body");
const lockLine = byId("confirm-lock-text");

let draft = null; // the schedule waiting for the user's decision

// The wording follows the clock: the window may start while the dialog is open.
function paint(now) {
  const starts = FocusSchedule.isActive(draft, now);
  setText(title, starts ? "Start focus now?" : "Lock in this schedule?");
  setText(body, starts
    ? `YouTube’s feed will be hidden until ${draft.end}.`
    : `Focus starts at ${draft.start} and repeats every day.`);
  setText(lockLine, starts
    ? "You won’t be able to change any settings until then."
    : `Once it starts, you won’t be able to change any settings until ${draft.end}.`);
}

export function openConfirm(schedule, now) {
  draft = schedule;
  paint(now);
  dialog.showModal();
}

export function refreshConfirm(now) {
  if (draft) paint(now);
}

export function closeConfirm() {
  if (dialog.open) dialog.close();
}

export function onConfirm(handler) {
  byId("confirm-cancel").addEventListener("click", closeConfirm);
  byId("confirm-continue").addEventListener("click", () => {
    const confirmed = draft;
    closeConfirm();
    if (confirmed) handler(confirmed);
  });
  // Also fires for Escape and when the lock takes over, so a stale draft is never kept.
  dialog.addEventListener("close", () => { draft = null; });
}
