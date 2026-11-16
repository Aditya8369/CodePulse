"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { loadLocalPreferences } from "@/hooks/api/use-settings";
import { applyColorVisionTheme } from "@/lib/colorblind-themes";
import { applyDeveloperTheme } from "@/lib/developer-themes";

/** Restore the locally saved preset on every page and keep it in sync with
 * light/dark theme changes and updates from another tab. */
export function ColorVisionSync() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const sync = () => {
      const isLight = resolvedTheme === "light" ||
        (resolvedTheme === undefined && document.documentElement.classList.contains("light"));
      const appearance = loadLocalPreferences().appearance;
      applyColorVisionTheme(
        appearance.colorVisionTheme,
        isLight ? "light" : "dark",
      );
      applyDeveloperTheme(appearance.developerTheme, appearance.customAccent, isLight);
    };
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [resolvedTheme]);

  return null;
}
