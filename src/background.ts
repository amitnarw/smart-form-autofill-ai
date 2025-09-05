chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
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
                sendResponse({
                  status: "error",
                  message: chrome.runtime.lastError.message,
                });
                return;
              }
              try {
                sendResponse(response);
              } catch {}
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
      chrome.runtime.sendMessage(
        {
          type: "LOG_MESSAGE",
          payload: message.payload,
        },
        () => {
          if (chrome.runtime.lastError) {
            return;
          }
        }
      );
      return true;
    } else if (message.type === "STATUS") {
      chrome.runtime.sendMessage(
        {
          type: "STATUS",
          payload: message.payload,
        },
        () => {
          if (chrome.runtime.lastError) {
            return;
          }
        }
      );
      return true;
    }
  } catch (err) {
    if (err instanceof Error) {
      console.error("Error in background file" + err?.message);
    } else {
      console.error("Error in background file");
    }
  }
});
