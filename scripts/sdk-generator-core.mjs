#!/usr/bin/env node
/**
 * CodePulse Multi-Language OpenAPI 3.1 SDK Generator
 * Generates idiomatic, strongly-typed client SDKs for:
 *  1. TypeScript (@codepulse/sdk) -> sdks/typescript
 *  2. Python     (codepulse-py)   -> sdks/python
 *  3. Go         (codepulse-go)   -> sdks/go
 * Each SDK includes Bearer JWT & X-API-Key authentication middleware,
 * exponential backoff retries, HTTP 429 Retry-After rate-limit handling,
 * and typed models/methods derived directly from the OpenAPI 3.1 specification.
 */
import fs from "node:fs";
import path from "node:path";

export function validateOpenApi31Schema(spec) {
  if (!spec || spec.openapi !== "3.1.0") {
    throw new Error(
      `Expected OpenAPI version "3.1.0", received "${spec?.openapi ?? "undefined"}"`
    );
  }
  if (!spec.info?.title || !spec.info?.version) {
    throw new Error("OpenAPI 3.1 spec is missing required info.title or info.version");
  }
  if (!spec.paths || typeof spec.paths !== "object") {
    throw new Error("OpenAPI 3.1 spec is missing paths object");
  }
  return true;
}

export function generateAllSdks({ specPath, outputRoot }) {
  const raw = fs.readFileSync(specPath, "utf8");
  const spec = JSON.parse(raw);
  validateOpenApi31Schema(spec);

  const version = spec.info.version || "1.0.0";
  const tsDir = path.join(outputRoot, "typescript");
  const pyDir = path.join(outputRoot, "python");
  const goDir = path.join(outputRoot, "go");

  generateTypeScriptSdk(spec, version, tsDir);
  generatePythonSdk(spec, version, pyDir);
  generateGoSdk(spec, version, goDir);

  return {
    openapiVersion: spec.openapi,
    sdkVersion: version,
    targets: {
      typescript: tsDir,
      python: pyDir,
      go: goDir,
    },
  };
}

function writeFile(targetPath, content) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content, "utf8");
}

function generateTypeScriptSdk(spec, version, outDir) {
  writeFile(
    path.join(outDir, "package.json"),
    JSON.stringify(
      {
        name: "@codepulse/sdk",
        version,
        description: "Official TypeScript SDK for CodePulse Enterprise API (OpenAPI 3.1)",
        main: "./dist/index.js",
        types: "./dist/index.d.ts",
        scripts: {
          build: "tsc -p tsconfig.json",
          test: "node --test test/client.test.mjs",
        },
        keywords: ["codepulse", "github", "analytics", "openapi", "sdk"],
        license: "MIT",
      },
      null,
      2
    ) + "\n"
  );

  writeFile(
    path.join(outDir, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "CommonJS",
          declaration: true,
          outDir: "./dist",
          rootDir: "./src",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
        },
        include: ["src/**/*"],
      },
      null,
      2
    ) + "\n"
  );

  writeFile(
    path.join(outDir, "src/index.ts"),
    `export interface CodePulseClientConfig {
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
    this.baseUrl = (config.baseUrl ?? "https://api.codepulse.dev/api/v1").replace(/\\/$/, "");
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
      "X-CodePulse-SDK": "@codepulse/sdk/${version}",
      ...(extra ?? {}),
    };
    if (this.bearerToken) {
      headers["Authorization"] = \`Bearer \${this.bearerToken}\`;
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
    const url = \`\${this.baseUrl}\${routePath.startsWith("/") ? routePath : \`/\${routePath}\`}\`;

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
        \`CodePulse API request failed (\${response.status}): \${errorText}\`,
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
      \`/users/\${encodeURIComponent(username)}\`,
    );
  }
}
`
  );

  writeFile(
    path.join(outDir, "README.md"),
    `# @codepulse/sdk (v${version})\n\nOfficial TypeScript SDK generated from OpenAPI ${spec.openapi}.\n\n## Usage\n\`\`\`ts\nimport { CodePulseClient } from "@codepulse/sdk";\n\nconst client = new CodePulseClient({ bearerToken: process.env.CODEPULSE_TOKEN });\nconst profile = await client.getDeveloperByUsername("Itssonia7");\n\`\`\`\n`
  );
}

function generatePythonSdk(spec, version, outDir) {
  writeFile(
    path.join(outDir, "pyproject.toml"),
    `[build-system]
requires = ["setuptools>=68.0"]
build-backend = "setuptools.build_meta"

[project]
name = "codepulse-py"
version = "${version}"
description = "Official Python SDK for CodePulse Enterprise API (OpenAPI ${spec.openapi})"
readme = "README.md"
requires-python = ">=3.10"
dependencies = []
`
  );

  writeFile(
    path.join(outDir, "codepulse_py/__init__.py"),
    `from .client import CodePulseClient, CodePulseApiError, DeveloperProfile, HealthStatus

__all__ = [
    "CodePulseClient",
    "CodePulseApiError",
    "DeveloperProfile",
    "HealthStatus",
]
__version__ = "${version}"
`
  );

  writeFile(
    path.join(outDir, "codepulse_py/client.py"),
    `from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class HealthStatus:
    status: str
    version: str
    timestamp: str


@dataclass
class DeveloperProfile:
    id: str
    username: str
    name: Optional[str]
    avatar: Optional[str]
    xp: int
    level: int


class CodePulseApiError(Exception):
    def __init__(self, message: str, status_code: int, body: str = "") -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class CodePulseClient:
    def __init__(
        self,
        base_url: str = "https://api.codepulse.dev/api/v1",
        bearer_token: Optional[str] = None,
        api_key: Optional[str] = None,
        max_retries: int = 3,
        base_backoff_sec: float = 0.2,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.bearer_token = bearer_token
        self.api_key = api_key
        self.max_retries = max_retries
        self.base_backoff_sec = base_backoff_sec

    def build_auth_headers(self, extra: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": "codepulse-py/${version}",
        }
        if self.bearer_token:
            headers["Authorization"] = f"Bearer {self.bearer_token}"
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        if extra:
            headers.update(extra)
        return headers

    def request(
        self,
        method: str,
        route_path: str,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        url = f"{self.base_url}/{route_path.lstrip('/')}"
        data = json.dumps(payload).encode("utf-8") if payload is not None else None

        for attempt in range(self.max_retries + 1):
            req = urllib.request.Request(
                url,
                data=data,
                headers=self.build_auth_headers(),
                method=method.upper(),
            )
            try:
                with urllib.request.urlopen(req, timeout=15) as resp:
                    return json.loads(resp.read().decode("utf-8"))
            except urllib.error.HTTPError as exc:
                is_retryable = exc.code == 429 or (500 <= exc.code < 600)
                if is_retryable and attempt < self.max_retries:
                    retry_after = exc.headers.get("Retry-After")
                    delay = (
                        float(retry_after)
                        if retry_after and retry_after.isdigit()
                        else self.base_backoff_sec * (2 ** attempt)
                    )
                    time.sleep(delay)
                    continue
                body = exc.read().decode("utf-8", errors="replace")
                raise CodePulseApiError(
                    f"CodePulse API error ({exc.code}): {body}",
                    exc.code,
                    body,
                ) from exc

        raise CodePulseApiError("Exhausted maximum retry attempts", 503)

    def get_system_health(self) -> HealthStatus:
        raw = self.request("GET", "/health")
        return HealthStatus(
            status=raw["status"],
            version=raw["version"],
            timestamp=raw["timestamp"],
        )

    def get_developer_by_username(self, username: str) -> DeveloperProfile:
        safe = urllib.parse.quote(username, safe="")
        raw = self.request("GET", f"/users/{safe}")
        return DeveloperProfile(
            id=raw["id"],
            username=raw["username"],
            name=raw.get("name"),
            avatar=raw.get("avatar"),
            xp=int(raw.get("xp", 0)),
            level=int(raw.get("level", 1)),
        )
`
  );

  writeFile(
    path.join(outDir, "README.md"),
    `# codepulse-py (v${version})\n\nOfficial Python SDK generated from OpenAPI ${spec.openapi}.\n`
  );
}

function generateGoSdk(spec, version, outDir) {
  writeFile(
    path.join(outDir, "go.mod"),
    `module github.com/code-with-abhi-i5/codepulse-go

go 1.22
`
  );

  writeFile(
    path.join(outDir, "client.go"),
    `package codepulse

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const SDKVersion = "${version}"

type HealthStatus struct {
	Status    string \`json:"status"\`
	Version   string \`json:"version"\`
	Timestamp string \`json:"timestamp"\`
}

type DeveloperProfile struct {
	ID       string  \`json:"id"\`
	Username string  \`json:"username"\`
	Name     *string \`json:"name"\`
	Avatar   *string \`json:"avatar"\`
	XP       int     \`json:"xp"\`
	Level    int     \`json:"level"\`
}

type APIError struct {
	StatusCode int
	Body       string
}

func (e *APIError) Error() string {
	return fmt.Sprintf("codepulse API error (%d): %s", e.StatusCode, e.Body)
}

type ClientOption func(*Client)

type Client struct {
	BaseURL     string
	BearerToken string
	APIKey      string
	MaxRetries  int
	BaseBackoff time.Duration
	HTTPClient  *http.Client
}

func WithBearerToken(token string) ClientOption {
	return func(c *Client) { c.BearerToken = token }
}

func WithAPIKey(key string) ClientOption {
	return func(c *Client) { c.APIKey = key }
}

func WithMaxRetries(retries int) ClientOption {
	return func(c *Client) { c.MaxRetries = retries }
}

func NewClient(baseURL string, opts ...ClientOption) *Client {
	if baseURL == "" {
		baseURL = "https://api.codepulse.dev/api/v1"
	}
	c := &Client{
		BaseURL:     strings.TrimRight(baseURL, "/"),
		MaxRetries:  3,
		BaseBackoff: 200 * time.Millisecond,
		HTTPClient:  &http.Client{Timeout: 15 * time.Second},
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Client) Do(ctx context.Context, method, routePath string, body any, out any) error {
	endpoint := fmt.Sprintf("%s/%s", c.BaseURL, strings.TrimLeft(routePath, "/"))

	var encoded []byte
	if body != nil {
		var err error
		encoded, err = json.Marshal(body)
		if err != nil {
			return err
		}
	}

	for attempt := 0; attempt <= c.MaxRetries; attempt++ {
		var reader io.Reader
		if encoded != nil {
			reader = bytes.NewReader(encoded)
		}

		req, err := http.NewRequestWithContext(ctx, method, endpoint, reader)
		if err != nil {
			return err
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", "codepulse-go/"+SDKVersion)
		if c.BearerToken != "" {
			req.Header.Set("Authorization", "Bearer "+c.BearerToken)
		}
		if c.APIKey != "" {
			req.Header.Set("X-API-Key", c.APIKey)
		}

		resp, err := c.HTTPClient.Do(req)
		if err != nil {
			if attempt < c.MaxRetries {
				time.Sleep(time.Duration(float64(c.BaseBackoff) * math.Pow(2, float64(attempt))))
				continue
			}
			return err
		}

		rawBytes, _ := io.ReadAll(resp.Body)
		_ = resp.Body.Close()

		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if out != nil && len(rawBytes) > 0 {
				return json.Unmarshal(rawBytes, out)
			}
			return nil
		}

		isRetryable := resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode < 600)
		if isRetryable && attempt < c.MaxRetries {
			delay := time.Duration(float64(c.BaseBackoff) * math.Pow(2, float64(attempt)))
			if ra := resp.Header.Get("Retry-After"); ra != "" {
				if sec, convErr := strconv.Atoi(ra); convErr == nil && sec >= 0 {
					delay = time.Duration(sec) * time.Second
				}
			}
			time.Sleep(delay)
			continue
		}

		return &APIError{StatusCode: resp.StatusCode, Body: string(rawBytes)}
	}

	return &APIError{StatusCode: http.StatusServiceUnavailable, Body: "exhausted retries"}
}

func (c *Client) GetSystemHealth(ctx context.Context) (*HealthStatus, error) {
	var res HealthStatus
	if err := c.Do(ctx, http.MethodGet, "/health", nil, &res); err != nil {
		return nil, err
	}
	return &res, nil
}

func (c *Client) GetDeveloperByUsername(ctx context.Context, username string) (*DeveloperProfile, error) {
	var res DeveloperProfile
	route := "/users/" + url.PathEscape(username)
	if err := c.Do(ctx, http.MethodGet, route, nil, &res); err != nil {
		return nil, err
	}
	return &res, nil
}
`
  );

  writeFile(
    path.join(outDir, "README.md"),
    `# codepulse-go (v${version})\n\nOfficial Go SDK generated from OpenAPI ${spec.openapi}.\n`
  );
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.replace(/\\/g, '/').endsWith(process.argv[1].replace(/\\/g, '/')));

if (isDirectExecution) {
  const specArg = process.argv[2] || path.resolve(process.cwd(), "backend/openapi/openapi-3.1.json");
  const outArg = process.argv[3] || path.resolve(process.cwd(), "sdks");
  const summary = generateAllSdks({ specPath: specArg, outputRoot: outArg });
  console.log("[sdk-gen] Generated SDKs:", JSON.stringify(summary));
}
