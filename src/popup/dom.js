export const byId = (id) => document.getElementById(id);

// The popup repaints every second, so these skip writes that would change nothing.
export function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

export function setAttribute(element, name, value) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

export function setStyle(element, name, value) {
  if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
}
