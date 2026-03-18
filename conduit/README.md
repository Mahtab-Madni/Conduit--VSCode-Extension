# 🚀 Conduit VS Code Extension

<div align="center">

**Real-time API route detection, intelligent payload generation, and interactive testing—all inside VS Code.**

[![Version](https://img.shields.io/badge/version-0.0.1-blue?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=MahtabMadni.Conduit)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.109.0%2B-007ACC?style=flat-square&logo=visual-studio-code)](https://code.visualstudio.com)
[![Node.js](https://img.shields.io/badge/Node.js-20.0.0%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](LICENSE)

**Transform API testing • Ship faster • Document automatically**

</div>

---

## ✨ Why Choose Conduit?

Stop switching between your editor and Postman. Stop manually writing API documentation. Conduit brings everything into VS Code:

| Challenge                            | Conduit Solution                              |
| ------------------------------------ | --------------------------------------------- |
| 🔄 Tedious manual route tracking     | 🔍 Auto-detects all Express routes in seconds |
| 🤔 Creating realistic test data      | 🤖 AI generates payloads from your code       |
| 🔀 Testing without context-switching | 🧪 Built-in HTTP playground                   |
| 📋 Maintaining API documentation     | 📤 One-click export to Postman/OpenAPI        |
| 🕐 Tracking API changes              | ⏳ Automatic versioning with diffs            |

---

## 🎯 Perfect For

- **Full-Stack Developers** - Test your own APIs without leaving VS Code
- **API Teams** - Document routes automatically and share with Postman/OpenAPI
- **DevOps Engineers** - Generate cURL commands instantly for production APIs
- **Documentation-First Teams** - Auto-generate OpenAPI specs from code
- **Learning** - Understand your Express.js routes better with AI analysis

---

## ✨ Core Features

### 🔍 Smart Route Detection

- Automatically scan and extract all Express.js routes
- Full support for middleware chains and dynamic parameters
- Real-time updates as you save files
- Accurate AST-based parsing using Babel parser

### 🤖 AI-Powered Payload Generation

- Realistic test data in seconds using GPT-4o
- Smart validation detection from express-validator, Joi, etc.
- MongoDB schema integration for production-like data
- Works offline with built-in fallback mode

### 🧪 Interactive Testing Playground

- Test API endpoints directly from VS Code
- Beautiful syntax-highlighted responses
- Persistent request history for debugging
- Bearer token support for authenticated endpoints

### 📤 Multi-Format Export

- **Postman Collection** 2.1 - Import for team collaboration
- **OpenAPI 3.0** - Industry-standard documentation format
- **cURL Commands** - Copy-paste ready for terminal
- All exports include AI-generated payloads and authentication

### ⏳ Route History & Versioning

- Automatic snapshot on every route file change
- Side-by-side version comparison
- Timeline navigation through route evolution
- One-click payload restoration

---

## ⚡ Quick Start

### 1. Install from Marketplace

- Open VS Code Extensions (`Ctrl+Shift+X`)
- Search for **"Conduit"**
- Click **Install**

### 2. Open Your Project

- Open an Express.js project folder
- Press **`Ctrl+Shift+C`** to open Conduit Panel

### 3. Routes Appear Automatically

- All routes detected and listed in sidebar
- Click any route to see details

### 4. Generate & Test

- Click route → AI generates test payload
- Customize if needed → Click "Send" to test
- View beautiful JSON response instantly

### 5. Export or Share

- Choose format: Postman / OpenAPI / cURL
- Share with team or paste commands in terminal

> **💡 Tip:** Enable AI payloads by configuring OpenAI key in settings (optional for basic mode)

---

## 🎮 Essential Commands

Press `Ctrl+Shift+P` and type any of these:

| Command                        | Keyboard       | Purpose                        |
| ------------------------------ | -------------- | ------------------------------ |
| **Conduit: Open Panel**        | `Ctrl+Shift+C` | Open Conduit testing interface |
| **Conduit: Refresh Routes**    | `Ctrl+Shift+R` | Scan for new/updated routes    |
| **Conduit: Export to Postman** | -              | Download Postman collection    |
| **Conduit: Export as OpenAPI** | -              | Generate OpenAPI spec file     |
| **Conduit: Copy as cURL**      | -              | Copy route as cURL command     |
| **Conduit: Configure API Key** | -              | Set OpenAI API key             |

---

## ⚙️ Configuration

No configuration needed for basic usage! For advanced features:

**Via VS Code Settings** (`Ctrl+,` → search "conduit"):

```json
{
  "conduit.openaiApiKey": "sk-your-api-key-here",
  "conduit.mongodbUri": "mongodb://localhost:27017/conduit",
  "conduit.backendUrl": "http://localhost:3002",
  "conduit.autoScan": true
}
```

**What each setting does:**

- 🔑 **OpenAI Key** - Enables AI payload generation (optional)
- 🗄️ **MongoDB URI** - Loads real data for test payloads (optional)
- 🖥️ **Backend URL** - For history tracking and team sync (optional)
- ↻ **Auto Scan** - Automatically detect route changes (recommended)

---

## 🚨 Troubleshooting

### Extension Won't Show Routes

1. Ensure your project is an Express.js application
2. Press `Ctrl+Shift+R` to manually refresh routes
3. Check VS Code logs: `View → Output → Conduit`

### Routes Found But Wrong

- Conduit supports standard Express patterns (`app.get()`, `router.post()`, etc.)
- For custom patterns, open an issue on GitHub

### AI Payloads Not Working

- Check OpenAI API key is set and has remaining quota
- Verify backend server is running on `http://localhost:3002`
- Check API response in VS Code Output panel

### MongoDB Data Not Loading

- Verify MongoDB connection string is correct
- Ensure MongoDB server is running
- Test connection using `Conduit: Test MongoDB Connection` command

---

## 📊 What's Included

- ✅ Route auto-detection
- ✅ Interactive testing playground
- ✅ Export to Postman/OpenAPI/cURL
- ✅ Route history and versioning
- ✅ Syntax-highlighted responses
- ✅ Bearer token support
- ✅ MongoDB schema integration (optional)
- ✅ AI payload generation via GPT-4o (optional)
- ✅ Request history
- ✅ Multi-format support

---

## 🔗 Resources & Support

- 📖 [Full Documentation](https://github.com/MahtabMadni/Conduit)
- 🆘 [Report Issues](https://github.com/MahtabMadni/Conduit/issues)
- 💬 [Discussions](https://github.com/MahtabMadni/Conduit/discussions)
- 📝 [Changelog](CHANGELOG.md)

---

## 🤝 Contributing

Contributions welcome! For developers:

- [GitHub Repository](https://github.com/MahtabMadni/Conduit)
- Fork → Create feature branch → Submit Pull Request
- See development notes below for setup

---

## 📄 License

ISC License - See LICENSE file

---

<div align="center">

**Give us a ⭐ on [GitHub](https://github.com/MahtabMadni/Conduit) if you find Conduit useful!**

Happy testing! 🚀

</div>

---

## 🛠️ For Developers

### Full Development Setup

#### Prerequisites

- VS Code 1.109.0+
- Node.js 20.0.0+
- npm 10.0.0+
- MongoDB (optional, for data integration)
- OpenAI API key (optional, for AI features)

#### Installation

1. **Clone & Install**

```bash
git clone https://github.com/MahtabMadni/Conduit
cd conduit
npm install
cd webview-ui && npm install && cd ..
```

2. **Backend Setup (Optional, for full features)**

```bash
cd ../conduit-backend
npm install

# Create .env file
cat > .env << EOF
MONGODB_URI=mongodb://localhost:27017/conduit
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_secret
NODE_ENV=development
PORT=3002
EOF

npm run dev  # Start backend on http://localhost:3002
```

3. **Build & Launch**

```bash
cd ../conduit

# Terminal 1: Watch mode build
npm run esbuild:watch

# Terminal 2: Launch debug extension (press F5)
```

### Available Commands

```bash
# Development
npm run esbuild:watch    # Watch mode
npm run esbuild          # One-time build
npm run launch           # Launch debug extension

# Webview
cd webview-ui
npm run dev              # Dev server with hot reload
npm run build            # Production build

# Quality
npm run lint             # ESLint
npm run lint:fix         # Fix lint issues
npm test                 # Run tests

# Distribution
npm install -g vsce
vsce package             # Create .vsix file
```

### Project Architecture

```
VS Code Extension
  └─ extension.ts (entry point)
      ├─ Route Detection (AST parsing)
      ├─ Webview UI (React)
      ├─ AI Engine (GPT-4o integration)
      ├─ Export Engines (Postman, OpenAPI, cURL)
      ├─ Database Client (MongoDB)
      └─ Backend Connector (API communication)
```

### Key Files & Directories

- **`src/extension.ts`** - Main extension entry point
- **`src/detection/routeDetection.ts`** - Route parsing logic
- **`src/ai/payloadPredictor.ts`** - AI integration
- **`src/exporters/`** - Export format handlers
- **`webview-ui/src/`** - React frontend
- **`webview-ui/src/components/`** - React components

### Debugging

#### Debug Mode

1. Open the extension folder in VS Code
2. Press **F5** to start debugging
3. New VS Code window opens with extension loaded
4. Set breakpoints in `src/extension.ts` or any other file

#### View Logs

1. In debug window, open **Output** panel
2. Select **"Conduit"** from dropdown
3. Watch real-time logs and errors

#### Troubleshooting

```typescript
// Add to extension.ts to log detected routes
console.log("Detected routes:", routes);
// Check Output panel for logs
```

### Contributing

We welcome contributions! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Make** changes and ensure tests pass (`npm test`)
4. **Commit** with clear messages
5. **Push** and open a **Pull Request**

#### Development Checklist

- [ ] Code follows ESLint rules (`npm run lint`)
- [ ] TypeScript compiles without errors
- [ ] Tests pass (`npm test`)
- [ ] New features have tests
- [ ] README updated if needed
- [ ] No console errors in debug mode

---

## 📁 Project Structure (Technical Reference)

```
conduit/
├── src/
│   ├── extension.ts                   # Entry point
│   ├── detection/
│   │   └── routeDetection.ts          # Route parser (AST-based)
│   ├── backend/
│   │   └── syncClient.ts              # Backend API client
│   ├── ai/
│   │   └── payloadPredictor.ts        # AI prediction logic
│   ├── db/
│   │   ├── mongoConnector.ts
│   │   ├── collectionInferencer.ts
│   │   ├── hybridPayloadGenerator.ts
│   │   ├── objectIdResolver.ts
│   │   ├── sampleDataFetcher.ts
│   │   └── schemaViewer.ts
│   ├── exporters/
│   │   ├── postmanExporter.ts
│   │   ├── openApiExporter.ts
│   │   ├── curlGenerator.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── apiService.ts
│   │   └── snapshotService.ts
│   ├── webview/
│   │   └── WebviewPanel.ts
│   └── test/
│       └── extension.test.ts
│
├── webview-ui/                        # React Frontend
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── theme.css
│   │   └── components/
│   │       ├── RouteList.jsx
│   │       ├── Playground.jsx
│   │       ├── PayloadForm.jsx
│   │       ├── ResponseView.jsx
│   │       ├── HistoryPanel.jsx
│   │       ├── JsonEditor.jsx
│   │       ├── DiffView.jsx
│   │       └── AiResponseFormatter.jsx
│   ├── package.json
│   └── vite.config.js
│
├── webview-dist/                      # Built webview (auto-generated)
├── package.json
├── tsconfig.json
├── esbuild.js
├── eslint.config.mjs
├── CHANGELOG.md
└── README.md
```

### Architecture Diagram

```
1. Extension starts
   ├─ Scans project for Express routes
   └─ Displays routes in webview sidebar

2. User selects a route
   ├─ Request sent to backend for AI payload
   ├─ AI analyzes route handler code
   └─ Payload displayed in playground

3. User modifies and sends request
   ├─ Request sent to actual API endpoint
   ├─ Response captured and displayed
   └─ Snapshot saved to database

4. User exports
   ├─ Format selection (Postman/OpenAPI/cURL)
   ├─ Exporter generates file/command
   └─ File downloaded or copied to clipboard
```

---

## 📚 Additional Documentation

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview Panel Guide](https://code.visualstudio.com/api/extension-guides/webview)
- [Express.js Documentation](https://expressjs.com/)
- [Backend README](../conduit-backend/README.md)
- [Main Project README](../README.md)
