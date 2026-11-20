#!/usr/bin/env bash
# ==============================================================================
# CodePulse Mutual TLS (mTLS) PKI Certificate Lifecycle Generator
# Generates an internal Root CA, Backend Server X.509 certificate, and
# Runner/Microservice Client X.509 certificates with SANs and OU=CodePulseRunner.
# ==============================================================================
set -euo pipefail

CERT_DIR="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/generated}"
CA_DAYS="${MTLS_CA_DAYS:-1825}"
LEAF_DAYS="${MTLS_LEAF_DAYS:-365}"
KEY_BITS="${MTLS_KEY_BITS:-2048}"

mkdir -p "${CERT_DIR}"
chmod 700 "${CERT_DIR}"

echo "[mTLS PKI] Generating certificates in: ${CERT_DIR}"

# 1. Internal Root CA (ECDSA P-256 or RSA-2048)
if [[ ! -f "${CERT_DIR}/ca.key" || ! -f "${CERT_DIR}/ca.crt" ]]; then
  openssl genrsa -out "${CERT_DIR}/ca.key" "${KEY_BITS}" 2>/dev/null
  chmod 600 "${CERT_DIR}/ca.key"

  openssl req -x509 -new -nodes \
    -key "${CERT_DIR}/ca.key" \
    -sha256 \
    -days "${CA_DAYS}" \
    -subj "/C=US/ST=California/O=CodePulse Security/OU=CodePulseInternalCA/CN=CodePulse-Mesh-Root-CA" \
    -addext "basicConstraints=critical,CA:TRUE,pathlen:0" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -out "${CERT_DIR}/ca.crt"
  echo "[mTLS PKI] Created Root CA: ${CERT_DIR}/ca.crt"
else
  echo "[mTLS PKI] Reusing existing Root CA: ${CERT_DIR}/ca.crt"
fi

# 2. NestJS Backend Internal Mesh Server Certificate
cat > "${CERT_DIR}/server.ext" << 'EXT'
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth,clientAuth
subjectAltName=DNS:localhost,DNS:codepulse-backend,DNS:backend.codepulse.internal,IP:127.0.0.1
EXT

openssl genrsa -out "${CERT_DIR}/server.key" "${KEY_BITS}" 2>/dev/null
chmod 600 "${CERT_DIR}/server.key"

openssl req -new \
  -key "${CERT_DIR}/server.key" \
  -subj "/C=US/ST=California/O=CodePulse Security/OU=CodePulseBackend/CN=backend.codepulse.internal" \
  -out "${CERT_DIR}/server.csr"

openssl x509 -req \
  -in "${CERT_DIR}/server.csr" \
  -CA "${CERT_DIR}/ca.crt" \
  -CAkey "${CERT_DIR}/ca.key" \
  -CAcreateserial \
  -out "${CERT_DIR}/server.crt" \
  -days "${LEAF_DAYS}" \
  -sha256 \
  -extfile "${CERT_DIR}/server.ext" 2>/dev/null

rm -f "${CERT_DIR}/server.csr" "${CERT_DIR}/server.ext"
echo "[mTLS PKI] Created Server Cert: ${CERT_DIR}/server.crt"

# 3. Sandbox Runner & Microservice Client Certificate (OU=CodePulseRunner)
cat > "${CERT_DIR}/runner-client.ext" << 'EXT'
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=clientAuth
subjectAltName=DNS:runner.codepulse.internal,DNS:codepulse-runner,URI:spiffe://codepulse.internal/ns/runners/sa/sandbox-runner,IP:127.0.0.1
EXT

openssl genrsa -out "${CERT_DIR}/runner-client.key" "${KEY_BITS}" 2>/dev/null
chmod 600 "${CERT_DIR}/runner-client.key"

openssl req -new \
  -key "${CERT_DIR}/runner-client.key" \
  -subj "/C=US/ST=California/O=CodePulse Security/OU=CodePulseRunner/CN=runner.codepulse.internal" \
  -out "${CERT_DIR}/runner-client.csr"

openssl x509 -req \
  -in "${CERT_DIR}/runner-client.csr" \
  -CA "${CERT_DIR}/ca.crt" \
  -CAkey "${CERT_DIR}/ca.key" \
  -CAcreateserial \
  -out "${CERT_DIR}/runner-client.crt" \
  -days "${LEAF_DAYS}" \
  -sha256 \
  -extfile "${CERT_DIR}/runner-client.ext" 2>/dev/null

rm -f "${CERT_DIR}/runner-client.csr" "${CERT_DIR}/runner-client.ext" "${CERT_DIR}/ca.srl"
echo "[mTLS PKI] Created Runner Client Cert (OU=CodePulseRunner): ${CERT_DIR}/runner-client.crt"

# Verify generated chains against Root CA
openssl verify -CAfile "${CERT_DIR}/ca.crt" "${CERT_DIR}/server.crt"
openssl verify -CAfile "${CERT_DIR}/ca.crt" "${CERT_DIR}/runner-client.crt"
echo "[mTLS PKI] All mutual TLS certificates verified successfully."
