import React, { useState } from "react";
import { EyeIcon, EyeSlashIcon, PlusIcon, PencilSquareIcon, TrashIcon } from "@heroicons/react/24/solid";
import type { Credential } from "../types";
import Modal from "./Modal";

interface VaultTabProps {
  credentials: Credential[];
  vaultSearch: string;
  setVaultSearch: (val: string) => void;
  showAddCredential: boolean;
  setShowAddCredential: (val: boolean) => void;
  credentialForm: Credential;
  setCredentialForm: (val: React.SetStateAction<Credential>) => void;
  handleAddCredential: () => void;
  editingIndex: number | null;
  handleEditClick: (idx: number) => void;
  handleDeleteCredential: (idx: number) => void;
  setEditingIndex: (val: number | null) => void;
}

const VaultTab: React.FC<VaultTabProps> = ({
  credentials,
  vaultSearch,
  setVaultSearch,
  showAddCredential,
  setShowAddCredential,
  credentialForm,
  setCredentialForm,
  handleAddCredential,
  editingIndex,
  handleEditClick,
  handleDeleteCredential,
  setEditingIndex,
}) => {
  const [expandedCredentialSite, setExpandedCredentialSite] = useState<
    string | null
  >(null);

  const filteredCredentials = credentials.filter((cred) => {
    const search = vaultSearch.trim().toLowerCase();
    if (!search) return true;
    return (
      cred.site.toLowerCase().includes(search) ||
      (cred.username || "").toLowerCase().includes(search) ||
      (cred.email || "").toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={vaultSearch}
          onChange={(e) => setVaultSearch(e.target.value)}
          placeholder="Search vault..."
          className="flex-1 p-2 text-sm bg-gray-800 border border-gray-700 placeholder-gray-500 text-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          className="p-2 rounded-xl transition-colors bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20"
          onClick={() => setShowAddCredential(true)}
          title="Add New"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3 pb-4">
        {filteredCredentials.map((cred, idx) => (
          <div
            key={idx}
            className="p-3 bg-gray-800 border border-gray-700 hover:border-blue-500/50 transition rounded-xl group relative overflow-hidden"
          >
            <div className="flex justify-between items-start">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-white truncate">
                  {cred.site}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {cred.username || cred.email || "No identifier"}
                </p>
              </div>
              <button
                className="ml-2 p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                onClick={() =>
                  setExpandedCredentialSite(
                    expandedCredentialSite === cred.site ? null : cred.site,
                  )
                }
              >
                {expandedCredentialSite === cred.site ? (
                  <EyeSlashIcon className="w-4 h-4" />
                ) : (
                  <EyeIcon className="w-4 h-4" />
                )}
              </button>
            </div>

            {expandedCredentialSite === cred.site && (
              <div className="mt-3 pt-3 border-t border-gray-700 space-y-2 animate-in fade-in zoom-in-95">
                {cred.username && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">Username</span>
                    <span className="text-gray-200 font-mono">
                      {cred.username}
                    </span>
                  </div>
                )}
                {cred.email && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">Email</span>
                    <span className="text-gray-200 font-mono">
                      {cred.email}
                    </span>
                  </div>
                )}
                {cred.password && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400 font-medium">Password</span>
                    <span className="text-gray-200 font-mono tracking-widest text-[10px]">
                      ••••••••
                    </span>
                  </div>
                )}
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => handleDeleteCredential(idx)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-red-600/10 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-all border border-red-500/20"
                  >
                    <TrashIcon className="w-3 h-3" />
                    Delete
                  </button>
                  <button
                    onClick={() => handleEditClick(idx)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white rounded-lg transition-all border border-blue-500/20"
                  >
                    <PencilSquareIcon className="w-3 h-3" />
                    Edit
                  </button>
                </div>
              </div>
            )}
            
            {/* Decoration */}
            <div className={`absolute top-0 left-0 w-1 h-full bg-blue-500 transition-opacity ${expandedCredentialSite === cred.site ? "opacity-100" : "opacity-0"}`} />
          </div>
        ))}
        {filteredCredentials.length === 0 && (
          <div className="text-center py-12 flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-600 mb-2">
              <EyeSlashIcon className="w-6 h-6 opacity-20" />
            </div>
            <p className="text-gray-500 text-sm">No credentials found</p>
          </div>
        )}
      </div>

      <Modal
        isOpen={showAddCredential}
        onClose={() => {
          setShowAddCredential(false);
          setEditingIndex(null);
          setCredentialForm({ site: "", username: "", email: "", password: "" });
        }}
        title={editingIndex !== null ? "Edit Credential" : "Add New Credential"}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
              Site URL
            </label>
            <input
              type="text"
              value={credentialForm.site}
              onChange={(e) =>
                setCredentialForm((prev) => ({ ...prev, site: e.target.value }))
              }
              placeholder="e.g. google.com"
              className="w-full p-2.5 text-xs bg-gray-950 border border-gray-800 text-gray-100 rounded-xl focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                Username
              </label>
              <input
                type="text"
                value={credentialForm.username || ""}
                onChange={(e) =>
                  setCredentialForm((prev) => ({
                    ...prev,
                    username: e.target.value,
                  }))
                }
                placeholder="User"
                className="w-full p-2.5 text-xs bg-gray-950 border border-gray-800 text-gray-100 rounded-xl focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
                Email
              </label>
              <input
                type="email"
                value={credentialForm.email || ""}
                onChange={(e) =>
                  setCredentialForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
                placeholder="email@"
                className="w-full p-2.5 text-xs bg-gray-950 border border-gray-800 text-gray-100 rounded-xl focus:outline-none focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
              Password
            </label>
            <input
              type="password"
              value={credentialForm.password || ""}
              onChange={(e) =>
                setCredentialForm((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              placeholder="••••••••"
              className="w-full p-2.5 text-xs bg-gray-950 border border-gray-800 text-gray-100 rounded-xl focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>

          <button
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 mt-2"
            onClick={handleAddCredential}
            disabled={!credentialForm.site || !credentialForm.password}
          >
            Save Credential
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default VaultTab;

