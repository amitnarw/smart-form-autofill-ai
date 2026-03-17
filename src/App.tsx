import { useState, useEffect } from "react";
import "./App.css";

import SiteTab from "./components/SiteTab";
import VaultTab from "./components/VaultTab";
import PersonalTab from "./components/PersonalTab";
import DeveloperTab from "./components/DeveloperTab";

import { useExtensionStatus } from "./hooks/useExtensionStatus";

import type { Credential, TabType } from "./types";

import credentialsData from "./data/credentials.json";
import personalInfoData from "./data/personalInfo.json";
import {
  getAlreadyAutofilledWebsites,
  setAlreadyAutofilledWebsites,
} from "./utils/logging";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("site");
  const [vaultSearch, setVaultSearch] = useState("");
  const [showAddCredential, setShowAddCredential] = useState(false);
  const [alreadyFilled, setAlreadyFilled] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<Record<string, string>>(
    {},
  );
  const [personalFillStatus, setPersonalFillStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  const [credentialForm, setCredentialForm] = useState<Credential>({
    site: "",
    username: "",
    email: "",
    password: "",
  });
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const {
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
  } = useExtensionStatus(credentialsData as Credential[], personalInfoData);

  useEffect(() => {
    if (currentSite) {
      getAlreadyAutofilledWebsites(currentSite).then(setAlreadyFilled);
    }
  }, [currentSite]);

  const handleFill = (cred: Credential) => {
    setAutofillStatus((prev) => ({ ...prev, [cred.site]: "loading" }));
    chrome.runtime.sendMessage({ type: "FILL_FIELDS", data: cred }, (res) => {
      if (chrome.runtime.lastError || res?.status !== "success") {
        setAutofillStatus((prev) => ({ ...prev, [cred.site]: "error" }));
        return;
      }
      setAutofillStatus((prev) => ({ ...prev, [cred.site]: "success" }));
      setAlreadyAutofilledWebsites(currentSite);
      setAlreadyFilled(true);
      setTimeout(
        () => setAutofillStatus((prev) => ({ ...prev, [cred.site]: "idle" })),
        3000,
      );
    });
  };

  const handleFillPersonalInfo = () => {
    setPersonalFillStatus("loading");
    chrome.runtime.sendMessage(
      { type: "FILL_PERSONAL_INFO", data: personalInfo },
      (res) => {
        if (chrome.runtime.lastError || res?.status !== "success") {
          setPersonalFillStatus("error");
          return;
        }
        setPersonalFillStatus("success");
        setTimeout(() => setPersonalFillStatus("idle"), 3000);
      },
    );
  };

  const handleAddCredential = () => {
    if (!credentialForm.site || !credentialForm.password) return;
    
    if (editingIndex !== null) {
      setCredentials((prev) => {
        const next = [...prev];
        next[editingIndex] = { ...credentialForm };
        return next;
      });
    } else {
      setCredentials((prev) => [...prev, { ...credentialForm }]);
    }
    
    setCredentialForm({ site: "", username: "", email: "", password: "" });
    setEditingIndex(null);
    setShowAddCredential(false);
  };

  const handleEditClick = (index: number) => {
    setCredentialForm(credentials[index]);
    setEditingIndex(index);
    setShowAddCredential(true);
  };

  const handleDeleteCredential = (index: number) => {
    setCredentials((prev) => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setCredentialForm({ site: "", username: "", email: "", password: "" });
    }
  };

  const matchingCred = credentials.find((c) => currentSite.includes(c.site));

  return (
    <div className="w-[380px] h-[520px] bg-gray-950 text-gray-100 flex flex-col overflow-hidden font-sans border border-gray-800">
      {/* Header */}
      <header className="px-5 py-4 bg-gray-900/50 border-b border-gray-800 backdrop-blur-md flex items-center justify-between">
        <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          AI AutoFill
        </h1>
        <button
          onClick={() => chrome.tabs.reload()}
          className="text-[10px] px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded-md transition-all text-gray-400 border border-gray-700"
        >
          Reload Page
        </button>
      </header>

      {/* Navigation */}
      <nav className="flex px-4 py-2 bg-gray-900/30 border-b border-gray-800 gap-1">
        {(["site", "vault", "personal", "developer"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all capitalize ${
              activeTab === tab
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-inner"
                : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === "site" && (
          <SiteTab
            currentSite={currentSite}
            matchingCred={matchingCred}
            autofillStatus={autofillStatus}
            alreadyFilled={alreadyFilled}
            status={status}
            handleFill={handleFill}
            handleOpenAddCredentials={() => {
              setActiveTab("vault");
              setShowAddCredential(true);
              setCredentialForm((prev) => ({ ...prev, site: currentSite }));
            }}
          />
        )}
        {activeTab === "vault" && (
          <VaultTab
            credentials={credentials}
            vaultSearch={vaultSearch}
            setVaultSearch={setVaultSearch}
            showAddCredential={showAddCredential}
            setShowAddCredential={setShowAddCredential}
            credentialForm={credentialForm}
            setCredentialForm={setCredentialForm}
            handleAddCredential={handleAddCredential}
            editingIndex={editingIndex}
            handleEditClick={handleEditClick}
            handleDeleteCredential={handleDeleteCredential}
            setEditingIndex={setEditingIndex}
          />
        )}
        {activeTab === "personal" && (
          <PersonalTab
            personalInfo={personalInfo}
            setPersonalInfo={setPersonalInfo}
            formStatus={formStatus}
            personalFillStatus={personalFillStatus}
            handleFillPersonalInfo={handleFillPersonalInfo}
          />
        )}
        {activeTab === "developer" && (
          <DeveloperTab
            enableLogs={enableLogs}
            handleLogsVisibility={toggleDebugMode}
            logMessages={logMessages}
            errorFromBackground={errorFromBackground}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="px-4 py-2 bg-gray-900/50 border-t border-gray-800 flex justify-center">
        <span className="text-[9px] text-gray-600 items-center flex gap-1">
          Securely powered by{" "}
          <span className="text-blue-500/50 font-bold italic">AI</span>
        </span>
      </footer>
    </div>
  );
}

export default App;
