import { useState, useEffect } from "react";
import type { Credential, PersonalInfo, LogEntry, FormStatus } from "../types";
import { getLoggingEnabled, setLoggingEnabled } from "../utils/logging";

export const useExtensionStatus = (
  initialCredentials: Credential[],
  initialPersonalInfo: PersonalInfo,
) => {
  const [currentSite, setCurrentSite] = useState<string>("");
  const [enableLogs, setEnableLogs] = useState(false);
  const [logMessages, setLogMessages] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState({ type: "", message: "" });
  const [formStatus, setFormStatus] = useState<FormStatus>({
    registration: false,
    checked: false,
  });
  const [credentials, setCredentials] =
    useState<Credential[]>(initialCredentials);
  const [personalInfo, setPersonalInfo] =
    useState<PersonalInfo>(initialPersonalInfo);
  const [storageReady, setStorageReady] = useState(false);
  const [errorFromBackground, setErrorFromBackground] = useState(false);

  const refreshFormStatus = () => {
    chrome.runtime.sendMessage({ type: "GET_FORM_STATUS" }, (res) => {
      if (chrome.runtime.lastError) {
        setFormStatus({ registration: false, checked: true });
        return;
      }
      setFormStatus({
        registration: !!res?.data?.registration,
        checked: true,
      });
    });
  };

  useEffect(() => {
    // Initial data fetch from Chrome Storage
    chrome.storage.local.get(
      [
        "credentials",
        "personalInfo",
        "openAddCredentials",
        "prefillCredentialSite",
      ],
      (result) => {
        if (Array.isArray(result?.credentials))
          setCredentials(result.credentials);
        if (result?.personalInfo) setPersonalInfo(result.personalInfo);
        setStorageReady(true);
      },
    );

    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url) {
        try {
          const url = new URL(tabs[0].url);
          setCurrentSite(url.hostname);
          refreshFormStatus();
        } catch (err) {
          console.error("Failed to parse URL", err);
        }
      }
    });

    // Logging listeners
    getLoggingEnabled().then(setEnableLogs);

    const handleMessages = (message: any) => {
      if (message.type === "LOG_MESSAGE") {
        setLogMessages((prev) => [...prev, message.payload]);
      }
      if (message.type === "STATUS") {
        setStatus({
          type: message.payload?.type,
          message: message.payload?.message,
        });
      }
    };

    chrome.runtime.onMessage.addListener(handleMessages);
    return () => chrome.runtime.onMessage.removeListener(handleMessages);
  }, []);

  // Sync state to storage
  useEffect(() => {
    if (!storageReady) return;
    chrome.storage.local.set({ credentials, personalInfo });
  }, [credentials, personalInfo, storageReady]);

  const toggleDebugMode = async () => {
    const newState = !enableLogs;
    setEnableLogs(newState);
    await setLoggingEnabled(newState);
    chrome.runtime.sendMessage(
      { type: "DEBUG_TOGGLE", enabled: newState },
      (res) => {
        if (chrome.runtime.lastError || res?.status !== "success") {
          setErrorFromBackground(true);
        }
      },
    );
  };

  return {
    currentSite,
    enableLogs,
    logMessages,
    status,
    formStatus,
    credentials,
    setCredentials,
    personalInfo,
    setPersonalInfo,
    errorFromBackground,
    toggleDebugMode,
    refreshFormStatus,
  };
};
