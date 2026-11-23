import type { Notification } from "@/types";

export const notificationCategories = [
  "all",
  "mentions",
  "battles",
  "guilds",
  "system",
  "achievements",
] as const;

export type NotificationCategory = (typeof notificationCategories)[number];

export function categoryForNotification(type: Notification["type"]): Exclude<NotificationCategory, "all"> {
  if (type === "mention") return "mentions";
  if (type === "battle") return "battles";
  if (type === "guild") return "guilds";
  if (type === "achievement" || type === "challenge" || type === "level_up") return "achievements";
  return "system";
}
