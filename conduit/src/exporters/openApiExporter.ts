import { DetectedRoute } from "../routeDetection";

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, any>;
  components: {
    schemas: Record<string, any>;
    securitySchemes: Record<string, any>;
  };
}

/**
 * Generate a valid OpenAPI 3.0.0 specification from detected routes
 */
export function generateOpenAPISpec(
  routes: DetectedRoute[],
  baseUrl: string = "http://localhost:3000",
  payloads: Record<string, any> = {},
  schemas: Record<string, any> = {},
): OpenAPISpec {
  const paths: Record<string, any> = {};

  // Build paths from routes
  for (const route of routes) {
    const pathKey = convertToPathParameter(route.path);

    if (!paths[pathKey]) {
      paths[pathKey] = {};
    }

    const method = route.method.toLowerCase();
    const payload = payloads[route.path] || {};

    paths[pathKey][method] = buildPathItem(route, payload, schemas);
  }

  return {
    openapi: "3.0.0",
    info: {
      title: "Conduit Generated API",
      description:
        "OpenAPI specification auto-generated from source code analysis",
      version: "1.0.0",
    },
    servers: [
      {
        url: baseUrl,
        description: "API Server",
      },
    ],
    paths,
    components: {
      schemas: buildSchemas(payloads, schemas),
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  };
}

function convertToPathParameter(path: string): string {
  // Convert route params from :id to {id}
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}");
}

function buildPathItem(
  route: DetectedRoute,
  payload: any,
  schemas: Record<string, any>,
): any {
  const pathItem: any = {
    summary: `${route.method.toUpperCase()} ${route.path}`,
    description: `File: ${route.filePath}:${route.line}`,
    operationId: `${route.method.toLowerCase()}${toCamelCase(route.path)}`,
    tags: [route.path.split("/")[1] || "default"],
    parameters: extractPathParameters(route.path),
  };

  // Add security if route has auth middleware
  if (
    route.handler.toLowerCase().includes("auth") ||
    route.middlewares.some((m) => m.toLowerCase().includes("auth"))
  ) {
    pathItem.security = [{ bearerAuth: [] }];
  }

  // Add request body for POST/PUT/PATCH
  if (["post", "put", "patch"].includes(route.method.toLowerCase())) {
    const schemaName = `${toCamelCase(route.path)}Request`;

    if (Object.keys(payload).length > 0) {
      pathItem.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: {
              $ref: `#/components/schemas/${schemaName}`,
            },
            example: payload,
          },
        },
      };
    } else {
      pathItem.requestBody = {
        required: false,
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {},
            },
          },
        },
      };
    }
  }

  // Add responses
  pathItem.responses = {
    "200": {
      description: "Successful response",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    "400": {
      description: "Bad request",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
    "401": {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    "500": {
      description: "Server error",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" },
            },
          },
        },
      },
    },
  };

  return pathItem;
}

function extractPathParameters(path: string): any[] {
  const paramRegex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
  const parameters: any[] = [];
  let match;

  while ((match = paramRegex.exec(path)) !== null) {
    parameters.push({
      name: match[1],
      in: "path",
      required: true,
      schema: {
        type: "string",
      },
    });
  }

  return parameters;
}

function buildSchemas(
  payloads: Record<string, any>,
  schemas: Record<string, any>,
): Record<string, any> {
  const builtSchemas: Record<string, any> = { ...schemas };

  // Generate request schemas from payloads
  for (const [path, payload] of Object.entries(payloads)) {
    const schemaName = `${toCamelCase(path)}Request`;

    builtSchemas[schemaName] = {
      type: "object",
      properties: generateProperties(payload),
      required: Object.keys(payload),
    };
  }

  return builtSchemas;
}

function generateProperties(obj: any): Record<string, any> {
  const properties: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    properties[key] = inferSchemaType(value);
  }

  return properties;
}

function inferSchemaType(value: any): any {
  if (value === null) {
    return { type: "null" };
  }

  if (Array.isArray(value)) {
    return {
      type: "array",
      items: value.length > 0 ? inferSchemaType(value[0]) : { type: "string" },
    };
  }

  if (typeof value === "object") {
    return {
      type: "object",
      properties: generateProperties(value),
    };
  }

  if (typeof value === "boolean") {
    return { type: "boolean" };
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? { type: "integer" } : { type: "number" };
  }

  return { type: "string" };
}

function toCamelCase(str: string): string {
  return str
    .split(/[/:-]/)
    .filter((s) => s)
    .map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)))
    .join("");
}

/**
 * Export spec as YAML
 */
export function exportOpenAPIYaml(
  routes: DetectedRoute[],
  baseUrl: string,
  payloads: Record<string, any>,
  schemas: Record<string, any>,
): string {
  const spec = generateOpenAPISpec(routes, baseUrl, payloads, schemas);
  return convertToYaml(spec);
}

function convertToYaml(obj: any, indent: number = 0): string {
  const spaces = " ".repeat(indent);
  let yaml = "";

  if (Array.isArray(obj)) {
    for (const item of obj) {
      yaml += `${spaces}- ${convertToYaml(item, indent + 2).trim()}\n`;
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "string") {
        yaml += `${spaces}${key}: ${JSON.stringify(value)}\n`;
      } else if (typeof value === "number" || typeof value === "boolean") {
        yaml += `${spaces}${key}: ${value}\n`;
      } else if (value === null) {
        yaml += `${spaces}${key}: null\n`;
      } else {
        yaml += `${spaces}${key}:\n`;
        yaml += convertToYaml(value, indent + 2);
      }
    }
  } else if (typeof obj === "string") {
    return JSON.stringify(obj);
  } else {
    return String(obj);
  }

  return yaml;
}
