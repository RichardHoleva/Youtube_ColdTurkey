const HEARTBEAT = "focus-clock-check";
const BOUNDARY = "focus-next-transition";

async function ensureAlarms(state) {
  const heartbeat = await chrome.alarms.get(HEARTBEAT);
  if (!heartbeat || heartbeat.periodInMinutes !== 1) {
    await chrome.alarms.create(HEARTBEAT, { periodInMinutes: 1 });
  }

  if (state.nextChange === null) {
    await chrome.alarms.clear(BOUNDARY);
    return;
  }
  const boundary = await chrome.alarms.get(BOUNDARY);
  if (!boundary || Math.abs(boundary.scheduledTime - state.nextChange) > 1000) {
    await chrome.alarms.create(BOUNDARY, { when: state.nextChange });
  }
}
