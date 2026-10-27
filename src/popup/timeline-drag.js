import { byId } from "./dom.js";

const scale = byId("timeline-scale");
const STEP = 5; // minutes; dragging snaps to this
const DAY = FocusSchedule.DAY_MINUTES;
let drag = null;

const snap = (minutes) => Math.round(minutes / STEP) * STEP;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

function pointerMinutes(event) {
  const box = scale.getBoundingClientRect();
  return clamp(((event.clientX - box.left) / box.width) * DAY, 0, DAY);
}

// Grabbing a grip resizes from that end, grabbing the bar moves it, and grabbing the bare
// track pulls the nearer end to that spot.
function grabbedPart(target, at, window) {
  const handle = target.closest(".timeline-handle");
  if (handle) return handle.dataset.edge;
  if (target.closest(".timeline-bar")) return "move";
  const start = FocusSchedule.toMinutes(window.start);
  const end = FocusSchedule.toMinutes(window.end) || DAY;
  return Math.abs(at - start) <= Math.abs(at - end) ? "start" : "end";
}

// The window the pointer asks for. The start can't sit on the right edge or the end on the
// left one: those are the same moment as the other edge, and the grip would jump across.
function windowAt(at) {
  const { part, origin, window } = drag;
  if (part === "move") return FocusSchedule.shift(window, snap(at - origin));
  if (part === "start") return { start: FocusSchedule.fromMinutes(clamp(snap(at), 0, DAY - STEP)), end: window.end };
  return { start: window.start, end: FocusSchedule.fromMinutes(clamp(snap(at), STEP, DAY)) };
}

function keyboardWindow(edge, delta, window) {
  return { ...window, [edge]: FocusSchedule.fromMinutes(FocusSchedule.toMinutes(window[edge]) + delta) };
}

// getWindow() is the hours as currently typed (null while they aren't a valid pair), and
// onChange gets each new window the user drags to.
export function listenToTimeline({ isEditable, getWindow, onChange }) {
  function propose(next) {
    const current = getWindow();
    if (!FocusSchedule.validate(next) || (current && next.start === current.start && next.end === current.end)) return;
    onChange(next);
  }

  function onMove(event) {
    propose(windowAt(pointerMinutes(event)));
  }

  function finish() {
    drag = null;
    delete scale.dataset.dragging;
    document.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerup", finish);
    document.removeEventListener("pointercancel", finish);
  }

  // While a drag lasts, the document follows the pointer, wherever on the page it goes. Pointer
  // capture also keeps the events coming when it leaves the popup.
  scale.addEventListener("pointerdown", (event) => {
    const window = getWindow();
    if (event.button !== 0 || !isEditable() || !window) return;
    const at = pointerMinutes(event);
    drag = { part: grabbedPart(event.target, at, window), origin: at, window };
    scale.dataset.dragging = drag.part;
    scale.setPointerCapture(event.pointerId);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", finish);
    document.addEventListener("pointercancel", finish);
    if (drag.part !== "move") propose(windowAt(at));
  });
  scale.addEventListener("lostpointercapture", finish);

  // With a grip focused, the arrow keys nudge it by 5 minutes, or by an hour with Shift.
  scale.addEventListener("keydown", (event) => {
    const handle = event.target.closest(".timeline-handle");
    const direction = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
    const window = getWindow();
    if (!handle || !direction || !window || !isEditable()) return;
    event.preventDefault();
    propose(keyboardWindow(handle.dataset.edge, direction * (event.shiftKey ? 60 : STEP), window));
  });
}
