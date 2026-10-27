import { byId } from "../dom.js";

const main = document.querySelector("main");
const drawer = byId("block-drawer");
const opener = byId("drawer-open");
const closer = byId("drawer-close");

// Whatever is out of sight is `inert`, so Tab and screen readers stay on the visible page.
function setOpen(open) {
  document.body.dataset.drawer = open ? "open" : "closed";
  opener.setAttribute("aria-expanded", String(open));
  drawer.inert = !open;
  main.inert = open;
  (open ? closer : opener).focus({ preventScroll: true });
}

opener.addEventListener("click", () => setOpen(true));
closer.addEventListener("click", () => setOpen(false));
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || document.body.dataset.drawer !== "open") return;
  event.preventDefault();
  setOpen(false);
});
