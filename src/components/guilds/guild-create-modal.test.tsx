import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { GuildCreateModal } from "./guild-create-modal";

describe("GuildCreateModal Component", () => {
  it("renders wizard step 1 and validates required fields", () => {
    const handleClose = vi.fn();
    render(<GuildCreateModal isOpen={true} onClose={handleClose} />);

    expect(screen.getByTestId("guild-create-modal")).toBeInTheDocument();
    expect(screen.getByText(/1. Identity & Rules/i)).toBeInTheDocument();

    const nextBtn = screen.getByTestId("guild-wizard-next-btn");
    // Click next without name and tag
    fireEvent.click(nextBtn);
    // Still on step 1 due to validation
    expect(screen.getByTestId("guild-name-input")).toBeInTheDocument();
  });

  it("navigates through steps and triggers onGuildCreated", () => {
    const handleCreated = vi.fn();
    render(<GuildCreateModal isOpen={true} onClose={vi.fn()} onGuildCreated={handleCreated} />);

    // Fill step 1
    fireEvent.change(screen.getByTestId("guild-name-input"), {
      target: { value: "Apex Coders" },
    });
    fireEvent.change(screen.getByTestId("guild-tag-input"), {
      target: { value: "APEX" },
    });
    fireEvent.click(screen.getByTestId("guild-wizard-next-btn"));

    // Step 2: Crest Customizer
    expect(screen.getByText(/2. Custom Crest/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("crest-shape-shield"));
    fireEvent.click(screen.getByTestId("guild-wizard-next-btn"));

    // Step 3: Banner & Launch
    expect(screen.getByText(/3. Banner & Launch/i)).toBeInTheDocument();
    const submitBtn = screen.getByTestId("guild-wizard-submit-btn");
    fireEvent.click(submitBtn);

    expect(handleCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Apex Coders",
        tag: "APEX",
      })
    );
  });
});
