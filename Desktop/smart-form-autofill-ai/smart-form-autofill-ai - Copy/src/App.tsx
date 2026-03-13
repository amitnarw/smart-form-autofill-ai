import { useState, useEffect } from "react";
import "./App.css";
import {
  LockClosedIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  // CursorArrowRippleIcon,
  XCircleIcon,
  UserCircleIcon,
} from "@heroicons/react/24/solid";
import {
  getAlreadyAutofilledWebsites,
  getLoggingEnabled,
  setAlreadyAutofilledWebsites,
  setLoggingEnabled,
} from "./utils/logging";
import credentialsData from "./data/credentials.json";
import personalInfoData from "./data/personalInfo.json";

type Credential = {
  site: string;
  username?: string;
  email?: string;
  password?: string;
};

type PersonalInfo = {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dob?: string;
  additionalFields?: Record<string, string>;
};

function App() {
  const [activeTab, setActiveTab] = useState<
    "site" | "vault" | "personal" | "developer"
  >("site");
  const [currentSite, setCurrentSite] = useState<string>("");
  const [enableLogs, setEnableLogs] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<Record<string, string>>(
    {}
  );
  const [errorFromBackground, setErrorFromBackground] = useState(false);
  const [logMessage, setLogMessage] = useState<
    {
      level: "info" | "success" | "error";
      log: string;
      hostname: string;
    }[]
  >([]);
  const [alreadyFilled, setAlreadyFilled] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [formStatus, setFormStatus] = useState<{
    registration: boolean;
    checked: boolean;
  }>({ registration: false, checked: false });
  const [personalFillStatus, setPersonalFillStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const [credentials, setCredentials] = useState<Credential[]>(
    credentialsData as Credential[]
  );
  const [personalInfo, setPersonalInfo] = useState<PersonalInfo>(
    personalInfoData as PersonalInfo
  );
  const [storageReady, setStorageReady] = useState(false);
  const [vaultSearch, setVaultSearch] = useState("");
  const [showAddCredential, setShowAddCredential] = useState(false);
  const [credentialForm, setCredentialForm] = useState<Credential>({
    site: "",
    username: "",
    email: "",
    password: "",
  });
  const [expandedCredentialSite, setExpandedCredentialSite] = useState<
    string | null
  >(null);
  const [newPersonalKey, setNewPersonalKey] = useState("");
  const [newPersonalValue, setNewPersonalValue] = useState("");

  // useEffect(() => {
  //   setCurrentSite("www.fedex.com");
  // }, []);

  const refreshFormStatus = () => {
    chrome.runtime.sendMessage({ type: "GET_FORM_STATUS" }, (res) => {
      if (chrome.runtime.lastError) {
        setFormStatus({ registration: false, checked: true });
        return;
      }
      if (res?.status === "success") {
        setFormStatus({
          registration: !!res?.data?.registration,
          checked: true,
        });
      } else {
        setFormStatus({ registration: false, checked: true });
      }
    });
  };

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        try {
          const url = new URL(tabs[0].url);
          setCurrentSite(url.hostname);
          checkIfAlreadyFilled(url.hostname);
          refreshFormStatus();
        } catch (err) {
          console.error("Failed to parse URL", err);
        }
      }
    });

    checkLogs();

    const handleLogs = (message: any) => {
      if (message.type === "LOG_MESSAGE") {
        setLogMessage((preVal) => [...preVal, message.payload]);
      }
    };

    const handleStatus = (message: any) => {
      if (message.type === "STATUS") {
        setStatus({
          type: message.payload?.type,
          message: message.payload?.message,
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleLogs);
    chrome.runtime.onMessage.addListener(handleStatus);

    if (chrome?.storage?.local) {
      chrome.storage.local.get(
        ["credentials", "personalInfo", "openAddCredentials", "prefillCredentialSite"],
        (result) => {
          if (Array.isArray(result?.credentials)) {
            setCredentials(result.credentials as Credential[]);
          }
          if (result?.personalInfo) {
            setPersonalInfo(result.personalInfo as PersonalInfo);
          }
          const prefillSite =
            typeof result?.prefillCredentialSite === "string"
              ? result.prefillCredentialSite
              : "";

          if (result?.openAddCredentials) {
            setActiveTab("vault");
            setShowAddCredential(true);
            setCredentialForm((prev) => ({
              ...prev,
              site: prefillSite || prev.site,
            }));
            chrome.storage.local.remove([
              "openAddCredentials",
              "prefillCredentialSite",
            ]);
          }
          setStorageReady(true);
        }
      );
    } else {
      setStorageReady(true);
    }

    return () => {
      chrome.runtime.onMessage.removeListener(handleLogs);
      chrome.runtime.onMessage.removeListener(handleStatus);
    };
  }, []);

  useEffect(() => {
    if (!storageReady || !chrome?.storage?.local) return;
    chrome.storage.local.set({ credentials });
  }, [credentials, storageReady]);

  useEffect(() => {
    if (!storageReady || !chrome?.storage?.local) return;
    chrome.storage.local.set({ personalInfo });
  }, [personalInfo, storageReady]);

  const checkIfAlreadyFilled = async (website: string) => {
    const check = await getAlreadyAutofilledWebsites(website);
    setAlreadyFilled(check);
  };

  const getColor = (level: string) => {
    switch (level) {
      case "info":
        return "#00BFFF";
      case "success":
        return "#05df72";
      case "error":
        return "#FF6347";
      default:
        return "#ccc";
    }
  };

  const checkLogs = async () => {
    let check = await getLoggingEnabled();
    if (check) {
      setEnableLogs(true);
    } else {
      setEnableLogs(false);
    }
  };

  const handleLogsVisibility = async () => {
    try {
      const newState = !enableLogs;
      setEnableLogs(newState);
      await setLoggingEnabled(newState);

      chrome.runtime.sendMessage(
        { type: "DEBUG_TOGGLE", enabled: newState },
        (res) => {
          if (chrome.runtime.lastError) {
            return;
          }
          if (res?.status === "success") {
            setEnableLogs(res.toggleLogs);
          } else {
            setErrorFromBackground(true);
          }
        }
      );
    } catch (err) {
      if (err instanceof Error) {
        console.error(
          "Error while sending messagto background type: 'DEBUG_TOGGLE' " +
            err?.message
        );
      } else {
        console.error(
          "Error while sending messagto background type: 'DEBUG_TOGGLE'"
        );
      }
    }
  };

  const handleFill = (cred: Credential) => {
    try {
      setAutofillStatus((prev) => ({ ...prev, [cred.site]: "loading" }));
      chrome.runtime.sendMessage({ type: "FILL_FIELDS", data: cred }, (res) => {
        if (chrome.runtime.lastError) {
          return;
        }

        if (res?.status === "success") {
          setAutofillStatus((prev) => ({
            ...prev,
            [cred.site]: res?.status ? "success" : "error",
          }));

          setAlreadyAutofilledWebsites(
            currentSite
            // cred
          );

          setTimeout(() => {
            setAutofillStatus((prev) => ({ ...prev, [cred.site]: "idle" }));
          }, 3500);
        } else if (res?.status === "stop") {
          // setError(res?.message);
          setAutofillStatus((prev) => ({ ...prev, [cred.site]: "idle" }));
        } else if (res?.status === "empty") {
          // setError(res?.message);
        } else {
          setErrorFromBackground(true);
        }
      });
    } catch (err) {
      if (err instanceof Error) {
        console.error(
          "Error while sending message to background type: 'FILL_FIELDS' " +
            err?.message
        );
      } else {
        console.error(
          "Error while sending message to background type: 'FILL_FIELDS'"
        );
      }
    }
  };

  const handleFillPersonalInfo = () => {
    try {
      setPersonalFillStatus("loading");
      chrome.runtime.sendMessage(
        { type: "FILL_PERSONAL_INFO", data: personalInfo },
        (res) => {
          if (chrome.runtime.lastError) {
            setPersonalFillStatus("error");
            return;
          }
          if (res?.status === "success") {
            setPersonalFillStatus("success");
            setTimeout(() => setPersonalFillStatus("idle"), 3500);
          } else {
            setPersonalFillStatus("error");
          }
        }
      );
    } catch (err) {
      setPersonalFillStatus("error");
      if (err instanceof Error) {
        console.error(
          "Error while sending message to background type: 'FILL_PERSONAL_INFO' " +
            err?.message
        );
      } else {
        console.error(
          "Error while sending message to background type: 'FILL_PERSONAL_INFO'"
        );
      }
    }
  };

  const matchingCred = credentials.find((cred) =>
    currentSite.includes(cred.site)
  );

  const AutofillButton = ({
    cred,
  }: {
    cred: Credential;
  }) => {
    const status = autofillStatus[cred.site] || "idle";

    if (status === "loading") {
      return (
        <button
          className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 rounded-xl text-white"
          disabled
        >
          <ArrowPathIcon className="w-4 h-4 animate-spin" />
          Applying...
        </button>
      );
    }

    if (status === "success") {
      return (
        <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
          <CheckCircleIcon className="w-4 h-4" />
          Applied!
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="flex items-center gap-1 text-red-400 text-xs font-medium">
          <XCircleIcon className="w-4 h-4" />
          Failed!
        </div>
      );
    }
  };

  const handleReloadPage = () => {
    try {
      chrome.tabs.reload();
      setErrorFromBackground(false);
      checkIfAlreadyFilled(currentSite);
      refreshFormStatus();
      if (matchingCred) {
        setAutofillStatus((prev) => ({ ...prev, [matchingCred.site]: "idle" }));
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error while trying to reload tab" + err?.message);
      } else {
        console.error("Error while trying to reload tab");
      }
    }
  };

  const handleOpenAddCredentials = () => {
    setActiveTab("vault");
    setShowAddCredential(true);
    setCredentialForm((prev) => ({
      ...prev,
      site: currentSite || prev.site,
    }));
  };

  const filteredCredentials = credentials.filter((cred) => {
    const search = vaultSearch.trim().toLowerCase();
    if (!search) return true;
    return (
      cred.site.toLowerCase().includes(search) ||
      (cred.username || "").toLowerCase().includes(search) ||
      (cred.email || "").toLowerCase().includes(search)
    );
  });

  const handleAddCredential = () => {
    if (!credentialForm.site || !credentialForm.password) return;
    setCredentials((prev) => [
      ...prev,
      {
        site: credentialForm.site.trim(),
        username: credentialForm.username?.trim() || undefined,
        email: credentialForm.email?.trim() || undefined,
        password: credentialForm.password?.trim() || undefined,
      },
    ]);
    setCredentialForm({ site: "", username: "", email: "", password: "" });
    setShowAddCredential(false);
  };

  const handleAddPersonalField = () => {
    const key = newPersonalKey.trim();
    if (!key) return;
    setPersonalInfo((prev) => ({
      ...prev,
      additionalFields: {
        ...(prev.additionalFields || {}),
        [key]: newPersonalValue.trim(),
      },
    }));
    setNewPersonalKey("");
    setNewPersonalValue("");
  };

  return (
    <div className="w-96 h-[480px] bg-gray-900 text-gray-100 shadow-xl flex flex-col relative">
      {/* Navbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-700 bg-gray-900">
        <p className="bg-gradient-to-r from-blue-700 to-blue-200 text-transparent bg-clip-text font-bold text-lg">
          Extension
        </p>
        <div className="flex flex-row gap-2 items-center justify-end w-full">
          <button
            onClick={handleReloadPage}
            className="flex px-3 py-1 text-xs border border-blue-500 hover:bg-blue-600/50 text-blue-200 rounded-xl shadow duration-300"
          >
            <span>Reload Page</span>
          </button>
         { /*<button
            onClick={handleSync}
            className="flex px-3 py-1 text-xs border border-blue-500 hover:bg-blue-600/50 text-blue-200 rounded-xl shadow duration-300"
          >
            <span>Sync</span>
          </button>*/}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4">
        {/* Site Tab */}
        {activeTab === "site" && (
          <div>
            <p className="text-sm mb-3 text-gray-400">
              Current website:{" "}
              <span className="text-white font-medium">
                {currentSite || "Loading..."}
              </span>
            </p>

            {matchingCred ? (
              <div className="flex justify-between items-center p-3 bg-gray-800 border border-gray-700 rounded-xl relative">
                <div>
                  <p className="font-medium text-sm text-white">
                    {matchingCred.site}
                  </p>
                  <p className="text-xs text-gray-400">
                    {(matchingCred.username || matchingCred.email || "-") + "***"}
                  </p>
                </div>

                <div
                  className={`absolute right-2 transition-opacity duration-300 ${
                    autofillStatus[matchingCred.site] === "idle" ||
                    !autofillStatus[matchingCred.site]
                      ? "opacity-100"
                      : "opacity-0 pointer-events-none"
                  }`}
                >
                  <button
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl duration-300"
                    onClick={() => handleFill(matchingCred)}
                  >
                    <CursorArrowRaysIcon className="w-4 h-4" />
                    Apply
                  </button>
                </div>
                {/* <div
                    className={`absolute right-2 bottom-1.5 transition-opacity duration-300 ${
                      autofillStatus[matchingCred.site] === "idle" ||
                      !autofillStatus[matchingCred.site]
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <button
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl duration-300"
                      onClick={() => handleFill(matchingCred, true)}
                    >
                      <CursorArrowRippleIcon className="w-4 h-4" />
                      AI Apply
                    </button>
                  </div> */}

                <div
                  className={`absolute right-2 transition-opacity duration-300 ${
                    autofillStatus[matchingCred.site] === "idle" ||
                    !autofillStatus[matchingCred.site]
                      ? "opacity-0 pointer-events-none"
                      : "opacity-100"
                  }`}
                >
                  <AutofillButton cred={matchingCred} />
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-red-400">
                  No credentials found for this site.
                </p>
                <button
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  onClick={handleOpenAddCredentials}
                >
                  Add credentials
                </button>
              </div>
            )}

            {alreadyFilled && (
              <p className="text-gray-400 text-sm mt-2">
                Credentials already filled
              </p>
            )}

            {status?.type && (
              <p
                className={`${
                  status?.type === "error"
                    ? "text-red-400"
                    : status?.type === "success"
                    ? "text-green-400"
                    : "text-blue-700"
                } text-md mt-5`}
              >
                {status?.message}
              </p>
            )}
          </div>
        )}

        {/* Vault Tab */}
        {activeTab === "vault" && (
          <div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={vaultSearch}
                onChange={(e) => setVaultSearch(e.target.value)}
                placeholder="Search credentials..."
                className="flex-1 p-2 text-sm bg-gray-800 border border-gray-700 placeholder-gray-500 text-gray-200 rounded-xl"
              />
              <button
                className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                onClick={() => setShowAddCredential((prev) => !prev)}
              >
                Add
              </button>
            </div>
            {showAddCredential && (
              <div className="mb-4 p-3 bg-gray-800 border border-gray-700 rounded-xl space-y-2">
                <input
                  type="text"
                  value={credentialForm.site}
                  onChange={(e) =>
                    setCredentialForm((prev) => ({
                      ...prev,
                      site: e.target.value,
                    }))
                  }
                  placeholder="Site (domain)"
                  className="w-full p-2 text-sm bg-gray-900 border border-gray-700 placeholder-gray-500 text-gray-200 rounded-xl"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={credentialForm.username || ""}
                    onChange={(e) =>
                      setCredentialForm((prev) => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                    placeholder="Username"
                    className="w-full p-2 text-sm bg-gray-900 border border-gray-700 placeholder-gray-500 text-gray-200 rounded-xl"
                  />
                  <input
                    type="email"
                    value={credentialForm.email || ""}
                    onChange={(e) =>
                      setCredentialForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="Email"
                    className="w-full p-2 text-sm bg-gray-900 border border-gray-700 placeholder-gray-500 text-gray-200 rounded-xl"
                  />
                </div>
                <input
                  type="password"
                  value={credentialForm.password || ""}
                  onChange={(e) =>
                    setCredentialForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  placeholder="Password"
                  className="w-full p-2 text-sm bg-gray-900 border border-gray-700 placeholder-gray-500 text-gray-200 rounded-xl"
                />
                <div className="flex justify-end">
                  <button
                    className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                    onClick={handleAddCredential}
                  >
                    Save
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-y-auto h-[60vh]">
              {filteredCredentials.map((cred, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 mb-3 bg-gray-800 border border-gray-700 hover:border-blue-500 transition rounded-xl"
                >
                  <div>
                    <p className="font-medium text-sm text-white">
                      {cred.site}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(cred.username || cred.email || "-") + "***"}
                    </p>
                    {expandedCredentialSite === cred.site && (
                      <div className="mt-2 text-xs text-gray-300 space-y-1">
                        {cred.username && (
                          <div>
                            <span className="text-gray-400">Username:</span>{" "}
                            {cred.username}
                          </div>
                        )}
                        {cred.email && (
                          <div>
                            <span className="text-gray-400">Email:</span>{" "}
                            {cred.email}
                          </div>
                        )}
                        {cred.password && (
                          <div>
                            <span className="text-gray-400">Password:</span>{" "}
                            {cred.password}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <button
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-800 text-white rounded-xl duration-300"
                      onClick={() =>
                        setExpandedCredentialSite((prev) =>
                          prev === cred.site ? null : cred.site
                        )
                      }
                    >
                      <EyeIcon className="w-4 h-4" />
                      {expandedCredentialSite === cred.site ? "Hide" : "View"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal Info Tab */}
        {activeTab === "personal" && (
          <div>
            <p className="text-sm mb-3 text-gray-400">
              Personal info autofill is available only when a registration form
              is detected on the current page.
            </p>

            {!formStatus.checked && (
              <p className="text-sm text-gray-400">Detecting form...</p>
            )}

            {formStatus.checked && !formStatus.registration && (
              <p className="text-sm text-red-400">
                No registration form detected on this page.
              </p>
            )}

            <div className="p-3 bg-gray-800 border border-gray-700 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm text-white">
                    Personal Info
                  </p>
                  <p className="text-xs text-gray-400">
                    {personalInfo.name} | {personalInfo.email}
                  </p>
                </div>
                {formStatus.checked && formStatus.registration && (
                  <div>
                    {personalFillStatus === "loading" && (
                      <button
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 rounded-xl text-white"
                        disabled
                      >
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Applying...
                      </button>
                    )}
                    {personalFillStatus === "success" && (
                      <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
                        <CheckCircleIcon className="w-4 h-4" />
                        Applied!
                      </div>
                    )}
                    {personalFillStatus === "error" && (
                      <div className="flex items-center gap-1 text-red-400 text-xs font-medium">
                        <XCircleIcon className="w-4 h-4" />
                        Failed!
                      </div>
                    )}
                    {personalFillStatus === "idle" && (
                      <button
                        className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl duration-300"
                        onClick={handleFillPersonalInfo}
                      >
                        <CursorArrowRaysIcon className="w-4 h-4" />
                        Apply
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={newPersonalKey}
                  onChange={(e) => setNewPersonalKey(e.target.value)}
                  placeholder="Field key"
                  className="min-w-0 p-2 text-xs bg-gray-900 border border-gray-700 placeholder-gray-500 text-gray-200 rounded-xl"
                />
                <input
                  type="text"
                  value={newPersonalValue}
                  onChange={(e) => setNewPersonalValue(e.target.value)}
                  placeholder="Value"
                  className="min-w-0 p-2 text-xs bg-gray-900 border border-gray-700 placeholder-gray-500 text-gray-200 rounded-xl"
                />
                <button
                  className="col-span-2 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  onClick={handleAddPersonalField}
                >
                  Add
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs max-h-44 overflow-y-auto pr-1">
                <div className="text-gray-400">Name</div>
                <div className="text-gray-200">{personalInfo.name || "-"}</div>
                <div className="text-gray-400">Email</div>
                <div className="text-gray-200">{personalInfo.email || "-"}</div>
                <div className="text-gray-400">Phone</div>
                <div className="text-gray-200">{personalInfo.phone || "-"}</div>
                <div className="text-gray-400">Address</div>
                <div className="text-gray-200">
                  {personalInfo.address || "-"}
                </div>
                <div className="text-gray-400">DOB</div>
                <div className="text-gray-200">{personalInfo.dob || "-"}</div>
                {Object.entries(personalInfo.additionalFields || {}).map(
                  ([key, value]) => (
                    <div key={key} className="contents">
                      <div className="text-gray-400">
                        {key.replace(/([A-Z])/g, " $1").trim()}
                      </div>
                      <div className="text-gray-200">
                        {value ? String(value) : "-"}
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Developer Tab */}
        {activeTab === "developer" && (
          <div>
            <p className="mb-3 text-sm text-gray-400">
              Show logs in console for developers:
            </p>
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={enableLogs}
                onChange={handleLogsVisibility}
                className="sr-only peer"
              />
              <div
                className={`w-11 h-6 rounded-xl relative transition-colors cursor-pointer ${
                  enableLogs ? "bg-blue-600" : "bg-gray-600"
                }`}
              >
                <div
                  className={`absolute top-[2px] left-[2px] w-5 h-5 bg-white rounded-xl transition-transform ${
                    enableLogs ? "translate-x-5" : ""
                  }`}
                />
              </div>
              <span className="ml-3 text-sm">{enableLogs ? "ON" : "OFF"}</span>
            </label>
            {enableLogs && (
              <div className="flex items-center gap-1 mt-1 text-green-400 text-xs">
                <CheckCircleIcon className="w-4 h-4" />
                <span>Logs enabled in console</span>
              </div>
            )}

            {enableLogs && logMessage && (
              <div className="bg-black text-white font-mono px-4 py-2 h-[240px] overflow-y-auto rounded shadow-md mt-5">
                {logMessage.map(
                  (log, index) =>
                    currentSite === log?.hostname && (
                      <div
                        key={index}
                        style={{ color: getColor(log.level) }}
                        className="flex flex-row items-center justify-center border-b border-gray-800 pb-2 mb-2"
                      >
                        [{log.level.toUpperCase()} |{" "}
                        {new globalThis.Date().toLocaleString("en-IN", {
                          hour12: true,
                          hour: "numeric",
                          minute: "numeric",
                          second: "2-digit",
                        })}
                        ]: {log.log}
                      </div>
                    )
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex justify-around border-t border-gray-700 py-2 bg-gray-900 shrink-0">
        <button
          onClick={() => setActiveTab("site")}
          className={`flex items-center gap-1 px-4 py-2 text-sm font-medium transition ${
            activeTab === "site"
              ? "text-blue-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <GlobeAltIcon className="w-4 h-4" />
          Site
        </button>
        <button
          onClick={() => setActiveTab("vault")}
          className={`flex items-center gap-1 px-4 py-2 text-sm font-medium transition ${
            activeTab === "vault"
              ? "text-blue-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <LockClosedIcon className="w-4 h-4" />
          Vault
        </button>
        <button
          onClick={() => setActiveTab("personal")}
          className={`flex items-center gap-1 px-4 py-2 text-sm font-medium transition ${
            activeTab === "personal"
              ? "text-blue-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <UserCircleIcon className="w-4 h-4" />
          Personal
        </button>
        <button
          onClick={() => setActiveTab("developer")}
          className={`flex items-center gap-1 px-4 py-2 text-sm font-medium transition ${
            activeTab === "developer"
              ? "text-blue-400"
              : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <CheckCircleIcon className="w-4 h-4" />
          Developer
        </button>
      </div>

      {/* Error Overlap */}
      <div
        className={`${
          errorFromBackground ? "block" : "hidden"
        } absolute h-full w-full bg-black/40 flex flex-col gap-2 items-center justify-center px-10 text-center backdrop-blur-xs`}
      >
        <h2 className="text-lg font-semibold text-cyan-400">
          Extension needs page reload
        </h2>
        <p className="text-sm text-gray-300 mt-1">
          This page was open before the extension was installed or updated.
          Reload it so the extension can properly access input fields.
        </p>
        <button
          className="px-5 py-2 text-sm mt-3 rounded-xl bg-cyan-600 hover:bg-cyan-800 text-white duration-300 flex flex-row gap-2 items-center"
          onClick={handleReloadPage}
        >
          <ArrowPathIcon className="w-4 h-4" />
          Reload Page
        </button>
      </div>
    </div>
  );
}

export default App;


