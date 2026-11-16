export interface ProfileStatus {
  emoji: string;
  message: string;
}

const STATUS_KEY = "codepulse_user_status";

function readStatuses(): Record<string, ProfileStatus> {
  if (typeof window === "undefined") return {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STATUS_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, ProfileStatus>
      : {};
  } catch {
    return {};
  }
}

export function getProfileStatus(userId: string): ProfileStatus | null {
  const status = readStatuses()[userId];
  return status && typeof status.emoji === "string" && typeof status.message === "string"
    ? status
    : null;
}

export function saveProfileStatus(userId: string, status: ProfileStatus | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    const statuses = readStatuses();
    if (status) statuses[userId] = status;
    else delete statuses[userId];
    localStorage.setItem(STATUS_KEY, JSON.stringify(statuses));
    return true;
  } catch {
    return false;
  }
}
