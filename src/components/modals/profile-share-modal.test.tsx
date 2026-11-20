import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProfileShareModal } from "./profile-share-modal";
import type { User } from "@/hooks/api/use-auth";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(cleanup);

const user: User = {
  id: "u1", username: "dev-user", name: "Dev User", avatar: null, bio: null,
  rating: { tier: "DIAMOND", rank: 14, xp: 1250 }, stats: { streak: 7 },
};

describe("ProfileShareModal", () => {
  it("previews real stats and copies the public profile URL", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<ProfileShareModal isOpen onClose={vi.fn()} user={user} />);
    expect(screen.getByText("Dev User")).toBeTruthy();
    expect(screen.getByText("1,250")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Copy Profile Link/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/profile/dev-user`));
    expect(screen.getByRole("button", { name: /Copied!/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /LinkedIn/ }).getAttribute("href")).toContain(encodeURIComponent(`${window.location.origin}/profile/dev-user`));
  });
});
