import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { RouteDetector, DetectedRoute } from "../routeDetection";
import { PayloadPredictor } from "../ai/payloadPredictor";
import { ConduitApiService, RouteSnapshot } from "./apiService";

export interface SnapshotConfig {
  enabled: boolean;
  debounceMs: number;
  maxSize: number;
  excludePatterns: string[];
}

export class SnapshotService {
  private context: vscode.ExtensionContext;
  private apiService: ConduitApiService;
  private routeDetector: RouteDetector;
  private payloadPredictor: PayloadPredictor;
  private snapshotTimeouts = new Map<string, NodeJS.Timeout>();
  private lastSnapshots = new Map<string, string>(); // routeId -> codeHash

  constructor(
    context: vscode.ExtensionContext,
    apiService: ConduitApiService,
    routeDetector: RouteDetector,
  ) {
    this.context = context;
    this.apiService = apiService;
    this.routeDetector = routeDetector;
    this.payloadPredictor = new PayloadPredictor(context);

    this.setupFileWatcher();
  }

  public getConfig(): SnapshotConfig {
    const config = vscode.workspace.getConfiguration("conduit.snapshot");
    return {
      enabled: config.get("enabled", true),
      debounceMs: config.get("debounceMs", 2000),
      maxSize: config.get("maxSize", 1024 * 1024), // 1MB
      excludePatterns: config.get("excludePatterns", [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
      ]),
    };
  }

  private setupFileWatcher(): void {
    // Watch for file changes
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.{js,ts,jsx,tsx,py,go,java,php,rb,cs,cpp,c,h,hpp}",
      false, // ignoreCreateEvents
      false, // ignoreChangeEvents
      true, // ignoreDeleteEvents
    );

    watcher.onDidChange((uri) => {
      this.handleFileChange(uri);
    });

    watcher.onDidCreate((uri) => {
      this.handleFileChange(uri);
    });

    this.context.subscriptions.push(watcher);

    // Also watch for active editor changes to create snapshots
    vscode.window.onDidChangeActiveTextEditor(
      (editor) => {
        if (editor && editor.document.languageId !== "plaintext") {
          this.handleActiveEditorChange(editor.document);
        }
      },
      null,
      this.context.subscriptions,
    );

    // Watch for document saves
    vscode.workspace.onDidSaveTextDocument(
      (document) => {
        this.handleDocumentSave(document);
      },
      null,
      this.context.subscriptions,
    );
  }

  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    if (!this.shouldProcessFile(uri)) {
      return;
    }

    const config = this.getConfig();
    if (!config.enabled || !this.apiService.isAuthenticated()) {
      return;
    }

    const filePath = uri.fsPath;

    // Debounce multiple changes to the same file
    const existingTimeout = this.snapshotTimeouts.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.createSnapshotsForFile(uri);
      this.snapshotTimeouts.delete(filePath);
    }, config.debounceMs);

    this.snapshotTimeouts.set(filePath, timeout);
  }

  private async handleActiveEditorChange(
    document: vscode.TextDocument,
  ): Promise<void> {
    // Create snapshots for the currently active file (without debounce)
    if (
      this.shouldProcessFile(document.uri) &&
      (await this.apiService.isAuthenticated())
    ) {
      await this.createSnapshotsForFile(document.uri);
    }
  }

  private async handleDocumentSave(
    document: vscode.TextDocument,
  ): Promise<void> {
    // Immediate snapshot on save (priority)
    if (
      this.shouldProcessFile(document.uri) &&
      (await this.apiService.isAuthenticated())
    ) {
      await this.createSnapshotsForFile(document.uri, true);
    }
  }

  private shouldProcessFile(uri: vscode.Uri): boolean {
    const config = this.getConfig();
    const filePath = uri.fsPath;

    // Check file size
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > config.maxSize) {
        return false;
      }
    } catch (error) {
      return false;
    }

    // Check exclude patterns
    const relativePath = vscode.workspace.asRelativePath(uri);
    for (const pattern of config.excludePatterns) {
      // Simple glob pattern matching
      const regex = new RegExp(
        pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"),
      );
      if (regex.test(relativePath)) {
        return false;
      }
    }

    return true;
  }

  private async createSnapshotsForFile(
    uri: vscode.Uri,
    force: boolean = false,
  ): Promise<void> {
    try {
      const filePath = uri.fsPath;
      const fileContent = fs.readFileSync(filePath, "utf8");

      // Detect routes in the file
      const routes = await this.routeDetector.detectRoutesInFile(filePath);

      if (routes.length === 0) {
        return;
      }

      console.log(
        `Creating snapshots for ${routes.length} routes in ${path.basename(filePath)}`,
      );

      // Create snapshots for each route
      const promises = routes.map((route) =>
        this.createSnapshotForRoute(route, fileContent, force),
      );
      await Promise.allSettled(promises);
    } catch (error) {
      console.error("Error creating snapshots for file:", error);
    }
  }

  private async createSnapshotForRoute(
    route: DetectedRoute,
    fileContent: string,
    force: boolean = false,
  ): Promise<void> {
    try {
      const routeId = this.apiService.generateRouteId(
        route.method,
        route.path,
        route.filePath,
      );
      const codeHash = createHash("md5").update(fileContent).digest("hex");

      // Check if we already have this exact snapshot (unless forced)
      if (!force && this.lastSnapshots.get(routeId) === codeHash) {
        return;
      }

      // Get predicted payload
      let predictedPayload;
      try {
        predictedPayload = await this.payloadPredictor.predict(route);
      } catch (error: any) {
        console.warn("Failed to predict payload for route:", route.path, error);
      }

      // Get file metadata
      const stats = fs.statSync(route.filePath);
      const metadata = {
        fileSize: stats.size,
        totalRoutes: 1, // Will be updated on backend
        framework: this.detectFramework(route.filePath, fileContent),
      };

      // Create snapshot data
      const snapshotData: Partial<RouteSnapshot> = {
        routeId,
        routePath: route.path,
        method: route.method,
        filePath: route.filePath,
        lineNumber: route.line,
        code: fileContent,
        codeHash,
        predictedPayload,
        metadata,
      };

      // Send to backend
      const result = await this.apiService.createSnapshot(snapshotData);

      // Update local cache
      this.lastSnapshots.set(routeId, codeHash);

      console.log(
        `Snapshot created for ${route.method} ${route.path}:`,
        result._id,
      );
    } catch (error: any) {
      // Don't spam errors for auth issues
      if (error.message !== "Authentication required") {
        console.error("Error creating snapshot for route:", route.path, error);
      }
    }
  }

  private detectFramework(filePath: string, content: string): string {
    const ext = path.extname(filePath);

    // Check for specific frameworks based on imports/requires
    if (ext === ".js" || ext === ".ts") {
      if (
        content.includes("express") ||
        content.includes("app.get") ||
        content.includes("app.post")
      ) {
        return "express";
      }
      if (content.includes("fastify")) {
        return "fastify";
      }
      if (content.includes("koa")) {
        return "koa";
      }
      if (content.includes("next") || content.includes("Next")) {
        return "next.js";
      }
      return "node.js";
    }

    if (ext === ".py") {
      if (content.includes("flask") || content.includes("Flask")) {
        return "flask";
      }
      if (content.includes("django") || content.includes("Django")) {
        return "django";
      }
      if (content.includes("fastapi") || content.includes("FastAPI")) {
        return "fastapi";
      }
      return "python";
    }

    if (ext === ".go") {
      return "go";
    }

    return "unknown";
  }

  public async forceSnapshotCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !this.apiService.isAuthenticated()) {
      vscode.window.showWarningMessage(
        "Please open a file and ensure you are authenticated",
      );
      return;
    }

    await this.createSnapshotsForFile(editor.document.uri, true);
    vscode.window.showInformationMessage("Snapshot created for current file");
  }

  public async getLastSnapshots(): Promise<Map<string, string>> {
    return new Map(this.lastSnapshots);
  }

  public dispose(): void {
    // Clear any pending timeouts
    this.snapshotTimeouts.forEach((timeout) => clearTimeout(timeout));
    this.snapshotTimeouts.clear();
  }
}
