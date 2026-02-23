import * as vscode from "vscode";
import { RouteDetector } from "./routeDetection";
import { ConduitPanel } from "./webviewPanel";
import { PayloadPredictor } from "./ai/payloadPredictor";
import {
  getMongoConnector,
  initializeMongoDB,
  cleanupMongoDB,
} from "./db/mongoConnector";
import { getAllSchemas } from "./db/schemaViewer";
import { ConduitApiService } from "./services/apiService";
import { SnapshotService } from "./services/snapshotService";

let routeDetector: RouteDetector;
let currentPanel: ConduitPanel | undefined;
let apiService: ConduitApiService;
let snapshotService: SnapshotService;

export function activate(context: vscode.ExtensionContext) {
  console.log("[Conduit] Extension activation started");

  // Show a visible notification for debugging
  vscode.window.showInformationMessage("Conduit extension is activating...");

  try {
    // Initialize route detector
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage(
        "Conduit requires an open workspace folder",
      );
      console.log("[Conduit] No workspace folder found, exiting activation");
      return;
    }

    console.log("[Conduit] Workspace root:", workspaceRoot);
    routeDetector = new RouteDetector(workspaceRoot);

    // Initialize API service
    console.log("[Conduit] Initializing API service...");
    apiService = new ConduitApiService(context);

    // Initialize snapshot service
    console.log("[Conduit] Initializing snapshot service...");
    snapshotService = new SnapshotService(context, apiService, routeDetector);

    // Initialize MongoDB connection (non-blocking)
    initializeMongoDB()
      .then((connected) => {
        if (connected) {
          console.log("Conduit: MongoDB connected successfully");
        } else {
          console.log("Conduit: MongoDB not available, using AI-only mode");
        }
      })
      .catch((error) => {
        console.warn("Conduit: MongoDB initialization failed:", error);
      });

    // Register URI handler for OAuth callback first (so we can reference it in commands)
    console.log("[Conduit] Registering URI handler...");
    const uriHandler = vscode.window.registerUriHandler({
      handleUri: async (uri: vscode.Uri) => {
        console.log("[Conduit] URI handler called:", {
          scheme: uri.scheme,
          authority: uri.authority,
          path: uri.path,
          query: uri.query,
          fragment: uri.fragment,
          toString: uri.toString(),
        });

        // More detailed logging for debugging
        console.log("[Conduit] Raw URI string:", uri.toString());
        console.log("[Conduit] URI query parameters:", uri.query);

        if (uri.path === "/auth-success" || uri.path === "auth-success") {
          console.log("[Conduit] Auth success path detected, parsing token...");

          // Parse query parameters more robustly
          const params = new URLSearchParams(uri.query);
          const token = params.get("token");

          console.log(
            "[Conduit] Query params object:",
            Object.fromEntries(params.entries()),
          );
          console.log(
            "[Conduit] Extracted token:",
            token ? `Token present (${token.length} chars)` : "Missing",
          );

          if (token) {
            try {
              console.log("[Conduit] Starting authentication process...");
              await apiService.authenticate(token);

              console.log(
                "[Conduit] Authentication completed, fetching user info...",
              );
              const user = await apiService.getCurrentUser();
              console.log(
                "[Conduit] Authentication successful for user:",
                user.username || user.displayName,
              );

              vscode.window.showInformationMessage(
                `Successfully logged in as ${user.displayName || user.username}!`,
              );

              // Also show success in console
              console.log("[Conduit] Login process completed successfully");
            } catch (error: any) {
              console.error("[Conduit] Authentication error:", error);
              console.error("[Conduit] Error stack:", error.stack);

              vscode.window.showErrorMessage(
                `Login failed: ${error?.message || error}`,
              );
            }
          } else {
            console.warn("[Conduit] No token found in URI query");
            console.warn(
              "[Conduit] Available query params:",
              Object.keys(Object.fromEntries(params.entries())),
            );

            vscode.window.showErrorMessage(
              "Login failed: No authentication token received",
            );
          }
        } else {
          console.log(
            "[Conduit] URI does not match auth-success path:",
            uri.path,
          );
          console.log(
            "[Conduit] Expected paths: '/auth-success' or 'auth-success'",
          );
        }
      },
    });
    context.subscriptions.push(uriHandler);
    console.log("[Conduit] URI handler registered successfully");

    // Register commands
    const commands = [
      // Open Conduit panel
      vscode.commands.registerCommand("conduit.openPanel", () => {
        currentPanel = ConduitPanel.createOrShow(context.extensionUri, context);
        refreshRoutes();
      }),

      // Refresh routes
      vscode.commands.registerCommand("conduit.refreshRoutes", () => {
        refreshRoutes();
      }),

      // Legacy scan routes command (keep for backward compatibility)
      vscode.commands.registerCommand("conduit.scanRoutes", () => {
        vscode.commands.executeCommand("conduit.openPanel");
      }),

      // Configure API Key (now shows that it's pre-configured)
      vscode.commands.registerCommand("conduit.configureApiKey", async () => {
        const predictor = new PayloadPredictor(context);
        await predictor.configureApiKey();
      }),

      // Test MongoDB Connection
      vscode.commands.registerCommand(
        "conduit.testMongoConnection",
        async () => {
          try {
            vscode.window.withProgress(
              {
                location: vscode.ProgressLocation.Notification,
                title: "Testing MongoDB connection...",
                cancellable: false,
              },
              async () => {
                const mongoConnector = getMongoConnector();
                const isConnected = await mongoConnector.testConnection();

                if (isConnected) {
                  vscode.window.showInformationMessage(
                    "✅ MongoDB connection successful!",
                  );
                } else {
                  vscode.window.showWarningMessage(
                    "⚠️ MongoDB connection failed. Please check your connection settings.",
                  );
                }
              },
            );
          } catch (error) {
            vscode.window.showErrorMessage(
              `❌ MongoDB connection test failed: ${error}`,
            );
          }
        },
      ),

      // Configure MongoDB
      vscode.commands.registerCommand("conduit.configureMongoDB", async () => {
        await vscode.commands.executeCommand(
          "workbench.action.openSettings",
          "conduit.mongo",
        );
      }),

      // View Collection Schema
      vscode.commands.registerCommand(
        "conduit.viewCollectionSchema",
        async () => {
          try {
            const mongoConnector = getMongoConnector();

            if (!mongoConnector.isAvailable()) {
              const response = await vscode.window.showWarningMessage(
                "MongoDB is not connected. Would you like to configure the connection?",
                "Configure MongoDB",
                "Test Connection",
              );

              if (response === "Configure MongoDB") {
                await vscode.commands.executeCommand(
                  "conduit.configureMongoDB",
                );
              } else if (response === "Test Connection") {
                await vscode.commands.executeCommand(
                  "conduit.testMongoConnection",
                );
              }
              return;
            }

            // Get list of collections
            const collections = await mongoConnector.listCollections();

            if (collections.length === 0) {
              vscode.window.showInformationMessage(
                "No collections found in the database.",
              );
              return;
            }

            // Show collection picker
            const selectedCollection = await vscode.window.showQuickPick(
              collections,
              {
                placeHolder: "Select a collection to view its schema",
              },
            );

            if (selectedCollection) {
              vscode.window.withProgress(
                {
                  location: vscode.ProgressLocation.Notification,
                  title: `Analyzing schema for ${selectedCollection}...`,
                  cancellable: false,
                },
                async () => {
                  const schemas = await getAllSchemas({ sampleSize: 50 });
                  const schema = schemas.get(selectedCollection);

                  if (schema) {
                    // Create a new document to show the schema
                    const doc = await vscode.workspace.openTextDocument({
                      content: JSON.stringify(schema, null, 2),
                      language: "json",
                    });

                    await vscode.window.showTextDocument(doc);
                  } else {
                    vscode.window.showErrorMessage(
                      `Could not analyze schema for collection: ${selectedCollection}`,
                    );
                  }
                },
              );
            }
          } catch (error) {
            vscode.window.showErrorMessage(
              `Error viewing collection schema: ${error}`,
            );
          }
        },
      ),

      // Authentication commands
      vscode.commands.registerCommand("conduit.login", async () => {
        console.log("[Conduit] Login command triggered");
        try {
          // Check if already authenticated
          if (await apiService.isAuthenticated()) {
            const response = await vscode.window.showWarningMessage(
              "You are already logged in. Do you want to log in with a different account?",
              "Re-login",
              "Cancel",
            );
            if (response !== "Re-login") {
              return;
            }
          }

          // First try VS Code's built-in authentication
          try {
            console.log("[Conduit] Attempting VS Code authentication...");
            await apiService.authenticateWithVscode();

            const user = await apiService.getCurrentUser();
            vscode.window.showInformationMessage(
              `Successfully logged in as ${user.displayName || user.username}!`,
            );
            return;
          } catch (vscodeAuthError) {
            console.log(
              "[Conduit] VS Code auth failed, falling back to browser flow:",
              vscodeAuthError,
            );
          }

          // Fallback to browser-based flow
          const authUrl = apiService.getAuthUrl();
          console.log("[Conduit] Auth URL:", authUrl);
          const loginUri = vscode.Uri.parse(authUrl);
          console.log("[Conduit] Opening browser...");
          await vscode.env.openExternal(loginUri);
          console.log("[Conduit] Browser opened successfully");

          // Show instruction message with better guidance
          vscode.window
            .showInformationMessage(
              "Please complete the GitHub OAuth flow in your browser. After authorizing the application, return to VS Code and check your authentication status.",
              "Check Status",
              "Try VS Code Auth",
            )
            .then((selection) => {
              if (selection === "Check Status") {
                vscode.commands.executeCommand("conduit.checkAuthStatus");
              } else if (selection === "Try VS Code Auth") {
                // Retry VS Code authentication
                apiService
                  .authenticateWithVscode()
                  .then(async () => {
                    const user = await apiService.getCurrentUser();
                    vscode.window.showInformationMessage(
                      `Successfully logged in as ${user.displayName || user.username}!`,
                    );
                  })
                  .catch((err) => {
                    vscode.window.showErrorMessage(
                      `VS Code authentication failed: ${err.message}`,
                    );
                  });
              }
            });
        } catch (error) {
          console.error("[Conduit] Login error:", error);
          vscode.window.showErrorMessage(`Login failed: ${error}`);
        }
      }),

      vscode.commands.registerCommand("conduit.logout", async () => {
        await apiService.logout();
        vscode.window.showInformationMessage(
          "Successfully logged out of Conduit",
        );
      }),

      vscode.commands.registerCommand("conduit.checkAuthStatus", async () => {
        console.log("[Conduit] Checking authentication status...");
        if (await apiService.isAuthenticated()) {
          try {
            const user = await apiService.getCurrentUser();
            vscode.window.showInformationMessage(
              `Logged in as ${user.displayName || user.username}`,
            );
          } catch (error) {
            console.error("[Conduit] Error fetching user info:", error);
            vscode.window.showWarningMessage(
              "Authentication expired. Please log in again.",
            );
          }
        } else {
          const choice = await vscode.window.showWarningMessage(
            "Not authenticated. Would you like to log in?",
            "Login with VS Code Auth",
            "Login with Browser",
            "Manual Token Entry",
          );

          if (choice === "Login with VS Code Auth") {
            vscode.commands.executeCommand("conduit.login");
          } else if (choice === "Login with Browser") {
            const authUrl = apiService.getAuthUrl();
            await vscode.env.openExternal(vscode.Uri.parse(authUrl));
            vscode.window.showInformationMessage(
              "Complete the login in your browser, then check status again.",
            );
          } else if (choice === "Manual Token Entry") {
            vscode.commands.executeCommand("conduit.manualTokenEntry");
          }
        }
      }),

      // Manual token entry as fallback
      vscode.commands.registerCommand("conduit.manualTokenEntry", async () => {
        const token = await vscode.window.showInputBox({
          prompt: "Enter your Conduit authentication token (JWT)",
          placeHolder: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
          password: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return "Token cannot be empty";
            }
            if (!value.includes(".")) {
              return "Please enter a valid JWT token";
            }
            return null;
          },
        });

        if (token) {
          try {
            await apiService.authenticate(token);
            const user = await apiService.getCurrentUser();
            vscode.window.showInformationMessage(
              `Successfully authenticated as ${user.displayName || user.username}!`,
            );
          } catch (error: any) {
            vscode.window.showErrorMessage(
              `Authentication failed: ${error.message || error}`,
            );
          }
        }
      }),

      // Test URI handler command (for debugging)
      vscode.commands.registerCommand("conduit.testUriHandler", async () => {
        const testUri = vscode.Uri.parse(
          "vscode://conduit/auth-success?token=test123",
        );
        console.log("[Conduit] Testing URI handler with:", testUri.toString());
        vscode.window.showInformationMessage(
          `Testing URI handler: ${testUri.toString()}`,
        );
        // The URI handler should be called automatically by VS Code
      }),

      // Manual URI test command
      vscode.commands.registerCommand("conduit.testManualUri", async () => {
        console.log("[Conduit] Manually triggering URI handler...");
        const testToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test";
        console.log("[Conduit] Test token:", testToken);

        // Test authentication directly
        try {
          await apiService.authenticate(testToken);
          vscode.window.showInformationMessage(
            "Manual URI test: Authentication successful!",
          );
        } catch (error: any) {
          vscode.window.showErrorMessage(
            `Manual URI test failed: ${error.message}`,
          );
        }
      }),
      // Debug auth storage command
      vscode.commands.registerCommand("conduit.debugAuthStorage", async () => {
        try {
          console.log("[Conduit] Debugging authentication storage...");

          // Force reload token
          const isAuth = await apiService.isAuthenticated();
          console.log("[Conduit] Is authenticated:", isAuth);

          // Check secrets directly
          const storedToken = await context.secrets.get("conduit.auth.token");
          console.log(
            "[Conduit] Token in secrets:",
            storedToken ? "Present" : "Missing",
          );

          vscode.window.showInformationMessage(
            `Auth Debug: Authenticated=${isAuth}, Token in secrets=${storedToken ? "Yes" : "No"}`,
          );
        } catch (error) {
          console.error("[Conduit] Debug error:", error);
          vscode.window.showErrorMessage(`Debug failed: ${error}`);
        }
      }),
      // Snapshot commands
      vscode.commands.registerCommand("conduit.forceSnapshot", async () => {
        await snapshotService.forceSnapshotCurrentFile();
      }),

      vscode.commands.registerCommand("conduit.viewHistory", async () => {
        // This will be implemented when we create the HistoryPanel
        vscode.window.showInformationMessage("History panel coming soon!");
      }),

      vscode.commands.registerCommand(
        "conduit.toggleAutoSnapshot",
        async () => {
          const config = vscode.workspace.getConfiguration("conduit.snapshot");
          const currentValue = config.get("enabled", true);
          await config.update("enabled", !currentValue, true);

          vscode.window.showInformationMessage(
            `Auto-snapshot ${!currentValue ? "enabled" : "disabled"}`,
          );
        },
      ),
    ];

    context.subscriptions.push(...commands);

    // Auto-detect routes on workspace change
    const watcher = vscode.workspace.createFileSystemWatcher("**/*.{js,ts}");
    watcher.onDidChange(() => debounceRefresh());
    watcher.onDidCreate(() => debounceRefresh());
    watcher.onDidDelete(() => debounceRefresh());
    context.subscriptions.push(watcher);

    // Show welcome message
    vscode.window
      .showInformationMessage(
        'Conduit is ready! Use "Conduit: Open Panel" to start exploring your API routes.',
        "Open Panel",
      )
      .then((selection) => {
        if (selection === "Open Panel") {
          vscode.commands.executeCommand("conduit.openPanel");
        }
      });

    console.log("[Conduit] Extension activation completed successfully");
    vscode.window.showInformationMessage(
      "Conduit extension activated successfully!",
    );
  } catch (error) {
    console.error("[Conduit] Extension activation failed:", error);
    vscode.window.showErrorMessage(
      `Conduit extension failed to activate: ${error}`,
    );
    throw error;
  }
}

let refreshTimeout: NodeJS.Timeout;
function debounceRefresh() {
  clearTimeout(refreshTimeout);
  refreshTimeout = setTimeout(() => {
    refreshRoutes();
  }, 500);
}

async function refreshRoutes() {
  if (!routeDetector || !currentPanel) {
    return;
  }

  try {
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Conduit: Detecting routes...",
        cancellable: false,
      },
      async () => {
        const routes = await routeDetector.detectRoutes();
        currentPanel?.updateRoutes(routes);

        if (routes.length > 0) {
          console.log(`Conduit detected ${routes.length} routes`);
        }
      },
    );
  } catch (error) {
    vscode.window.showErrorMessage(`Conduit: Error detecting routes: ${error}`);
  }
}

export function deactivate() {
  currentPanel?.dispose();

  // Cleanup snapshot service
  snapshotService?.dispose();

  // Cleanup MongoDB connection
  cleanupMongoDB().catch((error) => {
    console.warn("Error during MongoDB cleanup:", error);
  });
}
