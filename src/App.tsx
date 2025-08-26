import { useState, useEffect } from "react";
import "./App.css";
import {
  LockClosedIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import {
  getLoggingEnabled,
  setAlreadyAutofilledWebsites,
  setLoggingEnabled,
} from "./utils/logging";

function App() {
  const [activeTab, setActiveTab] = useState<"site" | "vault" | "developer">(
    "site"
  );
  const [currentSite, setCurrentSite] = useState<string>("");
  const [enableLogs, setEnableLogs] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<Record<string, string>>(
    {}
  );
  const [errorFromBackground, setErrorFromBackground] = useState(false);

  const credentials = [
    {
      site: "github.com",
      email: "johndoe@test.com",
      username: "johndoe",
      password: "demo123",
    },
    { site: "mail.google.com", username: "janedoe", password: "demo456" },
    { site: "www.fedex.com", username: "janedoe", password: "demo222" },
  ];

  // useEffect(() => {
  //   setCurrentSite("www.fedex.com");
  // }, []);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        try {
          const url = new URL(tabs[0].url);
          setCurrentSite(url.hostname);
        } catch (e) {
          console.error("Failed to parse URL", e);
        }
      }
    });

    checkLogs();
  }, []);

  const checkLogs = async () => {
    let check = await getLoggingEnabled();
    if (check) {
      setEnableLogs(true);
    } else {
      setEnableLogs(false);
    }
  };

  const handleLogsVisibility = async () => {
    const newState = !enableLogs;
    setEnableLogs(newState);
    await setLoggingEnabled(newState);

    chrome.runtime.sendMessage(
      { action: "toggleLogs", enabled: newState },
      (res) => {
        if (res?.status === "success") {
          setEnableLogs(res.toggleLogs);
        } else {
          setErrorFromBackground(true);
        }
      }
    );
  };

  const handleFill = (cred: {
    site: string;
    username: string;
    password: string;
  }) => {
    setAutofillStatus((prev) => ({ ...prev, [cred.site]: "loading" }));
    chrome.runtime.sendMessage({ action: "autofill", data: cred }, (res) => {
      if (res?.status === "success") {
        setAutofillStatus((prev) => ({
          ...prev,
          [cred.site]: res?.status ? "success" : "error",
        }));

        setAlreadyAutofilledWebsites(currentSite, cred);

        setTimeout(() => {
          setAutofillStatus((prev) => ({ ...prev, [cred.site]: "idle" }));
        }, 3500);
      } else {
        setErrorFromBackground(true);
      }
    });
  };

  const handleSync = () => {
    alert("Data synced successfully!");
  };

  const matchingCred = credentials.find((cred) =>
    currentSite.includes(cred.site)
  );

  const AutofillButton = ({
    cred,
  }: {
    cred: { site: string; username: string; password: string };
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
    chrome.tabs.reload();
    setErrorFromBackground(false);
    if (matchingCred) {
      setAutofillStatus((prev) => ({ ...prev, [matchingCred.site]: "idle" }));
    }
  };

  return (
    <div className="w-96 h-[480px] bg-gray-900 text-gray-100 shadow-xl flex flex-col relative">
      {/* Navbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-700 bg-gray-850">
        <p className="bg-gradient-to-r from-blue-700 to-blue-200 text-transparent bg-clip-text font-bold">Extension</p>
        <div className="flex flex-row gap-2 items-center justify-end w-full">
          <button
            onClick={handleReloadPage}
            className="flex px-3 py-1 text-xs border border-blue-500 hover:bg-blue-600/50 text-blue-200 rounded-xl shadow duration-300"
          >
            <span>Reload Page</span>
          </button>
          <button
            onClick={handleSync}
            className="flex px-3 py-1 text-xs border border-blue-500 hover:bg-blue-600/50 text-blue-200 rounded-xl shadow duration-300"
          >
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
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
                    {matchingCred.username}***
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
                    Autofill
                  </button>
                </div>

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
              <p className="text-sm text-red-400">
                No credentials found for this site.
              </p>
            )}
          </div>
        )}

        {/* Vault Tab */}
        {activeTab === "vault" && (
          <div>
            <input
              type="text"
              placeholder="Search credentials..."
              className="w-full p-2 mb-4 text-sm bg-gray-800 border border-gray-700 placeholder-gray-500 text-gray-200 rounded-xl"
            />
            {credentials.map((cred, idx) => (
              <div
                key={idx}
                className="flex justify-between items-center p-3 mb-3 bg-gray-800 border border-gray-700 hover:border-blue-500 transition rounded-xl"
              >
                <div>
                  <p className="font-medium text-sm text-white">{cred.site}</p>
                  <p className="text-xs text-gray-400">{cred.username}***</p>
                </div>
                <div>
                  <button
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-800 text-white rounded-xl duration-300"
                    onClick={() => handleFill(cred)}
                  >
                    <EyeIcon className="w-4 h-4" />
                    View
                  </button>
                </div>
              </div>
            ))}
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
              <div className="flex items-center gap-1 mt-3 text-green-400 text-xs">
                <CheckCircleIcon className="w-4 h-4" />
                <span>Logs enabled in console</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex justify-around border-t border-gray-700 py-2 bg-gray-850">
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
