import type { Notification } from "@/types";

export const notificationCategories = [
  "all", "battles", "achievements", "social", "system",
] as const;

export type NotificationCategory = (typeof notificationCategories)[number];

export function categoryForNotification(type: Notification["type"]): Exclude<NotificationCategory, "all"> {
  if (type === "battle") return "battles";
  if (type === "achievement" || type === "challenge" || type === "level_up") return "achievements";
  if (type === "friend") return "social";
  return "system";
}
