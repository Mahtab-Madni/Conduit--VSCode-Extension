# Conduit VS Code Extension

## The Conduit VS Code extension

With the Conduit VS Code extension, you can develop and test your Express.js APIs directly in VS Code without switching to external tools. You can use the VS Code extension to automatically detect routes, generate intelligent test payloads with AI, send HTTP requests, and export to Postman or OpenAPI. Streamline your API development workflow by testing your APIs in the same application you use to develop them.

The VS Code extension also supports MongoDB integration for realistic test data and team collaboration features.

[![Version](https://img.shields.io/badge/version-0.0.1-blue?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=MahtabMadni.Conduit)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.109.0%2B-007ACC?style=flat-square&logo=visual-studio-code)](https://code.visualstudio.com)
[![Node.js](https://img.shields.io/badge/Node.js-20.0.0%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](LICENSE)

> To learn more about the Conduit VS Code extension and its capabilities, check out the [documentation](#resources).

## Prerequisites

Before you begin, you'll need:

- **Visual Studio Code** - v1.109.0 or higher
- **Express.js Project** - An active Node.js project with Express.js routes
- **Optional: MongoDB** - Set up MongoDB v6.0+ (local or MongoDB Atlas) to populate realistic test data from your actual database

## Get started

To get started with Conduit, do the following:

1. **Install the extension** - Download Conduit from the VS Code marketplace
2. **Open an Express project** - Conduit automatically scans and detects all your routes
3. **Select a route** - Click any route in the sidebar to view its details
4. **Generate & test** - AI generates a pre-filled payload, customize and click "Send Request"
5. **View response** - See the response instantly with syntax highlighting
6. **Export** - Share your API with teammates via Postman Collection, OpenAPI, or cURL

> AI payload generation is powered by our backend—no API keys required!

## Features

The following are examples of features supported in the VS Code extension:

- Automatically detect and list all Express.js routes in real-time
- Generate intelligent test payloads with built-in AI (no API keys required)
- Send HTTP requests and view responses directly in VS Code
- Export routes to Postman Collection (v2.1) for team collaboration
- Export routes as OpenAPI 3.0 specification for documentation
- Generate cURL commands for terminal-based testing
- Track route changes with automatic versioning and side-by-side comparison
- Connect to MongoDB to populate test data from your actual database
- Support for Bearer token authentication and custom headers
- AI-powered error suggestions for debugging 4xx/5xx responses
- Inspect MongoDB collection schemas for better understanding
- Works in Dark, Light, and High Contrast VS Code themes

## Configuration

Optional settings in VS Code (Settings → Conduit):

- **MongoDB URI** - Connect to your MongoDB instance for realistic test data
- **Backend URL** - Custom backend URL if using a different server (defaults to `http://localhost:3002`)

All AI features work out-of-the-box with no additional configuration needed.

## Share feedback

Share your feedback to help improve the extension.

To create a bug or feature request, do the following:

1. Click **Views and More Actions** at the top of the sidebar
2. Select **Report Bug / Share Feedback**
3. The VS Code extension opens a new screen that directs you to GitHub
4. Click **Get started** to create a new issue
5. Enter the bug or feature request details, then click **Submit new issue**

---

## Resources

- [GitHub Repository](https://github.com/Mahtab-Madni/Conduit--VSCode-Extension)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=MahtabMadni123.conduit-api-playground)
- [Issue Tracker](https://github.com/Mahtab-Madni/Conduit--VSCode-Extension/issues)
- [Changelog](CHANGELOG.md)

---

## License

ISC License - See LICENSE file
