/**
 * CodePulse Cyber Battle Arena Post-Processing Pipeline & Adaptive Quality Throttler
 * Manages Unreal Bloom, Chromatic Aberration passes, and auto-downscaling when FPS < 45.
 */

export interface PostProcessingConfig {
  bloomIntensity: number;
  bloomThreshold: number;
  bloomRadius: number;
  chromaticAberrationOffset: number;
  dpr: number;
  lowQualityMode: boolean;
}

export const DEFAULT_POST_PROCESSING_CONFIG: PostProcessingConfig = {
  bloomIntensity: 1.25,
  bloomThreshold: 0.2,
  bloomRadius: 0.85,
  chromaticAberrationOffset: 0.003,
  dpr: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2.0) : 1.0,
  lowQualityMode: false,
};

export class AdaptiveQualityThrottler {
  private frameTimes: number[] = [];
  private lastTimestamp = 0;
  private currentDpr: number;
  private isLowQuality = false;
  private readonly targetFps = 60;
  private readonly downscaleThresholdFps = 45;
  private readonly recoveryThresholdFps = 58;
  private consecutiveLowFrames = 0;
  private consecutiveHighFrames = 0;

  constructor(initialDpr = 1.5) {
    this.currentDpr = initialDpr;
  }

  /**
   * Records a frame timestamp and evaluates whether adaptive downscaling is needed.
   * Returns updated device pixel ratio and quality mode flag.
   */
  recordFrame(now: number): { dpr: number; isLowQuality: boolean; currentFps: number } {
    if (this.lastTimestamp > 0) {
      const delta = now - this.lastTimestamp;
      if (delta > 0) {
        const instantFps = 1000 / delta;
        this.frameTimes.push(instantFps);
        if (this.frameTimes.length > 60) {
          this.frameTimes.shift();
        }
      }
    }
    this.lastTimestamp = now;

    const avgFps = this.calculateAverageFps();

    // Check downscale condition (<45 FPS sustained)
    if (avgFps < this.downscaleThresholdFps && this.frameTimes.length >= 20) {
      this.consecutiveLowFrames++;
      this.consecutiveHighFrames = 0;

      if (this.consecutiveLowFrames > 15 && !this.isLowQuality) {
        this.isLowQuality = true;
        this.currentDpr = Math.max(0.75, this.currentDpr * 0.7);
      }
    } else if (avgFps >= this.recoveryThresholdFps) {
      this.consecutiveHighFrames++;
      this.consecutiveLowFrames = 0;

      if (this.consecutiveHighFrames > 60 && this.isLowQuality) {
        this.isLowQuality = false;
        this.currentDpr = Math.min(1.5, this.currentDpr * 1.3);
      }
    }

    return {
      dpr: Number(this.currentDpr.toFixed(2)),
      isLowQuality: this.isLowQuality,
      currentFps: Number(avgFps.toFixed(1)),
    };
  }

  calculateAverageFps(): number {
    if (this.frameTimes.length === 0) return 60;
    const sum = this.frameTimes.reduce((acc, v) => acc + v, 0);
    return sum / this.frameTimes.length;
  }

  reset(): void {
    this.frameTimes = [];
    this.lastTimestamp = 0;
    this.consecutiveLowFrames = 0;
    this.consecutiveHighFrames = 0;
  }
}

/**
 * WebGL Context Recovery Manager
 * Prevents memory leaks and restores shaders when browser tab is suspended/restored.
 */
export class WebGLContextManager {
  private canvas: HTMLCanvasElement | null = null;
  private onLostCallback?: () => void;
  private onRestoredCallback?: () => void;

  attach(
    canvas: HTMLCanvasElement,
    onContextLost: () => void,
    onContextRestored: () => void,
  ): void {
    this.canvas = canvas;
    this.onLostCallback = onContextLost;
    this.onRestoredCallback = onContextRestored;

    canvas.addEventListener('webglcontextlost', this.handleContextLost, false);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored, false);
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.onLostCallback?.();
  };

  private handleContextRestored = (): void => {
    this.onRestoredCallback?.();
  };

  detach(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      this.canvas = null;
    }
  }
}

export const HOLOGRAM_GRID_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const HOLOGRAM_GRID_FRAGMENT_SHADER = `
precision highp float;

uniform float uTime;
uniform float uWpmPulse;
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform float uHealthRatio;

varying vec2 vUv;

float grid(vec2 st, float res) {
  vec2 g = fract(st * res);
  vec2 dG = fwidth(st * res);
  vec2 line = smoothstep(dG, vec2(0.0), abs(g - 0.5));
  return max(line.x, line.y);
}

void main() {
  vec2 uv = vUv;
  float scanline = sin(uv.y * 240.0 + uTime * 6.0) * 0.08;
  float gridPattern = grid(uv * 14.0, 1.0);
  float dist = distance(uv, vec2(0.5, 0.5));
  float ripple = sin(dist * 20.0 - uTime * (3.5 + uWpmPulse * 0.04)) * 0.5 + 0.5;
  ripple *= exp(-dist * 2.2);

  vec3 col = mix(uPrimaryColor, uSecondaryColor, ripple);
  if (uHealthRatio < 0.3) {
    col = mix(col, vec3(1.0, 0.15, 0.25), sin(uTime * 10.0) * 0.5 + 0.5);
  }

  float glow = gridPattern * 0.7 + ripple * (0.3 + uWpmPulse * 0.005) + scanline;
  gl_FragColor = vec4(col * glow, clamp(glow * (1.0 - dist * 0.75), 0.0, 0.95));
}
`;
