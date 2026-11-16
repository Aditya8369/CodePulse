import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProfileStatus, saveProfileStatus } from "./storage";

describe("profile status storage", () => {
  beforeEach(() => {
    const items = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => { items.set(key, value); },
    });
  });

  it("persists a status for its owner without showing it to another user", () => {
    expect(saveProfileStatus("alice", { emoji: "🚀", message: "Shipping" })).toBe(true);
    expect(getProfileStatus("alice")).toEqual({ emoji: "🚀", message: "Shipping" });
    expect(getProfileStatus("bob")).toBeNull();
    expect(JSON.parse(localStorage.getItem("codepulse_user_status") || "{}").alice.message).toBe("Shipping");
  });

  it("clears only the selected user's status", () => {
    saveProfileStatus("alice", { emoji: "🚀", message: "Shipping" });
    saveProfileStatus("bob", { emoji: "☕", message: "Coffee" });
    saveProfileStatus("alice", null);
    expect(getProfileStatus("alice")).toBeNull();
    expect(getProfileStatus("bob")?.message).toBe("Coffee");
  });

  it("ignores corrupt storage instead of crashing the profile", () => {
    localStorage.setItem("codepulse_user_status", "broken json");
    expect(getProfileStatus("alice")).toBeNull();
  });
});
