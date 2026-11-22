"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { Flame, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakFlameParticlesProps {
  streak: number;
  className?: string;
  showBadge?: boolean;
}

export function StreakFlameParticles({
  streak,
  className,
  showBadge = true,
}: StreakFlameParticlesProps) {
  const isMilestone = streak >= 7;

  // Generate deterministic embers for fluid animation without hydration mismatch
  const embers = useMemo(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      id: i,
      x: 10 + (i * 12) % 80,
      size: 4 + (i % 3) * 2,
      delay: (i * 0.25) % 2,
      duration: 1.6 + (i % 4) * 0.3,
    }));
  }, []);

  if (!isMilestone) return null;

  return (
    <div
      data-testid="streak-flame-particles-container"
      className={cn("relative overflow-hidden select-none pointer-events-none", className)}
      aria-label={`${streak} days streak on fire milestone`}
    >
      {/* Ambient background flame aura */}
      <div className="absolute inset-0 bg-gradient-to-t from-orange-500/15 via-amber-500/10 to-transparent blur-md animate-pulse" />

      {/* Floating Ember Particles */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {embers.map((ember) => (
          <motion.div
            key={ember.id}
            data-testid="streak-ember-particle"
            initial={{ opacity: 0, y: 15, scale: 0.5 }}
            animate={{
              opacity: [0, 0.9, 0.4, 0],
              y: [-5, -35],
              x: [ember.x, ember.x + (ember.id % 2 === 0 ? 8 : -8)],
              scale: [0.5, 1.2, 0.3],
            }}
            transition={{
              duration: ember.duration,
              repeat: Infinity,
              delay: ember.delay,
              ease: "easeOut",
            }}
            className="absolute bottom-1 rounded-full bg-gradient-to-t from-rose-500 via-amber-400 to-yellow-200 shadow-[0_0_8px_rgba(251,146,60,0.8)]"
            style={{
              left: `${ember.x}%`,
              width: `${ember.size}px`,
              height: `${ember.size}px`,
            }}
          />
        ))}
      </div>

      {/* Optional Milestone Badge */}
      {showBadge && (
        <div className="relative z-10 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border border-orange-500/30 text-[11px] font-bold text-orange-300 shadow-sm">
          <Flame className="w-3.5 h-3.5 text-orange-400 fill-orange-400/40 animate-bounce" />
          <span>7+ Days Streak On Fire!</span>
          <Sparkles className="w-3 h-3 text-amber-300" />
        </div>
      )}
    </div>
  );
}
