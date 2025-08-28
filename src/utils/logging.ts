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

export const setAlreadyAutofilledWebsites = (
  origin: string
  // cred: {}
) => {
  chrome.storage.local.set({
    // [`autofill:state:${origin}`]: btoa(JSON.stringify(cred)),
    [`autofill:state:${origin}`]: "filled",
  });
};

export const getAlreadyAutofilledWebsites = (
  origin: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    const key = `autofill:state:${origin}`;
    chrome.storage.local.get([key], (result) => {
      // resolve(
      //   atob(JSON.parse(result[key])) === "success"
      //     ? true
      //     : false
      // );
      resolve(!!result[key]);
    });
  });
};
