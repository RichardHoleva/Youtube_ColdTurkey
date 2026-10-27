# YouTube Focus Lock

A Chrome extension that hides YouTube's home feed and video recommendations during a daily time window you choose. Search, the video player, comments and playlists keep working, so you can still watch what you came for, but you can't get pulled into the endless feed.

Think of it as a cold-turkey blocker for the recommendation algorithm, not for YouTube itself.

## What it does

- **Hides the home feed** and the recommendations next to the video, but only inside your focus window.
- **Leaves the useful parts alone:** search, the player, comments, playlist controls and channel pages.
- **Can also block Subscriptions.** Switch it on in the block panel and, during the focus window, the subscriptions feed and the sidebar links to it disappear. Left off, subscriptions stay available.
- **Does nothing until you set it up.** A fresh install blocks nothing. You choose your hours first, and the lock starts only after you save and confirm.
- **Locks its own settings** while the window is active, so you can't just change them when the urge hits. The popup says "Settings are locked until HH:mm", the fields turn read-only and the switches refuse to move. It unlocks when the window ends.
- **Repeats every day** in your computer's local time. Overnight windows such as 22:00-06:00 work too.
- **Stays private.** The schedule is stored locally in your browser, with no accounts, servers or tracking.
    
## Install

The extension is not on the Chrome Web Store, so you load it manually:

1. Download or clone this repository to a folder you won't move or delete.
2. Open `chrome://extensions` in Chrome (version 111 or newer).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the folder that directly contains `manifest.json`.
5. Pin **YouTube Focus Lock** from the puzzle-piece menu, then reload any open YouTube tabs.

## Usage

After installing, the toolbar icon shows a **SET** badge until you choose your hours. Click the icon, enter **From** and **To** times in 24-hour `HH:mm` format (typing `8` or `815` is fine; 08:00 and 20:00 are pre-filled as a suggestion), and click **Save**.

A confirmation popup explains what will happen, including that you won't be able to change any settings until the window ends. Click **Continue** to save, or **Go back** to change the hours. Nothing is saved and nothing is locked until you continue. If the window includes the current time, the lock starts immediately. Otherwise it starts at the **From** time.

The button at the top left of the popup slides out the **Also block** panel, where you choose what else to hide. Close it with the arrow in the same spot or with Esc, and it slides back. A switch is saved the moment you flip it, and like the hours it can't be changed while the lock is on, though you can still open the panel and look. The **Subscriptions** switch works. The **Shorts** switch is visual only for now.

The sun/moon switch in the top bar changes between light and dark mode. It remembers your choice, starts out following your system setting, and keeps working during a lock. The "No feed until HH:mm" card on YouTube follows the same choice, including live while a YouTube tab is open.

The start time is included and the end time is not: with 08:00-20:00, blocking begins at 08:00 and ends at 20:00. Start and end can't be the same time.

## Limitations

This is a focus aid, not a security tool. Read this before relying on it:

- **It is easy to bypass.** You can still disable or uninstall the extension, edit its files or change your system clock. The lock only stops casual changes to the schedule.
- **Desktop YouTube only** (`youtube.com` and `www.youtube.com`). The mobile site, the YouTube app, YouTube Music and embedded players on other sites are not covered.
- **Not a full blocker:** it isn't a Shorts blocker yet, and channel pages stay available. The Subscriptions block covers the subscriptions feed and the sidebar links to it, not the list of subscribed channels in the sidebar.
- **YouTube can break it.** If YouTube changes its page structure, the hiding rules may need updating.
- Tested in Chromium on Windows. Opera GX should work since it's Chromium-based, but this hasn't been verified.

## Privacy and permissions

- `storage` saves your schedule, switches and light/dark choice locally with `chrome.storage.local`.
- `alarms` schedules the checks that switch blocking on and off.
- Site access is limited to `youtube.com` and `www.youtube.com`.

There is no telemetry, no network requests of its own, no external libraries and no remote code.

## Project layout

```
manifest.json            Extension manifest (Manifest V3)
icons/                   Toolbar and store icons
src/
  shared/                Used by the background worker, the content script and the popup
    schedule.js          Time-window rules: parsing, overnight windows, DST-safe transitions
    options.js           The switchable extras (Shorts, Subscriptions) and their validation
    theme.js             Light or dark: a saved choice wins, otherwise follow the system
  background/            Service worker
    background.js        Entry point: messages, the settings lock, listeners
    state.js             Reads storage and derives the current state
    alarms.js            Wakes the worker at the next on/off moment
    publish.js           Toolbar badge and title, and updates to open YouTube tabs
  content/               Runs on YouTube pages
    content.js           Sets flags on <html> from the schedule, switches and page
    content.css          The hiding rules that react to those flags
    notice.js            The "No feed until HH:mm" card (follows the popup's light/dark choice)
  popup/                 The popup
    popup.html           Page structure
    main.js              Connects the modules below
    state.js, api.js     Popup state and messages to the background worker
    schedule-form.js     From/To fields: typing, arrow keys, validation
    confirm-dialog.js    The "lock in this schedule?" popup
    timeline.js          The 24-hour bar
    headline.js          The big title
    message.js           The line of text under the form
    dom.js               Small DOM helpers
    styles/              tokens.css (colors, light and dark), base.css, and one file per area
    settings/            drawer (the slide-out "Also block" panel) and options (its switches)
    theme/               Light/dark: early script, switch behavior, switch styles
tests/                   Automated tests
```

## Tests

Requires Node.js 22 or newer and no other dependencies. From the folder containing `manifest.json`:

```sh
node --test tests/*.test.cjs
```

The tests use a fixed clock and a simulated Chrome API. They cover day and overnight windows, exact boundaries, daylight-saving changes, schedule validation, the settings lock (for the hours and for the switches), storage and alarm handling, and the CSS rules that decide what gets hidden. They don't launch a browser or load live YouTube.
