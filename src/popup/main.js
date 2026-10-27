import * as api from "./api.js";
import { closeConfirm, onConfirm, openConfirm, refreshConfirm } from "./confirm-dialog.js";
import { byId, setText } from "./dom.js";
import { setHeadline } from "./headline.js";
import { NO_MESSAGE, paintMessage, setMessageHint, showMessage } from "./message.js";
import { draftDiffersFrom, draftSchedule, listen, readDraft, renderForm, showSchedule, takeDraft } from "./schedule-form.js";
import "./settings/drawer.js";
import { listenToOptions, setOptionsLocked, showOptions } from "./settings/options.js";
import { addOnlyNotice, isLocked, keptBlockedNotice, lockedNotice, state } from "./state.js";
import "./theme/theme-switch.js";
import { renderTimeline } from "./timeline.js";

const RETRY_TICKS = 3;
const clockTime = byId("clock-time");
let wasLocked = null;
let retryCountdown = RETRY_TICKS;

// Takes what the background worker reports. `resetInputs` also puts the typed hours back
// to the saved ones.
function adopt(stored, resetInputs = false) {
  const schedule = FocusSchedule.saved(stored.schedule);
  const changed = schedule?.start !== state.schedule?.start || schedule?.end !== state.schedule?.end;
  state.schedule = schedule;
  state.options = FocusOptions.normalize(stored.options);
  if (changed || resetInputs) showSchedule(schedule);
  showOptions(state.options);
}

function adoptResponse(response) {
  if (response?.state) adopt(response.state, Boolean(response.ok) || response.code === "LOCKED");
}

function viewState(locked) {
  if (!state.loaded) return state.loadFailed ? "error" : "loading";
  if (locked) return "locked";
  return state.schedule ? "open" : "setup";
}

function renderHeadline(view, now) {
  if (view === "loading") return setHeadline("Loading", "schedule…");
  if (view === "error") return setHeadline("Can’t load", "schedule.");
  if (view === "setup") return setHeadline("Set your", "focus hours.");
  const next = FocusSchedule.timeLabel(FocusSchedule.nextTransition(state.schedule, now));
  return setHeadline(view === "locked" ? "No feed" : "Feed is open", "until", next);
}

// A draft can't survive into a locked window, and a "locked until" message must not outlive it.
function trackLockChange(locked) {
  if (!state.loaded) return;
  if (locked && wasLocked === false && draftDiffersFrom(state.schedule)) {
    showSchedule(state.schedule);
    showMessage("Focus has started. Unsaved changes were discarded.");
  }
  if (!locked && wasLocked === true) showMessage("Focus has ended. Settings are unlocked.");
  wasLocked = locked;
}

function render() {
  const now = new Date();
  setText(clockTime, FocusSchedule.timeLabel(now));
  const locked = isLocked(now);
  trackLockChange(locked);

  const view = viewState(locked);
  if (document.body.dataset.state !== view) document.body.dataset.state = view;
  renderHeadline(view, now);
  renderForm({ schedule: state.schedule, locked, disabled: !state.loaded || state.saving || locked, saving: state.saving });
  setOptionsLocked(locked);

  if (locked) closeConfirm();
  refreshConfirm(now);

  const shown = !state.loaded ? null : locked ? state.schedule : draftSchedule() ?? state.schedule;
  renderTimeline({ now, shown, saved: state.schedule });
  paintMessage();
}

setMessageHint((line) => {
  const now = new Date();
  if (isLocked(now)) return { text: line === "drawer" ? addOnlyNotice(now) : lockedNotice(now), kind: "notice" };
  if (line === "drawer") return NO_MESSAGE;
  const { start, end } = readDraft();
  if (start !== null && end !== null && start > end) return { text: "Runs through midnight.", kind: "" };
  if (state.loaded && !state.schedule) return { text: "Nothing is blocked until you save.", kind: "" };
  return NO_MESSAGE;
});

async function refresh() {
  try {
    const response = await api.fetchState();
    if (!response?.ok || !response.state) throw new Error("State unavailable");
    const firstLoad = !state.loaded;
    adopt(response.state, firstLoad);
    state.loaded = true;
    state.loadFailed = false;
    if (firstLoad) showMessage("");
  } catch {
    if (!state.loaded) {
      state.loadFailed = true;
      showMessage("Reopen this popup. If it keeps happening, reload the extension on the extensions page.", "error");
    }
  }
  render();
}

function handleSubmit() {
  if (!state.loaded || state.saving) return;
  const now = new Date();
  if (isLocked(now)) {
    render();
    showMessage(lockedNotice(now), "error");
    return;
  }

  const { draft, error } = takeDraft();
  if (error) {
    showMessage(error, "error");
    return;
  }
  openConfirm(draft, now);
}

async function commitSchedule(draft) {
  if (!state.loaded || state.saving) return;
  state.saving = true;
  showMessage("");
  render();
  try {
    const response = await api.saveSchedule(draft);
    adoptResponse(response);
    if (!response?.ok) {
      showMessage(response?.message ?? "Couldn’t save the schedule. Try again.", "error");
    } else if (FocusSchedule.isActive(state.schedule, new Date())) {
      showMessage("Saved. Focus is active and the schedule is locked.", "success");
    } else {
      showMessage(`Saved. Focus starts at ${state.schedule.start} and repeats every day.`, "success");
    }
  } catch {
    showMessage("Couldn’t save the schedule. Reopen this popup and try again.", "error");
  } finally {
    state.saving = false;
    render();
  }
}

// Switches save as soon as they are flipped. If saving fails they go back to what is stored.
async function commitOptions(options) {
  if (state.loaded) {
    showMessage("");
    try {
      const response = await api.saveOptions(options);
      adoptResponse(response);
      if (!response?.ok) showMessage(response?.message ?? "Couldn’t save the settings. Try again.", "error");
    } catch {
      showMessage("Couldn’t save the settings. Reopen this popup and try again.", "error");
    }
  }
  showOptions(state.options);
  render();
}

function reportRefusedChange() {
  const now = new Date();
  if (isLocked(now)) showMessage(keptBlockedNotice(now), "error");
  else render();
}

listen({
  onSubmit: handleSubmit,
  onEdit: () => {
    showMessage("");
    render();
  },
  onBlur: paintMessage
});
onConfirm(commitSchedule);
listenToOptions({ isLocked: () => isLocked(new Date()), onChange: commitOptions, onRefused: reportRefusedChange });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.schedule || changes.options)) void refresh();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  render();
  void refresh();
});
window.addEventListener("focus", () => {
  render();
  void refresh();
});
window.setInterval(() => {
  render();
  // If the background worker was unreachable, keep trying until it answers.
  if (!state.loaded && --retryCountdown <= 0) {
    retryCountdown = RETRY_TICKS;
    void refresh();
  }
}, 1000);

render();
void refresh();
