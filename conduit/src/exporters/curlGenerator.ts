import { DetectedRoute } from "../routeDetection";

export interface CurlCommand {
  command: string;
  baseUrl: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: any;
}

/**
 * Generate a cURL command for a route
 */
export function generateCurlCommand(
  route: DetectedRoute,
  baseUrl: string = "http://localhost:3000",
  payload: any = {},
  authToken: string = "<token>",
): CurlCommand {
  const url = baseUrl + route.path;
  const method = route.method.toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add authorization header if needed
  if (
    route.handler.toLowerCase().includes("auth") ||
    route.middlewares.some((m) => m.toLowerCase().includes("auth"))
  ) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  // Build the curl command
  let curlCmd = `curl -X ${method} "${url}" \\`;

  // Add headers
  for (const [key, value] of Object.entries(headers)) {
    curlCmd += `\n  -H "${key}: ${value}" \\`;
  }

  // Add body for POST/PUT/PATCH
  if (
    ["POST", "PUT", "PATCH"].includes(method) &&
    Object.keys(payload).length > 0
  ) {
    const bodyStr = JSON.stringify(payload).replace(/"/g, '\\"');
    curlCmd += `\n  -d '${JSON.stringify(payload)}'`;
  } else {
    // Remove trailing backslash
    curlCmd = curlCmd.slice(0, -2);
  }

  return {
    command: curlCmd,
    baseUrl,
    method,
    path: route.path,
    headers,
    body: Object.keys(payload).length > 0 ? payload : undefined,
  };
}

/**
 * Generate a Windows PowerShell equivalent of curl command
 */
export function generatePowerShellCommand(
  route: DetectedRoute,
  baseUrl: string = "http://localhost:3000",
  payload: any = {},
  authToken: string = "<token>",
): string {
  const url = baseUrl + route.path;
  const method = route.method.toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add authorization header if needed
  if (
    route.handler.toLowerCase().includes("auth") ||
    route.middlewares.some((m) => m.toLowerCase().includes("auth"))
  ) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  // Build headers hashtable
  let headerLines = "@{\n";
  for (const [key, value] of Object.entries(headers)) {
    headerLines += `    "${key}" = "${value}"\n`;
  }
  headerLines += "}";

  // Build PowerShell command
  let psCmd = `$body = @{\n`;

  if (
    ["POST", "PUT", "PATCH"].includes(method) &&
    Object.keys(payload).length > 0
  ) {
    for (const [key, value] of Object.entries(payload)) {
      const valueStr =
        typeof value === "string" ? `"${value}"` : JSON.stringify(value);
      psCmd += `    "${key}" = ${valueStr}\n`;
    }
  }

  psCmd += `} | ConvertTo-Json\n\n`;
  psCmd += `Invoke-RestMethod -Uri "${url}" \\\n`;
  psCmd += `  -Method ${method} \\\n`;
  psCmd += `  -Headers ${headerLines} \\\n`;

  if (Object.keys(payload).length > 0) {
    psCmd += `  -Body $body`;
  }

  return psCmd;
}

/**
 * Generate a JavaScript/Node.js fetch equivalent
 */
export function generateFetchCommand(
  route: DetectedRoute,
  baseUrl: string = "http://localhost:3000",
  payload: any = {},
  authToken: string = "<token>",
): string {
  const url = baseUrl + route.path;
  const method = route.method.toUpperCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add authorization header if needed
  if (
    route.handler.toLowerCase().includes("auth") ||
    route.middlewares.some((m) => m.toLowerCase().includes("auth"))
  ) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let fetchCmd = `fetch("${url}", {\n`;
  fetchCmd += `  method: "${method}",\n`;
  fetchCmd += `  headers: ${JSON.stringify(headers, null, 4).split("\n").join("\n  ")},\n`;

  if (
    ["POST", "PUT", "PATCH"].includes(method) &&
    Object.keys(payload).length > 0
  ) {
    fetchCmd += `  body: ${JSON.stringify(JSON.stringify(payload, null, 2))},\n`;
  }

  fetchCmd += `})\n`;
  fetchCmd += `  .then(res => res.json())\n`;
  fetchCmd += `  .then(data => console.log(data))\n`;
  fetchCmd += `  .catch(err => console.error(err));`;

  return fetchCmd;
}

/**
 * Generate a Python requests equivalent
 */
export function generatePythonCommand(
  route: DetectedRoute,
  baseUrl: string = "http://localhost:3000",
  payload: any = {},
  authToken: string = "<token>",
): string {
  const url = baseUrl + route.path;
  const method = route.method.toLowerCase();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Add authorization header if needed
  if (
    route.handler.toLowerCase().includes("auth") ||
    route.middlewares.some((m) => m.toLowerCase().includes("auth"))
  ) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let pythonCmd = `import requests\n\n`;
  pythonCmd += `url = "${url}"\n`;
  pythonCmd += `headers = ${JSON.stringify(headers, null, 4).split("\n").join("\n")}\n`;

  if (["POST", "PUT", "PATCH"].includes(route.method.toUpperCase())) {
    pythonCmd += `payload = ${JSON.stringify(payload, null, 4).split("\n").join("\n")}\n\n`;
    pythonCmd += `response = requests.${method}(url, json=payload, headers=headers)\n`;
  } else {
    pythonCmd += `response = requests.${method}(url, headers=headers)\n`;
  }

  pythonCmd += `print(response.json())`;

  return pythonCmd;
}
