import confetti from "canvas-confetti";
import { audioManager } from "@/lib/audio-manager";

/**
 * Fires a dynamic dual-cannon victory confetti celebration.
 * Optimized with requestAnimationFrame for smooth 60fps animation.
 */
export function triggerDualCannonConfetti() {
  if (typeof window === "undefined") return;

  const colors = ["#6366f1", "#a855f7", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"];

  // 1. Immediate initial burst from center
  confetti({
    particleCount: 40,
    spread: 70,
    origin: { y: 0.6 },
    colors,
    zIndex: 9999,
    disableForReducedMotion: true,
  });

  // 2. Dual-cannon continuous celebration (left & right)
  const duration = 2.5 * 1000;
  const animationEnd = Date.now() + duration;

  const frame = () => {
    // Left cannon shooting upward and right
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.75 },
      colors,
      zIndex: 9999,
      disableForReducedMotion: true,
    });

    // Right cannon shooting upward and left
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.75 },
      colors,
      zIndex: 9999,
      disableForReducedMotion: true,
    });

    if (Date.now() < animationEnd) {
      requestAnimationFrame(frame);
    }
  };

  requestAnimationFrame(frame);
}

/** Play the currently selected, volume-controlled battle fanfare. */
export function playVictorySound(isMuted: boolean = false) {
  if (!isMuted) audioManager.playVictoryFanfare();
}

export const triggerCelebration = triggerDualCannonConfetti;
