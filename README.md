# YouTube Focus Lock

A Chrome extension that hides YouTube's home feed and video recommendations during a daily time window you choose. Search, the video player, comments and playlists keep working, so you can still watch what you came for, but you can't get pulled into the endless feed.

Think of it as a cold-turkey blocker for the recommendation algorithm, not for YouTube itself.

> Slovak documentation: [README.sk.md](README.sk.md)

## What it does

- **Hides the home feed** and the recommendations next to the video, but only inside your focus window.
- **Leaves the useful parts alone:** search, the player, comments, playlist controls, subscriptions and channel pages.
- **Locks its own settings** while the window is active, so you can't just change the schedule when the urge hits. It unlocks when the window ends.
- **Repeats every day.** The default is 08:00-20:00 in your computer's local time. Overnight windows such as 22:00-06:00 work too.
- **Stays private.** The schedule is stored locally in your browser, with no accounts, servers or tracking.

## Install

The extension is not on the Chrome Web Store, so you load it manually:

1. Download or clone this repository to a folder you won't move or delete.
2. Open `chrome://extensions` in Chrome (version 111 or newer).
3. Turn on **Developer mode**.
4. Click **Load unpacked** and select the folder that directly contains `manifest.json`.
5. Pin **YouTube Focus Lock** from the puzzle-piece menu, then reload any open YouTube tabs.

## Usage

Click the extension icon outside the focus window, enter **From** and **To** times in 24-hour `HH:mm` format (typing `8` or `815` is fine), and click **Save**. If the new window includes the current time, it starts immediately and the settings lock.

The start time is included and the end time is not: with 08:00-20:00, blocking begins at 08:00 and ends at 20:00. Start and end can't be the same time.

## Limitations

This is a focus aid, not a security tool. Read this before relying on it:

- **It is easy to bypass.** You can still disable or uninstall the extension, edit its files or change your system clock. The lock only stops casual changes to the schedule.
- **Desktop YouTube only** (`youtube.com` and `www.youtube.com`). The mobile site, the YouTube app, YouTube Music and embedded players on other sites are not covered.
- **Not a full blocker:** it isn't a Shorts blocker, and pages such as subscriptions and channels stay available.
- **YouTube can break it.** If YouTube changes its page structure, the hiding rules may need updating.
- Tested in Chromium on Windows. Opera GX should work since it's Chromium-based, but this hasn't been verified.

## Privacy and permissions

- `storage` saves your schedule locally with `chrome.storage.local`.
- `alarms` schedules the checks that switch blocking on and off.
- Site access is limited to `youtube.com` and `www.youtube.com`.

There is no telemetry, no network requests of its own, no external libraries and no remote code.

## Project layout

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest (Manifest V3) |
| `schedule.js` | Time-window rules shared by all parts: parsing, overnight windows, DST-safe transitions |
| `background.js` | Service worker: alarms, schedule storage, settings lock enforcement |
| `content.js`, `content.css` | Runs on YouTube pages: hides the feed and shows the "No feed until HH:mm" notice |
| `popup.html`, `popup.css`, `popup.js` | The settings popup with the timeline |
| `tests/` | Automated tests |

## Tests

Requires Node.js 22 or newer and no other dependencies. From the folder containing `manifest.json`:

```sh
node --test tests/*.test.cjs
```

The tests use a fixed clock and a simulated Chrome API. They cover day and overnight windows, exact boundaries, daylight-saving changes, schedule validation, the settings lock, storage and alarm handling. They don't launch a browser or load live YouTube.
