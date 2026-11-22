import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { ResumeExportModal } from "./resume-export-modal";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ResumeExportModal", () => {
  it("renders verifiable resume dialog with profile data", () => {
    render(<ResumeExportModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId("resume-export-modal-dialog")).toBeInTheDocument();
    expect(screen.getByText("Dipak Kumar")).toBeInTheDocument();
    expect(screen.getByText("2180 ELO")).toBeInTheDocument();
    expect(screen.getByTestId("download-pdf-btn")).toBeInTheDocument();
    expect(screen.getByTestId("copy-verification-link-btn")).toBeInTheDocument();
  });

  it("switches resume themes between Cyber, Clean, and Executive", () => {
    render(<ResumeExportModal isOpen={true} onClose={vi.fn()} />);

    const cleanBtn = screen.getByTestId("theme-opt-clean");
    fireEvent.click(cleanBtn);

    const sheet = screen.getByTestId("resume-document-sheet");
    expect(sheet).toHaveClass("bg-white");

    const execBtn = screen.getByTestId("theme-opt-executive");
    fireEvent.click(execBtn);
    expect(sheet).toHaveClass("bg-[#0B1528]");
  });

  it("toggles visible sections on the document", () => {
    render(<ResumeExportModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId("resume-battle-stats-banner")).toBeInTheDocument();

    const statsToggle = screen.getByLabelText("Toggle Battle and ELO Stats");
    fireEvent.click(statsToggle);

    expect(screen.queryByTestId("resume-battle-stats-banner")).not.toBeInTheDocument();
  });

  it("triggers PDF download callback", async () => {
    const onDownloadMock = vi.fn();
    render(
      <ResumeExportModal
        isOpen={true}
        onClose={vi.fn()}
        onDownload={onDownloadMock}
      />
    );

    const downloadBtn = screen.getByTestId("download-pdf-btn");
    await act(async () => {
      fireEvent.click(downloadBtn);
      await new Promise((r) => setTimeout(r, 900));
    });

    expect(onDownloadMock).toHaveBeenCalled();
  });
});
