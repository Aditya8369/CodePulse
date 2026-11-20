"use client";

import { useState } from "react";
import { Webhook, Plus, Send, CheckCircle2, XCircle, Shield, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WebhooksPanel() {
  const [endpoints, setEndpoints] = useState([
    {
      id: "ep-1",
      url: "https://api.myguild.dev/hooks/codepulse",
      events: ["battle.completed", "streak.milestone"],
      isActive: true,
      lastStatus: 200,
      lastDelivery: "10m ago",
    },
  ]);
  const [newUrl, setNewUrl] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const handleTestPing = () => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      setTestSent(true);
      setTimeout(() => setTestSent(false), 2500);
    }, 800);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Webhook className="w-5 h-5 text-cyan-400" />
            Outgoing Developer Webhooks
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Receive signed HMAC-SHA256 event notifications in real time to external HTTP endpoints.
          </p>
        </div>
        <Button size="sm" onClick={handleTestPing} disabled={isTesting} className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-xl">
          <Send className="w-3.5 h-3.5 mr-1" /> {isTesting ? "Sending..." : testSent ? "Delivered 200 OK!" : "Send Test Ping"}
        </Button>
      </div>

      <div className="space-y-3">
        {endpoints.map((ep) => (
          <div key={ep.id} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-white font-bold">{ep.url}</span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Status {ep.lastStatus}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Events:</span>
              {ep.events.map((ev) => (
                <span key={ev} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-slate-300">
                  {ev}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
