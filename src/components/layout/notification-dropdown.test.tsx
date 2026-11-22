import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { NotificationDropdown } from "./notification-dropdown";
import type { Notification } from "@/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const notices: Notification[] = [
  { id: "b", type: "battle", title: "Battle invite", message: "Join now", isRead: false, createdAt: "2026-11-16T12:00:00Z" },
  { id: "a", type: "achievement", title: "New badge", message: "Great work", isRead: false, createdAt: "2026-11-16T12:00:00Z" },
  { id: "s", type: "system", title: "Sync complete", message: "Done", isRead: true, createdAt: "2026-11-16T12:00:00Z" },
  { id: "m", type: "mention", title: "Mentioned in battle review", message: "@user check this", isRead: false, createdAt: "2026-11-16T12:00:00Z" },
  { id: "g", type: "guild", title: "Guild war alert", message: "Raid starting soon", isRead: false, createdAt: "2026-11-16T12:00:00Z" },
];

function setup() {
  const onMarkCategoryAsRead = vi.fn();
  render(
    <NotificationDropdown
      isOpen
      onClose={vi.fn()}
      notifications={notices}
      unreadCount={4}
      onMarkAsRead={vi.fn()}
      onMarkAllAsRead={vi.fn()}
      onMarkCategoryAsRead={onMarkCategoryAsRead}
    />
  );
  return { onMarkCategoryAsRead };
}

describe("NotificationDropdown categories and filter pills", () => {
  it("filters categories, shows unread counts, and marks the selected category", () => {
    const { onMarkCategoryAsRead } = setup();
    fireEvent.click(screen.getByRole("button", { name: /battles.*1/i }));
    expect(screen.getByText("Battle invite")).toBeDefined();
    expect(screen.queryByText("New badge")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark category read" }));
    expect(onMarkCategoryAsRead).toHaveBeenCalledWith("battles");
  });

  it("filters mentions and guilds categories cleanly via filter pills", () => {
    setup();
    expect(screen.getByTestId("notification-filter-pills")).toBeInTheDocument();

    // Mentions filter pill
    fireEvent.click(screen.getByRole("button", { name: /mentions.*1/i }));
    expect(screen.getByText("Mentioned in battle review")).toBeInTheDocument();
    expect(screen.queryByText("Battle invite")).toBeNull();

    // Guilds filter pill
    fireEvent.click(screen.getByRole("button", { name: /guilds.*1/i }));
    expect(screen.getByText("Guild war alert")).toBeInTheDocument();
    expect(screen.queryByText("Mentioned in battle review")).toBeNull();
  });

  it("searches notification history and opens the battle quick action", () => {
    setup();
    fireEvent.change(screen.getByRole("textbox", { name: "Search notifications" }), { target: { value: "battle" } });
    expect(screen.getByText("Battle invite")).toBeDefined();
    expect(screen.queryByText("Sync complete")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "View battle" }));
    expect(push).toHaveBeenCalledWith("/battles");
  });

  it("keeps the existing unread-only filter across categories", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Unread" }));
    expect(screen.getByText("Battle invite")).toBeDefined();
    expect(screen.queryByText("Sync complete")).toBeNull();
  });

  it("calls onClose on keydown Escape and click outside", () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <NotificationDropdown
          isOpen
          onClose={onClose}
          notifications={notices}
          unreadCount={4}
          onMarkAsRead={vi.fn()}
          onMarkAllAsRead={vi.fn()}
          onMarkCategoryAsRead={vi.fn()}
        />
      </div>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
