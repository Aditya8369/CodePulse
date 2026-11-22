"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Crown,
  Flame,
  Swords,
  Terminal,
  Sparkles,
  Users,
  ChevronRight,
  ChevronLeft,
  Check,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface GuildCreationData {
  name: string;
  tag: string;
  description: string;
  joinPolicy: "open" | "request" | "invite";
  crestShape: "shield" | "hexagon" | "circle" | "diamond";
  crestIcon: "shield" | "crown" | "flame" | "swords" | "terminal";
  crestColor: string;
  bannerGradient: string;
}

interface GuildCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGuildCreated?: (data: GuildCreationData) => void;
}

const CREST_SHAPES = [
  { id: "shield" as const, label: "Shield", radius: "rounded-2xl" },
  { id: "hexagon" as const, label: "Hexagon", radius: "rounded-3xl" },
  { id: "circle" as const, label: "Circle", radius: "rounded-full" },
  { id: "diamond" as const, label: "Diamond", radius: "rounded-xl rotate-45" },
];

const CREST_ICONS = [
  { id: "shield" as const, label: "Guardian", icon: Shield },
  { id: "crown" as const, label: "Crown", icon: Crown },
  { id: "flame" as const, label: "Flame", icon: Flame },
  { id: "swords" as const, label: "Swords", icon: Swords },
  { id: "terminal" as const, label: "Terminal", icon: Terminal },
];

const CREST_COLORS = [
  { id: "cyan", bg: "bg-cyan-500", text: "text-cyan-400", border: "border-cyan-400/40" },
  { id: "purple", bg: "bg-purple-500", text: "text-purple-400", border: "border-purple-400/40" },
  { id: "amber", bg: "bg-amber-500", text: "text-amber-400", border: "border-amber-400/40" },
  { id: "emerald", bg: "bg-emerald-500", text: "text-emerald-400", border: "border-emerald-400/40" },
  { id: "rose", bg: "bg-rose-500", text: "text-rose-400", border: "border-rose-400/40" },
];

const BANNER_GRADIENTS = [
  { id: "cyberpunk", label: "Neon Cyberpunk", class: "from-cyan-900/60 via-indigo-950 to-purple-900/60 border-cyan-500/30" },
  { id: "solar", label: "Solar Flare", class: "from-amber-900/60 via-orange-950 to-rose-900/60 border-amber-500/30" },
  { id: "emerald", label: "Matrix Emerald", class: "from-emerald-950/80 via-teal-950 to-slate-950 border-emerald-500/30" },
  { id: "royal", label: "Royal Amethyst", class: "from-purple-950/80 via-violet-900 to-indigo-950 border-purple-500/30" },
];

export function GuildCreateModal({
  isOpen,
  onClose,
  onGuildCreated,
}: GuildCreateModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [joinPolicy, setJoinPolicy] = useState<"open" | "request" | "invite">("open");
  const [crestShape, setCrestShape] = useState<"shield" | "hexagon" | "circle" | "diamond">("shield");
  const [crestIcon, setCrestIcon] = useState<"shield" | "crown" | "flame" | "swords" | "terminal">("shield");
  const [crestColor, setCrestColor] = useState("cyan");
  const [bannerGradient, setBannerGradient] = useState("cyberpunk");

  const selectedColor = CREST_COLORS.find((c) => c.id === crestColor) || CREST_COLORS[0];
  const selectedBanner = BANNER_GRADIENTS.find((b) => b.id === bannerGradient) || BANNER_GRADIENTS[0];
  const SelectedIcon = CREST_ICONS.find((i) => i.id === crestIcon)?.icon || Shield;

  const handleNext = () => {
    if (step === 1) {
      if (name.trim().length < 3) {
        toast.error("Guild name must be at least 3 characters.");
        return;
      }
      if (tag.trim().length < 2 || tag.trim().length > 6) {
        toast.error("Guild tag must be between 2 and 6 letters/digits.");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  const handleCreateGuild = () => {
    const payload: GuildCreationData = {
      name: name.trim(),
      tag: tag.trim().toUpperCase(),
      description: description.trim(),
      joinPolicy,
      crestShape,
      crestIcon,
      crestColor,
      bannerGradient,
    };

    onGuildCreated?.(payload);
    toast.success(`Guild "${payload.name}" [${payload.tag}] created successfully!`, {
      description: "Welcome to competitive guild battles on CodePulse.",
    });
    onClose();
    // Reset state
    setStep(1);
    setName("");
    setTag("");
    setDescription("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="guild-create-modal"
        className="max-w-xl bg-[#0B0F19]/95 backdrop-blur-2xl border border-white/10 text-white rounded-[28px] p-0 overflow-hidden shadow-2xl"
      >
        {/* Top Step Progress Bar */}
        <div className="px-6 pt-6 pb-2 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center text-xs font-bold font-mono">
              {step}
            </span>
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              {step === 1 ? "1. Identity & Rules" : step === 2 ? "2. Custom Crest" : "3. Banner & Launch"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "w-6 h-1 rounded-full transition-all",
                  step >= s ? "bg-primary" : "bg-white/10"
                )}
              />
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Live Guild Banner & Crest Preview */}
          <div
            data-testid="guild-live-preview-banner"
            className={cn(
              "rounded-2xl p-5 border bg-gradient-to-r relative overflow-hidden transition-all shadow-xl flex items-center gap-4",
              selectedBanner.class
            )}
          >
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />

            <div
              className={cn(
                "w-16 h-16 shrink-0 flex items-center justify-center border-2 shadow-2xl transition-all duration-300",
                selectedColor.border,
                selectedColor.bg + "/20",
                crestShape === "hexagon"
                  ? "rounded-2xl"
                  : crestShape === "circle"
                  ? "rounded-full"
                  : crestShape === "diamond"
                  ? "rounded-xl rotate-45"
                  : "rounded-2xl"
              )}
            >
              <div className={crestShape === "diamond" ? "-rotate-45" : undefined}>
                <SelectedIcon className={cn("w-8 h-8", selectedColor.text)} />
              </div>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-black text-white truncate">
                  {name.trim() || "Your Guild Name"}
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20 text-[10px] font-mono font-bold text-amber-300">
                  [{tag.trim().toUpperCase() || "TAG"}]
                </span>
              </div>
              <p className="text-xs text-slate-300 truncate">
                {description.trim() || "Ready to dominate competitive clan coding wars"}
              </p>
              <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono pt-1">
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-primary" /> 1 Member
                </span>
                <span>• Policy: {joinPolicy.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Step 1: Guild Identity */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                  Guild Name *
                </label>
                <input
                  type="text"
                  data-testid="guild-name-input"
                  placeholder="e.g. OpenSource Avengers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-sm rounded-xl bg-white/5 border border-white/10 p-3 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                  Guild Tag (2-6 chars) *
                </label>
                <input
                  type="text"
                  data-testid="guild-tag-input"
                  placeholder="e.g. AVENGER"
                  maxLength={6}
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  className="w-full text-sm font-mono rounded-xl bg-white/5 border border-white/10 p-3 text-white uppercase placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1">
                  Description / Motto
                </label>
                <input
                  type="text"
                  data-testid="guild-description-input"
                  placeholder="What is your guild mission?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-sm rounded-xl bg-white/5 border border-white/10 p-3 text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                  Membership Policy
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "open" as const, label: "Open Join" },
                    { id: "request" as const, label: "By Request" },
                    { id: "invite" as const, label: "Invite Only" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      data-testid={`join-policy-${p.id}`}
                      onClick={() => setJoinPolicy(p.id)}
                      className={cn(
                        "py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer",
                        joinPolicy === p.id
                          ? "bg-primary/20 border-primary text-white font-bold"
                          : "bg-white/[0.02] border-white/10 text-muted-foreground hover:bg-white/5 hover:text-white"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 2: Custom Crest */}
          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              {/* Crest Shape */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Crest Frame Shape
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {CREST_SHAPES.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      data-testid={`crest-shape-${s.id}`}
                      onClick={() => setCrestShape(s.id)}
                      className={cn(
                        "p-3 rounded-xl border text-xs font-medium text-center transition-all cursor-pointer",
                        crestShape === s.id
                          ? "bg-primary/20 border-primary text-white font-bold shadow-sm"
                          : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-white"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Crest Icon */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Emblem Icon
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CREST_ICONS.map((i) => {
                    const Icon = i.icon;
                    return (
                      <button
                        key={i.id}
                        type="button"
                        data-testid={`crest-icon-${i.id}`}
                        onClick={() => setCrestIcon(i.id)}
                        className={cn(
                          "p-3 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer",
                          crestIcon === i.id
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-white/[0.02] border-white/10 text-muted-foreground hover:text-white"
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[10px] font-medium">{i.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Crest Theme Color */}
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Aura & Accent Color
                </label>
                <div className="flex items-center gap-3">
                  {CREST_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      data-testid={`crest-color-${c.id}`}
                      onClick={() => setCrestColor(c.id)}
                      className={cn(
                        "w-9 h-9 rounded-xl border-2 transition-all cursor-pointer",
                        c.bg,
                        crestColor === c.id
                          ? "ring-2 ring-white scale-110 border-white"
                          : "border-transparent opacity-80 hover:opacity-100"
                      )}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 3: Banner Customizer & Launch */}
          {step === 3 && (
            <motion.div
              key="step-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                  Select Clan War Banner Theme
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {BANNER_GRADIENTS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      data-testid={`banner-gradient-${b.id}`}
                      onClick={() => setBannerGradient(b.id)}
                      className={cn(
                        "p-3.5 rounded-xl border bg-gradient-to-r text-left transition-all cursor-pointer",
                        b.class,
                        bannerGradient === b.id
                          ? "ring-2 ring-primary border-primary font-bold shadow-md"
                          : "opacity-75 hover:opacity-100"
                      )}
                    >
                      <span className="text-xs text-white font-bold block">{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                  Founder Benefits
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  As the founding Guild Leader, you will be able to initiate GvG weekend challenges, assign officer roles, and manage territory conquests on the tactical map.
                </p>
              </div>
            </motion.div>
          )}

          {/* Stepper Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-white/5">
            {step > 1 ? (
              <button
                type="button"
                data-testid="guild-wizard-back-btn"
                onClick={handleBack}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-300 hover:bg-white/5 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                data-testid="guild-wizard-next-btn"
                onClick={handleNext}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-primary/20 cursor-pointer"
              >
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                data-testid="guild-wizard-submit-btn"
                onClick={handleCreateGuild}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-xs font-black transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/25 active:scale-95 cursor-pointer"
              >
                <Zap className="w-4 h-4" /> Create Guild
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
