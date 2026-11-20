import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

function stubGithub() {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/repos/owner/repo")) {
      return Response.json({ private: false, default_branch: "main" });
    }
    if (url.includes("/git/trees/main")) {
      return Response.json({
        tree: [
          { path: "src/core/a.ts", type: "blob", size: 10 },
          { path: "src/core/b.ts", type: "blob", size: 20 },
        ],
        truncated: false,
      });
    }
    if (url.includes("/commits?per_page")) {
      return Response.json([{ sha: "abc", author: { login: "ada" }, commit: { author: { name: "Ada" } } }]);
    }
    if (url.includes("/commits/abc")) {
      return Response.json({
        author: { login: "ada" },
        commit: { author: { name: "Ada" } },
        files: [
          { filename: "src/core/a.ts", additions: 10, deletions: 2 },
          { filename: "src/core/b.ts", additions: 5, deletions: 1 },
        ],
      });
    }
    throw new Error(`Unexpected URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("repository universe API", () => {
  it("rejects invalid repository names", async () => {
    const response = await GET(
      new Request("http://localhost/api/github/repository-universe?repo=../secret"),
    );
    expect(response.status).toBe(400);
  });

  it("builds directories, churn metrics, and co-change edges from GitHub data", async () => {
    stubGithub();
    const response = await GET(
      new Request("http://localhost/api/github/repository-universe?repo=owner/repo"),
    );
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.repository).toBe("owner/repo");
    expect(payload.directories.map((directory: { path: string }) => directory.path)).toContain(
      "src/core",
    );
    expect(payload.files).toHaveLength(2);
    expect(payload.files[0].churn).toBe(12);
    expect(payload.files[0].contributors[0].name).toBe("ada");
    expect(payload.edges).toEqual([
      {
        sourceId: "file:src/core/a.ts",
        targetId: "file:src/core/b.ts",
        weight: 1,
      },
    ]);
  });
});
