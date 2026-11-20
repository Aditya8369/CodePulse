"use client";

import React, { useState } from "react";
import { Send, RefreshCw, AlertTriangle, CheckCircle, Clock, ExternalLink } from "lucide-react";

export interface WebhookDeliveryItem {
  id: string;
  subscriptionId: string;
  event: string;
  status: "SUCCESS" | "RETRYING" | "DEAD_LETTER" | "PENDING";
  statusCode?: number;
  latencyMs?: number;
  attemptCount: number;
  maxAttempts: number;
  isDeadLetter: boolean;
  error?: string;
  createdAt: string;
  deliveredAt?: string;
}

export const WebhookDashboardSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"subscriptions" | "deliveries" | "dlq">("deliveries");
  const [redeliveringId, setRedeliveringId] = useState<string | null>(null);

  // Mock / Default developer telemetry state
  const [deliveries, setDeliveries] = useState<WebhookDeliveryItem[]>([
    {
      id: "del_101",
      subscriptionId: "sub_slack_prod",
      event: "battle.ended",
      status: "SUCCESS",
      statusCode: 200,
      latencyMs: 142,
      attemptCount: 1,
      maxAttempts: 5,
      isDeadLetter: false,
      createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
      deliveredAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    },
    {
      id: "del_102",
      subscriptionId: "sub_discord_relay",
      event: "badge.awarded",
      status: "DEAD_LETTER",
      statusCode: 504,
      latencyMs: 10012,
      attemptCount: 5,
      maxAttempts: 5,
      isDeadLetter: true,
      error: "Exhausted 5 delivery attempts. Gateway Timeout (504)",
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      id: "del_103",
      subscriptionId: "sub_internal_ci",
      event: "pr.reviewed",
      status: "RETRYING",
      statusCode: 502,
      latencyMs: 230,
      attemptCount: 2,
      maxAttempts: 5,
      isDeadLetter: false,
      error: "Bad Gateway 502: Next attempt in 15m",
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
  ]);

  const handleRedeliver = (id: string) => {
    setRedeliveringId(id);
    setTimeout(() => {
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                status: "SUCCESS",
                statusCode: 200,
                latencyMs: 185,
                isDeadLetter: false,
                error: undefined,
                deliveredAt: new Date().toISOString(),
              }
            : d,
        ),
      );
      setRedeliveringId(null);
    }, 600);
  };

  const dlqItems = deliveries.filter((d) => d.isDeadLetter || d.status === "DEAD_LETTER");

  return (
    <div className="mt-8 pt-6 border-t border-white/10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            Developer Webhook Dispatcher & DLQ
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time webhook delivery telemetry with HMAC-SHA256 signatures, exponential backoff, and Dead-Letter Queue (DLQ).
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 text-xs">
          <button
            onClick={() => setActiveTab("deliveries")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "deliveries"
                ? "bg-primary text-primary-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Deliveries ({deliveries.length})
          </button>
          <button
            onClick={() => setActiveTab("dlq")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "dlq"
                ? "bg-rose-500 text-white font-medium shadow-sm"
                : "text-rose-400/80 hover:text-rose-400"
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Dead-Letter Queue ({dlqItems.length})
          </button>
        </div>
      </div>

      {/* Deliveries & DLQ Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-b border-white/10 text-muted-foreground font-medium">
              <tr>
                <th className="py-2.5 px-4">Event</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">HTTP</th>
                <th className="py-2.5 px-4">Latency</th>
                <th className="py-2.5 px-4">Attempts</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(activeTab === "dlq" ? dlqItems : deliveries).map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-mono font-medium text-foreground">
                    {item.event}
                    <div className="text-[10px] text-muted-foreground font-sans">{item.id}</div>
                  </td>
                  <td className="py-3 px-4">
                    {item.status === "SUCCESS" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3" /> SUCCESS
                      </span>
                    )}
                    {item.status === "RETRYING" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3 h-3" /> RETRYING
                      </span>
                    )}
                    {item.status === "DEAD_LETTER" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <AlertTriangle className="w-3 h-3" /> DEAD LETTER
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono">
                    {item.statusCode ? (
                      <span className={item.statusCode >= 200 && item.statusCode < 300 ? "text-emerald-400" : "text-rose-400"}>
                        {item.statusCode}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="py-3 px-4 font-mono text-muted-foreground">
                    {item.latencyMs ? `${item.latencyMs}ms` : "-"}
                  </td>
                  <td className="py-3 px-4">
                    {item.attemptCount} / {item.maxAttempts}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleRedeliver(item.id)}
                      disabled={redeliveringId === item.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 text-foreground border border-white/10 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${redeliveringId === item.id ? "animate-spin" : ""}`} />
                      Redeliver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
