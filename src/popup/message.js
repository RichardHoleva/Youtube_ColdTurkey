import { byId, setText } from "./dom.js";

export const NO_MESSAGE = Object.freeze({ text: "", kind: "" });

// The form and the drawer each have a line. Only one of them is ever in view.
const lines = { form: byId("form-message"), drawer: byId("drawer-message") };
const KINDS = ["success", "error", "notice"];
let current = NO_MESSAGE;
let hint = () => NO_MESSAGE;

// What to show on a line when nothing has been reported. main.js decides, since it knows the
// lock state. The provider gets the name of the line.
export function setMessageHint(provider) {
  hint = provider;
}

export function paintMessage() {
  for (const [name, line] of Object.entries(lines)) {
    const shown = current.text ? current : hint(name);
    setText(line, shown.text);
    for (const kind of KINDS) line.classList.toggle(kind, shown.kind === kind);
  }
}

export function showMessage(text, kind = "") {
  current = { text, kind };
  paintMessage();
}
