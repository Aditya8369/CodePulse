"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient, extractData } from "@/lib/api-client";
import { useCurrentUser, useHasAuthToken } from "@/hooks/api/use-auth";
import type { Notification } from "@/types";
import { categoryForNotification, type NotificationCategory } from "@/lib/notification-categories";

type BackendNotification = Omit<Notification, "type"> & { type: string };
const notificationTypes = new Set<Notification["type"]>([
  "achievement", "challenge", "battle", "friend", "system", "level_up",
]);

function normalizeNotification(item: BackendNotification): Notification {
  const type = item.type.toLowerCase() as Notification["type"];
  return { ...item, type: notificationTypes.has(type) ? type : "system" };
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const hasBackendToken = useHasAuthToken();
  const { data: currentUser } = useCurrentUser();
  const queryKey = ["notifications", currentUser?.id] as const;

  const { data: notifications = [] } = useQuery({
    queryKey,
    enabled: hasBackendToken && Boolean(currentUser?.id),
    queryFn: async () => {
      const response = await apiClient.get("/notifications");
      return extractData<BackendNotification[]>(response).map(normalizeNotification);
    },
    retry: false,
    refetchInterval: 60_000,
  });

  const markOne = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/notifications/${encodeURIComponent(id)}/read`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Notification[]>(queryKey);
      queryClient.setQueryData<Notification[]>(queryKey, (items = []) =>
        items.map((item) => item.id === id ? { ...item, isRead: true } : item),
      );
      return { previous };
    },
    onError: (_error, _id, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error("Could not mark notification as read");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markAll = useMutation({
    mutationFn: () => apiClient.patch("/notifications/read-all"),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Notification[]>(queryKey);
      queryClient.setQueryData<Notification[]>(queryKey, (items = []) =>
        items.map((item) => ({ ...item, isRead: true })),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error("Could not mark notifications as read");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const markCategory = useMutation({
    mutationFn: (category: Exclude<NotificationCategory, "all">) =>
      apiClient.patch(`/notifications/read-category/${category}`),
    onMutate: async (category) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Notification[]>(queryKey);
      queryClient.setQueryData<Notification[]>(queryKey, (items = []) =>
        items.map((item) => categoryForNotification(item.type) === category
          ? { ...item, isRead: true } : item),
      );
      return { previous };
    },
    onError: (_error, _category, context) => {
      queryClient.setQueryData(queryKey, context?.previous);
      toast.error("Could not mark category as read");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    notifications,
    unreadCount: notifications.filter((item) => !item.isRead).length,
    markAsRead: (id: string) => markOne.mutate(id),
    markAllAsRead: () => markAll.mutate(),
    markCategoryAsRead: (category: Exclude<NotificationCategory, "all">) => markCategory.mutate(category),
  };
}
