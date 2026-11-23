"use client";

import React, { useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "motion/react";
import { UserPlus, UserCheck, UserMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useFollowStatus } from "@/hooks/api/use-friends";

export interface FollowButtonProps {
  targetUserId?: string;
  targetUsername: string;
  initialFollowing?: boolean;
  initialFollowersCount?: number;
  onFollowChange?: (isFollowing: boolean, newCount: number) => void;
  className?: string;
}

export function FollowButton({
  targetUserId,
  targetUsername,
  initialFollowing = false,
  initialFollowersCount = 0,
  onFollowChange,
  className,
}: FollowButtonProps) {
  const { isFollowing: apiIsFollowing, follow, unfollow, isPending: apiIsPending } = useFollowStatus(
    targetUserId,
    targetUsername
  );

  const [isFollowing, setIsFollowing] = useState<boolean>(initialFollowing || apiIsFollowing);
  const [followersCount, setFollowersCount] = useState<number>(initialFollowersCount);
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Sync if api query finishes
  useEffect(() => {
    if (apiIsFollowing !== undefined) {
      setIsFollowing(apiIsFollowing);
    }
  }, [apiIsFollowing]);

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const nextFollowing = !isFollowing;
    const nextCount = nextFollowing ? followersCount + 1 : Math.max(0, followersCount - 1);

    // Optimistic UI update
    setIsFollowing(nextFollowing);
    setFollowersCount(nextCount);
    onFollowChange?.(nextFollowing, nextCount);

    startTransition(async () => {
      try {
        if (nextFollowing) {
          follow(targetUserId || targetUsername);
          toast.success(`You are now following @${targetUsername}`);
        } else {
          unfollow(targetUserId || targetUsername);
          toast.success(`Unfollowed @${targetUsername}`);
        }
      } catch (err) {
        // Rollback on error
        setIsFollowing(!nextFollowing);
        const rollbackCount = !nextFollowing ? followersCount + 1 : Math.max(0, followersCount - 1);
        setFollowersCount(rollbackCount);
        onFollowChange?.(!nextFollowing, rollbackCount);
        toast.error(`Failed to update follow status for @${targetUsername}`);
      }
    });
  };

  const loading = isPending || apiIsPending;

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <motion.button
        type="button"
        data-testid="follow-toggle-btn"
        onClick={handleToggleFollow}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        disabled={loading}
        aria-pressed={isFollowing}
        aria-label={isFollowing ? `Unfollow @${targetUsername}` : `Follow @${targetUsername}`}
        className={cn(
          "relative flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md select-none",
          loading && "opacity-70 pointer-events-none",
          isFollowing
            ? isHovered
              ? "bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20"
              : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
            : "bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white shadow-indigo-600/25"
        )}
      >
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Updating...</span>
            </motion.span>
          ) : isFollowing ? (
            <motion.span
              key="following"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5"
            >
              {isHovered ? (
                <>
                  <UserMinus className="w-3.5 h-3.5" />
                  <span>Unfollow</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Following</span>
                </>
              )}
            </motion.span>
          ) : (
            <motion.span
              key="follow"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Follow</span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Real-Time Follower Counter Badge */}
      <div
        data-testid="follower-counter-badge"
        className="px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono font-bold text-slate-300"
        title={`${followersCount} followers`}
      >
        <span className="text-white">{followersCount.toLocaleString()}</span>
        <span className="text-slate-500 text-[10px] ml-1 uppercase">Followers</span>
      </div>
    </div>
  );
}
