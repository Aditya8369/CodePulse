import { NextResponse } from "next/server";

const GITHUB_API = "https://api.github.com";
const REPOSITORY_NAME = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const MAX_FILES = 10000;
const MAX_COMMITS = 40;
const MAX_COCHANGE_LINKS = 20000;

interface GithubTreeEntry {
  path: string;
  type: string;
  size?: number;
}

interface GithubCommitListEntry {
  sha: string;
  author: { login?: string } | null;
  commit: { author: { name?: string } };
}

interface GithubCommitFile {
  filename: string;
  previous_filename?: string;
  additions?: number;
  deletions?: number;
  status?: string;
}

interface GithubCommitDetail {
  author: { login?: string } | null;
  commit: { author: { name?: string } };
  files?: GithubCommitFile[];
}

interface DirectoryNode {
  id: string;
  path: string;
  name: string;
  parentId: string | null;
  depth: number;
}

interface FileNode {
  id: string;
  path: string;
  name: string;
  directoryId: string;
  churn: number;
  commits: number;
  additions: number;
  deletions: number;
  contributors: { id: string; name: string; commits: number }[];
}

interface EdgeNode {
  sourceId: string;
  targetId: string;
  weight: number;
}

async function githubFetch(path: string, signal?: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return fetch(`${GITHUB_API}${path}`, {
    headers,
    signal,
    next: { revalidate: 3600 },
  } as RequestInit);
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function GET(request: Request) {
  const repo = new URL(request.url).searchParams.get("repo")?.trim() ?? "";
  if (!REPOSITORY_NAME.test(repo) || repo.includes("..")) {
    return NextResponse.json({ error: "Invalid repository name." }, { status: 400 });
  }

  try {
    const repositoryResponse = await githubFetch(`/repos/${repo}`, request.signal);
    if (repositoryResponse.status === 404) {
      return NextResponse.json({ error: "Repository not found." }, { status: 404 });
    }
    if (!repositoryResponse.ok) {
      return NextResponse.json({ error: "Could not load repository." }, { status: 502 });
    }
    const repository = (await repositoryResponse.json()) as {
      private: boolean;
      default_branch: string;
    };
    if (repository.private) {
      return NextResponse.json(
        { error: "Private repository inspection is unavailable." },
        { status: 403 },
      );
    }

    const branch = encodeURIComponent(repository.default_branch || "main");
    const treeResponse = await githubFetch(
      `/repos/${repo}/git/trees/${branch}?recursive=1`,
      request.signal,
    );
    if (!treeResponse.ok) {
      return NextResponse.json({ error: "Could not load repository tree." }, { status: 502 });
    }
    const tree = (await treeResponse.json()) as {
      tree: GithubTreeEntry[];
      truncated: boolean;
    };

    const paths = tree.tree
      .filter((entry) => entry.type === "blob" && entry.path && !entry.path.includes(".."))
      .map((entry) => entry.path)
      .filter((path, index, all) => all.indexOf(path) === index)
      .sort()
      .slice(0, MAX_FILES);

    const directoryPaths = new Set<string>();
    for (const path of paths) {
      const segments = path.split("/");
      for (let depth = 1; depth < segments.length; depth += 1) {
        directoryPaths.add(segments.slice(0, depth).join("/"));
      }
    }
    const directories: DirectoryNode[] = Array.from(directoryPaths)
      .sort()
      .map((path) => {
        const segments = path.split("/");
        return {
          id: `dir:${path}`,
          path,
          name: segments[segments.length - 1],
          parentId: segments.length > 1 ? `dir:${segments.slice(0, -1).join("/")}` : null,
          depth: segments.length - 1,
        };
      });

    const commitsResponse = await githubFetch(
      `/repos/${repo}/commits?per_page=${MAX_COMMITS}`,
      request.signal,
    );
    const commitList: GithubCommitListEntry[] = commitsResponse.ok
      ? ((await commitsResponse.json()) as GithubCommitListEntry[])
      : [];

    const commitDetails = await mapWithConcurrency(
      commitList.filter((commit) => commit?.sha),
      6,
      async (commit) => {
        try {
          const response = await githubFetch(
            `/repos/${repo}/commits/${encodeURIComponent(commit.sha)}`,
            request.signal,
          );
          return response.ok ? ((await response.json()) as GithubCommitDetail) : null;
        } catch {
          return null;
        }
      },
    );

    const churn = new Map<string, { additions: number; deletions: number; commits: number }>();
    const authors = new Map<string, Map<string, number>>();
    const coChange = new Map<string, number>();

    for (const detail of commitDetails) {
      if (!detail) continue;
      const authorName =
        detail.author?.login ||
        detail.commit?.author?.name ||
        "unknown";
      const changed = (detail.files ?? [])
        .map((file) => file.filename)
        .filter((path) => paths.includes(path));
      const uniqueChanged = Array.from(new Set(changed)).sort();

      for (const file of detail.files ?? []) {
        const path = paths.includes(file.filename) ? file.filename : null;
        if (!path) continue;
        const stats = churn.get(path) ?? { additions: 0, deletions: 0, commits: 0 };
        stats.additions += file.additions ?? 0;
        stats.deletions += file.deletions ?? 0;
        stats.commits += 1;
        churn.set(path, stats);

        const fileAuthors = authors.get(path) ?? new Map<string, number>();
        fileAuthors.set(authorName, (fileAuthors.get(authorName) ?? 0) + 1);
        authors.set(path, fileAuthors);
      }

      for (let index = 0; index < uniqueChanged.length; index += 1) {
        for (let next = index + 1; next < Math.min(uniqueChanged.length, index + 4); next += 1) {
          const key = `${uniqueChanged[index]}\u0000${uniqueChanged[next]}`;
          coChange.set(key, (coChange.get(key) ?? 0) + 1);
        }
      }
    }

    const files: FileNode[] = paths.map((path) => {
      const stats = churn.get(path) ?? { additions: 0, deletions: 0, commits: 0 };
      const segments = path.split("/");
      const directoryPath = segments.slice(0, -1).join("/");
      const contributors = Array.from(authors.get(path) ?? new Map<string, number>())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, commits], index) => ({ id: `author-${index}-${name}`, name, commits }));

      return {
        id: `file:${path}`,
        path,
        name: segments[segments.length - 1],
        directoryId: directoryPath ? `dir:${directoryPath}` : "dir:src",
        churn: stats.additions + stats.deletions,
        commits: stats.commits,
        additions: stats.additions,
        deletions: stats.deletions,
        contributors,
      };
    });

    const edges: EdgeNode[] = Array.from(coChange.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_COCHANGE_LINKS)
      .map(([key, weight]) => {
        const [source, target] = key.split("\u0000");
        return { sourceId: `file:${source}`, targetId: `file:${target}`, weight };
      });

    return NextResponse.json({
      repository: repo,
      truncated: tree.truncated,
      sampledCommits: commitDetails.filter(Boolean).length,
      directories,
      files,
      edges,
    });
  } catch {
    return NextResponse.json(
      { error: "The knowledge universe could not be loaded." },
      { status: 502 },
    );
  }
}
