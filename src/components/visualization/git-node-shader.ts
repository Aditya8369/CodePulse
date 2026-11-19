import * as THREE from "three";
import { hashString } from "./universe-layout";
import type { UniverseLink, UniverseNode } from "./universe-types";

export const beamVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute vec3 aTarget;
  attribute float aSeed;
  attribute float aSpeed;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    float progress = fract(aSeed + uTime * aSpeed);
    vec3 point = mix(position, aTarget, progress);
    point.y += sin(progress * 3.14159265) * (0.35 + aSeed * 0.7);
    vec4 viewPosition = modelViewMatrix * vec4(point, 1.0);
    gl_PointSize = (2.0 + aSeed * 2.5) * uPixelRatio * (70.0 / max(1.0, -viewPosition.z));
    gl_Position = projectionMatrix * viewPosition;
    vAlpha = sin(progress * 3.14159265) * 0.9;
    vSeed = aSeed;
  }
`;

export const beamFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vSeed;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float glow = smoothstep(0.5, 0.0, distanceToCenter);
    vec3 color = mix(uColor, vec3(0.85, 0.95, 1.0), vSeed * 0.5);
    gl_FragColor = vec4(color, glow * vAlpha);
  }
`;

export const haloVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    float pulse = 0.85 + 0.15 * sin(uTime * 1.4 + aPhase);
    gl_PointSize = aSize * pulse * uPixelRatio * (90.0 / max(1.0, -viewPosition.z));
    gl_Position = projectionMatrix * viewPosition;
    vColor = aColor;
    vAlpha = 0.45 * pulse;
  }
`;

export const haloFragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    float glow = pow(smoothstep(0.5, 0.0, distanceToCenter), 2.0);
    gl_FragColor = vec4(vColor, glow * vAlpha);
  }
`;

export interface BeamParticleAttributes {
  positions: Float32Array;
  targets: Float32Array;
  seeds: Float32Array;
  speeds: Float32Array;
  count: number;
}

export function createBeamParticleAttributes(
  links: readonly UniverseLink[],
  particleBudget: number,
): BeamParticleAttributes {
  if (links.length === 0 || particleBudget <= 0) {
    return {
      positions: new Float32Array(0),
      targets: new Float32Array(0),
      seeds: new Float32Array(0),
      speeds: new Float32Array(0),
      count: 0,
    };
  }

  const perLink = Math.max(1, Math.floor(particleBudget / links.length));
  const count = Math.min(particleBudget, links.length * perLink);
  const positions = new Float32Array(count * 3);
  const targets = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const speeds = new Float32Array(count);

  let cursor = 0;
  for (const link of links) {
    const weightHash = hashString(link.id);
    for (let index = 0; index < perLink && cursor < count; index += 1) {
      const seed = hashString(`${link.id}:${index}`) / 4294967295;
      positions.set(link.source, cursor * 3);
      targets.set(link.target, cursor * 3);
      seeds[cursor] = seed;
      speeds[cursor] = 0.06 + Math.min(0.18, link.weight * 0.012) + (weightHash % 17) / 600;
      cursor += 1;
    }
  }

  return { positions, targets, seeds, speeds, count };
}

export function createBeamGeometry(attributes: BeamParticleAttributes): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(attributes.positions, 3));
  geometry.setAttribute("aTarget", new THREE.BufferAttribute(attributes.targets, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(attributes.seeds, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(attributes.speeds, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return geometry;
}

export function createNodeHaloGeometry(nodes: readonly UniverseNode[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  const phases: number[] = [];

  for (const node of nodes) {
    const color = new THREE.Color(node.color);
    positions.push(...node.position);
    colors.push(color.r, color.g, color.b);
    sizes.push(9 + node.radius * 12 + node.glow * 10);
    phases.push((hashString(node.id) % 628) / 100);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1));
  return geometry;
}

export function createBeamMaterial(pixelRatio = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
      uColor: { value: new THREE.Color("#67e8f9") },
    },
    vertexShader: beamVertexShader,
    fragmentShader: beamFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

export function createHaloMaterial(pixelRatio = 1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    vertexShader: haloVertexShader,
    fragmentShader: haloFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}
