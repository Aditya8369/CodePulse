"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Eye,
  EyeOff,
  AlertTriangle,
  Lock,
  Layers,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface ApiKeyScope {
  id: string;
  name: string;
  description: string;
  category: "Battles" | "Challenges" | "Profile" | "Webhooks" | "Telemetry";
}

export const AVAILABLE_SCOPES: ApiKeyScope[] = [
  { id: "battles:read", name: "Read Battles", description: "View live battle rooms and matchmaking state", category: "Battles" },
  { id: "battles:write", name: "Submit Battle Code", description: "Submit algorithmic code executions and power-ups", category: "Battles" },
  { id: "challenges:read", name: "Read Challenges", description: "Inspect daily problems and tests", category: "Challenges" },
  { id: "challenges:write", name: "Submit Challenges", description: "Submit challenge solutions", category: "Challenges" },
  { id: "profile:read", name: "Read Profile & ELO", description: "Access user profile, rating, and badges", category: "Profile" },
  { id: "webhooks:manage", name: "Manage Webhooks", description: "Register and rotate webhook signing secrets", category: "Webhooks" },
  { id: "telemetry:stream", name: "Stream Telemetry", description: "Stream real-time WebGL audio/reaction events", category: "Telemetry" },
];

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

const DEFAULT_KEYS: ApiKeyItem[] = [
  {
    id: "key_prod_1",
    name: "CI/CD Pipeline Runner",
    prefix: "cp_live_9f82...3e1a",
    scopes: ["battles:read", "battles:write", "challenges:read"],
    createdAt: "2026-11-15",
    lastUsedAt: "10 mins ago",
    expiresAt: "In 90 days",
  },
  {
    id: "key_cli_2",
    name: "Local Development CLI Token",
    prefix: "cp_live_41a0...88dc",
    scopes: ["profile:read", "telemetry:stream"],
    createdAt: "2026-11-18",
    lastUsedAt: "Yesterday",
    expiresAt: "Never",
  },
];

export interface ApiKeysPanelProps {
  initialKeys?: ApiKeyItem[];
  onKeyCreated?: (key: ApiKeyItem) => void;
  onKeyRevoked?: (keyId: string) => void;
  className?: string;
}

export function ApiKeysPanel({
  initialKeys = DEFAULT_KEYS,
  onKeyCreated,
  onKeyRevoked,
  className,
}: ApiKeysPanelProps) {
  const [keys, setKeys] = useState<ApiKeyItem[]>(initialKeys);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [expiration, setExpiration] = useState("90_DAYS");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "battles:read",
    "profile:read",
  ]);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Secret newly generated key banner
  const [revealedKeySecret, setRevealedKeySecret] = useState<string | null>(null);

  const toggleScope = (scopeId: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) {
      toast.error("Please enter a name for the API key.");
      return;
    }

    if (selectedScopes.length === 0) {
      toast.error("Please select at least one permission scope.");
      return;
    }

    const randomSecret = `cp_live_${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;
    const maskedPrefix = `${randomSecret.slice(0, 11)}...${randomSecret.slice(-4)}`;

    const newKey: ApiKeyItem = {
      id: `key_${Date.now()}`,
      name: keyName,
      prefix: maskedPrefix,
      scopes: [...selectedScopes],
      createdAt: new Date().toISOString().split("T")[0],
      lastUsedAt: "Never",
      expiresAt: expiration === "NEVER" ? "Never" : "In 90 days",
    };

    setKeys((prev) => [newKey, ...prev]);
    setRevealedKeySecret(randomSecret);
    setIsDrawerOpen(false);
    setKeyName("");
    onKeyCreated?.(newKey);
    toast.success(`API Key "${newKey.name}" generated successfully!`);
  };

  const handleRevoke = (keyId: string, name: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== keyId));
    onKeyRevoked?.(keyId);
    toast.success(`API Key "${name}" was revoked!`);
  };

  const handleCopyPrefix = (prefix: string, keyId: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(prefix);
    }
    setCopiedKeyId(keyId);
    toast.success("API Key prefix copied to clipboard!");
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  return (
    <div
      data-testid="api-keys-panel-container"
      className={cn("glass-card rounded-[20px] p-6 space-y-6 text-slate-100", className)}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              Developer API Keys
            </h3>
            <span
              data-testid="api-keys-count-badge"
              className="px-2 py-0.5 rounded-full bg-white/[0.06] text-xs font-mono text-slate-300 border border-white/10"
            >
              {keys.length} Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Authenticate CodePulse CLI tools, external microservices, and battle automation webhooks.
          </p>
        </div>

        <button
          type="button"
          data-testid="open-generate-key-drawer-btn"
          onClick={() => setIsDrawerOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Generate New API Key</span>
        </button>
      </div>

      {/* Secret Reveal Banner (Shown only once upon generation) */}
      {revealedKeySecret && (
        <div
          data-testid="new-secret-reveal-banner"
          className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/40 text-amber-300 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs flex items-center gap-1.5 font-mono">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Copy your Secret Key Now! It will NOT be shown again.
            </span>
            <button
              type="button"
              onClick={() => setRevealedKeySecret(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-black/60 border border-white/10">
            <code className="text-xs font-mono font-bold text-emerald-400 flex-1 truncate select-all">
              {revealedKeySecret}
            </code>
            <button
              type="button"
              data-testid="copy-revealed-secret-btn"
              onClick={() => {
                if (navigator?.clipboard) navigator.clipboard.writeText(revealedKeySecret);
                toast.success("Secret API Key copied to clipboard!");
              }}
              className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold font-mono transition-colors cursor-pointer flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>
        </div>
      )}

      {/* Active Keys List */}
      <div data-testid="api-keys-list" className="space-y-3">
        {keys.map((apiKey) => (
          <div
            key={apiKey.id}
            data-testid={`api-key-item-${apiKey.id}`}
            className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-white">{apiKey.name}</span>
                <span className="text-[11px] font-mono text-slate-400 bg-white/[0.03] px-2 py-0.5 rounded border border-white/5">
                  {apiKey.prefix}
                </span>
                <button
                  type="button"
                  data-testid={`copy-key-btn-${apiKey.id}`}
                  onClick={() => handleCopyPrefix(apiKey.prefix, apiKey.id)}
                  className="hover:text-white text-slate-400 transition-colors p-1"
                  title="Copy Key Prefix"
                >
                  {copiedKeyId === apiKey.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Scopes Badges */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {apiKey.scopes.map((scope) => (
                  <span
                    key={scope}
                    className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-mono font-medium border border-indigo-500/20"
                  >
                    {scope}
                  </span>
                ))}
              </div>

              <div className="text-[11px] font-mono text-slate-400 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Created: {apiKey.createdAt}</span>
                <span>•</span>
                <span>Last used: {apiKey.lastUsedAt}</span>
                <span>•</span>
                <span>Expires: {apiKey.expiresAt}</span>
              </div>
            </div>

            {/* Revoke Action */}
            <button
              type="button"
              data-testid={`revoke-key-btn-${apiKey.id}`}
              onClick={() => handleRevoke(apiKey.id, apiKey.name)}
              className="px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 self-start md:self-auto shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Revoke</span>
            </button>
          </div>
        ))}
      </div>

      {/* Generator & Scoped Permissions Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <div
            data-testid="generate-key-drawer-wrapper"
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
          >
            <div className="absolute inset-0" onClick={() => setIsDrawerOpen(false)} />

            <motion.div
              data-testid="generate-key-drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="relative z-10 w-full max-w-md h-full bg-[#0B0F19] border-l border-white/10 text-white p-6 shadow-2xl flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                      <Key className="w-4 h-4" />
                    </span>
                    <div>
                      <h3 className="text-base font-black text-white">Generate Scoped API Key</h3>
                      <p className="text-[11px] font-mono text-slate-400">
                        Granular least-privilege role scopes
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleGenerateKey} className="mt-5 space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Key Name / Token Identifier
                    </label>
                    <input
                      type="text"
                      data-testid="api-key-name-input"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      placeholder="e.g. GitHub Actions Webhook Bot"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Expiration Period
                    </label>
                    <select
                      value={expiration}
                      onChange={(e) => setExpiration(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#0B0F19] border border-white/10 text-slate-300 outline-none font-mono cursor-pointer"
                    >
                      <option value="30_DAYS">30 Days</option>
                      <option value="90_DAYS">90 Days (Recommended)</option>
                      <option value="1_YEAR">1 Year</option>
                      <option value="NEVER">No Expiration</option>
                    </select>
                  </div>

                  {/* Scopes Checkbox Matrix */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Permissions Matrix ({selectedScopes.length} selected)</span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {AVAILABLE_SCOPES.map((scope) => {
                        const isChecked = selectedScopes.includes(scope.id);

                        return (
                          <label
                            key={scope.id}
                            className={cn(
                              "p-2.5 rounded-xl border flex items-start gap-2.5 text-xs transition-colors cursor-pointer",
                              isChecked
                                ? "bg-indigo-950/20 border-indigo-500/40 text-white"
                                : "bg-white/[0.02] border-white/5 text-slate-400 hover:text-slate-200"
                            )}
                          >
                            <input
                              type="checkbox"
                              data-testid={`scope-checkbox-${scope.id}`}
                              checked={isChecked}
                              onChange={() => toggleScope(scope.id)}
                              className="accent-indigo-500 mt-0.5 cursor-pointer"
                            />
                            <div>
                              <div className="font-mono font-bold text-slate-200">{scope.id}</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">{scope.description}</div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="submit"
                    data-testid="submit-generate-key-btn"
                    className="w-full mt-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-indigo-600/25 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Key className="w-3.5 h-3.5" />
                    <span>Create Secret Key</span>
                  </button>
                </form>
              </div>

              <div className="pt-4 border-t border-white/10 text-[10px] font-mono text-slate-500 flex items-center justify-between">
                <span>SHA-256 HMAC Encrypted</span>
                <span>Role Scoped</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
