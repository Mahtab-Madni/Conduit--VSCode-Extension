import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import {
  Node,
  CallExpression,
  MemberExpression,
  Identifier,
  StringLiteral,
  ImportDeclaration,
  VariableDeclarator,
} from "@babel/types";

export interface DetectedRoute {
  id: string;
  method: string;
  path: string;
  filePath: string;
  line: number;
  middlewares: string[];
  handler: string;
  prefix?: string;
  baseUrl?: string;
  controllerFilePath?: string;
  controllerFunction?: string;
}

export class RouteDetector {
  private routes: DetectedRoute[] = [];
  private routerPrefixes: Map<string, string> = new Map();
  private controllerImports: Map<string, string> = new Map();
  private functionImports: Map<string, string> = new Map();
  private routerExports: Map<string, string> = new Map(); // router variable name -> file path
  private filePrefixes: Map<string, string> = new Map(); // source file path -> mount prefix

  constructor(private workspaceRoot: string) {}

  async detectRoutes(): Promise<DetectedRoute[]> {
    this.routes = [];
    this.routerPrefixes.clear();
    this.controllerImports.clear();
    this.functionImports.clear();
    this.routerExports.clear();
    this.filePrefixes.clear();

    // Find all JavaScript/TypeScript files that might contain routes
    const files = await this.findRouteFiles();

    // First pass: detect router exports from all files
    console.log("[RouteDetector] Pass 1: Detecting router exports...");
    for (const file of files) {
      await this.detectRouterExports(file);
    }

    // Second pass: detect app.use() calls in main files and extract prefixes
    // This MUST happen before parsing routes so prefixes are available
    console.log("[RouteDetector] Pass 2: Detecting app prefixes...");
    for (const file of files) {
      if (
        file.endsWith("index.js") ||
        file.endsWith("app.js") ||
        file.endsWith("server.js")
      ) {
        await this.detectAppPrefixes(file);
      }
    }

    // Third pass: detect route definitions (now with prefixes available)
    console.log("[RouteDetector] Pass 3: Parsing route definitions...");
    for (const file of files) {
      await this.parseFileForRoutes(file);
    }

    // Log the detected mappings
    console.log("\n[RouteDetector] Route Detection Summary:");
    console.log("[RouteDetector] ─────────────────────────");
    console.log("[RouteDetector] Router Exports:");
    this.routerExports.forEach((filePath, routerName) => {
      console.log(`  ${routerName} -> ${filePath}`);
    });
    console.log("[RouteDetector] File Prefixes:");
    this.filePrefixes.forEach((prefix, filePath) => {
      console.log(`  ${filePath} -> ${prefix}`);
    });
    console.log(`[RouteDetector] Total Routes Found: ${this.routes.length}`);
    console.log("[RouteDetector] ─────────────────────────\n");

    return this.routes;
  }

  private async findRouteFiles(): Promise<string[]> {
    const files: string[] = [];

    // Common patterns for route files
    const patterns = [
      "**/app.js",
      "**/server.js",
      "**/index.js",
      "**/routes/**/*.js",
      "**/router/**/*.js",
      "**/controllers/**/*.js",
      "**/*router*.js",
      "**/*route*.js",
    ];

    for (const pattern of patterns) {
      try {
        const foundFiles = await vscode.workspace.findFiles(
          pattern,
          "**/node_modules/**",
        );
        files.push(...foundFiles.map((f) => f.fsPath));
      } catch (error) {
        console.warn(`Error searching for pattern ${pattern}:`, error);
      }
    }

    return [...new Set(files)];
  }

  private async detectRouterExports(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const ast = parse(content, {
        sourceType: "module",
        plugins: [
          "jsx",
          "typescript",
          "decorators-legacy",
          "classProperties",
          "objectRestSpread",
        ],
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
      });

      // Look for module.exports = router or export default router patterns
      traverse(ast, {
        ExportDefaultDeclaration: (path) => {
          if (path.node.declaration.type === "Identifier") {
            const routerName = (path.node.declaration as any).name;
            if (
              routerName.toLowerCase().includes("router") ||
              routerName.toLowerCase().includes("route")
            ) {
              console.log(
                `[RouteDetector] Found export default ${routerName} in ${filePath}`,
              );
              this.routerExports.set(routerName, filePath);
            }
          }
        },
        AssignmentExpression: (path) => {
          if (
            path.node.left.type === "MemberExpression" &&
            (path.node.left as any).property.name === "exports" &&
            path.node.right.type === "Identifier"
          ) {
            const routerName = (path.node.right as any).name;
            if (
              routerName.toLowerCase().includes("router") ||
              routerName.toLowerCase().includes("route")
            ) {
              console.log(
                `[RouteDetector] Found module.exports = ${routerName} in ${filePath}`,
              );
              this.routerExports.set(routerName, filePath);
            }
          }
        },
        VariableDeclarator: (path) => {
          if (path.node.id.type === "Identifier") {
            const varName = (path.node.id as any).name;
            if (
              varName.toLowerCase().includes("router") ||
              varName.toLowerCase().includes("route")
            ) {
              if (!this.routerExports.has(varName)) {
                console.log(
                  `[RouteDetector] Found router variable ${varName} in ${filePath}`,
                );
                this.routerExports.set(varName, filePath);
              }
            }
          }
        },
      });
    } catch (error) {
      console.warn(`Error detecting router exports in ${filePath}:`, error);
    }
  }

  private async detectAppPrefixes(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const ast = parse(content, {
        sourceType: "module",
        plugins: [
          "jsx",
          "typescript",
          "decorators-legacy",
          "classProperties",
          "objectRestSpread",
        ],
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true,
      });

      // First, track all imports and requires to map variable names to file paths
      const importMap: Map<string, string> = new Map(); // variable name -> source file path

      traverse(ast, {
        ImportDeclaration: (path) => {
          if (path.node.source && this.isStringLiteral(path.node.source)) {
            const importPath = path.node.source.value;
            const resolvedPath = this.resolveControllerPath(
              importPath,
              filePath,
            );
            if (resolvedPath) {
              path.node.specifiers.forEach((spec) => {
                if (spec.type === "ImportDefaultSpecifier" && spec.local) {
                  importMap.set(spec.local.name, resolvedPath);
                }
              });
            }
          }
        },
        VariableDeclarator: (path) => {
          if (
            path.node.init?.type === "CallExpression" &&
            path.node.init.callee.type === "Identifier" &&
            (path.node.init.callee as any).name === "require" &&
            path.node.init.arguments.length > 0 &&
            this.isStringLiteral(path.node.init.arguments[0])
          ) {
            const requirePath = (path.node.init.arguments[0] as any).value;
            const resolvedPath = this.resolveControllerPath(
              requirePath,
              filePath,
            );
            if (resolvedPath && path.node.id.type === "Identifier") {
              importMap.set((path.node.id as any).name, resolvedPath);
            }
          }
        },
      });

      // Now look for app.use('/prefix', routerVariable) patterns
      traverse(ast, {
        CallExpression: (path: NodePath<CallExpression>) => {
          const node = path.node;
          if (
            this.isMemberExpression(node.callee) &&
            this.isIdentifier(node.callee.property) &&
            node.callee.property.name === "use" &&
            node.arguments.length >= 2
          ) {
            const firstArg = node.arguments[0];
            const secondArg = node.arguments[1];

            if (
              this.isStringLiteral(firstArg) &&
              this.isIdentifier(secondArg)
            ) {
              const prefix = firstArg.value;
              const routerVarName = secondArg.name;

              // First try to resolve from imports
              let routerFilePath = importMap.get(routerVarName);

              // If not found in imports, try the exported routers map
              if (!routerFilePath) {
                routerFilePath = this.routerExports.get(routerVarName);
              }

              if (routerFilePath) {
                console.log(
                  `[RouteDetector] Found app.use("${prefix}", ${routerVarName}) -> ${routerFilePath}`,
                );
                this.filePrefixes.set(routerFilePath, prefix);
              }
            }
          }
        },
      });
    } catch (error) {
      console.warn(`Error detecting app prefixes in ${filePath}:`, error);
    }
  }

  private async parseFileForRoutes(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, "utf-8");

      // Parse with Babel
      const ast = parse(content, {
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

      // First pass: detect imports and requires
      this.controllerImports.clear();
      this.functionImports.clear();
      traverse(ast, {
        ImportDeclaration: (path) => {
          this.detectImports(path.node, filePath);
        },
        VariableDeclarator: (path) => {
          this.detectRequires(path.node, filePath);
        },
      });

      // Second pass: detect router prefixes from app.use
      traverse(ast, {
        CallExpression: (path: NodePath<CallExpression>) => {
          this.detectRouterPrefix(path.node, filePath);
        },
      });

      // Third pass: detect routes
      traverse(ast, {
        CallExpression: (path: NodePath<CallExpression>) => {
          this.detectRoute(path.node, filePath);
        },
      });
    } catch (error) {
      console.warn(`Failed to parse ${filePath}:`, error);
    }
  }

  private detectRouterPrefix(node: CallExpression, filePath: string): void {
    // Look for app.use('/prefix', router) patterns
    if (
      this.isMemberExpression(node.callee) &&
      this.isIdentifier(node.callee.property) &&
      node.callee.property.name === "use" &&
      node.arguments.length >= 2
    ) {
      const firstArg = node.arguments[0];
      const secondArg = node.arguments[1];

      if (this.isStringLiteral(firstArg) && this.isIdentifier(secondArg)) {
        this.routerPrefixes.set(secondArg.name, firstArg.value);
      }
    }
  }

  private detectImports(
    node: ImportDeclaration,
    currentFilePath: string,
  ): void {
    // Handle ES6 imports like: import userController from './controllers/userController'
    if (node.source && this.isStringLiteral(node.source)) {
      const importPath = node.source.value;

      const resolvedPath = this.resolveControllerPath(
        importPath,
        currentFilePath,
      );

      if (resolvedPath && node.specifiers) {
        node.specifiers.forEach((spec) => {
          if (spec.type === "ImportDefaultSpecifier" && spec.local) {
            this.controllerImports.set(spec.local.name, resolvedPath);
          } else if (spec.type === "ImportNamespaceSpecifier" && spec.local) {
            this.controllerImports.set(spec.local.name, resolvedPath);
          } else if (spec.type === "ImportSpecifier" && spec.local) {
            // Handle named imports like: import { login, signup } from './controller'
            this.functionImports.set(spec.local.name, resolvedPath);
          }
        });
      }
    }
  }

  private detectRequires(
    node: VariableDeclarator,
    currentFilePath: string,
  ): void {
    // Check if this is a require() call
    if (
      node.init?.type === "CallExpression" &&
      node.init.callee.type === "Identifier" &&
      node.init.callee.name === "require" &&
      node.init.arguments.length > 0 &&
      this.isStringLiteral(node.init.arguments[0])
    ) {
      const requirePath = node.init.arguments[0].value;
      const resolvedPath = this.resolveControllerPath(
        requirePath,
        currentFilePath,
      );

      if (!resolvedPath) {
        return;
      }

      // Handle simple require: const userController = require('./controllers/userController')
      if (node.id.type === "Identifier") {
        this.controllerImports.set(node.id.name, resolvedPath);
      }
      // Handle destructured require: const { getAllUsers, getUserById } = require('./controllers/userController')
      else if (node.id.type === "ObjectPattern") {
        node.id.properties.forEach((prop) => {
          if (prop.type === "ObjectProperty") {
            // Handle both shorthand and explicit destructuring
            const key = prop.key.type === "Identifier" ? prop.key.name : null;
            const value =
              prop.value.type === "Identifier" ? prop.value.name : null;

            if (value) {
              // Map the local name to the controller file path
              this.functionImports.set(value, resolvedPath);
            }
          } else if (
            prop.type === "RestElement" &&
            prop.argument.type === "Identifier"
          ) {
            // Handle rest element: const { ...rest } = require('./controller')
            this.controllerImports.set(prop.argument.name, resolvedPath);
          }
        });
      }
    }
  }

  private resolveControllerPath(
    importPath: string,
    currentFilePath: string,
  ): string | null {
    if (!importPath.startsWith(".")) {
      // Skip node_modules imports
      return null;
    }

    const currentDir = path.dirname(currentFilePath);
    const resolvedPath = path.resolve(currentDir, importPath);

    // Check if the import path already has an extension
    const hasExtension = path.extname(importPath) !== "";

    if (hasExtension) {
      // If import already specifies extension, check that exact file
      if (fs.existsSync(resolvedPath)) {
        return resolvedPath;
      }
    } else {
      // Try common extensions only if no extension specified
      const extensions = [".js", ".ts", ".jsx", ".tsx"];
      for (const ext of extensions) {
        const fullPath = resolvedPath + ext;
        if (fs.existsSync(fullPath)) {
          return fullPath;
        }
      }

      // Try index files
      for (const ext of extensions) {
        const indexPath = path.join(resolvedPath, "index" + ext);
        if (fs.existsSync(indexPath)) {
          return indexPath;
        }
      }
    }

    return null;
  }

  private detectRoute(node: CallExpression, filePath: string): void {
    if (
      !this.isMemberExpression(node.callee) ||
      !this.isIdentifier(node.callee.property)
    ) {
      return;
    }

    const method = node.callee.property.name.toLowerCase();
    const httpMethods = [
      "get",
      "post",
      "put",
      "delete",
      "patch",
      "head",
      "options",
    ];

    if (!httpMethods.includes(method)) {
      return;
    }

    // Extract route path
    const pathArg = node.arguments[0];
    if (!this.isStringLiteral(pathArg)) {
      return;
    }

    const routePath = pathArg.value;
    let fullPath = routePath;

    // Apply router prefix if detected in same file
    if (
      this.isMemberExpression(node.callee) &&
      this.isIdentifier(node.callee.object)
    ) {
      const routerName = node.callee.object.name;
      const prefix = this.routerPrefixes.get(routerName);
      if (prefix) {
        fullPath = this.combinePaths(prefix, routePath);
      }
    }

    // If no prefix found in current file, check if this file is mounted with a prefix in the app file
    if (fullPath === routePath) {
      const filePrefix = this.filePrefixes.get(filePath);
      if (filePrefix) {
        fullPath = this.combinePaths(filePrefix, routePath);
      }
    }

    // Extract middlewares and handler
    const middlewares: string[] = [];
    let handler = "anonymous";
    let controllerFilePath: string | undefined;
    let controllerFunction: string | undefined;

    for (let i = 1; i < node.arguments.length; i++) {
      const arg = node.arguments[i];

      if (this.isIdentifier(arg)) {
        if (i === node.arguments.length - 1) {
          handler = arg.name;

          // Check if this is a direct function import
          const resolvedPath = this.functionImports.get(arg.name);
          if (resolvedPath) {
            controllerFilePath = resolvedPath;
            controllerFunction = arg.name;
          }
        } else {
          middlewares.push(arg.name);
        }
      } else if (
        this.isMemberExpression(arg) &&
        i === node.arguments.length - 1
      ) {
        // Handle controller.method patterns like userController.createUser
        if (this.isIdentifier(arg.object) && this.isIdentifier(arg.property)) {
          const controllerName = arg.object.name;
          const methodName = arg.property.name;
          handler = `${controllerName}.${methodName}`;

          // Try to resolve controller file path
          const resolvedPath = this.controllerImports.get(controllerName);
          if (resolvedPath) {
            controllerFilePath = resolvedPath;
            controllerFunction = methodName;
          }
        }
      }
    }

    // Determine the mount prefix for this route
    const mountPrefix =
      this.filePrefixes.get(filePath) ||
      (this.isMemberExpression(node.callee) &&
      this.isIdentifier(node.callee.object)
        ? this.routerPrefixes.get(node.callee.object.name)
        : undefined) ||
      "";

    console.log(
      `[RouteDetector] Route: ${method.toUpperCase()} ${fullPath} (prefix: "${mountPrefix}") from ${filePath}:${node.loc?.start.line}`,
    );

    this.routes.push({
      id: `${method.toUpperCase()}-${fullPath}-${handler}-${filePath}-${node.loc?.start.line || 0}`.replace(
        /\s+/g,
        "_",
      ),
      method: method.toUpperCase(),
      path: fullPath,
      filePath,
      line: node.loc?.start.line || 0,
      middlewares,
      handler,
      prefix: mountPrefix,
      controllerFilePath,
      controllerFunction,
    });
  }

  private combinePaths(prefix: string, path: string): string {
    // Remove trailing slash from prefix and leading slash from path if both exist
    const cleanPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    const cleanPath = path.startsWith("/") ? path : "/" + path;
    return cleanPrefix + cleanPath;
  }

  // Method to detect routes in a specific file (for snapshotting)
  async detectRoutesInFile(filePath: string): Promise<DetectedRoute[]> {
    const originalRoutes = [...this.routes];
    const originalPrefixes = new Map(this.routerPrefixes);
    const originalControllerImports = new Map(this.controllerImports);
    const originalFunctionImports = new Map(this.functionImports);

    try {
      // Clear state to only get routes from this specific file
      this.routes = [];
      this.routerPrefixes.clear();
      this.controllerImports.clear();
      this.functionImports.clear();

      // Parse the specific file
      await this.parseFileForRoutes(filePath);

      // Return the routes found in this file
      return [...this.routes];
    } catch (error) {
      console.error(`Error detecting routes in file ${filePath}:`, error);
      return [];
    } finally {
      // Restore original state
      this.routes = originalRoutes;
      this.routerPrefixes = originalPrefixes;
      this.controllerImports = originalControllerImports;
      this.functionImports = originalFunctionImports;
    }
  }

  // Type guards
  private isMemberExpression(node: Node): node is MemberExpression {
    return node.type === "MemberExpression";
  }

  private isIdentifier(node: Node): node is Identifier {
    return node.type === "Identifier";
  }

  private isStringLiteral(node: Node): node is StringLiteral {
    return node.type === "StringLiteral";
  }

  private isCallExpression(node: Node): node is CallExpression {
    return node.type === "CallExpression";
  }
}
