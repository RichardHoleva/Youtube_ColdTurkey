import { byId, setText } from "./dom.js";

const dialog = byId("confirm");
const title = byId("confirm-title");
const body = byId("confirm-body");
const lockLine = byId("confirm-lock-text");

let draft = null; // the week plan waiting for the user's decision

const clock = (date) => FocusSchedule.timeLabel(date);

// The wording follows the clock: a window may start while the dialog is open.
function paint(now) {
  const next = FocusOccasions.nextTransition(draft, now);
  if (FocusOccasions.isActive(draft, now)) {
    setText(title, "Start focus now?");
    setText(body, `YouTube’s feed will be hidden until ${clock(next)}.`);
    setText(lockLine, "You won’t be able to change any settings until then.");
    return;
  }
  // Not active: `next` is when the next window starts, and the one after it is when that window ends.
  const ends = FocusOccasions.nextTransition(draft, next);
  setText(title, "Lock in this schedule?");
  setText(body, `Focus starts ${FocusOccasions.when(next, now)} and repeats ${FocusOccasions.repeats(draft)}.`);
  setText(lockLine, `Once it starts, you won’t be able to change any settings until ${clock(ends)}.`);
}

export function openConfirm(occasions, now) {
  draft = occasions;
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
