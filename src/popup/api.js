const send = (message) => chrome.runtime.sendMessage(message);

export const fetchState = () => send({ type: "GET_STATE" });
export const saveOccasions = (occasions) => send({ type: "SAVE_OCCASIONS", occasions });
export const saveOptions = (options) => send({ type: "SAVE_OPTIONS", options });
