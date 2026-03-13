# AI-Powered Chrome Extension for Smart Form Autofill

A modern, AI-powered Chrome extension built with React + TypeScript + Vite that simplifies form filling by automatically detecting and populating login and registration fields using stored credentials.

## 🎯 Project Overview

This extension streamlines the login process by:
- Detecting form fields on any website
- Matching stored credentials to the current domain
- Automatically filling in username/email and password fields
- Providing a user-friendly interface with credential management
- Offering debugging tools for developers

## ✨ Core Features

### 🚀 Key Functionality
- **Automatic Credential Matching**: Detects current website and matches stored credentials
- **Smart Form Detection**: Identifies visible input fields (including in iframes and shadow DOM)
- **One-Click Autofill**: Simple "Apply" button to fill all detected fields
- **Credential Vault**: Browse and manage all stored credentials in one place
- **Debug Mode**: Comprehensive logging for development and troubleshooting
- **AI-Powered Analysis**: Optional AI integration for advanced field detection (coming soon)

### 🎨 User Interface
- **Site Tab**: Shows current website and matching credentials with autofill button
- **Vault Tab**: Lists all stored credentials with search functionality
- **Developer Tab**: Debug mode toggle and real-time console logs

### 🔒 Security Features
- Chrome extension isolated storage
- Credential state tracking (prevents double filling)
- Visibility detection to avoid hidden fields
- Error handling and status notifications

## 🛠 System Requirements

- **Google Chrome**: Version 88 or later
- **Node.js**: Version 16 or higher
- **Package Manager**: pnpm (recommended) or npm

## 📦 Installation

### Step 1: Clone and Install Dependencies

```bash
# Clone the repository
git clone <repository-url>
cd <project-directory>

# Install dependencies with pnpm (recommended)
pnpm install

# OR using npm
npm install
```

### Step 2: Build the Extension

```bash
# Build with pnpm
pnpm run build

# OR using npm
npm run build
```

This creates a `dist/` folder containing the complete extension.

### Step 3: Load in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer Mode** (toggle in top right)
3. Click **Load unpacked** and select the `dist/` folder
4. The extension will appear in your Chrome toolbar

## 🚀 Usage Guide

### Basic Usage

1. **Visit a Website**: Navigate to any login page
2. **Open Extension**: Click the extension icon in Chrome toolbar
3. **Check for Credentials**: The "Site" tab shows if credentials exist
4. **Autofill**: Click "Apply" to fill in the login fields
5. **Verify**: Autofilled fields are highlighted with an orange border

### Advanced Features

#### Debug Mode
1. Switch to "Developer" tab
2. Toggle "Debug Mode" to ON
3. View detailed logs in both extension and browser console
4. Use logs to troubleshoot field detection issues

#### Credential Management
- The "Vault" tab displays all stored credentials
- Use search bar to find specific websites
- "View" button provides credential details (placeholder for future enhancement)

## ⚙️ Configuration

### Modifying Credentials

All credentials are currently hardcoded in `src/App.tsx`. To add or edit credentials:

```typescript
// src/App.tsx
const credentials = [
  {
    site: "example.com",
    username: "john_doe",
    email: "john@example.com", // Optional
    password: "secure_password123"
  },
  // Add more credentials here
];
```

**Rules**:
- Each entry must have a `site` field (domain name without protocol)
- Include at least `username` or `email` and `password`
- After changes, rebuild and reload the extension

### Build Configuration

The extension uses Vite with custom build settings in `vite.config.ts`:

```typescript
// vite.config.ts
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        background: resolve(__dirname, 'src/background.ts'),
        content: resolve(__dirname, 'src/content.ts'),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});
```

## 📁 Project Structure

```
├── public/                 # Static assets and Chrome extension manifest
│   ├── manifest.json      # Extension configuration
│   └── icons/             # Extension icons (16x16, 48x48, 128x128)
├── src/                   # Source code
│   ├── App.tsx            # Main React component with UI and credentials
│   ├── background.ts      # Chrome extension background script
│   ├── content.ts         # Content script for DOM manipulation
│   ├── index.css          # Global styles with Tailwind CSS
│   ├── main.tsx           # Entry point for React app
│   └── utils/             # Utility functions
│       ├── ai-vercel.ts   # AI integration (Vercel AI SDK)
│       └── logging.ts     # Logging and storage management
├── dist/                  # Built extension output
├── package.json           # Project dependencies
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite build configuration
└── README.md             # Project documentation
```

## 🧪 Technical Details

### Field Detection Algorithm

The extension uses advanced DOM traversal:

1. **Shadow DOM Support**: Detects inputs within shadow DOM boundaries
2. **IFrame Handling**: Searches for inputs in nested iframes
3. **Visibility Detection**: Ignores hidden or zero-size inputs
4. **Role Classification**: Identifies fields by type (username, email, password, etc.)
5. **Label Matching**: Associates inputs with their corresponding labels

### Communication Architecture

- **Background Script**: Handles inter-component communication
- **Content Script**: Manipulates DOM and detects fields
- **Popup UI**: Provides user interface for interaction
- **Storage**: Chrome extension local storage for state management

## 🔧 Development

### Running Development Server (Not Recommended for Testing)

⚠️ **Note**: Chrome extension APIs don't work in dev server mode. Always build and install as unpacked extension.

```bash
# Development server (for UI testing only)
pnpm run dev
```

### Linting

```bash
# Run ESLint
pnpm run lint
```

### Preview Build

```bash
# Preview production build
pnpm run preview
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `pnpm run lint` to ensure code quality
5. Build and test your changes
6. Submit a pull request

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 📞 Contact

For questions or support, please reach out through:
- Issue tracker: [GitHub Issues](<repository-url>/issues)
- Email: [your-email@example.com]

## 🚀 Future Enhancements

- [ ] AI-powered field detection and classification
- [ ] Credential sync across devices
- [ ] Import/export credentials functionality
- [ ] Password generator
- [ ] Browser extension store publishing
- [ ] Support for more form field types
- [ ] Enhanced security features

## ❓ Troubleshooting

### Common Issues

1. **Extension not working after reload**: Refresh the page and re-open extension
2. **No credentials found**: Verify website domain matches stored credentials
3. **Fields not detected**: Check if fields are in iframes or shadow DOM
4. **Debug mode not working**: Reload extension and page after enabling

### Debugging Tips

- Enable debug mode in Developer tab
- Open Chrome DevTools (F12) and check Console tab
- Look for extension-specific logs with hostname prefix
- Verify extension permissions in `chrome://extensions/`

---

Built with ❤️ using React + TypeScript + Vite
