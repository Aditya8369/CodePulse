import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { RadarExportModal, relativeRadarSignals, type RadarDeveloper } from "./radar-export-modal";

type ExportOptions = { width: number; height: number; pixelRatio: number };
type ExportFunction = (node: HTMLElement, options: ExportOptions) => Promise<string>;
const toPng = vi.fn<ExportFunction>(async () => "data:image/png;base64,dGVzdA==");
const toSvg = vi.fn<ExportFunction>(async () => "data:image/svg+xml;base64,dGVzdA==");
vi.mock("html-to-image", () => ({ toPng, toSvg }));

const alice: RadarDeveloper = {
  username: "alice", name: "Alice", avatar: "", score: 420,
  frameworks: { React: 8, "Next.js": 2, FastAPI: 3, Docker: 1 },
  stats: { totalCommits: 120, totalPRs: 20, streak: 7 },
};
const bob: RadarDeveloper = {
  username: "bob", name: "Bob", avatar: "", score: 320,
  frameworks: { React: 5, FastAPI: 6, Docker: 2 },
  stats: { totalCommits: 60, totalPRs: 10, streak: 0 },
};

describe("RadarExportModal", () => {
  beforeEach(() => {
    toPng.mockClear();
    toSvg.mockClear();
  });

  it("maps all six comparable signals, including empty and invalid inputs", () => {
    const [first, second] = relativeRadarSignals(alice, bob);
    expect(first).toEqual({ Frontend: 100, Backend: 50, DevOps: 50, Speed: 100, Reliability: 100, Consistency: 100 });
    expect(second).toEqual({ Frontend: 50, Backend: 100, DevOps: 100, Speed: 50, Reliability: 50, Consistency: 0 });

    const empty: RadarDeveloper = { ...alice, frameworks: {}, stats: { totalCommits: 0, totalPRs: -3, streak: Number.NaN } };
    expect(relativeRadarSignals(empty, empty)[0]).toEqual({ Frontend: 0, Backend: 0, DevOps: 0, Speed: 0, Reliability: 0, Consistency: 0 });
  });

  it("shows an accessible fallback table and follows the open state", () => {
    const view = render(<RadarExportModal isOpen onClose={vi.fn()} first={alice} second={bob}/>);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Frontend")).toBeInTheDocument();
    expect(within(table).getByText("Reliability")).toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(7);
    view.rerender(<RadarExportModal isOpen={false} onClose={vi.fn()} first={alice} second={bob}/>);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exports 2x PNG and SVG from the 1200 by 630 card", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<RadarExportModal isOpen onClose={vi.fn()} first={alice} second={bob}/>);
    fireEvent.click(screen.getByRole("button", { name: /Download PNG/ }));
    await waitFor(() => expect(toPng).toHaveBeenCalledOnce());
    expect(toPng.mock.calls[0][1]).toMatchObject({ width: 1200, height: 630, pixelRatio: 2 });
    fireEvent.click(screen.getByRole("button", { name: /Download SVG/ }));
    await waitFor(() => expect(toSvg).toHaveBeenCalledOnce());
    expect(toSvg.mock.calls[0][1]).toMatchObject({ width: 1200, height: 630, pixelRatio: 1 });
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });

  it("shares a prefilled matchup link on X", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<RadarExportModal isOpen onClose={vi.fn()} first={alice} second={bob}/>);
    fireEvent.click(screen.getByRole("button", { name: "Post on X" }));
    expect(open).toHaveBeenCalledOnce();
    const url = new URL(open.mock.calls[0][0] as string);
    expect(url.hostname).toBe("twitter.com");
    expect(url.searchParams.get("url")).toContain("u1=alice");
    expect(url.searchParams.get("url")).toContain("u2=bob");
    expect(url.searchParams.get("text")).toContain("#NSoC26");
    open.mockRestore();
  });
});
