import type {
  DeviceProfile,
  LodConfig,
  UniverseData,
  UniverseDirectory,
  UniverseLayout,
  UniverseLink,
  UniverseNode,
} from "./universe-types";

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const DIRECTORY_COLORS = [
  "#8b5cf6",
  "#6366f1",
  "#3b82f6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ec4899",
];

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function churnToRadius(churn: number): number {
  return Math.min(1.55, 0.24 + Math.log1p(Math.max(0, churn)) * 0.16);
}

export function churnToGlow(churn: number): number {
  const normalized = Math.log1p(Math.max(0, churn)) / Math.log(501);
  return 0.32 + Math.min(1, normalized) * 0.68;
}

function directoryColor(depth: number, id: string): string {
  return DIRECTORY_COLORS[(depth + hashString(id)) % DIRECTORY_COLORS.length];
}

function sortedDirectories(directories: UniverseDirectory[]): UniverseDirectory[] {
  return [...directories].sort(
    (a, b) => a.depth - b.depth || a.path.localeCompare(b.path),
  );
}

export function mapDirectoriesToClusters(
  directories: UniverseDirectory[],
): Map<string, [number, number, number]> {
  const centers = new Map<string, [number, number, number]>();
  const rootClusters = sortedDirectories(directories).filter((dir) => !dir.parentId);
  const totalRoots = Math.max(1, rootClusters.length);

  rootClusters.forEach((dir, index) => {
    const seed = hashString(dir.id);
    const angle = (index / totalRoots) * Math.PI * 2 + GOLDEN_ANGLE;
    const distance = 13 + Math.sqrt(index + 1) * 5;
    const height = (((seed % 2000) / 2000) - 0.5) * 10;
    centers.set(dir.id, [
      Math.cos(angle) * distance,
      height,
      Math.sin(angle) * distance,
    ]);
  });

  sortedDirectories(directories)
    .filter((dir) => dir.parentId)
    .forEach((dir) => {
      const parent = centers.get(dir.parentId as string) ?? [0, 0, 0];
      const seed = hashString(dir.id);
      const angle = (seed % 6283) / 1000 + dir.depth * GOLDEN_ANGLE;
      const distance = 5 + Math.sqrt(dir.depth + 1) * 2.5 + (seed % 7) * 0.4;
      centers.set(dir.id, [
        parent[0] + Math.cos(angle) * distance,
        parent[1] + (((seed >>> 8) % 1000) / 1000 - 0.5) * 6,
        parent[2] + Math.sin(angle) * distance,
      ]);
    });

  return centers;
}

export function mapFileToOrbit(
  center: [number, number, number],
  index: number,
  churn: number,
  fileId: string,
): [number, number, number] {
  const seed = hashString(fileId);
  const angle = index * GOLDEN_ANGLE + (seed % 1000) / 1000;
  const radius = 2.3 + Math.sqrt((index % 64) + 1) * 0.52 + churnToRadius(churn) * 0.8;
  const tilt = (((seed >>> 10) % 1000) / 1000 - 0.5) * 2.4;

  return [
    center[0] + Math.cos(angle) * radius,
    center[1] + tilt + Math.sin(angle * 0.6) * radius * 0.22,
    center[2] + Math.sin(angle) * radius,
  ];
}

export function buildUniverseLayout(data: UniverseData): UniverseLayout {
  const centers = mapDirectoriesToClusters(data.directories);
  const directoryNodes: UniverseNode[] = data.directories.map((directory) => {
    const churn = data.files
      .filter((file) => file.directoryId === directory.id)
      .reduce((total, file) => total + file.churn, 0);
    return {
      id: directory.id,
      kind: "directory",
      label: directory.name,
      path: directory.path,
      directoryId: directory.id,
      parentId: directory.parentId,
      depth: directory.depth,
      churn,
      position: centers.get(directory.id) ?? [0, 0, 0],
      radius: Math.min(2.8, 0.7 + Math.log1p(churn) * 0.24),
      glow: churnToGlow(churn),
      color: directoryColor(directory.depth, directory.id),
    };
  });

  const orderedFiles = [...data.files].sort((a, b) => a.path.localeCompare(b.path));
  const fileNodes: UniverseNode[] = orderedFiles.map((file, index) => {
    const center = centers.get(file.directoryId) ?? [0, 0, 0];
    const directory = data.directories.find((item) => item.id === file.directoryId);
    return {
      id: file.id,
      kind: "file",
      label: file.name,
      path: file.path,
      directoryId: file.directoryId,
      parentId: file.directoryId,
      depth: (directory?.depth ?? 0) + 1,
      churn: file.churn,
      position: mapFileToOrbit(center, index, file.churn, file.id),
      radius: churnToRadius(file.churn),
      glow: churnToGlow(file.churn),
      color: directoryColor((directory?.depth ?? 0) + 1, file.directoryId),
      file,
    };
  });

  const nodes = [...directoryNodes, ...fileNodes];
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links: UniverseLink[] = data.edges.flatMap((edge, index) => {
    const source = byId.get(edge.sourceId);
    const target = byId.get(edge.targetId);
    if (!source || !target) return [];
    return [{
      id: `edge-${index}`,
      sourceId: source.id,
      targetId: target.id,
      weight: edge.weight,
      source: source.position,
      target: target.position,
    }];
  });

  const extent = nodes.reduce(
    (max, node) => Math.max(max, Math.hypot(...node.position) + node.radius),
    1,
  );

  return { nodes, links, directories: directoryNodes, files: fileNodes, extent };
}

export function getLodConfig(
  nodeCount: number,
  profile: DeviceProfile = {},
): LodConfig {
  const memory = profile.deviceMemory ?? 8;
  const cores = profile.hardwareConcurrency ?? 8;
  const constrained =
    profile.mobile ||
    profile.reducedMotion ||
    memory <= 4 ||
    cores <= 4;

  const level: LodConfig["level"] = constrained
    ? "low"
    : nodeCount > 6000 || memory <= 8 || cores <= 8
      ? "medium"
      : "high";

  const configs: Record<LodConfig["level"], LodConfig> = {
    low: {
      level: "low",
      maxNodes: Math.min(nodeCount, 2500),
      beamParticles: 1800,
      pixelRatioCap: 1,
      starCount: 300,
    },
    medium: {
      level: "medium",
      maxNodes: Math.min(nodeCount, 10000),
      beamParticles: 6000,
      pixelRatioCap: 1.5,
      starCount: 900,
    },
    high: {
      level: "high",
      maxNodes: nodeCount,
      beamParticles: 12000,
      pixelRatioCap: 2,
      starCount: 1600,
    },
  };

  return configs[level];
}

export function selectVisibleNodes(
  layout: UniverseLayout,
  maxNodes: number,
): UniverseNode[] {
  if (layout.nodes.length <= maxNodes) return layout.nodes;
  const directories = layout.directories;
  const fileBudget = Math.max(0, maxNodes - directories.length);
  const hotFiles = [...layout.files]
    .sort((a, b) => b.churn - a.churn)
    .slice(0, fileBudget);
  return [...directories, ...hotFiles];
}
