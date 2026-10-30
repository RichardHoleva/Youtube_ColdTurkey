// Both are empty until the user saves: a fresh install is not locked. A single window saved by an
// earlier version is read as an every-day occasion.
async function readStored() {
  const stored = await chrome.storage.local.get(["occasions", "schedule", "options"]);
  return {
    occasions: FocusOccasions.fromStored(stored),
    options: FocusOptions.normalize(stored.options)
  };
}

function makeState({ occasions, options }) {
  const now = new Date();
  const next = FocusOccasions.nextTransition(occasions, now);
  return {
    occasions,
    options,
    active: FocusOccasions.isActive(occasions, now),
    now: now.getTime(),
    nextChange: next ? next.getTime() : null
  };
}
