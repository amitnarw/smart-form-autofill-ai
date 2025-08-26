export const setLoggingEnabled = (status: boolean) => {
  chrome.storage.local.set({ loggingEnabled: status });
};

export const getLoggingEnabled = (): Promise<boolean> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(["loggingEnabled"], (result) => {
      resolve(result.loggingEnabled ?? false);
    });
  });
};

export const setAlreadyAutofilledWebsites = (origin: string, cred: {}) => {
  chrome.storage.local.set({
    [`autofill:state:${origin}`]: btoa(JSON.stringify(cred)),
  });
};

export const getAlreadyAutofilledWebsites = (
  origin: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    chrome.storage.local.get([`autofill:state:${origin}`], (result) => {
      resolve(atob(JSON.parse(result[`autofill:state:${origin}`])) === "success" ? true : false);
    });
  });
};
