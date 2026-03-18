# Conduit - AI-Powered API Playground for VS Code

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-ISC-green)
![VS Code](https://img.shields.io/badge/VSCode-1.109.0%2B-orange)
![Node.js](https://img.shields.io/badge/Node.js-20.0.0%2B-brightgreen)

> **Stop switching between VS Code and Postman. Automatically detect, analyze, and test API routes directly from your source code. Zero-configuration AI-powered payload generation with instant Postman/OpenAPI exports.**

---

## 📋 Table of Contents

- [What is Conduit?](#what-is-conduit)
- [Key Features](#key-features)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [How to Use](#how-to-use)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## ✨ What is Conduit?

Conduit is a powerful VS Code extension that transforms your Express.js API development workflow. It:

- **Automatically detects** all your API routes using AST parsing
- **Generates intelligent payloads** using OpenAI GPT-4 based on your code
- **Provides an interactive testing playground** built directly into VS Code
- **Exports to Postman, OpenAPI, and cURL** with a single click
- **Tracks route history** and compares versions side-by-side
- **Integrates MongoDB data** to populate realistic test values

### In 30 Seconds:

1. **Open your Express project** → Conduit auto-scans all routes
2. **Click a route** → AI generates a pre-filled test payload
3. **Send the request** → See the response instantly
4. **Export anywhere** → Postman Collection, OpenAPI spec, or cURL command

---

## 🎯 Key Features

### 🔍 **Intelligent Route Detection**

- Automatically discovers all Express.js routes using AST parsing
- Extracts HTTP methods, paths, handlers, and middleware chains
- Supports nested routers and dynamic parameters (`:id`, `:userId`)
- Works with both JavaScript and TypeScript
- Real-time updates on file changes

### 🤖 **AI-Powered Payload Generation**

- Analyzes route handlers and generates realistic test payloads
- Hybrid intelligence: combines source code analysis with MongoDB schemas
- Learns from your data models and validation rules
- Auto-injects authentication headers based on detected middleware
- Suggests fixes for errors (4xx/5xx responses)

### 🧪 **Interactive API Testing**

- Built-in HTTP client for testing endpoints
- Real-time request/response visualization
- Support for different content-types and headers
- Bearer token authentication support
- Debug errors with AI-powered suggestions

### 📤 **Professional Export Formats**

- **Postman v2.1**: Complete collection files with authentication setup
- **OpenAPI 3.0**: Standardized API documentation with schemas
- **cURL Commands**: Copy-paste ready terminal commands
- All exports include AI-predicted payloads and proper authentication

### ⏳ **Route History & Snapshots**

- Automatic snapshots capture route changes on every file modification
- Compare route versions side-by-side
- Time-travel through your API evolution
- Restore any previous payload with one click

### 🍃 **MongoDB Integration**

- Connects to your local MongoDB and pulls actual documents
- Infers collections from route paths (`/api/orders` → `orders` collection)
- Resolves ObjectId fields to real IDs that exist in your database
- Schema viewer for any collection (field names, types, frequency)
- Works offline with smart field-name defaults if MongoDB unavailable

### 🎨 **Full VS Code Integration**

- Respects VS Code theme (Dark, Light, High Contrast)
- Sidebar route list with search and filtering
- Keyboard shortcuts for common operations
- Error handling with detailed messages
- Works with monorepos and complex project structures

---

## 📁 Project Structure

```
Conduit/
├── conduit/                          ✨ VS Code Extension
│   ├── src/
│   │   ├── extension.ts              # Extension entry point
│   │   ├── detection/
│   │   │   └── routeDetection.ts     # AST-based route parser
│   │   ├── backend/
│   │   │   └── syncClient.ts         # Backend API client
│   │   ├── ai/
│   │   │   └── payloadPredictor.ts   # GPT-4o payload generation
│   │   ├── db/
│   │   │   ├── mongoConnector.ts     # MongoDB connection
│   │   │   ├── collectionInferencer.ts
│   │   │   ├── hybridPayloadGenerator.ts
│   │   │   ├── objectIdResolver.ts
│   │   │   ├── sampleDataFetcher.ts
│   │   │   └── schemaViewer.ts
│   │   ├── exporters/
│   │   │   ├── postmanExporter.ts    # Postman export logic
│   │   │   ├── openApiExporter.ts    # OpenAPI/Swagger export
│   │   │   ├── curlGenerator.ts      # cURL command generation
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── apiService.ts         # API communication
│   │   │   └── snapshotService.ts    # History management
│   │   ├── webview/
│   │   │   └── WebviewPanel.ts       # Webview controller
│   │   └── test/
│   │       └── extension.test.ts
│   ├── webview-ui/                   📱 React Frontend
│   │   ├── src/
│   │   │   ├── main.jsx              # React entry
│   │   │   ├── App.jsx               # Main component
│   │   │   ├── components/
│   │   │   │   ├── RouteList.jsx     # Route sidebar
│   │   │   │   ├── Playground.jsx    # API tester
│   │   │   │   ├── PayloadForm.jsx   # JSON editor
│   │   │   │   ├── ResponseView.jsx  # Response display
│   │   │   │   ├── HistoryPanel.jsx  # History timeline
│   │   │   │   ├── JsonEditor.jsx    # Advanced JSON editor
│   │   │   │   ├── DiffView.jsx      # Diff comparison
│   │   │   │   └── AiResponseFormatter.jsx
│   │   │   ├── styles/               # CSS and theme
│   │   │   └── assets/
│   │   ├── package.json
│   │   └── vite.config.js
│   ├── webview-dist/                 # Built frontend
│   ├── package.json
│   ├── tsconfig.json
│   └── esbuild.js
│
├── conduit-backend/                  🔧 Express.js Backend
│   ├── server.js                     # Entry point
│   ├── config/
│   │   └── db.js                     # Database configuration
│   ├── controllers/
│   │   ├── AiController.js           # AI endpoints
│   │   ├── AuthController.js         # Authentication
│   │   ├── CollectionController.js   # Collections management
│   │   ├── SnapshotController.js     # History/versioning
│   │   └── UserController.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Collection.js
│   │   ├── RouteSnapshot.js
│   │   └── index.js
│   ├── routes/
│   │   ├── AuthRouter.js
│   │   ├── AiRouter.js
│   │   ├── CollectionRouter.js
│   │   ├── SnapshotRouter.js
│   │   └── UserRouter.js
│   ├── middleware/
│   │   ├── authentication.js
│   │   ├── error.js
│   │   └── passport.js
│   ├── utils/
│   │   └── labelGenerator.js
│   ├── package.json
│   └── .env.example
│
└── README.md                   # This file (Main documentation)
```

---

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **VS Code** v1.109.0 or higher
- **Node.js** v20.0.0 or higher
- **npm** v10.0.0 or higher
- **MongoDB** v6.0+ (local or MongoDB Atlas)

---

## 🚀 Quick Start

### Step 1: Clone and Navigate

```bash
cd C:\Users\mahta\Desktop\Conduit
```

### Step 2: Install Dependencies

```bash
# Install extension dependencies
cd conduit
npm install

# Install webview UI dependencies
cd webview-ui
npm install

# Return to root and install backend dependencies
cd ../..
cd conduit-backend
npm install
cd ..
```

### Step 3: Configure Environment Variables

Create `.env` files for the backend:

**conduit-backend/.env**

```env
MONGODB_URI=mongodb://localhost:27017/conduit
OPENAI_API_KEY=your_openai_api_key_here
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
PORT=3002
GROQ_API_KEY=optional_groq_api_key
```

> **MongoDB Options:**
>
> - **Local**: `mongodb://localhost:27017/conduit`
> - **MongoDB Atlas**: `mongodb+srv://username:password@cluster.mongodb.net/conduit`

### Step 4: Start MongoDB

```bash
# If using local MongoDB
mongod

# If using MongoDB Atlas, update MONGODB_URI in .env with your connection string
```

### Step 5: Build and Run

```bash
# Terminal 1: Build backend
cd conduit-backend
npm run dev

# Terminal 2: Build webview UI
cd conduit/webview-ui
npm run build

# Terminal 3: Build extension and watch
cd ../..
cd conduit
npm run esbuild

# Terminal 4: Open VS Code and press F5 to launch extension in debug mode
```

---

## 💻 Development Workflow

### Extension Development

```bash
cd conduit

# Watch mode (auto-rebuild on changes)
npm run esbuild:watch

# Production build
npm run esbuild

# Run tests
npm test
```

### Webview UI Development

```bash
cd conduit/webview-ui

# Development server (hot reload)
npm run dev

# Production build
npm run build
```

### Backend Development

```bash
cd conduit-backend

# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run tests
npm test
```

### Common Commands

| Command                 | Location              | Purpose                        |
| ----------------------- | --------------------- | ------------------------------ |
| `npm run esbuild`       | `conduit/`            | Build extension for production |
| `npm run esbuild:watch` | `conduit/`            | Watch and rebuild extension    |
| `npm run dev`           | `conduit/webview-ui/` | Start React dev server         |
| `npm run build`         | `conduit/webview-ui/` | Build production React bundle  |
| `npm run dev`           | `conduit-backend/`    | Start backend with auto-reload |
| `npm test`              | `conduit/`            | Run extension tests            |

---

## 🎮 How to Use

### 1. Detect Routes

1. Open an Express.js project in VS Code
2. Look for the Conduit icon in the Activity Bar (left sidebar)
3. Click it to open the Conduit panel
4. Routes are automatically detected—if not, click "Refresh Routes"

### 2. Generate AI Payloads

1. Select a route from the list
2. Click "Generate Payload with AI"
3. Conduit analyzes your controller code and generates a realistic payload
4. Edit the payload as needed

### 3. Test Endpoints

1. Click on a route to open the playground
2. Configure the request:
   - Review the generated payload
   - Add or modify headers
   - Set authentication token if needed
3. Click "Send Request"
4. View the response (status, headers, body)

### 4. Export for External Tools

1. **Postman**: Click "📤 Export to Postman"
2. **OpenAPI**: Click "📋 Export as OpenAPI"
3. **cURL**: Click "📋 Copy as cURL"
4. Paste or import into your preferred tool

### 5. Track Route Changes

1. Click "History" tab in the panel
2. Scroll through the timeline of changes
3. Compare versions side-by-side
4. Click to restore any previous payload

---

## 🏗️ Architecture

### High-Level Flow

```
VS Code Project
    ↓
Route Detection (AST parsing)
    ↓
Route Display (Sidebar)
    ↓
User Selects Route
    ↓
Backend: AI Payload Generation
    ↓
MongoDB: Real Data Fetching
    ↓
Playground: Display + Test
    ↓
Export: Postman/OpenAPI/cURL
```

### Module Responsibilities

| Module                    | Responsibility                           |
| ------------------------- | ---------------------------------------- |
| `routeDetection.ts`       | Parse Express routes from source files   |
| `payloadPredictor.ts`     | Call GPT-4o to generate test payloads    |
| `mongoConnector.ts`       | Connect to MongoDB and fetch collections |
| `collectionInferencer.ts` | Infer MongoDB collection schemas         |
| `postmanExporter.ts`      | Generate Postman collection JSON         |
| `openApiExporter.ts`      | Generate OpenAPI specification           |
| `curlGenerator.ts`        | Generate cURL commands                   |
| `snapshotService.ts`      | Save and retrieve route history          |

### Backend Integration

- **Fixed Backend URL**: Uses `http://localhost:3002` via `syncClient.ts`
- **No User Configuration**: Backend connection is pre-configured
- **Simplified Deployment**: Removes configuration complexity from users

---

## 🔧 Technology Stack

### Frontend

- **React** 18+ - UI framework
- **Vite** - Lightning-fast build tool
- **TypeScript** - Type-safe JavaScript
- **CSS3** - Responsive styling with theme variables

### Backend

- **Express.js** 4.22+ - Web framework
- **MongoDB** 6.12+ - NoSQL database
- **Mongoose** 8.9+ - MongoDB ODM
- **Passport.js** - Authentication framework
- **JWT** - Secure authentication tokens
- **express-rate-limit** - Rate limiting for API protection

### Extension

- **VS Code API** - Extension framework
- **TypeScript** - Type-safe code
- **Babel** - AST parsing for route detection
- **esbuild** - Fast bundler
- **ESLint** - Code quality

### External APIs

- **OpenAI GPT-4o** - Intelligent payload generation
- **MongoDB Atlas** - Optional cloud database
- **Groq API** - Alternative AI provider (optional)

---

## 📊 Features by Status

| Feature               | Status      | Details                  |
| --------------------- | ----------- | ------------------------ |
| Route Detection       | ✅ Complete | Full AST-based detection |
| AI Payload Generation | ✅ Complete | GPT-4o powered           |
| API Testing           | ✅ Complete | Built-in HTTP client     |
| Postman Export        | ✅ Complete | v2.1 format              |
| OpenAPI Export        | ✅ Complete | OpenAPI 3.0 spec         |
| cURL Export           | ✅ Complete | Terminal ready           |
| Route History         | ✅ Complete | Time-travel snapshots    |
| MongoDB Integration   | ✅ Complete | Schema inference         |
| Theme Support         | ✅ Complete | Dark/Light/HC            |
| Route Search          | ✅ Complete | Real-time filtering      |
| Error Debugging       | ✅ Complete | AI-powered suggestions   |
| GitHub OAuth          | ✅ Complete | Team sync ready          |
| Collection Sharing    | ✅ Complete | Team collaboration       |

---

## 🔐 Security Considerations

- **API Keys**: Store all secrets in `.env` files (never commit to git)
- **Authentication**: JWT tokens for secure API communication
- **Database**: Use MongoDB Atlas with IP whitelisting for production
- **CORS**: Configured for development—update `server.js` for production domain
- **Rate Limiting**: Backend includes rate limiting for API protection
- **Environment**: `.env` files are git-ignored; use `.env.example` for templates

---

## 🐛 Troubleshooting

### Routes Not Detected

**Problem**: No routes appear in the sidebar.

**Solutions**:

- Ensure your Express.js project follows standard patterns
- Check that routes are defined in `.js` or `.ts` files
- Try the "Conduit: Refresh Routes" command (`Ctrl+Shift+R`)
- Check the Extension Output panel for errors

### AI Payload Generation Fails

**Problem**: "AI payload generation failed" message.

**Solutions**:

- Verify your OpenAI API key is valid
- Check API rate limits and account balance
- Ensure `OPENAI_API_KEY` is set in `.env`
- Try using Groq API as alternative (set `GROQ_API_KEY`)

### MongoDB Connection Issues

**Problem**: "Cannot connect to MongoDB" error.

**Solutions**:

- Ensure MongoDB is running: `mongod`
- Verify connection string in `.env`
- For MongoDB Atlas: whitelist your IP address
- Check network connectivity if using cloud MongoDB

### Extension Won't Start

**Problem**: Extension fails to load or crashes.

**Solutions**:

- Ensure all dependencies are installed: `npm install` in `conduit/` and `conduit/webview-ui/`
- Check Node.js version: `node --version` (must be v20+)
- Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
- Check file permissions in the extension directory

### Backend Port Already in Use

**Problem**: "EADDRINUSE: address already in use :::3002"

**Solutions**:

- Change `PORT` in `.env` to another value (e.g., 3003)
- Kill existing process: `lsof -i :3002` then `kill -9 <PID>`
- On Windows: `netstat -ano | findstr :3002`

---

## 📝 Configuration

### Extension Settings (VS Code settings.json)

```json
{
  "conduit.mongodbUri": "mongodb://localhost:27017/conduit",
  "conduit.openaiApiKey": "sk-...",
  "conduit.backendUrl": "http://localhost:3002",
  "conduit.theme": "auto",
  "conduit.autoScan": true,
  "conduit.skipFolders": ["node_modules", "dist", ".next"]
}
```

### Backend Environment Variables

| Variable         | Required | Default       | Purpose                      |
| ---------------- | -------- | ------------- | ---------------------------- |
| `MONGODB_URI`    | Yes      | -             | MongoDB connection string    |
| `OPENAI_API_KEY` | No       | -             | OpenAI API key for payloads  |
| `JWT_SECRET`     | Yes      | -             | Secret for JWT token signing |
| `NODE_ENV`       | No       | `development` | Environment mode             |
| `PORT`           | No       | `3002`        | Backend server port          |
| `GROQ_API_KEY`   | No       | -             | Alternative AI provider      |

---

## 🤝 Contributing

We welcome contributions to improve Conduit! Here's how:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Make** your changes
4. **Commit** with clear messages: `git commit -m 'Add amazing feature'`
5. **Push** to your branch: `git push origin feature/amazing-feature`
6. **Open** a Pull Request

### Development Guidelines

- Follow ESLint configuration in the project
- Write TypeScript with proper type annotations
- Add tests for new features (in `src/test/`)
- Update documentation and README
- Keep commits atomic and well-described

### Reporting Issues

Please include:

- VS Code version (`Help` → `About`)
- Extension version
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Error logs (View → Output → "Conduit")

---

## 📄 License

This project is licensed under the **ISC License**. See individual files for details.

---

## 📚 Additional Resources

### Folder-Specific Documentation

- [Extension Documentation](conduit/README.md) - Build, develop, and deploy the extension
- [Backend Documentation](conduit-backend/README.md) - API endpoints and backend configuration

### External Docs

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [OpenAI API Docs](https://platform.openai.com/docs/)

---

## 🙏 Acknowledgments

- **OpenAI** for GPT-4o enabling intelligent payload generation
- **MongoDB** for excellent database technology
- **Express.js** team for the robust web framework
- **VS Code** team for the amazing extension API
- **React** community for amazing frontend tooling

---

## 👥 Support

For issues, questions, or feature requests:

- **GitHub Issues**: [Report bugs or suggest features](https://github.com/Mahtab-Madni/Conduit--VSCode-Extension/issues)
- **Email**: [support@example.com](mailto:mahtabjmi2005@gmail.com)
- **VS Code Marketplace**: [Conduit Extension](https://marketplace.visualstudio.com/items?itemName=MahtabMadni123.conduit-api-playground)

---

<div align="center">

**Made with ❤️ for developers who love productivity**

_Built with TypeScript, React, MongoDB, and enthusiasm_

</div>
