import { useState, useEffect } from "react";
import "./App.css";
import {
  LockClosedIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  GlobeAltIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  CursorArrowRippleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import {
  getAlreadyAutofilledWebsites,
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
  const [logMessage, setLogMessage] = useState<
    {
      level: "info" | "success" | "error";
      log: string;
      hostname: string;
    }[]
  >([]);
  const [alreadyFilled, setAlreadyFilled] = useState(false);
  const [error, setError] = useState("");

  const credentials = [
    { site: "www.fedex.com", username: "janedoe", password: "demo222" },
    {
      site: "online.canarabank.in",
      username: "janedoe-canara",
      password: "demo444",
    },
    { site: "citi.com", username: "janedoe-citi", password: "demo99609" },
    {
      site: "localhost",
      // email: "janedoe-localhost@test.com",
      username: "janedoe-localhost",
      password: "demo532423",
    },
    {
      site: "netbanking.pgb.co.in",
      username: "janedoe-gramin",
      password: "demo232w",
    },
    {
      site: "retail.onlinesbi.sbi",
      username: "janedoe-sbi",
      password: "demo12345",
    },
    {
      site: "django-pixel-lite.appseed-srv1.com",
      username: "janedoe-django",
      password: "demo54321",
    },
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
          checkIfAlreadyFilled(url.hostname);
        } catch (err) {
          console.error("Failed to parse URL", err);
        }
      }
    });

    checkLogs();

    const handleMessage = (message: any) => {
      if (message.type === "LOG_MESSAGE") {
        setLogMessage((preVal) => [...preVal, message.payload]);
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

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

  const handleFill = (
    cred: {
      site: string;
      username?: string;
      email?: string;
      password?: string;
    },
    aiApply: boolean
  ) => {
    try {
      setAutofillStatus((prev) => ({ ...prev, [cred.site]: "loading" }));
      chrome.runtime.sendMessage(
        { type: aiApply ? "AI_FILL_FIELDS" : "FILL_FIELDS", data: cred },
        (res) => {
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
          } else if (res?.status === "empty") {
            setError(res?.message);
            setAutofillStatus((prev) => ({ ...prev, [cred.site]: "idle" }));
          } else {
            setErrorFromBackground(true);
          }
        }
      );
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

  const handleSync = () => {
    alert("Data synced successfully!");
  };

  const matchingCred = credentials.find((cred) =>
    currentSite.includes(cred.site)
  );

  const AutofillButton = ({
    cred,
  }: {
    cred: {
      site: string;
      username?: string;
      email?: string;
      password?: string;
    };
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

  return (
    <div className="w-96 h-[480px] bg-gray-900 text-gray-100 shadow-xl flex flex-col relative">
      {/* Navbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-700 bg-gray-850">
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
          <button
            onClick={handleSync}
            className="flex px-3 py-1 text-xs border border-blue-500 hover:bg-blue-600/50 text-blue-200 rounded-xl shadow duration-300"
          >
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-hiden p-4">
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
              <div className="flex justify-between items-center p-3 py-4 bg-gray-800 border border-gray-700 rounded-xl relative">
                <div>
                  <p className="font-medium text-sm text-white">
                    {matchingCred.site}
                  </p>
                  <p className="text-xs text-gray-400">
                    {matchingCred.username}***
                  </p>
                </div>

                <div>
                  <div
                    className={`absolute right-2 top-1.5 transition-opacity duration-300 ${
                      autofillStatus[matchingCred.site] === "idle" ||
                      !autofillStatus[matchingCred.site]
                        ? "opacity-100"
                        : "opacity-0 pointer-events-none"
                    }`}
                  >
                    <button
                      className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl duration-300"
                      onClick={() => handleFill(matchingCred, false)}
                    >
                      <CursorArrowRaysIcon className="w-4 h-4" />
                      Apply
                    </button>
                  </div>
                  <div
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
                  </div>
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

            {alreadyFilled && (
              <p className="text-gray-400 text-sm mt-2">
                Credentials already filled
              </p>
            )}

            {error && <p className="text-red-400 text-md mt-5">{error}</p>}
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
            <div className="overflow-y-auto h-[60vh]">
              {credentials.map((cred, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 mb-3 bg-gray-800 border border-gray-700 hover:border-blue-500 transition rounded-xl"
                >
                  <div>
                    <p className="font-medium text-sm text-white">
                      {cred.site}
                    </p>
                    <p className="text-xs text-gray-400">{cred.username}***</p>
                  </div>
                  <div>
                    <button className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-800 text-white rounded-xl duration-300">
                      <EyeIcon className="w-4 h-4" />
                      View
                    </button>
                  </div>
                </div>
              ))}
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
