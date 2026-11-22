export interface CodePulseClientConfig {
  baseUrl?: string;
  bearerToken?: string;
  apiKey?: string;
  maxRetries?: number;
  baseBackoffMs?: number;
  fetchImpl?: typeof fetch;
}

export interface HealthStatus {
  status: string;
  version: string;
  timestamp: string;
}

export interface DeveloperProfile {
  id: string;
  username: string;
  name: string | null;
  avatar: string | null;
  xp: number;
  level: number;
}

export class CodePulseApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody?: unknown,
  ) {
    super(message);
    this.name = "CodePulseApiError";
  }
}

export class CodePulseClient {
  private readonly baseUrl: string;
  private bearerToken?: string;
  private apiKey?: string;
  private readonly maxRetries: number;
  private readonly baseBackoffMs: number;
  private readonly fetchFn: typeof fetch;

  constructor(config: CodePulseClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? "https://api.codepulse.dev/api/v1").replace(/\/$/, "");
    this.bearerToken = config.bearerToken;
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries ?? 3;
    this.baseBackoffMs = config.baseBackoffMs ?? 200;
    this.fetchFn = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  setBearerToken(token: string | undefined): void {
    this.bearerToken = token;
  }

  setApiKey(apiKey: string | undefined): void {
    this.apiKey = apiKey;
  }

  buildAuthHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CodePulse-SDK": "@codepulse/sdk/1.0.0",
      ...(extra ?? {}),
    };
    if (this.bearerToken) {
      headers["Authorization"] = `Bearer ${this.bearerToken}`;
    }
    if (this.apiKey) {
      headers["X-API-Key"] = this.apiKey;
    }
    return headers;
  }

  async request<T>(
    method: string,
    routePath: string,
    options?: { body?: unknown; headers?: Record<string, string> },
  ): Promise<T> {
    const url = `${this.baseUrl}${routePath.startsWith("/") ? routePath : `/${routePath}`}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const response = await this.fetchFn(url, {
        method,
        headers: this.buildAuthHeaders(options?.headers),
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      });

      if (response.ok) {
        return (await response.json()) as T;
      }

      const isRateLimited = response.status === 429;
      const isTransient = response.status >= 500 && response.status < 600;

      if ((isRateLimited || isTransient) && attempt < this.maxRetries) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        const delayMs = Number.isFinite(retryAfterSec)
          ? Math.max(0, retryAfterSec * 1000)
          : this.baseBackoffMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      const errorText = await response.text();
      throw new CodePulseApiError(
        `CodePulse API request failed (${response.status}): ${errorText}`,
        response.status,
        errorText,
      );
    }

    throw new CodePulseApiError("Exhausted maximum retry attempts", 503);
  }

  async getSystemHealth(): Promise<HealthStatus> {
    return this.request<HealthStatus>("GET", "/health");
  }

  async getDeveloperByUsername(username: string): Promise<DeveloperProfile> {
    return this.request<DeveloperProfile>(
      "GET",
      `/users/${encodeURIComponent(username)}`,
    );
  }
}
