# YouTube Focus Lock

A Chrome extension that hides YouTube's home feed and video recommendations during a daily time window you choose. Search, the video player, comments and playlists keep working, so you can still watch what you came for, but you can't get pulled into the endless feed.

Think of it as a cold-turkey blocker for the recommendation algorithm, not for YouTube itself.

## What it does

- **Hides the home feed** and the recommendations next to the video, but only inside your focus window.
- **Leaves the useful parts alone:** search, the player, comments, playlist controls and channel pages.
- **Can also block Subscriptions and channels.** Switch it on in the block panel and, during the focus window, the subscriptions feed, the sidebar link to it, the "All subscriptions" page and the list of channels you subscribe to in the sidebar all disappear. Left off, they stay available.
- **Can also block History.** The History page and its sidebar entry disappear, and the page shows a "No history until HH:mm" card. The separate "report history" entry in the sidebar is left alone.
- **Can hide the whole sidebar.** The **Sidebar** switch removes YouTube's left menu during the focus window: the full menu, the narrow icon strip and the button that opens it, and the page uses the space. Shorts, Subscriptions & channels and History sit under it, so you can instead hide just some of them, or all of them.
- **Can also block Shorts.** With the Shorts switch on, during the focus window the Shorts player, the Shorts shelves and tiles in search results and feeds, the Shorts tab on channels and the sidebar link all disappear. A Short opened from a link shows a "No Shorts until HH:mm" card and is stopped, so it can't keep playing sound behind it. Left off, Shorts work as usual.
- **Does nothing until you set it up.** A fresh install blocks nothing. You choose your hours first, and the lock starts only after you save and confirm.
- **Locks its own settings** while the window is active, so you can't just change them when the urge hits. The hours turn read-only ("Locked until HH:mm") and a block you switched on can't be switched off. You can still block more during the lock, but only in that direction. Everything unlocks when the window ends.
- **Repeats every week** in your computer's local time, with different hours for different **occasions**: for example 08:00-20:00 on weekdays and 10:00-14:00 at the weekend, or nothing at all on Fridays. Overnight windows such as 22:00-06:00 work too.
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

### Occasions

Under the 24-hour bar is a row of chips, one per occasion. A new install has one, **Every day**. An occasion is a pair of hours plus the days it applies to, and the chip is named after those days: "Weekdays", "Weekend", "Saturday", "Mon–Thu, Sat".

- **Choose days** with the seven buttons under the chips (Mo to Su). Solid means the day belongs to the occasion you are editing, a light fill means it belongs to another occasion, and an empty outline means no focus that day.
- **A day belongs to one occasion.** Giving a day to an occasion takes it from the one that had it, and an occasion that loses its last day goes away. Taking a day away leaves it with no focus.
- **Add an occasion** with **+ Add**. It starts with no days and the same hours as the one you were on, so pick its days and change its times. You can have up to five, and remove the selected one with the **×** on its chip.
- **Each chip has its own hours.** The bar, the From and To fields and the grips all edit the selected occasion.
- **An occasion with no days can't be saved.** The popup tells you which one.
- **An overnight window belongs to the day it starts on.** A Friday 22:00-06:00 window runs into Saturday morning, whatever Saturday's own occasion is.
- **Windows that touch count as one.** Monday 22:00-06:00 followed by Tuesday 06:00-12:00 is one stretch, and the lock ends at 12:00.
- **While locked,** you can still click a chip to look at another occasion, but nothing can be changed, as with the hours before.
- **An older save is migrated.** A single daily window saved by an earlier version opens as an **Every day** occasion.

The confirmation popup says when focus starts ("today at 08:00", "tomorrow at 08:00", "Saturday at 10:00") and until when the first stretch locks.

### On the bar

You can also set the hours on the 24-hour bar itself. Drag the grip at either end to change **From** or **To**, drag the bar to slide the whole window (it wraps around midnight), or click an empty spot to pull the nearer end there. Everything snaps to 5 minutes and the fields update as you drag. With a grip focused, the arrow keys nudge it by 5 minutes, or by an hour with Shift. The bar can't be dragged while the lock is on.

A confirmation popup explains what will happen, including that you won't be able to change any settings until the window ends. Click **Continue** to save, or **Go back** to change the hours. Nothing is saved and nothing is locked until you continue. If the window includes the current time, the lock starts immediately. Otherwise it starts at the **From** time.

The gear button at the top left of the popup slides out the **Also block** panel, where you choose what else to hide. Close it with the arrow in the same spot or with Esc, and it slides back. Flipping a switch only changes a draft: press **Save** at the bottom of the panel to store it, and the panel closes. Leaving with the arrow or Esc throws the draft away.

**Live preview.** While the panel is open, the YouTube tabs you have open show what the switches would do, before you save: switch Shorts on and the Shorts tiles and menu entry vanish from the page, switch it off and they come back. Sidebar hides the whole menu, and so on. A page that a switch would block shows a card saying "(preview, not saved)". A preview works even when the lock isn't running, and it never hides your home feed, since that belongs to the lock itself, not to a switch. During a lock it only adds to what the lock already hides. It ends when you close the panel, and if you close the popup it lets go by itself within a few seconds. Nothing is saved until you press Save. During the lock you can turn more switches on and save them, and each saved one gets a padlock because it stays on until the window ends; the ones already on can't be turned off. **Sidebar** is the main switch, with **Shorts**, **Subscriptions & channels** and **History** indented under it. Sidebar hides the whole left menu. The three below it also hide their own menu entries, and they go further than the menu: they block those parts of YouTube themselves (see above). Switching Sidebar on switches all three on with it, and switching it off switches them off again; during the lock, an entry that is already saved as on stays on. After that you can still change an entry by itself, so Shorts can be blocked with the sidebar left in place.

The sun/moon switch in the top bar changes between light and dark mode. It remembers your choice, starts out following your system setting, and keeps working during a lock. The "No feed until HH:mm" card on YouTube follows the same choice, including live while a YouTube tab is open.

The card's first line is yours to change. Under the big headline, the line **On YouTube: No feed ✎** shows what the home card says. Click it, type your own title (up to 40 characters, enough for a short sentence; longer titles are shown in smaller type so the card stays tidy), and press Enter or click away to save. Escape cancels, and an empty box brings back "No feed". It can be changed at any time, even during a lock, and open YouTube tabs update straight away. The second line of every card always says "until HH:mm.", so you can still see when the block ends. The Subscriptions card keeps its own wording, "No subscriptions", with the same "until" line.

The start time is included and the end time is not: with 08:00-20:00, blocking begins at 08:00 and ends at 20:00. Start and end can't be the same time.

## Limitations

This is a focus aid, not a security tool. Read this before relying on it:

- **It is easy to bypass.** You can still disable or uninstall the extension, edit its files or change your system clock. The lock only stops casual changes to the schedule.
- **Desktop YouTube only** (`youtube.com` and `www.youtube.com`). The mobile site, the YouTube app, YouTube Music and embedded players on other sites are not covered.
- **Not a full blocker:** channel pages stay available, and so do videos you open by link. The sidebar's channel list is found by what is in it (the "All subscriptions" link, or links to channels in a section that isn't the main or "You" one) and by its heading matching the Subscriptions entry, so if YouTube changes how that section is built it may need updating. The Shorts block hides Shorts, but YouTube's own "Shorts" filter button in the search bar stays visible; it just leads to results with no Shorts in them.
- **YouTube can break it.** If YouTube changes its page structure, the hiding rules may need updating.
- Tested in Chromium on Windows. Opera GX should work since it's Chromium-based, but this hasn't been verified.

## Privacy and permissions

- `storage` saves your week plan, switches, light/dark choice and card title locally with `chrome.storage.local`.
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
    occasions.js         The week plan: occasions, their days, naming, moving days between them
    options.js           The switchable extras (Sidebar, Shorts, Subscriptions) and their validation
    theme.js             Light or dark: a saved choice wins, otherwise follow the system
    card-title.js        The card's title: default, 40-character limit, tidying
  background/            Service worker
    background.js        Entry point: messages, the settings lock, listeners
    state.js             Reads storage and derives the current state
    alarms.js            Wakes the worker at the next on/off moment
    publish.js           Toolbar badge and title, and updates to open YouTube tabs
  content/               Runs on YouTube pages
    content.js           Sets flags on <html> from the week plan, switches and page
    content.css          The hiding rules that react to those flags
    notice.js            The "No feed until HH:mm" card (follows the popup's light/dark choice)
  popup/                 The popup
    popup.html           Page structure
    main.js              Connects the modules below
    state.js, api.js     Popup state and messages to the background worker
    schedule-form.js     From/To fields: typing, arrow keys, validation
    occasions.js         The plan being edited: the occasion chips and the day buttons
    confirm-dialog.js    The "lock in this schedule?" popup
    timeline.js          The 24-hour bar
    timeline-drag.js     Dragging the bar and its grips to set the hours
    headline.js          The big title
    card-title.js        The click-to-edit "On YouTube:" line
    preview.js           Tells open YouTube tabs what the switches would do while the panel is open
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

The tests use a fixed clock and a simulated Chrome API. They cover day and overnight windows, exact boundaries, daylight-saving changes, week plans (days, overnight spill into the next day, touching windows, naming), schedule validation, the settings lock (for the hours and for the switches), storage and alarm handling, and the CSS rules that decide what gets hidden. They don't launch a browser or load live YouTube.
