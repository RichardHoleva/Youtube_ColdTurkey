// While the settings panel is open, the YouTube tabs show what the switches would do, before anything
// is saved. The popup tells each tab the switches as they stand; the page applies them and drops them
// again a few seconds after the last word, so a popup that closes without saying so can't leave it stuck.
const YOUTUBE_URLS = ["https://www.youtube.com/*", "https://youtube.com/*"];
let previewing = false;

async function tell(options) {
  try {
    const tabs = await chrome.tabs.query({ url: YOUTUBE_URLS });
    await Promise.allSettled(tabs
      .filter((tab) => tab.id !== undefined)
      .map((tab) => chrome.tabs.sendMessage(tab.id, { type: "FOCUS_PREVIEW", options })));
  } catch {
    // No YouTube tab, or none that can hear it: there is nothing to preview on.
  }
}

// Call with the switches while the panel is open, and with null when it is not. Repeating the same call
// keeps the preview going; ending one that isn't running does nothing.
export function showPreview(options) {
  if (options === null && !previewing) return;
  previewing = options !== null;
  void tell(options);
}
