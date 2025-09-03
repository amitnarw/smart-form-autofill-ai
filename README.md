
  

````markdown

# Chrome Extension (React + Vite)

  

This is a Chrome extension built with **Vite + React**. It's designed to test and showcase autofill functionality using stored credentials, along with simple debugging tools.

  

This guide will walk you through the steps to **build**, **install**, and **use** the extension on your desktop.

  

---

  

## 🛠 Project Setup

  

### 📦 Prerequisites

Make sure you have **Node.js** installed: [https://nodejs.org](https://nodejs.org)

  

We recommend using **pnpm**, but **npm** works too.

  

>  **pnpm (recommended):**

Install globally (if not already):

>  npm install -g pnpm
  

---

  

### 📁 Install Dependencies

Open a terminal in this project folder and run:

  

#### Using **pnpm**:

pnpm  install

````

  

#### OR using **npm**:

  

```bash

npm  install

```

  

---

  

### ❗️Important: Development Server Limitation

  

You **cannot run this extension in a development server** (`npm run dev` or `pnpm run dev`) because it relies on **Chrome extension APIs** like `chrome.tabs`, `chrome.runtime`, etc., which **only work in the actual Chrome extension context**, not in a browser tab or dev server.

  

> So, always build and load the extension via the steps below.

  

---

  

### 🔨 Build the Extension

  

Run the build command:

  

#### Using **pnpm**:

  

```bash

pnpm  run  build

```

  

#### OR using **npm**:

  

```bash

npm  run  build

```

  

> This will create a `dist/` folder that contains everything needed for the Chrome extension.

>

> The `public/` folder (which includes `manifest.json` and icon files) will be automatically copied into the `dist/` folder during build.

  

---

  

## 🧩 Load the Extension in Chrome

  

1. Open **Google Chrome**.

2. In the address bar, go to:

  

```

chrome://extensions

```

3.  **Enable** the **Developer Mode** toggle (top right).

4. Click the **"Load unpacked"** button.

5. Select the `dist/` folder inside your project directory.

  

✅ The extension should now appear in your extension list.

  

---

  

## 🚀 How to Use

  

Once installed, click the extension icon from the toolbar. It has **three tabs**:

  

---

  

### 1. 🟠 Site Tab

  

* Shows the **current website** you're on.

* Tells you whether **credentials exist** for this site.

* If credentials **are not found**, it will say so.

* If credentials **are found**:

  

* You'll see some credential info.

* Click **"Apply"** to autofill the input fields.

* Autofilled fields will have an **orange border**, so you can visually identify them.

* If you reload the page or reopen the extension, it will say the credentials were already filled earlier.

  

---

  

### 2. 🔐 Vault Tab

  

* Lists **all stored credentials**.

* Has a **"View"** button for each (non-functional currently – for future use).

* Contains a **search bar** (not functional yet – placeholder for future improvements).

  

---

  

### 3. 🛠 Developer Tab

  

* Contains a **Debug Mode Toggle**:

  

* When ON:

  

* Logs show in both the browser console and this tab.

* Logs in this tab are **minified** and **disappear** when the extension is closed.

* Logs in the browser console are **detailed** and **persist**.

  

---

  

## ✏️ Modify or Add Credentials

  

All the available credentials are currently **hardcoded**.

  

You can **edit, delete, or add new credentials** directly in the source code.

  

### 🔍 File to Edit:

  

```

src/App.tsx

```

  

### 🧩 Look for the `credentials` array:

  

```tsx

const  credentials = [

{

site:  "example.com",

username:  "john_doe",

password:  "password123",

},

{

site:  "another-site.com",

email:  "email@domain.com",

password:  "secure123",

},

// Add more entries here

];

```

  

### 📌 Rules:

  

* Each object represents **one website**.

* You **must include** the `"site"` field (domain only, like `example.com`).

* You can add any fields you want it to autofill (e.g., `username`, `email`, `password`).

* After editing credentials, **rebuild the project** (`pnpm run build` or `npm run build`) and **reload the extension** in Chrome.

  

---

  

## 💾 Storage & Privacy

  

* The extension uses a **separate local storage** area designed **only for Chrome extensions**.

* This means:

  

* No websites or other extensions can access this data.

* It's isolated for privacy and security.

  

### Storage Format

  

* The extension remembers which sites had credentials autofilled.

  

* Format used in storage:

  

```

autofill:state:<origin>

```

  

Example: `autofill:state:https://example.com`

  

* It also stores whether **debug mode** is ON or OFF.

  

---

  

## 🧪 Notes for Testing

  

* The extension may ask you to **reload the page** the first time you open it on a site.

* This is necessary because it can **only capture and interact with the input fields** after the extension is installed and the page is reloaded.

* After reloading, open the extension again to use it.

  

---

  

## ❓ Need Help?

  

If something doesn’t work:

  

* Ensure you’ve built the project (`pnpm run build` or `npm run build`).

* Make sure you selected the **correct `dist/` folder** when loading the extension.

* Reload the page if the extension asks for it.

* Check browser console logs (turn on Debug mode from the Developer tab).

  

---

  

## 📂 Project Structure Overview

  

```

├── public/ # Contains icons and manifest.json

│ ├── manifest.json

│ └── icons/

├── src/ # React + Vite frontend code

│ └── App.tsx # Hardcoded credentials live here

├── dist/ # Built extension (after running build)

├── package.json

├── README.md

```

  