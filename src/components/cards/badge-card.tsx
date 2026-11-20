"use client";

import { useEffect, type CSSProperties } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { Award, Pin } from "lucide-react";
import { badgeRarity, badgeTilt, type ProfileBadge } from "@/components/profile/badge-model";
import styles from "./badge-card.module.css";

export function BadgeCard({ badge, featured, onOpen }: {
  badge: ProfileBadge; featured: boolean; onOpen: (trigger: HTMLButtonElement) => void;
}) {
  const reduced = useReducedMotion();
  const pitch = useMotionValue(0), roll = useMotionValue(0);
  const rotateX = useSpring(pitch, { stiffness: 180, damping: 22 });
  const rotateY = useSpring(roll, { stiffness: 180, damping: 22 });
  const shineX = useMotionValue("50%"), shineY = useMotionValue("50%");
  const reset = () => { pitch.set(0); roll.set(0); shineX.set("50%"); shineY.set("50%"); };
  useEffect(() => { if (reduced) { pitch.set(0); roll.set(0); } }, [reduced, pitch, roll]);
  const rarity = badgeRarity(badge.tier);

  return <div style={{ perspective: 900 }}>
    <motion.button type="button" aria-label={`View ${badge.name} badge`} aria-haspopup="dialog"
      className={`${styles.card} ${styles[rarity]}`}
      style={{ rotateX: reduced ? 0 : rotateX, rotateY: reduced ? 0 : rotateY,
        "--shine-x": shineX, "--shine-y": shineY } as CSSProperties}
      onClick={event => onOpen(event.currentTarget)}
      onPointerMove={event => {
        if (reduced || event.pointerType === "touch") return;
        const target = badgeTilt(event.clientX, event.clientY, event.currentTarget.parentElement!.getBoundingClientRect());
        pitch.set(target.x); roll.set(target.y);
        shineX.set(`${50 - target.y * 4}%`); shineY.set(`${50 + target.x * 4}%`);
      }} onPointerLeave={reset} onPointerCancel={reset} onBlur={reset}>
      <span className={styles.shine} aria-hidden="true" />
      <span className={styles.content}>
        <span className="flex items-center justify-between"><Award aria-hidden="true" className="size-8" />{featured && <Pin aria-label="Featured" className="size-4" />}</span>
        <span className={styles.rarity}>{rarity}</span>
        <span className={styles.name}>{badge.name}</span>
        <span className="text-xs text-slate-400">View badge details</span>
      </span>
    </motion.button>
  </div>;
}
