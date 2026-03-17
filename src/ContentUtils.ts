export type CredentialsV1 = {
  data?: string;
  hostname?: string;
  domain?: string;
  additionalFields?: Record<string, string>;
};

export type PersonalInfoV1 = {
  data: string;
};

export const sendLogtoBack = ({
  message,
  level,
  object,
}: {
  message: string;
  level: "info" | "success" | "warning" | "error";
  object?: Record<string, unknown>;
}) => {
  const normalized = level === "warning" ? "info" : level;
  try {
    chrome.runtime.sendMessage({
      type: "LOG_MESSAGE",
      payload: {
        level: normalized,
        log: message,
        hostname: window.location.hostname,
        object,
      },
    });
  } catch {
    // Ignore logging errors in content script
  }
};

export const findCredentialsByDomain = async (
  credentialsData: CredentialsV1[] | null,
  currentUrl: string
): Promise<CredentialsV1[]> => {
  if (!credentialsData || credentialsData.length === 0) return [];
  let hostname = "";
  try {
    hostname = new URL(currentUrl).hostname;
  } catch {
    hostname = currentUrl;
  }
  return credentialsData.filter((cred) => {
    const domain = cred.hostname || cred.domain || "";
    return domain && hostname.includes(domain);
  });
};
