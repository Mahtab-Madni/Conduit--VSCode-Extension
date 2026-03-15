# Conduit - API Detection & Testing VSCode Extension

**Automatically detect, analyze, and test API routes directly from your source code. Zero-configuration AI-powered payload generation with instant Postman/OpenAPI exports.**

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![VS Code](https://img.shields.io/badge/VSCode-1.109.0%2B-orange)

## 🎯 What It Does (2 Sentences)

Conduit instantly discovers all API routes in your project and generates realistic test payloads using AI. It lets you test endpoints, export to Postman/OpenAPI, and tracks all changes - everything without leaving VS Code.

## ✨ Key Features

### 🔍 **Intelligent Route Detection**

- Automatically scans your project for Express.js routes
- Extracts path, method, handlers, and middleware
- Supports nested routers and dynamic routes
- Works with TypeScript and JavaScript

### 🤖 **AI-Powered Payload Generation**

- OpenAI GPT analyzes your route handlers
- Generates realistic request payloads automatically
- Learns from MongoDB collection schemas
- Hybrid mode: Code + Database intelligence

### 📤 **Professional Exports**

- **Postman v2.1** - Import directly into Postman
- **OpenAPI 3.0** - Generate Swagger/Redoc documentation
- **cURL** - Copy-paste ready commands
- All exports include AI-predicted data

### 🧪 **Built-in API Tester**

- Make HTTP requests without leaving VS Code
- See responses in real-time
- Debug errors with AI suggestions
- Token-based authentication support

### ⏳ **Route History & Snapshots**

- Automatic snapshots on file changes
- Compare route versions over time
- See payload evolution
- GitHub-synced history

### 🎨 **Theme Compatible**

- Dark, Light, and High Contrast modes
- Seamless VS Code integration
- Real-time theme switching

### 🔐 **Secure Authentication**

- GitHub OAuth integration
- Cross-device route sync
- Snapshot backup to cloud

## 🚀 Quick Start

### 1. Install Extension

- Open VS Code
- Go to Extensions (Ctrl+Shift+X)
- Search "Conduit"
- Click Install

### 2. Open Your Project

- File → Open Folder
- Select project with Express API routes
- Conduit auto-loads

### 3. View Routes

- Press `Ctrl+Shift+P` → "Conduit: Open Panel"
- See all routes with AI payloads
- Test directly in the playground

### 4. Export

- Click **Postman** to export collection
- Click **OpenAPI** to export spec
- Import into Postman/Swagger Editor

## 🎮 Usage Guide

### Detecting Routes

Routes are automatically detected from:

```javascript
// Express.js
app.get("/users", handler);
app.post("/users", handler);
router.put("/users/:id", handler);

// Nested routers
app.use("/api", apiRouter);

// With middleware
app.get("/protected", auth, handler);
```

### Testing Routes

1. **Select a route** from the list
2. **Auto-fills:** URL, method, AI-predicted payload
3. **Adjust:** Edit headers, body, parameters
4. **Send:** Click "Send" button
5. **Debug:** View response with status code

### Exporting Collections

```
Click "Postman" → Save as .json → File → Import in Postman
```

**Exported includes:**

- All routes grouped by namespace
- AI-predicted request bodies
- Headers with auth token variable
- Proper content-type headers

### Generating OpenAPI

```
Click "OpenAPI" → Save as .yaml → Open in Swagger Editor
```

**Specification includes:**

- Path documentation
- Parameter descriptions
- Request/response schemas
- Security definitions (Bearer token)

### Copying cURL Commands

```
1. Configure request in playground
2. Click "📋 cURL"
3. Command copied to clipboard
4. Paste in terminal or docs
```

**Example output:**

```bash
curl -X POST "http://localhost:3000/api/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN_HERE" \
  -d '{"name":"John Doe","email":"john@example.com"}'
```

### Searching Routes

- **Search bar:** Type path, handler, or filename
- **Method filters:** Click GET/POST/PUT/DELETE/PATCH
- **Show count:** "5/12 routes" (matching/total)

## ⚙️ Configuration

Add to VS Code `settings.json`:

```json
{
  "conduit.baseUrl": "http://localhost:3000",
  "conduit.snapshot.enabled": true,
  "conduit.snapshot.debounceMs": 2000,
  "conduit.enableHybridMode": true,
  "conduit.mongodb.enabled": true
}
```

## 🔧 Prerequisites

- **Node.js** 16+
- **VS Code** 1.109.0+
- **Express.js** (or compatible routing framework)
- **OpenAI API Key** (for AI payload generation)
- **MongoDB** (optional, for hybrid mode)

## 📋 Requirements

### Extension

- VS Code 1.109.0 or higher
- JavaScript/TypeScript support

### AI Features

- OpenAI API account
- Valid API key in settings

### History Features

- GitHub account (optional, for backup)
- MongoDB connection (optional, for real data)

## 📊 AI Payload Generation

Conduit uses OpenAI to understand your routes and generate realistic payloads:

```typescript
// Your route
router.post('/orders', (req, res) => {
  const { user_id, items, total } = req.body;
  // Process order...
});

// Conduit AI predicts:
{
  "user_id": "507f1f77bcf86cd799439011",
  "items": [
    {
      "product_id": "507f191e810c19729de860ea",
      "quantity": 2,
      "price": 29.99
    }
  ],
  "total": 59.98
}
```

**The AI considers:**

- Parameter names and types
- Handler logic and validation
- Database schema patterns
- Common API conventions

## 🔐 Authentication

### GitHub OAuth

1. Go to GitHub Settings → Developer Settings
2. Create OAuth App
3. Get Client ID & Secret
4. Paste into Extension Settings

### API Keys

- Store in VS Code settings or environment variables
- Never commit to git
- Support for .env files

## 🐛 Known Issues

- Some route patterns with complex middleware may not detect
- AI generation requires valid OpenAI API key
- Real data fetching requires MongoDB connection
- Large codebases (10k+ lines) may take longer to scan

## 🤝 Contributing

Contributions welcome!

1. Fork on GitHub
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 💬 Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/conduit/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/conduit/discussions)
- **Documentation:** See WEEK6-README.md for detailed guide

## 📝 Release Notes

### 1.0.0 - Feature Complete

- ✅ Route detection from source code
- ✅ AI-powered payload generation
- ✅ Postman collection export
- ✅ OpenAPI/Swagger export
- ✅ cURL command generation
- ✅ Built-in API tester
- ✅ Route history with GitHub sync
- ✅ Multi-theme support
- ✅ Route search and filtering

## 📄 License

MIT License - Free for personal and commercial use

## 🙏 Acknowledgments

Built with:

- VS Code Extension API
- Babel (code parsing)
- OpenAI API (AI features)
- MongoDB (optional storage)

---

**Made for developers, by developers.** ⚡

Got an idea? Open an issue or discussion!
