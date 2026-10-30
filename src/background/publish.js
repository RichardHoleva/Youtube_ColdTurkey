const YOUTUBE_URLS = ["https://www.youtube.com/*", "https://youtube.com/*"];

function toolbarTitle(state) {
  if (!state.occasions) return "Focus Lock: set your focus hours";
  const until = FocusSchedule.timeLabel(new Date(state.nextChange));
  return state.active ? `Focus Lock: no feed until ${until}` : `Focus Lock: feed is open until ${until}`;
}

// "SET" nudges a new user to open the popup and choose their hours.
function toolbarBadge(state) {
  if (!state.occasions) return "SET";
  return state.active ? "ON" : "";
}

async function notifyTabs(state) {
  const tabs = await chrome.tabs.query({ url: YOUTUBE_URLS });
  await Promise.allSettled(tabs
    .filter((tab) => tab.id !== undefined)
    .map((tab) => chrome.tabs.sendMessage(tab.id, { type: "FOCUS_STATE", state })));
}

async function publish(state) {
  await Promise.allSettled([
    chrome.action.setBadgeText({ text: toolbarBadge(state) }),
    chrome.action.setBadgeBackgroundColor({ color: "#e5481a" }),
    chrome.action.setTitle({ title: toolbarTitle(state) }),
    notifyTabs(state)
  ]);
}
