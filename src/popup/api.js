const send = (message) => chrome.runtime.sendMessage(message);

export const fetchState = () => send({ type: "GET_STATE" });
export const saveSchedule = (schedule) => send({ type: "SAVE_SCHEDULE", schedule });
export const saveOptions = (options) => send({ type: "SAVE_OPTIONS", options });
