#!/usr/bin/env bash
# Automated PostgreSQL Backup & S3 Encryption Script for CodePulse
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/tmp/backups}"
TIMESTAMP="$(date +'%Y-%m-%d-%H%M%S')"
BACKUP_FILENAME="codepulse-postgres-${TIMESTAMP}.sql.gz.gpg"
S3_BUCKET="${BACKUP_S3_BUCKET:-s3://codepulse-backups/postgres}"

mkdir -p "${BACKUP_DIR}"

echo "Starting automated database backup for CodePulse..."
# 1. Execute compressed database dump
pg_dump "${DATABASE_URL}" | gzip -c > "${BACKUP_DIR}/dump.sql.gz"

# 2. Encrypt with GPG symmetric key
gpg --batch --yes --passphrase "${BACKUP_ENCRYPTION_KEY:-secret}" -c -o "${BACKUP_DIR}/${BACKUP_FILENAME}" "${BACKUP_DIR}/dump.sql.gz"

# 3. Stream to S3-compatible cloud storage
if command -v aws &> /dev/null; then
  aws s3 cp "${BACKUP_DIR}/${BACKUP_FILENAME}" "${S3_BUCKET}/${BACKUP_FILENAME}"
  echo "Snapshot successfully mirrored to ${S3_BUCKET}/${BACKUP_FILENAME}"
fi

# 4. Clean local temporary files
rm -f "${BACKUP_DIR}/dump.sql.gz" "${BACKUP_DIR}/${BACKUP_FILENAME}"
echo "Backup pipeline completed successfully."
