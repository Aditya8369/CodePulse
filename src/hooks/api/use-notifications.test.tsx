import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useNotifications } from "./use-notifications";

const { get, patch, toastError } = vi.hoisted(() => ({
  get: vi.fn(), patch: vi.fn(), toastError: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: { get, patch },
  extractData: (response: { data: { data: unknown } }) => response.data.data,
}));
vi.mock("@/hooks/api/use-auth", () => ({
  useHasAuthToken: () => true,
  useCurrentUser: () => ({ data: { id: "owner" } }),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

const notification = {
  id: "notice-1", type: "BATTLE", title: "Battle won", message: "Nice work",
  isRead: false, createdAt: "2026-11-16T12:00:00Z",
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...renderHook(() => useNotifications(), { wrapper }), client };
}

describe("useNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue({ data: { data: [notification] } });
    patch.mockResolvedValue({ data: { data: {} } });
  });

  it("loads database notifications, normalizes types, and marks one read", async () => {
    patch.mockImplementationOnce(async () => {
      get.mockResolvedValue({ data: { data: [{ ...notification, isRead: true }] } });
      return { data: { data: {} } };
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(result.current.notifications[0].type).toBe("battle");
    act(() => result.current.markAsRead("notice-1"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/notifications/notice-1/read"));
    await waitFor(() => expect(result.current.unreadCount).toBe(0));
  });

  it("syncs mark-all and restores unread state if the request fails", async () => {
    patch.mockRejectedValueOnce(new Error("network"));
    const { result } = setup();
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    act(() => result.current.markAllAsRead());
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/notifications/read-all"));
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
  });

  it("optimistically marks only the selected category and calls its endpoint", async () => {
    get.mockResolvedValue({ data: { data: [notification, { ...notification, id: "notice-2", type: "SYSTEM" }] } });
    patch.mockImplementationOnce(async () => {
      get.mockResolvedValue({ data: { data: [{ ...notification, isRead: true }, { ...notification, id: "notice-2", type: "SYSTEM" }] } });
      return { data: { data: { count: 1 } } };
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.unreadCount).toBe(2));
    act(() => result.current.markCategoryAsRead("battles"));
    await waitFor(() => expect(patch).toHaveBeenCalledWith("/notifications/read-category/battles"));
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(result.current.notifications.find((item) => item.id === "notice-2")?.isRead).toBe(false);
  });
});
