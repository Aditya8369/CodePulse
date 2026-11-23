import {
  SpatialAudioSoundscapeEngine,
  VoiceActivityDetector,
  PRESET_POSITIONS,
} from './spatial-audio-soundscape';

describe('SpatialAudioSoundscapeEngine & VAD', () => {
  describe('Preset 3D Positions', () => {
    it('positions left teammate at left ear, right teammate at right ear, and opponent at far distance', () => {
      expect(PRESET_POSITIONS.TEAMMATE_LEFT.x).toBeLessThan(0);
      expect(PRESET_POSITIONS.TEAMMATE_RIGHT.x).toBeGreaterThan(0);
      expect(PRESET_POSITIONS.OPPONENT_DISTANCE.z).toBeLessThan(-5);
    });
  });

  describe('VoiceActivityDetector (VAD)', () => {
    let vad: VoiceActivityDetector;

    beforeEach(() => {
      vad = new VoiceActivityDetector({
        noiseThresholdDb: -42,
        speechProbabilityThreshold: 0.65,
      });
    });

    it('identifies silence frames as non-speech', () => {
      const silence = new Float32Array(512);
      const res = vad.classifyFrame(silence);

      expect(res.isSpeech).toBe(false);
      expect(res.speechProbability).toBe(0);
      expect(res.energyDb).toBe(-100);
    });

    it('detects clear vocal waveforms above noise threshold as speech', () => {
      const frame = new Float32Array(512);
      const freq = 440; // 440Hz vocal formant
      const sampleRate = 48000;
      for (let i = 0; i < frame.length; i++) {
        // ~ -20 dB amplitude
        frame[i] = 0.1 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
      }

      const res = vad.classifyFrame(frame);
      expect(res.energyDb).toBeGreaterThan(-30);
      expect(res.speechProbability).toBeGreaterThan(0.65);
      expect(res.isSpeech).toBe(true);
      expect(res.isTypingNoiseFiltered).toBe(false);
    });

    it('filters out sharp mechanical typing noise transients', () => {
      const frame = new Float32Array(512);
      // Simulate click transients: alternating sharp peaks with silence
      for (let i = 0; i < frame.length; i++) {
        if (i % 2 === 0) {
          frame[i] = 0.08 * (Math.random() > 0.5 ? 1 : -1);
        } else {
          frame[i] = -frame[i - 1];
        }
      }

      const res = vad.classifyFrame(frame);
      expect(res.isTypingNoiseFiltered).toBe(true);
      expect(res.isSpeech).toBe(false);
    });
  });

  describe('Soundscape Engine & Team Ducking', () => {
    let engine: SpatialAudioSoundscapeEngine;

    beforeEach(() => {
      engine = new SpatialAudioSoundscapeEngine({
        holdTimeMs: 100,
        duckingAttenuationFactor: 0.25,
      });
      engine.init();
    });

    afterEach(() => {
      engine.dispose();
    });

    it('registers participants with role-based spatial coordinates', () => {
      const t1 = engine.addParticipant('mate-left', 'TEAMMATE_LEFT');
      const t2 = engine.addParticipant('mate-right', 'TEAMMATE_RIGHT');
      const opp = engine.addParticipant('opponent', 'OPPONENT_DISTANCE');

      expect(t1.position.x).toBe(-2.0);
      expect(t2.position.x).toBe(2.0);
      expect(opp.position.z).toBe(-6.0);
    });

    it('ducks game audio when teammate speaks and un-ducks after silence', () => {
      engine.addParticipant('mate-left', 'TEAMMATE_LEFT');

      // Vocal frame
      const frame = new Float32Array(512);
      for (let i = 0; i < frame.length; i++) {
        frame[i] = 0.12 * Math.sin((2 * Math.PI * 500 * i) / 48000);
      }

      // Teammate speaks
      const vadRes = engine.processAudioFrame('mate-left', frame);
      expect(vadRes.isSpeech).toBe(true);
      expect(engine.getIsGameAudioDucked()).toBe(true);

      // Now silence
      const silence = new Float32Array(512);
      // Simulate time passage past holdTimeMs
      const participant = engine.getParticipant('mate-left');
      if (participant) {
        participant.lastSpokeTimestamp = Date.now() - 200;
      }

      engine.processAudioFrame('mate-left', silence);
      expect(engine.getIsGameAudioDucked()).toBe(false);
    });

    it('does not duck game audio when opponent speaks', () => {
      engine.addParticipant('enemy-1', 'OPPONENT_DISTANCE');

      const frame = new Float32Array(512);
      for (let i = 0; i < frame.length; i++) {
        frame[i] = 0.12 * Math.sin((2 * Math.PI * 500 * i) / 48000);
      }

      engine.processAudioFrame('enemy-1', frame);
      // Only teammates trigger auto-ducking
      expect(engine.getIsGameAudioDucked()).toBe(false);
    });
  });
});
