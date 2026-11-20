# ==============================================================================
# CodePulse HashiCorp Vault Policy (Least Privilege Security Specification)
# ==============================================================================

# 1. AppRole Authentication & Token Renewal
path "auth/approle/login" {
  capabilities = ["create", "read"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}

path "auth/token/lookup-self" {
  capabilities = ["read"]
}

# 2. Dynamic PostgreSQL Database Credentials
path "database/creds/codepulse-app" {
  capabilities = ["read"]
}

path "database/creds/codepulse-app/*" {
  capabilities = ["read"]
}

# 3. Dynamic Redis Credentials
path "redis/creds/codepulse-redis" {
  capabilities = ["read"]
}

path "redis/creds/codepulse-redis/*" {
  capabilities = ["read"]
}

# 4. KV v2 Engine Secrets: JWT Signing Keys
path "secret/data/codepulse/jwt" {
  capabilities = ["read", "create", "update"]
}

path "secret/metadata/codepulse/jwt" {
  capabilities = ["read", "list"]
}

# 5. KV v2 Engine Secrets: Third-Party API Tokens (GitHub, Resend, S3)
path "secret/data/codepulse/third-party" {
  capabilities = ["read", "create", "update"]
}

path "secret/metadata/codepulse/third-party" {
  capabilities = ["read", "list"]
}

# 6. General CodePulse App Data Path
path "secret/data/codepulse/*" {
  capabilities = ["read", "create", "update", "list"]
}

path "secret/metadata/codepulse/*" {
  capabilities = ["read", "list"]
}

# 7. Lease Management (Lease Renewals and Revocations)
path "sys/leases/renew" {
  capabilities = ["update"]
}

path "sys/leases/revoke" {
  capabilities = ["update"]
}

path "sys/leases/lookup/*" {
  capabilities = ["read", "update"]
}

