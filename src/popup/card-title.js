import { byId, setText } from "./dom.js";

const titleText = byId("card-title-text");
const editButton = byId("card-title-edit");
const form = byId("card-title-form");
const input = byId("card-title-input");
const count = byId("card-title-count");
let title = FocusTitle.DEFAULT_TITLE;
let editing = false;

function showTitle(next) {
  title = next;
  setText(titleText, title);
}

function showCount() {
  const length = Array.from(input.value).length;
  setText(count, `${length}/${FocusTitle.MAX_LENGTH}`);
  count.classList.toggle("at-limit", length >= FocusTitle.MAX_LENGTH);
}

function setEditing(on) {
  editing = on;
  form.hidden = !on;
  editButton.hidden = on;
}

function startEditing() {
  setEditing(true);
  input.value = title;
  showCount();
  input.focus();
  input.select();
}

async function save(next) {
  const previous = title;
  showTitle(next);
  try {
    await chrome.storage.local.set({ cardTitle: next });
  } catch {
    showTitle(previous);
  }
}

// Enter and clicking away keep what was typed; Escape drops it. An empty box brings back the
// default. With the keyboard, focus goes back to the title; after a click it stays where the click was.
function finish({ keep, refocus }) {
  if (!editing) return;
  const next = FocusTitle.normalize(input.value);
  setEditing(false);
  if (keep && next !== title) void save(next);
  if (refocus) editButton.focus();
}

editButton.addEventListener("click", startEditing);
input.maxLength = FocusTitle.MAX_LENGTH;
input.addEventListener("input", showCount);
input.addEventListener("blur", () => finish({ keep: true, refocus: false }));
form.addEventListener("submit", (event) => {
  event.preventDefault();
  finish({ keep: true, refocus: true });
});
input.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.preventDefault();
  finish({ keep: false, refocus: true });
});

// The same title in every open popup and on YouTube.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.cardTitle && !editing) showTitle(FocusTitle.normalize(changes.cardTitle.newValue));
});

chrome.storage.local.get("cardTitle").then((stored) => {
  if (!editing) showTitle(FocusTitle.normalize(stored.cardTitle));
});
