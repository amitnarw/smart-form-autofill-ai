import React from "react";
import {
  CursorArrowRaysIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/solid";
import type { Credential } from "../types";

interface SiteTabProps {
  currentSite: string;
  matchingCred?: Credential;
  autofillStatus: Record<string, string>;
  alreadyFilled: boolean;
  status: { type: string; message: string };
  handleFill: (cred: Credential) => void;
  handleOpenAddCredentials: () => void;
}

const SiteTab: React.FC<SiteTabProps> = ({
  currentSite,
  matchingCred,
  autofillStatus,
  alreadyFilled,
  status,
  handleFill,
  handleOpenAddCredentials,
}) => {
  const currentStatus = matchingCred
    ? autofillStatus[matchingCred.site] || "idle"
    : "idle";

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
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

          <div className="flex items-center">
            {currentStatus === "loading" ? (
              <div className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 rounded-xl text-white">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Applying...
              </div>
            ) : currentStatus === "success" ? (
              <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
                <CheckCircleIcon className="w-4 h-4" />
                Applied!
              </div>
            ) : currentStatus === "error" ? (
              <div className="flex items-center gap-1 text-red-400 text-xs font-medium">
                <XCircleIcon className="w-4 h-4" />
                Failed!
              </div>
            ) : (
              <button
                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl duration-300"
                onClick={() => handleFill(matchingCred)}
              >
                <CursorArrowRaysIcon className="w-4 h-4" />
                Apply
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 p-3 bg-gray-800/50 rounded-xl border border-gray-700">
          <p className="text-sm text-red-400">
            No credentials found for this site.
          </p>
          <button
            className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
            onClick={handleOpenAddCredentials}
          >
            Add
          </button>
        </div>
      )}

      {alreadyFilled && (
        <p className="text-green-400/80 text-xs mt-2 flex items-center gap-1">
          <CheckCircleIcon className="w-3 h-3" />
          Credentials already filled on this page
        </p>
      )}

      {status?.message && (
        <p
          className={`text-sm mt-4 p-2 rounded-lg ${
            status.type === "error"
              ? "bg-red-900/20 text-red-400"
              : status.type === "success"
                ? "bg-green-900/20 text-green-400"
                : "bg-blue-900/20 text-blue-400"
          }`}
        >
          {status.message}
        </p>
      )}
    </div>
  );
};

export default SiteTab;
