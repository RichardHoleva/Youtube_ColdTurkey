import { byId, setAttribute, setStyle } from "./dom.js";

const timeline = byId("timeline");
const nowMarker = byId("timeline-now");
const bars = Array.from(document.querySelectorAll(".timeline-bar"));
const handles = Object.fromEntries(Array.from(document.querySelectorAll(".timeline-handle"), (handle) => [handle.dataset.edge, handle]));

const percent = (minutes) => `${(minutes / FocusSchedule.DAY_MINUTES) * 100}%`;

// An hourly tick from 00 to 24; every sixth one is taller.
function drawTicks() {
  const ticks = byId("timeline-ticks");
  for (let hour = 0; hour <= 24; hour += 1) {
    const tick = document.createElement("span");
    tick.className = hour % 6 === 0 ? "timeline-tick major" : "timeline-tick";
    tick.style.left = percent(hour * 60);
    ticks.appendChild(tick);
  }
}

function describe(now, shown, saved) {
  const clock = FocusSchedule.timeLabel(now);
  if (!shown) return `24-hour timeline. Now ${clock}.`;
  const unsaved = !saved || shown.start !== saved.start || shown.end !== saved.end;
  return `24-hour timeline. ${unsaved ? "Unsaved focus" : "Focus"} from ${shown.start} to ${shown.end}. Now ${clock}.`;
}

// The grips at both ends of the bar, shown only while the hours can be changed.
function renderHandles(shown, editable) {
  setAttribute(timeline, "data-editable", String(editable));
  for (const [edge, handle] of Object.entries(handles)) {
    if (handle.hidden === editable) handle.hidden = !editable;
    if (!editable) continue;
    const minutes = FocusSchedule.toMinutes(shown[edge]);
    // A window that ends at 00:00 closes at the right edge of the bar, not the left one.
    const at = edge === "end" && minutes === 0 ? FocusSchedule.DAY_MINUTES : minutes;
    setStyle(handle, "left", percent(at));
    setAttribute(handle, "aria-valuenow", String(minutes));
    setAttribute(handle, "aria-valuetext", shown[edge]);
  }
}

// `shown` is the interval to draw (null for none); `saved` is what is stored; `editable`
// says whether the bar can be dragged.
export function renderTimeline({ now, shown, saved, editable }) {
  setStyle(nowMarker, "left", percent(FocusSchedule.minutesOfDay(now)));

  const pairs = shown ? FocusSchedule.segments(shown) : [];
  bars.forEach((bar, index) => {
    const pair = pairs[index];
    bar.hidden = !pair;
    if (!pair) return;
    setStyle(bar, "left", percent(pair[0]));
    setStyle(bar, "width", percent(pair[1] - pair[0]));
  });

  renderHandles(shown, Boolean(editable && shown));
  setAttribute(timeline, "aria-label", describe(now, shown, saved));
}

drawTicks();
