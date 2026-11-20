import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

afterEach(() => vi.unstubAllGlobals());

describe("repository inspector API", () => {
  it("rejects invalid repository names without calling GitHub", async () => {
    const github = vi.fn();
    vi.stubGlobal("fetch", github);
    const response = await GET(new Request("http://localhost/api/github/repository-inspector?repo=../secret"));
    expect(response.status).toBe(400);
    expect(github).not.toHaveBeenCalled();
  });

  it("does not expose a private repository visible to the server token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ private: true })));
    const response = await GET(new Request("http://localhost/api/github/repository-inspector?repo=owner/private"));
    expect(response.status).toBe(403);
  });

  it("uses GitHub byte counts and reports unavailable activity honestly", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string) => {
      const url = new URL(input);
      if (url.pathname.endsWith("/languages")) return Response.json({ TypeScript: 300, CSS: 100 });
      if (url.pathname.endsWith("/stats/punch_card")) return new Response(null, { status: 202 });
      if (url.pathname.endsWith("/readme")) return new Response(null, { status: 404 });
      if (url.pathname.endsWith("/CONTRIBUTING.md")) return new Response(null, { status: 404 });
      if (url.pathname.endsWith("/.github/workflows")) return Response.json([{ name: "test.yml" }]);
      if (url.pathname.endsWith("/commits")) return Response.json([{ commit: { committer: { date: "2026-11-01T00:00:00Z" } } }]);
      if (url.pathname.endsWith("/pulls")) return Response.json([{}], {
        headers: { link: '<https://api.github.com/repos/owner/project/pulls?state=open&per_page=1&page=4>; rel="last"' },
      });
      if (url.pathname.endsWith("/branches")) return Response.json([{ name: "main" }, { name: "feature" }]);
      if (url.pathname.endsWith("/search/issues")) {
        return Response.json({ total_count: url.searchParams.get("q")?.endsWith("is:open") ? 2 : 8 });
      }
      return Response.json({
        full_name: "owner/project", html_url: "https://github.com/owner/project", private: false,
        license: { spdx_id: "MIT" }, stargazers_count: 12, forks_count: 3,
      });
    }));

    const response = await GET(new Request("http://localhost/api/github/repository-inspector?repo=owner/project"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.languages).toEqual([
      { language: "TypeScript", bytes: 300, percentage: 75, color: "#3178c6" },
      { language: "CSS", bytes: 100, percentage: 25, color: "#563d7c" },
    ]);
    expect(data.punchcard).toBeNull();
    expect(data.openPullRequests).toBe(4);
    expect(data.health).toEqual({
      hasReadme: false, hasLicense: true, openIssues: 2, closedIssues: 8,
      hasContributing: false, hasCi: true, lastCommitAt: "2026-11-01T00:00:00Z",
    });
  });
});
