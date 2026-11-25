"use client";

import React, { useState } from "react";
import {
  Key,
  X,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface DeveloperApiKeyScope {
  id: string;
  label: string;
  description: string;
}

export const DEVELOPER_API_KEY_SCOPES: DeveloperApiKeyScope[] = [
  {
    id: "read:analytics",
    label: "read:analytics",
    description: "Read developer analytics, commit metrics, and language breakdowns",
  },
  {
    id: "write:battles",
    label: "write:battles",
    description: "Create, join, and submit solutions to coding battles",
  },
  {
    id: "read:leaderboard",
    label: "read:leaderboard",
    description: "Query global and regional developer leaderboards",
  },
  {
    id: "read:user",
    label: "read:user",
    description: "Access profile details, ELO rating, and achievement badges",
  },
  {
    id: "write:user",
    label: "write:user",
    description: "Update developer profile preferences and metadata",
  },
  {
    id: "read:repositories",
    label: "read:repositories",
    description: "Read synced repository scores and audit summaries",
  },
  {
    id: "write:repositories",
    label: "write:repositories",
    description: "Trigger repository syncs and webhook updates",
  },
  {
    id: "admin:sync",
    label: "admin:sync",
    description: "Run administrative synchronization and cache invalidation jobs",
  },
];

export type ExpirationOption = "30_DAYS" | "90_DAYS" | "1_YEAR" | "NEVER";

export interface CreateApiKeyPayload {
  name: string;
  scopes: string[];
  expiresAt?: string;
  expirationLabel: string;
}

export interface CreatedApiKeySecret {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
}

export interface CreateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateKey: (payload: CreateApiKeyPayload) => Promise<CreatedApiKeySecret>;
}

const EXPIRATION_OPTIONS: { value: ExpirationOption; label: string; days?: number }[] = [
  { value: "30_DAYS", label: "30 Days", days: 30 },
  { value: "90_DAYS", label: "90 Days (Recommended)", days: 90 },
  { value: "1_YEAR", label: "1 Year", days: 365 },
  { value: "NEVER", label: "No Expiration" },
];

export function computeExpirationIso(option: ExpirationOption): {
  expiresAt?: string;
  label: string;
} {
  const match = EXPIRATION_OPTIONS.find((opt) => opt.value === option);
  if (!match || !match.days) {
    return { expiresAt: undefined, label: "Never" };
  }
  const target = new Date(Date.now() + match.days * 24 * 60 * 60 * 1000);
  return {
    expiresAt: target.toISOString(),
    label: match.value === "1_YEAR" ? "In 1 year" : `In ${match.days} days`,
  };
}

export function CreateApiKeyModal({
  isOpen,
  onClose,
  onCreateKey,
}: CreateApiKeyModalProps) {
  if (!isOpen) return null;
  return <CreateApiKeyModalContent onClose={onClose} onCreateKey={onCreateKey} />;
}

function CreateApiKeyModalContent({
  onClose,
  onCreateKey,
}: Omit<CreateApiKeyModalProps, "isOpen">) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "read:analytics",
    "read:leaderboard",
  ]);
  const [expiration, setExpiration] = useState<ExpirationOption>("90_DAYS");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // One-time secret key dialog state
  const [createdSecret, setCreatedSecret] = useState<CreatedApiKeySecret | null>(null);
  const [hasCopied, setHasCopied] = useState(false);
  const [tooltipText, setTooltipText] = useState("Copy to clipboard");

  const toggleScope = (scopeId: string) => {
    setValidationError(null);
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("API key name is required.");
      return;
    }

    if (trimmedName.length < 3) {
      setValidationError("API key name must be at least 3 characters.");
      return;
    }

    if (selectedScopes.length === 0) {
      setValidationError("Select at least one permission scope.");
      return;
    }

    setValidationError(null);
    setIsSubmitting(true);

    try {
      const { expiresAt, label } = computeExpirationIso(expiration);
      const secret = await onCreateKey({
        name: trimmedName,
        scopes: selectedScopes,
        expiresAt,
        expirationLabel: label,
      });
      setCreatedSecret(secret);
    } catch {
      setValidationError("Failed to generate API key. Please try again.");
      toast.error("Failed to generate API key.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopySecret = async () => {
    if (!createdSecret) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(createdSecret.key);
      }
      setHasCopied(true);
      setTooltipText("Copied!");
      toast.success("Secret key copied to clipboard!");
      setTimeout(() => {
        setHasCopied(false);
        setTooltipText("Copy to clipboard");
      }, 2500);
    } catch {
      toast.error("Could not access clipboard. Please copy the key manually.");
    }
  };

  return (
    <div
      data-testid="create-api-key-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
    >
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!isSubmitting) onClose();
        }}
      />

      {createdSecret ? (
        /* One-Time Secret Key Copy Dialog */
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="one-time-secret-dialog-title"
          data-testid="one-time-secret-dialog"
          className="relative z-10 w-full max-w-lg rounded-2xl glass-card border border-amber-500/30 bg-[#0B0F19] p-6 shadow-2xl space-y-5 text-slate-100"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="one-time-secret-dialog-title"
                  className="text-lg font-bold text-white"
                >
                  API Key Generated
                </h2>
                <p className="text-xs text-slate-400">
                  Token <span className="font-semibold text-slate-200">{createdSecret.name}</span> is ready to use.
                </p>
              </div>
            </div>

            <button
              type="button"
              data-testid="close-secret-dialog-icon-btn"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Security Warning */}
          <div
            data-testid="one-time-secret-warning"
            className="flex items-start gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs"
          >
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="font-medium leading-relaxed">
              Copy this key now. You will not be able to see it again.
            </p>
          </div>

          {/* Secret Key & Copy Button with Tooltip */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Secret Key
            </label>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-black/60 border border-white/10">
              <code
                data-testid="generated-secret-key-value"
                className="flex-1 text-xs font-mono font-bold text-emerald-400 break-all select-all"
              >
                {createdSecret.key}
              </code>
              <div className="relative group shrink-0">
                <button
                  type="button"
                  data-testid="copy-secret-key-btn"
                  onClick={() => void handleCopySecret()}
                  aria-label="Copy secret key"
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-colors cursor-pointer flex items-center gap-1.5 border",
                    hasCopied
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                      : "bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/30 text-indigo-200"
                  )}
                >
                  {hasCopied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <span
                  role="tooltip"
                  data-testid="copy-secret-tooltip"
                  className={cn(
                    "pointer-events-none absolute -top-9 right-0 whitespace-nowrap rounded-md bg-slate-800 border border-white/10 px-2 py-1 text-[10px] font-mono text-slate-100 shadow-lg transition-opacity",
                    hasCopied ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                  )}
                >
                  {tooltipText}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {createdSecret.scopes.map((scope) => (
              <span
                key={scope}
                className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-mono border border-indigo-500/20"
              >
                {scope}
              </span>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t border-white/10">
            <button
              type="button"
              data-testid="done-secret-dialog-btn"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors cursor-pointer"
            >
              Done, I&apos;ve Saved It
            </button>
          </div>
        </div>
      ) : (
        /* Create API Key Form Modal */
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-api-key-modal-title"
          data-testid="create-api-key-modal"
          className="relative z-10 w-full max-w-lg rounded-2xl glass-card border border-white/10 bg-[#0B0F19] p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h2
                  id="create-api-key-modal-title"
                  className="text-base font-bold text-white"
                >
                  Generate Developer API Key
                </h2>
                <p className="text-[11px] font-mono text-slate-400">
                  Configure scoped permissions and key expiration
                </p>
              </div>
            </div>

            <button
              type="button"
              data-testid="close-create-modal-btn"
              onClick={onClose}
              aria-label="Close modal"
              className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
            {validationError && (
              <div
                role="alert"
                data-testid="create-api-key-error"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Key Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="api-key-name-input"
                className="text-xs font-semibold text-slate-300 block"
              >
                Key Name
              </label>
              <input
                id="api-key-name-input"
                type="text"
                data-testid="create-api-key-name-input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="e.g. CI/CD Pipeline Runner"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder:text-slate-500 outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Expiration Dropdown */}
            <div className="space-y-1.5">
              <label
                htmlFor="api-key-expiration-select"
                className="text-xs font-semibold text-slate-300 flex items-center gap-1.5"
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Expiration</span>
              </label>
              <select
                id="api-key-expiration-select"
                data-testid="create-api-key-expiration-select"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value as ExpirationOption)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#0F1524] border border-white/10 text-slate-200 outline-none focus:border-indigo-500 font-mono cursor-pointer"
              >
                {EXPIRATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Scopes Checkboxes */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Permission Scopes</span>
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {selectedScopes.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                {DEVELOPER_API_KEY_SCOPES.map((scope) => {
                  const isChecked = selectedScopes.includes(scope.id);
                  return (
                    <label
                      key={scope.id}
                      className={cn(
                        "p-2.5 rounded-xl border flex items-start gap-2.5 text-xs transition-colors cursor-pointer",
                        isChecked
                          ? "bg-indigo-950/30 border-indigo-500/40 text-white"
                          : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-slate-200"
                      )}
                    >
                      <input
                        type="checkbox"
                        data-testid={`modal-scope-checkbox-${scope.id}`}
                        checked={isChecked}
                        onChange={() => toggleScope(scope.id)}
                        className="accent-indigo-500 mt-0.5 cursor-pointer"
                      />
                      <div>
                        <div className="font-mono font-bold text-slate-200">
                          {scope.label}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {scope.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                data-testid="cancel-create-api-key-btn"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-300 border border-white/10 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                data-testid="submit-create-api-key-btn"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-all shadow-lg shadow-indigo-600/25 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Generating..." : "Generate Secret Key"}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

