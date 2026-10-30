"use strict";
importScripts("../shared/schedule.js", "../shared/occasions.js", "../shared/options.js", "state.js", "alarms.js", "publish.js");

const MESSAGE_TYPES = ["GET_STATE", "SAVE_OCCASIONS", "SAVE_OPTIONS"];

// Jobs run one at a time, so a second popup can't overwrite a lock that just started.
let pending = Promise.resolve();
function enqueue(job) {
  const result = pending.then(job);
  pending = result.catch(() => {});
  return result;
}

async function synchronize(broadcast = true) {
  const state = makeState(await readStored());
  await ensureAlarms(state);
  if (broadcast) await publish(state);
  return state;
}

function refusal(code, message, state) {
  return { ok: false, code, message, state };
}

const untilLabel = (state) => FocusSchedule.timeLabel(new Date(state.nextChange));

// The popup also refuses while locked, but its clock can be stale; these checks are the real lock.
async function saveOccasions(occasions, state) {
  if (state.active) return refusal("LOCKED", `Locked until ${untilLabel(state)}.`, state);
  if (!FocusOccasions.validate(occasions)) {
    return refusal("INVALID", "Give every occasion at least one day, and two different times as HH:mm.", state);
  }
  await chrome.storage.local.set({ occasions: FocusOccasions.normalize(occasions) });
  await chrome.storage.local.remove("schedule"); // the single window an earlier version saved
  return { ok: true, state: await synchronize() };
}

// During the lock a switch can be turned on, never off.
async function saveOptions(options, state) {
  if (!FocusOptions.validate(options)) return refusal("INVALID", "Couldn’t read those settings.", state);
  if (state.active && FocusOptions.removes(state.options, options)) {
    return refusal("LOCKED", `Blocked items stay blocked until ${untilLabel(state)}.`, state);
  }
  await chrome.storage.local.set({ options: FocusOptions.normalize(options) });
  return { ok: true, state: await synchronize() };
}

async function handleMessage(message) {
  if (message.type === "GET_STATE") return { ok: true, state: await synchronize(false) };
  const state = makeState(await readStored());
  return message.type === "SAVE_OCCASIONS" ? saveOccasions(message.occasions, state) : saveOptions(message.options, state);
}

function refresh() {
  enqueue(() => synchronize()).catch((error) => console.error("YouTube Focus Lock:", error));
}

// Listeners are registered synchronously, before any asynchronous startup work.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !MESSAGE_TYPES.includes(message.type)) return false;
  enqueue(() => handleMessage(message)).then(sendResponse, (error) => {
    console.error("YouTube Focus Lock:", error);
    sendResponse(refusal("ERROR", "Couldn’t load or save settings. Reopen Focus Lock and try again."));
  });
  return true;
});

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT || alarm.name === BOUNDARY) refresh();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.occasions || changes.schedule || changes.options)) refresh();
});

// A suspended worker that wakes up again recreates its alarms here.
refresh();
