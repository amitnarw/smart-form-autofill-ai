chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "toggleLogs") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "updateLogs",
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
  } else if (message.action === "autofill") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          {
            action: "autofillapply",
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
  }
});
