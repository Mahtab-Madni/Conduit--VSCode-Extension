# Conduit - AI-Powered API Playground for VSCode

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-ISC-green)
![VS Code](https://img.shields.io/badge/VSCode-1.109.0%2B-orange)
![Node.js](https://img.shields.io/badge/Node.js-20.0.0%2B-brightgreen)

> **Automatically detect, analyze, and test API routes directly from your source code. Zero-configuration AI-powered payload generation with instant Postman/OpenAPI exports.**

---

## 🎯 What is Conduit?

Conduit is a powerful VSCode extension that transforms your Express.js API development workflow. It automatically discovers all your API routes, generates realistic test payloads using AI, and provides an interactive testing playground—all without leaving VS Code.

### In 30 Seconds:

- **Route Detection**: Automatically scans your project for Express.js routes
- **AI Payloads**: OpenAI GPT generates realistic request data based on your code
- **Built-in Tester**: Make HTTP requests and see responses instantly
- **Professional Exports**: One-click Postman Collections and OpenAPI specs
- **Route History**: Track changes and compare versions over time

---

## ✨ Key Features

### 🔍 **Intelligent Route Detection**

- Automatically discovers all Express.js routes in your project
- Extracts HTTP methods, paths, handlers, and middleware
- Supports nested routers and dynamic route parameters
- Works with both JavaScript and TypeScript
- Real-time updates on file changes

### 🤖 **AI-Powered Payload Generation**

- AI analyzes your route handlers and generates realistic test data
- Hybrid intelligence: learns from both source code and MongoDB collection schemas
- Creates contextually appropriate payloads for different endpoints
- Adaptive learning from your data models

### 📤 **Professional Export Formats**

- **Postman v2.1**: Generate complete collection files with authentication setup
- **OpenAPI 3.0/Swagger**: Create standardized API documentation with request/response schemas
- **cURL Commands**: Copy-paste ready commands for terminal testing
- All exports include AI-predicted payloads and proper authentication

### 🧪 **Interactive API Testing**

- Built-in HTTP client for testing endpoints
- Real-time request/response visualization
- Support for different content-types and headers
- Bearer token authentication support
- Debug errors with AI-powered suggestions

### ⏳ **Route History & Snapshots**

- Automatic snapshots capture route changes on every file modification
- Compare route versions side-by-side
- Track payload evolution over time
- GitHub-synced history for version control

### 🔐 **Advanced Features**

- MongoDB collection schema integration
- Route filtering and search functionality
- Support for GET, POST, PUT, DELETE, PATCH methods
- VS Code theme compatibility (Dark, Light, High Contrast)
- Error handling and validation

---

## 📁 Project Structure

```
Conduit/
├── conduit/                          # VSCode Extension
│   ├── src/
│   │   ├── extension.ts              # Extension entry point
│   │   ├── detection/
│   │   │   └── routeDetection.ts     # Route parser & analyzer
│   │   ├── backend/
│   │   │   └── syncClient.ts         # Fixed backend URL management
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
│   │   │   ├── openApiExporter.ts    # OpenAPI/Swagger export
│   │   │   ├── curlGenerator.ts      # cURL command generation
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── apiService.ts
│   │   │   └── snapshotService.ts
│   │   ├── webview/
│   │   │   ├── WebviewPanel.ts       # Webview controller
│   │   │   └── WebviewProvider.ts
│   │   └── test/
│   │       └── extension.test.ts
│   ├── webview-ui/                   # React frontend
│   │   ├── src/
│   │   │   ├── main.jsx              # App entry
│   │   │   ├── App.jsx               # Main component
│   │   │   ├── components/
│   │   │   │   ├── RouteList.jsx     # Route display
│   │   │   │   ├── Playground.jsx    # API tester
│   │   │   │   ├── PayloadForm.jsx   # Payload editor
│   │   │   │   ├── ResponseView.jsx  # Response display
│   │   │   │   ├── HistoryPanel.jsx  # History browser
│   │   │   │   ├── JsonEditor.jsx    # JSON editor
│   │   │   │   ├── DiffView.jsx      # Diff viewer
│   │   │   │   └── AiResponseFormatter.jsx
│   │   │   └── [styles & assets]
│   │   ├── package.json
│   │   └── vite.config.js
│   ├── webview-dist/                 # Built frontend
│   ├── package.json
│   ├── tsconfig.json
│   └── esbuild.js
│
├── conduit-backend/                  # Express.js Backend API
│   ├── server.js                     # Server entry point
│   ├── config/
│   │   └── db.js                     # Database configuration
│   ├── controllers/
│   │   ├── AiController.js           # AI payload endpoints
│   │   ├── AuthController.js         # Authentication
│   │   ├── CollectionController.js   # MongoDB collections
│   │   ├── SnapshotController.js     # Route snapshots
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
│   └── package.json
│
└── README.md                         # This file
```

---

## 🚀 Quick Start

### Prerequisites

- **VS Code** v1.109.0 or higher
- **Node.js** v20.0.0 or higher
- **npm** v10.0.0 or higher
- **MongoDB** (local or cloud instance like MongoDB Atlas)
- **GitHub OAuth credentials** (optional, for route history)

### Installation & Setup

#### 1. Clone and Install Dependencies

```bash
# Navigate to the workspace
cd C:\Users\mahta\Desktop\Conduit

# Install extension dependencies
cd conduit
npm install

# Install webview UI dependencies
cd webview-ui
npm install
cd ..

# Install backend dependencies
cd ../conduit-backend
npm install
```

#### 2. Configure Environment Variables

Create `.env` files in both `conduit-backend`:

**conduit-backend/.env**

```
MONGODB_URI=mongodb://localhost:27017/conduit
OPENAI_API_KEY=your_openai_api_key
JWT_SECRET=your_jwt_secret
NODE_ENV=development
PORT=3002
```

> **Note:** The extension uses a fixed backend URL of `http://localhost:3002` via [src/backend/syncClient.ts](conduit/src/backend/syncClient.ts). No user configuration is needed for the backend connection.

#### 3. Start MongoDB

```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas (update MONGODB_URI in .env)
```

#### 4. Build and Run

```bash
# Build the webview UI
cd conduit/webview-ui
npm run build
cd ..

# Build the extension
npm run esbuild

# In another terminal, start the backend
cd conduit-backend
npm run dev

# In VS Code, press F5 to launch the extension in debug mode
```

---

## 💻 Development Workflow

### Building the Extension

```bash
cd conduit

# Development build (watch mode)
npm run esbuild:watch

# Production build
npm run esbuild
```

### Building the Webview UI

```bash
cd conduit/webview-ui

# Development server
npm run dev

# Production build
npm run build
```

### Running the Backend

```bash
cd conduit-backend

# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### Running Tests

```bash
cd conduit
npm test
```

---

## 🎮 How to Use

### 1. **Detect Routes**

- Open a project with Express.js routes
- Click the Conduit icon in the VS Code sidebar
- Routes are automatically detected and displayed

### 2. **Generate Payloads**

- Select a route from the list
- Click "Generate Payload with AI"
- Review and edit the suggested payload
- AI analyzes your code to create realistic test data

### 3. **Test API Endpoints**

- Click on a route to open the playground
- Configure the request (method, headers, authentication)
- Click "Send Request"
- See the response immediately displayed
- Use AI to debug errors if needed

### 4. **Export for Documentation**

- Click "📤 Postman" to export as Postman Collection
- Click "📋 OpenAPI" to generate OpenAPI specification
- Click "📋 cURL" to copy command-line command
- Import/use in your preferred tools

### 5. **Track Changes**

- Route snapshots are automatically created on file changes
- Click "History" to view version comparisons
- See how payloads evolved over time

---

## 🔧 Technology Stack

### Frontend

- **React** - UI framework
- **Vite** - Frontend build tool
- **TypeScript** - Type safety
- **CSS3** - Styling with theme variables

### Backend

- **Express.js** - Node.js framework
- **MongoDB** - Database
- **Passport.js** - Authentication
- **OpenAI API** - AI payload generation
- **Mongoose** - ODM for MongoDB

### Extension

- **VS Code API** - Extension framework
- **TypeScript** - Type-safe code
- **esbuild** - Fast bundler
- **ESLint** - Code quality

### APIs & Services

- **OpenAI GPT-4** - Intelligent payload generation
- **MongoDB** - Route and configuration storage
- **GitHub API** - Optional OAuth integration

---

## 🏗️ Architecture & Code Organization

### Code Structure Highlights

The extension follows a modular architecture with clear separation of concerns:

- **`src/detection/`** - Route detection logic (Babel-based AST parsing)
- **`src/backend/`** - Backend sync client with fixed server URL configuration
- **`src/webview/`** - Webview UI controller and panel management
- **`src/ai/`** - AI payload prediction and error suggestion logic
- **`src/db/`** - MongoDB connection, schema inference, and data fetching
- **`src/exporters/`** - Postman, OpenAPI, and cURL export utilities
- **`src/services/`** - API communication and snapshot management

### Backend Integration

- **Fixed Backend URL**: Uses [src/backend/syncClient.ts](conduit/src/backend/syncClient.ts) singleton for consistent backend communication
- **No User Configuration**: Backend URL (`http://localhost:3002`) is hardcoded and managed centrally
- **Simplified Deployment**: Removes configuration burden from users

---

## 📊 Features by Status

| Feature               | Status      | Details                                |
| --------------------- | ----------- | -------------------------------------- |
| Route Detection       | ✅ Complete | Discovers all Express.js routes        |
| AI Payload Generation | ✅ Complete | OpenAI-powered intelligent suggestions |
| API Testing           | ✅ Complete | Built-in HTTP client                   |
| Postman Export        | ✅ Complete | v2.1 collection format                 |
| OpenAPI Export        | ✅ Complete | OpenAPI 3.0 specification              |
| cURL Export           | ✅ Complete | Command-line ready                     |
| Route History         | ✅ Complete | Version tracking & comparison          |
| MongoDB Integration   | ✅ Complete | Schema inference & analysis            |
| Theme Support         | ✅ Complete | Dark, Light, High Contrast             |
| Route Search/Filter   | ✅ Complete | Real-time filtering                    |
| Error Handling        | ✅ Complete | AI-powered debugging suggestions       |

---

## 🔐 Security Considerations

- **API Keys**: Store sensitive keys in `.env` files (never commit to git)
- **Authentication**: Uses JWT tokens for secure API communication
- **MongoDB**: Restrict network access to your database
- **Rate Limiting**: Backend includes rate limiting for API protection
- **CORS**: Configured for development—update for production

---

## 🐛 Troubleshooting

### Routes Not Detected

- Ensure your Express.js project follows standard patterns
- Check that routes are defined in `.js` or `.ts` files
- Try refreshing with the "Refresh Routes" command

### AI Payload Generation Fails

- Verify OpenAI API key is valid and has available credits
- Check API rate limits
- Review error messages in the debug console

### MongoDB Connection Issues

- Ensure MongoDB is running (`mongod` command)
- Check connection string in `.env`
- Verify network access if using MongoDB Atlas

### Extension Won't Start

- Ensure all dependencies are installed (`npm install`)
- Check Node.js version (must be v20+)
- Clear VS Code cache: `Ctrl+Shift+P` → "Developer: Reload Window"

---

## 📝 Configuration

### VS Code Extension Settings

In VS Code settings (`settings.json`):

```json
{
  "conduit.mongodbUri": "mongodb://localhost:27017/conduit",
  "conduit.openaiApiKey": "your-api-key",
  "conduit.backendUrl": "http://localhost:3000",
  "conduit.theme": "auto"
}
```

### MongoDB Connection

Update `MONGODB_URI` in `.env`:

- **Local**: `mongodb://localhost:27017/conduit`
- **MongoDB Atlas**: `mongodb+srv://username:password@cluster.mongodb.net/conduit`

---

## 🤝 Contributing

We welcome contributions! Here's how to contribute:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow the existing code style (ESLint config provided)
- Write TypeScript with proper type annotations
- Add tests for new features
- Update documentation
- Keep commits atomic and well-described

---

## 📄 License

This project is licensed under the **ISC License** - see individual files for details.

---

## 👥 Project Team

Built with dedication for seamless API development in VS Code.

---

## 🙏 Acknowledgments

- **OpenAI** for GPT-4 API enabling intelligent payload generation
- **MongoDB** community for excellent database tools
- **Express.js** team for the robust web framework
- **VS Code** team for the amazing extension API

---

## 📞 Support

For issues, questions, or feature requests:

- Open an issue on GitHub
- Check existing documentation in the project
- Review the troubleshooting section above

---

## 🚀 What's Next?

Future enhancements planned for Conduit:

- GraphQL schema detection and testing
- Webhook simulation and monitoring
- Advanced mocking and stubbing
- Load testing and performance profiling
- Integration with CI/CD pipelines
- Mobile API testing dashboard

---

**Happy API Testing! 🎉**

_Last Updated: March 2026_
