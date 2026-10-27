/* Runs on YouTube. It only sets attributes on <html>; content.css does the hiding, so
   recommendations that YouTube inserts later are hidden too. */
(() => {
  "use strict";

  const HEARTBEAT_MS = 10_000;
  let schedule = null; // nothing is hidden until the user has saved hours
  let options = FocusOptions.normalize();
  let boundaryTimer;
  let refreshQueued = false;
  let nextChangeLabel = "";

  function pageType() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/feed/what_to_watch") return "home";
    if (path === "/watch") return "watch";
    if (path === "/feed/subscriptions") return "subscriptions";
    return "other";
  }

  function setRootAttribute(name, value) {
    const root = document.documentElement;
    if (root.getAttribute(name) !== String(value)) root.setAttribute(name, String(value));
  }

  function noticeLead(page) {
    if (page === "home") return "No feed";
    if (page === "subscriptions" && options.subscriptions) return "No subscriptions";
    return null;
  }

  // The local clock decides, including after sleep or a clock change.
  function scheduleBoundary(now) {
    clearTimeout(boundaryTimer);
    boundaryTimer = undefined;
    const next = FocusSchedule.nextTransition(schedule, now);
    nextChangeLabel = next ? FocusSchedule.timeLabel(next) : "";
    if (!next) return;
    boundaryTimer = setTimeout(() => {
      boundaryTimer = undefined;
      render(true);
    }, Math.max(50, next.getTime() - now.getTime() + 25));
  }

  function render(reschedule = false) {
    if (!document.documentElement) return;
    const now = new Date();
    const active = FocusSchedule.isActive(schedule, now);
    const page = pageType();

    setRootAttribute("data-yfl-active", active);
    setRootAttribute("data-yfl-page", page);
    for (const key of FocusOptions.KEYS) setRootAttribute(`data-yfl-block-${key}`, active && options[key]);

    if (reschedule || boundaryTimer === undefined) scheduleBoundary(now);

    const lead = active ? noticeLead(page) : null;
    setRootAttribute("data-yfl-notice", lead !== null);
    if (lead) FocusNotice.show(lead, nextChangeLabel);
  }

  function renderSoon() {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(() => {
      refreshQueued = false;
      render();
    }, 0);
  }

  function apply(stored) {
    schedule = FocusSchedule.saved(stored.schedule);
    options = FocusOptions.normalize(stored.options);
    render(true);
  }

  function loadSettings() {
    try {
      chrome.storage.local.get(["schedule", "options"], (stored) => {
        if (!chrome.runtime.lastError) apply(stored);
      });
    } catch {
      // After an extension reload the old script can linger until the page navigates.
    }
  }

  function reload() {
    render(true);
    loadSettings();
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !(changes.schedule || changes.options)) return;
    apply({
      schedule: changes.schedule ? changes.schedule.newValue : schedule,
      options: changes.options ? changes.options.newValue : options
    });
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "FOCUS_STATE" && message.state) apply(message.state);
  });

  // YouTube changes pages without reloading. The observer catches the routes that don't
  // fire its navigation events.
  document.addEventListener("yt-navigate-start", renderSoon, true);
  document.addEventListener("yt-navigate-finish", renderSoon, true);
  document.addEventListener("yt-page-data-updated", renderSoon, true);
  window.addEventListener("popstate", renderSoon);
  window.addEventListener("pageshow", reload);
  window.addEventListener("focus", reload);
  document.addEventListener("visibilitychange", () => {
    render(true);
    if (!document.hidden) loadSettings();
  });
  new MutationObserver(renderSoon).observe(document, { childList: true, subtree: true });
  setInterval(() => render(true), HEARTBEAT_MS);

  render();
  loadSettings();
})();
