export interface Credential {
  site: string;
  username?: string;
  email?: string;
  password?: string;
}

export interface PersonalInfo {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  dob?: string;
  additionalFields?: Record<string, string>;
}

export type TabType = "site" | "vault" | "personal" | "developer";

export interface LogEntry {
  level: "info" | "success" | "error";
  log: string;
  hostname: string;
}

export interface FormStatus {
  registration: boolean;
  checked: boolean;
}
