// Every button.disclosure[aria-controls] opens and closes the panel it points at. A closed
// panel is `inert`, so Tab and clicks can't reach inside it.
for (const button of document.querySelectorAll("button.disclosure[aria-controls]")) {
  const panel = document.getElementById(button.getAttribute("aria-controls"));
  if (!panel) continue;

  button.addEventListener("click", () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    panel.inert = !open;
  });
}
