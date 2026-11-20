"use client";

import { useState } from "react";
import { Laptop, Smartphone, Tablet, Globe, Trash2, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ActiveSessionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActiveSessionsModal({ isOpen, onClose }: ActiveSessionsModalProps) {
  const [sessions, setSessions] = useState([
    {
      id: "sess-1",
      deviceType: "Desktop",
      browser: "Chrome on macOS",
      ipAddress: "152.58.112.44",
      location: "Mumbai, India",
      isCurrent: true,
      lastActive: "Active right now",
    },
    {
      id: "sess-2",
      deviceType: "Mobile",
      browser: "Mobile Safari on iPhone",
      ipAddress: "152.58.114.92",
      location: "Mumbai, India",
      isCurrent: false,
      lastActive: "4 hours ago",
    },
    {
      id: "sess-3",
      deviceType: "Desktop",
      browser: "Firefox on Windows",
      ipAddress: "103.21.244.12",
      location: "Bengaluru, India",
      isCurrent: false,
      lastActive: "2 days ago",
    },
  ]);

  const handleRevoke = (id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRevokeOthers = () => {
    setSessions((prev) => prev.filter((s) => s.isCurrent));
  };

  const getDeviceIcon = (type: string) => {
    if (type === "Mobile") return <Smartphone className="w-5 h-5 text-purple-400" />;
    if (type === "Tablet") return <Tablet className="w-5 h-5 text-amber-400" />;
    return <Laptop className="w-5 h-5 text-cyan-400" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-slate-950 border-white/10 text-white p-6 sm:p-8 rounded-3xl">
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-1">
            <Globe className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold">Active Device Sessions</DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Review devices and browsers logged into your account. Revoke any unrecognized access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-3">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                  {getDeviceIcon(sess.deviceType)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-white">{sess.browser}</h4>
                    {sess.isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Current Device
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {sess.ipAddress} • {sess.location} • <span className="text-slate-500">{sess.lastActive}</span>
                  </p>
                </div>
              </div>

              {!sess.isCurrent && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRevoke(sess.id)}
                  className="bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs rounded-xl"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Revoke
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-white/10 mt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRevokeOthers}
            className="bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 text-xs rounded-xl"
          >
            Revoke All Other Devices
          </Button>

          <Button size="sm" onClick={onClose} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
