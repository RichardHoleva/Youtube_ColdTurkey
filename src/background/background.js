"use strict";
importScripts("schedule.js");

const HEARTBEAT = "focus-clock-check";
const BOUNDARY = "focus-next-transition";
const YOUTUBE_URLS = ["https://www.youtube.com/*", "https://youtube.com/*"];

// Serialize reads/saves: a second popup cannot overwrite a newly active lock.
let pending = Promise.resolve();
function enqueue(job) {
  const result = pending.then(job);
  pending = result.catch(() => {});
  return result;
}

// null until the user has saved a schedule. A fresh install is not locked.
async function readSchedule() {
  const stored = await chrome.storage.local.get("schedule");
  return FocusSchedule.saved(stored.schedule);
}

function makeState(schedule) {
  const now = new Date();
  const next = FocusSchedule.nextTransition(schedule, now);
  return {
    schedule,
    active: FocusSchedule.isActive(schedule, now),
    now: now.getTime(),
    nextChange: next ? next.getTime() : null
  };
}

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

function titleFor(state) {
  if (!state.schedule) return "Focus Lock: set your focus hours";
  const until = FocusSchedule.timeLabel(new Date(state.nextChange));
  return state.active ? `Focus Lock: no feed until ${until}` : `Focus Lock: feed is open until ${until}`;
}

async function publish(state) {
  await Promise.allSettled([
    // "SET" nudges a new user to open the popup and choose their hours.
    chrome.action.setBadgeText({ text: !state.schedule ? "SET" : state.active ? "ON" : "" }),
    chrome.action.setBadgeBackgroundColor({ color: "#e5481a" }),
    chrome.action.setTitle({ title: titleFor(state) }),
    (async () => {
      const tabs = await chrome.tabs.query({ url: YOUTUBE_URLS });
      await Promise.allSettled(tabs.filter(tab => tab.id !== undefined).map(tab =>
        chrome.tabs.sendMessage(tab.id, { type: "FOCUS_STATE", state })));
    })()
  ]);
}

async function synchronize(broadcast = true) {
  const state = makeState(await readSchedule());
  await ensureAlarms(state);
  if (broadcast) await publish(state);
  return state;
}

async function handleMessage(message) {
  if (message.type === "GET_STATE") {
    return { ok: true, state: await synchronize(false) };
  }

  const schedule = await readSchedule();
  // Enforce the lock here as well as in the UI, using the time at save time.
  const state = makeState(schedule);
  if (state.active) {
    return { ok: false, code: "LOCKED", message: `Schedule is locked until ${FocusSchedule.timeLabel(new Date(state.nextChange))}.`, state };
  }
  if (!FocusSchedule.validate(message.schedule)) {
    return { ok: false, code: "INVALID", message: "Enter two different times as HH:mm.", state };
  }
  await chrome.storage.local.set({ schedule: FocusSchedule.normalize(message.schedule) });
  return { ok: true, state: await synchronize() };
}

// Register listeners synchronously before any asynchronous startup work.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !["GET_STATE", "SAVE_SCHEDULE"].includes(message.type)) return false;
  enqueue(() => handleMessage(message)).then(sendResponse, error => {
    console.error("YouTube Focus Lock:", error);
    sendResponse({ ok: false, code: "ERROR", message: "Couldn’t load or save the schedule. Reopen Focus Lock and try again." });
  });
  return true;
});

function refresh() {
  enqueue(() => synchronize()).catch(error => console.error("YouTube Focus Lock:", error));
}

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === HEARTBEAT || alarm.name === BOUNDARY) refresh();
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.schedule) refresh();
});

// Also recreate alarms whenever a suspended service worker starts again.
refresh();
