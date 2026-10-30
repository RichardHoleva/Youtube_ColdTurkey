import { byId } from "../dom.js";

const main = document.querySelector("main");
const drawer = byId("block-drawer");
const opener = byId("drawer-open");
const closer = byId("drawer-close");
const listeners = [];

const isOpen = () => document.body.dataset.drawer === "open";

// Whatever is out of sight is `inert`, so Tab and screen readers stay on the visible page.
function setOpen(open) {
  if (open === isOpen()) return;
  document.body.dataset.drawer = open ? "open" : "closed";
  opener.setAttribute("aria-expanded", String(open));
  drawer.inert = !open;
  main.inert = open;
  (open ? closer : opener).focus({ preventScroll: true });
  for (const listener of listeners) listener(open);
}

export const closeDrawer = () => setOpen(false);
export const isDrawerOpen = isOpen;

// The listener gets `true` when the drawer opens and `false` when it closes, however that happens.
export function onDrawerChange(listener) {
  listeners.push(listener);
}

opener.addEventListener("click", () => setOpen(true));
closer.addEventListener("click", closeDrawer);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !isOpen()) return;
  event.preventDefault();
  closeDrawer();
});
