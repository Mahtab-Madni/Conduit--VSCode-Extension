import * as vscode from "vscode";
import { DetectedRoute } from "./routeDetection";
import { PayloadPredictor } from "./ai/payloadPredictor";
import { getMongoConnector, initializeMongoDB } from "./db/mongoConnector";
import {
  HybridPayloadGenerator,
  generateHybridPayload,
} from "./db/hybridPayloadGenerator";
import { SampleDataFetcher, getRealDataForRoute } from "./db/sampleDataFetcher";
import { getCollectionSchema } from "./db/schemaViewer";
import { inferCollectionName } from "./db/collectionInferencer";
import { ConduitApiService } from "./services/apiService";

export class ConduitPanel {
  public static currentPanel: ConduitPanel | undefined;
  public static readonly viewType = "conduit";

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _payloadPredictor: PayloadPredictor;
  private readonly _hybridPayloadGenerator: HybridPayloadGenerator;
  private readonly _context: vscode.ExtensionContext;
  private readonly _apiService: ConduitApiService;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
  ) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (ConduitPanel.currentPanel) {
      ConduitPanel.currentPanel._panel.reveal(column);
      return ConduitPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      ConduitPanel.viewType,
      "Conduit API Explorer",
      column || vscode.ViewColumn.One,
      {
        // Enable JavaScript in the webview
        enableScripts: true,
        // Restrict the webview to only loading content from our extension's directory.
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "webview-dist"),
          vscode.Uri.joinPath(extensionUri, "dist"),
          vscode.Uri.joinPath(extensionUri, "src"),
        ],
      },
    );

    ConduitPanel.currentPanel = new ConduitPanel(panel, extensionUri, context);
    return ConduitPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    context: vscode.ExtensionContext,
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._context = context;
    this._payloadPredictor = new PayloadPredictor(context);
    this._hybridPayloadGenerator = new HybridPayloadGenerator(context);
    this._apiService = new ConduitApiService(context);

    // Initialize MongoDB connection
    this.initializeMongoDB();

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Send initial auth status
    this.sendAuthStatus();

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "refresh":
            vscode.commands.executeCommand("conduit.refreshRoutes");
            return;
          case "sendRequest":
            this.sendHttpRequest(
              message.route,
              message.payload,
              message.headers,
            );
            return;
          case "predictPayload":
            this.predictPayload(message.route);
            return;
          case "predictErrorFix":
            this.predictErrorFix(
              message.route,
              message.errorResponse,
              message.requestPayload,
              message.statusCode,
            );
            return;
          case "fetchRealData":
            this.fetchRealDataForRoute(message.route);
            return;
          case "generateHybridPayload":
            this.generateHybridPayload(message.route, message.options);
            return;
          case "getCollectionSchema":
            this.getCollectionSchema(message.collectionName);
            return;
          case "testMongoConnection":
            this.testMongoConnection();
            return;
          case "getAvailableCollections":
            this.getAvailableCollections();
            return;
          case "useRealDataSample":
            this.useRealDataSample(message.route, message.sampleIndex);
            return;
          case "checkAuthStatus":
            this.sendAuthStatus();
            return;
          case "login":
            console.log("[Conduit] WebView login message received");
            vscode.commands.executeCommand("conduit.login");
            return;
          case "logout":
            vscode.commands.executeCommand("conduit.logout");
            return;
          case "getRouteHistory":
            this.getRouteHistory(message.routeId, message.limit);
            return;
          case "compareSnapshots":
            this.compareSnapshots(message.snapshotId1, message.snapshotId2);
            return;
        }
      },
      null,
      this._disposables,
    );
  }

  public dispose() {
    ConduitPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  public updateRoutes(routes: DetectedRoute[]) {
    // Send routes to the webview
    this._panel.webview.postMessage({
      command: "updateRoutes",
      routes: routes,
    });
  }

  private async sendHttpRequest(
    route: DetectedRoute,
    payload: any,
    headers: any,
  ) {
    try {
      const startTime = Date.now();

      // Build the full URL
      const baseUrl = route.baseUrl || "http://localhost:3000";
      const fullUrl = `${baseUrl}${route.path}`;

      // Prepare request options
      const requestOptions: any = {
        method: route.method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
      };

      // Add body for POST, PUT, PATCH requests
      if (route.method !== "GET" && route.method !== "DELETE" && payload) {
        requestOptions.body = JSON.stringify(payload);
      }

      vscode.window.showInformationMessage(
        `Sending ${route.method} request to ${fullUrl}`,
      );

      // Make the HTTP request using fetch
      const response = await fetch(fullUrl, requestOptions);
      const endTime = Date.now();

      // Parse response data
      let responseData;
      const contentType = response.headers.get("content-type");

      if (contentType && contentType.includes("application/json")) {
        try {
          responseData = await response.json();
        } catch (e) {
          responseData = await response.text();
        }
      } else {
        responseData = await response.text();
      }

      // Build headers object
      const responseHeaders: { [key: string]: string } = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Send response back to webview
      this._panel.webview.postMessage({
        command: "requestResponse",
        response: {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          headers: responseHeaders,
          startTime,
          endTime,
          responseTime: endTime - startTime,
        },
      });

      if (response.ok) {
        vscode.window.showInformationMessage(
          `✅ ${route.method} ${route.path} - ${response.status} ${response.statusText}`,
        );
      } else {
        vscode.window.showWarningMessage(
          `⚠️ ${route.method} ${route.path} - ${response.status} ${response.statusText}`,
        );
      }
    } catch (error) {
      const endTime = Date.now();

      // Send error response back to webview
      this._panel.webview.postMessage({
        command: "requestResponse",
        response: {
          status: 0,
          statusText: "Request Failed",
          data: null,
          headers: {},
          error: error instanceof Error ? error.message : String(error),
          responseTime: 0,
        },
      });

      vscode.window.showErrorMessage(
        `❌ Request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async predictPayload(route: DetectedRoute) {
    try {
      // Send loading state to webview
      this._panel.webview.postMessage({
        command: "payloadPredictionLoading",
        route: route,
      });

      // Use hybrid prediction (AI + MongoDB)
      const hybridPrediction =
        await this._hybridPayloadGenerator.generateHybridPrediction(route);

      if (hybridPrediction) {
        // Check if auth is required
        const requiresAuth =
          this._payloadPredictor.isAuthenticationRequired(route);

        // Convert hybrid prediction to format expected by webview
        const defaultHeaders = this.getDefaultHeaders(route);

        // Predict base URL
        const predictedBaseUrl =
          await this._payloadPredictor.predictBaseUrl(route);

        const convertedPrediction = {
          fields: hybridPrediction.fields.map((field) => ({
            name: field.name,
            type: field.type,
            required: field.required,
            example:
              field.realValues && field.realValues.length > 0
                ? field.realValues[0]
                : field.example,
            description: field.description,
          })),
          // Add default headers for routes that might need them
          headers: defaultHeaders,
          // Add predicted base URL
          baseUrl: predictedBaseUrl,
        };

        console.log(
          "Final prediction object:",
          JSON.stringify(convertedPrediction, null, 2),
        );

        // Send prediction back to webview (using original format for compatibility)
        this._panel.webview.postMessage({
          command: "payloadPredictionResult",
          route: route,
          prediction: convertedPrediction,
          requiresAuth: requiresAuth,
          // Add hybrid-specific metadata for potential future use
          hybridInfo: {
            hasRealData: hybridPrediction.hasMongoData,
            collectionName: hybridPrediction.collectionName,
            recommendedApproach: hybridPrediction.recommendedApproach,
            sampleDocuments: hybridPrediction.sampleDocuments,
          },
        });
      } else {
        // Fallback to AI-only prediction
        const aiPrediction = await this._payloadPredictor.predict(route);

        if (aiPrediction) {
          const requiresAuth =
            this._payloadPredictor.isAuthenticationRequired(route);

          // Add headers to AI prediction if not already present
          const defaultHeaders = this.getDefaultHeaders(route);

          // Predict base URL
          const predictedBaseUrl =
            await this._payloadPredictor.predictBaseUrl(route);

          const enhancedPrediction = {
            ...aiPrediction,
            headers: aiPrediction.headers || defaultHeaders,
            baseUrl: aiPrediction.baseUrl || predictedBaseUrl,
          };

          this._panel.webview.postMessage({
            command: "payloadPredictionResult",
            route: route,
            prediction: enhancedPrediction,
            requiresAuth: requiresAuth,
          });
        } else {
          throw new Error("Could not generate any prediction");
        }
      }
    } catch (error) {
      // Send error back to webview
      this._panel.webview.postMessage({
        command: "payloadPredictionError",
        route: route,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  private getDefaultHeaders(route: DetectedRoute) {
    const headers = [];

    // Always suggest Content-Type for POST/PUT/PATCH requests
    if (route.method !== "GET" && route.method !== "DELETE") {
      headers.push({
        name: "Content-Type",
        value: "application/json",
        description: "Specifies the media type of the request body",
        required: true,
      });
    }

    // Check if route might need authentication
    const routePath = route.path.toLowerCase();
    const needsAuth =
      [
        "auth",
        "login",
        "user",
        "profile",
        "dashboard",
        "admin",
        "create",
        "update",
        "delete",
        "post",
        "put",
        "patch",
      ].some((keyword) => routePath.includes(keyword)) ||
      route.middlewares.some(
        (middleware) =>
          middleware.toLowerCase().includes("auth") ||
          middleware.toLowerCase().includes("jwt") ||
          middleware.toLowerCase().includes("token"),
      );

    if (needsAuth) {
      headers.push({
        name: "Authorization",
        value: "Bearer your-token-here",
        description: "Bearer token for authentication",
        required: true,
      });
    }

    // Add Accept header for API requests
    headers.push({
      name: "Accept",
      value: "application/json",
      description:
        "Specifies the media types that are acceptable for the response",
      required: false,
    });

    return headers;
  }
  private async predictErrorFix(
    route: DetectedRoute,
    errorResponse: any,
    requestPayload: any,
    statusCode: number,
  ) {
    try {
      // Send loading state to webview
      this._panel.webview.postMessage({
        command: "errorSuggestionLoading",
        route: route,
      });

      const suggestion = await this._payloadPredictor.suggestErrorFix(
        route,
        errorResponse,
        requestPayload,
        statusCode,
      );

      if (suggestion) {
        // Send suggestion back to webview
        this._panel.webview.postMessage({
          command: "errorSuggestionResult",
          route: route,
          suggestion: suggestion,
        });
      } else {
        // Send error back to webview
        this._panel.webview.postMessage({
          command: "errorSuggestionError",
          route: route,
          error: "Could not generate error suggestion",
        });
      }
    } catch (error) {
      // Send error back to webview
      this._panel.webview.postMessage({
        command: "errorSuggestionError",
        route: route,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async initializeMongoDB() {
    try {
      const connected = await initializeMongoDB();
      // Notify webview about MongoDB connection status
      this._panel.webview.postMessage({
        command: "mongoConnectionStatus",
        connected: connected,
      });
    } catch (error) {
      console.warn("[ConduitPanel] MongoDB initialization warning:", error);
      this._panel.webview.postMessage({
        command: "mongoConnectionStatus",
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async fetchRealDataForRoute(route: DetectedRoute) {
    try {
      this._panel.webview.postMessage({
        command: "realDataLoading",
        route: route,
      });

      const realDataOptions = await getRealDataForRoute(route);

      this._panel.webview.postMessage({
        command: "realDataResult",
        route: route,
        realData: realDataOptions,
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: "realDataError",
        route: route,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async generateHybridPayload(route: DetectedRoute, options?: any) {
    try {
      this._panel.webview.postMessage({
        command: "hybridPayloadLoading",
        route: route,
      });

      const hybridPrediction =
        await this._hybridPayloadGenerator.generateHybridPrediction(
          route,
          options,
        );
      const finalPayload = this._hybridPayloadGenerator.generatePayload(
        hybridPrediction,
        options,
      );

      this._panel.webview.postMessage({
        command: "hybridPayloadResult",
        route: route,
        hybridPrediction: hybridPrediction,
        payload: finalPayload,
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: "hybridPayloadError",
        route: route,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async getCollectionSchema(collectionName: string) {
    try {
      this._panel.webview.postMessage({
        command: "collectionSchemaLoading",
        collectionName: collectionName,
      });

      const schema = await getCollectionSchema(collectionName);

      this._panel.webview.postMessage({
        command: "collectionSchemaResult",
        collectionName: collectionName,
        schema: schema,
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: "collectionSchemaError",
        collectionName: collectionName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async testMongoConnection() {
    try {
      const mongoConnector = getMongoConnector();
      const isConnected = await mongoConnector.testConnection();

      this._panel.webview.postMessage({
        command: "mongoConnectionTestResult",
        connected: isConnected,
      });

      if (isConnected) {
        vscode.window.showInformationMessage("MongoDB connection successful!");
      } else {
        vscode.window.showWarningMessage(
          "MongoDB connection failed. Check your connection settings.",
        );
      }
    } catch (error) {
      this._panel.webview.postMessage({
        command: "mongoConnectionTestResult",
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      });

      vscode.window.showErrorMessage(
        `MongoDB connection test failed: ${error}`,
      );
    }
  }

  private async getAvailableCollections() {
    try {
      this._panel.webview.postMessage({
        command: "availableCollectionsLoading",
      });

      const collections = await SampleDataFetcher.getAvailableCollections();

      this._panel.webview.postMessage({
        command: "availableCollectionsResult",
        collections: collections,
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: "availableCollectionsError",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async useRealDataSample(route: DetectedRoute, sampleIndex: number) {
    try {
      const realDataOptions = await getRealDataForRoute(route);

      if (
        realDataOptions.primary &&
        realDataOptions.primary.samples[sampleIndex]
      ) {
        const sample = realDataOptions.primary.samples[sampleIndex];
        const payload = SampleDataFetcher.generatePayloadFromSample(
          sample,
          route.method,
        );

        this._panel.webview.postMessage({
          command: "realDataSamplePayload",
          route: route,
          payload: payload,
          sample: sample,
        });
      } else {
        throw new Error(`Sample ${sampleIndex} not found`);
      }
    } catch (error) {
      this._panel.webview.postMessage({
        command: "realDataSampleError",
        route: route,
        sampleIndex: sampleIndex,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview() {
    const webview = this._panel.webview;

    // Get paths to the built React app
    const webviewDistPath = vscode.Uri.joinPath(
      this._extensionUri,
      "webview-dist",
    );
    const htmlPath = vscode.Uri.joinPath(webviewDistPath, "index.html");
    const jsPath = vscode.Uri.joinPath(webviewDistPath, "assets", "index.js");
    const cssPath = vscode.Uri.joinPath(webviewDistPath, "assets", "index.css");

    // Convert to webview URIs
    const jsUri = webview.asWebviewUri(jsPath);
    const cssUri = webview.asWebviewUri(cssPath);

    // Use nonce for security
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Conduit API Explorer</title>
    <link rel="stylesheet" type="text/css" href="${cssUri}">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' 'unsafe-inline'; img-src ${webview.cspSource} data: https:; font-src ${webview.cspSource};">
    <base href="${webview.asWebviewUri(webviewDistPath)}/">
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: var(--vscode-editor-background, #1e1e1e);
        color: var(--vscode-editor-foreground, #d4d4d4);
        font-family: var(--vscode-font-family);
      }
      #root {
        height: 100vh;
        width: 100vw;
      }
    </style>
</head>
<body>
    <div id="root">
      <div style="padding: 20px; text-align: center;">
        <div>Loading Conduit...</div>
      </div>
    </div>
    <script nonce="${nonce}">
      console.log('Webview loading...');
      const vscode = acquireVsCodeApi();
      console.log('VS Code API acquired:', !!vscode);
      
      // Make vscode available globally for React
      window.vscode = vscode;
      
      // Debug info
      console.log('Base URI:', document.baseURI);
      console.log('Script src:', '${jsUri}');
      console.log('CSS src:', '${cssUri}');
    </script>
    <script nonce="${nonce}" type="module" src="${jsUri}"></script>
</body>
</html>`;
  }

  private async sendAuthStatus() {
    try {
      const isAuthenticated = await this._apiService.isAuthenticated();
      let user = null;

      if (isAuthenticated) {
        try {
          user = await this._apiService.getCurrentUser();
        } catch (error) {
          // Token might be expired, treat as not authenticated
          console.warn(
            "Failed to get user info, treating as not authenticated:",
            error,
          );
        }
      }

      this._panel.webview.postMessage({
        command: "authStatusUpdate",
        isAuthenticated: isAuthenticated && !!user,
        user: user,
      });
    } catch (error) {
      console.error("Error sending auth status:", error);
    }
  }

  private async getRouteHistory(routeId: string, limit: number = 20) {
    try {
      if (!this._apiService.isAuthenticated()) {
        this._panel.webview.postMessage({
          type: "routeHistoryResponse",
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const snapshots = await this._apiService.getRouteHistory(routeId, limit);

      this._panel.webview.postMessage({
        type: "routeHistoryResponse",
        success: true,
        data: snapshots,
      });
    } catch (error) {
      console.error("Error fetching route history:", error);
      this._panel.webview.postMessage({
        type: "routeHistoryResponse",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async compareSnapshots(snapshotId1: string, snapshotId2: string) {
    try {
      if (!this._apiService.isAuthenticated()) {
        this._panel.webview.postMessage({
          command: "snapshotDiffResponse",
          success: false,
          error: "Authentication required",
        });
        return;
      }

      const diff = await this._apiService.compareSnapshots(
        snapshotId1,
        snapshotId2,
      );

      this._panel.webview.postMessage({
        command: "snapshotDiffResponse",
        success: true,
        data: diff,
      });
    } catch (error) {
      console.error("Error comparing snapshots:", error);
      this._panel.webview.postMessage({
        command: "snapshotDiffResponse",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
