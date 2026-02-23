import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { DetectedRoute } from "../routeDetection";
import { parse } from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import {
  Node,
  FunctionDeclaration,
  ArrowFunctionExpression,
  FunctionExpression,
  MemberExpression,
  Identifier,
  AssignmentExpression,
  ObjectMethod,
} from "@babel/types";

export interface ControllerContext {
  route: DetectedRoute;
  reqBodyFields: string[];
  controllerCode: string;
  functionName: string;
  startLine: number;
  endLine: number;
}

export interface PredictedField {
  name: string;
  type: string;
  required: boolean;
  example: string;
  description: string;
}

export interface PredictedHeader {
  name: string;
  value: string;
  description: string;
  required: boolean;
}

export interface PayloadPrediction {
  fields: PredictedField[];
  headers?: PredictedHeader[];
  baseUrl?: string;
}

export class PayloadPredictor {
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async getGroqApiKey(): Promise<string | undefined> {
    // AI features are now handled by the backend server
    // Users don't need to provide their own API key
    return "backend-handled";
  }

  async predictBaseUrl(route: DetectedRoute): Promise<string> {
    // Try to detect backend URL from various sources
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
      return "http://localhost:3000"; // fallback
    }

    // 1. Check package.json scripts for common patterns
    try {
      const packageJsonPath = path.join(workspaceRoot, "package.json");
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf-8"),
        );

        // Look for port in scripts
        if (packageJson.scripts) {
          const scripts = JSON.stringify(packageJson.scripts);

          // Common patterns: --port 3001, PORT=4000, :5000, etc.
          const portMatch = scripts.match(
            /(?:--port[=\s]|PORT[=:]|:)(\d{4,5})/i,
          );
          if (portMatch) {
            const port = portMatch[1];
            console.log(`Detected port ${port} from package.json scripts`);
            return `http://localhost:${port}`;
          }
        }

        // Look for port in dependencies/devDependencies for common frameworks
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };
        if (deps.express || deps.fastify || deps.koa) {
          return "http://localhost:3000"; // Express default
        }
        if (deps.nextjs || deps.next) {
          return "http://localhost:3000"; // Next.js default
        }
        if (deps.nuxt) {
          return "http://localhost:3000"; // Nuxt default
        }
        if (deps.vite) {
          return "http://localhost:5173"; // Vite default
        }
      }
    } catch (error) {
      console.warn("Error reading package.json for port detection:", error);
    }

    // 2. Check common server files for port configuration
    const serverFiles = [
      "server.js",
      "app.js",
      "index.js",
      "main.js",
      "src/server.js",
      "src/app.js",
      "src/index.js",
      "src/main.js",
    ];

    for (const file of serverFiles) {
      try {
        const filePath = path.join(workspaceRoot, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");

          // Look for port assignments
          const portMatch = content.match(
            /(?:PORT[\s=:]+|port[\s=:]+|listen\([\s]*)(\d{4,5})/i,
          );
          if (portMatch) {
            const port = portMatch[1];
            console.log(`Detected port ${port} from ${file}`);
            return `http://localhost:${port}`;
          }
        }
      } catch (error) {
        console.warn(`Error reading ${file} for port detection:`, error);
      }
    }

    // 3. Check environment files
    const envFiles = [".env", ".env.local", ".env.development"];
    for (const envFile of envFiles) {
      try {
        const envPath = path.join(workspaceRoot, envFile);
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, "utf-8");
          const portMatch = content.match(/PORT[=\s]*(\d{4,5})/i);
          if (portMatch) {
            const port = portMatch[1];
            console.log(`Detected port ${port} from ${envFile}`);
            return `http://localhost:${port}`;
          }
        }
      } catch (error) {
        console.warn(`Error reading ${envFile} for port detection:`, error);
      }
    }

    // 4. Use AI to analyze the route file for port clues
    try {
      const routeContent = fs.readFileSync(route.filePath, "utf-8");
      const portMatch = routeContent.match(
        /(?:PORT|port)[\s=:]*["']?(\d{4,5})["']?/i,
      );
      if (portMatch) {
        const port = portMatch[1];
        console.log(`Detected port ${port} from route file`);
        return `http://localhost:${port}`;
      }
    } catch (error) {
      console.warn("Error analyzing route file for port:", error);
    }

    // Default fallback
    console.log("No specific port detected, using default 3000");
    return "http://localhost:3000";
  }

  // API key is now hardcoded, no configuration needed
  async configureApiKey(): Promise<void> {
    vscode.window.showInformationMessage(
      "✅ API key is pre-configured! AI features are ready to use.",
    );
  }

  async extractControllerContext(
    route: DetectedRoute,
  ): Promise<ControllerContext | null> {
    // Try to find controller function in the same file as the route (original approach)
    console.log(
      `🔍 Attempting to find controller "${route.handler}" in same file: ${route.filePath}`,
    );
    const sameFileContext = await this.tryExtractFromSameFile(route);
    if (sameFileContext) {
      console.log(`✅ Found controller "${route.handler}" in same file`);
      return sameFileContext;
    }

    // Try to find controller function in separate controller file
    if (route.controllerFilePath && route.controllerFunction) {
      console.log(
        `Attempting to find controller "${route.controllerFunction}" in separate file: ${route.controllerFilePath}`,
      );
      const separateFileContext = await this.tryExtractFromSeparateFile(route);
      if (separateFileContext) {
        console.log(
          `✅ Found controller "${route.controllerFunction}" in separate file`,
        );
        return separateFileContext;
      }
    } else {
      console.log(
        `⚠️ No separate controller file detected for route "${route.handler}"`,
      );
    }

    // If both failed, return null (will trigger error handling in predict())
    console.warn(
      `Could not find controller function "${route.handler}" in route file or separate controller file`,
    );
    return null;
  }

  private async tryExtractFromSameFile(
    route: DetectedRoute,
  ): Promise<ControllerContext | null> {
    try {
      const fileContent = fs.readFileSync(route.filePath, "utf-8");
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

      const result = this.findControllerFunctionInAST(
        ast,
        route.handler,
        fileContent,
        route,
      );

      return result;
    } catch (error) {
      console.warn(
        `Failed to extract controller from same file ${route.filePath}:`,
        error,
      );
      return null;
    }
  }

  private async tryExtractFromSeparateFile(
    route: DetectedRoute,
  ): Promise<ControllerContext | null> {
    try {
      if (!route.controllerFilePath || !route.controllerFunction) {
        return null;
      }

      const fileContent = fs.readFileSync(route.controllerFilePath, "utf-8");
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

      const result = this.findControllerFunctionInAST(
        ast,
        route.controllerFunction,
        fileContent,
        route,
      );

      return result;
    } catch (error) {
      console.warn(
        `Failed to extract controller from separate file ${route.controllerFilePath}:`,
        error,
      );
      return null;
    }
  }

  private findControllerFunctionInAST(
    ast: any,
    targetFunction: string,
    fileContent: string,
    route: DetectedRoute,
  ): ControllerContext | null {
    let controllerFunction: Node | null = null;
    let functionName = targetFunction;
    let startLine = 0;
    let endLine = 0;
    const reqBodyFields: string[] = [];

    // Find the controller function using multiple patterns
    traverse(ast, {
      FunctionDeclaration: (path: NodePath<FunctionDeclaration>) => {
        if (path.node.id?.name === targetFunction) {
          controllerFunction = path.node;
          functionName = path.node.id.name;
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
          functionName = path.node.id.name;
          startLine = path.node.loc?.start.line || 0;
          endLine = path.node.loc?.end.line || 0;
        }
      },
      // Handle exported functions like: exports.createUser = (req, res) => {}
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
          functionName = path.node.left.property.name;
          startLine = path.node.loc?.start.line || 0;
          endLine = path.node.loc?.end.line || 0;
        }
      },
      // Handle object method definitions like: { createUser(req, res) {} }
      ObjectMethod: (path) => {
        if (
          path.node.key.type === "Identifier" &&
          path.node.key.name === targetFunction
        ) {
          controllerFunction = path.node;
          functionName = path.node.key.name;
          startLine = path.node.loc?.start.line || 0;
          endLine = path.node.loc?.end.line || 0;
        }
      },
    });

    if (!controllerFunction) {
      return null;
    }

    // Extract req.body field accesses from the function
    traverse(ast, {
      MemberExpression: (path: NodePath<MemberExpression>) => {
        this.extractReqBodyFields(path, reqBodyFields);
      },
    });

    // Extract the controller code
    const lines = fileContent.split("\n");
    const controllerCode = lines.slice(startLine - 1, endLine).join("\n");

    return {
      route,
      reqBodyFields: [...new Set(reqBodyFields)], // Remove duplicates
      controllerCode,
      functionName,
      startLine,
      endLine,
    };
  }

  private extractReqBodyFields(
    path: NodePath<MemberExpression>,
    fields: string[],
  ): void {
    const node = path.node;

    // Look for req.body.fieldName patterns
    if (
      node.object.type === "MemberExpression" &&
      node.object.object.type === "Identifier" &&
      node.object.object.name === "req" &&
      node.object.property.type === "Identifier" &&
      node.object.property.name === "body" &&
      node.property.type === "Identifier"
    ) {
      fields.push(node.property.name);
    }
  }

  async predict(route: DetectedRoute): Promise<PayloadPrediction | null> {
    const context = await this.extractControllerContext(route);
    if (!context) {
      const controllerInfo = route.controllerFilePath
        ? `separate controller file: ${route.controllerFilePath}`
        : `same route file: ${route.filePath}`;

      vscode.window
        .showWarningMessage(
          `❌ Controller code missing: Could not find function "${route.handler}" in ${controllerInfo}`,
          "View Route",
          "Help",
        )
        .then((choice) => {
          if (choice === "View Route") {
            vscode.window.showTextDocument(vscode.Uri.file(route.filePath), {
              selection: new vscode.Range(route.line - 1, 0, route.line - 1, 0),
            });
          } else if (choice === "Help") {
            vscode.window.showInformationMessage(
              "AI Prediction requires access to controller function code. " +
                "Ensure your controller function is either:\n\n" +
                "1. Defined in the same file as the route\n" +
                "2. Properly imported and the controller file exists\n" +
                "3. Named correctly and exported properly",
              { modal: true },
            );
          }
        });
      return null;
    }

    try {
      const response = await this.callBackendAI(context);
      return this.parseBackendResponse(response);
    } catch (error) {
      console.error("Error calling AI backend:", error);

      // Handle specific API errors with helpful messages
      const errorMessage =
        error instanceof Error ? error.message : String(error);
        
      if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("fetch")) {
        vscode.window.showErrorMessage(
          "❌ Cannot connect to Conduit backend. Make sure the backend server is running on port 3002.",
          "Check Backend"
        );
      } else {
        vscode.window.showErrorMessage(
          `❌ AI prediction failed: ${errorMessage}`,
          "Help"
        ).then((choice) => {
          if (choice === "Help") {
            vscode.window.showInformationMessage(
              "AI prediction requires:\n\n" +
              "1. The Conduit backend server running (port 3002)\n" +
              "2. Valid route controller code\n" +
              "3. Proper network connectivity",
              { modal: true }
            );
          }
        });
      }
      return null;
    }
  }

  private buildPrompt(context: ControllerContext): string {
    return `Analyze this Express.js controller and predict the request body structure.

Route: ${context.route.method} ${context.route.path}
Middleware: ${context.route.middlewares.join(", ") || "none"}
Detected req.body fields: ${context.reqBodyFields.join(", ") || "none"}

Controller Code:
\`\`\`javascript
${context.controllerCode}
\`\`\`

Based on this controller, predict what the request body should contain AND what headers might be needed. Consider:
1. The detected req.body field accesses
2. The middleware (authentication, validation, etc.)
3. The route path and HTTP method
4. Common patterns for this type of endpoint
5. Content-Type requirements
6. Authentication headers
7. Custom API headers

Respond with ONLY valid JSON in this exact format:
{
  "fields": [
    {
      "name": "fieldName",
      "type": "string|number|boolean|array|object",
      "required": true|false,
      "example": "example value",
      "description": "brief description of the field"
    }
  ],
  "headers": [
    {
      "name": "headerName",
      "value": "example value or placeholder",
      "description": "brief description of the header",
      "required": true|false
    }
  ]
}`;
  }

  private async callGroqAPI(apiKey: string, prompt: string): Promise<string> {
    const groq = new Groq({
      apiKey: apiKey,
    });

    // Try different Groq models in order of preference
    const modelNames = [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "meta-llama/llama-prompt-guard-2-22m",
    ];

    for (const modelName of modelNames) {
      try {
        console.log(`Trying Groq model: ${modelName}`);

        const chatCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          model: modelName,
          temperature: 0.7,
          max_tokens: 2048,
        });

        const text = chatCompletion.choices[0]?.message?.content;

        if (!text) {
          throw new Error("No response from Groq API");
        }

        console.log(`Success with Groq model: ${modelName}`);
        return text;
      } catch (error: any) {
        console.log(`Failed with Groq model ${modelName}:`, error.message);
        if (modelName === modelNames[modelNames.length - 1]) {
          // If this was the last model to try, throw the error
          throw error;
        }
        // Otherwise, continue to the next model
        continue;
      }
    }

    throw new Error("All Groq models failed");
  }

  private async callAI(prompt: string): Promise<string> {
    const groqApiKey = await this.getGroqApiKey();
    if (!groqApiKey) {
      throw new Error(
        "No Groq API key configured. Please configure your Groq API key.",
      );
    }

    console.log("Using Groq API for AI prediction...");
    return await this.callGroqAPI(groqApiKey, prompt);
  }

  private parseResponse(response: string): PayloadPrediction | null {
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanResponse = response.trim();
      if (cleanResponse.startsWith("```json")) {
        cleanResponse = cleanResponse
          .replace(/^```json\s*/, "")
          .replace(/\s*```$/, "");
      } else if (cleanResponse.startsWith("```")) {
        cleanResponse = cleanResponse
          .replace(/^```\s*/, "")
          .replace(/\s*```$/, "");
      }

      const parsed = JSON.parse(cleanResponse);

      // Validate the structure
      if (!parsed.fields || !Array.isArray(parsed.fields)) {
        throw new Error("Invalid response structure");
      }

      // Validate each field
      for (const field of parsed.fields) {
        if (!field.name || !field.type || typeof field.required !== "boolean") {
          throw new Error("Invalid field structure");
        }
      }

      // Validate headers if present
      if (parsed.headers) {
        if (!Array.isArray(parsed.headers)) {
          throw new Error("Invalid headers structure");
        }
        for (const header of parsed.headers) {
          if (
            !header.name ||
            !header.value ||
            typeof header.required !== "boolean"
          ) {
            throw new Error("Invalid header structure");
          }
        }
      }

      return parsed as PayloadPrediction;
    } catch (error) {
      console.error("Error parsing Groq response:", error);
      console.error("Raw response:", response);
      return null;
    }
  }

  async suggestErrorFix(
    route: DetectedRoute,
    errorResponse: any,
    requestPayload: any,
    statusCode: number,
  ): Promise<string | null> {
    const context = await this.extractControllerContext(route);
    if (!context) {
      return null;
    }

    const prompt = `Analyze this API error and suggest what might be wrong.

Route: ${context.route.method} ${context.route.path}
Status Code: ${statusCode}
Request Payload: ${JSON.stringify(requestPayload, null, 2)}
Error Response: ${JSON.stringify(errorResponse, null, 2)}

Controller Code:
\`\`\`javascript
${context.controllerCode}
\`\`\`

Based on the error response and the controller code, suggest what might be wrong with the request. Be specific and actionable.`;

    try {
      const response = await this.callAI(prompt);
      return response.trim();
    } catch (error) {
      console.error("Error getting error suggestion:", error);

      // Handle API key errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes("API_KEY_INVALID") ||
        errorMessage.includes("401") ||
        errorMessage.includes("RATE_LIMIT_EXCEEDED")
      ) {
        console.warn("API key or rate limit issue:", errorMessage);
      }

      return null;
    }
  }

  isAuthenticationRequired(route: DetectedRoute): boolean {
    const authMiddlewares = [
      "verifyToken",
      "authenticate",
      "requireAuth",
      "protect",
      "auth",
      "authenticateToken",
      "verifyJWT",
      "checkAuth",
      "ensureAuthenticated",
      "requireLogin",
    ];

    return route.middlewares.some((middleware) =>
      authMiddlewares.some((authMw) =>
        middleware.toLowerCase().includes(authMw.toLowerCase()),
      ),
    );
  }

  private async callBackendAI(context: ControllerContext): Promise<any> {
    const config = vscode.workspace.getConfiguration('conduit');
    const backendUrl = config.get<string>('backend.url') || 'http://localhost:3002';

    const routeInfo = {
      method: context.route.method,
      path: context.route.path,
      middlewares: context.route.middlewares,
      reqBodyFields: context.reqBodyFields,
      controllerCode: context.controllerCode
    };

    const response = await fetch(`${backendUrl}/api/ai/predict-payload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ routeInfo })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Backend AI call failed: ${response.status} - ${errorData.error || response.statusText}`);
    }

    return await response.json();
  }

  private parseBackendResponse(response: any): PayloadPrediction | null {
    try {
      if (!response.success || !response.payload) {
        throw new Error("Invalid backend response structure");
      }

      // The backend returns a more flexible format, so we need to convert it
      // to match the expected PayloadPrediction structure
      const payload = response.payload;
      
      // If the payload is already in the expected format, use it directly
      if (payload.fields && Array.isArray(payload.fields)) {
        return payload as PayloadPrediction;
      }
      
      // Otherwise, try to convert the raw payload to the expected format
      const fields = [];
      
      if (typeof payload === 'object' && payload !== null) {
        for (const [key, value] of Object.entries(payload)) {
          fields.push({
            name: key,
            type: this.inferType(value),
            required: true,
            example: value,
            description: `Generated field for ${key}`
          });
        }
      }

      return {
        fields,
        headers: [
          {
            name: "Content-Type",
            value: "application/json",
            description: "Content type for JSON payload",
            required: true
          }
        ]
      };
    } catch (error) {
      console.error("Error parsing backend response:", error);
      return null;
    }
  }

  private inferType(value: any): string {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'string';
    return typeof value;
  }
}
