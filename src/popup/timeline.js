import { byId, setAttribute, setStyle } from "./dom.js";

const timeline = byId("timeline");
const nowMarker = byId("timeline-now");
const bars = Array.from(document.querySelectorAll(".timeline-bar"));

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

// `shown` is the interval to draw (null for none); `saved` is what is stored.
export function renderTimeline({ now, shown, saved }) {
  setStyle(nowMarker, "left", percent(FocusSchedule.minutesOfDay(now)));

  const pairs = shown ? FocusSchedule.segments(shown) : [];
  bars.forEach((bar, index) => {
    const pair = pairs[index];
    bar.hidden = !pair;
    if (!pair) return;
    setStyle(bar, "left", percent(pair[0]));
    setStyle(bar, "width", percent(pair[1] - pair[0]));
  });

  setAttribute(timeline, "aria-label", describe(now, shown, saved));
}

drawTicks();
