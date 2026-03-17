import React, { useState } from "react";
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CursorArrowRaysIcon,
  PlusIcon,
  PencilSquareIcon,
} from "@heroicons/react/24/solid";
import type { PersonalInfo } from "../types";
import Modal from "./Modal";

interface PersonalTabProps {
  personalInfo: PersonalInfo;
  setPersonalInfo: React.Dispatch<React.SetStateAction<PersonalInfo>>;
  formStatus: { registration: boolean; checked: boolean };
  personalFillStatus: "idle" | "loading" | "success" | "error";
  handleFillPersonalInfo: () => void;
}

const PersonalTab: React.FC<PersonalTabProps> = ({
  personalInfo,
  setPersonalInfo,
  formStatus,
  personalFillStatus,
  handleFillPersonalInfo,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState<"add" | "edit">("add");
  const [currentField, setCurrentField] = useState<{
    key: string;
    value: string;
    isCustom: boolean;
  } | null>(null);

  const [fieldKey, setFieldKey] = useState("");
  const [fieldValue, setFieldValue] = useState("");

  const handleOpenAdd = () => {
    setEditMode("add");
    setFieldKey("");
    setFieldValue("");
    setCurrentField(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (key: string, value: string, isCustom: boolean) => {
    setEditMode("edit");
    setFieldKey(key);
    setFieldValue(value);
    setCurrentField({ key, value, isCustom });
    setIsModalOpen(true);
  };

  const handleSaveField = () => {
    if (!fieldKey.trim()) return;

    setPersonalInfo((prev) => {
      const next = { ...prev };
      if (editMode === "edit" && currentField) {
        // If it was custom and the key changed, remove old
        if (currentField.isCustom && currentField.key !== fieldKey.trim()) {
          const newAdditional = { ...(next.additionalFields || {}) };
          delete newAdditional[currentField.key];
          next.additionalFields = newAdditional;
        }
      }

      // Base fields map
      const baseFields: Array<keyof PersonalInfo> = [
        "name",
        "email",
        "phone",
        "address",
        "dob",
      ];
      const trimmedKey = fieldKey.trim().toLowerCase();

      const baseField = baseFields.find((f) => f === trimmedKey);

      if (baseField) {
        (next as any)[baseField] = fieldValue.trim();
      } else {
        next.additionalFields = {
          ...(next.additionalFields || {}),
          [fieldKey.trim()]: fieldValue.trim(),
        };
      }
      return next;
    });

    setIsModalOpen(false);
  };

  const allFields = [
    { label: "Name", key: "name", value: personalInfo.name, isCustom: false },
    { label: "Email", key: "email", value: personalInfo.email, isCustom: false },
    { label: "Phone", key: "phone", value: personalInfo.phone, isCustom: false },
    {
      label: "Address",
      key: "address",
      value: personalInfo.address,
      isCustom: false,
    },
    { label: "DOB", key: "dob", value: personalInfo.dob, isCustom: false },
    ...Object.entries(personalInfo.additionalFields || {}).map(
      ([key, value]) => ({
        label: key,
        key,
        value: value as string,
        isCustom: true,
      }),
    ),
  ];

  return (
    <div className="space-y-4">
      <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-xl">
        <div className="flex items-center justify-between mb-3 border-b border-gray-700 pb-3">
          <div>
            <p className="font-medium text-sm text-white">
              {personalInfo.name || "Default Identity"}
            </p>
            <p className="text-xs text-gray-400">{personalInfo.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenAdd}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 hover:border-blue-500/50"
              title="Add new field"
            >
              <PlusIcon className="w-4 h-4" />
            </button>

            {formStatus.checked && formStatus.registration ? (
              <div>
                {personalFillStatus === "loading" ? (
                  <div className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 rounded-xl text-white">
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    Applying...
                  </div>
                ) : personalFillStatus === "success" ? (
                  <div className="flex items-center gap-1 text-green-400 text-xs font-medium">
                    <CheckCircleIcon className="w-4 h-4" />
                    Applied!
                  </div>
                ) : personalFillStatus === "error" ? (
                  <div className="flex items-center gap-1 text-red-400 text-xs font-medium">
                    <XCircleIcon className="w-4 h-4" />
                    Failed!
                  </div>
                ) : (
                  <button
                    className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors shadow-sm shadow-blue-500/20"
                    onClick={handleFillPersonalInfo}
                  >
                    <CursorArrowRaysIcon className="w-3.5 h-3.5" />
                    Apply
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          {allFields.map(
            (field) =>
              (field.value || field.isCustom) && (
                <div
                  key={field.key}
                  className="flex items-center justify-between group p-2 rounded-lg hover:bg-gray-700/30 transition-colors"
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">
                      {field.label}
                    </span>
                    <span className="text-xs text-gray-200 truncate font-medium">
                      {field.value || "—"}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      handleOpenEdit(field.key, field.value || "", field.isCustom)
                    }
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all"
                  >
                    <PencilSquareIcon className="w-3.5 h-3.5" />
                  </button>
                </div>
              ),
          )}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editMode === "add" ? "Add Information" : "Edit Information"}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500 flex items-center justify-between">
              Field Key
              {currentField && !currentField.isCustom && (
                <span className="text-blue-500 lowercase font-medium">
                  Standard Field
                </span>
              )}
            </label>
            <input
              type="text"
              value={fieldKey}
              onChange={(e) => setFieldKey(e.target.value)}
              disabled={!!(currentField && !currentField.isCustom)}
              placeholder="e.g. Occupation"
              className="w-full p-2.5 text-xs bg-gray-950 border border-gray-800 text-gray-100 rounded-xl focus:outline-none focus:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider font-bold text-gray-500">
              Value
            </label>
            <input
              type="text"
              autoFocus
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              placeholder="Enter value..."
              onKeyDown={(e) => e.key === "Enter" && handleSaveField()}
              className="w-full p-2.5 text-xs bg-gray-950 border border-gray-800 text-gray-100 rounded-xl focus:outline-none focus:border-blue-500/50 transition-all"
            />
          </div>

          <button
            onClick={handleSaveField}
            disabled={!fieldKey.trim()}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:shadow-none mt-2"
          >
            {editMode === "add" ? "Add to Identity" : "Update Value"}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default PersonalTab;

