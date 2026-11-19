import { describe, expect, it } from "vitest";
import {
  beamFragmentShader,
  beamVertexShader,
  createBeamGeometry,
  createBeamMaterial,
  createBeamParticleAttributes,
  createHaloMaterial,
  createNodeHaloGeometry,
  haloFragmentShader,
  haloVertexShader,
} from "./git-node-shader";
import { buildUniverseLayout } from "./universe-layout";
import { createTestUniverse } from "@/test/universe-fixture";

const layout = buildUniverseLayout(createTestUniverse(12));

describe("WebGL particle shaders", () => {
  it("exposes animated uniforms and particle attributes", () => {
    expect(beamVertexShader).toContain("uTime");
    expect(beamVertexShader).toContain("aTarget");
    expect(beamFragmentShader).toContain("gl_PointCoord");
    expect(haloVertexShader).toContain("aColor");
    expect(haloFragmentShader).toContain("vAlpha");
  });

  it("builds a bounded number of co-change beam particles", () => {
    const attributes = createBeamParticleAttributes(layout.links, 64);
    expect(attributes.count).toBeLessThanOrEqual(64);
    expect(attributes.count).toBeGreaterThan(0);
    expect(attributes.positions).toHaveLength(attributes.count * 3);
    expect(attributes.targets).toHaveLength(attributes.count * 3);
    expect(attributes.speeds.every((speed) => speed > 0)).toBe(true);

    const geometry = createBeamGeometry(attributes);
    expect(geometry.getAttribute("aTarget")).toBeDefined();
    expect(geometry.getAttribute("aSeed")).toBeDefined();
    geometry.dispose();
  });

  it("creates halo geometry and additively blended materials", () => {
    const geometry = createNodeHaloGeometry(layout.nodes);
    expect(geometry.getAttribute("aColor").count).toBe(layout.nodes.length);
    expect(geometry.getAttribute("aSize").count).toBe(layout.nodes.length);

    const beamMaterial = createBeamMaterial();
    const haloMaterial = createHaloMaterial();
    expect(beamMaterial.uniforms.uTime.value).toBe(0);
    expect(haloMaterial.uniforms.uPixelRatio.value).toBe(1);
    geometry.dispose();
    beamMaterial.dispose();
    haloMaterial.dispose();
  });
});
