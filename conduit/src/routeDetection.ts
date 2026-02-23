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

  constructor(private workspaceRoot: string) {}

  async detectRoutes(): Promise<DetectedRoute[]> {
    this.routes = [];
    this.routerPrefixes.clear();
    this.controllerImports.clear();
    this.functionImports.clear();

    // Find all JavaScript/TypeScript files that might contain routes
    const files = await this.findRouteFiles();

    for (const file of files) {
      await this.parseFileForRoutes(file);
    }

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
    // Handle require statements like: const userController = require('./controllers/userController')
    if (
      node.id.type === "Identifier" &&
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

      if (resolvedPath) {
        this.controllerImports.set(node.id.name, resolvedPath);
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

    // Apply router prefix if detected
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

    this.routes.push({
      method: method.toUpperCase(),
      path: fullPath,
      filePath,
      line: node.loc?.start.line || 0,
      middlewares,
      handler,
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
