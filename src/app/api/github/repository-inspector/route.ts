import { NextResponse } from "next/server";
import { LANGUAGE_COLORS } from "@/lib/constants";

const GITHUB_API = "https://api.github.com";
const REPOSITORY_NAME = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

function githubFetch(path: string) {
  const token = process.env.GITHUB_TOKEN;
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate: 3600 },
  });
}

async function issueCount(fullName: string, state: "open" | "closed") {
  const query = encodeURIComponent(`repo:${fullName} is:issue is:${state}`);
  const response = await githubFetch(`/search/issues?q=${query}&per_page=1`);
  if (!response.ok) return null;
  const data = await response.json();
  return typeof data.total_count === "number" ? data.total_count : null;
}

function pageCount(response: Response, fallback: number) {
  const last = response.headers.get("link")?.match(/[?&]page=(\d+)[^>]*>; rel="last"/);
  return last ? Number(last[1]) : fallback;
}

export async function GET(request: Request) {
  const fullName = new URL(request.url).searchParams.get("repo")?.trim() || "";
  if (!REPOSITORY_NAME.test(fullName) || fullName.includes("..")) {
    return NextResponse.json({ error: "A valid owner/repository is required." }, { status: 400 });
  }

  const [owner, name] = fullName.split("/");
  const repoPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;
  try {
    const repositoryResponse = await githubFetch(repoPath);
    if (!repositoryResponse.ok) {
      return NextResponse.json(
        { error: repositoryResponse.status === 404 ? "Repository not found." : "GitHub repository data is unavailable." },
        { status: repositoryResponse.status === 404 ? 404 : 502 },
      );
    }
    const repository = await repositoryResponse.json();
    // The server token may see private repositories that the current viewer cannot.
    if (repository.private) {
      return NextResponse.json({ error: "Private repository inspection is unavailable." }, { status: 403 });
    }

    const [languagesResponse, punchcardResponse, readmeResponse, openIssues, closedIssues, pullsResponse, branchesResponse, contributingResponse, workflowsResponse, commitsResponse] =
      await Promise.all([
        githubFetch(`${repoPath}/languages`),
        githubFetch(`${repoPath}/stats/punch_card`),
        githubFetch(`${repoPath}/readme`),
        issueCount(fullName, "open"),
        issueCount(fullName, "closed"),
        githubFetch(`${repoPath}/pulls?state=open&per_page=1`),
        githubFetch(`${repoPath}/branches?per_page=10`),
        githubFetch(`${repoPath}/contents/CONTRIBUTING.md`),
        githubFetch(`${repoPath}/contents/.github/workflows`),
        githubFetch(`${repoPath}/commits?per_page=1`),
      ]);

    const languageBytes: Record<string, number> = languagesResponse.ok ? await languagesResponse.json() : {};
    const totalBytes = Object.values(languageBytes).reduce((sum, bytes) => sum + bytes, 0);
    const languages = Object.entries(languageBytes)
      .sort((a, b) => b[1] - a[1])
      .map(([language, bytes]) => ({
        language,
        bytes,
        percentage: totalBytes > 0 ? (bytes / totalBytes) * 100 : 0,
        color: LANGUAGE_COLORS[language] || "#8b95a7",
      }));

    // GitHub returns 202 while its statistics cache is being generated.
    const punchcard = punchcardResponse.status === 200 ? await punchcardResponse.json() : null;
    const pulls = pullsResponse.ok ? await pullsResponse.json() : null;
    const branches = branchesResponse.ok ? await branchesResponse.json() : null;
    const workflows = workflowsResponse.ok ? await workflowsResponse.json() : null;
    const commits = commitsResponse.ok ? await commitsResponse.json() : null;
    // GitHub also supports contribution guidelines inside .github/.
    const contributing = contributingResponse.status === 404
      ? await githubFetch(`${repoPath}/contents/.github/CONTRIBUTING.md`)
      : contributingResponse;

    return NextResponse.json({
      fullName: repository.full_name,
      url: repository.html_url,
      isPrivate: false,
      license: repository.license?.spdx_id || repository.license?.name || null,
      stars: repository.stargazers_count,
      forks: repository.forks_count,
      openPullRequests: Array.isArray(pulls) ? pageCount(pullsResponse, pulls.length) : null,
      languages,
      punchcard: Array.isArray(punchcard) ? punchcard : null,
      health: {
        hasReadme: readmeResponse.status === 200 ? true : readmeResponse.status === 404 ? false : null,
        hasLicense: Boolean(repository.license),
        openIssues,
        closedIssues,
        hasContributing: contributing.status === 200 ? true : contributing.status === 404 ? false : null,
        hasCi: Array.isArray(workflows) ? workflows.some((file: { name?: string }) => /\.ya?ml$/i.test(file.name || "")) : workflowsResponse.status === 404 ? false : null,
        lastCommitAt: Array.isArray(commits) ? commits[0]?.commit?.committer?.date || commits[0]?.commit?.author?.date || "" : null,
      },
      branches: Array.isArray(branches) ? branches.map((branch: { name: string }) => branch.name) : [],
    });
  } catch {
    return NextResponse.json({ error: "GitHub repository data is unavailable." }, { status: 502 });
  }
}
