import { describe, expect, it } from "vitest";
import {
  buildUniverseLayout,
  churnToGlow,
  churnToRadius,
  getLodConfig,
  mapDirectoriesToClusters,
  mapFileToOrbit,
  selectVisibleNodes,
} from "./universe-layout";
import { createTestUniverse } from "@/test/universe-fixture";

function sampleData(fileCount = 24) {
  return createTestUniverse(fileCount);
}

describe("3D coordinate mapping", () => {
  it("deterministically maps directories to stable cluster centers", () => {
    const data = sampleData();
    const first = mapDirectoriesToClusters(data.directories);
    const second = mapDirectoriesToClusters([...data.directories].reverse());

    expect(first.size).toBe(data.directories.length);
    for (const [id, position] of first) {
      expect(second.get(id)).toEqual(position);
      expect(position.every(Number.isFinite)).toBe(true);
    }
  });

  it("places child clusters near their parent cluster", () => {
    const data = sampleData();
    const centers = mapDirectoriesToClusters(data.directories);
    const child = data.directories.find((directory) => directory.parentId);

    expect(child).toBeDefined();
    if (!child?.parentId) return;
    const parentCenter = centers.get(child.parentId) as [number, number, number];
    const childCenter = centers.get(child.id) as [number, number, number];
    const distance = Math.hypot(
      childCenter[0] - parentCenter[0],
      childCenter[1] - parentCenter[1],
      childCenter[2] - parentCenter[2],
    );
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(16);
  });

  it("orbits files around their directory cluster without hash collisions", () => {
    const data = sampleData(40);
    const layout = buildUniverseLayout(data);
    const centers = mapDirectoriesToClusters(data.directories);
    const fileNodes = layout.files;
    const positions = new Set(fileNodes.map((node) => node.position.join(":")));

    expect(positions.size).toBe(fileNodes.length);
    for (const node of fileNodes) {
      const center = centers.get(node.directoryId as string) as [number, number, number];
      const distance = Math.hypot(
        node.position[0] - center[0],
        node.position[1] - center[1],
        node.position[2] - center[2],
      );
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(12);
    }
  });

  it("maps churn to monotonically increasing size and glow", () => {
    expect(churnToRadius(1)).toBeLessThan(churnToRadius(40));
    expect(churnToRadius(40)).toBeLessThan(churnToRadius(4000));
    expect(churnToGlow(1)).toBeLessThan(churnToGlow(40));
    expect(churnToGlow(4000)).toBeLessThanOrEqual(1);
    expect(churnToRadius(0)).toBeGreaterThan(0);
  });

  it("keeps only the highest-churn files when downscaling", () => {
    const layout = buildUniverseLayout(sampleData(100));
    const visible = selectVisibleNodes(layout, 30);

    expect(visible.length).toBe(30);
    const selectedFiles = visible.filter((node) => node.kind === "file");
    const skippedFiles = layout.files.filter(
      (file) => !selectedFiles.some((node) => node.id === file.id),
    );
    expect(Math.min(...selectedFiles.map((node) => node.churn))).toBeGreaterThanOrEqual(
      Math.max(...skippedFiles.map((file) => file.churn)),
    );
  });

  it("applies automatic LOD downscaling on low-power mobile devices", () => {
    const desktop = getLodConfig(10000, { deviceMemory: 16, hardwareConcurrency: 16 });
    const mobile = getLodConfig(10000, {
      deviceMemory: 2,
      hardwareConcurrency: 4,
      mobile: true,
      reducedMotion: true,
    });

    expect(desktop.level).not.toBe("low");
    expect(mobile.level).toBe("low");
    expect(mobile.maxNodes).toBeLessThan(desktop.maxNodes);
    expect(mobile.beamParticles).toBeLessThan(desktop.beamParticles);
    expect(mobile.pixelRatioCap).toBeLessThanOrEqual(desktop.pixelRatioCap);
  });

  it("maps a file orbit relative to an explicit center", () => {
    const center: [number, number, number] = [10, 2, -4];
    const position = mapFileToOrbit(center, 0, 12, "file:src/core/index.ts");
    const radius = Math.hypot(
      position[0] - center[0],
      position[2] - center[2],
    );
    expect(position).not.toEqual(center);
    expect(radius).toBeGreaterThan(2);
    expect(radius).toBeLessThan(10);
  });
});
