# Conduit VS Code Extension

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![VS Code](https://img.shields.io/badge/VSCode-1.109.0%2B-orange)
![Node.js](https://img.shields.io/badge/Node.js-20.0.0%2B-brightgreen)
![License](https://img.shields.io/badge/license-ISC-green)

> **Real-time API route detection, intelligent payload generation, and interactive testing—all inside VS Code.**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Building](#building)
- [Extension Architecture](#extension-architecture)
- [Commands](#commands)
- [Debugging](#debugging)
- [Contributing](#contributing)

---

## 🎯 Overview

The **Conduit Extension** is the core VS Code component that provides developers with:

- **Automatic route detection** from Express.js projects
- **AI-powered request payload generation** via OpenAI GPT-4o
- **Interactive API testing playground** within the editor
- **One-click exports** to Postman, OpenAPI, and cURL formats
- **Route history tracking** with version comparison

This is the **extension layer** of the Conduit ecosystem. It communicates with the [Conduit Backend](../conduit-backend/README.md) for AI features and history management.

---

## ✨ Features

### 🔍 Route Detection Engine

- **AST-based parsing** using Babel parser for accurate route extraction
- **Automatic discovery** of all Express.js routes in your project
- **Handler extraction** including middleware chains and controller logic
- **Dynamic parameter support** (`:id`, `:userId`, etc.)
- **Real-time updates** on file changes

### 🤖 AI Payload Prediction

- **OpenAI GPT-4o integration** for intelligent request generation
- **Context-aware payloads** based on route handler analysis
- **Validation rule detection** from express-validator, Joi, and other libraries
- **MongoDB schema integration** for realistic data
- **Fallback modes** for offline usage

### 📤 Export Formats

- **Postman Collection 2.1** - Import directly into Postman
- **OpenAPI 3.0 / Swagger** - Industry-standard API documentation
- **cURL Commands** - Copy-paste ready terminal commands
- **All formats include** AI-predicted payloads and authentication

### 🧪 Interactive Playground

- **Built-in HTTP client** for testing endpoints
- **Real-time response visualization** with syntax highlighting
- **Request/response history** for debugging
- **Bearer token support** for authenticated endpoints
- **Multi-content-type support** (JSON, form-data, etc.)

### ⏳ Route History & Snapshots

- **Automatic snapshots** on every route file change
- **Side-by-side comparison** of route versions
- **Timeline navigation** through route evolution
- **Restore previous payload** with one click

### 🌐 Integration Features

- **MongoDB connection** for real test data
- **Collection schema inference** for smart defaults
- **Backend API communication** for shared history
- **GitHub OAuth support** (optional) for team sync

---

## 📦 Installation

### From VS Code Marketplace

1. Open VS Code
2. Go to **Extensions** (`Ctrl+Shift+X`)
3. Search for **"Conduit"**
4. Click **Install**

### From Source (Development)

See [Development Setup](#development-setup) section below.

---

## 🚀 Development Setup

### Prerequisites

- **VS Code** v1.109.0 or higher
- **Node.js** v20.0.0 or higher
- **npm** v10.0.0 or higher

### Installation Steps

#### 1. Install Dependencies

```bash
cd conduit
npm install

# Also install webview UI dependencies
cd webview-ui
npm install
cd ..
```

#### 2. Install Backend (Required for Full Features)

```bash
cd ../conduit-backend
npm install
```

#### 3. Configure Environment

Create `.env` file in `conduit-backend/`:

```env
MONGODB_URI=mongodb://localhost:27017/conduit
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret
NODE_ENV=development
PORT=3002
```

#### 4. Start Backend Server

```bash
cd conduit-backend
npm run dev
```

Backend should be running on `http://localhost:3002`

#### 5. Build Webview UI

```bash
cd conduit/webview-ui
npm run build
```

#### 6. Start Extension Development

```bash
cd conduit

# Terminal 1: Build extension in watch mode
npm run esbuild:watch

# Terminal 2: Press F5 in VS Code to launch Extension Development Host
# OR use: npm run launch
```

The extension should now open in a new VS Code window for testing.

---

## 📁 Project Structure

```
conduit/
├── src/
│   ├── extension.ts                   # ⭐ Extension entry point
│   │
│   ├── detection/
│   │   └── routeDetection.ts          # Route parser (AST-based)
│   │       ├── getAllExpressRoutes()  # Main function
│   │       ├── parseFile()            # Parse single file
│   │       └── extractRouteInfo()     # Extract route metadata
│   │
│   ├── backend/
│   │   └── syncClient.ts              # Backend API client
│   │       ├── getPayload()           # Request AI payload
│   │       ├── saveSnapshot()         # Save route version
│   │       └── getHistory()           # Fetch route history
│   │
│   ├── ai/
│   │   └── payloadPredictor.ts        # AI prediction logic
│   │       ├── generatePayload()      # Generate test payload
│   │       ├── parseControllerCode()  # Analyze controller
│   │       └── formatPayload()        # Format for display
│   │
│   ├── db/
│   │   ├── mongoConnector.ts          # MongoDB connection
│   │   ├── collectionInferencer.ts    # Schema inference
│   │   ├── hybridPayloadGenerator.ts  # Hybrid AI + real data
│   │   ├── objectIdResolver.ts        # ObjectId resolution
│   │   ├── sampleDataFetcher.ts       # Sample data fetching
│   │   └── schemaViewer.ts            # Schema visualization
│   │
│   ├── exporters/
│   │   ├── postmanExporter.ts         # Postman export
│   │   │   ├── createCollection()
│   │   │   ├── createRequest()
│   │   │   └── export()
│   │   ├── openApiExporter.ts         # OpenAPI export
│   │   │   ├── createOpenApiSpec()
│   │   │   ├── createPath()
│   │   │   └── export()
│   │   ├── curlGenerator.ts           # cURL generation
│   │   │   ├── generateCurl()
│   │   │   └── formatCommand()
│   │   └── index.ts                   # Exporter index
│   │
│   ├── services/
│   │   ├── apiService.ts              # HTTP client
│   │   │   ├── sendRequest()
│   │   │   ├── formatResponse()
│   │   │   └── handleErrors()
│   │   └── snapshotService.ts         # History management
│   │       ├── saveSnapshot()
│   │       ├── loadHistory()
│   │       └── compareVersions()
│   │
│   ├── webview/
│   │   └── WebviewPanel.ts            # Webview controller
│   │       ├── initialize()
│   │       ├── sendMessage()
│   │       └── handleMessage()
│   │
│   └── test/
│       └── extension.test.ts          # Extension tests
│
├── webview-ui/                        # React Frontend
│   ├── src/
│   │   ├── main.jsx                   # React entry point
│   │   ├── App.jsx                    # Main component
│   │   ├── App.css                    # Main styles
│   │   ├── theme.css                  # VS Code theme integration
│   │   ├── components/
│   │   │   ├── RouteList.jsx          # Route list sidebar
│   │   │   ├── Playground.jsx         # Main testing interface
│   │   │   ├── PayloadForm.jsx        # Payload editor
│   │   │   ├── ResponseView.jsx       # Response display
│   │   │   ├── HistoryPanel.jsx       # Route history timeline
│   │   │   ├── JsonEditor.jsx         # Advanced JSON editor
│   │   │   ├── DiffView.jsx           # Diff viewer
│   │   │   └── AiResponseFormatter.jsx # AI response formatting
│   │   ├── assets/                    # Static assets
│   │   └── index.css                  # Global styles
│   ├── public/
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
├── webview-dist/                      # Built webview (auto-generated)
│   ├── index.html
│   └── assets/
│       ├── index.js                   # Bundled React app
│       ├── index.css
│       └── index2.css
│
├── package.json                       # Extension manifest
├── tsconfig.json                      # TypeScript config
├── esbuild.js                         # Build script
├── eslint.config.mjs                  # Linting config
├── CHANGELOG.md
└── README.md                          # This file
```

---

## 🔨 Building

### Development Build

```bash
# Watch mode (auto-rebuild on changes)
npm run esbuild:watch
```

### Production Build

```bash
# One-time build
npm run esbuild
```

### Webview UI Build

```bash
# The webview is built separately
cd webview-ui

# Development (hot reload)
npm run dev

# Production build
npm run build
```

### Packaging for Distribution

```bash
# Install vsce globally
npm install -g vsce

# Package the extension
vsce package

# This creates a .vsix file ready for distribution
```

---

## 🏗️ Extension Architecture

### Component Flow

```
VS Code Extension
  └─ extension.ts (entry point)
      ├─ Route Detection
      │   └─ routeDetection.ts (AST parser)
      │
      ├─ Webview Panel
      │   ├─ WebviewPanel.ts (controller)
      │   └─ webview-ui/ (React UI)
      │       ├── RouteList (sidebar)
      │       └── Playground (main interface)
      │
      ├─ AI & Data Generation
      │   ├─ payloadPredictor.ts (GPT-4o)
      │   ├─ mongoConnector.ts (MongoDB)
      │   └─ hybridPayloadGenerator.ts (combined)
      │
      ├─ APIs & Export
      │   ├─ apiService.ts (HTTP client)
      │   ├─ postmanExporter.ts
      │   ├─ openApiExporter.ts
      │   └─ curlGenerator.ts
      │
      └─ Backend Communication
          └─ syncClient.ts (http://localhost:3002)
```

### Data Flow

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

## 🎮 Key Commands

All commands are prefixed with `conduit.` in VS Code command palette:

| Command               | Keyboard Shortcut | Action                  |
| --------------------- | ----------------- | ----------------------- |
| `openPanel`           | `Ctrl+Shift+C`    | Open Conduit panel      |
| `refreshRoutes`       | `Ctrl+Shift+R`    | Refresh detected routes |
| `scanRoutes`          | -                 | Full project scan       |
| `configureApiKey`     | -                 | Configure OpenAI key    |
| `testMongoConnection` | -                 | Test MongoDB connection |
| `configureMongoDB`    | -                 | Configure MongoDB URI   |
| `exportPostman`       | -                 | Export to Postman       |
| `exportOpenApi`       | -                 | Export as OpenAPI       |
| `exportCurl`          | -                 | Copy as cURL command    |

---

## 🐛 Debugging

### Debug Mode

1. Open the extension folder in VS Code
2. Press **F5** to start debugging
3. A new VS Code window opens with the extension loaded
4. Set breakpoints in `src/extension.ts` or any other file

### View Logs

1. In the debug window, open **Output** panel
2. Select **"Conduit"** from dropdown
3. Watch real-time logs and errors

### Troubleshoot Route Detection

Add this to `extension.ts` to log detected routes:

```typescript
console.log("Detected routes:", routes);
```

Check the Output panel for logs.

### Test HTTP Requests

Use the built-in playground to test endpoints:

1. Click a route in the sidebar
2. Click "Send Request"
3. Check the response in the Response pane

---

## 📝 Configuration

### Extension Settings (`.vscode/settings.json`)

```json
{
  "conduit.mongodbUri": "mongodb://localhost:27017/conduit",
  "conduit.openaiApiKey": "sk-...",
  "conduit.backendUrl": "http://localhost:3002",
  "conduit.theme": "auto",
  "conduit.autoScan": true,
  "conduit.skipFolders": ["node_modules", "dist", ".next"],
  "[json]": {
    "editor.defaultFormatter": "vscode.json-language-features"
  }
}
```

### Backend Configuration

See [Backend Configuration](../conduit-backend/README.md#configuration) for backend setup.

---

## 📊 Code Quality

### Linting

```bash
# Check code with ESLint
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

### Type Checking

```bash
# TypeScript compilation check
npx tsc --noEmit
```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm test -- --coverage
```

---

## 🤝 Contributing

We welcome contributions! Here's how to contribute:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature`
3. **Make** changes and ensure tests pass
4. **Commit** with clear messages
5. **Push** and open a **Pull Request**

### Development Checklist

- [ ] Code follows ESLint rules (`npm run lint`)
- [ ] TypeScript compiles without errors
- [ ] Tests pass (`npm test`)
- [ ] New features have tests
- [ ] README updated if needed
- [ ] No console errors in debug mode

### Adding New Commands

1. Add command to `package.json` `contributes.commands`
2. Register in `extension.ts`:
   ```typescript
   context.subscriptions.push(
     vscode.commands.registerCommand("conduit.myCommand", () => {
       // Implementation
     }),
   );
   ```

### Adding New Features

1. Create new files in `src/` directory
2. Export from `extension.ts`
3. Add tests in `src/test/`
4. Update `.vscode/settings.json` if new settings needed
5. Document in this README

---

## 📚 Related Documentation

- [Main Project README](../README_FINAL.md) - Overall project documentation
- [Backend README](../conduit-backend/README.md) - API and backend details
- [VS Code Extension API Docs](https://code.visualstudio.com/api)
- [Webview Panel Documentation](https://code.visualstudio.com/api/extension-guides/webview)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)

---

## 🔗 Useful Links

- **VS Code Marketplace**: [Publish Your Extension](https://code.visualstudio.com/docs/help/faq#_can-i-have-a-private-marketplace)
- **Node.js Documentation**: [nodejs.org](https://nodejs.org/docs)
- **Express.js Guide**: [expressjs.com](https://expressjs.com/)
- **Babel Parser**: [@babel/parser](https://babeljs.io/docs/en/babel-parser)

---

## 📄 License

ISC License - See main project LICENSE file.

---

## 🆘 Troubleshooting

### Extension Won't Start

```bash
# Clear node_modules and reinstall
rm -rf node_modules
npm install

# Clear VS Code cache
code --disable-extensions
```

### Webview Not Loading

- Check console in VS Code DevTools: `Ctrl+Shift+I`
- Ensure `webview-dist/index.html` exists
- Try: `npm run build` in `webview-ui/`

### TypeScript Errors

```bash
# Rebuild
npm run esbuild

# Check types
npx tsc --noEmit
```

---

<div align="center">

**Need help? Check the [main README](../README_FINAL.md) or [backend docs](../conduit-backend/README.md)**

_Happy coding with Conduit! 🚀_

</div>
