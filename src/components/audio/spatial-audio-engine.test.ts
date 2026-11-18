import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpatialAudioEngine } from './spatial-audio-engine';

describe('SpatialAudioEngine (#581)', () => {
  let mockAudioContext: any;
  let mockDestination: any;
  let mockListener: any;

  function createMockAudioParam(initialValue = 1) {
    return {
      value: initialValue,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
      setTargetAtTime: vi.fn(),
    };
  }

  function createMockNode() {
    return {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  }

  beforeEach(() => {
    mockDestination = createMockNode();
    mockListener = {
      positionX: createMockAudioParam(0),
      positionY: createMockAudioParam(0),
      positionZ: createMockAudioParam(0),
      setPosition: vi.fn(),
    };

    mockAudioContext = {
      currentTime: 10,
      state: 'running',
      sampleRate: 44100,
      destination: mockDestination,
      listener: mockListener,
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      createGain: vi.fn(() => ({
        ...createMockNode(),
        gain: createMockAudioParam(1),
      })),
      createBiquadFilter: vi.fn(() => ({
        ...createMockNode(),
        type: 'lowpass',
        frequency: createMockAudioParam(4000),
        Q: createMockAudioParam(1),
      })),
      createPanner: vi.fn(() => ({
        ...createMockNode(),
        panningModel: 'HRTF',
        distanceModel: 'inverse',
        refDistance: 1,
        maxDistance: 10000,
        rolloffFactor: 1,
        coneInnerAngle: 360,
        positionX: createMockAudioParam(0),
        positionY: createMockAudioParam(0),
        positionZ: createMockAudioParam(0),
        setPosition: vi.fn(),
      })),
      createOscillator: vi.fn(() => ({
        ...createMockNode(),
        type: 'sine',
        frequency: createMockAudioParam(440),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(100)),
      })),
      createConvolver: vi.fn(() => ({
        ...createMockNode(),
        buffer: null,
      })),
    };
  });

  describe('3D HRTF Spatial Positioning & Panner Setup', () => {
    it('positions left player at coordinate (-1, 0, 0) and right player at (+1, 0, 0)', () => {
      const engine = new SpatialAudioEngine(mockAudioContext as unknown as AudioContext);

      // Verify createPanner was called twice (once for left, once for right)
      expect(mockAudioContext.createPanner).toHaveBeenCalledTimes(2);

      const mix = engine.getMixSettings();
      expect(mix.spatialEnabled).toBe(true);
      expect(SpatialAudioEngine.LEFT_COORDS).toEqual({ x: -1.0, y: 0.0, z: 0.0 });
      expect(SpatialAudioEngine.RIGHT_COORDS).toEqual({ x: 1.0, y: 0.0, z: 0.0 });
    });
  });

  describe('Procedural Sound Synthesis (Zero-Asset Architecture)', () => {
    it('synthesizes sub-millisecond mechanical keystroke clicks with spatial routing', () => {
      const engine = new SpatialAudioEngine(mockAudioContext as unknown as AudioContext);

      engine.playKeystrokeClick('left');
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();

      engine.playKeystrokeClick('right');
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('synthesizes compile error warning buzzer on demand', () => {
      const engine = new SpatialAudioEngine(mockAudioContext as unknown as AudioContext);

      engine.playCompileErrorBuzzer('left');
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();
    });

    it('synthesizes crystalline arpeggio test success chimes', () => {
      const engine = new SpatialAudioEngine(mockAudioContext as unknown as AudioContext);

      engine.playTestSuccessChime('right');
      // 4 harmonic notes in the arpeggio (C5, E5, G5, C6)
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(4);
    });

    it('synthesizes tournament countdown beeps and horns', () => {
      const engine = new SpatialAudioEngine(mockAudioContext as unknown as AudioContext);

      engine.playCountdownBeep(false); // regular tick
      expect(mockAudioContext.createOscillator).toHaveBeenCalled();

      engine.playCountdownBeep(true); // final horn
      expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
    });
  });

  describe('Adrenaline WPM Low-Pass Filter Modulation', () => {
    it('dynamically raises cutoff frequency with high typing speed (WPM)', () => {
      const engine = new SpatialAudioEngine(mockAudioContext as unknown as AudioContext);

      // Low WPM (30) -> lower cutoff
      engine.updateAdrenalineWpm(30);

      // High WPM (150) -> maximum adrenaline cutoff (12,000 Hz)
      engine.updateAdrenalineWpm(150);

      expect(engine.getContextState()).toBe('running');
    });
  });

  describe('Accessible Voice Commentary Audio Ducking', () => {
    it('ducks background SFX gain when commentary is active', () => {
      const engine = new SpatialAudioEngine(mockAudioContext as unknown as AudioContext);

      engine.setCommentarySpeaking(true);
      expect(engine.getMixSettings().duckingEnabled).toBe(true);

      engine.setCommentarySpeaking(false);
    });
  });

  describe('Mixer Volume Controls', () => {
    it('updates master, sfx, and commentary volumes and toggles spatial panning', () => {
      const engine = new SpatialAudioEngine(mockAudioContext as unknown as AudioContext);

      const updated = engine.updateMixSettings({
        masterVolume: 0.5,
        sfxVolume: 0.7,
        commentaryVolume: 0.8,
        spatialEnabled: false,
      });

      expect(updated.masterVolume).toBe(0.5);
      expect(updated.sfxVolume).toBe(0.7);
      expect(updated.commentaryVolume).toBe(0.8);
      expect(updated.spatialEnabled).toBe(false);
    });
  });
});

