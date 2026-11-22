"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useNotifications } from "@/hooks/api/use-notifications";

export function generateFaviconWithBadge(
  theme: "light" | "dark",
  count: number
): string {
  if (count <= 0) {
    return theme === "light" ? "/favicon-light.svg" : "/favicon-dark.svg";
  }

  const badgeText = count > 99 ? "99+" : String(count);
  const baseColor = theme === "light" ? "#0f172a" : "#38bdf8";
  const badgeBg = "#ef4444";
  const badgeTextColor = "#ffffff";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <rect width="32" height="32" rx="8" fill="${theme === "light" ? "#f8fafc" : "#0B0F19"}"/>
    <path d="M8 17L12 9L18 23L22 15L24 17" stroke="${baseColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <circle cx="24" cy="8" r="7" fill="${badgeBg}" stroke="${theme === "light" ? "#ffffff" : "#0B0F19"}" stroke-width="1.5"/>
    <text x="24" y="10.5" fill="${badgeTextColor}" font-size="${count > 9 ? "7" : "8"}" font-family="system-ui, -apple-system, sans-serif" font-weight="900" text-anchor="middle">${badgeText}</text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function ThemeFavicon({ unreadCountOverride }: { unreadCountOverride?: number } = {}) {
  const { resolvedTheme } = useTheme();
  let unreadCount = 0;
  try {
    const notifs = useNotifications();
    unreadCount = notifs?.unreadCount ?? 0;
  } catch {
    unreadCount = 0;
  }

  const effectiveCount = unreadCountOverride !== undefined ? unreadCountOverride : unreadCount;

  useEffect(() => {
    if (!resolvedTheme) return;
    const theme = resolvedTheme === "light" ? "light" : "dark";
    const href = generateFaviconWithBadge(theme, effectiveCount);

    const apply = () => {
      const links = document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]');
      if (links.length === 0) {
        const newLink = document.createElement("link");
        newLink.rel = "icon";
        newLink.type = "image/svg+xml";
        newLink.href = href;
        document.head.appendChild(newLink);
      } else {
        links.forEach((link) => {
          if (link.getAttribute("href") === href) return;
          link.type = "image/svg+xml";
          link.href = href;
        });
      }

      if (typeof document !== "undefined") {
        const baseTitle = document.title.replace(/^\(\d+\+?\)\s*/, "");
        if (effectiveCount > 0) {
          const badge = effectiveCount > 99 ? "99+" : effectiveCount;
          document.title = `(${badge}) ${baseTitle}`;
        } else {
          document.title = baseTitle;
        }
      }
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true });
    return () => observer.disconnect();
  }, [resolvedTheme, effectiveCount]);

  return null;
}
