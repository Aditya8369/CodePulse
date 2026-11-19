import type {
  UniverseContributor,
  UniverseData,
  UniverseDirectory,
  UniverseEdge,
  UniverseFile,
} from "@/components/visualization/universe-types";

const CONTRIBUTORS: UniverseContributor[] = [
  { id: "author-0", name: "ada", commits: 12 },
  { id: "author-1", name: "linus", commits: 7 },
];

const DIRECTORIES: UniverseDirectory[] = [
  { id: "dir:src", path: "src", name: "src", parentId: null, depth: 0 },
  { id: "dir:src/core", path: "src/core", name: "core", parentId: "dir:src", depth: 1 },
  { id: "dir:src/core/git", path: "src/core/git", name: "git", parentId: "dir:src/core", depth: 2 },
  { id: "dir:src/ui", path: "src/ui", name: "ui", parentId: "dir:src", depth: 1 },
];

export function createTestUniverse(fileCount = 24): UniverseData {
  const files: UniverseFile[] = Array.from({ length: fileCount }, (_, index) => {
    const churn = 1 + ((index * 17) % 43);
    const path = `src/${index % 2 === 0 ? "core/git" : "ui"}/file-${index}.ts`;
    return {
      id: `file:${path}`,
      path,
      name: `file-${index}.ts`,
      directoryId: index % 2 === 0 ? "dir:src/core/git" : "dir:src/ui",
      churn,
      commits: Math.max(1, Math.round(churn / 2)),
      additions: churn * 2,
      deletions: churn,
      contributors: index % 3 === 0 ? CONTRIBUTORS : [CONTRIBUTORS[0]],
    };
  });

  const edges: UniverseEdge[] = files.slice(1).map((file, index) => ({
    sourceId: files[index].id,
    targetId: file.id,
    weight: 1 + (index % 9),
  }));

  return {
    repository: "owner/repo",
    directories: DIRECTORIES,
    files,
    edges,
  };
}
