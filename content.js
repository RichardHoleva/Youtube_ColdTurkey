(() => {
  "use strict";

  // CSS reacts to these attributes, so newly inserted recommendations are hidden too.
  const ACTIVE_ATTRIBUTE = "data-yfl-active";
  const PAGE_ATTRIBUTE = "data-yfl-page";
  const NOTICE_ID = "yfl-focus-notice";
  const HEARTBEAT_MS = 10_000;
  let schedule = FocusSchedule.normalize(null);
  let boundaryTimer;
  let pendingRefresh;
  let notice;
  let noticeTime;
  let nextChangeLabel = "";

  function pageType() {
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/feed/what_to_watch") return "home";
    if (path === "/watch") return "watch";
    return "other";
  }

  function setAttributeIfChanged(root, name, value) {
    if (root.getAttribute(name) !== value) root.setAttribute(name, value);
  }

  function ensureNotice() {
    if (!document.body) return;
    if (notice?.isConnected && noticeTime) return;
    // Reuse a notice left by an earlier script instance, unless it predates this layout.
    notice = document.getElementById(NOTICE_ID);
    noticeTime = notice?.querySelector(".yfl-notice-time") ?? undefined;
    if (noticeTime) return;
    notice?.remove();

    notice = document.createElement("section");
    notice.id = NOTICE_ID;
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-label", "Focus Lock");

    const brand = document.createElement("span");
    brand.className = "yfl-notice-brand";
    brand.textContent = "Focus Lock";
    const heading = document.createElement("h2");
    const lead = document.createElement("span");
    lead.className = "yfl-notice-line";
    lead.textContent = "No feed";
    const tail = document.createElement("span");
    tail.className = "yfl-notice-line";
    noticeTime = document.createElement("span");
    noticeTime.className = "yfl-notice-time";
    tail.append("until ", noticeTime, ".");
    heading.append(lead, tail);
    const hint = document.createElement("p");
    hint.textContent = "Use search to find the video you need.";
    notice.append(brand, heading, hint);
    document.body.appendChild(notice);
  }

  function updateNotice() {
    if (noticeTime && noticeTime.textContent !== nextChangeLabel) noticeTime.textContent = nextChangeLabel;
  }

  function refresh(reschedule = false) {
    const root = document.documentElement;
    if (!root) return;
    const now = new Date();
    const active = FocusSchedule.isActive(schedule, now);
    const page = pageType();
    setAttributeIfChanged(root, ACTIVE_ATTRIBUTE, String(active));
    setAttributeIfChanged(root, PAGE_ATTRIBUTE, page);

    // The local clock is authoritative, including after sleep or a clock change.
    if (reschedule || boundaryTimer === undefined) {
      clearTimeout(boundaryTimer);
      const next = FocusSchedule.nextTransition(schedule, now);
      nextChangeLabel = FocusSchedule.timeLabel(next);
      boundaryTimer = setTimeout(() => {
        boundaryTimer = undefined;
        refresh(true);
      }, Math.max(50, next.getTime() - now.getTime() + 25));
    }

    if (active && page === "home") {
      ensureNotice();
      updateNotice();
    }
  }

  function queueRefresh() {
    if (pendingRefresh !== undefined) return;
    pendingRefresh = setTimeout(() => {
      pendingRefresh = undefined;
      refresh();
    }, 0);
  }

  function readSchedule() {
    try {
      chrome.storage.local.get("schedule", (stored) => {
        if (chrome.runtime.lastError) return;
        schedule = FocusSchedule.normalize(stored.schedule);
        refresh(true);
      });
    } catch {
      // A previous script instance can outlive an extension reload until navigation.
    }
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.schedule) return;
    schedule = FocusSchedule.normalize(changes.schedule.newValue);
    refresh(true);
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "FOCUS_STATE" || !message.state?.schedule) return;
    schedule = FocusSchedule.normalize(message.state.schedule);
    refresh(true);
  });

  // YouTube changes routes without reloading the document. The observer is a fallback
  // for route variants that do not dispatch the usual navigation events.
  document.addEventListener("yt-navigate-start", queueRefresh, true);
  document.addEventListener("yt-navigate-finish", queueRefresh, true);
  document.addEventListener("yt-page-data-updated", queueRefresh, true);
  window.addEventListener("popstate", queueRefresh);
  window.addEventListener("pageshow", () => { refresh(true); readSchedule(); });
  window.addEventListener("focus", () => { refresh(true); readSchedule(); });
  document.addEventListener("visibilitychange", () => {
    refresh(true);
    if (!document.hidden) readSchedule();
  });
  new MutationObserver(queueRefresh).observe(document, { childList: true, subtree: true });
  setInterval(() => refresh(true), HEARTBEAT_MS);

  refresh();
  readSchedule();
})();
