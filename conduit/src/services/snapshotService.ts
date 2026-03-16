import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { RouteDetector, DetectedRoute } from "../detection/routeDetection";
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
  // Temporary global pause switch for snapshot feature.
  private readonly snapshotsPaused = false;
  private snapshotTimeouts = new Map<string, NodeJS.Timeout>();
  private lastSnapshots = new Map<string, string>(); // routeId -> codeHash
  private lastCodeCache = new Map<string, string>(); // routeId -> last code for change detection

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
      debounceMs: config.get("debounceMs", this.getDebounceTime()),
      maxSize: config.get("maxSize", 1024 * 1024), // 1MB
      excludePatterns: config.get("excludePatterns", [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
      ]),
    };
  }

  /**
   * Get debounce time based on auto-save setting.
   * If auto-save is enabled, use a longer debounce (8 seconds)
   * If manual save, use shorter debounce (3 seconds)
   */
  private getDebounceTime(): number {
    try {
      const autoSaveConfig = vscode.workspace
        .getConfiguration("files")
        .get<string>("autoSave");

      // Auto save is enabled → use longer debounce to avoid mid-typing snapshots
      if (
        autoSaveConfig === "afterDelay" ||
        autoSaveConfig === "onFocusChange" ||
        autoSaveConfig === "onWindowChange"
      ) {
        console.log(
          "[SnapshotService] Auto-save detected -> using 8s debounce",
        );
        return 8000; // 8 seconds for auto-save
      }

      // Manual save → shorter debounce is safe (3 seconds per spec)
      console.log("[SnapshotService] Manual save mode -> using 3s debounce");
      return 3000; // 3 seconds for manual saves
    } catch (error) {
      console.warn(
        "[SnapshotService] Error detecting auto-save, using default 3s",
      );
      return 3000;
    }
  }

  /**
   * Check if the change is substantial enough to snapshot.
   * Prevents capturing incomplete intermediate states (e.g., mid-word typing).
   * Returns true if:
   * - Code length changed by 10+ characters, AND
   * - Code contains meaningful route handler patterns
   */
  private isSignificantChange(oldCode: string, newCode: string): boolean {
    // No old code → first time seeing this route → always capture
    if (!oldCode) {
      return true;
    }

    // Calculate length difference
    const lengthDiff = Math.abs(newCode.length - oldCode.length);

    // Less than 10 character difference? Probably still typing mid-word
    if (lengthDiff < 10) {
      console.log(
        "[SnapshotService] Change too small (",
        lengthDiff,
        "chars) - skipping",
      );
      return false;
    }

    // Check if code has meaningful route handler patterns
    // Look for: req.body.field, req.params.field, req.query.field
    const hasParameterAccess =
      /req\.(body|params|query)\[\w+\]|req\.(body|params|query)\.\w+/.test(
        newCode,
      );

    // Check for basic route structure
    const hasRouteStructure =
      /app\.(get|post|put|delete|patch)|router\.(get|post|put|delete|patch)|@(Get|Post|Put|Delete|Patch)/.test(
        newCode,
      );

    // If it's too short and lacks parameter access, probably incomplete
    if (newCode.length < 100 && !hasParameterAccess) {
      console.log(
        "[SnapshotService] Code too short without parameter access - skipping",
      );
      return false;
    }

    console.log("[SnapshotService] Change is significant - will snapshot");
    return true;
  }

  private setupFileWatcher(): void {
    // DISABLED: Auto-snapshot on file changes
    // Users now explicitly create checkpoints instead of automatic snapshots
    // This provides better control and reduces noise in the history
    console.log(
      "[SnapshotService] Auto-snapshot disabled - users create checkpoints manually",
    );

    // Keep comment parser for @checkpoint comment detection
    // This allows power users to trigger checkpoints via code comments
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.{js,ts,jsx,tsx,py,go,java,php,rb,cs,cpp,c,h,hpp}",
      false, // ignoreCreateEvents
      false, // ignoreChangeEvents
      true, // ignoreDeleteEvents
    );

    // Monitor file saves for @checkpoint comments
    watcher.onDidChange((uri) => {
      console.log(
        "[SnapshotService] File change detected (checking for @checkpoint):",
        uri.fsPath,
      );
      this.checkForCheckpointComments(uri);
    });

    this.context.subscriptions.push(watcher);
    console.log(
      "[SnapshotService] File watcher setup (checkpoint comments only)",
    );
  }

  private async handleFileChange(uri: vscode.Uri): Promise<void> {
    console.log("[SnapshotService] handleFileChange called for:", uri.fsPath);

    if (this.snapshotsPaused) {
      console.log("[SnapshotService] Snapshots paused, skipping");
      return;
    }

    if (!this.shouldProcessFile(uri)) {
      console.log("[SnapshotService] File should not be processed, skipping");
      return;
    }

    const config = this.getConfig();
    console.log("[SnapshotService] Config:", { enabled: config.enabled });

    if (!config.enabled || !(await this.apiService.isAuthenticated())) {
      console.log("[SnapshotService] Feature disabled or not authenticated");
      return;
    }

    const filePath = uri.fsPath;

    // Debounce multiple changes to the same file
    const existingTimeout = this.snapshotTimeouts.get(filePath);
    if (existingTimeout) {
      console.log("[SnapshotService] Clearing existing timeout for:", filePath);
      clearTimeout(existingTimeout);
    }

    console.log("[SnapshotService] Setting debounce timeout for:", filePath);
    const timeout = setTimeout(() => {
      console.log("[SnapshotService] Debounce timeout fired for:", filePath);
      this.createSnapshotsForFile(uri);
      this.snapshotTimeouts.delete(filePath);
    }, config.debounceMs);

    this.snapshotTimeouts.set(filePath, timeout);
  }

  private async handleActiveEditorChange(
    document: vscode.TextDocument,
  ): Promise<void> {
    console.log(
      "[SnapshotService] handleActiveEditorChange called for:",
      document.fileName,
    );

    if (this.snapshotsPaused) {
      console.log("[SnapshotService] Snapshots paused");
      return;
    }

    const config = this.getConfig();
    if (!config.enabled) {
      console.log("[SnapshotService] Feature disabled");
      return;
    }

    // Create snapshots for the currently active file (without debounce)
    if (
      this.shouldProcessFile(document.uri) &&
      (await this.apiService.isAuthenticated())
    ) {
      console.log("[SnapshotService] Creating snapshots for active editor");
      await this.createSnapshotsForFile(document.uri);
    } else {
      console.log("[SnapshotService] File not eligible for processing");
    }
  }

  private async handleDocumentSave(
    document: vscode.TextDocument,
  ): Promise<void> {
    console.log(
      "[SnapshotService] handleDocumentSave called for:",
      document.fileName,
    );

    if (this.snapshotsPaused) {
      console.log("[SnapshotService] Snapshots paused");
      return;
    }

    const config = this.getConfig();
    if (!config.enabled) {
      console.log("[SnapshotService] Feature disabled");
      return;
    }

    // Snapshot on manual save - still apply all gates (no force=true)
    if (
      this.shouldProcessFile(document.uri) &&
      (await this.apiService.isAuthenticated())
    ) {
      console.log("[SnapshotService] Creating snapshots on manual save");
      await this.createSnapshotsForFile(document.uri);
    } else {
      console.log("[SnapshotService] File not eligible for processing");
    }
  }

  private shouldProcessFile(uri: vscode.Uri): boolean {
    const config = this.getConfig();
    const filePath = uri.fsPath;

    // Check file size
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > config.maxSize) {
        console.log(
          "[SnapshotService] File too large:",
          filePath,
          stats.size,
          "bytes",
        );
        return false;
      }
    } catch (error) {
      console.log(
        "[SnapshotService] Could not check file size:",
        filePath,
        error,
      );
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
        console.log(
          "[SnapshotService] File excluded by pattern:",
          pattern,
          relativePath,
        );
        return false;
      }
    }

    console.log("[SnapshotService] File should be processed:", relativePath);
    return true;
  }

  private async createSnapshotsForFile(
    uri: vscode.Uri,
    force: boolean = false,
  ): Promise<void> {
    if (this.snapshotsPaused) {
      return;
    }

    try {
      const filePath = uri.fsPath;
      const fileContent = fs.readFileSync(filePath, "utf8");

      // Detect routes in the file
      const routes = await this.routeDetector.detectRoutesInFile(filePath);

      console.log(
        "[SnapshotService] Routes detected in file:",
        filePath,
        routes.length,
      );

      if (routes.length === 0) {
        console.log("[SnapshotService] No routes found in file, skipping");
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

      console.log("[SnapshotService] Generating snapshot for route:", {
        method: route.method,
        path: route.path,
        filePath: route.filePath,
        routeId,
        codeHash: codeHash.substring(0, 8),
      });

      console.log(`[SnapshotService] GATE 1: User logged in - PASSED ✅`);

      // GATE 2: Debounce check is implicit (this method only runs after debounce fires)
      console.log(
        `[SnapshotService] GATE 2: Debounce settled (force=${force}) - PASSED ✅`,
      );

      // GATE 4: Exact hash match (code unchanged from last snapshot)
      if (!force && this.lastSnapshots.get(routeId) === codeHash) {
        console.log(
          `[SnapshotService] GATE 4: Hash matches last snapshot - FAILED ❌ (skipping)`,
        );
        return;
      }
      console.log(
        `[SnapshotService] GATE 4: Hash different from last snapshot - PASSED ✅`,
      );

      // GATE 3: Is the code change meaningful? (10+ characters)
      // This prevents snapshots of incomplete mid-typing states
      const lastCode = this.lastCodeCache.get(routeId) || "";
      if (!force && !this.isSignificantChange(lastCode, fileContent)) {
        const lengthDiff = Math.abs(fileContent.length - lastCode.length);
        console.log(
          `[SnapshotService] GATE 3: Change too small (${lengthDiff} chars, need 10+) - FAILED ❌ (deferring)`,
        );
        // Still update the cache so we track the intermediate state
        this.lastCodeCache.set(routeId, fileContent);
        return;
      }
      const lengthDiff = Math.abs(fileContent.length - lastCode.length);
      console.log(
        `[SnapshotService] GATE 3: Change meaningful (${lengthDiff} chars) - PASSED ✅`,
      );

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

      console.log("[SnapshotService] Sending snapshot to backend:", {
        routeId: snapshotData.routeId,
        method: snapshotData.method,
        path: snapshotData.routePath,
        codeHashStart: codeHash.substring(0, 8),
      });

      // Send to backend
      const result = await this.apiService.createSnapshot(snapshotData);

      console.log("[SnapshotService] API response for snapshot:", {
        hasId: !!result._id,
        resultKeys: Object.keys(result),
        routeId: result.routeId,
      });

      // Update both caches after successful save
      this.lastSnapshots.set(routeId, codeHash);
      this.lastCodeCache.set(routeId, fileContent);

      console.log(
        `Snapshot created for ${route.method} ${route.path}:`,
        result._id || "no-id-returned",
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
    if (this.snapshotsPaused) {
      vscode.window.showInformationMessage(
        "Snapshot feature is temporarily paused.",
      );
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor || !(await this.apiService.isAuthenticated())) {
      vscode.window.showWarningMessage(
        "Please open a file and ensure you are authenticated",
      );
      return;
    }

    await this.createSnapshotsForFile(editor.document.uri, true);
    vscode.window.showInformationMessage("Snapshot created for current file");
  }

  /**
   * Check for @checkpoint: comments in the file
   * Format: // @checkpoint: description of what changed
   * This allows power users to create checkpoints directly from code
   */
  private async checkForCheckpointComments(uri: vscode.Uri): Promise<void> {
    if (
      !this.shouldProcessFile(uri) ||
      !(await this.apiService.isAuthenticated())
    ) {
      return;
    }

    try {
      const filePath = uri.fsPath;
      const fileContent = fs.readFileSync(filePath, "utf8");
      const lines = fileContent.split("\n");

      // Look for @checkpoint: comments
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const checkpointMatch = line.match(/\/\/\s*@checkpoint:\s*(.+)/);

        if (checkpointMatch) {
          const label = checkpointMatch[1].trim();
          console.log("[SnapshotService] @checkpoint comment found:", label);

          // Detect routes in this file
          const routes = await this.routeDetector.detectRoutesInFile(filePath);

          if (routes.length > 0) {
            // Save checkpoint for detected routes
            for (const route of routes) {
              await this.saveCheckpointForRoute(route, fileContent, label);
            }

            // Remove/comment out the @checkpoint line to prevent re-triggering
            lines[i] = line.replace(
              /\/\/\s*@checkpoint:.*$/,
              "// @checkpoint processed",
            );
            fs.writeFileSync(filePath, lines.join("\n"));
            console.log(
              "[SnapshotService] @checkpoint marker removed to prevent re-trigger",
            );
          }
        }
      }
    } catch (error) {
      console.error(
        "[SnapshotService] Error checking checkpoint comments:",
        error,
      );
    }
  }

  /**
   * Save a checkpoint via the new saveCheckpoint API endpoint
   * This creates an intentional, user-controlled snapshot
   */
  public async saveCheckpoint(
    routeId: string,
    routePath: string,
    method: string,
    code: string,
    label: string,
    lastPayload?: any,
    lastResponse?: any,
  ): Promise<boolean> {
    if (!(await this.apiService.isAuthenticated())) {
      vscode.window.showErrorMessage(
        "Checkpoint failed: Please authenticate first",
      );
      return false;
    }

    if (!label || !label.trim()) {
      vscode.window.showErrorMessage(
        "Checkpoint requires a label (like a git commit message)",
      );
      return false;
    }

    try {
      // Get the current file path for this route
      const editor = vscode.window.activeTextEditor;
      const filePath = editor?.document.fileName || "";

      const checkpointData = {
        routeId,
        routePath,
        method,
        code,
        label: label.trim(),
        lastPayload,
        lastResponse,
        filePath,
        metadata: {
          framework: this.detectFramework(filePath, code),
        },
      };

      console.log("[SnapshotService] Sending checkpoint to API:", {
        routePath,
        method,
        label: label.trim(),
      });

      const response = await this.apiService.saveCheckpoint(checkpointData);

      console.log("[SnapshotService] Checkpoint saved:", response);
      return true;
    } catch (error: any) {
      console.error("[SnapshotService] Error saving checkpoint:", error);
      vscode.window.showErrorMessage(
        `Failed to save checkpoint: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Save checkpoint for a specific route
   * Used when @checkpoint comment is detected in the code
   */
  private async saveCheckpointForRoute(
    route: DetectedRoute,
    fileContent: string,
    label: string,
  ): Promise<void> {
    try {
      const routeId = this.apiService.generateRouteId(
        route.method,
        route.path,
        route.filePath,
      );

      const routeCode = this.extractRouteCode(fileContent, route);

      const success = await this.saveCheckpoint(
        routeId,
        route.path,
        route.method,
        routeCode,
        label,
      );

      if (success) {
        vscode.window.showInformationMessage(
          `Checkpoint saved: ${label} (${route.method} ${route.path})`,
        );
      }
    } catch (error) {
      console.error(
        "[SnapshotService] Error saving checkpoint for route:",
        error,
      );
    }
  }

  /**
   * Extract just the route handler code from the file
   */
  private extractRouteCode(fileContent: string, route: DetectedRoute): string {
    // For now, return the entire file content
    // In future, could extract just the specific route handler
    return fileContent;
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
