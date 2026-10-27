import { byId, setText } from "./dom.js";

export const NO_MESSAGE = Object.freeze({ text: "", kind: "" });

const line = byId("form-message");
const KINDS = ["success", "error", "notice"];
let current = NO_MESSAGE;
let hint = () => NO_MESSAGE;

// What to show when nothing has been reported. main.js decides, since it knows the lock state.
export function setMessageHint(provider) {
  hint = provider;
}

export function paintMessage() {
  const shown = current.text ? current : hint();
  setText(line, shown.text);
  for (const kind of KINDS) line.classList.toggle(kind, shown.kind === kind);
}

export function showMessage(text, kind = "") {
  current = { text, kind };
  paintMessage();
}
