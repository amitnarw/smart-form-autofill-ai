// import { callAI } from "./autofillContentAI";
import type { credentialsFields_v1 } from "./Options/components/dashboard/MainDataTypes";
import type { CredentialsV1 } from "./ContentUtils";
import { sendLogtoBack } from "./ContentUtils";
import CryptoJS from "crypto-js";
import {
  detectRegistrationForm,
  autofillRegistrationForm,
} from "./registrationFormAutofill";
import credentialsData from "./data/credentials.json";
import personalInfoData from "./data/personalInfo.json";
// import { toggleIsChanged } from './Content';

// ---------------- Central fields store ----------------
export const discoveredFields: Array<{
  name: string;
  value: string;
  role: string;
  input: HTMLInputElement | HTMLTextAreaElement;
}> = [];
export let requiredFields: Array<{
  name: string;
  value: string;
  role: string;
  input: HTMLInputElement | HTMLTextAreaElement;
}> = [];

// Track form changes for SPA navigation detection
let lastFormSignature = "";
let formChangeCallbacks: Array<() => void> = [];
// File A - Exporting ischanged directly

// let ischanged = true;

export const onFormChange = (callback: () => void) => {
  formChangeCallbacks.push(callback);
  return () => {
    formChangeCallbacks = formChangeCallbacks.filter((cb) => cb !== callback);
  };
};

const getFormSignature = (): string => {
  const inputs = document.querySelectorAll("input, textarea, select");
  const signatures: string[] = [];
  inputs.forEach((input) => {
    const el = input as HTMLElement;
    if (isVisibleDeep(el)) {
      const type = input.getAttribute("type") || input.tagName.toLowerCase();
      const name = input.getAttribute("name") || "";
      const id = input.getAttribute("id") || "";
      const placeholder = input.getAttribute("placeholder") || "";
      signatures.push(`${type}:${name}:${id}:${placeholder}`);
    }
  });
  return signatures.sort().join("|");
};

const hostname = window.location.hostname;

type InlineCredential = {
  site: string;
  username?: string;
  email?: string;
  password?: string;
};

type InlinePersonalInfo = {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dob?: string;
  additionalFields?: Record<string, string>;
};

let bubbleCredentials = credentialsData as InlineCredential[];
let bubblePersonalInfo = personalInfoData as InlinePersonalInfo;

const checkPendingState = async (): Promise<{
  fieldFilled: string[];
  data: CredentialsV1;
  usrpass: string;
} | null> => {
  try {
    const data = await chrome.runtime.sendMessage({
      type: "checkAutoFillSessionData",
      data: { hostname },
    });
    return data;
  } catch (error) {
    sendLogtoBack({
      message:
        "contentscript autofillcontent checkPendingState Error checking pending state  :",
      level: "error",
      object: { error: error },
    });
    return null;
  }
};

const autoFillIfPending = async () => {
  const data = await checkPendingState();
  if (data && data?.data?.data) {
    var removespacecredentials = data.data.data.replace(/\s/g, "");
    const filldata = CryptoJS.AES.decrypt(
      removespacecredentials,
      data?.usrpass,
    ).toString(CryptoJS.enc.Utf8);
    const parsedFillData = JSON.parse(filldata) as credentialsFields_v1;
    autofillContent({
      message: {
        data: {
          username: parsedFillData.additionalFields?.username,
          email: parsedFillData.additionalFields?.email,
          password: parsedFillData.additionalFields?.password,
          phone: parsedFillData.additionalFields?.phone,
          address: parsedFillData.additionalFields?.address,
        },
      },
      encrypted: data?.data || null,
      usrpass: data?.usrpass,
    });
  }
};
autoFillIfPending();

// ------- Helpers for Deep Field Discovery ----

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
export function isVisibleDeep(elem: Element): boolean {
  if (!(elem instanceof Element)) return false;

  // Check element's own attributes first (hidden, aria-hidden)
  if (
    elem.hasAttribute("hidden") ||
    elem.getAttribute("aria-hidden") === "true"
  ) {
    return false;
  }

  const rect = elem.getBoundingClientRect();
  const style = window.getComputedStyle(elem);

  if (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.visibility === "collapse" ||
    parseFloat(style.opacity) === 0 ||
    isZeroScale(style) ||
    !hasSize(rect)
  ) {
    return false;
  }

  if (isClipped(style)) return false;

  // Check all ancestors for visibility, hidden attributes, and hidden modals
  let node = elem.parentElement;
  while (node && node !== document.documentElement) {
    // Check ancestor's hidden attributes

    if (
      node.hasAttribute("hidden") ||
      node.getAttribute("aria-hidden") === "true"
    ) {
      return false;
    }

    const s = window.getComputedStyle(node);

    // Check if ancestor itself is hidden via CSS
    if (
      s.display === "none" ||
      s.visibility === "hidden" ||
      s.visibility === "collapse" ||
      parseFloat(s.opacity) === 0 ||
      isZeroScale(s) ||
      isClipped(s)
    ) {
      return false;
    }

    // Check if ancestor is a hidden modal (even if modal itself doesn't have display:none, check if it's effectively hidden)
    const isModal = node.matches?.(
      '[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]',
    );
    if (isModal) {
      // If it's a modal, check if it's hidden via attributes
      console.log(
        "node can get hidden",
        elem,
        node.hasAttribute("hidden") ||
          node.getAttribute("aria-hidden") === "true",
      );
      if (
        node.hasAttribute("hidden") ||
        node.getAttribute("aria-hidden") === "true"
      ) {
        return false;
      }

      // If it's a modal and it's hidden via CSS, all children are hidden
      const modalRect = node.getBoundingClientRect();
      const modalStyle = window.getComputedStyle(node);
      if (
        modalStyle.display === "none" ||
        modalStyle.visibility === "hidden" ||
        parseFloat(modalStyle.opacity) === 0 ||
        !hasSize(modalRect)
      ) {
        return false;
      }
    }

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
    'input[type="date" i]',
    'input[type="datetime-local" i]',
    'input[type="month" i]',
    'input[type="time" i]',
    'input[type="week" i]',
    'input[type="email" i]',
    'input[type="password" i]',
    'input[type="tel" i]',
    'input[type="url" i]',
    'input[type="number" i]',
    "textarea",
  ].join(",");

  const results = new Set<HTMLInputElement | HTMLTextAreaElement>();

  function tryAddElement(el: Element) {
    const parentDiv = el.closest('div[id*="byteseal" i]');
    if (parentDiv) {
      return;
    }
    const tag = el.tagName.toLowerCase();
    if (tag === "input") {
      const input = el as HTMLInputElement;
      const inputType = (input.getAttribute("type") || "").toLowerCase();
      // Exclude button-like and hidden inputs, but include text-like inputs (including invalid types like "textfield")
      // Include date inputs for registration forms (DOB, etc.)
      const excludedTypes = [
        "button",
        "submit",
        "reset",
        "checkbox",
        "radio",
        "file",
        "image",
        "hidden",
        "range",
        "color",
      ];
      if (!excludedTypes.includes(inputType)) {
        results.add(input);
      }
    } else if (tag === "textarea") {
      results.add(el as HTMLTextAreaElement);
    }
  }

  document.querySelectorAll(selectors).forEach((el) => tryAddElement(el));
  // Also query all inputs to catch invalid/non-standard types (like "textfield")
  document.querySelectorAll("input").forEach((el) => tryAddElement(el));

  for (const el of walkTree(document)) {
    const host = el as HTMLElement;
    if (host.shadowRoot) {
      host.shadowRoot
        .querySelectorAll(selectors)
        .forEach((node) => tryAddElement(node));
      host.shadowRoot
        .querySelectorAll("input")
        .forEach((node) => tryAddElement(node));
    }
  }
  console.log("results of candidate", results);
  return Array.from(results);
}

function collectCandidatesIFrame(): (HTMLInputElement | HTMLTextAreaElement)[] {
  const selectors = [
    "input:not([type])",
    'input[type="text" i]',
    'input[type="search" i]',
    'input[type="date" i]',
    'input[type="datetime-local" i]',
    'input[type="month" i]',
    'input[type="time" i]',
    'input[type="week" i]',
    'input[type="email" i]',
    'input[type="password" i]',
    'input[type="tel" i]',
    'input[type="url" i]',
    'input[type="number" i]',
    "textarea",
  ].join(",");

  const results = new Set<HTMLInputElement | HTMLTextAreaElement>();

  function tryAddElement(el: Element) {
    const tag = el.tagName.toLowerCase();
    if (tag === "input") {
      const input = el as HTMLInputElement;
      const inputType = (input.getAttribute("type") || "").toLowerCase();
      // Exclude button-like and hidden inputs, but include text-like inputs (including invalid types like "textfield")
      // Include date inputs for registration forms (DOB, etc.)
      const excludedTypes = [
        "button",
        "submit",
        "reset",
        "checkbox",
        "radio",
        "file",
        "image",
        "hidden",
        "range",
        "color",
      ];
      if (!excludedTypes.includes(inputType)) {
        results.add(input);
      }
    } else if (tag === "textarea") {
      results.add(el as HTMLTextAreaElement);
    }
  }

  function findInputsInFrames(win: Window): Element[] {
    const collected: Element[] = [];

    for (let i = 0; i < win.frames.length; i++) {
      const frameWin = win.frames[i];
      try {
        const doc = frameWin.document;
        if (doc.querySelector('div[id*="byteseal_floatdiv"]')) {
          continue;
        }

        const inputs = doc.querySelectorAll(selectors);
        collected.push(...Array.from(inputs));
        // Also query all inputs to catch invalid/non-standard types (like "textfield")
        const allInputs = doc.querySelectorAll("input");
        collected.push(...Array.from(allInputs));

        collected.push(...findInputsInFrames(frameWin));
      } catch (err) {
        sendLogtoBack({
          message:
            "Unable to access frame: " +
            (err instanceof Error ? err.message : JSON.stringify(err)),
          level: "warning",
        });
      }
    }

    return collected;
  }

  const frameInputs = findInputsInFrames(window);
  frameInputs.forEach((el) => tryAddElement(el));

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

function getAriaLabelTextNew(input: HTMLElement): string {
  const ariaLabel = input.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  const labelledBy = input.getAttribute("aria-labelledby");
  if (labelledBy) {
    return labelledBy
      .split(/\s+/)
      .map((id) => document.getElementById(id))
      .filter(Boolean)
      .map((el) => (el ? el.innerText.trim() : ""))
      .filter(Boolean)
      .join(" ");
  }
  return "";
}
const getRoleFromParentElements = (item: {
  input: HTMLInputElement | HTMLTextAreaElement;
}): string => {
  console.log("item", item);
  let parent = item.input.parentElement;
  console.log("parent", parent);
  // Traverse up to 3 parent elements (adjust depth as needed)
  for (let i = 0; i < 3 && parent; i++) {
    // Check for a label element and its inner span or text
    const labelElement = parent.querySelector("label");
    let labelText = labelElement ? labelElement.textContent : "";

    // If label text is empty, check if the label contains a span and get the span text
    if (!labelText && labelElement) {
      const spanInLabel = labelElement.querySelector("span");
      labelText = spanInLabel ? spanInLabel.textContent : "";
    }

    // Check if there are other span elements inside the parent (outside label)
    const nestedLabelText = parent.querySelector("span")?.textContent || "";

    // Combine all text to create a broader check (to include both label and span elements)
    const parentText = `${labelText} ${nestedLabelText}`.toLowerCase();

    // Add classes and roles for more context
    const parentClass = parent.getAttribute("class") || "";
    const parentRole = parent.getAttribute("role") || "";

    const fullText = `${parentText} ${parentClass} ${parentRole}`.toLowerCase();
    console.log("fullText", fullText);

    // Check for common fields like email, phone, address, etc.
    if (fullText.includes("email")) {
      return "email";
    }
    if (fullText.includes("mobile") || fullText.includes("phone")) {
      return "phone";
    }
    if (fullText.includes("address")) {
      return "address";
    }
    if (fullText.includes("first name")) {
      return "firstname";
    }
    if (fullText.includes("last name")) {
      return "lastname";
    }
    if (fullText.includes("name")) {
      return "name";
    }

    // Move to the next parent level
    parent = parent.parentElement;
  }

  return "unknown"; // No match found after checking parent elements
};
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

function getLabelTextNew(input: HTMLElement): string {
  if (input.id) {
    const lab = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    if (lab) return (lab as HTMLElement).innerText.trim();
  }
  const wrapper = input.closest("label");
  if (wrapper) {
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
  label: string,
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

  if (
    textToCheck.includes("password") ||
    textToCheck.includes("pwd") ||
    textToCheck.includes("pass")
  )
    return "password";
  if (textToCheck.includes("email") || textToCheck.includes("mail"))
    return "email";
  if (
    textToCheck.includes("user") ||
    textToCheck.includes("usr") ||
    textToCheck.includes("login") ||
    textToCheck.includes("account")
  )
    return "username";
  if (
    textToCheck.includes("phone") ||
    textToCheck.includes("number") ||
    textToCheck.includes("tel") ||
    textToCheck.includes("mobile") ||
    textToCheck.includes("telephone")
  )
    return "phone";
  if (textToCheck.includes("address")) return "address";
  return "unknown";
}

export function classifyInputV2(
  item: {
    outerHTMLInput: string | null;
    outerHTMLLabel: string | null;
    outerHTMLAria: string | null;
    input: HTMLInputElement | HTMLTextAreaElement;
  },
  data: {
    username?: string;
    email?: string;
    password?: string;
    phone?: string;
    address?: string;
  },
): string {
  const label = (item?.outerHTMLLabel || "").toLowerCase();
  const aria = (item?.outerHTMLAria || "").toLowerCase();
  const placeholder = (
    item?.input?.getAttribute("placeholder") || ""
  ).toLowerCase();
  const name = (item?.input?.getAttribute("name") || "").toLowerCase();
  const id = (item?.input?.getAttribute("id") || "").toLowerCase();
  const type = (item?.input?.getAttribute("type") || "").toLowerCase();

  const roleKeywords = {
    username: ["username", "user", "usr", "login", "signin"],
    name: [
      "name",
      "firstname",
      "lastname",
      "fullname",
      "fname",
      "lname",
      "first name",
      "last name",
      "full name",
    ],
    email: ["email", "e-mail", "mail", "email address", "primary email"],
    password: ["password", "pwd", "pass"],
    phone: ["phone", "mobile", "tel", "contact"],
    address: ["address", "location", "street", "city", "zip"],
  };

  const fields = [label, aria, placeholder, name, id, type];
  console.log("fields", fields);
  // Step 1
  let expectedRole = "unknown";
  for (const field of fields) {
    for (const role of Object.keys(roleKeywords) as Array<
      keyof typeof roleKeywords
    >) {
      if (
        roleKeywords[role].some((keyword: string) => field.includes(keyword))
      ) {
        expectedRole = role;
        break;
      }
    }
    if (expectedRole !== "unknown") break;
  }
  console.log("expectedRole", expectedRole);
  // If expected email but no email in data, check if it's actually phone
  if (
    expectedRole === "email" &&
    !data.email &&
    data.username &&
    !isEmailFormat(data.username)
  ) {
    for (const field of fields) {
      if (
        roleKeywords.phone.some((keyword: string) => field.includes(keyword))
      ) {
        expectedRole = "phone";
        break;
      }
    }
  }

  console.log("Step 2");
  // Step 2
  if (
    expectedRole === "email" &&
    !data.email &&
    data.username &&
    isEmailFormat(data.username)
  ) {
    if (type && (type === "text" || type === "email") && data.email) {
      return "email";
    }
    return "username";
  }

  if (expectedRole !== "unknown" && !data[expectedRole as keyof typeof data]) {
    if (
      roleKeywords?.phone?.includes(label) ||
      roleKeywords?.phone?.includes(aria) ||
      roleKeywords?.phone?.includes(placeholder)
    ) {
      console.log("expectedRole123", placeholder);
      console.log("expectedRole12", expectedRole);
      return "phone";
    }
  }
  return expectedRole;
}

function isEmailFormat(value: string) {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const inputData: {
  outerHTMLInput: string | null;
  outerHTMLLabel: string | null;
  outerHTMLAria: string | null;
}[] = [];
export const inputDataWithElement: {
  outerHTMLInput: string | null;
  outerHTMLLabel: string | null;
  outerHTMLAria: string | null;
  input: HTMLInputElement | HTMLTextAreaElement;
}[] = [];

// Clean up stale entries from inputDataWithElement (elements no longer in DOM or hidden)
const cleanupInputDataWithElement = () => {
  const beforeLength = inputDataWithElement.length;
  console.log("beforeLength", beforeLength);
  // Filter out elements that are no longer in DOM or are hidden
  const valid = inputDataWithElement.filter((item) => {
    if (!document.contains(item.input)) {
      return false;
    }
    return isVisibleDeep(item.input);
  });

  // Only update if there were changes
  if (valid.length !== beforeLength) {
    inputDataWithElement.length = 0;
    inputDataWithElement.push(...valid);
    sendLogtoBack({
      message: `Cleaned up inputDataWithElement: ${beforeLength} -> ${valid.length} entries`,
      level: "info",
    });
  }
};

console.log("discoverdfields in function", discoveredFields);
// Discover and auto-fill
function discoverAndFillInputs(initial: boolean = false) {
  try {
    const currentFormSignature = getFormSignature();
    console.log("currentFormSignature", currentFormSignature);
    const formChanged = currentFormSignature !== lastFormSignature;

    if (formChanged && !initial) {
      sendLogtoBack({
        message: "Form signature changed - likely SPA navigation",
        level: "info",
        object: {
          oldSignature: lastFormSignature?.substring(0, 100),
          newSignature: currentFormSignature?.substring(0, 100),
        },
      });

      // Notify all callbacks about form change
      formChangeCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          sendLogtoBack({
            message: "Error in form change callback",
            level: "error",
            object: {
              error:
                error instanceof Error ? error.message : JSON.stringify(error),
            },
          });
        }
      });
    }

    lastFormSignature = currentFormSignature;

    // Store existing fields before clearing (preserve if discovery fails)
    const existingFields = [...discoveredFields];
    const newDiscoveredFields: Array<{
      name: string;
      value: string;
      role: string;
      input: HTMLInputElement | HTMLTextAreaElement;
    }> = [];

    // Filter both regular and iframe candidates by visibility
    let candidates = [
      ...collectCandidates().filter(isVisibleDeep),
      ...collectCandidatesIFrame().filter(isVisibleDeep),
    ];

    sendLogtoBack({
      message: "Starting field discovery",
      level: "info",
      object: {
        candidateCount: candidates.length,
        existingFieldCount: existingFields.length,
        documentReadyState: document.readyState,
      },
    });

    // Also explicitly check for fields inside visible modals (in case they were missed)
    // This ensures fields in modals that just became visible are discovered
    try {
      const allModals = document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]',
      );
      let foundModalFields = 0;
      allModals.forEach((modal) => {
        if (modal instanceof Element) {
          // Check if modal is visible: not hidden, aria-hidden is not "true", and has display != none
          const ariaHidden = modal.getAttribute("aria-hidden");
          const isAriaVisible = ariaHidden === "false" || ariaHidden === null;
          const isNotHidden = !modal.hasAttribute("hidden");
          const style = window.getComputedStyle(modal);
          const isDisplayVisible =
            style.display !== "none" && style.visibility !== "hidden";

          // Modal is visible if: (aria-hidden is false/null AND not hidden attribute AND display is not none)
          if (
            isAriaVisible &&
            isNotHidden &&
            isDisplayVisible &&
            isVisibleDeep(modal)
          ) {
            // Modal is visible, get all inputs inside it
            const modalInputs = modal.querySelectorAll(
              "input, textarea, select",
            );
            modalInputs.forEach((input) => {
              if (
                input instanceof HTMLInputElement ||
                input instanceof HTMLTextAreaElement ||
                input instanceof HTMLSelectElement
              ) {
                // Check if already in candidates
                const alreadyIncluded = candidates.some((c) => c === input);
                // Double-check visibility (parent modal is visible, but input itself might have hidden parent)
                if (!alreadyIncluded && isVisibleDeep(input)) {
                  candidates.push(
                    input as HTMLInputElement | HTMLTextAreaElement,
                  );
                  foundModalFields++;
                }
              }
            });

            if (modalInputs.length > 0) {
              sendLogtoBack({
                message: `Found ${modalInputs.length} inputs in visible modal, added ${foundModalFields} new fields`,
                level: "info",
                object: {
                  modalId:
                    modal.id || String(modal.className || "").substring(0, 30),
                  ariaHidden,
                  display: style.display,
                  totalInputs: modalInputs.length,
                  addedFields: foundModalFields,
                },
              });
            }
          }
        }
      });
    } catch (err) {
      sendLogtoBack({
        message:
          "Error checking visible modals for fields: " +
          (err instanceof Error ? err.message : JSON.stringify(err)),
        level: "error",
      });
    }

    inputData.length = 0;
    inputDataWithElement.length = 0;
    console.log("candidates", candidates);
    sendLogtoBack({
      message: "Processing candidates for discovery",
      level: "info",
      object: {
        totalCandidates: candidates.length,
        documentReadyState: document.readyState,
        bodyExists: !!document.body,
        bodyChildren: document.body?.children.length || 0,
      },
    });

    let visibleCount = 0;
    let hiddenCount = 0;
    for (const input of candidates) {
      // Double-check visibility before adding (in case DOM changed between collection and processing)
      if (!isVisibleDeep(input)) {
        hiddenCount++;
        continue;
      }
      visibleCount++;

      const label = getLabelText(input);
      console.log("label", label);
      const labelNew = getLabelTextNew(input);
      const ariaLabelNew = getAriaLabelTextNew(input);
      inputData.push({
        outerHTMLInput: input.outerHTML || null,
        outerHTMLLabel: labelNew || null,
        outerHTMLAria: ariaLabelNew || null,
      });
      inputDataWithElement.push({
        outerHTMLInput: input.outerHTML || null,
        outerHTMLLabel: labelNew || null,
        outerHTMLAria: ariaLabelNew || null,
        input,
      });

      let role = classifyInput(input as HTMLInputElement, label);
      if (role === "unknown") {
        role = getRoleFromParentElements({ input });
        console.log("role", role);
      }
      const name =
        input.name ||
        input.id ||
        label ||
        getAriaLabelText(input) ||
        input.getAttribute("placeholder") ||
        "unknown";

      newDiscoveredFields.push({
        name,
        value: (input as HTMLInputElement).value,
        role,
        input,
      });
    }

    sendLogtoBack({
      message: "Candidate processing complete",
      level: "info",
      object: {
        totalCandidates: candidates.length,
        visibleCount,
        hiddenCount,
        discoveredCount: newDiscoveredFields.length,
      },
    });

    // Only update discoveredFields if we found new fields, otherwise preserve existing
    if (newDiscoveredFields.length > 0) {
      console.log("newDiscoveredFields", newDiscoveredFields);
      discoveredFields.length = 0;
      discoveredFields.push(...newDiscoveredFields);
      sendLogtoBack({
        message: "Discovered new fields",
        level: "info",
        object: {
          newFieldCount: newDiscoveredFields.length,
          totalFields: discoveredFields.length,
        },
      });
    } else if (existingFields.length === 0) {
      // Only clear if we had no existing fields and found none (fresh start)
      discoveredFields.length = 0;
      sendLogtoBack({
        message: "No fields discovered and no existing fields to preserve",
        level: "warning",
        object: {
          candidateCount: candidates.length,
          documentReadyState: document.readyState,
        },
      });
    } else {
      // Preserve existing fields since we didn't find new ones
      sendLogtoBack({
        message: "No new fields discovered, preserving existing fields",
        level: "info",
        object: {
          preservedFieldCount: existingFields.length,
          candidateCount: candidates.length,
        },
      });
    }

    // console.log(`${!initial ? 'MutationObserver - ' : ''}Discovered fields:`, discoveredFields);
    console.log("discoveredFields2", discoveredFields);
    sendLogtoBack({
      message: "Final discovered fields count: " + discoveredFields.length,
      level: "info",
    });
    const requiredFieldsArray = discoveredFields.filter(
      (item) => item?.role !== "unknown",
    );
    requiredFields = requiredFieldsArray;

    // console.log(`${!initial ? 'MutationObserver - ' : ''}Required Fields: `, requiredFieldsArray);
    sendLogtoBack({
      message: "Required Fields: " + requiredFieldsArray.length,
      level: "info",
    });
  } catch (err) {
    // console.log('Error in discoverAndFillInputs: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
    sendLogtoBack({
      message:
        "Error in discoverAndFillInputs: " +
        (err instanceof Error ? err.message : JSON.stringify(err)),
      level: "error",
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

// Prevent infinite loops - track last discovery time and discovered elements
let lastDiscoveryTime = 0;
let lastDiscoveredInputCount = 0;
let isDiscovering = false;

const DISCOVERY_COOLDOWN = 1000; // Minimum 1 second between discoveries
const MIN_INPUT_CHANGE = 1; // Only trigger if at least 1 new input appears
console.log("debouncedDiscover", isDiscovering);
const debouncedDiscover = debounce(() => {
  console.log("debouncedDiscover before", isDiscovering);
  if (isDiscovering) {
    return; // Already discovering, skip
  }

  const now = Date.now();
  const timeSinceLastDiscovery = now - lastDiscoveryTime;

  // Check if enough time has passed
  if (timeSinceLastDiscovery < DISCOVERY_COOLDOWN) {
    return; // Too soon, skip
  }

  // Check if input count actually changed
  const currentInputCount = document.querySelectorAll(
    "input, textarea, select",
  ).length;
  const inputCountChange = currentInputCount - lastDiscoveredInputCount;

  if (
    Math.abs(inputCountChange) < MIN_INPUT_CHANGE &&
    lastDiscoveredInputCount > 0
  ) {
    return; // No significant change, skip
  }

  isDiscovering = true;
  console.log("isDiscovering", isDiscovering);
  lastDiscoveryTime = now;
  lastDiscoveredInputCount = currentInputCount;

  try {
    discoverAndFillInputs(false);
  } finally {
    // Reset flag after a delay to allow discovery to complete
    setTimeout(() => {
      isDiscovering = false;
    }, 500);
    console.log("isDiscovering after", isDiscovering);
  }
}, 500); // Increased debounce to 500ms

const debouncedAutoFillPending = debounce(autoFillIfPending, 500);

// Track if we've seen this mutation pattern before (prevent loops)
// Use Map to store timestamps for TTL cleanup
let recentMutations = new Map<string, number>();
const MUTATION_MEMORY_SIZE = 50;
const MUTATION_MEMORY_TTL = 2000; // 2 seconds (reduced to allow faster re-detection)

// Track visibility state of modals to detect transitions
let modalVisibilityState = new Map<Element, boolean>();

// Clean up old mutations based on TTL
const cleanupOldMutations = () => {
  const now = Date.now();
  for (const [signature, timestamp] of recentMutations.entries()) {
    if (now - timestamp > MUTATION_MEMORY_TTL) {
      recentMutations.delete(signature);
    }
  }
  // Also enforce size limit
  if (recentMutations.size > MUTATION_MEMORY_SIZE) {
    const entries = Array.from(recentMutations.entries()).sort(
      (a, b) => a[1] - b[1],
    );
    const toRemove = entries.slice(0, entries.length - MUTATION_MEMORY_SIZE);
    toRemove.forEach(([sig]) => recentMutations.delete(sig));
  }
};

const getMutationSignature = (
  mutation: MutationRecord,
  includeVisibility: boolean = false,
): string => {
  if (mutation.type === "childList") {
    const added = Array.from(mutation.addedNodes)
      .map((n) =>
        n instanceof Element
          ? `${n.tagName}.${String(n.className || "").substring(0, 20)}`
          : "",
      )
      .join(",");
    const removed = Array.from(mutation.removedNodes)
      .map((n) =>
        n instanceof Element
          ? `${n.tagName}.${String(n.className || "").substring(0, 20)}`
          : "",
      )
      .join(",");
    return `childList:${added}:${removed}`;
  } else if (mutation.type === "attributes") {
    const target = mutation.target as Element;
    const attrName = mutation.attributeName || "unknown";
    const visibility = includeVisibility
      ? `:${isVisibleDeep(target) ? "visible" : "hidden"}`
      : "";
    return `attr:${attrName}:${target.tagName}:${String(target.className || "").substring(0, 20)}${visibility}`;
  }
  return "";
};

// Get a signature for "added" mutations (used to clear cache when modal is removed)
const getAddedSignature = (node: Element): string => {
  const tagName = node.tagName || "";
  const className = String(node.className || "").substring(0, 20);
  return `added:${tagName}.${className}`;
};

const observer = new MutationObserver((mutations) => {
  // Clean up old mutations first
  cleanupOldMutations();

  let shouldTrigger = false;
  let hasSignificantChange = false;

  for (const mutation of mutations) {
    // Skip if this is our own extension's changes
    const target = mutation.target as Element;
    if (target?.closest?.('div[id*="byteseal" i]')) {
      continue; // Skip our own elements
    }

    if (mutation.type === "childList") {
      // Check if any added node contains form inputs or is a modal
      if (mutation.addedNodes.length > 0) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof Element) {
            const hasFormInputs =
              node.querySelector?.("input, textarea, select") ||
              node.matches?.("input, textarea, select");
            const isModal = node.matches?.(
              '[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]',
            );

            if (hasFormInputs || isModal) {
              const signature = getMutationSignature(mutation);
              console.log("signature", signature);

              // Initialize visibility state for this modal
              const isVisible = isVisibleDeep(node);
              modalVisibilityState.set(node, isVisible);

              // Check if we've seen this exact mutation recently
              if (!recentMutations.has(signature)) {
                recentMutations.set(signature, Date.now());
                // Store the "added" signature for this node so we can clear it when removed
                const addedSig = getAddedSignature(node);
                recentMutations.set(addedSig, Date.now());

                hasSignificantChange = true;
                shouldTrigger = true;
                sendLogtoBack({
                  message:
                    "MutationObserver: Detected form/modal element added",
                  level: "info",
                  object: {
                    isModal: !!isModal,
                    hasFormInputs: !!hasFormInputs,
                    isVisible,
                  },
                });
                break;
              }
            }
          }
        }
      }

      // Check if any removed node was a modal or contained form inputs
      if (mutation.removedNodes.length > 0) {
        for (const node of Array.from(mutation.removedNodes)) {
          if (node instanceof Element) {
            const hasFormInputs =
              node.querySelector?.("input, textarea, select") ||
              node.matches?.("input, textarea, select");
            const isModal = node.matches?.(
              '[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]',
            );

            if (hasFormInputs || isModal) {
              const signature = getMutationSignature(mutation);
              console.log("signature - removed", signature);

              // Remove from visibility state tracking
              modalVisibilityState.delete(node);

              // Clear signatures related to this modal so it can be detected again when added back
              const addedSig = getAddedSignature(node);
              const nodeClass = String(node.className || "").substring(0, 20);
              const nodeTag = node.tagName || "";
              const modalIdentifier = `${nodeTag}.${nodeClass}`;

              // Clear all signatures that match this modal being added
              // When modal is added, signature is: childList:MODAL_IDENTIFIER: (added nodes, empty removed part)
              for (const [sig] of recentMutations.entries()) {
                if (
                  sig.startsWith("childList:") &&
                  sig.includes(modalIdentifier)
                ) {
                  const parts = sig.split(":");
                  // Check if it's an "added" pattern: childList:MODAL: (where removed part is empty)
                  if (
                    parts.length >= 3 &&
                    parts[1].includes(modalIdentifier) &&
                    (parts[2] === "" || !parts[2])
                  ) {
                    recentMutations.delete(sig);
                  }
                }
                // Also clear stored "added" signatures
                if (
                  sig === addedSig ||
                  sig.includes(`added:${modalIdentifier}`)
                ) {
                  recentMutations.delete(sig);
                }
              }

              // Check if we've seen this exact removal mutation recently
              if (!recentMutations.has(signature)) {
                recentMutations.set(signature, Date.now());

                hasSignificantChange = true;
                shouldTrigger = true;
                sendLogtoBack({
                  message:
                    "MutationObserver: Detected form/modal element removed - re-discovering fields",
                  level: "info",
                  object: {
                    isModal: !!isModal,
                    hasFormInputs: !!hasFormInputs,
                  },
                });
                break;
              }
            }
          }
        }
      }
    }

    // Check for attribute changes that might show/hide modals
    if (mutation.type === "attributes") {
      const attrName = mutation.attributeName;
      if (
        attrName &&
        (attrName === "style" ||
          attrName === "class" ||
          attrName === "hidden" ||
          attrName === "aria-hidden")
      ) {
        // Check if target itself is a modal/form
        const targetHasFormInputs =
          target.querySelector?.("input, textarea, select") ||
          target.matches?.("input, textarea, select");
        const targetIsModal = target.matches?.(
          '[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]',
        );

        // Special handling for aria-hidden changes: when it changes to "false", modal is becoming visible
        if (attrName === "aria-hidden") {
          const ariaHiddenValue = target.getAttribute("aria-hidden");
          const isBecomingVisible =
            ariaHiddenValue === "false" || ariaHiddenValue === null;

          if (isBecomingVisible && targetIsModal) {
            sendLogtoBack({
              message:
                "Detected aria-hidden change to false on modal - forcing discovery",
              level: "info",
              object: {
                elementId:
                  target.id || String(target.className || "").substring(0, 30),
                ariaHidden: ariaHiddenValue,
                hasFormInputs: !!targetHasFormInputs,
              },
            });

            // Force immediate discovery for this modal
            if (!isDiscovering) {
              lastDiscoveryTime = 0;
              lastDiscoveredInputCount = 0;
              setTimeout(() => {
                if (!isDiscovering) {
                  discoverAndFillInputs(false);
                  autoFillIfPending();
                }
              }, 300); // Slightly longer delay to ensure DOM is fully ready
            }
          }
        }

        // Also check for modals/forms in descendants (handles cases where parent changes affect child modals)
        const descendantModals = target.querySelectorAll?.(
          '[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]',
        );

        // Check if any ancestor is a modal (handles parent/grandparent with same ID cases)
        let ancestorModal: Element | null = null;
        let current: Element | null = target;
        while (current && current !== document.documentElement) {
          if (
            current.matches?.(
              '[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]',
            )
          ) {
            ancestorModal = current;
            break;
          }
          current = current.parentElement;
        }

        // Collect all elements to check (target, descendants, ancestors)
        const elementsToCheck: Array<{
          element: Element;
          isModal: boolean;
          hasFormInputs: boolean;
        }> = [];

        if (targetHasFormInputs || targetIsModal) {
          elementsToCheck.push({
            element: target,
            isModal: targetIsModal,
            hasFormInputs: !!targetHasFormInputs,
          });
        }

        if (descendantModals && descendantModals.length > 0) {
          descendantModals.forEach((modal) => {
            const hasInputs =
              modal.querySelector?.("input, textarea, select") ||
              modal.matches?.("input, textarea, select");
            elementsToCheck.push({
              element: modal,
              isModal: true,
              hasFormInputs: !!hasInputs,
            });
          });
        }

        if (ancestorModal) {
          const hasInputs =
            ancestorModal.querySelector?.("input, textarea, select") ||
            ancestorModal.matches?.("input, textarea, select");
          elementsToCheck.push({
            element: ancestorModal,
            isModal: true,
            hasFormInputs: !!hasInputs,
          });
        }

        // Check each element for visibility changes
        for (const { element, isModal, hasFormInputs } of elementsToCheck) {
          const isCurrentlyVisible = isVisibleDeep(element);
          const previousVisible = modalVisibilityState.get(element);

          // Only trigger if visibility actually changed (transition detected)
          const visibilityChanged =
            previousVisible !== undefined &&
            previousVisible !== isCurrentlyVisible;

          // Update visibility state
          modalVisibilityState.set(element, isCurrentlyVisible);

          // Clean up old visibility states (remove elements no longer in DOM)
          if (!document.contains(element)) {
            modalVisibilityState.delete(element);
          }

          // Trigger when:
          // 1. Modal/form becomes visible (hidden -> visible transition)
          // 2. Modal/form becomes hidden (visible -> hidden transition)
          // 3. First time we see it and it's visible
          if (hasFormInputs || isModal) {
            const shouldTriggerForThis =
              visibilityChanged ||
              (previousVisible === undefined && isCurrentlyVisible);

            if (shouldTriggerForThis) {
              // Include visibility in signature to make it unique, and include element identifier
              // Use a combination of tag, id, class, and position to handle duplicate IDs
              const elementTag = element.tagName || "";
              const elementId = element.id || "";
              const elementClass = String(element.className || "").substring(
                0,
                30,
              );
              // Get a unique path identifier (handles duplicate IDs by including parent info)
              let pathIdentifier = elementTag;
              if (elementId) pathIdentifier += `#${elementId}`;
              if (elementClass)
                pathIdentifier += `.${elementClass.split(" ")[0]}`;
              // Add parent info if ID exists (helps distinguish duplicate IDs)
              if (elementId && element.parentElement) {
                const parentId = element.parentElement.id || "";
                const parentTag = element.parentElement.tagName || "";
                if (parentId || parentTag) {
                  pathIdentifier += `[parent:${parentTag}${parentId ? `#${parentId}` : ""}]`;
                }
              }
              // When modal visibility changes, clear related signatures FIRST so it can be detected again
              if (visibilityChanged) {
                const basePath = pathIdentifier;
                // Clear any signatures related to this modal (both visible and hidden)
                // This allows the modal to be detected again when it changes state
                const cleared: string[] = [];
                for (const [sig] of recentMutations.entries()) {
                  if (sig.includes(basePath)) {
                    recentMutations.delete(sig);
                    cleared.push(sig);
                  }
                }
                if (cleared.length > 0) {
                  sendLogtoBack({
                    message: `Cleared ${cleared.length} signature(s) for modal state change`,
                    level: "info",
                    object: {
                      clearedSignatures: cleared.map((s) =>
                        s?.substring(0, 80),
                      ),
                    },
                  });
                }
              }

              const signature = `${getMutationSignature(mutation, true)}:${pathIdentifier}:${isCurrentlyVisible ? "visible" : "hidden"}`;
              console.log(
                "signature",
                signature,
                "isVisible:",
                isCurrentlyVisible,
                "wasVisible:",
                previousVisible,
              );

              // Only trigger if we haven't seen this exact change recently
              // Note: We cleared related signatures above if visibility changed, so this should pass
              if (!recentMutations.has(signature)) {
                recentMutations.set(signature, Date.now());

                hasSignificantChange = true;
                shouldTrigger = true;

                // Clean up stale entries when visibility changes
                cleanupInputDataWithElement();

                // When modal becomes visible, force immediate discovery after DOM update
                // This ensures fields inside the modal are discovered
                if (isModal && isCurrentlyVisible && !isDiscovering) {
                  // Reset discovery flags to bypass cooldown
                  lastDiscoveryTime = 0;
                  lastDiscoveredInputCount = 0;

                  // Wait a bit for DOM to fully update, then force discovery
                  setTimeout(() => {
                    if (!isDiscovering) {
                      sendLogtoBack({
                        message: "Forcing discovery for newly visible modal",
                        level: "info",
                        object: {
                          elementId:
                            element.id ||
                            String(element.className || "").substring(0, 30),
                          modalHasInputs: hasFormInputs,
                        },
                      });
                      // Force discovery directly (bypasses debounce and cooldown)
                      discoverAndFillInputs(false);
                      autoFillIfPending();
                    }
                  }, 200); // 200ms delay to ensure DOM is ready
                }

                sendLogtoBack({
                  message: `MutationObserver: Detected visibility change on form/modal - ${isCurrentlyVisible ? "visible" : "hidden"} (was: ${previousVisible !== undefined ? (previousVisible ? "visible" : "hidden") : "unknown"})`,
                  level: "info",
                  object: {
                    isModal,
                    hasFormInputs,
                    isVisible: isCurrentlyVisible,
                    wasVisible: previousVisible,
                    elementId:
                      element.id ||
                      String(element.className || "").substring(0, 30),
                    isAncestor: element === ancestorModal,
                  },
                });
                break; // Only need to trigger once per mutation batch
              }
            }
          }
        }
      }
    }
  }

  if (shouldTrigger && !isDiscovering) {
    if (hasSignificantChange) {
      debouncedDiscover();
    }
    debouncedAutoFillPending();
  }
});

// Setup MutationObserver when DOM is ready
const setupObserver = () => {
  if (document.body) {
    console.log("observer", document.body);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class", "hidden", "aria-hidden"], // Only watch specific attributes
    });
    sendLogtoBack({
      message: "MutationObserver set up successfully",
      level: "info",
    });
  } else {
    sendLogtoBack({
      message: "document.body not available, retrying observer setup",
      level: "warning",
    });
    // Retry after a short delay
    setTimeout(setupObserver, 100);
  }
};

// Setup observer when DOM is ready
if (typeof document !== "undefined") {
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    setupObserver();
  } else {
    document.addEventListener("DOMContentLoaded", setupObserver);
    // Fallback: try immediately in case DOMContentLoaded already fired
    setTimeout(setupObserver, 50);
  }
}

// Scan for modals already in DOM and initialize their visibility state
const initializeModalVisibilityState = () => {
  try {
    const modals = document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], .modal, .dialog, dialog, [class*="modal"], [class*="dialog"]',
    );
    modals.forEach((modal) => {
      if (modal instanceof Element) {
        const isVisible = isVisibleDeep(modal);
        modalVisibilityState.set(modal, isVisible);
        sendLogtoBack({
          message: `Initialized modal visibility state: ${isVisible ? "visible" : "hidden"}`,
          level: "info",
          object: {
            elementId:
              modal.id || String(modal.className || "").substring(0, 30),
            isVisible,
          },
        });
      }
    });
  } catch (err) {
    sendLogtoBack({
      message:
        "Error initializing modal visibility state: " +
        (err instanceof Error ? err.message : JSON.stringify(err)),
      level: "error",
    });
  }
};

// Export function to manually trigger discovery (useful for SPA navigation)
export const reDiscoverFields = () => {
  sendLogtoBack({
    message: "Re-discovering fields after URL change",
    level: "info",
  });
  // Reset discovery flags to bypass cooldown
  lastDiscoveryTime = 0;
  lastDiscoveredInputCount = 0;
  isDiscovering = false;
  // Clear recent mutations to allow immediate discovery
  recentMutations.clear();
  // Re-initialize modal visibility state first
  initializeModalVisibilityState();
  // Use setTimeout to ensure DOM is ready, but also run immediately for fast pages
  const runDiscovery = () => {
    discoverAndFillInputs(true);
    autoFillIfPending();
  };
  // Run immediately
  runDiscovery();
  // Also run after a short delay to catch any late-loading elements
  setTimeout(runDiscovery, 100);
};
// Initialize input count and run initial discovery when DOM is ready
if (typeof document !== "undefined") {
  lastDiscoveredInputCount = document.querySelectorAll(
    "input, textarea, select",
  ).length;
  // Initialize modal visibility state on page load
  initializeModalVisibilityState();

  // Ensure DOM is ready before initial discovery
  const runInitialDiscovery = () => {
    const fieldCount = discoveredFields.length;
    sendLogtoBack({
      message: "Running initial field discovery",
      level: "info",
      object: { currentFieldCount: fieldCount },
    });
    discoverAndFillInputs(true);
    // Log after discovery to see if fields were found
    setTimeout(() => {
      const newFieldCount = discoveredFields.length;
      sendLogtoBack({
        message: "Initial discovery completed",
        level: "info",
        object: { discoveredFields: newFieldCount },
      });
    }, 100);
  };

  // Check if DOM is already ready
  if (
    document.readyState === "complete" ||
    document.readyState === "interactive"
  ) {
    // DOM is ready, run immediately
    runInitialDiscovery();
    // Also run after delays to catch late-loading elements (SPA, lazy-loaded forms, etc.)
    setTimeout(runInitialDiscovery, 200);
    setTimeout(runInitialDiscovery, 500);
    setTimeout(runInitialDiscovery, 1000);
  } else {
    // Wait for DOM to be ready
    document.addEventListener("DOMContentLoaded", () => {
      runInitialDiscovery();
      // Also run after delays to catch late-loading elements
      setTimeout(runInitialDiscovery, 200);
      setTimeout(runInitialDiscovery, 500);
      setTimeout(runInitialDiscovery, 1000);
    });
    // Fallback: if DOMContentLoaded already fired, run with delays
    setTimeout(runInitialDiscovery, 100);
    setTimeout(runInitialDiscovery, 300);
    setTimeout(runInitialDiscovery, 600);
  }
}

export const autofillContent = ({
  message,
  encrypted,
  usrpass,
}: {
  message: {
    data: {
      username?: string;
      email?: string;
      password?: string;
      phone?: string;
      address?: string;
    };
  };
  encrypted: CredentialsV1 | null;
  usrpass: string;
}) => {
  try {
    const discoveredFieldsNew: Array<{
      name: string;
      value: string;
      role: string;
      input: HTMLInputElement | HTMLTextAreaElement;
    }> = [];

    let missingRoles: string[] = [];

    if (inputData?.length > 0 && inputDataWithElement?.length > 0) {
      console.log("inputDataWithElement", inputDataWithElement);
      inputDataWithElement.forEach((item) => {
        let role = classifyInputV2(item, message?.data);
        console.log("before role", role);
        if (role === "unknown") {
          role = getRoleFromParentElements({ input: item?.input });
          if (
            role === "email" &&
            !message?.data?.email &&
            message?.data?.username &&
            isEmailFormat(message?.data?.username)
          ) {
            role = "username";
          }
          // If expected email but no email in data, check if it's actually phone
          if (
            role === "email" &&
            !message?.data?.email &&
            message?.data?.username &&
            !isEmailFormat(message?.data?.username)
          ) {
            let parent = item?.input?.parentElement;
            for (let i = 0; i < 3 && parent; i++) {
              const labelElement = parent.querySelector("label");
              let labelText = labelElement ? labelElement.textContent : "";
              if (!labelText && labelElement) {
                const spanInLabel = labelElement.querySelector("span");
                labelText = spanInLabel ? spanInLabel.textContent : "";
              }
              const nestedLabelText =
                parent.querySelector("span")?.textContent || "";
              const parentText =
                `${labelText} ${nestedLabelText}`.toLowerCase();
              const parentClass = parent.getAttribute("class") || "";
              const parentRole = parent.getAttribute("role") || "";
              const fullText =
                `${parentText} ${parentClass} ${parentRole}`.toLowerCase();

              if (
                fullText.includes("mobile") ||
                fullText.includes("phone") ||
                fullText.includes("tel") ||
                fullText.includes("contact")
              ) {
                role = "phone";
                break;
              }
              parent = parent.parentElement;
            }
          }
          console.log("role getRoleFromParentElements", role);
        }
        console.log("role classifyInputV2", role);
        console.log("role autofill content", role, item);
        discoveredFieldsNew.push({
          name: item?.input?.name || "",
          value: item?.input?.value || "",
          role,
          input: item?.input,
        });

        if (role !== "unknown") {
          if (!Object.keys(message?.data || {}).includes(role)) {
            missingRoles.push(role);
          }
        }
      });

      const fieldFilled: string[] = [];
      console.log("message data autofill content", message?.data);
      discoveredFieldsNew.forEach(({ role, input }) => {
        let val = "";
        if (role === "username") {
          fieldFilled.push("username");
          val = message?.data?.username || "";
        } else if (role === "email") {
          console.log("working email");
          fieldFilled.push("email");
          val = message?.data?.email || "";
        } else if (role === "password") {
          fieldFilled.push("password");
          val = message?.data?.password || "";
        } else if (role === "phone") {
          fieldFilled.push("phone");
          val = message?.data?.phone || "";
        } else if (role === "address") {
          fieldFilled.push("address");
          val = message?.data?.address || "";
        }
        console.log("fieldFilled", fieldFilled);
        console.log("val autofill content", val);
        if (val) {
          (input as HTMLInputElement).value = val;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          (input as HTMLElement).style.outline = "2px solid #3b82f6";
          (input as HTMLElement).style.borderColor = "#3b82f6";
        }

        if (
          (fieldFilled?.includes("username") &&
            !fieldFilled?.includes("password")) ||
          (fieldFilled?.includes("email") && !fieldFilled?.includes("password"))
        ) {
          console.log("working saveAutoFillSessionData");
          chrome.runtime.sendMessage({
            type: "saveAutoFillSessionData",
            data: {
              hostname,
              data: {
                status: "pending",
                fieldFilled,
                data: encrypted,
                usrpass,
                time: new Date().toISOString(),
              },
            },
          });
        }
        if (fieldFilled?.includes("password")) {
          chrome.runtime.sendMessage({
            type: "clearAutoFillSessionData",
            data: { hostname },
          });
        }
      });
      return { filledCount: fieldFilled.length, fields: fieldFilled };

      //   console.log('Fields Filled Successfully');
      sendLogtoBack({
        message: "Fields Filled Successfully",
        level: "success",
      });

      // let missingRoles: string[] = [];
      // discoveredFields.forEach((item) => {
      //     if (item?.role !== "unknown") {
      //         if (!Object.keys(message?.data || {}).includes(item?.role)) {
      //             missingRoles.push(item?.role);
      //         }
      //     }
      // });

      // if (missingRoles.length > 0) {

      //     console.log(
      //         "Discovered field and credential mismatch detected. Verifying with AI model. Missing roles:",
      //         missingRoles
      //     );
      //     sendLogtoBack({ message: "Discovered field and credential mismatch detected. Verifying with AI model. Missing roles: " + missingRoles.join(", "), level: "error" });

      //     // getInput(message, sendResponse, loggingEnabled);
      // } else {
      //     const fieldFilled: string[] = [];
      //     discoveredFields.forEach(({ role, input }) => {
      //         let val = "";
      //         if (role === "username") {
      //             fieldFilled.push("username");
      //             val = message?.data?.username || "";
      //         } else if (role === "email") {
      //             fieldFilled.push("email");
      //             val = message?.data?.email || "";
      //         } else if (role === "password") {
      //             fieldFilled.push("password");
      //             val = message?.data?.password || "";
      //         } else if (role === "phone") {
      //             fieldFilled.push("phone");
      //             val = message?.data?.phone || "";
      //         } else if (role === "address") {
      //             fieldFilled.push("address");
      //             val = message?.data?.address || "";
      //         }

      //         if (val) {
      //             (input as HTMLInputElement).value = val;
      //             input.dispatchEvent(new Event("input", { bubbles: true }));
      //             input.dispatchEvent(new Event("change", { bubbles: true }));
      //             (input as HTMLElement).style.outline = "3px solid orange";
      //         }

      //         if ((fieldFilled?.includes("username") && !fieldFilled?.includes("password")) || (fieldFilled?.includes("email") && !fieldFilled?.includes("password"))) {
      //             chrome.runtime.sendMessage({ type: 'saveAutoFillSessionData', data: { hostname, data: { status: "pending", fieldFilled, data: message?.data, time: new Date().toISOString() } } });
      //         }
      //         if (fieldFilled?.includes("password")) {
      //             chrome.runtime.sendMessage({
      //                 type: 'clearAutoFillSessionData',
      //                 data: { hostname }
      //             });
      //         }

      //     });

      //     console.log("Fields Filled Successfully");
      //     sendLogtoBack({ message: 'Fields Filled Successfully', level: 'success' });

      // }
    } else {
      //   console.log('xxxxxxxxxxxxxxxx No input fields found xxxxxxxxxxxxxxxxx');
      sendLogtoBack({ message: "No input fields found", level: "error" });
    }
  } catch (err) {
    // console.log('Error while filling fields: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
    sendLogtoBack({
      message:
        "Error while filling fields: " +
        (err instanceof Error ? err.message : JSON.stringify(err)),
      level: "error",
    });
  }
  return true;
};

let loggingEnabled = false;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  console.log("[AutofillFlow] Message received:", message?.type, message);
  if (message.type === "DEBUG_TOGGLE") {
    loggingEnabled = !!message.enabled;
    sendLogtoBack({ message: "Debug mode is enabled", level: "success" });
    sendResponse({ status: "success", toggleLogs: loggingEnabled });
    return true;
  }

  if (message.type === "GET_FORM_STATUS") {
    console.log("[AutofillFlow] GET_FORM_STATUS -> detectRegistrationForm");
    try {
      const registration = detectRegistrationForm();
      console.log(
        "[AutofillFlow] detectRegistrationForm result:",
        registration,
      );
      sendResponse({ status: "success", data: { registration } });
    } catch (err) {
      sendResponse({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
    return true;
  }

  if (message.type === "FILL_PERSONAL_INFO") {
    console.log(
      "[AutofillFlow] FILL_PERSONAL_INFO -> autofillRegistrationForm",
      {
        hasName: !!message?.data?.name,
        hasEmail: !!message?.data?.email,
        hasPhone: !!message?.data?.phone,
        hasDob: !!message?.data?.dob,
        additionalKeys: Object.keys(message?.data?.additionalFields || {}),
      },
    );
    try {
      setBubbleLoading(true);
      const result = autofillRegistrationForm(message.data);
      console.log("[AutofillFlow] autofillRegistrationForm result:", {
        success: result.success,
        filledCount: result.filled?.length || 0,
        filled: result.filled,
        hasAiPromise: !!result.aiPromise,
      });
      if (result.aiPromise) {
        console.log("[AutofillFlow] AI promise started");
        setBubbleTooltip("ai-running");
        result.aiPromise
          .catch(() => {
            sendLogtoBack({ message: "AI autofill failed.", level: "error" });
          })
          .finally(() => {
            setBubbleLoading(false);
            scheduleBubbleUpdate();
          });
      } else {
        setBubbleLoading(false);
      }
      sendResponse({
        status: result.success ? "success" : "stop",
        message: result.success
          ? "Personal info autofill completed"
          : "No fields filled",
      });
    } catch (err) {
      sendResponse({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
    return true;
  }

  if (message.type === "FILL_FIELDS") {
    console.log("[AutofillFlow] FILL_FIELDS -> autofillContent", {
      hasUsername: !!message?.data?.username,
      hasEmail: !!message?.data?.email,
      hasPassword: !!message?.data?.password,
      hasPhone: !!message?.data?.phone,
      hasAddress: !!message?.data?.address,
    });
    try {
      setBubbleLoading(true);
      autofillContent({
        message,
        encrypted: null,
        usrpass: "",
      });
      setTimeout(() => {
        setBubbleLoading(false);
      }, 500);
      console.log("[AutofillFlow] autofillContent done");
      sendResponse({
        status: "success",
        message: "Fields Filled Successfully",
      });
    } catch (err) {
      sendResponse({
        status: "error",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    }
    return true;
  }

  return false;
});

type BubbleTooltipMode =
  | "hidden"
  | "login-has-cred"
  | "login-no-cred"
  | "registration"
  | "ai-running"
  | "no-form"
  | "add-cred";

// Unused variables removed for refactor
let bubbleRoot: HTMLDivElement | null = null;
let bubbleTooltip: HTMLDivElement | null = null;
let bubbleTooltipHeader: HTMLDivElement | null = null;
let bubbleTooltipTitle: HTMLDivElement | null = null;
let bubbleTooltipClose: HTMLButtonElement | null = null;
let bubbleTooltipBack: HTMLButtonElement | null = null;
let bubbleTooltipText: HTMLDivElement | null = null;
let bubbleTooltipAction: HTMLButtonElement | null = null;
let bubbleTooltipAddCredForm: HTMLDivElement | null = null;
let bubbleAddUsernameInput: HTMLInputElement | null = null;
let bubbleAddPasswordInput: HTMLInputElement | null = null;
let bubbleSaveCredButton: HTMLButtonElement | null = null;

let bubbleState: { loading: boolean; tooltip: BubbleTooltipMode } = {
  loading: false,
  tooltip: "hidden",
};

let lastDetection = {
  login: false,
  registration: false,
  hasCredentials: false,
};

let updateTimer: number | null = null;

const ensureBubbleStyles = () => {
  if (document.getElementById("byteseal-bubble-style")) return;
  const style = document.createElement("style");
  style.id = "byteseal-bubble-style";
  style.textContent = `
  #byteseal-bubble-root {
    position: fixed;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 2147483647;
    display: flex !important;
    flex-direction: column;
    align-items: flex-end;
    gap: 12px;
    pointer-events: none;
    user-select: none;
    box-sizing: border-box;
  }
  #byteseal-bubble-container {
    background: rgba(15, 23, 42, 0.85);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 99px;
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .byteseal-bubble-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    overflow: visible;
  }
  .byteseal-bubble-btn:hover {
    transform: scale(1.08);
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
  }
  #byteseal-popup-open-btn {
    background: #1e293b;
  }
  #byteseal-modal-toggle-btn {
    background: linear-gradient(135deg, #3b82f6, #1d4ed8);
    box-shadow: 0 4px 14px 0 rgba(59, 130, 246, 0.39);
    opacity: 0;
    transform: scale(0.8);
    visibility: hidden;
    height: 0;
    margin-bottom: -12px;
    pointer-events: none;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  #byteseal-modal-toggle-btn.visible {
    opacity: 1;
    transform: scale(1);
    visibility: visible;
    height: 48px;
    margin-bottom: 0;
    pointer-events: auto;
  }
  .byteseal-bubble-btn img, .byteseal-bubble-btn svg {
    width: 24px;
    height: 24px;
    object-fit: contain;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }
  .byteseal-bubble-btn-label {
    position: absolute;
    right: 60px;
    top: 50%;
    transform: translateY(-50%) translateX(10px);
    background: rgba(15, 23, 42, 0.95);
    padding: 6px 12px;
    border-radius: 8px;
    color: white;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: all 0.2s ease;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: sans-serif;
  }
  .byteseal-bubble-btn:hover .byteseal-bubble-btn-label {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
  #byteseal-bubble-tooltip {
    position: absolute;
    right: 75px;
    bottom: 62px;
    width: 320px;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 0;
    color: #f1f5f9;
    font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
    font-size: 14px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    display: block;
    backdrop-filter: blur(20px);
    cursor: default;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    z-index: 2147483647;
  }
  #byteseal-bubble-tooltip.visible {
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transform: translateY(0) scale(1);
  }
  #byteseal-bubble-tooltip-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.03);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    border-top-left-radius: 20px;
    border-top-right-radius: 20px;
  }
  #byteseal-bubble-tooltip-body {
    padding: 24px 20px;
  }
  .byteseal-detection-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 8px;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    margin-bottom: 12px;
    letter-spacing: 0.05em;
  }
  .byteseal-detection-badge.login { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
  .byteseal-detection-badge.registration { background: rgba(139, 92, 246, 0.2); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3); }
  .byteseal-vault-status {
    font-size: 11px;
    color: #94a3b8;
    background: rgba(30, 41, 59, 0.8);
    padding: 10px 14px;
    border-radius: 12px;
    margin-bottom: 20px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .byteseal-vault-status b { color: #f1f5f9; }
  .byteseal-vault-status.match { border-left: 3px solid #10b981; }
  .byteseal-vault-status.no-match { border-left: 3px solid #f59e0b; }

  #byteseal-bubble-tooltip-title {
    flex: 1;
    font-weight: 700;
    font-size: 15px;
    color: #ffffff;
    letter-spacing: -0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  #byteseal-bubble-tooltip-close, .byteseal-back-btn {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #94a3b8;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
    padding: 0;
    flex-shrink: 0;
  }
  #byteseal-bubble-tooltip-close:hover, .byteseal-back-btn:hover {
    background: rgba(255, 255, 255, 0.1);
    color: #ffffff;
  }
  .byteseal-back-btn {
    margin-right: -4px;
  }
  #byteseal-bubble-tooltip-text {
    color: #94a3b8;
    line-height: 1.5;
    margin-bottom: 16px;
    font-size: 13px;
  }
  #byteseal-bubble-tooltip button:not(#byteseal-bubble-tooltip-close):not(.byteseal-back-btn) {
    width: 100%;
    background: linear-gradient(to right, #2563eb, #3b82f6);
    color: #ffffff;
    border: none;
    border-radius: 14px;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s;
    box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
    position: relative;
    overflow: hidden;
  }
  #byteseal-bubble-tooltip button:hover {
    background: linear-gradient(to right, #1d4ed8, #2563eb);
    box-shadow: 0 6px 20px rgba(37, 99, 235, 0.4);
    transform: translateY(-1px);
  }
  #byteseal-bubble-tooltip .byteseal-form input {
    width: 100%;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 10px 14px;
    color: white;
    font-size: 13px;
    margin-bottom: 12px;
    transition: all 0.2s;
  }
  #byteseal-bubble-tooltip .byteseal-form input:focus {
    outline: none;
    border-color: #3b82f6;
    background: rgba(15, 23, 42, 0.8);
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }
  #byteseal-status-container {
    animation: byteseal-fade-in 0.3s ease-out;
  }
  #byteseal-bubble-tooltip .status-step {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #94a3b8;
    margin-top: 8px;
    animation: byteseal-fade-in 0.3s ease-out;
  }
  #byteseal-bubble-tooltip .status-step.active {
    color: #60a5fa;
    font-weight: 600;
  }
  #byteseal-bubble-tooltip .status-step.success {
    color: #10b981;
  }
  #byteseal-bubble-tooltip .status-step.error {
    color: #ef4444;
  }
  #byteseal-bubble-tooltip .status-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }
  @keyframes byteseal-fade-in {
    from { opacity: 0; transform: translateY(5px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes byteseal-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  `;
  const head = document.head || document.documentElement;
  head.appendChild(style);
};

const ensureBubble = () => {
  if (bubbleRoot && document.body.contains(bubbleRoot)) return;

  ensureBubbleStyles();

  bubbleRoot = document.createElement("div");
  bubbleRoot.id = "byteseal-bubble-root";

  const bubbleContainer = document.createElement("div");
  bubbleContainer.id = "byteseal-bubble-container";

  // Popup Button (Always Visible)
  const popupBtn = document.createElement("div");
  popupBtn.className = "byteseal-bubble-btn";
  popupBtn.id = "byteseal-popup-open-btn";
  popupBtn.title = "Open AI AutoFill Vault";
  popupBtn.innerHTML = `
    <img src="${chrome.runtime.getURL("icons/icon48.png")}" alt="Vault">
    <div class="byteseal-bubble-btn-label">Open Vault</div>
  `;
  popupBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    try {
      chrome.runtime.sendMessage({ type: "OPEN_POPUP" });
    } catch (err) {}
  });

  // Modal Toggle Button (Only visible when form detected)
  const modalBtn = document.createElement("div");
  modalBtn.className = "byteseal-bubble-btn";
  modalBtn.id = "byteseal-modal-toggle-btn";
  modalBtn.innerHTML = `
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
    <div class="byteseal-bubble-btn-label">Quick Actions</div>
  `;
  modalBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (bubbleState.tooltip !== "hidden") {
      setBubbleTooltip("hidden");
    } else {
      const nextTooltip = lastDetection.registration
        ? "registration"
        : lastDetection.hasCredentials
          ? "login-has-cred"
          : "login-no-cred";
      setBubbleTooltip(nextTooltip);
    }
  });

  bubbleContainer.appendChild(modalBtn);
  bubbleContainer.appendChild(popupBtn);
  bubbleRoot.appendChild(bubbleContainer);

  bubbleTooltip = document.createElement("div");
  bubbleTooltip.id = "byteseal-bubble-tooltip";
  // Fix the auto-close bug by stopping propagation on the tooltip body
  bubbleTooltip.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  bubbleTooltipHeader = document.createElement("div");
  bubbleTooltipHeader.id = "byteseal-bubble-tooltip-header";

  const bubbleTooltipBody = document.createElement("div");
  bubbleTooltipBody.id = "byteseal-bubble-tooltip-body";

  bubbleTooltipTitle = document.createElement("div");
  bubbleTooltipTitle.id = "byteseal-bubble-tooltip-title";

  bubbleTooltipBack = document.createElement("button");
  bubbleTooltipBack.className = "byteseal-back-btn";
  bubbleTooltipBack.type = "button";
  bubbleTooltipBack.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>';

  bubbleTooltipClose = document.createElement("button");
  bubbleTooltipClose.id = "byteseal-bubble-tooltip-close";
  bubbleTooltipClose.type = "button";
  bubbleTooltipClose.setAttribute("aria-label", "Close tooltip");
  bubbleTooltipClose.innerHTML =
    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12"/><path d="M18 6l-12 12"/></svg>';

  bubbleTooltipText = document.createElement("div");
  bubbleTooltipText.id = "byteseal-bubble-tooltip-text";

  bubbleTooltipAction = document.createElement("button");
  bubbleTooltipAction.type = "button";

  bubbleTooltipAddCredForm = document.createElement("div");
  bubbleTooltipAddCredForm.id = "byteseal-bubble-add-cred-form";
  bubbleTooltipAddCredForm.className = "byteseal-form";
  bubbleTooltipAddCredForm.style.display = "none";

  bubbleAddUsernameInput = document.createElement("input");
  bubbleAddUsernameInput.type = "text";
  bubbleAddUsernameInput.placeholder = "Username or Email";

  bubbleAddPasswordInput = document.createElement("input");
  bubbleAddPasswordInput.type = "password";
  bubbleAddPasswordInput.placeholder = "Password";
  bubbleAddPasswordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveCredentialsFromBubble();
    }
  });

  bubbleSaveCredButton = document.createElement("button");
  bubbleSaveCredButton.id = "byteseal-save-cred-btn";
  bubbleSaveCredButton.type = "button";
  bubbleSaveCredButton.textContent = "Save Credentials";

  bubbleTooltipAddCredForm.appendChild(bubbleAddUsernameInput);
  bubbleTooltipAddCredForm.appendChild(bubbleAddPasswordInput);
  bubbleTooltipAddCredForm.appendChild(bubbleSaveCredButton);

  bubbleTooltipHeader.appendChild(bubbleTooltipBack);
  bubbleTooltipHeader.appendChild(bubbleTooltipTitle);
  bubbleTooltipHeader.appendChild(bubbleTooltipClose);

  bubbleTooltipBody.appendChild(bubbleTooltipText);
  bubbleTooltipBody.appendChild(bubbleTooltipAction);

  bubbleTooltipBody.appendChild(bubbleTooltipAddCredForm);

  bubbleTooltip.appendChild(bubbleTooltipHeader);
  bubbleTooltip.appendChild(bubbleTooltipBody);

  // Position tooltip relative to the container, not the button, to fix hover scale bug
  bubbleContainer.appendChild(bubbleTooltip);

  const host = document.body || document.documentElement;
  host.appendChild(bubbleRoot);
  updateBubbleUI();
};

const setBubbleLoading = (loading: boolean) => {
  bubbleState = { ...bubbleState, loading };
  updateBubbleUI();
};

const setBubbleTooltip = (tooltip: BubbleTooltipMode) => {
  bubbleState = { ...bubbleState, tooltip };
  updateBubbleUI();
};

const updateBubbleUI = () => {
  ensureBubble();
  if (!bubbleRoot || !bubbleTooltip) return;

  // Manage visibility of the Magic/Modal button
  // Manage visibility of the Magic/Modal button with animation
  const modalBtn = document.getElementById("byteseal-modal-toggle-btn");
  if (modalBtn) {
    const shouldShowModalBtn =
      lastDetection.login || lastDetection.registration;

    if (shouldShowModalBtn) {
      modalBtn.classList.add("visible");
    } else {
      modalBtn.classList.remove("visible");
      // If tooltip is visible but form is gone, hide tooltip
      if (bubbleState.tooltip !== "hidden") {
        setBubbleTooltip("hidden");
      }
    }
  }

  // Tooltip Visibility
  if (bubbleState.tooltip === "hidden") {
    bubbleTooltip.classList.remove("visible");
    return;
  } else {
    bubbleTooltip.classList.add("visible");
  }

  const setTooltipContent = ({
    title,
    text,
    type, // 'login' or 'registration'
    hasMatch, // boolean for vault status
    action,
    showForm,
    onBack,
  }: {
    title: string;
    text: string;
    type?: "login" | "registration";
    hasMatch?: boolean;
    action?: { label: string; onClick: () => void };
    showForm?: boolean;
    onBack?: () => void;
  }) => {
    if (bubbleTooltipTitle) bubbleTooltipTitle.textContent = title;

    // Clear text container
    if (bubbleTooltipText) {
      bubbleTooltipText.innerHTML = "";

      // Add Detection Badge
      if (type) {
        const badge = document.createElement("div");
        badge.className = `byteseal-detection-badge ${type}`;
        badge.textContent = `${type} Detected`;
        bubbleTooltipText.appendChild(badge);
      }

      // Add Vault Status
      if (type === "login") {
        const vaultStatus = document.createElement("div");
        vaultStatus.className = `byteseal-vault-status ${hasMatch ? "match" : "no-match"}`;
        vaultStatus.innerHTML = hasMatch
          ? "<b>Vault Status:</b> Found matching credentials"
          : "<b>Vault Status:</b> No matching credentials in vault";
        bubbleTooltipText.appendChild(vaultStatus);
      }

      // Add Main Text
      const textNode = document.createElement("div");
      textNode.innerHTML = text;
      bubbleTooltipText.appendChild(textNode);
    }

    if (bubbleTooltipBack) {
      if (onBack) {
        bubbleTooltipBack.style.display = "flex";
        bubbleTooltipBack.onclick = (e) => {
          e.stopPropagation();
          onBack();
        };
      } else {
        bubbleTooltipBack.style.display = "none";
      }
    }

    if (bubbleTooltipClose) {
      bubbleTooltipClose.onclick = (e) => {
        e.stopPropagation();
        setBubbleTooltip("hidden");
      };
    }

    // Status container (re-added if destroyed by innerHTML cleanup)
    let statusContainer = document.getElementById("byteseal-status-container");
    if (!statusContainer && bubbleTooltipText) {
      statusContainer = document.createElement("div");
      statusContainer.id = "byteseal-status-container";
      statusContainer.style.marginTop = "12px";
      bubbleTooltipText.appendChild(statusContainer);
    } else if (statusContainer) {
      statusContainer.innerHTML = "";
    }

    if (bubbleTooltipAction) {
      if (action) {
        bubbleTooltipAction.style.display = "block";
        bubbleTooltipAction.innerHTML = `<span>${action.label}</span>`;
        bubbleTooltipAction.disabled = false;
        bubbleTooltipAction.style.background = ""; // Reset background
        bubbleTooltipAction.onclick = (e) => {
          e.stopPropagation();
          action.onClick();
        };
      } else {
        bubbleTooltipAction.style.display = "none";
      }
    }

    if (bubbleTooltipAddCredForm) {
      if (showForm) {
        bubbleTooltipAddCredForm.style.display = "flex";
        if (bubbleAddUsernameInput) bubbleAddUsernameInput.focus();
      } else {
        bubbleTooltipAddCredForm.style.display = "none";
      }
    }
  };

  if (bubbleState.tooltip === "login-has-cred") {
    setTooltipContent({
      title: "AutoFill Assistant",
      type: "login",
      hasMatch: true,
      text: "We found matching credentials. Use the button below to autofill securely.",
      action: {
        label: "Fill Credentials",
        onClick: () => fillCredentialsFromBubble(),
      },
    });
    return;
  }

  if (bubbleState.tooltip === "login-no-cred") {
    setTooltipContent({
      title: "AutoFill Assistant",
      type: "login",
      hasMatch: false,
      text: "No credentials found for this site. Save them now to enable one-click login.",
      action: {
        label: "Add Credentials",
        onClick: () => setBubbleTooltip("add-cred"),
      },
    });
    return;
  }

  if (bubbleState.tooltip === "add-cred") {
    setTooltipContent({
      title: "Save Credentials",
      text: "Enter your credentials to save them to your secure vault.",
      showForm: true,
      onBack: () => {
        const hasCredentials = bubbleCredentials.some((cred) =>
          hostname.includes(cred.site),
        );
        setBubbleTooltip(hasCredentials ? "login-has-cred" : "login-no-cred");
      },
    });

    if (bubbleAddUsernameInput && !bubbleAddUsernameInput.value) {
      const userField = discoveredFields.find(
        (f) => f.role === "username" || f.role === "email",
      );
      if (userField && userField.input && userField.input.value) {
        bubbleAddUsernameInput.value = userField.input.value;
      }
    }

    if (bubbleSaveCredButton) {
      bubbleSaveCredButton.onclick = (e) => {
        e.stopPropagation();
        saveCredentialsFromBubble();
      };
    }
    return;
  }

  if (bubbleState.tooltip === "registration") {
    setTooltipContent({
      title: "AutoFill Assistant",
      type: "registration",
      text: "Use your identity profile to autofill this registration form securely.",
      action: {
        label: "Fill Identity Profile",
        onClick: () => fillRegistrationFromBubble(),
      },
    });
    return;
  }

  setTooltipContent({
    title: "AI Analyzing",
    text: "Building field map for secure autofill...",
  });
};

const detectLoginForm = () => {
  const passwordInputs = Array.from(
    document.querySelectorAll('input[type="password" i]'),
  ).filter(
    (input) => isVisibleDeep(input) && !input.closest("#byteseal-bubble-root"),
  );
  if (passwordInputs.length > 0) return true;

  const hintInputs = Array.from(
    document.querySelectorAll(
      'input[type="text" i], input[type="email" i], input:not([type])',
    ),
  ).filter(
    (input) => isVisibleDeep(input) && !input.closest("#byteseal-bubble-root"),
  );

  const hasLoginHint = hintInputs.some((el) => {
    const input = el as HTMLInputElement;
    const haystack = (
      input.name +
      " " +
      input.id +
      " " +
      input.placeholder +
      " " +
      (input.getAttribute("aria-label") || "")
    ).toLowerCase();
    return (
      haystack.includes("login") ||
      haystack.includes("sign in") ||
      haystack.includes("signin") ||
      haystack.includes("username") ||
      haystack.includes("user") ||
      haystack.includes("email")
    );
  });

  const hasSubmit = !!document.querySelector(
    'button[type="submit" i], input[type="submit" i]',
  );

  return hasLoginHint && hasSubmit;
};

const fillCredentialsFromBubble = async () => {
  const match = bubbleCredentials.find((cred) => hostname.includes(cred.site));
  if (!match) {
    setBubbleTooltip("login-no-cred");
    return;
  }

  // Visual feedback
  if (bubbleTooltipAction) {
    bubbleTooltipAction.disabled = true;
    bubbleTooltipAction.innerHTML =
      '<span>Filling...</span><div class="byteseal-btn-loader"></div>';
  }

  updateStatusStepUI([
    { text: "Checking internal vault...", status: "loading" },
  ]);

  await new Promise((r) => setTimeout(r, 600));

  const result = autofillContent({
    message: { data: match as any },
    encrypted: null,
    usrpass: "",
  }) as any;

  if (result && result.filledCount > 0) {
    updateStatusStepUI([
      { text: "Internal vault match", status: "success" },
      { text: "Filling credentials...", status: "success" },
    ]);
    if (bubbleTooltipAction) {
      bubbleTooltipAction.innerHTML = "<span>Filled!</span>";
      bubbleTooltipAction.style.background =
        "linear-gradient(to right, #059669, #10b981)";
    }
    setTimeout(() => setBubbleTooltip("hidden"), 1200);
  } else {
    updateStatusStepUI([
      { text: "Internal vault missed", status: "error" },
      { text: "Initiating AI Powered Autofill...", status: "loading" },
    ]);

    if (bubbleTooltipAction) {
      bubbleTooltipAction.innerHTML =
        '<span>Using AI...</span><div class="byteseal-btn-loader"></div>';
    }

    await new Promise((r) => setTimeout(r, 1200));
    autoFillIfPending();
  }
};

const updateStatusStepUI = (
  steps: Array<{
    text: string;
    status: "loading" | "success" | "error" | "idle";
  }>,
) => {
  const container = document.getElementById("byteseal-status-container");
  if (!container) return;

  container.innerHTML = "";
  steps.forEach((step) => {
    const div = document.createElement("div");
    div.className = `status-step ${step.status}`;

    let icon = "";
    if (step.status === "loading") {
      icon =
        '<svg class="status-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M12 18v4"/><path d="M4.93 4.93l2.83 2.83"/><path d="M16.24 16.24l2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="M4.93 19.07l2.83-2.83"/><path d="M16.24 7.76l2.83-2.83"/></svg>';
    } else if (step.status === "success") {
      icon =
        '<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (step.status === "error") {
      icon =
        '<svg class="status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
    } else {
      icon =
        '<svg class="status-icon opacity-20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/></svg>';
    }

    div.innerHTML = `
      <div class="status-icon-wrapper">${icon}</div>
      <span style="font-size: 11px; font-weight: 500;">${step.text}</span>
    `;
    container.appendChild(div);
  });
};

const saveCredentialsFromBubble = () => {
  const username = bubbleAddUsernameInput?.value;
  const password = bubbleAddPasswordInput?.value;

  if (!password) {
    if (bubbleTooltipText)
      bubbleTooltipText.textContent = "Please enter at least a password.";
    return;
  }

  // Visual feedback on the button
  if (bubbleSaveCredButton) {
    bubbleSaveCredButton.disabled = true;
    bubbleSaveCredButton.textContent = "Saving...";
  }

  const newCred = {
    site: hostname,
    username: username || undefined,
    password: password,
  };

  chrome.storage.local.get(["credentials"], (result) => {
    const currentCreds = Array.isArray(result.credentials)
      ? result.credentials
      : [];
    const updatedCreds = [...currentCreds, newCred];
    chrome.storage.local.set({ credentials: updatedCreds }, () => {
      // Clear inputs
      if (bubbleAddUsernameInput) bubbleAddUsernameInput.value = "";
      if (bubbleAddPasswordInput) bubbleAddPasswordInput.value = "";

      // Update local storage so periodic checks see the new credentials
      bubbleCredentials = updatedCreds;

      // Update button state
      if (bubbleSaveCredButton) {
        bubbleSaveCredButton.textContent = "Saved!";
        bubbleSaveCredButton.style.backgroundColor = "#10b981"; // success green
      }

      // Briefly show success state before hiding and filling
      setTimeout(() => {
        setBubbleTooltip("hidden");

        // Reset button for next time
        if (bubbleSaveCredButton) {
          bubbleSaveCredButton.disabled = false;
          bubbleSaveCredButton.textContent = "Save Credentials";
          bubbleSaveCredButton.style.backgroundColor = "";
        }

        // Trigger autofill now that we have credentials
        fillCredentialsFromBubble();
      }, 800);
    });
  });
};

const fillRegistrationFromBubble = async () => {
  // Visual feedback on button
  if (bubbleTooltipAction) {
    bubbleTooltipAction.disabled = true;
    bubbleTooltipAction.innerHTML =
      '<span>Filling...</span><div class="byteseal-btn-loader"></div>';
  }

  updateStatusStepUI([{ text: "Analyzing form fields...", status: "loading" }]);

  await new Promise((r) => setTimeout(r, 800));
  const result = autofillRegistrationForm(bubblePersonalInfo);

  if (result.aiPromise) {
    updateStatusStepUI([
      { text: "Local logic complete", status: "success" },
      { text: "AI Powered Autofill initiating...", status: "loading" },
    ]);

    if (bubbleTooltipAction) {
      bubbleTooltipAction.innerHTML =
        '<span>Using AI...</span><div class="byteseal-btn-loader"></div>';
    }

    result.aiPromise
      .then(() => {
        updateStatusStepUI([
          { text: "Local logic complete", status: "success" },
          { text: "AI Powered Autofill complete", status: "success" },
        ]);
        if (bubbleTooltipAction) {
          bubbleTooltipAction.innerHTML = "<span>Filled!</span>";
          bubbleTooltipAction.style.background =
            "linear-gradient(to right, #059669, #10b981)";
        }
        setTimeout(() => setBubbleTooltip("hidden"), 1500);
      })
      .catch(() => {
        updateStatusStepUI([{ text: "AI analysis failed", status: "error" }]);
        if (bubbleTooltipAction) {
          bubbleTooltipAction.innerHTML = "<span>AI Failed</span>";
          bubbleTooltipAction.disabled = false;
        }
      })
      .finally(() => {
        setBubbleLoading(false);
      });
  } else {
    updateStatusStepUI([
      { text: "Form filled via local logic", status: "success" },
    ]);
    if (bubbleTooltipAction) {
      bubbleTooltipAction.innerHTML = "<span>Filled!</span>";
      bubbleTooltipAction.style.background =
        "linear-gradient(to right, #059669, #10b981)";
    }
    setTimeout(() => {
      setBubbleLoading(false);
      setBubbleTooltip("hidden");
    }, 1200);
  }
};

const scheduleBubbleUpdate = () => {
  if (updateTimer) {
    window.clearTimeout(updateTimer);
  }

  if (bubbleState.tooltip === "ai-running") {
    return;
  }

  setBubbleLoading(true);
  updateTimer = window.setTimeout(() => {
    const registration = detectRegistrationForm();
    const login = !registration && detectLoginForm();
    const hasCredentials = bubbleCredentials.some((cred) =>
      hostname.includes(cred.site),
    );
    lastDetection = { login, registration, hasCredentials };

    if (
      bubbleState.tooltip !== "ai-running" &&
      bubbleState.tooltip !== "add-cred"
    ) {
      if (registration) {
        setBubbleTooltip("registration");
      } else if (login) {
        setBubbleTooltip(hasCredentials ? "login-has-cred" : "login-no-cred");
      } else {
        setBubbleTooltip("hidden");
      }
    }
    setBubbleLoading(false);
  }, 150);
};

const loadStoredBubbleData = () => {
  if (!chrome?.storage?.local) return;
  chrome.storage.local.get(["credentials", "personalInfo"], (result) => {
    if (Array.isArray(result?.credentials)) {
      bubbleCredentials = result.credentials as InlineCredential[];
    }
    if (result?.personalInfo) {
      bubblePersonalInfo = result.personalInfo as InlinePersonalInfo;
    }
    scheduleBubbleUpdate();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") return;
    if (changes?.credentials?.newValue) {
      bubbleCredentials = changes.credentials.newValue as InlineCredential[];
    }
    if (changes?.personalInfo?.newValue) {
      bubblePersonalInfo = changes.personalInfo.newValue as InlinePersonalInfo;
    }
    scheduleBubbleUpdate();
  });
};

const initBubble = () => {
  const start = () => {
    if (!document.body && !document.documentElement) {
      window.setTimeout(start, 50);
      return;
    }
    ensureBubble();
    scheduleBubbleUpdate();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
  loadStoredBubbleData();
  onFormChange(() => scheduleBubbleUpdate());
};

initBubble();

// const getInput = async (
//     message: {
//         data: Record<string, string | undefined>;
//     },
//     sendResponse: (response?: any) => void,
//     loggingEnabled: boolean
// ) => {
//     try {
//         sendStatusToBackground({
//             type: "info",
//             message: "Sending data array to model for role-based input fields.",
//             hostname,
//         });
//         sendLogsToBackground({
//             level: "info",
//             log: "Sending data array to model for role-based input fields.",
//             hostname,
//         });
//         const data = await callAI({
//             data: JSON.stringify(inputData),
//             loggingEnabled,
//         });
//         const result = JSON.parse(data);

//         if (result?.success) {
//             const indexMap: Record<string, number> = result.data;

//             let missingFields: string[] = [];

//             Object.keys(indexMap).forEach((fieldKey) => {
//                 const value = message?.data?.[fieldKey];

//                 if (value) {
//                     const index = indexMap[fieldKey];
//                     if (typeof index !== "number") return;

//                     const matched = inputDataWithElement[index];
//                     if (matched?.input) {
//                         const input = matched.input;
//                         input.value = value;
//                         input.dispatchEvent(new Event("input", { bubbles: true }));
//                         input.dispatchEvent(new Event("change", { bubbles: true }));
//                         input.style.outline = "3px solid orange";
//                     }
//                 } else {
//                     missingFields.push(fieldKey);
//                 }
//             });

//             if (missingFields.length === 0) {
//                 if (loggingEnabled) {
//                     console.log("Fields Filled Successfully");
//                 }

//                 sendStatusToBackground({
//                     type: "success",
//                     message: "Fields Filled Successfully",
//                     hostname,
//                 });

//                 sendResponse({
//                     status: "success",
//                     message: "Fields Filled Successfully",
//                 });

//                 sendLogsToBackground({
//                     level: "success",
//                     log: "Fields Filled Successfully",
//                     hostname,
//                 });
//             } else {
//                 if (loggingEnabled) {
//                     console.log(
//                         "Some fields could not be filled. Missing fields:",
//                         missingFields
//                     );
//                 }

//                 sendStatusToBackground({
//                     type: "error",
//                     message: "Some fields could not be filled. Missing fields: " + missingFields.join(", "),
//                     hostname,
//                 });

//                 sendResponse({
//                     status: "stop",
//                     message: "Some fields could not be filled. Missing fields: " + missingFields.join(", "),
//                 });

//                 sendLogsToBackground({
//                     level: "info",
//                     log: "Some fields could not be filled. Missing fields: " + missingFields.join(", "),
//                     hostname,
//                 });
//             }

//             return true;
//         } else {
//             if (loggingEnabled) {
//                 console.log("Error in callAI function: " + result?.error?.message);
//             }
//             sendResponse({
//                 status: "stop",
//                 message: "Error in callAI function: " + result?.error?.message,
//             });
//             sendStatusToBackground({
//                 type: "error",
//                 message: "Error in callAI function: " + result?.error?.message,
//                 hostname,
//             });
//             sendLogsToBackground({
//                 level: "error",
//                 log: "Error in callAI function: " + result?.error?.message,
//                 hostname,
//             });
//             return false;
//         }
//     } catch (err) {
//         if (loggingEnabled) {
//             console.log(
//                 "Error in callAI function: " +
//                 (err instanceof Error ? err.message : JSON.stringify(err))
//             );
//         }
//         sendResponse({
//             status: "empty",
//             message:
//                 "Error in callAI function: " +
//                 (err instanceof Error ? err.message : JSON.stringify(err)),
//         });
//         sendLogsToBackground({
//             level: "error",
//             log:
//                 "Error in callAI function: " +
//                 (err instanceof Error ? err.message : JSON.stringify(err)),
//             hostname,
//         });
//         return false;
//     }
// };
