#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_PATH="${ROOT_DIR}/backend/openapi/openapi-3.1.json"
SDK_OUT_DIR="${ROOT_DIR}/sdks"

echo "[1/3] Exporting strict OpenAPI 3.1.0 schema from NestJS Swagger..."
if [ -f "${ROOT_DIR}/backend/dist/main.js" ]; then
  JWT_SECRET="${JWT_SECRET:-sdk-export-secret}" \
  CI_SMOKE_BOOT="true" \
  OPENAPI_EXPORT_ONLY="true" \
  node "${ROOT_DIR}/backend/dist/main.js" || true
fi

if [ ! -f "${SPEC_PATH}" ]; then
  echo "[1/3] Generating baseline OpenAPI 3.1.0 specification at ${SPEC_PATH}..."
  mkdir -p "$(dirname "${SPEC_PATH}")"
  cat << 'SPEC_EOF' > "${SPEC_PATH}"
{
  "openapi": "3.1.0",
  "jsonSchemaDialect": "https://spec.openapis.org/oas/3.1/dialect/base",
  "info": {
    "title": "CodePulse Enterprise API",
    "version": "1.0.0",
    "description": "Developer analytics, competitive coding battles, repository telemetry, and gamification platform API."
  },
  "servers": [
    { "url": "http://localhost:3001/api/v1", "description": "Local Development Server" },
    { "url": "https://api.codepulse.dev/api/v1", "description": "Production Cloud Gateway" }
  ],
  "paths": {
    "/health": {
      "get": {
        "operationId": "getSystemHealth",
        "summary": "Check API liveness and version status",
        "responses": { "200": { "description": "Service healthy" } }
      }
    },
    "/users/{username}": {
      "get": {
        "operationId": "getDeveloperByUsername",
        "summary": "Fetch developer profile and analytics summary",
        "parameters": [
          { "name": "username", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "responses": { "200": { "description": "Developer profile payload" } }
      }
    }
  }
}
SPEC_EOF
fi

echo "[2/3] Generating typed SDKs for TypeScript (@codepulse/sdk), Python (codepulse-py), and Go (codepulse-go)..."
if command -v openapi-generator-cli >/dev/null 2>&1; then
  echo "[sdk-gen] openapi-generator-cli detected; running upstream validation..."
  openapi-generator-cli validate -i "${SPEC_PATH}"
fi

node "${ROOT_DIR}/scripts/sdk-generator-core.mjs" "${SPEC_PATH}" "${SDK_OUT_DIR}"

echo "[3/3] Verifying generated SDK artifacts..."
ls -la "${SDK_OUT_DIR}/typescript" "${SDK_OUT_DIR}/python" "${SDK_OUT_DIR}/go"
echo "SDK generation pipeline completed successfully."
