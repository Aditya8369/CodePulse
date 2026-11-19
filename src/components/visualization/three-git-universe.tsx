"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import {
  createBeamGeometry,
  createBeamMaterial,
  createBeamParticleAttributes,
  createHaloMaterial,
  createNodeHaloGeometry,
} from "./git-node-shader";
import {
  buildUniverseLayout,
  getLodConfig,
  selectVisibleNodes,
} from "./universe-layout";
import { dispatchRaycastHover, dispatchRaycastSelection, type RaycastHit } from "./raycast";
import type {
  DeviceProfile,
  LodLevel,
  UniverseData,
  UniverseNode,
} from "./universe-types";

type QualitySetting = "auto" | LodLevel;

interface ThreeGitUniverseProps {
  data: UniverseData;
  className?: string;
  quality?: QualitySetting;
  onSelectNode?: (node: UniverseNode | null) => void;
}

interface OrbitHandle {
  target: THREE.Vector3;
  update: () => void;
}

function detectDeviceProfile(): DeviceProfile {
  if (typeof window === "undefined") return {};
  const navigatorRef = window.navigator as Navigator & { deviceMemory?: number };
  return {
    deviceMemory: navigatorRef.deviceMemory,
    hardwareConcurrency: navigatorRef.hardwareConcurrency,
    reducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    mobile: /Android|iPhone|iPad|iPod/i.test(navigatorRef.userAgent),
  };
}

function getPixelRatio(cap: number): number {
  return Math.min(cap, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
}

function updateShaderTime(material: THREE.ShaderMaterial, elapsedTime: number): void {
  material.uniforms.uTime.value = elapsedTime;
}

function FpsProbe({ onFps }: { onFps: (fps: number) => void }) {
  const frames = useRef(0);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current >= 1) {
      onFps(Math.round(frames.current / elapsed.current));
      frames.current = 0;
      elapsed.current = 0;
    }
  });
  return null;
}

function CameraRig({
  focus,
  controls,
}: {
  focus: UniverseNode | null;
  controls: React.RefObject<OrbitHandle | null>;
}) {
  const { camera } = useThree();
  const destination = useRef(new THREE.Vector3());
  const lookAt = useRef(new THREE.Vector3());
  const flying = useRef(false);

  useEffect(() => {
    if (!focus) return;
    const position = new THREE.Vector3(...focus.position);
    const direction = position.clone().normalize();
    if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
    destination.current.copy(
      position.clone().add(direction.multiplyScalar(Math.max(7, focus.radius * 14))),
    );
    lookAt.current.copy(position);
    flying.current = true;
  }, [focus]);

  useFrame((_, delta) => {
    if (!flying.current) return;
    const alpha = 1 - Math.exp(-delta * 3.2);
    camera.position.lerp(destination.current, alpha);
    controls.current?.target.lerp(lookAt.current, alpha);
    controls.current?.update();
    if (
      camera.position.distanceTo(destination.current) < 0.08 &&
      (!controls.current || controls.current.target.distanceTo(lookAt.current) < 0.08)
    ) {
      flying.current = false;
    }
  });

  return null;
}

function NodeInstances({
  nodes,
  onSelect,
  onHover,
}: {
  nodes: UniverseNode[];
  onSelect: (node: UniverseNode) => void;
  onHover: (node: UniverseNode | null) => void;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const instance = mesh.current;
    if (!instance) return;
    nodes.forEach((node, index) => {
      dummy.position.set(...node.position);
      dummy.scale.setScalar(node.radius);
      dummy.updateMatrix();
      instance.setMatrixAt(index, dummy.matrix);
      instance.setColorAt(index, color.set(node.color));
    });
    instance.instanceMatrix.needsUpdate = true;
    if (instance.instanceColor) instance.instanceColor.needsUpdate = true;
    instance.computeBoundingSphere();
  }, [nodes, dummy, color]);

  const handleClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      dispatchRaycastSelection(event as RaycastHit, nodes, onSelect);
    },
    [nodes, onSelect],
  );

  const handleMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      dispatchRaycastHover(event as RaycastHit, nodes, onHover);
    },
    [nodes, onHover],
  );
  const handleOut = useCallback(() => onHover(null), [onHover]);

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, nodes.length]}
      onClick={handleClick}
      onPointerMove={handleMove}
      onPointerOut={handleOut}
    >
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial
        metalness={0.35}
        roughness={0.35}
        emissive="#312e81"
        emissiveIntensity={0.4}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function BeamParticles({
  links,
  particleBudget,
  pixelRatioCap,
}: {
  links: ReturnType<typeof buildUniverseLayout>["links"];
  particleBudget: number;
  pixelRatioCap: number;
}) {
  const attributes = useMemo(
    () => createBeamParticleAttributes(links, particleBudget),
    [links, particleBudget],
  );
  const geometry = useMemo(() => createBeamGeometry(attributes), [attributes]);
  const material = useMemo(
    () => createBeamMaterial(getPixelRatio(pixelRatioCap)),
    [pixelRatioCap],
  );
  useFrame((state) => {
    updateShaderTime(material, state.clock.elapsedTime);
  });

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  if (attributes.count === 0) return null;
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

function NodeHalos({
  nodes,
  pixelRatioCap,
}: {
  nodes: UniverseNode[];
  pixelRatioCap: number;
}) {
  const geometry = useMemo(() => createNodeHaloGeometry(nodes), [nodes]);
  const material = useMemo(
    () => createHaloMaterial(getPixelRatio(pixelRatioCap)),
    [pixelRatioCap],
  );
  useFrame((state) => {
    updateShaderTime(material, state.clock.elapsedTime);
  });

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

export function ThreeGitUniverse({
  data,
  className,
  quality = "auto",
  onSelectNode,
}: ThreeGitUniverseProps) {
  const [profile] = useState<DeviceProfile>(() => detectDeviceProfile());
  const [hovered, setHovered] = useState<UniverseNode | null>(null);
  const [selected, setSelected] = useState<UniverseNode | null>(null);
  const [fps, setFps] = useState(0);
  const controls = useRef<OrbitHandle | null>(null);

  const layout = useMemo(() => buildUniverseLayout(data), [data]);
  const lod = useMemo(
    () => (quality === "auto" ? getLodConfig(layout.nodes.length, profile) : getLodConfig(layout.nodes.length, {
      deviceMemory: 16,
      hardwareConcurrency: 16,
      ...(quality === "low" ? { deviceMemory: 2, hardwareConcurrency: 2 } : {}),
      ...(quality === "medium" ? { deviceMemory: 8, hardwareConcurrency: 8 } : {}),
    })),
    [quality, layout.nodes.length, profile],
  );

  const visibleNodes = useMemo(() => {
    const nodes = selectVisibleNodes(layout, lod.maxNodes);
    if (selected && !nodes.some((node) => node.id === selected.id)) {
      return [...nodes.slice(0, -1), selected];
    }
    return nodes;
  }, [layout, lod.maxNodes, selected]);

  const visibleLinks = useMemo(() => {
    const ids = new Set(visibleNodes.map((node) => node.id));
    return layout.links.filter((link) => ids.has(link.sourceId) && ids.has(link.targetId));
  }, [layout.links, visibleNodes]);

  const handleSelect = useCallback(
    (node: UniverseNode) => {
      setSelected(node);
      onSelectNode?.(node);
    },
    [onSelectNode],
  );

  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-2xl", className)}>
      <Canvas
        dpr={[1, lod.pixelRatioCap]}
        camera={{ position: [0, 24, 58], fov: 55, near: 0.1, far: Math.max(600, layout.extent * 8) }}
        gl={{ antialias: lod.level !== "low", powerPreference: "high-performance", alpha: true }}
        fallback={
          <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
            WebGL is unavailable in this browser. The knowledge universe requires hardware acceleration.
          </div>
        }
      >
        <color attach="background" args={["#050816"]} />
        <fog attach="fog" args={["#050816", layout.extent * 1.2, layout.extent * 4]} />
        <ambientLight intensity={0.6} />
        <pointLight position={[0, 30, 20]} intensity={120} color="#a78bfa" distance={300} />
        <Stars
          radius={Math.max(120, layout.extent * 3)}
          depth={60}
          count={lod.starCount}
          factor={4}
          saturation={0}
          fade
          speed={0.4}
        />
        <NodeHalos nodes={visibleNodes} pixelRatioCap={lod.pixelRatioCap} />
        <BeamParticles
          links={visibleLinks}
          particleBudget={lod.beamParticles}
          pixelRatioCap={lod.pixelRatioCap}
        />
        <NodeInstances nodes={visibleNodes} onSelect={handleSelect} onHover={setHovered} />
        {selected && (
          <mesh position={selected.position} scale={selected.radius * 1.7}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color="#f0abfc" wireframe transparent opacity={0.65} />
          </mesh>
        )}
        <CameraRig focus={selected} controls={controls} />
        <FpsProbe onFps={setFps} />
        <OrbitControls
          ref={controls as React.Ref<React.ComponentRef<typeof OrbitControls>>}
          enableDamping
          dampingFactor={0.08}
          minDistance={5}
          maxDistance={Math.max(120, layout.extent * 3)}
          enablePan
        />
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-slate-200 backdrop-blur">
          {visibleNodes.length.toLocaleString()} nodes
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-cyan-200 backdrop-blur">
          {lod.level} LOD
        </span>
        <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-1 text-emerald-200 backdrop-blur">
          {fps} FPS
        </span>
      </div>
      {hovered && (
        <div className="pointer-events-none absolute bottom-4 left-4 max-w-[70%] truncate rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-xs text-slate-200 backdrop-blur">
          {hovered.path} · {hovered.churn} churn
        </div>
      )}
    </div>
  );
}
