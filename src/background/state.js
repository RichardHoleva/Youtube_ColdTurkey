// Both are empty until the user saves: a fresh install is not locked.
async function readStored() {
  const stored = await chrome.storage.local.get(["schedule", "options"]);
  return {
    schedule: FocusSchedule.saved(stored.schedule),
    options: FocusOptions.normalize(stored.options)
  };
}

function makeState({ schedule, options }) {
  const now = new Date();
  const next = FocusSchedule.nextTransition(schedule, now);
  return {
    schedule,
    options,
    active: FocusSchedule.isActive(schedule, now),
    now: now.getTime(),
    nextChange: next ? next.getTime() : null
  };
}
