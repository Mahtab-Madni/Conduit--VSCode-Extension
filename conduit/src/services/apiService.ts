import * as vscode from "vscode";
import { createHash } from "crypto";

export interface RouteSnapshot {
  _id?: string;
  userId: string;
  routeId: string;
  routePath: string;
  method: string;
  filePath: string;
  lineNumber?: number;
  code: string;
  codeHash: string;
  predictedPayload?: any;
  lastResponse?: {
    status?: number;
    headers?: any;
    body?: any;
    timestamp?: Date;
  };
  metadata?: {
    fileSize?: number;
    totalRoutes?: number;
    framework?: string;
  };
  collectionId?: string;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Collection {
  _id?: string;
  userId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isPublic?: boolean;
  settings?: {
    autoSnapshot?: boolean;
    maxSnapshots?: number;
    retentionDays?: number;
  };
  stats?: {
    totalSnapshots?: number;
    totalRoutes?: number;
    lastActivity?: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SnapshotDiff {
  code: {
    old: string;
    new: string;
    changed: boolean;
  };
  payload: {
    old: any;
    new: any;
    changed: boolean;
  };
  timestamps: {
    old: Date;
    new: Date;
  };
}

export class ConduitApiService {
  private baseUrl: string;
  private token: string | null = null;
  private context: vscode.ExtensionContext;
  private tokenLoaded: boolean = false;

  constructor(
    context: vscode.ExtensionContext,
    baseUrl: string = "http://localhost:3002",
  ) {
    this.context = context;
    this.baseUrl = baseUrl;
    // Load token asynchronously but track loading state
    this.loadToken().catch((error) => {
      console.error("Failed to load token during construction:", error);
    });
  }

  private async loadToken(): Promise<void> {
    try {
      console.log("[Conduit] Loading token from secrets...");
      this.token =
        (await this.context.secrets.get("conduit.auth.token")) || null;
      this.tokenLoaded = true;
      console.log(
        "[Conduit] Token loaded:",
        this.token ? "Present" : "Missing",
      );
    } catch (error) {
      console.error("Failed to load auth token:", error);
      this.tokenLoaded = true; // Mark as loaded even if failed
    }
  }

  private async saveToken(token: string): Promise<void> {
    try {
      console.log("[Conduit] Saving token to secrets...");
      await this.context.secrets.store("conduit.auth.token", token);
      this.token = token;
      this.tokenLoaded = true;
      console.log("[Conduit] Token saved successfully");
    } catch (error) {
      console.error("Failed to save auth token:", error);
      throw error; // Re-throw to handle in authenticate method
    }
  }

  private async clearToken(): Promise<void> {
    try {
      await this.context.secrets.delete("conduit.auth.token");
      this.token = null;
    } catch (error) {
      console.error("Failed to clear auth token:", error);
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...(options.headers || {}),
      },
    };

    console.log("[Conduit] Making API request:", {
      url,
      method: config.method || "GET",
      hasAuth: !!this.token,
    });

    try {
      const response = await fetch(url, config);

      console.log("[Conduit] API response:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.warn("[Conduit] Unauthorized response, clearing token");
          await this.clearToken();
          throw new Error("Authentication required");
        }

        let errorData: { error?: string };
        try {
          errorData = (await response.json()) as { error?: string };
        } catch (parseError) {
          console.error(
            "[Conduit] Failed to parse error response:",
            parseError,
          );
          errorData = { error: "Unknown error" };
        }

        const errorMessage =
          errorData.error || `HTTP ${response.status} ${response.statusText}`;
        console.error("[Conduit] API error response:", errorMessage);
        throw new Error(errorMessage);
      }

      const result = (await response.json()) as T;
      console.log("[Conduit] API request successful");
      return result;
    } catch (error) {
      console.error(`[Conduit] API request failed: ${endpoint}`, error);

      if (error instanceof TypeError && error.message.includes("fetch")) {
        console.error(
          "[Conduit] Network error - is the backend server running?",
        );
        throw new Error(
          "Network error: Cannot connect to Conduit backend. Please ensure the backend server is running.",
        );
      }

      throw error;
    }
  }

  // Authentication methods
  public async isAuthenticated(): Promise<boolean> {
    // Ensure token is loaded before checking authentication
    if (!this.tokenLoaded) {
      console.log("[Conduit] Token not loaded yet, loading now...");
      await this.loadToken();
    }

    console.log(
      "[Conduit] Checking authentication status, token:",
      this.token ? "Present" : "Missing",
      "tokenLoaded:",
      this.tokenLoaded,
    );
    return !!this.token;
  }

  // Synchronous version for cases where we know token is loaded
  public isAuthenticatedSync(): boolean {
    return !!this.token;
  }

  // Force reload token for debugging
  public async reloadToken(): Promise<void> {
    console.log("[Conduit] Force reloading token...");
    this.tokenLoaded = false;
    await this.loadToken();
  }

  public async authenticate(token: string): Promise<void> {
    console.log("[Conduit] Starting authentication with token...");

    if (!token) {
      throw new Error("Token is required for authentication");
    }

    console.log("[Conduit] Token length:", token.length);
    console.log("[Conduit] Token preview:", token.substring(0, 10) + "...");

    try {
      await this.saveToken(token);
      console.log("[Conduit] Token saved successfully, verifying...");

      // Verify token by getting user info
      console.log("[Conduit] Verifying token by fetching user info...");
      const user = await this.getCurrentUser();
      console.log(
        "[Conduit] Token verified successfully for user:",
        user.username || user.displayName,
      );
      console.log("[Conduit] User details:", {
        id: user.id,
        username: user.username,
        email: user.email,
      });
    } catch (error: any) {
      console.error("[Conduit] Authentication failed:", error);
      console.error("[Conduit] Error type:", typeof error);
      console.error("[Conduit] Error message:", error?.message);
      console.error("[Conduit] Error stack:", error?.stack);

      // Clear the token if verification failed
      await this.clearToken();
      console.log("[Conduit] Token cleared due to verification failure");

      throw new Error(
        `Authentication failed: ${error?.message || "Unknown error"}`,
      );
    }
  }

  public async logout(): Promise<void> {
    await this.clearToken();
  }

  public getAuthUrl(): string {
    const authUrl = `${this.baseUrl}/auth/github`;
    console.log("[Conduit] Generated auth URL:", authUrl);
    return authUrl;
  }

  // User methods
  public async getCurrentUser(): Promise<any> {
    return this.makeRequest("/api/user/me");
  }

  // Collection methods
  public async getCollections(): Promise<Collection[]> {
    return this.makeRequest("/api/collections");
  }

  public async createCollection(
    collection: Partial<Collection>,
  ): Promise<Collection> {
    return this.makeRequest("/api/collections", {
      method: "POST",
      body: JSON.stringify(collection),
    });
  }

  public async updateCollection(
    id: string,
    collection: Partial<Collection>,
  ): Promise<Collection> {
    return this.makeRequest(`/api/collections/${id}`, {
      method: "PUT",
      body: JSON.stringify(collection),
    });
  }

  public async deleteCollection(id: string): Promise<void> {
    return this.makeRequest(`/api/collections/${id}`, {
      method: "DELETE",
    });
  }

  // Snapshot methods
  public async createSnapshot(
    snapshot: Partial<RouteSnapshot>,
  ): Promise<RouteSnapshot> {
    // Generate code hash if not provided
    if (snapshot.code && !snapshot.codeHash) {
      snapshot.codeHash = createHash("md5").update(snapshot.code).digest("hex");
    }

    return this.makeRequest("/api/snapshots", {
      method: "POST",
      body: JSON.stringify(snapshot),
    });
  }

  public async getRouteHistory(
    routeId: string,
    limit: number = 20,
    skip: number = 0,
  ): Promise<RouteSnapshot[]> {
    return this.makeRequest(
      `/api/snapshots/route/${routeId}?limit=${limit}&skip=${skip}`,
    );
  }

  public async getSnapshot(id: string): Promise<RouteSnapshot> {
    return this.makeRequest(`/api/snapshots/${id}`);
  }

  public async deleteSnapshot(id: string): Promise<void> {
    return this.makeRequest(`/api/snapshots/${id}`, {
      method: "DELETE",
    });
  }

  public async compareSnapshots(
    snapshotId1: string,
    snapshotId2: string,
  ): Promise<SnapshotDiff> {
    return this.makeRequest("/api/snapshots/diff", {
      method: "POST",
      body: JSON.stringify({ snapshotId1, snapshotId2 }),
    });
  }

  // Utility methods
  public async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.makeRequest("/health");
  }

  public generateRouteId(
    method: string,
    path: string,
    filePath: string,
  ): string {
    const routeString = `${method.toUpperCase()}_${path}_${filePath}`;
    return createHash("md5").update(routeString).digest("hex").substring(0, 16);
  }
}
