/* global FocusSchedule, chrome */
(() => {
  "use strict";

  const form = document.getElementById("schedule-form");
  const startInput = document.getElementById("start");
  const endInput = document.getElementById("end");
  const startValue = document.getElementById("start-value");
  const endValue = document.getElementById("end-value");
  const saveButton = document.getElementById("save");
  const lockStatus = document.getElementById("lock-status");
  const clockTime = document.getElementById("clock-time");
  const headlineLead = document.getElementById("headline-lead");
  const headlinePrefix = document.getElementById("headline-prefix");
  const headlineTime = document.getElementById("headline-time");
  const headlineDot = document.getElementById("headline-dot");
  const timeline = document.getElementById("timeline");
  const timelineBars = Array.from(document.querySelectorAll(".timeline-bar"));
  const timelineNow = document.getElementById("timeline-now");
  const formMessage = document.getElementById("form-message");
  const DAY_MINUTES = 24 * 60;
  const RETRY_TICKS = 3;
  let schedule = FocusSchedule.normalize(null);
  let loaded = false;
  let loadFailed = false;
  let saving = false;
  let lastActive = null;
  let retryCountdown = RETRY_TICKS;
  let message = { text: "", kind: "" };

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function setAttribute(element, name, value) {
    if (element.getAttribute(name) !== value) element.setAttribute(name, value);
  }

  function setStyle(element, name, value) {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  }

  function percent(minutes) {
    return `${(minutes / DAY_MINUTES) * 100}%`;
  }

  // Hourly ticks from 00 to 24; every sixth hour is taller.
  const ticks = document.getElementById("timeline-ticks");
  for (let hour = 0; hour <= 24; hour += 1) {
    const tick = document.createElement("span");
    tick.className = hour % 6 === 0 ? "timeline-tick major" : "timeline-tick";
    tick.style.left = percent(hour * 60);
    ticks.appendChild(tick);
  }

  function showMessage(text, kind = "") {
    message = { text, kind };
    paintMessage();
  }

  function paintMessage() {
    const from = FocusSchedule.parseTime(startInput.value);
    const to = FocusSchedule.parseTime(endInput.value);
    const hint = !message.text && !startInput.hidden && from !== null && to !== null && from > to;
    setText(formMessage, message.text || (hint ? "Runs through midnight." : ""));
    const kind = message.text ? message.kind : "";
    formMessage.classList.toggle("success", kind === "success");
    formMessage.classList.toggle("error", kind === "error");
  }

  function markInvalid(...inputs) {
    for (const input of [startInput, endInput]) {
      if (inputs.includes(input)) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function adoptSchedule(value, forceInputs = false) {
    const next = FocusSchedule.normalize(value);
    const changed = next.start !== schedule.start || next.end !== schedule.end;
    schedule = next;
    if (changed || forceInputs) {
      startInput.value = schedule.start;
      endInput.value = schedule.end;
      markInvalid();
    }
  }

  function draftDiffers() {
    const draftStart = FocusSchedule.parseTime(startInput.value) ?? startInput.value;
    const draftEnd = FocusSchedule.parseTime(endInput.value) ?? endInput.value;
    return draftStart !== schedule.start || draftEnd !== schedule.end;
  }

  function setHeadline(lead, prefix, time) {
    setText(headlineLead, lead);
    // A real space, so text extraction and screen readers read "until 20:00".
    setText(headlinePrefix, time === undefined ? prefix : `${prefix} `);
    headlineTime.hidden = headlineDot.hidden = time === undefined;
    if (time !== undefined) setText(headlineTime, time);
  }

  function renderTimeline(now) {
    const nowMinutes = FocusSchedule.minutesOfDay(now);
    const clock = FocusSchedule.timeLabel(now);
    setStyle(timelineNow, "left", percent(nowMinutes));
    // Real saved times only: the bar is hidden until the schedule has loaded.
    const pairs = loaded ? FocusSchedule.segments(schedule) : [];
    timelineBars.forEach((bar, index) => {
      const pair = pairs[index];
      bar.hidden = !pair;
      if (!pair) return;
      setStyle(bar, "left", percent(pair[0]));
      setStyle(bar, "width", percent(pair[1] - pair[0]));
    });
    setAttribute(timeline, "aria-label", loaded
      ? `24-hour timeline. Focus from ${schedule.start} to ${schedule.end}. Now ${clock}.`
      : `24-hour timeline. Now ${clock}.`);
  }

  function render() {
    const now = new Date();
    setText(clockTime, FocusSchedule.timeLabel(now));
    const active = loaded && FocusSchedule.isActive(schedule, now);

    // A draft cannot survive into a locked interval: show the saved schedule.
    if (loaded && active && lastActive === false && draftDiffers()) {
      adoptSchedule(schedule, true);
      showMessage("Focus has started. Unsaved changes were discarded.");
    }
    if (loaded) lastActive = active;

    const state = !loaded ? (loadFailed ? "error" : "loading") : active ? "locked" : "open";
    if (document.body.dataset.state !== state) document.body.dataset.state = state;

    if (state === "loading") setHeadline("Loading", "schedule…");
    else if (state === "error") setHeadline("Can’t load", "schedule.");
    else {
      const next = FocusSchedule.timeLabel(FocusSchedule.nextTransition(schedule, now));
      setHeadline(active ? "No feed" : "Feed is open", "until", next);
    }

    // Locked: plain saved values and a lock icon instead of inputs and Save.
    const locked = state === "locked";
    const disabled = !loaded || saving || active;
    startInput.disabled = endInput.disabled = saveButton.disabled = disabled;
    startInput.hidden = endInput.hidden = saveButton.hidden = locked;
    startValue.hidden = endValue.hidden = lockStatus.hidden = !locked;
    setText(startValue, schedule.start);
    setText(endValue, schedule.end);
    setText(saveButton, saving ? "Saving…" : "Save");

    renderTimeline(now);
    paintMessage();
  }

  async function refresh() {
    try {
      const response = await chrome.runtime.sendMessage({ type: "GET_STATE" });
      if (!response || !response.ok || !response.state) throw new Error("State unavailable");
      const firstLoad = !loaded;
      adoptSchedule(response.state.schedule, firstLoad);
      loaded = true;
      loadFailed = false;
      if (firstLoad) showMessage("");
      render();
    } catch (_error) {
      if (!loaded) {
        loadFailed = true;
        showMessage("Reopen this popup. If it keeps happening, reload the extension on the extensions page.", "error");
      }
      render();
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!loaded || saving) return;
    const now = new Date();
    if (FocusSchedule.isActive(schedule, now)) {
      render();
      showMessage(`Schedule is locked until ${FocusSchedule.timeLabel(FocusSchedule.nextTransition(schedule, now))}.`, "error");
      return;
    }

    const start = FocusSchedule.parseTime(startInput.value);
    const end = FocusSchedule.parseTime(endInput.value);
    if (start) startInput.value = start;
    if (end) endInput.value = end;
    const draft = { start, end };
    if (!FocusSchedule.validate(draft)) {
      const unreadable = [startInput, endInput].filter((input) => !FocusSchedule.parseTime(input.value));
      markInvalid(...(unreadable.length ? unreadable : [startInput, endInput]));
      showMessage(unreadable.length ? "Enter times as HH:mm, for example 08:00." : "From and To must be different.", "error");
      (unreadable[0] || startInput).focus();
      return;
    }

    saving = true;
    showMessage("");
    render();
    try {
      const response = await chrome.runtime.sendMessage({ type: "SAVE_SCHEDULE", schedule: draft });
      if (response && response.state) adoptSchedule(response.state.schedule, Boolean(response.ok) || response.code === "LOCKED");
      if (!response || !response.ok) {
        showMessage(response && response.message ? response.message : "Couldn’t save the schedule. Try again.", "error");
      } else {
        showMessage(FocusSchedule.isActive(schedule, new Date())
          ? "Saved. Focus is active and the schedule is locked."
          : "Saved. The schedule repeats every day.", "success");
      }
    } catch (_error) {
      showMessage("Couldn’t save the schedule. Reopen this popup and try again.", "error");
    } finally {
      saving = false;
      render();
    }
  });

  // 24-hour entry that does not depend on the browser's locale.
  function stepTime(input, delta) {
    const current = FocusSchedule.parseTime(input.value) ?? schedule.start;
    const minutes = (Number(current.slice(0, 2)) * 60 + Number(current.slice(3)) + delta + DAY_MINUTES) % DAY_MINUTES;
    input.value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }

  for (const input of [startInput, endInput]) {
    input.addEventListener("input", (event) => {
      let value = input.value.replace(/[^\d:]/g, "").slice(0, 5);
      // "22" becomes "22:", but "81" stays put so shorthand like "815" still reads as 08:15.
      if (/^\d{2}$/.test(value) && Number(value) < 24 && String(event.inputType).startsWith("insert")) value += ":";
      if (value !== input.value) input.value = value;
      markInvalid();
      showMessage("");
      render();
    });
    input.addEventListener("blur", () => {
      const time = FocusSchedule.parseTime(input.value);
      if (time && time !== input.value) input.value = time;
      paintMessage();
    });
    input.addEventListener("keydown", (event) => {
      const direction = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
      if (!direction || input.disabled) return;
      event.preventDefault();
      stepTime(input, direction * (event.shiftKey ? 60 : 1));
      markInvalid();
      showMessage("");
      render();
    });
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !Object.prototype.hasOwnProperty.call(changes, "schedule")) return;
    adoptSchedule(changes.schedule.newValue, !loaded);
    render();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      render();
      void refresh();
    }
  });
  window.addEventListener("focus", () => {
    render();
    void refresh();
  });
  window.setInterval(() => {
    render();
    // If the background process was unreachable, keep trying until it answers.
    if (!loaded && --retryCountdown <= 0) {
      retryCountdown = RETRY_TICKS;
      void refresh();
    }
  }, 1000);
  render();
  void refresh();
})();
