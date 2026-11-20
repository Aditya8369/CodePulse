"use client";

import { useState } from "react";
import { Shield, Key, Check, Copy, ArrowRight, Printer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

export function TwoFactorSetupModal({
  isOpen,
  onClose,
  username,
}: TwoFactorSetupModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [otp, setOtp] = useState("");
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [recoveryCodes] = useState([
    "A1B2-C3D4",
    "E5F6-G7H8",
    "I9J0-K1L2",
    "M3N4-O5P6",
    "Q7R8-S9T0",
    "U1V2-W3X4",
    "Y5Z6-A7B8",
    "C9D0-E1F2",
  ]);

  const mockSecret = "JBSWY3DPEHPK3PXP";

  const handleCopySecret = () => {
    navigator.clipboard.writeText(mockSecret);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const handleVerify = () => {
    if (otp.length === 6) {
      setStep(3);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-slate-950 border-white/10 text-white p-6 sm:p-8 rounded-3xl">
        <DialogHeader className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-1">
            <Shield className="w-6 h-6" />
          </div>
          <DialogTitle className="text-xl font-bold">Two-Factor Authentication Setup</DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            Protect your CodePulse developer account with TOTP authenticator app verification.
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-6 pt-2">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 space-y-3">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Step 1: Scan QR or Enter Secret</span>
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl">
                {/* SVG Mock QR Code */}
                <div className="w-40 h-40 bg-slate-900 flex items-center justify-center text-xs text-slate-300 font-mono text-center p-2 rounded">
                  otpauth://totp/CodePulse:{username}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/10">
                <span className="font-mono text-xs text-cyan-300 select-all">{mockSecret}</span>
                <button onClick={handleCopySecret} className="text-xs flex items-center gap-1 text-slate-300 hover:text-white">
                  {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSecret ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <Button onClick={() => setStep(2)} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2.5 rounded-xl">
              Next: Verify Code <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 pt-2">
            <div className="space-y-2">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">Step 2: Enter 6-Digit Passcode</span>
              <p className="text-xs text-slate-400">Enter the code displayed in Google Authenticator, 1Password, or Authy.</p>
              <Input
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="text-center font-mono text-2xl tracking-[0.4em] bg-black/40 border-white/15 text-white h-14 rounded-2xl"
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1 bg-white/5 border-white/10 text-white">
                Back
              </Button>
              <Button onClick={handleVerify} disabled={otp.length !== 6} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
                Activate 2FA
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 pt-2">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex gap-2.5 items-start">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Save your emergency recovery codes. Each code can only be used once if you lose device access.</span>
            </div>

            <div className="grid grid-cols-2 gap-2 bg-black/40 p-4 rounded-2xl border border-white/10 font-mono text-xs text-center text-slate-300">
              {recoveryCodes.map((code) => (
                <div key={code} className="p-2 rounded bg-white/5 border border-white/5">{code}</div>
              ))}
            </div>

            <Button onClick={onClose} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl">
              Done & Protected
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
