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
  chrome.storage.local.set({ [`autofill:state:${origin}`]: cred });
};

export const getAlreadyAutofilledWebsites = (
  origin: string
): Promise<boolean> => {
  return new Promise((resolve) => {
    chrome.storage.local.get([`autofill:state:${origin}`], (result) => {
      console.log(
        result[`autofill:state:${origin}`],
        `autofill:state:${origin}`,
        new Date().getMilliseconds(),
        "1111111111"
      );
      resolve(result[`autofill:state:${origin}`] === "success" ? true : false);
    });
  });
};
