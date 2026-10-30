import * as api from "./api.js";
import "./card-title.js";
import { closeConfirm, onConfirm, openConfirm, refreshConfirm } from "./confirm-dialog.js";
import { byId, setText } from "./dom.js";
import { setHeadline } from "./headline.js";
import { NO_MESSAGE, paintMessage, setMessageHint, showMessage } from "./message.js";
import { listenToOccasions, occasionsDiffer, renderOccasions, selectedWindow, showOccasions, takeOccasions } from "./occasions.js";
import { draftSchedule, listen, readDraft, renderForm, setDraft } from "./schedule-form.js";
import { closeDrawer, onDrawerChange } from "./settings/drawer.js";
import { listenToOptions, optionsDiffer, setOptionsBusy, showOptions, showSealed } from "./settings/options.js";
import { addOnlyNotice, isLocked, keptBlockedNotice, lockedNotice, savedWhileLockedNotice, state } from "./state.js";
import "./theme/theme-switch.js";
import { renderTimeline } from "./timeline.js";
import { listenToTimeline } from "./timeline-drag.js";

const RETRY_TICKS = 3;
const clockTime = byId("clock-time");
let wasLocked = null;
let savingOptions = false;
let retryCountdown = RETRY_TICKS;

// Takes what the background worker reports. `resetInputs` also puts the plan being edited and the
// switches back to the saved ones; otherwise they only follow when the saved values changed.
// After a save, `keepSelection` stays on the occasion that was being edited.
function adopt(stored, resetInputs = false, keepSelection = false) {
  const occasions = FocusOccasions.fromStored(stored);
  const options = FocusOptions.normalize(stored.options);
  const occasionsChanged = !FocusOccasions.same(occasions, state.occasions);
  const optionsChanged = FocusOptions.KEYS.some((key) => options[key] !== state.options[key]);
  state.occasions = occasions;
  state.options = options;
  if (occasionsChanged || resetInputs) showOccasions(occasions, keepSelection);
  if (optionsChanged || resetInputs) showOptions(options);
}

function adoptResponse(response) {
  if (response?.state) adopt(response.state, Boolean(response.ok) || response.code === "LOCKED", true);
}

function viewState(locked) {
  if (!state.loaded) return state.loadFailed ? "error" : "loading";
  if (locked) return "locked";
  return state.occasions ? "open" : "setup";
}

function renderHeadline(view, now) {
  if (view === "loading") return setHeadline("Loading", "schedule…");
  if (view === "error") return setHeadline("Can’t load", "schedule.");
  if (view === "setup") return setHeadline("Set your", "focus hours.");
  const next = FocusSchedule.timeLabel(FocusOccasions.nextTransition(state.occasions, now));
  return setHeadline(view === "locked" ? "No feed" : "Feed is open", "until", next);
}

// A draft can't survive into a locked window, and a "locked until" message must not outlive it.
function trackLockChange(locked) {
  if (!state.loaded) return;
  if (locked && wasLocked === false && (occasionsDiffer(state.occasions) || optionsDiffer(state.options))) {
    showOccasions(state.occasions, true);
    showOptions(state.options);
    showMessage("Focus has started. Unsaved changes were discarded.");
  }
  if (!locked && wasLocked === true) showMessage("Focus has ended. Settings are unlocked.");
  wasLocked = locked;
}

const canEditHours = (now) => state.loaded && !state.saving && !isLocked(now);

// The window being edited: what's typed if it's a valid pair, else what the selected occasion holds.
const editedWindow = () => draftSchedule() ?? selectedWindow();

function render() {
  const now = new Date();
  setText(clockTime, FocusSchedule.timeLabel(now));
  const locked = isLocked(now);
  trackLockChange(locked);

  const view = viewState(locked);
  if (document.body.dataset.state !== view) document.body.dataset.state = view;
  renderHeadline(view, now);
  const editable = canEditHours(now);
  renderForm({ schedule: state.loaded ? selectedWindow() : null, locked, disabled: !editable, saving: state.saving });
  renderOccasions({ editable });
  showSealed((name) => locked && state.options[name]);
  setOptionsBusy(!state.loaded || savingOptions);

  if (locked) closeConfirm();
  refreshConfirm(now);

  const shown = !state.loaded ? null : locked ? selectedWindow() : editedWindow();
  const saved = state.occasions && !occasionsDiffer(state.occasions) ? selectedWindow() : null;
  renderTimeline({ now, shown, saved, editable });
  paintMessage();
}

setMessageHint((line) => {
  const now = new Date();
  if (isLocked(now)) {
    return line === "drawer" ? { text: addOnlyNotice(now), kind: "warning" } : { text: lockedNotice(now), kind: "" };
  }
  if (line === "drawer") return NO_MESSAGE;
  const { start, end } = readDraft();
  if (start !== null && end !== null && start > end) return { text: "Runs through midnight.", kind: "" };
  if (state.loaded && !state.occasions) return { text: "Nothing is blocked until you save.", kind: "" };
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

  const { draft, error } = takeOccasions();
  if (error) {
    showMessage(error, "error");
    render();
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
    const response = await api.saveOccasions(draft);
    adoptResponse(response);
    const now = new Date();
    if (!response?.ok) {
      showMessage(response?.message ?? "Couldn’t save the schedule. Try again.", "error");
    } else if (FocusOccasions.isActive(state.occasions, now)) {
      showMessage("Saved. Focus is active and the schedule is locked.", "success");
    } else {
      const start = FocusOccasions.nextTransition(state.occasions, now);
      showMessage(`Saved. Focus starts ${FocusOccasions.when(start, now)} and repeats ${FocusOccasions.repeats(state.occasions)}.`, "success");
    }
  } catch {
    showMessage("Couldn’t save the schedule. Reopen this popup and try again.", "error");
  } finally {
    state.saving = false;
    render();
  }
}

// Save in the drawer: on success the drawer closes and the main page says what happened. On a
// refusal it stays open, with the reason under the switches.
async function commitOptions(options) {
  if (!state.loaded || savingOptions) return;
  const before = state.options;
  savingOptions = true;
  showMessage("");
  render();
  try {
    const response = await api.saveOptions(options);
    adoptResponse(response);
    if (response?.ok) {
      const changed = FocusOptions.KEYS.some((key) => state.options[key] !== before[key]);
      closeDrawer();
      const now = new Date();
      if (changed) showMessage(isLocked(now) ? savedWhileLockedNotice(now) : "Saved.", "success");
    } else {
      showMessage(response?.message ?? "Couldn’t save the settings. Try again.", "error");
    }
  } catch {
    showMessage("Couldn’t save the settings. Reopen this popup and try again.", "error");
  } finally {
    savingOptions = false;
    render();
  }
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
listenToTimeline({
  isEditable: () => canEditHours(new Date()),
  getWindow: editedWindow,
  onChange: (window) => {
    setDraft(window);
    showMessage("");
    render();
  }
});
listenToOccasions({
  onEdit: () => {
    showMessage("");
    render();
  }
});
onConfirm(commitSchedule);
listenToOptions({
  isSealed: (name) => isLocked(new Date()) && state.options[name],
  onEdit: () => {
    showMessage("");
    render();
  },
  onRefused: reportRefusedChange,
  onSave: commitOptions
});
// Leaving the drawer drops anything that wasn't saved, and opening it starts with a clean line.
onDrawerChange((open) => {
  showMessage("");
  if (!open) showOptions(state.options);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.occasions || changes.schedule || changes.options)) void refresh();
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
