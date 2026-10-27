// FocusSchedule and FocusOptions are plain scripts loaded by popup.html from ../shared.

export const state = {
  schedule: null, // the saved schedule; null until the user saves one
  options: FocusOptions.normalize(),
  loaded: false,
  loadFailed: false,
  saving: false
};

export function isLocked(now) {
  return state.loaded && FocusSchedule.isActive(state.schedule, now);
}

// The notices below are only for use while locked: they name the moment the lock ends.
function until(now) {
  return FocusSchedule.timeLabel(FocusSchedule.nextTransition(state.schedule, now));
}

export const lockedNotice = (now) => `Locked until ${until(now)}.`;
export const addOnlyNotice = (now) => `Additional blocks can be added, not removed.`;
export const keptBlockedNotice = (now) => `Blocked items stay blocked until ${until(now)}.`;
export const savedWhileLockedNotice = (now) => `Saved. New blocks stay on until ${until(now)}.`;
