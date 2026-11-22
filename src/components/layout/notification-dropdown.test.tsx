import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotificationDropdown } from "./notification-dropdown";
import type { Notification } from "@/types";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const notices: Notification[] = [
  { id: "b", type: "battle", title: "Battle invite", message: "Join now", isRead: false, createdAt: "2026-11-16T12:00:00Z" },
  { id: "a", type: "achievement", title: "New badge", message: "Great work", isRead: false, createdAt: "2026-11-16T12:00:00Z" },
  { id: "s", type: "system", title: "Sync complete", message: "Done", isRead: true, createdAt: "2026-11-16T12:00:00Z" },
];

function setup() {
  const onMarkCategoryAsRead = vi.fn();
  render(<NotificationDropdown isOpen onClose={vi.fn()} notifications={notices} unreadCount={2}
    onMarkAsRead={vi.fn()} onMarkAllAsRead={vi.fn()} onMarkCategoryAsRead={onMarkCategoryAsRead} />);
  return { onMarkCategoryAsRead };
}

describe("NotificationDropdown categories", () => {
  it("filters categories, shows unread counts, and marks the selected category", () => {
    const { onMarkCategoryAsRead } = setup();
    fireEvent.click(screen.getByRole("button", { name: /battles.*1/i }));
    expect(screen.getByText("Battle invite")).toBeDefined();
    expect(screen.queryByText("New badge")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mark category read" }));
    expect(onMarkCategoryAsRead).toHaveBeenCalledWith("battles");
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
          unreadCount={2}
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
