/* The "No feed until HH:mm" card shown on YouTube pages that are blocked. */
const FocusNotice = (() => {
  const ID = "yfl-focus-notice";
  let card;
  let heading;
  let leadLine;
  let timeLabel;
  let pageObserver;
  let observedPage;

  function create(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function build() {
    document.getElementById(ID)?.remove(); // left behind by a previous copy of this script

    leadLine = create("span", "yfl-notice-line");
    timeLabel = create("span", "yfl-notice-time");
    const tail = create("span", "yfl-notice-line");
    tail.append("until ", timeLabel, ".");
    heading = create("h2");
    heading.append(leadLine, tail);

    card = create("section");
    card.id = ID;
    card.setAttribute("role", "status");
    card.setAttribute("aria-label", "Focus Lock");
    card.append(
      create("span", "yfl-notice-brand", "Focus Lock"),
      heading,
      create("p", "", "Use search to find the video you need.")
    );
    document.body.appendChild(card);
  }

  // The sidebar pushes YouTube's page area to the right, so center the card on that area
  // instead of the window, and keep following it when the sidebar opens or closes.
  function position() {
    const page = document.querySelector("ytd-page-manager");
    if (page !== observedPage) {
      pageObserver ??= new ResizeObserver(position);
      pageObserver.disconnect();
      observedPage = page;
      if (page) pageObserver.observe(page);
    }
    const { left, width } = page?.getBoundingClientRect() ?? { left: 0, width: 0 };
    if (width > 0) {
      card.style.setProperty("--yfl-center", `${left + width / 2}px`);
      card.style.setProperty("--yfl-width", `${width}px`);
    } else {
      card.style.removeProperty("--yfl-center");
      card.style.removeProperty("--yfl-width");
    }
  }

  // Text is only written when it changed: a write would wake the page observer in content.js.
  function setText(node, value) {
    if (node.textContent !== value) node.textContent = value;
  }

  // A long title gets smaller type, so it stays to a line or two and the "until" line below
  // it is never pushed far down. The size is a CSS rule keyed on this attribute.
  function setSize(lead) {
    const length = Array.from(lead).length;
    const size = length > 30 ? "small" : length > 20 ? "medium" : "large";
    if (heading.dataset.size !== size) heading.dataset.size = size;
  }

  function show(lead, until) {
    if (!document.body) return;
    if (!card?.isConnected) build();
    setSize(lead);
    setText(leadLine, lead);
    setText(timeLabel, until);
    position();
  }

  return { show };
})();
