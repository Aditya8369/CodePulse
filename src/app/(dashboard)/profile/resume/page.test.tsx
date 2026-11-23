import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import ResumeBuilderPage from "./page";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/hooks/api/use-auth", () => ({
  useCurrentUser: () => ({
    data: {
      name: "Pratik Giri",
      username: "pratik-dev",
      email: "pratik@codepulse.dev",
      bio: "Distributed Cloud Architect",
      rating: { overall: 2450, tier: "Grandmaster" },
      stats: { totalStars: 3200, totalPRs: 65, totalCommits: 1200 },
    },
    isLoading: false,
  }),
}));

describe("ResumeBuilderPage - Interactive Resume Customizer & Live Preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders customizer controls and live resume sheet side by side", () => {
    render(<ResumeBuilderPage />);

    expect(screen.getByText("Developer Resume Builder")).toBeInTheDocument();
    expect(screen.getByTestId("copy-public-resume-link-btn")).toBeInTheDocument();
    expect(screen.getByTestId("download-pdf-resume-btn")).toBeInTheDocument();

    // Verify live sheet rendered with prefilled user data
    expect(screen.getByTestId("resume-candidate-name")).toHaveTextContent("Pratik Giri");
    expect(screen.getByTestId("resume-elo-val")).toHaveTextContent("2450 ELO");
  });

  it("allows switching tabs between Layout, Sections, and Content", () => {
    render(<ResumeBuilderPage />);

    // Click sections tab
    const sectionsTab = screen.getByTestId("tab-sections");
    fireEvent.click(sectionsTab);

    expect(screen.getByTestId("toggle-elo-rating")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-projects")).toBeInTheDocument();

    // Click content tab
    const contentTab = screen.getByTestId("tab-content");
    fireEvent.click(contentTab);

    expect(screen.getByTestId("input-candidate-name")).toHaveValue("Pratik Giri");
  });

  it("updates live preview dynamically when candidate edits content in the customizer", () => {
    render(<ResumeBuilderPage />);

    const contentTab = screen.getByTestId("tab-content");
    fireEvent.click(contentTab);

    const nameInput = screen.getByTestId("input-candidate-name");
    fireEvent.change(nameInput, { target: { value: "Linus Torvalds" } });

    expect(screen.getByTestId("resume-candidate-name")).toHaveTextContent("Linus Torvalds");
  });

  it("toggles Elo rating section on the live sheet via customizer checkbox", () => {
    render(<ResumeBuilderPage />);

    expect(screen.getByTestId("resume-elo-rating-section")).toBeInTheDocument();

    const sectionsTab = screen.getByTestId("tab-sections");
    fireEvent.click(sectionsTab);

    const eloToggle = screen.getByTestId("toggle-elo-rating");
    fireEvent.click(eloToggle);

    expect(screen.queryByTestId("resume-elo-rating-section")).not.toBeInTheDocument();
  });

  it("triggers PDF download via window.print()", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});

    render(<ResumeBuilderPage />);

    const downloadBtn = screen.getByTestId("download-pdf-resume-btn");
    await act(async () => {
      fireEvent.click(downloadBtn);
      await new Promise((r) => setTimeout(r, 500));
    });

    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });

  it("copies public resume link to clipboard with toast notification", () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(<ResumeBuilderPage />);

    const copyBtn = screen.getByTestId("copy-public-resume-link-btn");
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("https://codepulse.dev/resume/")
    );
  });

  it("resets customizer options and data back to defaults", () => {
    render(<ResumeBuilderPage />);

    const contentTab = screen.getByTestId("tab-content");
    fireEvent.click(contentTab);

    const nameInput = screen.getByTestId("input-candidate-name");
    fireEvent.change(nameInput, { target: { value: "Temporary Name" } });
    expect(screen.getByTestId("resume-candidate-name")).toHaveTextContent("Temporary Name");

    const resetBtn = screen.getByTestId("reset-customizer-btn");
    fireEvent.click(resetBtn);

    expect(screen.getByTestId("resume-candidate-name")).toHaveTextContent("Alex Chen");
  });
});
