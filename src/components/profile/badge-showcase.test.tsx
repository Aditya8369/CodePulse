import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BadgeShowcase } from "./badge-showcase";
import { badgeRarity, badgeTilt, normalizeBadges, readFeatured } from "./badge-model";
import { apiClient } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn() }, extractData: (response: { data: { data: unknown } }) => response.data.data,
}));
const badges = ["bronze", "silver", "gold", "diamond"].map((tier, index) => ({
  badge: { id: `b${index}`, name: `Badge ${index}`, description: `Lore ${index}`, tier },
  earnedAt: "2026-11-01T12:00:00Z",
}));
const key = (user: string) => `codepulse:featured-badges:${user}`;
function mount(userId = "owner", records: unknown = badges, header = false) {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { data: records } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>
    {header && <BadgeShowcase userId={userId} badges={records} placement="header" />}
    <BadgeShowcase userId={userId} badges={records} />
  </QueryClientProvider>);
}
beforeEach(() => {
  cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.mocked(apiClient.get).mockReset();
  Object.defineProperty(window, "matchMedia", { configurable: true, value: vi.fn(() => ({
    matches: true, addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })) });
});

describe("profile badge contracts", () => {
  it("retains nested unlock time and never manufactures global statistics", () => {
    const result = normalizeBadges([...badges, badges[0], null, { badge: { id: "broken" } }]);
    expect(result).toHaveLength(4);
    expect(result[0].earnedAt).toBe(badges[0].earnedAt);
    expect(result[0].globalUnlockPercent).toBeUndefined();
    expect(normalizeBadges([{ ...badges[0].badge, globalUnlockPercent: Infinity }])[0].globalUnlockPercent).toBeUndefined();
  });
  it("maps persisted badge tiers to the four visual rarities", () => {
    expect(["bronze", "silver", "gold", "platinum", "diamond", "unknown"].map(badgeRarity))
      .toEqual(["common", "rare", "epic", "legendary", "legendary", "common"]);
  });
  it("bounds tilt and handles zero-sized cards", () => {
    const rect = { left: 0, top: 0, width: 200, height: 100 };
    expect(badgeTilt(500, -100, rect)).toEqual({ x: 8, y: 8 });
    expect(badgeTilt(0, 0, { ...rect, width: 0 })).toEqual({ x: 0, y: 0 });
  });
  it("rejects corrupted storage, unearned IDs, duplicate IDs and excess pins", () => {
    const earned = normalizeBadges(badges);
    expect(readFeatured("{", earned)).toEqual([]);
    expect(readFeatured('{"id":"b0"}', earned)).toEqual([]);
    expect(readFeatured('["not-earned","b0","b0","b1","b2","b3",7]', earned)).toEqual(["b0", "b1", "b2"]);
  });
});

describe("badge collection interactions", () => {
  it("shows lore, real unlock date and explicit missing-rate text in an accessible dialog", () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "View Badge 0 badge" }));
    const dialog = screen.getByRole("dialog", { name: "Badge 0" });
    expect(within(dialog).getByText("Lore 0")).toBeInTheDocument();
    expect(within(dialog).getByText(new Date(badges[0].earnedAt).toLocaleString())).toBeInTheDocument();
    expect(within(dialog).getByText("Not available from the badge service yet.")).toBeInTheDocument();
  });
  it("pins at most three, updates the header immediately, and permits replacement after unpinning", () => {
    mount("owner", badges, true);
    for (let i = 0; i < 4; i++) {
      fireEvent.click(screen.getByRole("button", { name: `View Badge ${i} badge` }));
      fireEvent.click(screen.getByRole("button", { name: "Equip to featured badges" }));
      if (i === 3) expect(screen.getByText(/Unpin a badge before/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    }
    expect(JSON.parse(localStorage.getItem(key("owner"))!)).toEqual(["b0", "b1", "b2"]);
    expect(within(screen.getByRole("region", { name: "Featured badges" })).getAllByRole("button")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "View Badge 0 badge" }));
    fireEvent.click(screen.getByRole("button", { name: "Unpin featured badge" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "View Badge 3 badge" }));
    fireEvent.click(screen.getByRole("button", { name: "Equip to featured badges" }));
    expect(JSON.parse(localStorage.getItem(key("owner"))!)).toEqual(["b1", "b2", "b3"]);
  });
  it("restores featured badges only for the matching profile", () => {
    localStorage.setItem(key("owner"), '["b1"]');
    const view = mount("owner", badges, true);
    expect(within(screen.getByRole("region", { name: "Featured badges" })).getByRole("button", { name: "Badge 1" })).toBeInTheDocument();
    view.unmount(); mount("other", badges, true);
    expect(within(screen.getByRole("region", { name: "Featured badges" })).queryAllByRole("button")).toHaveLength(0);
  });
  it("reports unavailable storage without claiming a pin was saved", () => {
    mount(); vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    fireEvent.click(screen.getByRole("button", { name: "View Badge 0 badge" }));
    fireEvent.click(screen.getByRole("button", { name: "Equip to featured badges" }));
    expect(screen.getByText(/could not be saved/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Equip to featured badges" })).toHaveAttribute("aria-pressed", "false");
  });
  it("loads missing earned badges through the existing user-specific API", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: badges } });
    // Omit supplied badges to exercise the real missing-profile-data path.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><BadgeShowcase userId="user/id" /></QueryClientProvider>);
    expect(await screen.findByRole("button", { name: "View Badge 0 badge" })).toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith("/badges/user/user%2Fid");
  });
  it("shows an empty collection without fake awarded badges", () => {
    mount("owner", []);
    expect(screen.getByText("No earned badges yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /View Badge/ })).not.toBeInTheDocument();
  });
  it("shows a supplied real global rate and handles invalid unlock dates", () => {
    mount("owner", [{ ...badges[0].badge, earnedAt: "bad-date", globalUnlockPercent: 3.8 }]);
    fireEvent.click(screen.getByRole("button", { name: "View Badge 0 badge" }));
    expect(screen.getByText("Unlocked by 3.8% of developers")).toBeInTheDocument();
    expect(screen.getByText("Unlock date unavailable")).toBeInTheDocument();
  });
  it("closes on Escape and returns keyboard focus to the opening card", async () => {
    mount();
    const button = screen.getByRole("button", { name: "View Badge 0 badge" });
    button.focus(); fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(button).toHaveFocus());
  });
});
