// Central in-memory store for discovered fields
const discoveredFields: Array<{
  name: string;
  value: string;
  role: string;
  input: HTMLInputElement;
}> = [];

let loggingEnabled = false;
let cred: {
  [key: string]: any;
} = {};
const hostname = window.location.hostname;

const checkLogging = async () => {
  let check = await chrome.storage.local.get("loggingEnabled");
  loggingEnabled = check?.loggingEnabled;
};
checkLogging();

const autoFillAlreadyApplied = async () => {
  let check = await chrome.storage.local.get(`autofill:state:${hostname}`);

  if (check) {
    cred = check;
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

  if (loggingEnabled) {
    console.log("Discovered fields with roles:", discoveredFields);
  }

  const choosenFields = discoveredFields.filter(
    (item) => item?.role !== "unknown"
  );

  if (loggingEnabled) {
    console.log("Choosen Fields: ", choosenFields);
  }

  if (cred[`autofill:state:${hostname}`]) {
    discoveredFields.forEach(({ role, input }) => {
      let valueToFill = "";
      if (role === "username") {
        valueToFill = cred[`autofill:state:${hostname}`].username || "";
      } else if (role === "email") {
        valueToFill = cred[`autofill:state:${hostname}`].email || "";
      } else if (role === "password") {
        valueToFill = cred[`autofill:state:${hostname}`].password || "";
      }

      if (valueToFill) {
        input.value = valueToFill;

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.style.outline = "3px solid orange";
      }
    });
  }

  if (loggingEnabled) {
    console.log("Auto-Filled Fields Successfully");
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
  if (message.action === "updateLogs") {
    try {
      loggingEnabled = message.enabled;
      console.log(`Logging enabled: ${loggingEnabled}`);
      sendResponse({ status: "success", toggleLogs: loggingEnabled });
    } catch (err) {
      console.error("Error in content script:", err);
      if (err instanceof Error) {
        sendResponse({ status: "error", message: err.message });
      } else {
        sendResponse({ status: "error", message: "Unknown error" });
      }
    }

    return true;
  } else if (message.action === "autofillapply") {
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
      sendResponse({
        status: "success",
        message: "Fields Filled Successfully",
      });
    } catch (err) {
      console.error("Error while auto filling:", err);
      if (err instanceof Error) {
        sendResponse({ status: "error", message: err.message });
      } else {
        sendResponse({ status: "error", message: "Unknown error" });
      }
    }
    return true;
  }

  return false;
});
