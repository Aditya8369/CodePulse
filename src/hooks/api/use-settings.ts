import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, extractData } from "@/lib/api-client";
import { useHasAuthToken } from "@/hooks/api/use-auth";
import {
  isColorVisionTheme,
  type ColorVisionTheme,
} from "@/lib/colorblind-themes";
import {
  isDeveloperTheme,
  isReadableAccent,
  type DeveloperTheme,
} from "@/lib/developer-themes";

// ==========================================
// Types
// ==========================================

export interface AppearancePreferences {
  theme: "dark" | "light" | "system";
  accentColor: "purple" | "blue" | "emerald" | "orange" | "pink";
  colorVisionTheme: ColorVisionTheme;
  developerTheme?: DeveloperTheme;
  customAccent?: string | null;
  compactTableView: boolean;
  reducedMotion: boolean;
  defaultLandingTab: string;
}

export interface NotificationPreferences {
  battleChallenges: boolean;
  weeklyDigest: boolean;
  achievementUnlocks: boolean;
  leaderboardUpdates: boolean;
  challengeReminders: boolean;
  productUpdates: boolean;
}

export interface UserPreferences {
  appearance: AppearancePreferences;
  notifications: NotificationPreferences;
}

// ==========================================
// Default Constants
// ==========================================

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: "dark",
  accentColor: "purple",
  colorVisionTheme: "normal",
  developerTheme: "default",
  customAccent: null,
  compactTableView: false,
  reducedMotion: false,
  defaultLandingTab: "dashboard",
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  battleChallenges: true,
  weeklyDigest: true,
  achievementUnlocks: true,
  leaderboardUpdates: false,
  challengeReminders: true,
  productUpdates: true,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  appearance: DEFAULT_APPEARANCE_PREFERENCES,
  notifications: DEFAULT_NOTIFICATION_PREFERENCES,
};

export const SETTINGS_STORAGE_KEY = "devbattle_user_preferences";
export const SETTINGS_UPDATED_EVENT = "devbattle-preferences-updated";

// ==========================================
// Local Storage Helpers
// ==========================================

export function normalizePreferences(value: unknown): UserPreferences {
  const parsed =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Partial<UserPreferences>)
      : {};
  return {
    appearance: {
      ...DEFAULT_APPEARANCE_PREFERENCES,
      ...(parsed.appearance || {}),
      colorVisionTheme: isColorVisionTheme(parsed.appearance?.colorVisionTheme)
        ? parsed.appearance.colorVisionTheme
        : DEFAULT_APPEARANCE_PREFERENCES.colorVisionTheme,
      developerTheme: isDeveloperTheme(parsed.appearance?.developerTheme)
        ? parsed.appearance.developerTheme
        : "default",
      customAccent: isReadableAccent(parsed.appearance?.customAccent)
        ? parsed.appearance.customAccent
        : null,
    },
    notifications: {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(parsed.notifications || {}),
    },
  };
}

export function loadLocalPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? normalizePreferences(JSON.parse(raw)) : DEFAULT_PREFERENCES;
  } catch (err) {
    console.warn("Could not parse stored preferences, using defaults:", err);
    return DEFAULT_PREFERENCES;
  }
}

export function saveLocalPreferences(prefs: UserPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(prefs));
    if (typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
    }
  } catch (err) {
    console.warn("Failed to save preferences to localStorage:", err);
  }
}

// ==========================================
// Custom Hook for Persistent Preferences
// ==========================================

export function useUserPreferences() {
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoaded, setIsLoaded] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const hasAuthToken = useHasAuthToken();
  const remoteSettings = useSettings(hasAuthToken);

  const { mutate: persistSettings } = useUpdateSettings();

  // Hydrate preferences from localStorage on client mount
  useEffect(() => {
    const stored = loadLocalPreferences();
    // Browser storage is only available after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferences(stored);
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (!isLoaded || !hasAuthToken || !remoteSettings.isSuccess || lastSaved)
      return;
    if (remoteSettings.data) {
      const hydrated = normalizePreferences(remoteSettings.data);
      // The authenticated server record is the source of truth across devices.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreferences(hydrated);
      saveLocalPreferences(hydrated);
    } else {
      persistSettings(loadLocalPreferences());
    }
  }, [
    isLoaded,
    hasAuthToken,
    remoteSettings.isSuccess,
    remoteSettings.data,
    lastSaved,
    persistSettings,
  ]);

  // Update appearance settings
  const updateAppearance = useCallback(
    (partial: Partial<AppearancePreferences>) => {
      setPreferences((prev) => {
        const next: UserPreferences = {
          ...prev,
          appearance: { ...prev.appearance, ...partial },
        };
        saveLocalPreferences(next);
        setLastSaved(new Date());

        // Sync with backend asynchronously
        try {
          if (hasAuthToken)
            persistSettings({ appearance: next.appearance });
        } catch {}

        return next;
      });
    },
    [hasAuthToken, persistSettings],
  );

  // Update notification settings
  const updateNotifications = useCallback(
    (partial: Partial<NotificationPreferences>) => {
      setPreferences((prev) => {
        const next: UserPreferences = {
          ...prev,
          notifications: { ...prev.notifications, ...partial },
        };
        saveLocalPreferences(next);
        setLastSaved(new Date());

        // Sync with backend asynchronously
        try {
          if (hasAuthToken)
            persistSettings({
              notifications: next.notifications,
            });
        } catch {}

        return next;
      });
    },
    [hasAuthToken, persistSettings],
  );

  // Reset all preferences back to defaults
  const resetToDefaults = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    saveLocalPreferences(DEFAULT_PREFERENCES);
    setLastSaved(new Date());

    try {
      if (hasAuthToken) persistSettings(DEFAULT_PREFERENCES);
    } catch {}

    return DEFAULT_PREFERENCES;
  }, [hasAuthToken, persistSettings]);

  return {
    preferences,
    isLoaded,
    lastSaved,
    updateAppearance,
    updateNotifications,
    resetToDefaults,
  };
}

// ==========================================
// Existing API Queries & Mutations
// ==========================================

export function useSettings(enabled = true) {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await apiClient.get("/settings");
      return extractData<UserPreferences | null>(response);
    },
    enabled,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<UserPreferences>) => {
      const response = await apiClient.put("/settings", data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, FormDataEntryValue>) => {
      const response = await apiClient.put("/users/profile", data);
      return extractData(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "current-user"] });
    },
  });
}
