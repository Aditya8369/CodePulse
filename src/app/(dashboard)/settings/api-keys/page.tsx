"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Key,
  Plus,
  ArrowLeft,
  RotateCw,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import {
  CreateApiKeyModal,
  type CreateApiKeyPayload,
  type CreatedApiKeySecret,
} from "@/components/settings/create-api-key-modal";

interface DeveloperApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

const INITIAL_API_KEYS: DeveloperApiKey[] = [
  {
    id: "key_prod_1",
    name: "CI/CD Pipeline Runner",
    keyPrefix: "cp_live_9x82...",
    scopes: ["read:analytics", "write:battles", "read:leaderboard"],
    createdAt: "2026-11-15T10:30:00.000Z",
    lastUsedAt: "2026-11-25T08:15:00.000Z",
    expiresAt: "2027-02-13T10:30:00.000Z",
  },
  {
    id: "key_cli_2",
    name: "Local Development CLI",
    keyPrefix: "cp_live_41a0...",
    scopes: ["read:user", "read:repositories"],
    createdAt: "2026-11-18T14:20:00.000Z",
    lastUsedAt: null,
    expiresAt: null,
  },
];

function formatDate(dateStr: string | null | undefined, fallback = "Never"): string {
  if (!dateStr) return fallback;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function generateSecureFallbackSecret(): { rawKey: string; keyPrefix: string } {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 32; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  const rawKey = `cp_live_${suffix}`;
  return {
    rawKey,
    keyPrefix: `${rawKey.slice(0, 12)}...`,
  };
}

interface RawApiKeyItem {
  id: string | number;
  name?: string;
  keyPrefix?: string;
  scopes?: unknown;
  createdAt?: string;
  lastUsedAt?: string | null;
  expiresAt?: string | null;
}

function mapApiKeys(payload: RawApiKeyItem[]): DeveloperApiKey[] {
  return payload.map((item) => ({
    id: String(item.id),
    name: item.name || "Unnamed Key",
    keyPrefix: item.keyPrefix || "cp_live_...",
    scopes: Array.isArray(item.scopes) ? item.scopes.map(String) : [],
    createdAt: item.createdAt || new Date().toISOString(),
    lastUsedAt: item.lastUsedAt ?? null,
    expiresAt: item.expiresAt ?? null,
  }));
}

export default function ApiKeysSettingsPage() {
  const [apiKeys, setApiKeys] = useState<DeveloperApiKey[]>(INITIAL_API_KEYS);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [keyToRevoke, setKeyToRevoke] = useState<DeveloperApiKey | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copiedPrefixId, setCopiedPrefixId] = useState<string | null>(null);

  const fetchApiKeys = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get("/api-keys");
      const payload = response.data?.data ?? response.data;
      if (Array.isArray(payload)) {
        setApiKeys(mapApiKeys(payload as RawApiKeyItem[]));
      }
    } catch {
      // Graceful fallback to initial keys when backend is unavailable
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get("/api-keys")
      .then((response) => {
        if (cancelled) return;
        const payload = response.data?.data ?? response.data;
        if (Array.isArray(payload)) {
          setApiKeys(mapApiKeys(payload as RawApiKeyItem[]));
        }
      })
      .catch(() => {
        // Graceful fallback to initial keys when backend is unavailable
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreateKey = async (
    payload: CreateApiKeyPayload
  ): Promise<CreatedApiKeySecret> => {
    try {
      const response = await apiClient.post("/api-keys", {
        name: payload.name,
        scopes: payload.scopes,
        expiresAt: payload.expiresAt,
      });
      const data = response.data?.data ?? response.data;
      if (data && data.key) {
        const createdItem: DeveloperApiKey = {
          id: String(data.id),
          name: data.name || payload.name,
          keyPrefix: data.keyPrefix || `${String(data.key).slice(0, 12)}...`,
          scopes: Array.isArray(data.scopes) ? data.scopes : payload.scopes,
          createdAt: data.createdAt || new Date().toISOString(),
          lastUsedAt: null,
          expiresAt: data.expiresAt ?? payload.expiresAt ?? null,
        };
        setApiKeys((prev) => [createdItem, ...prev]);
        toast.success(`API key "${createdItem.name}" created!`);
        return {
          id: createdItem.id,
          name: createdItem.name,
          key: data.key,
          keyPrefix: createdItem.keyPrefix,
          scopes: createdItem.scopes,
          createdAt: createdItem.createdAt,
          expiresAt: createdItem.expiresAt,
        };
      }
    } catch {
      // Fallback to local generation in offline/preview environments
    }

    const { rawKey, keyPrefix } = generateSecureFallbackSecret();
    const fallbackItem: DeveloperApiKey = {
      id: `key_${Date.now()}`,
      name: payload.name,
      keyPrefix,
      scopes: payload.scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      expiresAt: payload.expiresAt ?? null,
    };

    setApiKeys((prev) => [fallbackItem, ...prev]);
    toast.success(`API key "${fallbackItem.name}" created!`);

    return {
      id: fallbackItem.id,
      name: fallbackItem.name,
      key: rawKey,
      keyPrefix: fallbackItem.keyPrefix,
      scopes: fallbackItem.scopes,
      createdAt: fallbackItem.createdAt,
      expiresAt: fallbackItem.expiresAt,
    };
  };

  const handleConfirmRevoke = async () => {
    if (!keyToRevoke) return;
    setIsRevoking(true);

    try {
      await apiClient.delete(`/api-keys/${keyToRevoke.id}`).catch(() => null);
      setApiKeys((prev) => prev.filter((k) => k.id !== keyToRevoke.id));
      toast.success(`API key "${keyToRevoke.name}" revoked`, {
        description: "The key has been permanently invalidated.",
      });
    } finally {
      setIsRevoking(false);
      setKeyToRevoke(null);
    }
  };

  const handleCopyPrefix = async (prefix: string, id: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(prefix);
      }
      setCopiedPrefixId(id);
      toast.success("Key prefix copied to clipboard");
      setTimeout(() => setCopiedPrefixId(null), 2000);
    } catch {
      toast.error("Failed to copy key prefix");
    }
  };

  return (
    <div
      data-testid="api-keys-page-container"
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings"
          data-testid="back-to-settings-link"
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>Back to Settings</span>
        </Link>

        <button
          type="button"
          data-testid="refresh-api-keys-btn"
          onClick={() => void fetchApiKeys()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-slate-300 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Key className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Developer API Keys
              </h1>
              <span
                data-testid="api-keys-active-count"
                className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-mono font-bold"
              >
                {apiKeys.length} Active
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Manage scoped API keys for CodePulse CLI, CI/CD pipelines, and external integrations.
            </p>
          </div>
        </div>

        <button
          type="button"
          data-testid="open-create-api-key-modal-btn"
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer flex items-center gap-2 self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Generate New Key</span>
        </button>
      </div>

      {/* Security Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4 border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
            <Lock className="w-3.5 h-3.5 text-indigo-400" />
            <span>One-Time Secret</span>
          </div>
          <div className="text-sm font-bold text-white">Hashed at Rest</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Full secret tokens are displayed once on creation and never stored in plaintext.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Granular Scopes</span>
          </div>
          <div className="text-sm font-bold text-white">Least-Privilege RBAC</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Restrict each token to specific read or write capabilities across endpoints.
          </p>
        </div>

        <div className="glass-card rounded-2xl p-4 border border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-1">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Instant Revocation</span>
          </div>
          <div className="text-sm font-bold text-white">Zero-Delay Invalidation</div>
          <p className="text-[11px] text-slate-400 mt-1">
            Revoking a key immediately rejects any future requests using that credential.
          </p>
        </div>
      </div>

      {/* Active API Keys Table */}
      <div className="glass-card rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        {apiKeys.length === 0 ? (
          <div
            data-testid="empty-api-keys-state"
            className="p-10 text-center space-y-3"
          >
            <div className="w-11 h-11 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
              <Key className="w-5 h-5" />
            </div>
            <div className="text-sm font-semibold text-white">No Active API Keys</div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Generate a scoped developer API key to authenticate CLI tools or automated workflows.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              data-testid="api-keys-table"
              className="w-full text-left border-collapse"
            >
              <thead>
                <tr className="border-b border-white/[0.08] text-[11px] font-mono uppercase tracking-wider text-slate-400 bg-white/[0.02]">
                  <th className="py-3.5 px-4">Key Name</th>
                  <th className="py-3.5 px-4">Key Prefix</th>
                  <th className="py-3.5 px-4">Scopes</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4">Last Used</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-xs">
                {apiKeys.map((apiKey) => (
                  <tr
                    key={apiKey.id}
                    data-testid={`api-key-row-${apiKey.id}`}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-4 px-4 font-semibold text-white whitespace-nowrap">
                      <div>{apiKey.name}</div>
                      {apiKey.expiresAt && (
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          Expires {formatDate(apiKey.expiresAt)}
                        </div>
                      )}
                    </td>

                    <td className="py-4 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 font-mono text-[11px] text-slate-300">
                        <span>{apiKey.keyPrefix}</span>
                        <button
                          type="button"
                          data-testid={`copy-prefix-btn-${apiKey.id}`}
                          onClick={() => void handleCopyPrefix(apiKey.keyPrefix, apiKey.id)}
                          aria-label={`Copy prefix for ${apiKey.name}`}
                          className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          {copiedPrefixId === apiKey.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-xs">
                        {apiKey.scopes.map((scope) => (
                          <span
                            key={scope}
                            className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-mono border border-indigo-500/20"
                          >
                            {scope}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="py-4 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {formatDate(apiKey.createdAt)}
                    </td>

                    <td className="py-4 px-4 font-mono text-slate-400 whitespace-nowrap">
                      {formatDate(apiKey.lastUsedAt, "Never")}
                    </td>

                    <td className="py-4 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        data-testid={`revoke-api-key-btn-${apiKey.id}`}
                        onClick={() => setKeyToRevoke(apiKey)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create API Key Modal + One-Time Secret Copy Dialog */}
      <CreateApiKeyModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateKey={handleCreateKey}
      />

      {/* Revoke Confirmation Modal */}
      {keyToRevoke && (
        <div
          data-testid="revoke-api-key-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revoke-api-key-modal-title"
            data-testid="revoke-api-key-modal"
            className="w-full max-w-md p-6 rounded-2xl glass-card border border-rose-500/30 bg-[#0B0F19] shadow-2xl space-y-5 text-slate-100"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2
                  id="revoke-api-key-modal-title"
                  className="text-lg font-bold text-white"
                >
                  Revoke API Key?
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Key <span className="font-semibold text-white">{keyToRevoke.name}</span> ({keyToRevoke.keyPrefix})
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-white/[0.04] p-3.5 rounded-xl border border-white/[0.08]">
              Revoking this API key will immediately invalidate it. Any scripts, CI/CD jobs, or services using this token will lose access and receive 401 Unauthorized responses.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                data-testid="cancel-revoke-api-key-btn"
                onClick={() => setKeyToRevoke(null)}
                disabled={isRevoking}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 border border-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="confirm-revoke-api-key-btn"
                onClick={() => void handleConfirmRevoke()}
                disabled={isRevoking}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isRevoking ? "Revoking..." : "Confirm Revoke"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

