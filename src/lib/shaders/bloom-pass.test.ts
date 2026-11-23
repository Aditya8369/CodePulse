import {
  AdaptiveQualityThrottler,
  WebGLContextManager,
  HOLOGRAM_GRID_VERTEX_SHADER,
  HOLOGRAM_GRID_FRAGMENT_SHADER,
} from './bloom-pass';

describe('Post-Processing Pipeline & Adaptive Quality Throttler', () => {
  describe('AdaptiveQualityThrottler', () => {
    let throttler: AdaptiveQualityThrottler;

    beforeEach(() => {
      throttler = new AdaptiveQualityThrottler(1.5);
    });

    it('calculates average FPS over rolling frame intervals', () => {
      let now = 1000;
      // 60 FPS = 16.6ms intervals
      for (let i = 0; i < 30; i++) {
        now += 16.66;
        throttler.recordFrame(now);
      }

      const avg = throttler.calculateAverageFps();
      expect(avg).toBeGreaterThanOrEqual(58);
      expect(avg).toBeLessThanOrEqual(62);
    });

    it('automatically downscales DPR when framerate drops below 45 FPS sustained', () => {
      let now = 1000;
      // Simulate slow frames (30ms = 33 FPS)
      for (let i = 0; i < 40; i++) {
        now += 30;
        throttler.recordFrame(now);
      }

      const state = throttler.recordFrame(now + 30);
      expect(state.currentFps).toBeLessThan(45);
      expect(state.isLowQuality).toBe(true);
      expect(state.dpr).toBeLessThan(1.5);
    });

    it('restores quality after sustained high 60 FPS recovery', () => {
      let now = 1000;
      // 1. Force low quality
      for (let i = 0; i < 40; i++) {
        now += 30;
        throttler.recordFrame(now);
      }
      expect(throttler.calculateAverageFps()).toBeLessThan(45);

      // 2. Recover to 60 FPS (16ms per frame)
      for (let i = 0; i < 80; i++) {
        now += 16;
        throttler.recordFrame(now);
      }

      const recoveredState = throttler.recordFrame(now + 16);
      expect(recoveredState.isLowQuality).toBe(false);
      expect(recoveredState.dpr).toBeGreaterThan(0.75);
    });
  });

  describe('WebGLContextManager', () => {
    it('manages context lost and restoration lifecycle events', () => {
      const manager = new WebGLContextManager();
      const mockCanvas = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      } as unknown as HTMLCanvasElement;

      const onLost = jest.fn();
      const onRestored = jest.fn();

      manager.attach(mockCanvas, onLost, onRestored);
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
        'webglcontextlost',
        expect.any(Function),
        false,
      );
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
        'webglcontextrestored',
        expect.any(Function),
        false,
      );

      manager.detach();
      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith(
        'webglcontextlost',
        expect.any(Function),
      );
    });
  });

  describe('GLSL Shaders Validation', () => {
    it('defines vertex shader with UV coordinates and model-view projection', () => {
      expect(HOLOGRAM_GRID_VERTEX_SHADER).toContain('varying vec2 vUv;');
      expect(HOLOGRAM_GRID_VERTEX_SHADER).toContain('projectionMatrix * modelViewMatrix');
    });

    it('defines fragment shader with typing WPM pulse and health ratio uniforms', () => {
      expect(HOLOGRAM_GRID_FRAGMENT_SHADER).toContain('uniform float uTime;');
      expect(HOLOGRAM_GRID_FRAGMENT_SHADER).toContain('uniform float uWpmPulse;');
      expect(HOLOGRAM_GRID_FRAGMENT_SHADER).toContain('uniform float uHealthRatio;');
      expect(HOLOGRAM_GRID_FRAGMENT_SHADER).toContain('gl_FragColor');
    });
  });
});
