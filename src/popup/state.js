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

// Only call while locked: it names the moment the lock ends.
export function lockedNotice(now) {
  const until = FocusSchedule.timeLabel(FocusSchedule.nextTransition(state.schedule, now));
  return `Settings are locked until ${until}.`;
}
