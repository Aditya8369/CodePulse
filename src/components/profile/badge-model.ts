export type BadgeRarity = "common" | "rare" | "epic" | "legendary";

export interface ProfileBadge {
  id: string;
  name: string;
  description: string;
  tier: string;
  earnedAt?: string;
  globalUnlockPercent?: number;
}

export function normalizeBadges(records: unknown): ProfileBadge[] {
  if (!Array.isArray(records)) return [];
  const seen = new Set<string>();
  return records.flatMap((record) => {
    if (!record || typeof record !== "object") return [];
    const badge = record.badge ?? record;
    if (!badge || typeof badge.id !== "string" || typeof badge.name !== "string" || seen.has(badge.id)) return [];
    seen.add(badge.id);
    return [{
      id: badge.id,
      name: badge.name,
      description: typeof badge.description === "string" ? badge.description : "No badge description available.",
      tier: typeof badge.tier === "string" ? badge.tier.toLowerCase() : "bronze",
      earnedAt: typeof record.earnedAt === "string" ? record.earnedAt : typeof badge.earnedAt === "string" ? badge.earnedAt : undefined,
      globalUnlockPercent: typeof badge.globalUnlockPercent === "number" &&
        Number.isFinite(badge.globalUnlockPercent) && badge.globalUnlockPercent >= 0 && badge.globalUnlockPercent <= 100
        ? badge.globalUnlockPercent : undefined,
    }];
  });
}

export function badgeRarity(tier: string): BadgeRarity {
  const rarities: Record<string, BadgeRarity> = { silver: "rare", gold: "epic", platinum: "legendary", diamond: "legendary" };
  return rarities[tier] ?? "common";
}

export function readFeatured(raw: string, badges: ProfileBadge[]): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    const earned = new Set(badges.map(badge => badge.id));
    return [...new Set(value.filter((id): id is string => typeof id === "string" && earned.has(id)))].slice(0, 3);
  } catch { return []; }
}

export function badgeTilt(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) {
  if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  return { x: -clamp((clientY - rect.top) / rect.height * 2 - 1) * 8,
    y: clamp((clientX - rect.left) / rect.width * 2 - 1) * 8 };
}
