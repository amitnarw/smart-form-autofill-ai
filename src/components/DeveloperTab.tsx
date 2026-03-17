import React from "react";
import { XCircleIcon } from "@heroicons/react/24/solid";
import type { LogEntry } from "../types";

interface DeveloperTabProps {
  enableLogs: boolean;
  handleLogsVisibility: () => void;
  logMessages: LogEntry[];
  errorFromBackground: boolean;
}

const DeveloperTab: React.FC<DeveloperTabProps> = ({
  enableLogs,
  handleLogsVisibility,
  logMessages,
  errorFromBackground,
}) => {
  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-xl">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-white">Debug Mode</span>
          <span className="text-[10px] text-gray-500">
            Log extension activity to console
          </span>
        </div>
        <button
          onClick={handleLogsVisibility}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
            enableLogs ? "bg-blue-600" : "bg-gray-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              enableLogs ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {errorFromBackground && (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-900/50 rounded-xl text-red-400 text-xs">
          <XCircleIcon className="w-5 h-5 flex-shrink-0" />
          <span>
            Background connection failed. Try reloading the extension.
          </span>
        </div>
      )}

      <div className="flex-1 bg-black/40 border border-gray-700 rounded-xl p-2 font-mono text-[10px] overflow-y-auto min-h-[150px]">
        {logMessages.length > 0 ? (
          logMessages
            .slice()
            .reverse()
            .map((msg, idx) => (
              <div key={idx} className="mb-1 last:mb-0">
                <span
                  className={`font-bold ${
                    msg.level === "success"
                      ? "text-green-500"
                      : msg.level === "error"
                        ? "text-red-500"
                        : "text-blue-400"
                  }`}
                >
                  [{msg.level.toUpperCase()}]
                </span>{" "}
                <span className="text-gray-500">[{msg.hostname}]</span>{" "}
                <span className="text-gray-300">{msg.log}</span>
              </div>
            ))
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600 italic">
            No logs recorded yet...
          </div>
        )}
      </div>
    </div>
  );
};

export default DeveloperTab;
