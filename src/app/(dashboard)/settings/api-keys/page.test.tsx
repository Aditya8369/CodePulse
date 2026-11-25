import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import ApiKeysSettingsPage from "./page";
import { apiClient } from "@/lib/api-client";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("ApiKeysSettingsPage (/settings/api-keys)", () => {
  const sampleKeys = [
    {
      id: "key_1",
      name: "CI/CD Pipeline Runner",
      keyPrefix: "cp_live_9x82...",
      scopes: ["read:analytics", "write:battles"],
      createdAt: "2026-11-15T10:30:00.000Z",
      lastUsedAt: "2026-11-25T08:15:00.000Z",
      expiresAt: "2027-02-13T10:30:00.000Z",
    },
    {
      id: "key_2",
      name: "Local CLI Token",
      keyPrefix: "cp_live_41a0...",
      scopes: ["read:leaderboard"],
      createdAt: "2026-11-18T14:20:00.000Z",
      lastUsedAt: null,
      expiresAt: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.get).mockResolvedValue({ data: sampleKeys });
    vi.mocked(apiClient.delete).mockResolvedValue({ data: { success: true } });
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders table of active API keys with prefixes, scopes, dates, and revoke action", async () => {
    render(<ApiKeysSettingsPage />);

    expect(screen.getByTestId("api-keys-page-container")).toBeInTheDocument();
    expect(screen.getByTestId("back-to-settings-link")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("api-keys-active-count")).toHaveTextContent("2 Active");
    });

    expect(screen.getByTestId("api-keys-table")).toBeInTheDocument();
    expect(screen.getByText("CI/CD Pipeline Runner")).toBeInTheDocument();
    expect(screen.getByText("cp_live_9x82...")).toBeInTheDocument();
    expect(screen.getByText("read:analytics")).toBeInTheDocument();
    expect(screen.getByText("write:battles")).toBeInTheDocument();
    expect(screen.getByText("Local CLI Token")).toBeInTheDocument();
    expect(screen.getByTestId("revoke-api-key-btn-key_1")).toBeInTheDocument();
  });

  it("creates a new API key through the modal and displays the one-time secret dialog", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        id: "key_3",
        name: "Analytics Exporter",
        key: "cp_live_777788889999aaaabbbbccccddddeeee",
        keyPrefix: "cp_live_7777...",
        scopes: ["read:analytics", "read:leaderboard"],
        createdAt: "2026-11-25T12:00:00.000Z",
        expiresAt: null,
      },
    });

    render(<ApiKeysSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("api-keys-active-count")).toHaveTextContent("2 Active");
    });

    fireEvent.click(screen.getByTestId("open-create-api-key-modal-btn"));
    expect(screen.getByTestId("create-api-key-modal")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("create-api-key-name-input"), {
      target: { value: "Analytics Exporter" },
    });
    fireEvent.click(screen.getByTestId("submit-create-api-key-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("one-time-secret-dialog")).toBeInTheDocument();
    });

    expect(screen.getByTestId("generated-secret-key-value")).toHaveTextContent(
      "cp_live_777788889999aaaabbbbccccddddeeee"
    );

    fireEvent.click(screen.getByTestId("done-secret-dialog-btn"));

    expect(screen.queryByTestId("one-time-secret-dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Analytics Exporter")).toBeInTheDocument();
    expect(screen.getByTestId("api-keys-active-count")).toHaveTextContent("3 Active");
  });

  it("opens revocation confirmation modal and removes key when confirmed", async () => {
    render(<ApiKeysSettingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId("api-keys-active-count")).toHaveTextContent("2 Active");
    });

    // Click revoke on key_1
    fireEvent.click(screen.getByTestId("revoke-api-key-btn-key_1"));
    expect(screen.getByTestId("revoke-api-key-modal")).toBeInTheDocument();

    // Cancel first
    fireEvent.click(screen.getByTestId("cancel-revoke-api-key-btn"));
    expect(screen.queryByTestId("revoke-api-key-modal")).not.toBeInTheDocument();
    expect(screen.getByText("CI/CD Pipeline Runner")).toBeInTheDocument();

    // Re-open and confirm
    fireEvent.click(screen.getByTestId("revoke-api-key-btn-key_1"));
    fireEvent.click(screen.getByTestId("confirm-revoke-api-key-btn"));

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith("/api-keys/key_1");
      expect(screen.queryByText("CI/CD Pipeline Runner")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("api-keys-active-count")).toHaveTextContent("1 Active");
  });
});

