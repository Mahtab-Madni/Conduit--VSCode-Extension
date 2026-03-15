import { DetectedRoute } from "../detection/routeDetection";

export interface PostmanCollection {
  info: {
    name: string;
    description: string;
    schema: string;
  };
  item: PostmanRequestItem[];
  variable: any[];
  auth?: any;
}

export interface PostmanRequestItem {
  name: string;
  item?: PostmanRequestItem[];
  request?: PostmanRequest;
}

export interface PostmanRequest {
  method: string;
  header: PostmanHeader[];
  body?: PostmanBody;
  url: PostmanUrl;
  description: string;
}

export interface PostmanHeader {
  key: string;
  value: string;
  type: string;
  disabled?: boolean;
}

export interface PostmanBody {
  mode: string;
  raw: string;
}

export interface PostmanUrl {
  raw: string;
  protocol: string;
  host: string[];
  port?: string;
  path: string[];
  query?: PostmanQuery[];
}

export interface PostmanQuery {
  key: string;
  value: string;
  disabled?: boolean;
}

/**
 * Generate a valid Postman v2.1 collection from detected routes
 */
export function generatePostmanCollection(
  routes: DetectedRoute[],
  baseUrl: string = "http://localhost:3000",
  payloads: Record<string, any> = {},
): PostmanCollection {
  // Group routes by path prefix for organization
  const groupedRoutes = groupRoutesByPath(routes);

  return {
    info: {
      name: "Conduit API Collection",
      description: "API collection auto-generated from source code",
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: buildItemHierarchy(groupedRoutes, baseUrl, payloads),
    variable: [
      {
        key: "base_url",
        value: baseUrl,
        type: "string",
      },
      {
        key: "auth_token",
        value: "",
        type: "string",
      },
    ],
    auth: {
      type: "bearer",
      bearer: [
        {
          key: "token",
          value: "{{auth_token}}",
          type: "string",
        },
      ],
    },
  };
}

function groupRoutesByPath(
  routes: DetectedRoute[],
): Map<string, DetectedRoute[]> {
  const grouped = new Map<string, DetectedRoute[]>();

  for (const route of routes) {
    const pathSegments = route.path.split("/").filter((s) => s);
    const rootPath = "/" + (pathSegments[0] || "root");

    if (!grouped.has(rootPath)) {
      grouped.set(rootPath, []);
    }
    grouped.get(rootPath)!.push(route);
  }

  return grouped;
}

function buildItemHierarchy(
  groupedRoutes: Map<string, DetectedRoute[]>,
  baseUrl: string,
  payloads: Record<string, any>,
): PostmanRequestItem[] {
  const items: PostmanRequestItem[] = [];

  // Sort groups for consistent output
  const sortedGroups = Array.from(groupedRoutes.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [pathGroup, routesInGroup] of sortedGroups) {
    const groupItem: PostmanRequestItem = {
      name: pathGroup.replace("/", ""),
      item: routesInGroup.map((route) =>
        buildRequestItem(route, baseUrl, payloads[route.path] || {}),
      ),
    };
    items.push(groupItem);
  }

  return items;
}

function buildRequestItem(
  route: DetectedRoute,
  baseUrl: string,
  payload: any,
): PostmanRequestItem {
  const url = parseUrl(baseUrl, route.path);

  const headers: PostmanHeader[] = [
    {
      key: "Content-Type",
      value: "application/json",
      type: "text",
    },
  ];

  // Add authorization header if route appears to need it
  if (
    route.handler.toLowerCase().includes("auth") ||
    route.middlewares.some((m) => m.toLowerCase().includes("auth"))
  ) {
    headers.push({
      key: "Authorization",
      value: "Bearer {{auth_token}}",
      type: "text",
    });
  }

  const request: PostmanRequest = {
    method: route.method.toUpperCase(),
    header: headers,
    url,
    description: `${route.method.toUpperCase()} ${route.path}\nFile: ${route.filePath}:${route.line}`,
  };

  // Add body for POST/PUT/PATCH requests
  if (
    ["POST", "PUT", "PATCH"].includes(route.method.toUpperCase()) &&
    Object.keys(payload).length > 0
  ) {
    request.body = {
      mode: "raw",
      raw: JSON.stringify(payload, null, 2),
    };
  }

  return {
    name: `${route.method.toUpperCase()} ${route.path}`,
    request,
  };
}

function parseUrl(baseUrl: string, path: string): PostmanUrl {
  const url = new URL(path.startsWith("http") ? path : baseUrl + path);

  return {
    raw: url.toString(),
    protocol: url.protocol.replace(":", ""),
    host: url.hostname.split("."),
    port: url.port || undefined,
    path: path.split("/").filter((p) => p),
    query: Array.from(url.searchParams.entries()).map(([key, value]) => ({
      key,
      value,
      disabled: false,
    })),
  };
}

/**
 * Export collection as JSON file
 */
export function exportPostmanCollection(
  routes: DetectedRoute[],
  baseUrl: string,
  payloads: Record<string, any>,
): string {
  const collection = generatePostmanCollection(routes, baseUrl, payloads);
  return JSON.stringify(collection, null, 2);
}
