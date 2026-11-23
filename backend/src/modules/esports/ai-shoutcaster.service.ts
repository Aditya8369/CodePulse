import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

export type CommentaryStyle =
  | 'HYPE_CASTER'
  | 'TECHNICAL_ANALYST'
  | 'HYPE'
  | 'ANALYTICAL'
  | 'COMEDIC'
  | 'COMEDIC_CASTER';

export type CommentaryEmotionTag =
  | 'Hype'
  | 'Suspense'
  | 'Analytical'
  | 'Climax'
  | 'Humorous';

export type MatchTelemetryEventType =
  | 'fast_typing_burst'
  | 'failing_test_cases'
  | 'optimization_breakthrough'
  | 'score_lead_change'
  | 'match_climax'
  | 'compilation'
  | 'compilation_error'
  | 'test_case_pass'
  | 'sabotage_used'
  | 'sudden_death';

export interface ShoutcasterMatchEvent {
  battleId: string;
  eventType: MatchTelemetryEventType;
  actorUsername: string;
  opponentUsername?: string;
  wpm?: number;
  passedTests?: number;
  totalTests?: number;
  complexityBefore?: string;
  complexityAfter?: string;
  actorScore?: number;
  opponentScore?: number;
  secondsRemaining?: number;
  sabotageName?: string;
  style?: CommentaryStyle;
  timestampMs?: number;
}

export interface CommentaryScriptLine {
  lineId: string;
  battleId: string;
  text: string;
  emotion: CommentaryEmotionTag;
  style: CommentaryStyle;
  eventType: MatchTelemetryEventType;
  generatedAtMs: number;
}

export interface ShoutcasterAudioChunk {
  streamId: string;
  battleId: string;
  lineId: string;
  chunkIndex: number;
  totalChunks: number;
  isFinal: boolean;
  mimeType: string;
  sampleRate: number;
  audioBase64: string;
  transcript: string;
  emotion: CommentaryEmotionTag;
  style: CommentaryStyle;
  latencyMs: number;
}

export interface TtsSynthesisResult {
  engine: 'elevenlabs' | 'piper' | 'pcm-synth';
  mimeType: string;
  sampleRate: number;
  audioBuffer: Buffer;
  latencyMs: number;
}

interface BattleThrottleState {
  lastBroadcastAtMs: number;
  isSpeakingUntilMs: number;
  preferredStyle: CommentaryStyle;
  recentKeystrokeTimestamps: number[];
}

@Injectable()
export class AiShoutcasterService {
  private readonly logger = new Logger(AiShoutcasterService.name);
  private readonly battleStates = new Map<string, BattleThrottleState>();
  private readonly minCooldownMs: number;
  private readonly chunkByteSize = 4096;

  constructor(@Optional() private readonly configService?: ConfigService) {
    const configuredCooldown = Number(
      this.configService?.get<string>('SHOUTCASTER_COOLDOWN_MS') ??
        process.env.SHOUTCASTER_COOLDOWN_MS ??
        2500,
    );
    this.minCooldownMs = Number.isFinite(configuredCooldown)
      ? Math.max(250, configuredCooldown)
      : 2500;
  }

  getBattleStyle(battleId: string): CommentaryStyle {
    return this.battleStates.get(battleId)?.preferredStyle ?? 'HYPE_CASTER';
  }

  setBattleStyle(battleId: string, style: CommentaryStyle): CommentaryStyle {
    const state = this.getOrCreateBattleState(battleId);
    state.preferredStyle = style;
    return state.preferredStyle;
  }

  private getOrCreateBattleState(battleId: string): BattleThrottleState {
    let state = this.battleStates.get(battleId);
    if (!state) {
      state = {
        lastBroadcastAtMs: 0,
        isSpeakingUntilMs: 0,
        preferredStyle: 'HYPE_CASTER',
        recentKeystrokeTimestamps: [],
      };
      this.battleStates.set(battleId, state);
    }
    return state;
  }

  /**
   * Tracks live keystroke velocity and returns true when a player hits a >= 95 WPM burst.
   */
  recordKeystrokeAndDetectBurst(
    battleId: string,
    timestampMs = Date.now(),
  ): { isBurst: boolean; estimatedWpm: number } {
    const state = this.getOrCreateBattleState(battleId);
    const windowMs = 4000;
    state.recentKeystrokeTimestamps = state.recentKeystrokeTimestamps
      .filter((ts) => timestampMs - ts <= windowMs)
      .concat(timestampMs);

    // 5 characters per word normalized over 4-second sliding window
    const charsPerSec = state.recentKeystrokeTimestamps.length / (windowMs / 1000);
    const estimatedWpm = Math.round((charsPerSec / 5) * 60);
    return {
      isBurst: state.recentKeystrokeTimestamps.length >= 32 && estimatedWpm >= 95,
      estimatedWpm,
    };
  }

  /**
   * Adaptive commentary throttling: prevents overlapping audio playback or rapid-fire spam
   * during intense keystroke/test-case bursts, while allowing high-priority Climax overrides.
   */
  shouldThrottleEvent(
    battleId: string,
    eventType: MatchTelemetryEventType,
    nowMs = Date.now(),
  ): boolean {
    const state = this.getOrCreateBattleState(battleId);
    const isCriticalClimax =
      eventType === 'match_climax' || eventType === 'score_lead_change';

    if (nowMs < state.isSpeakingUntilMs && !isCriticalClimax) {
      return true;
    }

    const effectiveCooldown = isCriticalClimax
      ? Math.floor(this.minCooldownMs * 0.5)
      : this.minCooldownMs;

    if (nowMs - state.lastBroadcastAtMs < effectiveCooldown) {
      return true;
    }

    return false;
  }

  /**
   * Builds a fast LLM prompt and generates context-accurate commentary with dynamic emotion tags.
   */
  buildPromptForEvent(
    event: ShoutcasterMatchEvent,
    style: CommentaryStyle,
  ): { prompt: string; emotion: CommentaryEmotionTag } {
    const emotion = this.classifyEmotion(event);
    const personaInstruction =
      style === 'HYPE_CASTER'
        ? 'You are an energetic esports tournament shoutcaster. Keep it punchy, vivid, and under 24 words.'
        : 'You are a calm, precise technical algorithm analyst. Keep it insightful, composed, and under 24 words.';

    const contextSummary = [
      `Event: ${event.eventType}`,
      `EmotionTag: [${emotion}]`,
      `Player: ${event.actorUsername}`,
      event.opponentUsername ? `Opponent: ${event.opponentUsername}` : '',
      event.wpm ? `TypingSpeed: ${event.wpm} WPM` : '',
      event.complexityBefore && event.complexityAfter
        ? `ComplexityShift: ${event.complexityBefore} -> ${event.complexityAfter}`
        : '',
      typeof event.passedTests === 'number' && typeof event.totalTests === 'number'
        ? `Tests: ${event.passedTests}/${event.totalTests}`
        : '',
      typeof event.actorScore === 'number' && typeof event.opponentScore === 'number'
        ? `Score: ${event.actorScore} vs ${event.opponentScore}`
        : '',
      typeof event.secondsRemaining === 'number'
        ? `Clock: ${event.secondsRemaining}s remaining`
        : '',
    ]
      .filter(Boolean)
      .join(' | ');

    return {
      prompt: `${personaInstruction}\nMatch Telemetry: ${contextSummary}\nShoutcast Line:`,
      emotion,
    };
  }

  classifyEmotion(event: ShoutcasterMatchEvent): CommentaryEmotionTag {
    if (event.style === 'COMEDIC' || event.style === 'COMEDIC_CASTER') {
      return 'Humorous';
    }
    switch (event.eventType) {
      case 'optimization_breakthrough':
      case 'test_case_pass':
        return 'Hype';
      case 'failing_test_cases':
      case 'compilation_error':
      case 'sabotage_used':
        return 'Suspense';
      case 'fast_typing_burst':
        return event.style === 'TECHNICAL_ANALYST' || event.style === 'ANALYTICAL' ? 'Analytical' : 'Hype';
      case 'score_lead_change':
      case 'match_climax':
      case 'sudden_death':
        return 'Climax';
      default:
        return 'Analytical';
    }
  }

  generateCommentaryScript(event: ShoutcasterMatchEvent): CommentaryScriptLine {
    const rawStyle = event.style ?? this.getBattleStyle(event.battleId);
    // Normalize style: HYPE, ANALYTICAL, COMEDIC
    const isComedic = rawStyle === 'COMEDIC' || rawStyle === 'COMEDIC_CASTER';
    const isAnalytical = rawStyle === 'TECHNICAL_ANALYST' || rawStyle === 'ANALYTICAL';
    const isHype = !isComedic && !isAnalytical;

    const { emotion } = this.buildPromptForEvent(event, rawStyle);
    const actor = event.actorUsername || 'Player A';
    const opponent = event.opponentUsername || 'Player B';
    const sabotage = event.sabotageName || 'Sabotage';

    let text: string;

    if (isComedic) {
      switch (event.eventType) {
        case 'sabotage_used':
          text = `Oh, that is downright vicious! ${actor} just unleashed ${sabotage} on ${opponent}! Enjoy coding blindfolded!`;
          break;
        case 'compilation_error':
          text = `Oops! ${actor} tried to argue with the compiler, and the compiler undefeatedly won! Semicolons matter, folks!`;
          break;
        case 'test_case_pass':
          text = `Hold the phone! It actually compiled and passed the tests! Nobody move, don't jinx it!`;
          break;
        case 'optimization_breakthrough':
          text = `${actor} just went from turtle speed to hyperdrive! ${opponent} is sweating through their mechanical keyboard!`;
          break;
        case 'failing_test_cases':
          text = `NullPointerException alert! ${actor} looking at the monitor like it personally insulted their ancestors!`;
          break;
        case 'fast_typing_burst':
          text = `${actor} is slamming keys so hard I think the spacebar just asked for worker compensation!`;
          break;
        case 'score_lead_change':
          text = `Plot twist! ${actor} takes the lead! Quick, somebody check if ${opponent} unplugged their router!`;
          break;
        case 'sudden_death':
        case 'match_climax':
        default:
          text = `Down to the final seconds! Two programmers enter, one emerges with working code and bragging rights!`;
          break;
      }
    } else if (isHype) {
      switch (event.eventType) {
        case 'sabotage_used':
          text = `TACTICAL SABOTAGE! ${actor} hits ${opponent} with ${sabotage} right in the middle of an algorithm refactor!`;
          break;
        case 'compilation_error':
          text = `CRITICAL STALL! ${actor} runs into a syntax error under intense tournament pressure!`;
          break;
        case 'test_case_pass':
          text = `GREEN LIGHT! ${actor} locks in passing test cases and puts massive pressure on ${opponent}!`;
          break;
        case 'optimization_breakthrough':
          text = `${actor} has just optimized their loop to ${event.complexityAfter ?? 'O(N)'}! Can ${opponent} catch up before time expires?!`;
          break;
        case 'fast_typing_burst':
          text = `Unbelievable keyboard velocity from ${actor} at ${event.wpm ?? 115} WPM — pure tournament flow right now!`;
          break;
        case 'failing_test_cases':
          text = `Ooh, edge-case heartbreak for ${actor}! ${event.passedTests ?? 0} of ${event.totalTests ?? 5} tests passing — the door is wide open for ${opponent}!`;
          break;
        case 'score_lead_change':
          text = `LEAD CHANGE! ${actor} surges ahead ${event.actorScore ?? 100} to ${event.opponentScore ?? 90} in a massive momentum swing!`;
          break;
        case 'sudden_death':
          text = `SUDDEN DEATH ACTIVATED! Next correct test submission takes the entire tournament match!`;
          break;
        case 'match_climax':
        default:
          text = `Final ${event.secondsRemaining ?? 15} seconds on the clock! Both coders locked in a razor-thin sprint to the finish!`;
          break;
      }
    } else {
      // Analytical / Technical
      switch (event.eventType) {
        case 'sabotage_used':
          text = `${actor} executed ${sabotage}, disrupting ${opponent}'s cognitive focus during active buffer manipulation.`;
          break;
        case 'compilation_error':
          text = `Compilation diagnostics flag an unresolved token error in ${actor}'s AST parsing pipeline.`;
          break;
        case 'test_case_pass':
          text = `${actor} successfully satisfied ${event.passedTests ?? 'all'} verification constraints within linear time complexity.`;
          break;
        case 'optimization_breakthrough':
          text = `${actor} reduced asymptotic runtime from ${event.complexityBefore ?? 'O(N^2)'} to ${event.complexityAfter ?? 'O(N)'}, eliminating the inner bottleneck.`;
          break;
        case 'fast_typing_burst':
          text = `${actor} is sustaining ${event.wpm ?? 115} WPM with clean structural edits and zero syntax rollbacks.`;
          break;
        case 'failing_test_cases':
          text = `${actor} hit a boundary failure at ${event.passedTests ?? 0}/${event.totalTests ?? 5} cases; likely an off-by-one or null guard issue.`;
          break;
        case 'score_lead_change':
          text = `${actor} takes a ${event.actorScore ?? 100} to ${event.opponentScore ?? 90} lead after passing hidden stress benchmarks.`;
          break;
        case 'sudden_death':
        case 'match_climax':
        default:
          text = `With ${event.secondsRemaining ?? 15} seconds left, ${actor} holds a slight execution-time advantage over ${opponent}.`;
          break;
      }
    }

    return {
      lineId: `line_${randomUUID().slice(0, 8)}`,
      battleId: event.battleId,
      text,
      emotion,
      style: rawStyle,
      eventType: event.eventType,
      generatedAtMs: event.timestampMs ?? Date.now(),
    };
  }

  /**
   * Synthesizes streaming TTS audio using ElevenLabs Streaming API when configured,
   * falling back to ultra-fast local 16kHz PCM WAV synthesis (< 5ms) so total
   * speech generation + WebSocket streaming latency stays well under 800ms.
   */
  async synthesizeSpeechStream(
    script: CommentaryScriptLine,
  ): Promise<TtsSynthesisResult> {
    const startMs = performance.now();
    const elevenLabsKey =
      this.configService?.get<string>('ELEVENLABS_API_KEY') ??
      process.env.ELEVENLABS_API_KEY;

    if (elevenLabsKey && typeof fetch === 'function') {
      const voiceId =
        script.style === 'HYPE_CASTER'
          ? 'JBFqnCBsd6RMkjVDRZzb'
          : '21m00Tcm4TlvDq8ikWAM';
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 550);
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': elevenLabsKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: script.text,
              model_id: 'eleven_flash_v2_5',
            }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeout);

        if (response.ok) {
          const arrayBuf = await response.arrayBuffer();
          return {
            engine: 'elevenlabs',
            mimeType: 'audio/mpeg',
            sampleRate: 44100,
            audioBuffer: Buffer.from(arrayBuf),
            latencyMs: Number((performance.now() - startMs).toFixed(2)),
          };
        }
      } catch {
        // Fall through to deterministic low-latency PCM WAV synthesizer
      }
    }

    const wavBuffer = synthesizeExpressivePcmWav(script.text, script.emotion);
    return {
      engine: 'pcm-synth',
      mimeType: 'audio/wav',
      sampleRate: 16000,
      audioBuffer: wavBuffer,
      latencyMs: Number((performance.now() - startMs).toFixed(2)),
    };
  }

  /**
   * End-to-end event handler: checks adaptive throttling, generates script + emotion tag,
   * synthesizes TTS audio, and splits into WebSocket-ready streaming audio chunks (< 800ms).
   */
  async processMatchEvent(
    event: ShoutcasterMatchEvent,
  ): Promise<{
    throttled: boolean;
    script?: CommentaryScriptLine;
    chunks: ShoutcasterAudioChunk[];
    totalLatencyMs: number;
  }> {
    const startMs = performance.now();
    const nowMs = event.timestampMs ?? Date.now();

    if (this.shouldThrottleEvent(event.battleId, event.eventType, nowMs)) {
      return {
        throttled: true,
        chunks: [],
        totalLatencyMs: Number((performance.now() - startMs).toFixed(2)),
      };
    }

    const script = this.generateCommentaryScript(event);
    const tts = await this.synthesizeSpeechStream(script);
    const totalLatencyMs = Number((performance.now() - startMs).toFixed(2));

    // Estimate playback duration (~65ms per character) so overlapping speech is prevented
    const estimatedSpeechDurationMs = Math.min(
      5000,
      Math.max(1200, script.text.length * 55),
    );
    const state = this.getOrCreateBattleState(event.battleId);
    state.lastBroadcastAtMs = nowMs;
    state.isSpeakingUntilMs = nowMs + estimatedSpeechDurationMs;

    const streamId = `stream_${randomUUID().slice(0, 8)}`;
    const totalChunks = Math.max(
      1,
      Math.ceil(tts.audioBuffer.length / this.chunkByteSize),
    );
    const chunks: ShoutcasterAudioChunk[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const slice = tts.audioBuffer.subarray(
        i * this.chunkByteSize,
        (i + 1) * this.chunkByteSize,
      );
      chunks.push({
        streamId,
        battleId: event.battleId,
        lineId: script.lineId,
        chunkIndex: i,
        totalChunks,
        isFinal: i === totalChunks - 1,
        mimeType: tts.mimeType,
        sampleRate: tts.sampleRate,
        audioBase64: slice.toString('base64'),
        transcript: script.text,
        emotion: script.emotion,
        style: script.style,
        latencyMs: totalLatencyMs,
      });
    }

    return {
      throttled: false,
      script,
      chunks,
      totalLatencyMs,
    };
  }
}

/**
 * Generates a compact, valid 16kHz 16-bit mono PCM WAV buffer with prosodic pitch contour
 * modulated by the commentary emotion tag (Hype, Suspense, Analytical, Climax).
 */
function synthesizeExpressivePcmWav(
  text: string,
  emotion: CommentaryEmotionTag,
): Buffer {
  const sampleRate = 16000;
  const durationSec = Math.min(0.45, Math.max(0.15, text.length * 0.004));
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataBytes = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);

  // RIFF/WAVE header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  buffer.writeUInt16LE(2, 32); // Block align
  buffer.writeUInt16LE(16, 34); // Bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);

  const baseFreq =
    emotion === 'Climax'
      ? 260
      : emotion === 'Hype'
        ? 220
        : emotion === 'Suspense'
          ? 165
          : 185;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const envelope = Math.sin((Math.PI * i) / numSamples);
    const syllableMod = 0.65 + 0.35 * Math.sin(2 * Math.PI * 7 * t);
    const freq = baseFreq + 30 * Math.sin(2 * Math.PI * 3.5 * t);
    const sample =
      Math.sin(2 * Math.PI * freq * t) * 0.5 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.25;
    const pcm16 = Math.max(
      -32767,
      Math.min(32767, Math.round(sample * envelope * syllableMod * 14000)),
    );
    buffer.writeInt16LE(pcm16, 44 + i * 2);
  }

  return buffer;
}
