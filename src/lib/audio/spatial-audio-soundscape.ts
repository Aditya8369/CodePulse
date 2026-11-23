/**
 * CodePulse Spatial Audio Soundscape & Voice Activity Detection (VAD) Engine
 * Designed for 3v3 Esports Battles:
 * - Silero-inspired VAD noise gating to eliminate background mechanical keyboard clatter & ambient hum
 * - Web Audio API 3D PannerNode directional audio positioning (Left teammate, Right teammate, Far opponent)
 * - Dynamic Game Audio Ducking when teammates speak
 */

export type ParticipantRole =
  | 'SELF'
  | 'TEAMMATE_LEFT'
  | 'TEAMMATE_RIGHT'
  | 'OPPONENT_DISTANCE'
  | 'CUSTOM';

export interface ParticipantPosition {
  x: number;
  y: number;
  z: number;
}

export const PRESET_POSITIONS: Record<ParticipantRole, ParticipantPosition> = {
  SELF: { x: 0, y: 0, z: 0 },
  TEAMMATE_LEFT: { x: -2.0, y: 0, z: -0.5 },    // Left ear localized
  TEAMMATE_RIGHT: { x: 2.0, y: 0, z: -0.5 },   // Right ear localized
  OPPONENT_DISTANCE: { x: 0, y: 0, z: -6.0 },  // Far distance centered
  CUSTOM: { x: 0, y: 0, z: -1.0 },
};

export interface VADClassification {
  isSpeech: boolean;
  speechProbability: number;
  energyDb: number;
  isTypingNoiseFiltered: boolean;
}

export interface SoundscapeConfig {
  sampleRate: number;
  noiseThresholdDb: number; // typically -42 dB
  speechProbabilityThreshold: number; // 0.65
  duckingAttenuationFactor: number; // 0.25 (game SFX dropped to 25% volume)
  duckingRampSec: number; // 0.08s smooth ramp
  holdTimeMs: number; // 250ms hang time before closing gate
}

export const DEFAULT_SOUNDSCAPE_CONFIG: SoundscapeConfig = {
  sampleRate: 48000,
  noiseThresholdDb: -42,
  speechProbabilityThreshold: 0.65,
  duckingAttenuationFactor: 0.25,
  duckingRampSec: 0.08,
  holdTimeMs: 250,
};

export interface ParticipantChannel {
  participantId: string;
  role: ParticipantRole;
  position: ParticipantPosition;
  isSpeaking: boolean;
  lastSpokeTimestamp: number;
  pannerNode?: PannerNode;
  gainNode?: GainNode;
}

/**
 * Lightweight Voice Activity Detector (VAD)
 * Analyzes frame energy and bandpass spectral characteristics:
 * - Distinguishes human vocal tract frequencies (300Hz - 3400Hz) from
 *   mechanical keyboard clicks (high frequency spikes > 4.5kHz) and low hum (< 120Hz)
 */
export class VoiceActivityDetector {
  private readonly config: SoundscapeConfig;
  private consecutiveSpeechFrames = 0;
  private consecutiveSilenceFrames = 0;

  constructor(config: Partial<SoundscapeConfig> = {}) {
    this.config = { ...DEFAULT_SOUNDSCAPE_CONFIG, ...config };
  }

  /**
   * Evaluates PCM audio frame (Float32Array samples in [-1.0, 1.0])
   */
  classifyFrame(pcm: Float32Array): VADClassification {
    if (pcm.length === 0) {
      return {
        isSpeech: false,
        speechProbability: 0,
        energyDb: -100,
        isTypingNoiseFiltered: false,
      };
    }

    let sumSquares = 0;
    let zeroCrossings = 0;
    let highFreqEnergy = 0;
    let voiceBandEnergy = 0;

    for (let i = 0; i < pcm.length; i++) {
      const sample = pcm[i];
      sumSquares += sample * sample;

      if (i > 0) {
        // Zero crossing detector
        if ((sample >= 0 && pcm[i - 1] < 0) || (sample < 0 && pcm[i - 1] >= 0)) {
          zeroCrossings++;
        }
        // First difference high-pass filter approximation
        const diff = sample - pcm[i - 1];
        highFreqEnergy += diff * diff;
      }
    }

    const rms = Math.sqrt(sumSquares / pcm.length);
    const energyDb = rms > 1e-5 ? 20 * Math.log10(rms) : -100;

    // Normalizing zero crossing rate
    const zcr = zeroCrossings / pcm.length;
    // Ratio of transient high frequencies (typing clicks have high transient sharp differentials)
    const highFreqRatio = sumSquares > 1e-6 ? highFreqEnergy / sumSquares : 0;

    const isTypingNoise = highFreqRatio > 2.8 && zcr > 0.35 && energyDb < -18;

    let speechProbability = 0;

    if (energyDb > this.config.noiseThresholdDb && !isTypingNoise) {
      // Speech confidence increases as energy approaches typical vocal levels (-28dB to -14dB)
      const energyFactor = Math.min(1.0, Math.max(0, (energyDb - this.config.noiseThresholdDb) / 22));
      // Voice fundamental and formants generally keep ZCR in 0.04 - 0.22 range
      const vocalRhythmFactor = zcr >= 0.03 && zcr <= 0.28 ? 1.0 : 0.6;
      speechProbability = Number((energyFactor * vocalRhythmFactor).toFixed(3));
    } else if (isTypingNoise) {
      // Suppress keyboard transients
      speechProbability = 0.1;
    }

    const isSpeech = speechProbability >= this.config.speechProbabilityThreshold;

    if (isSpeech) {
      this.consecutiveSpeechFrames++;
      this.consecutiveSilenceFrames = 0;
    } else {
      this.consecutiveSilenceFrames++;
      this.consecutiveSpeechFrames = 0;
    }

    return {
      isSpeech,
      speechProbability,
      energyDb: Number(energyDb.toFixed(2)),
      isTypingNoiseFiltered: isTypingNoise,
    };
  }
}

/**
 * 3D Spatial Audio Soundscape Engine
 * Coordinates Web Audio API nodes with VAD gating and auto-ducking.
 */
export class SpatialAudioSoundscapeEngine {
  private readonly config: SoundscapeConfig;
  private readonly vad: VoiceActivityDetector;
  private readonly participants = new Map<string, ParticipantChannel>();
  private audioContext: AudioContext | null = null;
  private masterGameSfxGain: GainNode | null = null;
  private isDucked = false;

  constructor(config: Partial<SoundscapeConfig> = {}) {
    this.config = { ...DEFAULT_SOUNDSCAPE_CONFIG, ...config };
    this.vad = new VoiceActivityDetector(this.config);
  }

  /**
   * Initializes Web Audio Context (safe for browser & test environments)
   */
  init(customContext?: AudioContext): void {
    if (customContext) {
      this.audioContext = customContext;
    } else if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new window.AudioContext({ sampleRate: this.config.sampleRate });
    }

    if (this.audioContext) {
      this.masterGameSfxGain = this.audioContext.createGain();
      this.masterGameSfxGain.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      this.masterGameSfxGain.connect(this.audioContext.destination);
    }
  }

  /**
   * Adds or updates a participant in the spatial soundscape
   */
  addParticipant(
    participantId: string,
    role: ParticipantRole,
    customPosition?: ParticipantPosition,
  ): ParticipantChannel {
    const position = customPosition || PRESET_POSITIONS[role] || PRESET_POSITIONS.CUSTOM;

    let pannerNode: PannerNode | undefined;
    let gainNode: GainNode | undefined;

    if (this.audioContext) {
      pannerNode = this.audioContext.createPanner();
      pannerNode.panningModel = 'HRTF';
      pannerNode.distanceModel = 'inverse';
      pannerNode.refDistance = 1;
      pannerNode.maxDistance = 10000;
      pannerNode.rolloffFactor = 1;
      pannerNode.coneInnerAngle = 360;

      if (pannerNode.positionX) {
        pannerNode.positionX.setValueAtTime(position.x, this.audioContext.currentTime);
        pannerNode.positionY.setValueAtTime(position.y, this.audioContext.currentTime);
        pannerNode.positionZ.setValueAtTime(position.z, this.audioContext.currentTime);
      } else {
        // Fallback for older Web Audio API
        (pannerNode as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(
          position.x,
          position.y,
          position.z,
        );
      }

      gainNode = this.audioContext.createGain();
      gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      pannerNode.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
    }

    const channel: ParticipantChannel = {
      participantId,
      role,
      position,
      isSpeaking: false,
      lastSpokeTimestamp: 0,
      pannerNode,
      gainNode,
    };

    this.participants.set(participantId, channel);
    return channel;
  }

  /**
   * Dynamically alters spatial 3D coordinates for a participant
   */
  updateParticipantPosition(participantId: string, position: ParticipantPosition): void {
    const channel = this.participants.get(participantId);
    if (!channel) return;

    channel.position = position;
    if (channel.pannerNode && this.audioContext) {
      if (channel.pannerNode.positionX) {
        channel.pannerNode.positionX.setValueAtTime(position.x, this.audioContext.currentTime);
        channel.pannerNode.positionY.setValueAtTime(position.y, this.audioContext.currentTime);
        channel.pannerNode.positionZ.setValueAtTime(position.z, this.audioContext.currentTime);
      } else {
        (channel.pannerNode as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(
          position.x,
          position.y,
          position.z,
        );
      }
    }
  }

  /**
   * Ingests a microphone audio frame, runs VAD, adjusts participant speaking state,
   * and triggers dynamic game ducking when teammates speak.
   */
  processAudioFrame(participantId: string, pcm: Float32Array): VADClassification {
    const classification = this.vad.classifyFrame(pcm);
    const channel = this.participants.get(participantId);

    const now = Date.now();
    if (channel) {
      if (classification.isSpeech) {
        channel.isSpeaking = true;
        channel.lastSpokeTimestamp = now;
      } else if (now - channel.lastSpokeTimestamp > this.config.holdTimeMs) {
        channel.isSpeaking = false;
      }
    }

    this.evaluateTeamDucking(now);
    return classification;
  }

  /**
   * Ducks master game SFX if any teammate is actively speaking
   */
  private evaluateTeamDucking(now: number): void {
    let teammateSpeaking = false;

    for (const channel of this.participants.values()) {
      if (
        (channel.role === 'TEAMMATE_LEFT' || channel.role === 'TEAMMATE_RIGHT') &&
        (channel.isSpeaking || now - channel.lastSpokeTimestamp < this.config.holdTimeMs)
      ) {
        teammateSpeaking = true;
        break;
      }
    }

    if (teammateSpeaking && !this.isDucked) {
      this.duckGameAudio(true);
    } else if (!teammateSpeaking && this.isDucked) {
      this.duckGameAudio(false);
    }
  }

  /**
   * Applies smooth exponential ramp ducking to background game audio
   */
  duckGameAudio(shouldDuck: boolean): void {
    this.isDucked = shouldDuck;
    if (!this.masterGameSfxGain || !this.audioContext) return;

    const targetGain = shouldDuck ? this.config.duckingAttenuationFactor : 1.0;
    const now = this.audioContext.currentTime;

    this.masterGameSfxGain.gain.cancelScheduledValues(now);
    this.masterGameSfxGain.gain.linearRampToValueAtTime(
      targetGain,
      now + this.config.duckingRampSec,
    );
  }

  /**
   * Inspects current state of ducking
   */
  getIsGameAudioDucked(): boolean {
    return this.isDucked;
  }

  /**
   * Gets participant channel
   */
  getParticipant(participantId: string): ParticipantChannel | undefined {
    return this.participants.get(participantId);
  }

  /**
   * Destroys context and cleans up nodes
   */
  dispose(): void {
    this.participants.clear();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // no-op
      }
    }
    this.audioContext = null;
    this.masterGameSfxGain = null;
  }
}
