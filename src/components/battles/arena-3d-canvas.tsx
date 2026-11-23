"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import {
  AdaptiveQualityThrottler,
  WebGLContextManager,
  HOLOGRAM_GRID_VERTEX_SHADER,
  HOLOGRAM_GRID_FRAGMENT_SHADER,
} from "@/lib/shaders/bloom-pass";

export interface Arena3DCanvasProps {
  player1Name?: string;
  player2Name?: string;
  player1Wpm?: number;
  player2Wpm?: number;
  player1Health?: number; // 0 - 100
  player2Health?: number; // 0 - 100
  activeTheme?: "neon-cyan" | "cyber-purple" | "crimson-danger";
  isCombatHit?: boolean;
  className?: string;
}

export function Arena3DCanvas({
  player1Name = "Player 1",
  player2Name = "Player 2",
  player1Wpm = 85,
  player2Wpm = 78,
  player1Health = 100,
  player2Health = 100,
  activeTheme = "neon-cyan",
  isCombatHit = false,
  className = "",
}: Arena3DCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fps, setFps] = useState<number>(60);
  const [isLowQuality, setIsLowQuality] = useState<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animationFrameId: number;
    const throttler = new AdaptiveQualityThrottler(
      typeof window !== "undefined" ? Math.min(window.devicePixelRatio, 1.5) : 1.0,
    );
    const contextManager = new WebGLContextManager();

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050814, 0.04);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 450;
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.set(0, 3.5, 7.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    let renderer: THREE.WebGLRenderer | null = null;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(window.devicePixelRatio || 1);
    } catch {
      // Graceful fallback if WebGL unsupported
      return;
    }

    // Hologram Grid Shader Material
    const uniforms = {
      uTime: { value: 0 },
      uWpmPulse: { value: player1Wpm },
      uPrimaryColor: { value: new THREE.Color(0x00f0ff) },
      uSecondaryColor: { value: new THREE.Color(0x7928ca) },
      uHealthRatio: { value: player1Health / 100 },
    };

    const gridGeometry = new THREE.PlaneGeometry(16, 16, 32, 32);
    const gridMaterial = new THREE.ShaderMaterial({
      vertexShader: HOLOGRAM_GRID_VERTEX_SHADER,
      fragmentShader: HOLOGRAM_GRID_FRAGMENT_SHADER,
      uniforms,
      transparent: true,
      side: THREE.DoubleSide,
    });

    const gridMesh = new THREE.Mesh(gridGeometry, gridMaterial);
    gridMesh.rotation.x = -Math.PI / 2;
    gridMesh.position.y = -0.5;
    scene.add(gridMesh);

    // Dual Player Battle Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.6, 2.4, 16);
    const p1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
    });
    const p2Mat = new THREE.MeshBasicMaterial({
      color: 0xff0055,
      wireframe: true,
    });

    const p1Pillar = new THREE.Mesh(pillarGeo, p1Mat);
    p1Pillar.position.set(-3.2, 0.7, 0);
    scene.add(p1Pillar);

    const p2Pillar = new THREE.Mesh(pillarGeo, p2Mat);
    p2Pillar.position.set(3.2, 0.7, 0);
    scene.add(p2Pillar);

    // Context Recovery Listeners
    contextManager.attach(
      canvas,
      () => {
        // Context lost
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      },
      () => {
        // Context restored: re-render
        if (renderer) renderer.setSize(container.clientWidth, container.clientHeight);
      },
    );

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      uniforms.uTime.value = elapsedTime;
      uniforms.uWpmPulse.value = player1Wpm;
      uniforms.uHealthRatio.value = player1Health / 100;

      // Rotate player pillars
      p1Pillar.rotation.y = elapsedTime * 0.8;
      p2Pillar.rotation.y = -elapsedTime * 0.8;

      // Floating oscillation
      p1Pillar.position.y = 0.7 + Math.sin(elapsedTime * 2.0) * 0.1;
      p2Pillar.position.y = 0.7 + Math.cos(elapsedTime * 2.0) * 0.1;

      // Combat hit camera shake
      if (isCombatHit) {
        camera.position.x = (Math.random() - 0.5) * 0.2;
        camera.position.y = 3.5 + (Math.random() - 0.5) * 0.2;
      } else {
        camera.position.x = 0;
        camera.position.y = 3.5;
      }

      // Adaptive quality monitoring
      const throttlerState = throttler.recordFrame(performance.now());
      if (renderer && renderer.getPixelRatio() !== throttlerState.dpr) {
        renderer.setPixelRatio(throttlerState.dpr);
        setIsLowQuality(throttlerState.isLowQuality);
      }
      setFps(Math.round(throttlerState.currentFps));

      if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animate();

    // Cleanup & Dispose on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      contextManager.detach();

      // Dispose Three.js objects
      gridGeometry.dispose();
      gridMaterial.dispose();
      pillarGeo.dispose();
      p1Mat.dispose();
      p2Mat.dispose();

      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
    };
  }, [player1Wpm, player2Wpm, player1Health, player2Health, isCombatHit]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[420px] rounded-xl overflow-hidden border border-cyan-900/40 bg-slate-950 ${className}`}
    >
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Cyber HUD Overlay */}
      <div className="absolute top-3 left-4 flex items-center gap-3 z-10 pointer-events-none">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/80 border border-cyan-500/30 text-xs font-mono text-cyan-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>{player1Name}: {player1Wpm} WPM</span>
        </div>
      </div>

      <div className="absolute top-3 right-4 flex items-center gap-3 z-10 pointer-events-none">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/80 border border-rose-500/30 text-xs font-mono text-rose-400">
          <span>{player2Name}: {player2Wpm} WPM</span>
          <span className="w-2 h-2 rounded-full bg-rose-400" />
        </div>
      </div>

      {/* FPS & Quality Monitor */}
      <div className="absolute bottom-2.5 right-3 text-[11px] font-mono text-slate-500 flex items-center gap-2 pointer-events-none">
        <span>{fps} FPS</span>
        {isLowQuality && (
          <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
            AUTO-DOWNSCALED
          </span>
        )}
      </div>
    </div>
  );
}

export default Arena3DCanvas;
