import { byId, setText } from "./dom.js";

const lead = byId("headline-lead");
const prefix = byId("headline-prefix");
const time = byId("headline-time");
const dot = byId("headline-dot");

// Two lines: `leadText`, then `prefixText` followed by an optional time such as "until 20:00."
export function setHeadline(leadText, prefixText, timeText) {
  setText(lead, leadText);
  // A real space, so screen readers say "until 20:00" rather than "until20:00".
  setText(prefix, timeText === undefined ? prefixText : `${prefixText} `);
  time.hidden = dot.hidden = timeText === undefined;
  if (timeText !== undefined) setText(time, timeText);
}
