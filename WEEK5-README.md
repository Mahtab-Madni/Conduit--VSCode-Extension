# Conduit VSCode Extension - Week 5 Features

This Week 5 implementation adds powerful time-travel history features to the Conduit VSCode extension, allowing you to track and compare route changes over time.

## 🚀 Week 5 Features

### ✅ Complete Feature Set

- **MERN Backend Server** - Full Express.js server with MongoDB
- **Route Snapshots** - Automatic capture of code changes
- **GitHub OAuth** - Secure authentication and cross-device sync
- **History Timeline** - Visual timeline of all route versions
- **Diff Comparison** - Side-by-side and unified diff views
- **Real-time Sync** - Background snapshots on file saves

## 📋 Prerequisites

- **Node.js** (v16 or higher)
- **MongoDB** (local or cloud instance)
- **GitHub Account** (for OAuth)
- **VS Code** (v1.109.0 or higher)

## 🛠️ Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Navigate to the workspace
cd "C:\Users\mahta\OneDrive\Desktop\Conduit"

# Install frontend dependencies
cd conduit
npm install

# Install webview dependencies
cd webview-ui
npm install
cd ..

# Install backend dependencies
cd ../conduit-backend
npm install
```

### 2. MongoDB Setup

**Option A: Local MongoDB**

```bash
# Install MongoDB locally and start service
mongod --dbpath /path/to/your/db
```

**Option B: MongoDB Atlas (Cloud)**

1. Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a new cluster
3. Get connection string

### 3. GitHub OAuth App Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in details:
   - **Application name:** `Conduit VSCode Extension`
   - **Homepage URL:** `http://localhost:3001`
   - **Authorization callback URL:** `http://localhost:3001/auth/github/callback`
4. Copy the Client ID and Client Secret

### 4. Backend Configuration

```bash
# In conduit-backend directory
cp .env.example .env
```

Edit `.env` file:

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/conduit  # or your Atlas URI
MONGODB_DB_NAME=conduit

# Server Configuration
PORT=3001
NODE_ENV=development

# JWT Configuration (generate a strong secret)
JWT_SECRET=your_super_secure_jwt_secret_key_here

# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id_from_step_3
GITHUB_CLIENT_SECRET=your_github_client_secret_from_step_3
GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback

# Frontend URL
CLIENT_URL=http://localhost:3000
```

### 5. Start the Backend Server

```bash
# In conduit-backend directory
npm run dev

# Should see:
# Conduit Backend running on port 3001
# Connected to MongoDB
```

### 6. Build and Run the Extension

```bash
# In conduit directory
npm run compile

# OR for development with watch mode
npm run watch
```

### 7. Load Extension in VS Code

1. Open VS Code
2. Press `F5` or go to **Run → Start Debugging**
3. This opens a new Extension Development Host window
4. Open a project with API routes (Express.js, FastAPI, etc.)
5. Press `Ctrl+Shift+P` → "Conduit: Open Panel"

## 🎯 Usage Guide

### Authentication

1. Click the "Login" button in the Conduit panel
2. Complete GitHub OAuth flow in your browser
3. Extension automatically detects login completion

### Auto Snapshots

- Snapshots are created automatically when you save files containing routes
- No manual action needed - works in the background
- Configurable via VS Code settings (`Ctrl+,` → search "conduit")

### Viewing History

1. Select a route from the sidebar
2. Click "📅 History" button to toggle history panel
3. See timeline of all route versions with timestamps
4. Click any snapshot to restore its payload in the playground

### Comparing Versions

1. In history panel, click "Compare" tab
2. Select two snapshots to compare
3. View side-by-side or unified diff
4. Compare both payload structure and code changes

### Manual Snapshots

- Use `Ctrl+Shift+P` → "Conduit: Create Snapshot" to force a snapshot
- Use `Ctrl+Shift+P` → "Conduit: Toggle Auto-Snapshot" to enable/disable

## ⚙️ Configuration

### VS Code Settings

```json
{
  "conduit.snapshot.enabled": true,
  "conduit.snapshot.debounceMs": 2000,
  "conduit.snapshot.maxSize": 1048576,
  "conduit.snapshot.excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**"
  ],
  "conduit.backend.url": "http://localhost:3001"
}
```

### Backend Configuration

Edit `conduit-backend/.env` to customize:

- Database connection
- JWT expiration
- Rate limiting
- CORS settings

## 🔧 Troubleshooting

### Backend Issues

```bash
# Check if MongoDB is running
mongo --eval "db.adminCommand('ismaster')"

# Check backend logs
cd conduit-backend
npm run dev

# Test backend health
curl http://localhost:3001/health
```

### Authentication Issues

- Ensure GitHub OAuth URLs match exactly
- Check that callback URL is correct
- Verify Client ID and Secret are correct
- Clear VS Code secrets: `Ctrl+Shift+P` → "Developer: Reload Window"

### Extension Issues

```typescript
// Check console for errors
// In Extension Development Host:
// Help → Toggle Developer Tools → Console
```

### Database Issues

```bash
# Reset database (caution: deletes all data)
mongo conduit --eval "db.dropDatabase()"

# Check collections
mongo conduit --eval "show collections"
```

## 🏗️ Architecture

### Backend (conduit-backend/)

- **Express.js** server with TypeScript
- **MongoDB** with Mongoose ODM
- **Passport.js** GitHub OAuth
- **JWT** authentication
- **Rate limiting** and security

### Extension (conduit/)

- **TypeScript** VS Code extension
- **Automatic file watching** and route detection
- **Background snapshot service**
- **WebView integration** with React

### Frontend (conduit/webview-ui/)

- **React** with modern hooks
- **History timeline** component
- **Diff viewer** with syntax highlighting
- **Responsive design** for various panel sizes

## 📁 File Structure

```
conduit-backend/
├── models/
│   ├── User.js          # GitHub user model
│   ├── RouteSnapshot.js # Route version history
│   ├── Collection.js    # Route collections
│   └── index.js
├── server.js            # Main Express server
├── package.json
└── .env.example

conduit/
├── src/
│   ├── services/
│   │   ├── apiService.ts     # Backend API client
│   │   └── snapshotService.ts # Auto-snapshot logic
│   ├── extension.ts          # Main extension
│   ├── webviewPanel.ts       # WebView integration
│   └── routeDetection.ts     # Route parsing
├── webview-ui/
│   └── src/components/
│       ├── HistoryPanel.jsx  # Timeline UI
│       ├── DiffView.jsx      # Comparison UI
│       └── App.jsx           # Main app
└── package.json
```

## 🎨 Features in Detail

### Route Snapshots

- **Automatic Capture:** Every file save creates a snapshot if routes changed
- **Code Hashing:** Deduplication prevents identical snapshots
- **Metadata:** Framework detection, file size, timestamp
- **Payload Prediction:** AI-powered payload structure inference

### GitHub Integration

- **OAuth 2.0** secure authentication
- **Cross-device Sync** - history available on all machines
- **User Profiles** with GitHub info and avatar
- **Secure Storage** using VS Code SecretStorage API

### History Timeline

- **Visual Timeline** with icons and timestamps
- **Smart Timestamps** ("2 hours ago", "Yesterday")
- **Framework Badges** (Express, FastAPI, Django, etc.)
- **Collection Grouping** for organized route management
- **Responsive Design** adapts to panel size

### Diff Comparison

- **Side-by-side View** with syntax highlighting
- **Unified Diff** showing additions/deletions
- **Payload Diff** highlighting field changes and types
- **Code Diff** with line-by-line comparison
- **Smart Algorithm** detecting additions, removals, modifications

## 🔒 Security

- **JWT Tokens** with configurable expiration
- **Rate Limiting** prevents API abuse
- **CORS Protection** restricts cross-origin requests
- **Input Validation** on all API endpoints
- **Secret Storage** for sensitive data in VS Code

## 🚀 Performance

- **Debounced Snapshots** prevent excessive API calls
- **Background Processing** doesn't block editor
- **Efficient Diff Algorithm** for large files
- **Pagination** for large history sets
- **Caching** for frequently accessed data

## 💡 Tips

1. **Use Collections** to organize related routes
2. **Tag Snapshots** for easy filtering (coming soon)
3. **Configure Exclude Patterns** to avoid unnecessary snapshots
4. **Monitor Backend Logs** for debugging
5. **Backup Database** before major changes

## 🛣️ Roadmap

- **Export/Import** collections and history
- **Team Collaboration** features
- **Advanced Search** and filtering
- **Automated Testing** integration
- **Performance Analytics** and insights

---

**Happy Time Traveling! 🕰️** Use Conduit to never lose track of your API evolution again.
