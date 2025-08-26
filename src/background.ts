chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DEBUG_TOGGLE") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            type: "DEBUG_TOGGLE",
            enabled: message.enabled,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "SendMessage error:",
                chrome.runtime.lastError.message
              );
              sendResponse({
                status: "error",
                message: chrome.runtime.lastError.message,
              });
              return;
            }
            try {
              sendResponse(response);
            } catch (err) {
              console.error(JSON.stringify(err));
            }
          }
        );
      }
    });
    return true;
  } else if (message.type === "FILL_FIELDS") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            type: "FILL_FIELDS",
            data: message.data,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "SendMessage error:",
                chrome.runtime.lastError.message
              );
              sendResponse({
                status: "error",
                message: chrome.runtime.lastError.message,
              });
              return;
            }
            try {
              sendResponse(response);
            } catch (err) {
              console.error(JSON.stringify(err));
            }
          }
        );
      }
    });
    return true;
  } else if (message.type === "LOG_MESSAGE") {
    chrome.runtime.sendMessage({
      type: "LOG_MESSAGE",
      payload: message.payload,
    });
    return true;
  }
});
