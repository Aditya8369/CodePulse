import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommitPunchcard } from "./commit-punchcard";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api-client", () => ({
  apiClient: { get },
  extractData: (response: { data: { data: unknown } }) => response.data.data,
}));

const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
matrix[0][9] = 2;
matrix[6][14] = 18;

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><CommitPunchcard repositoryId="repo-1" localTimezone="Asia/Kolkata" /></QueryClientProvider>);
}

describe("CommitPunchcard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    get.mockImplementation(async (url: string) => ({ data: { data: {
      repositoryId: "repo-1", timezone: url.includes("Asia%2FKolkata") ? "Asia/Kolkata" : "UTC",
      matrix, sampledCommits: 20, truncated: false,
    } } }));
  });

  it("renders a 7 by 24 grid and reveals exact counts and weekend percentage", async () => {
    setup();
    await waitFor(() => expect(screen.getByRole("img", { name: /Sunday, 14:00 — 18 commits/ })).toBeDefined());
    expect(document.querySelector("svg[role='img']")).not.toBeNull();
    fireEvent.mouseEnter(screen.getByRole("img", { name: /Sunday, 14:00 — 18 commits/ }));
    expect(screen.getByRole("status").textContent).toContain("18 commits (100% of weekend activity)");
    expect(document.querySelectorAll("svg g[role='img']")).toHaveLength(168);
  });

  it("requests the local IANA timezone when the selector changes", async () => {
    setup();
    await waitFor(() => expect(get).toHaveBeenCalledWith("/analytics/repository/repo-1/commit-punchcard?timezone=UTC"));
    fireEvent.change(screen.getByRole("combobox", { name: "Punchcard timezone" }), { target: { value: "local" } });
    await waitFor(() => expect(get).toHaveBeenCalledWith("/analytics/repository/repo-1/commit-punchcard?timezone=Asia%2FKolkata"));
  });
});
