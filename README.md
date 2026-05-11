# Conduit - AI-Powered API Playground for VS Code

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-ISC-green)
![VS Code](https://img.shields.io/badge/VSCode-1.109.0%2B-orange)
![Node.js](https://img.shields.io/badge/Node.js-20.0.0%2B-brightgreen)

> **Stop switching between VS Code and Postman. Automatically detect, analyze, and test API routes directly from your source code. Zero-configuration AI-powered payload generation with instant Postman/OpenAPI exports.**

## Overview

Conduit is a powerful VS Code extension that transforms your Express.js API development workflow. It automatically detects all your routes, generates intelligent test payloads using AI, provides an interactive testing playground, and exports to industry-standard formats—all without leaving your editor.

**Key Value Propositions:**

- **Zero Context-Switching** - Test APIs directly in VS Code
- **AI-Powered** - Backend-powered AI with no API key configuration
- **Zero Configuration** - Works out of the box with smart defaults
- **One-Click Export** - Postman, OpenAPI, cURL in seconds
- **Version Tracking** - Automatic route history with comparisons
- **MongoDB Integration** - Real data from your database

## Quick Start

### For Users

1. **Install from VS Code Marketplace**
   - Open VS Code Extensions (`Ctrl+Shift+X`)
   - Search for "Conduit"
   - Click Install

2. **Open an Express.js Project**
   - Open your project folder in VS Code
   - Conduit automatically scans for routes

3. **Start Testing**
   - Click the Conduit icon in the sidebar
   - Select a route
   - Review AI-generated payload
   - Click "Send" to test

4. **Export**
   - Choose format: Postman, OpenAPI, or cURL
   - Share with your team

### For Developers

See [Development Setup](#development-setup) section below.

## Features

### 🔍 Intelligent Route Detection

- Automatically discovers all Express.js routes using AST parsing
- Extracts HTTP methods, paths, handlers, and middleware chains
- Supports nested routers and dynamic parameters (`:id`, `:userId`)
- Works with both JavaScript and TypeScript
- Real-time updates on file changes

### 🤖 AI-Powered Payload Generation

- Analyzes route handlers and generates realistic test payloads
- Hybrid intelligence: combines source code analysis with MongoDB schemas
- Learns from your data models and validation rules
- Auto-injects authentication headers based on detected middleware
- Suggests fixes for errors (4xx/5xx responses)
- **No API keys required** - AI runs on our backend

### 🧪 Interactive API Testing

- Built-in HTTP client for testing endpoints
- Real-time request/response visualization
- Support for different content-types and headers
- Bearer token authentication support
- Debug errors with AI-powered suggestions

### 📤 Professional Export Formats

- **Postman v2.1**: Complete collection files with authentication setup
- **OpenAPI 3.0**: Standardized API documentation with schemas
- **cURL Commands**: Copy-paste ready terminal commands
- All exports include AI-predicted payloads and proper authentication

### ⏳ Route History & Snapshots

- Automatic snapshots capture route changes on every file modification
- Compare route versions side-by-side
- Time-travel through your API evolution
- Restore any previous payload with one click

### 🍃 MongoDB Integration

- Connects to your local MongoDB and pulls actual documents
- Infers collections from route paths (`/api/orders` → `orders` collection)
- Resolves ObjectId fields to real IDs that exist in your database
- Schema viewer for any collection (field names, types, frequency)
- Works offline with smart field-name defaults if MongoDB unavailable

### 🎨 Full VS Code Integration

- Respects VS Code theme (Dark, Light, High Contrast)
- Sidebar route list with search and filtering
- Keyboard shortcuts for common operations
- Error handling with detailed messages
- Works with monorepos and complex project structures

## Prerequisites

### Required

- **VS Code** v1.109.0 or higher
- **Node.js** v20.0.0 or higher
- **npm** v10.0.0 or higher
- **Express.js Project** - Any Node.js project using Express.js

### Optional (for enhanced features)

- **MongoDB** v6.0+ (local or MongoDB Atlas) - For realistic test data from your database

## Project Structure

```
Conduit/
├── conduit/                          # VS Code Extension
│   ├── src/
│   │   ├── extension.ts              # Extension entry point
│   │   ├── detection/
│   │   │   └── routeDetection.ts     # AST-based route parser
│   │   ├── ai/
│   │   │   └── payloadPredictor.ts   # AI payload generation
│   │   ├── db/
│   │   │   ├── mongoConnector.ts     # MongoDB connection
│   │   │   ├── collectionInferencer.ts
│   │   │   ├── hybridPayloadGenerator.ts
│   │   │   ├── objectIdResolver.ts
│   │   │   ├── sampleDataFetcher.ts
│   │   │   └── schemaViewer.ts
│   │   ├── exporters/
│   │   │   ├── postmanExporter.ts    # Postman export
│   │   │   ├── openApiExporter.ts    # OpenAPI export
│   │   │   ├── curlGenerator.ts      # cURL generation
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── apiService.ts         # API communication
│   │   │   └── snapshotService.ts    # History management
│   │   ├── webview/
│   │   │   └── WebviewPanel.ts       # Webview controller
│   │   └── test/
│   │       └── extension.test.ts
│   ├── webview-ui/                   # React Frontend
│   │   ├── src/
│   │   │   ├── main.jsx
│   │   │   ├── App.jsx
│   │   │   ├── components/
│   │   │   │   ├── RouteList.jsx
│   │   │   │   ├── Playground.jsx
│   │   │   │   ├── PayloadForm.jsx
│   │   │   │   ├── ResponseView.jsx
│   │   │   │   ├── HistoryPanel.jsx
│   │   │   │   ├── JsonEditor.jsx
│   │   │   │   ├── DiffView.jsx
│   │   │   │   └── AiResponseFormatter.jsx
│   │   │   ├── theme.css
│   │   │   └── assets/
│   │   ├── package.json
│   │   └── vite.config.js
│   ├── webview-dist/                 # Built frontend
│   ├── package.json
│   ├── tsconfig.json
│   ├── esbuild.js
│   ├── eslint.config.mjs
│   ├── CHANGELOG.md
│   └── README.md                     # Extension marketplace README
│
├── conduit-backend/                  # Express.js Backend
│   ├── server.js                     # Entry point
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
│   ├── config/
│   │   └── db.js
│   ├── package.json
│   └── .env.example
│
├── README.md                         # This file
├── PRIVACY.md
├── TERMS.md
└── LICENSE

```

## How to Use

### 1. Detect Routes

1. Open an Express.js project in VS Code
2. Click the Conduit icon in the Activity Bar (left sidebar)
3. Routes are automatically detected—if not, click "Refresh Routes"

### 2. Generate AI Payloads

1. Select a route from the list
2. Click "Generate Payload with AI"
3. Conduit analyzes your controller code and generates a realistic payload
4. Edit the payload as needed

### 3. Test Endpoints

1. Click on a route to open the playground
2. Review the generated payload
3. Set authentication token if needed
4. Click "Send Request"
5. View the response (status, headers, body)

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

## Development Setup

### Prerequisites for Development

- VS Code 1.109.0+
- Node.js 20.0.0+
- npm 10.0.0+
- MongoDB (optional, for testing)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/MahtabMadni/Conduit--VSCode-Extension
cd Conduit
```

2. **Install dependencies**

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
```

3. **Configure environment variables**

Create `.env` file in `conduit-backend/`:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/conduit
# Alternative: MongoDB Atlas
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/conduit

# JWT Configuration
JWT_SECRET=your_jwt_secret_key

# Application Settings
NODE_ENV=development
PORT=3002
```

4. **Start MongoDB**

```bash
# If using local MongoDB
mongod

# If using MongoDB Atlas, update MONGODB_URI in .env
```

### Build & Run

**Terminal 1: Backend**

```bash
cd conduit-backend
npm run dev
```

**Terminal 2: Webview UI**

```bash
cd conduit/webview-ui
npm run dev
```

**Terminal 3: Extension**

```bash
cd conduit
npm run esbuild:watch
```

**Terminal 4: VS Code Debug**

- Press F5 in the extension folder to launch debug mode

## Development Commands

### Extension Development

```bash
cd conduit

# Watch mode (recommended)
npm run esbuild:watch

# One-time build
npm run esbuild

# Linting
npm run lint

# Run tests
npm test
```

### Webview UI Development

```bash
cd conduit/webview-ui

# Development server with hot reload
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
```

## Technology Stack

### Frontend

- **React** 18+ - UI framework
- **Vite** - Build tool
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

### External Services

- **Backend AI** - Intelligent payload generation (included in backend)
- **MongoDB Atlas** - Optional cloud database

## Troubleshooting

### Routes Not Detected

**Problem**: No routes appear in the sidebar.

**Solutions**:

- Ensure your Express.js project follows standard patterns
- Check that routes are defined in `.js` or `.ts` files
- Try the "Conduit: Refresh Routes" command (`Ctrl+Shift+R`)
- Check the Extension Output panel for errors (`View → Output → Conduit`)

### AI Payload Generation Issues

**Problem**: "AI payload generation failed" message.

**Solutions**:

- Verify backend is running on `http://localhost:3002`
- Check VS Code Output panel (Conduit) for error details
- Ensure route handlers are properly structured
- Check backend logs for API errors

### MongoDB Connection Issues

**Problem**: "Cannot connect to MongoDB" error.

**Solutions**:

- Verify MongoDB is running locally: `mongod`
- For MongoDB Atlas, ensure connection string is correct in `.env`
- Whitelist your IP address in MongoDB Atlas security settings
- Verify `MONGODB_URI` in `.env` is correct
- Check firewall settings

### Backend Connection Error

**Problem**: "Cannot connect to backend" in the webview.

**Solutions**:

- Ensure backend is running: `npm run dev` in `conduit-backend/`
- Verify port 3002 is available (no other process using it)
- Check `PORT` setting in `.env`
- Verify backend logs for startup errors

## Architecture

```
VS Code Extension
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

## Contributing

Contributions are welcome! Here's how to contribute:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Make** your changes and ensure code quality:
   ```bash
   npm run lint        # Check linting
   npm test            # Run tests
   npm run esbuild     # Build for production
   ```
4. **Commit** with clear, descriptive messages
5. **Push** to your branch
6. **Submit** a Pull Request with a detailed description

### Development Guidelines

- Write TypeScript for type safety
- Follow ESLint rules (`npm run lint:fix`)
- Add tests for new features
- Update documentation if needed
- Keep commit messages clear and descriptive

## Roadmap

- [ ] Multi-language support (Java, Python, Go)
- [ ] GraphQL route detection
- [ ] Performance profiling integration
- [ ] WebSocket support
- [ ] Custom validation rules
- [ ] Marketplace collection sharing
- [ ] Advanced mocking capabilities

## Known Limitations

- Currently supports Express.js only (other frameworks coming soon)
- Route detection works best with standard Express patterns
- MongoDB integration requires connection string configuration
- Backend must be running for full feature set

## Security Considerations

- **API Keys**: Never commit `.env` files with sensitive data
- **Authentication**: JWT tokens are used for secure API communication
- **Database**: Use MongoDB Atlas with IP whitelisting for production
- **CORS**: Configure CORS in `server.js` for production domains
- **Rate Limiting**: Backend includes rate limiting for API protection

## License

ISC License - See [LICENSE](./LICENSE) file for details

## Support & Resources

- 📖 [Marketplace README](./conduit/README.md)
- 🐛 [Report Issues](https://github.com/MahtabMadni/Conduit--VSCode-Extension/issues)
- 💬 [Discussions](https://github.com/MahtabMadni/Conduit--VSCode-Extension/discussions)
- 📝 [CHANGELOG](./conduit/CHANGELOG.md)
- 🔐 [Security Policy](./SECURITY.md)

## Credits

Built with ❤️ by the Conduit team

## Sponsor

If you find Conduit useful, consider giving us a ⭐ on GitHub!

---

**Happy API Testing! 🚀**
