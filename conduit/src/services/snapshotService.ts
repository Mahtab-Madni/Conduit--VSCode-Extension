import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import {
  Node,
  FunctionDeclaration,
} from "@babel/types";
import { RouteDetector, DetectedRoute } from "../detection/routeDetection";
import { PayloadPredictor } from "../ai/payloadPredictor";
import { ConduitApiService } from "./apiService";

export class SnapshotService {
  private context: vscode.ExtensionContext;
  private apiService: ConduitApiService;
  private routeDetector: RouteDetector;
  private payloadPredictor: PayloadPredictor;

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

  private setupFileWatcher(): void {
    const watcher = vscode.workspace.createFileSystemWatcher(
      "**/*.{js,ts,jsx,tsx,py,go,java,php,rb,cs,cpp,c,h,hpp}",
      false,
      false,
      true,
    );

    // Monitor file saves for @checkpoint comments only
    watcher.onDidChange((uri) => {
      this.checkForCheckpointComments(uri);
    });

    this.context.subscriptions.push(watcher);
  }

  private detectFramework(filePath: string, content: string): string {
    const ext = path.extname(filePath);

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

  private extractControllerFunctionCode(
    fileContent: string,
    targetFunction: string,
    filePath: string,
  ): string | null {
    try {
      const ast = parse(fileContent, {
        sourceType: "module",
        plugins: [
          "jsx",
          "typescript",
          "decorators-legacy",
          "classProperties",
          "objectRestSpread",
          "asyncGenerators",
          "functionBind",
          "exportDefaultFrom",
          "dynamicImport",
        ],
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
      });

      let controllerFunction: Node | null = null;
      let startLine = 0;
      let endLine = 0;

      traverse(ast, {
        FunctionDeclaration: (path: NodePath<FunctionDeclaration>) => {
          if (path.node.id?.name === targetFunction) {
            controllerFunction = path.node;
            startLine = path.node.loc?.start.line || 0;
            endLine = path.node.loc?.end.line || 0;
          }
        },
        VariableDeclarator: (path) => {
          if (
            path.node.id.type === "Identifier" &&
            path.node.id.name === targetFunction &&
            (path.node.init?.type === "ArrowFunctionExpression" ||
              path.node.init?.type === "FunctionExpression")
          ) {
            controllerFunction = path.node.init;
            startLine = path.node.loc?.start.line || 0;
            endLine = path.node.loc?.end.line || 0;
          }
        },
        AssignmentExpression: (path) => {
          if (
            path.node.left.type === "MemberExpression" &&
            path.node.left.object.type === "Identifier" &&
            (path.node.left.object.name === "exports" ||
              path.node.left.object.name === "module") &&
            path.node.left.property.type === "Identifier" &&
            path.node.left.property.name === targetFunction &&
            (path.node.right.type === "ArrowFunctionExpression" ||
              path.node.right.type === "FunctionExpression")
          ) {
            controllerFunction = path.node.right;
            startLine = path.node.loc?.start.line || 0;
            endLine = path.node.loc?.end.line || 0;
          }
        },
        ObjectMethod: (path) => {
          if (
            path.node.key.type === "Identifier" &&
            path.node.key.name === targetFunction
          ) {
            controllerFunction = path.node;
            startLine = path.node.loc?.start.line || 0;
            endLine = path.node.loc?.end.line || 0;
          }
        },
      });

      if (!controllerFunction || startLine === 0 || endLine === 0) {
        return null;
      }

      const lines = fileContent.split("\n");
      const controllerCode = lines.slice(startLine - 1, endLine).join("\n");

      return controllerCode;
    } catch (error) {
      console.warn(
        `[SnapshotService] Error extracting controller function "${targetFunction}" from ${filePath}:`,
        error,
      );
      return null;
    }
  }

  private async checkForCheckpointComments(uri: vscode.Uri): Promise<void> {
    if (!(await this.apiService.isAuthenticated())) {
      return;
    }

    try {
      const filePath = uri.fsPath;
      const fileContent = fs.readFileSync(filePath, "utf8");
      const lines = fileContent.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const checkpointMatch = line.match(/\/\/\s*@checkpoint:\s*(.+)/);

        if (checkpointMatch) {
          const label = checkpointMatch[1].trim();

          const routes = await this.routeDetector.detectRoutesInFile(filePath);

          if (routes.length > 0) {
            for (const route of routes) {
              await this.saveCheckpointForRoute(route, fileContent, label);
            }

            lines[i] = line.replace(
              /\/\/\s*@checkpoint:.*$/,
              "// @checkpoint processed",
            );
            fs.writeFileSync(filePath, lines.join("\n"));
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

  public async saveCheckpoint(
    routeId: string,
    routePath: string,
    method: string,
    code: string,
    label: string,
    lastPayload?: any,
    lastResponse?: any,
    filePath?: string,
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
      const codeFilePath =
        filePath || vscode.window.activeTextEditor?.document.fileName || "";

      const checkpointData = {
        routeId,
        routePath,
        method,
        code,
        label: label.trim(),
        lastPayload,
        lastResponse,
        filePath: codeFilePath,
        fullPath: codeFilePath,
        metadata: {
          framework: this.detectFramework(codeFilePath, code),
        },
      };

      const response = await this.apiService.saveCheckpoint(checkpointData);
      return true;
    } catch (error: any) {
      console.error("[SnapshotService] Error saving checkpoint:", error);
      vscode.window.showErrorMessage(
        `Failed to save checkpoint: ${error.message}`,
      );
      return false;
    }
  }

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

      let codeFilePath = route.filePath;
      let codeToCheckpoint = fileContent;
      let extractedFunctionCode: string | null = null;

      extractedFunctionCode = this.extractControllerFunctionCode(
        fileContent,
        route.handler,
        route.filePath,
      );

      if (extractedFunctionCode) {
        codeToCheckpoint = extractedFunctionCode;
      } else {
        if (
          route.controllerFilePath &&
          route.controllerFunction
        ) {
          try {
            const controllerFileContent = fs.readFileSync(
              route.controllerFilePath,
              "utf-8",
            );
            extractedFunctionCode = this.extractControllerFunctionCode(
              controllerFileContent,
              route.controllerFunction,
              route.controllerFilePath,
            );

            if (extractedFunctionCode) {
              codeToCheckpoint = extractedFunctionCode;
              codeFilePath = route.controllerFilePath;
            }
          } catch (error) {
            console.warn(
              "[SnapshotService] Could not read or extract from controller file for checkpoint, using route file instead:",
              error,
            );
          }
        } else {
          console.log(
            `[SnapshotService] No separate controller file detected, using entire route file content for checkpoint`,
          );
        }
      }

      const success = await this.saveCheckpoint(
        routeId,
        route.path,
        route.method,
        codeToCheckpoint,
        label,
        undefined,
        undefined,
        codeFilePath,
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

  public dispose(): void {
    // Cleanup
  }
}
