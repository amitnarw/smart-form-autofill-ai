// Central in-memory store for discovered fields
const discoveredFields: Array<{
  name: string;
  value: string;
  role: string;
  input: HTMLInputElement;
}> = [];

const sendStatusToBackground = ({
  level,
  log,
}: {
  level: string;
  log: string;
}) => {
  chrome.runtime.sendMessage({
    type: "LOG_MESSAGE",
    payload: { level, log },
  });
  return true;
};

let loggingEnabled = false;
let cred: {
  [key: string]: any;
} = {};
const hostname = window.location.hostname;

const checkLogging = async () => {
  try {
    const check = await chrome.storage.local.get("loggingEnabled");
    const value = (check as { loggingEnabled?: boolean }).loggingEnabled;
    loggingEnabled = Boolean(value);
  } catch (err) {
    if (err instanceof Error) {
      sendStatusToBackground({
        level: "error",
        log:
          "Error while checking logginEnabled chrome.storage: " + err?.message,
      });
    } else {
      sendStatusToBackground({
        level: "error",
        log:
          "Error while checking logginEnabled chrome.storage: " +
          JSON.stringify(err),
      });
    }
  }
};
checkLogging();

const autoFillAlreadyApplied = async () => {
  try {
    let check = await chrome.storage.local.get(`autofill:state:${hostname}`);
    if (check && Object.keys(check).length > 0) {
      sendStatusToBackground({
        level: "info",
        log: "Credentials found for this website",
      });
      if (loggingEnabled) {
        console.log("Credentials found for this website");
      }
      const storedValue = (check as Record<string, unknown>)[`autofill:state:${hostname}`];
      if (typeof storedValue === "string") {
        check = JSON.parse(atob(storedValue));
        cred = check;
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      sendStatusToBackground({
        level: "error",
        log:
          "Error while auto filling already applied credentials: " +
          err?.message,
      });
    } else {
      sendStatusToBackground({
        level: "error",
        log:
          "Error while auto filling already applied credentials: " +
          JSON.stringify(err),
      });
    }
  }
};
autoFillAlreadyApplied();

function classifyInput(input: HTMLInputElement): string {
  const textToCheck = (
    input.type +
    " " +
    input.name +
    " " +
    input.id +
    " " +
    input.getAttribute("placeholder") +
    " " +
    input.getAttribute("aria-label") +
    " " +
    (input.id ? getLabelTextForInput(input) : "")
  ).toLowerCase();

  if (textToCheck.includes("password")) return "password";
  if (textToCheck.includes("email")) return "email";
  if (
    textToCheck.includes("user") ||
    textToCheck.includes("login") ||
    textToCheck.includes("account")
  )
    return "username";
  return "unknown";
}

function getLabelTextForInput(input: HTMLInputElement): string {
  if (!input.id) return "";
  const label = document.querySelector(
    `label[for="${input.id}"]`
  ) as HTMLElement | null;
  return label ? label.innerText.trim() : "";
}

function discoverInputs() {
  try {
    sendStatusToBackground({
      level: "info",
      log: "Discovery of fields started",
    });
    const allInputs = [
      ...document.querySelectorAll("input"),
    ] as Array<HTMLInputElement>;

    const allLabels = [
      ...document.querySelectorAll("label"),
    ] as HTMLLabelElement[];
    const labelMap = new Map<string, string>();
    for (const label of allLabels) {
      const forId = label.getAttribute("for");
      if (forId) {
        labelMap.set(forId, label.innerText.trim());
      }
    }

    discoveredFields.length = 0;

    for (const input of allInputs) {
      const labelText = input.id ? labelMap.get(input.id) : null;
      const ariaLabel = input.getAttribute("aria-label");
      const ariaLabelledById = input.getAttribute("aria-labelledby");
      let ariaLabelledBy = null;
      if (ariaLabelledById) {
        const labelledElem = document.getElementById(ariaLabelledById);
        if (labelledElem) ariaLabelledBy = labelledElem.innerText.trim();
      }

      const name =
        input.name ||
        input.id ||
        labelText ||
        ariaLabel ||
        ariaLabelledBy ||
        input.getAttribute("placeholder") ||
        "unknown";

      const role = classifyInput(input);

      discoveredFields.push({
        name,
        value: input.value,
        role,
        input,
      });
    }

    sendStatusToBackground({
      level: "info",
      log: `Total discovered fields: ${
        discoveredFields ? discoveredFields?.length : 0
      }`,
    });
    if (loggingEnabled) {
      console.log("Discovered fields with roles:", discoveredFields);
    }

    const choosenFields = discoveredFields.filter(
      (item) => item?.role !== "unknown"
    );

    sendStatusToBackground({
      level: "info",
      log: `Total fields as per the roles : ${
        choosenFields ? choosenFields?.length : 0
      }`,
    });

    if (loggingEnabled) {
      console.log("Choosen Fields: ", choosenFields);
    }

    if (cred && Object.keys(cred).length > 0) {
      discoveredFields.forEach(({ role, input }) => {
        let valueToFill = "";
        if (role === "username") {
          valueToFill = cred.username || "";
        } else if (role === "email") {
          valueToFill = cred.email || "";
        } else if (role === "password") {
          valueToFill = cred.password || "";
        }

        if (valueToFill) {
          input.value = valueToFill;

          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.style.outline = "3px solid orange";
        }
      });

      sendStatusToBackground({
        level: "success",
        log: "Auto-Filled Fields Successfully",
      });

      if (loggingEnabled) {
        console.log("Auto-Filled Fields Successfully");
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      sendStatusToBackground({
        level: "error",
        log: "Error while running discoverInputs() function: " + err?.message,
      });
    } else {
      sendStatusToBackground({
        level: "error",
        log:
          "Error while running discoverInputs() function: " +
          JSON.stringify(err),
      });
    }
  }
}

// Debounce function
function debounce(func: () => void, wait: number) {
  let timeout: number;
  return () => {
    clearTimeout(timeout);
    timeout = window.setTimeout(func, wait);
  };
}

const debouncedDiscover = debounce(() => {
  discoverInputs();
}, 300);

// MutationObserver
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.type === "childList" || mutation.type === "attributes") {
      debouncedDiscover();
      break;
    }
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["type", "name", "id", "data-*"],
});

// Initial discovery call
discoverInputs();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DEBUG_TOGGLE") {
    try {
      loggingEnabled = message.enabled;
      console.log(`Logging enabled: ${loggingEnabled}`);
      sendStatusToBackground({
        level: "success",
        log: "Debug mode is enabled",
      });
      sendResponse({ status: "success", toggleLogs: loggingEnabled });
    } catch (err) {
      console.error("Error in content script:", err);
      if (err instanceof Error) {
        sendStatusToBackground({
          level: "error",
          log: "Error while enabling/disabling debug toggle: " + err?.message,
        });
        sendResponse({ status: "error", message: err.message });
      } else {
        sendStatusToBackground({
          level: "error",
          log:
            "Error while enabling/disabling debug toggle: " +
            JSON.stringify(err),
        });
        sendResponse({ status: "error", message: "Unknown error" });
      }
    }

    return true;
  } else if (message.type === "FILL_FIELDS") {
    try {
      discoveredFields.forEach(({ role, input }) => {
        let valueToFill = "";
        if (role === "username") {
          valueToFill = message.data.username || "";
        } else if (role === "email") {
          valueToFill = message.data.email || "";
        } else if (role === "password") {
          valueToFill = message.data.password || "";
        }

        if (valueToFill) {
          input.value = valueToFill;

          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          input.style.outline = "3px solid orange";
        }
      });

      if (loggingEnabled) {
        console.log("Fields Filled Successfully");
      }
      sendStatusToBackground({
        level: "success",
        log: "Fields Filled Successfully",
      });
      sendResponse({
        status: "success",
        message: "Fields Filled Successfully",
      });
    } catch (err) {
      console.error("Error while auto filling:", err);
      if (err instanceof Error) {
        sendStatusToBackground({
          level: "error",
          log: "Error while filling fields value: " + err?.message,
        });
        sendResponse({ status: "error", message: err.message });
      } else {
        sendStatusToBackground({
          level: "error",
          log: "Error while filling fields value: " + JSON.stringify(err),
        });
        sendResponse({ status: "error", message: "Unknown error" });
      }
    }
    return true;
  }

  return false;
});
