# Conduit Backend API

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-20.0.0%2B-brightgreen)
![Express](https://img.shields.io/badge/Express.js-4.22.1%2B-green)
![MongoDB](https://img.shields.io/badge/MongoDB-6.0%2B-47A248)
![License](https://img.shields.io/badge/license-ISC-green)

> **Express.js backend server for Conduit. Handles AI payload generation, route history management, and team synchronization.**

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Server](#running-the-server)
- [API Endpoints](#api-endpoints)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Middleware](#middleware)
- [Authentication](#authentication)
- [Error Handling](#error-handling)
- [Development](#development)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## 🎯 Overview

The **Conduit Backend** is an Express.js server that provides:

- **AI Payload Generation** - Uses OpenAI GPT-4o to generate realistic test payloads
- **Route Snapshots** - Stores and retrieves historical versions of API routes
- **Team Synchronization** - Enables sharing of routes and payloads across teams
- **Authentication** - JWT-based authentication for secure API access
- **Data Management** - MongoDB-based storage for collections and snapshots

### Role in Conduit

```
VS Code Extension
       ↓
  Conduit Backend (This Server)
       ↓
  ├─ AI Generation (OpenAI)
  ├─ Database (MongoDB)
  ├─ Authentication (JWT)
  └─ History & Sync
```

The extension communicates with this backend at `http://localhost:3002` for intelligent payload generation and history management.

---

## ✨ Features

### 🤖 AI-Powered Payload Generation

- **OpenAI GPT-4o Integration** - Generate realistic test payloads based on route context
- **Groq API Support** - Alternative AI provider for faster inference
- **Context Analysis** - Analyzes route handlers and validation rules
- **Smart Defaults** - Falls back to field-name-based generation offline

### 📦 Route Management

- **Create Collections** - Save groups of related API routes
- **Store Payloads** - Save and retrieve test payloads per route
- **Version Control** - Track changes to routes over time
- **Snapshot History** - Automatic versioning on every route change

### 👥 Team Features

- **GitHub OAuth** - Sign in with GitHub for team access
- **Shared Collections** - Share route collections with teammates
- **Collaborative Editing** - Multiple users can work with same routes
- **Activity Log** - Track who changed what and when

### 🔐 Security

- **JWT Authentication** - Secure user sessions
- **Rate Limiting** - Prevent API abuse
- **Error Handling** - Comprehensive error management
- **Input Validation** - XSS and injection protection

### 🗄️ Data Management

- **MongoDB Integration** - Persistent data storage
- **Mongoose ODM** - Type-safe database queries
- **Index Optimization** - Indexed collections for fast queries
- **Data Export** - Export collections and history

---

## 📦 Prerequisites

- **Node.js** v20.0.0 or higher
- **npm** v10.0.0 or higher
- **MongoDB** v6.0 or higher (local or MongoDB Atlas)
- **OpenAI API Key** (optional, for AI features)
- **GitHub OAuth App** (optional, for team features)

### System Requirements

- **OS**: Windows, macOS, or Linux
- **RAM**: 512MB minimum (1GB recommended)
- **Disk**: 100MB for dependencies
- **Network**: Internet connection for OpenAI API

---

## 🚀 Installation

### Step 1: Install Dependencies

```bash
cd conduit-backend
npm install
```

### Step 2: Create Environment File

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Or create `.env` manually:

```env
# Server Configuration
PORT=3002
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/conduit

# OpenAI API
OPENAI_API_KEY=sk-your-api-key-here

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this

# Optional: Alternative AI Provider
GROQ_API_KEY=your-groq-api-key

# Optional: GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_CALLBACK_URL=http://localhost:3002/auth/github/callback
```

### Step 3: Verify MongoDB

Ensure MongoDB is running:

```bash
# Local MongoDB
mongod

# Or use MongoDB Atlas (update MONGODB_URI in .env)
```

### Step 4: Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server should start on `http://localhost:3002`

---

## ⚙️ Configuration

### Environment Variables

| Variable                  | Type   | Required | Default       | Description                   |
| ------------------------- | ------ | -------- | ------------- | ----------------------------- |
| `PORT`                    | number | No       | 3002          | Server port                   |
| `NODE_ENV`                | string | No       | `development` | Environment mode              |
| `MONGODB_URI`             | string | Yes      | -             | MongoDB connection string     |
| `OPENAI_API_KEY`          | string | No       | -             | OpenAI API key                |
| `JWT_SECRET`              | string | Yes      | -             | JWT signing secret            |
| `GROQ_API_KEY`            | string | No       | -             | Groq API key (alternative AI) |
| `GITHUB_CLIENT_ID`        | string | No       | -             | GitHub OAuth client ID        |
| `GITHUB_CLIENT_SECRET`    | string | No       | -             | GitHub OAuth client secret    |
| `RATE_LIMIT_WINDOW_MS`    | number | No       | 15min         | Rate limit window             |
| `RATE_LIMIT_MAX_REQUESTS` | number | No       | 100           | Max requests per window       |

### MongoDB Connection Strings

#### Local MongoDB

```env
MONGODB_URI=mongodb://localhost:27017/conduit
```

#### MongoDB Atlas (Cloud)

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/conduit?retryWrites=true&w=majority
```

#### Docker Compose

```env
MONGODB_URI=mongodb://mongo:27017/conduit
```

### JWT Secret Generation

Generate a secure JWT secret:

```bash
# On Linux/macOS
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

---

## ▶️ Running the Server

### Development Mode

```bash
# Watch mode with auto-reload
npm run dev

# Logs will show:
# Server running on http://localhost:3002
# MongoDB connected at mongodb://localhost:27017/conduit
```

### Production Mode

```bash
npm start
```

### Docker Deployment

```bash
# Build image
docker build -t conduit-backend .

# Run container
docker run -p 3002:3002 -e MONGODB_URI=mongodb://mongo:27017/conduit conduit-backend

# Or with docker-compose
docker-compose up
```

### Testing the Server

```bash
# Check server health
curl http://localhost:3002/health

# Response:
# {"status":"ok","timestamp":"2024-03-18T10:30:00Z"}
```

---

## 📡 API Endpoints

### Base URL

```
http://localhost:3002/api
```

### Authentication Routes

#### POST `/auth/register`

Register a new user.

```json
Request:
{
  "email": "user@example.com",
  "password": "secure-password",
  "name": "John Doe"
}

Response:
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST `/auth/login`

Login user.

```json
Request:
{
  "email": "user@example.com",
  "password": "secure-password"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

#### GET `/auth/github`

Redirect to GitHub OAuth.

### AI Routes

#### POST `/ai/generate-payload`

Generate payload using AI.

```json
Request:
{
  "routePath": "/api/users/:id",
  "method": "POST",
  "handlerCode": "const createUser = (req, res) => { ... }",
  "schema": { ... }
}

Response:
{
  "payload": {
    "name": "John Doe",
    "email": "john@example.com",
    "role": "admin"
  },
  "confidence": 0.95
}
```

#### POST `/ai/suggest-fixes`

Get AI suggestions for error fixes.

```json
Request:
{
  "routePath": "/api/users",
  "error": "Validation error: email is required",
  "payload": { ... },
  "handlerCode": "..."
}

Response:
{
  "suggestions": [
    "Add 'email' field to payload",
    "Ensure email format is valid"
  ]
}
```

### Collection Routes

#### GET `/collections`

List user's collections.

```json
Response:
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "User API",
    "description": "User management endpoints",
    "routes": [...]
  }
]
```

#### POST `/collections`

Create new collection.

```json
Request:
{
  "name": "Order API",
  "description": "Order management",
  "routes": []
}

Response:
{
  "_id": "507f1f77bcf86cd799439012",
  "name": "Order API",
  ...
}
```

#### PUT `/collections/:id`

Update collection.

```json
Request:
{
  "name": "Updated name",
  "routes": [...]
}

Response:
{
  "_id": "507f1f77bcf86cd799439012",
  "name": "Updated name",
  ...
}
```

#### DELETE `/collections/:id`

Delete collection.

```
Response: 200 OK
```

### Snapshot Routes

#### GET `/snapshots`

List route snapshots.

```json
Response:
[
  {
    "_id": "507f1f77bcf86cd799439013",
    "routePath": "/api/users",
    "payload": { ... },
    "timestamp": "2024-03-18T10:30:00Z",
    "version": 1
  }
]
```

#### POST `/snapshots`

Create snapshot.

```json
Request:
{
  "routePath": "/api/users",
  "method": "GET",
  "payload": { ... },
  "collectionId": "507f1f77bcf86cd799439011"
}

Response:
{
  "_id": "507f1f77bcf86cd799439013",
  "version": 1,
  ...
}
```

#### GET `/snapshots/:id/compare/:otherId`

Compare two snapshots.

```json
Response:
{
  "changes": [
    {
      "field": "email",
      "oldValue": "old@example.com",
      "newValue": "new@example.com"
    }
  ]
}
```

### User Routes

#### GET `/users/profile`

Get current user profile.

```json
Response:
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "name": "John Doe",
  "collections": 5,
  "snapshots": 42
}
```

#### PUT `/users/profile`

Update user profile.

```json
Request:
{
  "name": "Jane Doe",
  "avatar": "https://..."
}

Response:
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Jane Doe",
  ...
}
```

---

## 📁 Project Structure

```
conduit-backend/
├── server.js                         # ⭐ Entry point
├── package.json                      # Dependencies
├── .env.example                      # Env vars template
│
├── config/
│   └── db.js                         # Database connection
│       ├── connectDB()               # Connect to MongoDB
│       └── Error handling
│
├── controllers/                      # Business logic
│   ├── AuthController.js             # Authentication
│   │   ├── register()
│   │   ├── login()
│   │   └── githubCallback()
│   │
│   ├── AiController.js               # AI features
│   │   ├── generatePayload()         # Call OpenAI/Groq
│   │   ├── suggestFixes()
│   │   └── optimizePayload()
│   │
│   ├── CollectionController.js       # Collections
│   │   ├── getCollections()
│   │   ├── createCollection()
│   │   ├── updateCollection()
│   │   └── deleteCollection()
│   │
│   ├── SnapshotController.js         # Route snapshots
│   │   ├── getSnapshots()
│   │   ├── createSnapshot()
│   │   ├── compareSnapshots()
│   │   └── restoreSnapshot()
│   │
│   ├── UserController.js             # User profile
│   │   ├── getUserProfile()
│   │   └── updateProfile()
│   │
│   └── index.js                      # Export controllers
│
├── models/                           # Database schemas
│   ├── User.js                       # User schema
│   │   ├── email (unique)
│   │   ├── password (hashed)
│   │   ├── name
│   │   ├── githubId (optional)
│   │   └── createdAt
│   │
│   ├── Collection.js                 # Collection schema
│   │   ├── name
│   │   ├── description
│   │   ├── routes
│   │   ├── userId (ref: User)
│   │   ├── isPublic
│   │   └── timestamps
│   │
│   ├── RouteSnapshot.js              # Snapshot schema
│   │   ├── routePath
│   │   ├── method (GET/POST/etc)
│   │   ├── payload
│   │   ├── headers
│   │   ├── version
│   │   ├── collectionId
│   │   ├── userId
│   │   └── timestamp
│   │
│   └── index.js                      # Export models
│
├── routes/                           # API routes
│   ├── AuthRouter.js                 # Auth endpoints
│   ├── AiRouter.js                   # AI endpoints
│   ├── CollectionRouter.js           # Collection endpoints
│   ├── SnapshotRouter.js             # Snapshot endpoints
│   ├── UserRouter.js                 # User endpoints
│   └── index.js                      # Routes index
│
├── middleware/                       # Express middleware
│   ├── authentication.js             # JWT verification
│   │   ├── verifyToken()
│   │   └── requireAuth()
│   │
│   ├── error.js                      # Error handling
│   │   ├── errorHandler()
│   │   └── notFound()
│   │
│   └── passport.js                   # Passport config
│       ├── GitHub strategy
│       └── JWT strategy
│
├── utils/
│   └── labelGenerator.js             # Generate collection labels
│
└── vercel.json                       # Vercel deployment config
```

---

## 🗄️ Database Schema

### User Collection

```javascript
{
  _id: ObjectId,
  email: String (unique),
  password: String (bcrypt hashed),
  name: String,
  githubId: String (optional),
  avatar: String (URL),
  createdAt: Date,
  updatedAt: Date
}
```

### Collection Document

```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  userId: ObjectId (ref: User),
  routes: [
    {
      path: String,
      method: String,
      description: String,
      payload: Object,
      headers: Object
    }
  ],
  isPublic: Boolean,
  sharedWith: [ObjectId], // User IDs
  createdAt: Date,
  updatedAt: Date
}
```

### RouteSnapshot Document

```javascript
{
  _id: ObjectId,
  collectionId: ObjectId (ref: Collection),
  userId: ObjectId (ref: User),
  routePath: String,
  method: String (GET, POST, PUT, DELETE, PATCH),
  payload: Object,
  headers: Object,
  statusCode: Number,
  response: Object,
  version: Number,
  changes: [
    {
      field: String,
      oldValue: Any,
      newValue: Any
    }
  ],
  timestamp: Date
}
```

---

## 🔌 Middleware

### Authentication Middleware

```typescript
// Usage: router.post('/protected', authenticate, controller)
```

Verifies JWT token in `Authorization: Bearer <token>` header.

### Rate Limiting Middleware

```typescript
// Applied globally, 100 requests per 15 minutes
```

Prevents API abuse with configurable limits.

### Error Handling Middleware

```typescript
// Catches and formats all errors
// Returns: { error: "message", statusCode, timestamp }
```

### CORS Middleware

```typescript
// Allowed origins: localhost:* for development
```

Enable cross-origin requests for local testing.

---

## 🔐 Authentication

### JWT Flow

```
User Login
    ↓
Verify Credentials
    ↓
Generate JWT Token
    ↓
Client stores token
    ↓
Client sends in Authorization header
    ↓
Middleware verifies token
    ↓
Access granted
```

### JWT Token Format

```
Header: {
  "alg": "HS256",
  "typ": "JWT"
}

Payload: {
  "userId": "507f1f77bcf86cd799439011",
  "email": "user@example.com",
  "iat": 1516239022,
  "exp": 1516242622  // 1 hour
}

Signature: HMAC-SHA256(header + payload, JWT_SECRET)
```

### GitHub OAuth

1. User clicks "Login with GitHub"
2. Redirected to GitHub authorization page
3. GitHub redirects back with auth code
4. Backend exchanges code for access token
5. Backend creates/finds user in database
6. Backend generates JWT token
7. User logged in

---

## 🚨 Error Handling

### Error Response Format

```json
{
  "error": "Validation error",
  "message": "Email is required",
  "statusCode": 400,
  "timestamp": "2024-03-18T10:30:00Z",
  "path": "/api/users"
}
```

### Common Error Codes

| Status | Meaning           | Example                |
| ------ | ----------------- | ---------------------- |
| 400    | Bad Request       | Missing required field |
| 401    | Unauthorized      | Invalid token          |
| 403    | Forbidden         | No permission          |
| 404    | Not Found         | Resource doesn't exist |
| 429    | Too Many Requests | Rate limit exceeded    |
| 500    | Server Error      | Unhandled exception    |

### Logging

Errors are logged to:

- `console` in development mode
- File rotation in production
- Third-party service (Sentry) if configured

---

## 🛠️ Development

### Running Tests

```bash
npm test
```

### Code Quality

```bash
# ESLint
npm run lint

# Auto-fix
npm run lint:fix
```

### API Documentation

Generate with:

```bash
npm run docs
```

Swagger UI runs at `http://localhost:3002/api-docs`

### Debugging

```bash
# Start with debugger
node --inspect server.js

# Or use VS Code Debug with .vscode/launch.json
```

---

## 🚀 Deployment

### Vercel Deployment

1. Push code to Git repository
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically on push

### Heroku Deployment

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=mongodb+srv://...
heroku config:set JWT_SECRET=...

# Deploy
git push heroku main
```

### Docker Deployment

```bash
# Build image
docker build -t conduit-backend .

# Run
docker run -p 3002:3002 \
  -e MONGODB_URI=mongodb://mongo:27017/conduit \
  -e JWT_SECRET=your-secret \
  conduit-backend

# Or with docker-compose
docker-compose up -d
```

### Environment Check

Before deploying, verify:

```bash
# Check all dependencies
npm list

# Verify MongoDB connection
node -e "require('./config/db').connectDB()"

# Check API health
curl http://localhost:3002/health
```

---

## 🐛 Troubleshooting

### MongoDB Connection Error

**Problem**: `MongoDB connection failed`

**Solutions**:

- Ensure MongoDB is running: `mongod`
- Check connection string in `.env`
- For MongoDB Atlas: whitelist IP address in security settings
- Test connection: `mongo "your-connection-string"`

### OpenAI API Error

**Problem**: `OpenAI API key is invalid`

**Solutions**:

- Verify API key is correct in `.env`
- Check API key has available credits
- Ensure API key has permissions for GPT-4o model
- Test: `curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY"`

### Port Already in Use

**Problem**: `EADDRINUSE: address already in use :::3002`

**Solutions**:

- Change port in `.env`: `PORT=3003`
- Kill existing process on port 3002:

  ```bash
  # Linux/macOS
  lsof -i :3002 | xargs kill -9

  # Windows (PowerShell)
  Get-Process -Id (Get-NetTCPConnection -LocalPort 3002).OwningProcess | Stop-Process
  ```

### JWT Token Issues

**Problem**: `Invalid token` or `Token expired`

**Solutions**:

- Ensure JWT_SECRET is set in `.env`
- Check token format in request: `Authorization: Bearer <token>`
- Generate new token by logging in again
- Increase token expiration: `exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24)` (24 hours)

### Rate Limiting

**Problem**: `Too many requests` error

**Solutions**:

- Adjust rate limit in middleware:
  ```javascript
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // increase this
  });
  ```

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and test
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Code Standards

- Use ES6+ syntax
- Write meaningful variable names
- Add comments for complex logic
- Test your changes
- Follow existing code style

---

## 📄 License

ISC License - See main project LICENSE.

---

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [OpenAI API Docs](https://platform.openai.com/docs/)
- [JWT Documentation](https://jwt.io/)
- [Mongoose Documentation](https://mongoosejs.com/)

---

## 👥 Support

For issues or questions:

- **GitHub Issues**: Report bugs or request features
- **Email**: [support@example.com](mailto:support@example.com)
- **Discord**: Join our community server

---

<div align="center">

**Built with Express, MongoDB, and dedication to great APIs**

_Part of the Conduit Project - [Main README](../README_FINAL.md)_

</div>
