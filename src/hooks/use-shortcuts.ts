"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const NAVIGATION_ROUTES: Record<string, string> = {
  d: "/dashboard",
  b: "/battles",
  c: "/challenges",
  l: "/leaderboard",
  p: "/profile",
  a: "/analytics",
  s: "/settings",
};

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(
    target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"]'),
  );
}

export function useShortcuts({
  onShowHelp,
  disabled = false,
}: {
  onShowHelp: () => void;
  disabled?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (disabled) return;
    let pendingNavigationUntil = 0;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey ||
        isTypingTarget(event.target) || document.querySelector('[aria-modal="true"]')
      ) {
        pendingNavigationUntil = 0;
        return;
      }

      if (event.key === "?" || (event.code === "Slash" && event.shiftKey)) {
        event.preventDefault();
        pendingNavigationUntil = 0;
        onShowHelp();
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "g") {
        pendingNavigationUntil = Date.now() + 1200;
        return;
      }

      if (pendingNavigationUntil >= Date.now() && NAVIGATION_ROUTES[key]) {
        event.preventDefault();
        router.push(NAVIGATION_ROUTES[key]);
      }
      pendingNavigationUntil = 0;
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, onShowHelp, router]);
}
