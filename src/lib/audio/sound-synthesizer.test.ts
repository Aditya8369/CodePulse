import { SoundSynthesizer } from './sound-synthesizer';
import { BattleMusicGenerator } from './battle-music-generator';

describe('SoundSynthesizer & BattleMusicGenerator', () => {
  describe('SoundSynthesizer Unit Controls & SFX', () => {
    let synth: SoundSynthesizer;

    beforeEach(() => {
      synth = new SoundSynthesizer({ masterVolume: 0.8, isMuted: false });
    });

    it('manages master volume and clamping between 0 and 1', () => {
      expect(synth.getVolume()).toBe(0.8);

      synth.setVolume(0.5);
      expect(synth.getVolume()).toBe(0.5);

      synth.setVolume(1.5); // clamps to 1.0
      expect(synth.getVolume()).toBe(1.0);

      synth.setVolume(-0.2); // clamps to 0.0
      expect(synth.getVolume()).toBe(0.0);
    });

    it('toggles mute states correctly', () => {
      expect(synth.getIsMuted()).toBe(false);

      synth.setMuted(true);
      expect(synth.getIsMuted()).toBe(true);

      synth.setMuted(false);
      expect(synth.getIsMuted()).toBe(false);
    });

    it('safely handles procedural SFX method calls without throwing errors', () => {
      expect(() => {
        synth.playKeystrokeClick();
        synth.playTestSuccess();
        synth.playTestFailure();
        synth.playSuddenDeathSiren();
        synth.playDrumKick();
        synth.playPercussionHit('snare');
        synth.playPercussionHit('hihat');
      }).not.toThrow();
    });
  });

  describe('BattleMusicGenerator (Dynamic Tempo & Tension Scaling)', () => {
    let generator: BattleMusicGenerator;
    let synth: SoundSynthesizer;

    beforeEach(() => {
      synth = new SoundSynthesizer();
      generator = new BattleMusicGenerator(synth, { baseBpm: 110, maxBpm: 140 });
    });

    afterEach(() => {
      generator.stop();
    });

    it('calculates 110 BPM at match start and scales to 140 BPM at timer expiration', () => {
      // 300s remaining = initial calm battle
      const startBpm = generator.calculateBpm(300, 300, false);
      expect(startBpm).toBe(110);

      // 60s remaining = transition to final minute
      const midBpm = generator.calculateBpm(60, 300, false);
      expect(midBpm).toBe(125);

      // 0s remaining = final seconds
      const endBpm = generator.calculateBpm(0, 300, false);
      expect(endBpm).toBe(140);
    });

    it('pins BPM to 140 and switches mode during sudden death', () => {
      const suddenDeathBpm = generator.calculateBpm(180, 300, true);
      expect(suddenDeathBpm).toBe(140);

      generator.setMatchTension(180, 300, true);
      expect(generator.getTensionMode()).toBe('SUDDEN_DEATH');
      expect(generator.getCurrentBpm()).toBe(140);
    });

    it('switches to HIGH_INTENSITY during final 60 seconds', () => {
      generator.setMatchTension(45, 300, false);
      expect(generator.getTensionMode()).toBe('HIGH_INTENSITY');
      expect(generator.getCurrentBpm()).toBeGreaterThanOrEqual(125);
    });

    it('handles start and stop state safely', async () => {
      expect(generator.getIsPlaying()).toBe(false);
      generator.stop();
      expect(generator.getIsPlaying()).toBe(false);
    });
  });
});
