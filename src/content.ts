// ---------------- Central fields store ----------------
const discoveredFields: Array<{
  name: string;
  value: string;
  role: string;
  input: HTMLInputElement | HTMLTextAreaElement;
}> = [];

let loggingEnabled = false;
let cred: { [key: string]: any } = {};
// const hostname = window.location.hostname;

// ---------------- Background logger ----------------
const sendStatusToBackground = ({
  level,
  log,
}: {
  level: string;
  log: string;
}) => {
  chrome.runtime.sendMessage(
    {
      type: "LOG_MESSAGE",
      payload: { level, log },
    },
    () => {
      if (chrome.runtime.lastError) {
        return;
      }
    }
  );
  return true;
};

// ---------------- Logging toggle check ----------------
const checkLogging = async () => {
  try {
    const check = await chrome.storage.local.get("loggingEnabled");
    loggingEnabled = check?.loggingEnabled;
  } catch (err) {
    sendStatusToBackground({
      level: "error",
      log:
        "Error while checking loggingEnabled: " +
        (err instanceof Error ? err.message : JSON.stringify(err)),
    });
  }
};
checkLogging();

// ---------------- Credentials cache ----------------
// const autoFillAlreadyApplied = async () => {
//   try {
//     const check = await chrome.storage.local.get(`autofill:state:${hostname}`);
//     if (check && Object.keys(check).length > 0) {
//       sendStatusToBackground({
//         level: "info",
//         log: "Credentials found for this website",
//       });
//       if (loggingEnabled) console.log("Credentials found for this website");
//       cred = JSON.parse(atob(check[`autofill:state:${hostname}`]));
//     }
//   } catch (err) {
//     sendStatusToBackground({
//       level: "error",
//       log:
//         "Error while auto filling credentials: " +
//         (err instanceof Error ? err.message : JSON.stringify(err)),
//     });
//   }
// };
// autoFillAlreadyApplied();

// ------- Helpers for Deep Field Discovery ----

// Visibility check
function hasSize(rect: DOMRect) {
  return rect && rect.width > 0 && rect.height > 0;
}
function isClipped(style: CSSStyleDeclaration) {
  const cp = (style as any).clipPath || (style as any).webkitClipPath || "";
  const clip = style.clip || "";
  return (cp && cp !== "none") || (clip && clip !== "auto");
}
function isZeroScale(style: CSSStyleDeclaration) {
  const tr = style.transform || style.webkitTransform || "";
  if (!tr || tr === "none") return false;
  if (/scale\(\s*0[),]/.test(tr)) return true;
  const m = tr.match(/matrix\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
    if (parts.length >= 4 && (parts[0] === 0 || parts[3] === 0)) return true;
  }
  return false;
}
function isVisibleDeep(elem: Element): boolean {
  if (!(elem instanceof Element)) return false;
  const rect = elem.getBoundingClientRect();
  const style = window.getComputedStyle(elem);
  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    parseFloat(style.opacity) === 0 ||
    isZeroScale(style) ||
    !hasSize(rect)
  )
    return false;
  if (isClipped(style)) return false;
  let node = elem.parentElement;
  while (node && node !== document.documentElement) {
    const s = window.getComputedStyle(node);
    if (
      s.display === "none" ||
      s.visibility === "hidden" ||
      s.visibility === "collapse" ||
      parseFloat(s.opacity) === 0 ||
      isZeroScale(s) ||
      isClipped(s)
    )
      return false;
    node = node.parentElement;
  }
  return true;
}

// Shadow-DOM aware traversal
function* walkTree(root: Node): Generator<Element> {
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let curr = tw.currentNode as Element | null;
  while (curr) {
    yield curr;
    if ((curr as HTMLElement).shadowRoot)
      yield* walkTree((curr as HTMLElement).shadowRoot!);
    curr = tw.nextNode() as Element | null;
  }
}

// Collect input candidates
function collectCandidates(): (HTMLInputElement | HTMLTextAreaElement)[] {
  const selectors = [
    "input:not([type])",
    'input[type="text" i]',
    'input[type="search" i]',
    'input[type="email" i]',
    'input[type="password" i]',
    'input[type="tel" i]',
    'input[type="url" i]',
    'input[type="number" i]',
    "textarea",
  ].join(",");

  const results = new Set<HTMLInputElement | HTMLTextAreaElement>();

  // Helper to safely add if element matches expected input or textarea
  function tryAddElement(el: Element) {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      results.add(el);
    }
  }

  document.querySelectorAll(selectors).forEach((el) => tryAddElement(el));

  for (const el of walkTree(document)) {
    const host = el as HTMLElement;
    if (host.shadowRoot) {
      host.shadowRoot
        .querySelectorAll(selectors)
        .forEach((node) => tryAddElement(node));
    }
  }

  return Array.from(results);
}

// Label + aria
function getAriaLabelText(input: HTMLElement): string {
  const ariaLabel = input.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  const labelledBy = input.getAttribute("aria-labelledby");
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((el) => (el && isVisibleDeep(el) ? el.innerText.trim() : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function getLabelText(input: HTMLElement): string {
  if (input.id) {
    const lab = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (lab && isVisibleDeep(lab)) return (lab as HTMLElement).innerText.trim();
  }
  const wrapper = input.closest("label");
  if (wrapper && isVisibleDeep(wrapper)) {
    const clone = wrapper.cloneNode(true) as HTMLElement;
    clone.querySelectorAll("input,textarea,select").forEach((n) => n.remove());
    if (clone.innerText.trim()) return clone.innerText.trim();
  }
  const aria = getAriaLabelText(input);
  if (aria) return aria;
  return "";
}

// Classify into role
function classifyInput(
  input: HTMLInputElement | HTMLTextAreaElement,
  label: string
): string {
  const textToCheck = (
    (input.getAttribute("type") || "") +
    " " +
    input.name +
    " " +
    input.id +
    " " +
    input.getAttribute("placeholder") +
    " " +
    label
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

// Discover and auto-fill
function discoverAndFillInputs(initial: boolean = false) {
  if (initial) {
    if (loggingEnabled) {
      console.log("Fields Filled Successfully");
    }
    sendStatusToBackground({
      level: "info",
      log: "Discovery of fields started",
    });
  }
  try {
    discoveredFields.length = 0;
    const candidates = collectCandidates().filter(isVisibleDeep);

    for (const input of candidates) {
      const label = getLabelText(input);
      const role = classifyInput(input as HTMLInputElement, label);
      const name =
        input.name ||
        input.id ||
        label ||
        getAriaLabelText(input) ||
        input.getAttribute("placeholder") ||
        "unknown";

      discoveredFields.push({
        name,
        value: (input as HTMLInputElement).value,
        role,
        input,
      });
    }

    if (loggingEnabled) {
      console.log(
        `${!initial ? "MutationObserver - " : ""}Discovered fields:`,
        discoveredFields
      );
    }
    sendStatusToBackground({
      level: "success",
      log: `${!initial ? "MutationObserver - " : ""}Total discovered fields: ${
        discoveredFields ? discoveredFields?.length : 0
      }`,
    });

    const requiredFields = discoveredFields.filter(
      (item) => item?.role !== "unknown"
    );

    if (loggingEnabled) {
      console.log(
        `${!initial ? "MutationObserver - " : ""}Required Fields: `,
        requiredFields
      );
    }
    sendStatusToBackground({
      level: "info",
      log: `${!initial ? "MutationObserver - " : ""}Total required fields : ${
        requiredFields ? requiredFields?.length : 0
      }`,
    });

    // Auto-fill if creds available
    if (cred && Object.keys(cred).length > 0) {
      discoveredFields.forEach(({ role, input }) => {
        let valueToFill = "";
        if (role === "username") valueToFill = cred.username || "";
        else if (role === "email") valueToFill = cred.email || "";
        else if (role === "password") valueToFill = cred.password || "";

        if (valueToFill) {
          (input as HTMLInputElement).value = valueToFill;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          (input as HTMLElement).style.outline = "3px solid orange";
        }
      });
      sendStatusToBackground({
        level: "success",
        log: "Auto-Filled Fields Successfully",
      });
    }
  } catch (err) {
    sendStatusToBackground({
      level: "error",
      log:
        "Error in discoverAndFillInputs: " +
        (err instanceof Error ? err.message : JSON.stringify(err)),
    });
  }
}

// ---------------- Debounced + Observer ---------------
function debounce(func: () => void, wait: number) {
  let timeout: number;
  return () => {
    clearTimeout(timeout);
    timeout = window.setTimeout(func, wait);
  };
}
const debouncedDiscover = debounce(discoverAndFillInputs, 300);

const observer = new MutationObserver((mut) => {
  for (const m of mut) {
    if (m.type === "childList" || m.type === "attributes") {
      debouncedDiscover();
      break;
    }
  }
});
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
});

// Initial run
discoverAndFillInputs(true);

// ---------------- Message Handlers ----------------
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DEBUG_TOGGLE") {
    loggingEnabled = message.enabled;
    if (loggingEnabled) {
      console.log("Debug mode is enabled");
    }
    sendResponse({ status: "success", toggleLogs: loggingEnabled });
    sendStatusToBackground({
      level: "success",
      log: "Debug mode is enabled",
    });
    return true;
  } else if (message.type === "FILL_FIELDS") {
    try {
      discoveredFields.forEach(({ role, input }) => {
        let val = "";
        if (role === "username") val = message.data.username || "";
        else if (role === "email") val = message.data.email || "";
        else if (role === "password") val = message.data.password || "";
        if (val) {
          (input as HTMLInputElement).value = val;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          (input as HTMLElement).style.outline = "3px solid orange";
        }
      });
      if (loggingEnabled) {
        console.log("Fields Filled Successfully");
      }
      sendResponse({
        status: "success",
        message: "Fields Filled Successfully",
      });
      sendStatusToBackground({
        level: "success",
        log: "Fields Filled Successfully",
      });
    } catch (err) {
      sendResponse({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
      sendStatusToBackground({
        level: "error",
        log:
          "Error while filling fields: " +
          (err instanceof Error ? err.message : JSON.stringify(err)),
      });
    }
    return true;
  }
  return false;
});
