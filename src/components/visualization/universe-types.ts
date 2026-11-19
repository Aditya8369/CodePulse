export type UniverseNodeKind = "directory" | "file";

export interface UniverseContributor {
  id: string;
  name: string;
  commits: number;
}

export interface UniverseDirectory {
  id: string;
  path: string;
  name: string;
  parentId: string | null;
  depth: number;
}

export interface UniverseFile {
  id: string;
  path: string;
  name: string;
  directoryId: string;
  churn: number;
  commits: number;
  additions: number;
  deletions: number;
  contributors: UniverseContributor[];
}

export interface UniverseEdge {
  sourceId: string;
  targetId: string;
  weight: number;
}

export interface UniverseData {
  repository: string;
  directories: UniverseDirectory[];
  files: UniverseFile[];
  edges: UniverseEdge[];
}

export interface UniverseNode {
  id: string;
  kind: UniverseNodeKind;
  label: string;
  path: string;
  directoryId: string | null;
  parentId: string | null;
  depth: number;
  churn: number;
  position: [number, number, number];
  radius: number;
  glow: number;
  color: string;
  file?: UniverseFile;
}

export interface UniverseLink {
  id: string;
  sourceId: string;
  targetId: string;
  weight: number;
  source: [number, number, number];
  target: [number, number, number];
}

export interface UniverseLayout {
  nodes: UniverseNode[];
  links: UniverseLink[];
  directories: UniverseNode[];
  files: UniverseNode[];
  extent: number;
}

export type LodLevel = "low" | "medium" | "high";

export interface LodConfig {
  level: LodLevel;
  maxNodes: number;
  beamParticles: number;
  pixelRatioCap: number;
  starCount: number;
}

export interface DeviceProfile {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  reducedMotion?: boolean;
  mobile?: boolean;
}
