import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { ApiKeysPanel } from "./api-keys-panel";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("ApiKeysPanel", () => {
  it("renders API keys panel with initial keys list and count badge", () => {
    render(<ApiKeysPanel />);

    expect(screen.getByTestId("api-keys-panel-container")).toBeInTheDocument();
    expect(screen.getByTestId("api-keys-count-badge")).toHaveTextContent("2 Active");
    expect(screen.getByText("CI/CD Pipeline Runner")).toBeInTheDocument();
    expect(screen.getByText("Local Development CLI Token")).toBeInTheDocument();
  });

  it("opens drawer and generates a new API key with selected scopes", () => {
    const onKeyCreatedMock = vi.fn();
    render(<ApiKeysPanel onKeyCreated={onKeyCreatedMock} />);

    // Open drawer
    const openBtn = screen.getByTestId("open-generate-key-drawer-btn");
    fireEvent.click(openBtn);

    expect(screen.getByTestId("generate-key-drawer")).toBeInTheDocument();

    // Fill key name
    const nameInput = screen.getByTestId("api-key-name-input");
    fireEvent.change(nameInput, { target: { value: "Automated Benchmark Daemon" } });

    // Submit form
    const submitBtn = screen.getByTestId("submit-generate-key-btn");
    fireEvent.click(submitBtn);

    // Verify key created and secret revealed
    expect(onKeyCreatedMock).toHaveBeenCalled();
    expect(screen.getByTestId("new-secret-reveal-banner")).toBeInTheDocument();
    expect(screen.getByText("Automated Benchmark Daemon")).toBeInTheDocument();
  });

  it("revokes an API key on button click", () => {
    const onKeyRevokedMock = vi.fn();
    render(<ApiKeysPanel onKeyRevoked={onKeyRevokedMock} />);

    const revokeBtn = screen.getByTestId("revoke-key-btn-key_prod_1");
    fireEvent.click(revokeBtn);

    expect(onKeyRevokedMock).toHaveBeenCalledWith("key_prod_1");
    expect(screen.queryByText("CI/CD Pipeline Runner")).not.toBeInTheDocument();
    expect(screen.getByTestId("api-keys-count-badge")).toHaveTextContent("1 Active");
  });
});
