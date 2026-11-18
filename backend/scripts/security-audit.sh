#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# CodePulse Backend Container Security Audit Script (Trivy)
# Builds the backend Docker image and scans OS + library dependencies for CVEs.
# Falls back to the official aquasec/trivy Docker image if Trivy is not installed.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

IMAGE_TAG="codepulse-backend:local-audit"
DOCKERFILE_PATH="${BACKEND_DIR}/Dockerfile"
BUILD_CONTEXT="${BACKEND_DIR}"
SEVERITY="CRITICAL"
IGNORE_UNFIXED="true"
OUTPUT_FORMAT="table"
OUTPUT_FILE=""
NO_BUILD="false"
KEEP_IMAGE="false"
TRIVY_CACHE_DIR="${HOME}/.cache/trivy"

usage() {
  cat <<USAGE
Usage: $(basename "$0") [OPTIONS]

Pre-commit and local container vulnerability audit powered by Aqua Trivy.

Options:
  --image <tag>          Docker image tag to build/scan (default: ${IMAGE_TAG})
  --dockerfile <path>    Path to Dockerfile (default: ${DOCKERFILE_PATH})
  --context <path>       Docker build context (default: ${BUILD_CONTEXT})
  --severity <levels>    Comma-separated severities (default: ${SEVERITY})
  --include-unfixed      Report vulnerabilities without a vendor fix
  --format <fmt>         Output format: table | json | sarif (default: ${OUTPUT_FORMAT})
  --output <file>        Write scan report to file instead of stdout
  --no-build             Skip docker build and scan an existing local image
  --keep-image           Keep the locally built audit image after scanning
  -h, --help             Show this help message
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --dockerfile)
      DOCKERFILE_PATH="$2"
      shift 2
      ;;
    --context)
      BUILD_CONTEXT="$2"
      shift 2
      ;;
    --severity)
      SEVERITY="$2"
      shift 2
      ;;
    --include-unfixed)
      IGNORE_UNFIXED="false"
      shift
      ;;
    --format)
      OUTPUT_FORMAT="$2"
      shift 2
      ;;
    --output)
      OUTPUT_FILE="$2"
      shift 2
      ;;
    --no-build)
      NO_BUILD="true"
      shift
      ;;
    --keep-image)
      KEEP_IMAGE="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "❌ Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker is required to build/scan container images but was not found in PATH." >&2
  exit 1
fi

cleanup() {
  if [[ "${NO_BUILD}" == "false" && "${KEEP_IMAGE}" == "false" ]]; then
    docker image rm -f "${IMAGE_TAG}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "${NO_BUILD}" == "false" ]]; then
  if [[ ! -f "${DOCKERFILE_PATH}" ]]; then
    echo "❌ Dockerfile not found at: ${DOCKERFILE_PATH}" >&2
    exit 1
  fi
  echo "🏗️  Building container image '${IMAGE_TAG}' from ${DOCKERFILE_PATH}..."
  docker build -f "${DOCKERFILE_PATH}" -t "${IMAGE_TAG}" "${BUILD_CONTEXT}"
fi

TRIVY_ARGS=(
  image
  --scanners vuln
  --pkg-types os,library
  --severity "${SEVERITY}"
  --format "${OUTPUT_FORMAT}"
  --exit-code 1
)

if [[ "${IGNORE_UNFIXED}" == "true" ]]; then
  TRIVY_ARGS+=(--ignore-unfixed)
fi

TRIVY_ARGS+=("${IMAGE_TAG}")

echo "🔍 Scanning '${IMAGE_TAG}' (severity=${SEVERITY}, ignore-unfixed=${IGNORE_UNFIXED})..."

run_trivy() {
  if command -v trivy >/dev/null 2>&1; then
    trivy "${TRIVY_ARGS[@]}"
  else
    mkdir -p "${TRIVY_CACHE_DIR}"
    docker run --rm \
      -v /var/run/docker.sock:/var/run/docker.sock \
      -v "${TRIVY_CACHE_DIR}:/root/.cache/" \
      aquasec/trivy:latest "${TRIVY_ARGS[@]}"
  fi
}

set +e
if [[ -n "${OUTPUT_FILE}" ]]; then
  mkdir -p "$(dirname "${OUTPUT_FILE}")"
  run_trivy > "${OUTPUT_FILE}"
  SCAN_EXIT=$?
else
  run_trivy
  SCAN_EXIT=$?
fi
set -e

if [[ ${SCAN_EXIT} -eq 0 ]]; then
  echo "✅ Container security audit passed: no actionable ${SEVERITY} vulnerabilities detected."
else
  echo "❌ Container security audit failed: actionable ${SEVERITY} vulnerabilities detected." >&2
fi

exit "${SCAN_EXIT}"
