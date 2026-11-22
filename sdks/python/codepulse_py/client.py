from __future__ import annotations

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
            "User-Agent": "codepulse-py/1.0.0",
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
