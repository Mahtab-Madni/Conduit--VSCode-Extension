
const BACKEND_URL = "https://conduit-backend-kappa.vercel.app";

export class SyncClient {
  private static instance: SyncClient;

  private constructor() {}

  public static getInstance(): SyncClient {
    if (!SyncClient.instance) {
      SyncClient.instance = new SyncClient();
    }
    return SyncClient.instance;
  }

  public getBackendUrl(): string {
    return BACKEND_URL;
  }

  public async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    token?: string,
  ): Promise<T> {
    const url = `${BACKEND_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Backend request failed: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }
}

export function getSyncClient(): SyncClient {
  return SyncClient.getInstance();
}

export function getBackendUrl(): string {
  return SyncClient.getInstance().getBackendUrl();
}
