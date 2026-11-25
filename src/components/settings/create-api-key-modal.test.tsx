import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CreateApiKeyModal } from "./create-api-key-modal";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("CreateApiKeyModal", () => {
  const mockOnClose = vi.fn();
  const mockOnCreateKey = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("validates empty name, short name, and empty scopes before submission", () => {
    render(
      <CreateApiKeyModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateKey={mockOnCreateKey}
      />
    );

    const submitBtn = screen.getByTestId("submit-create-api-key-btn");
    fireEvent.click(submitBtn);
    expect(screen.getByTestId("create-api-key-error")).toHaveTextContent(
      "API key name is required."
    );
    expect(mockOnCreateKey).not.toHaveBeenCalled();

    const nameInput = screen.getByTestId("create-api-key-name-input");
    fireEvent.change(nameInput, { target: { value: "ab" } });
    fireEvent.click(submitBtn);
    expect(screen.getByTestId("create-api-key-error")).toHaveTextContent(
      "API key name must be at least 3 characters."
    );

    fireEvent.change(nameInput, { target: { value: "Production CLI" } });
    fireEvent.click(screen.getByTestId("modal-scope-checkbox-read:analytics"));
    fireEvent.click(screen.getByTestId("modal-scope-checkbox-read:leaderboard"));
    fireEvent.click(submitBtn);
    expect(screen.getByTestId("create-api-key-error")).toHaveTextContent(
      "Select at least one permission scope."
    );
    expect(mockOnCreateKey).not.toHaveBeenCalled();
  });

  it("submits selected scopes and expiration, then renders one-time secret copy dialog with clipboard feedback", async () => {
    mockOnCreateKey.mockResolvedValueOnce({
      id: "key_123",
      name: "GitHub Actions Bot",
      key: "cp_live_9x82abc123def4567890fedcba09876543",
      keyPrefix: "cp_live_9x82...",
      scopes: ["read:analytics", "write:battles", "read:leaderboard"],
      createdAt: "2026-11-25T10:00:00.000Z",
      expiresAt: null,
    });

    render(
      <CreateApiKeyModal
        isOpen={true}
        onClose={mockOnClose}
        onCreateKey={mockOnCreateKey}
      />
    );

    fireEvent.change(screen.getByTestId("create-api-key-name-input"), {
      target: { value: "GitHub Actions Bot" },
    });
    fireEvent.change(screen.getByTestId("create-api-key-expiration-select"), {
      target: { value: "NEVER" },
    });
    fireEvent.click(screen.getByTestId("modal-scope-checkbox-write:battles"));

    fireEvent.click(screen.getByTestId("submit-create-api-key-btn"));

    await waitFor(() => {
      expect(mockOnCreateKey).toHaveBeenCalledWith({
        name: "GitHub Actions Bot",
        scopes: ["read:analytics", "read:leaderboard", "write:battles"],
        expiresAt: undefined,
        expirationLabel: "Never",
      });
    });

    expect(screen.getByTestId("one-time-secret-dialog")).toBeInTheDocument();
    expect(screen.getByTestId("one-time-secret-warning")).toHaveTextContent(
      "Copy this key now. You will not be able to see it again."
    );
    expect(screen.getByTestId("generated-secret-key-value")).toHaveTextContent(
      "cp_live_9x82abc123def4567890fedcba09876543"
    );

    const tooltip = screen.getByTestId("copy-secret-tooltip");
    expect(tooltip).toHaveTextContent("Copy to clipboard");

    fireEvent.click(screen.getByTestId("copy-secret-key-btn"));

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "cp_live_9x82abc123def4567890fedcba09876543"
      );
      expect(screen.getByTestId("copy-secret-tooltip")).toHaveTextContent("Copied!");
    });
  });
});

