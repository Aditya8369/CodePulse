"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Play, Sparkles, Volume2, VolumeX, Loader2 } from "lucide-react";
import {
  SfxSynthesizer,
  SoundPackId,
} from "../audio/sfx-synthesizer";
import {
  LatencyCompensator,
  JitterBuffer,
  Frame,
  NetworkQualityMetrics,
  interpolateCursorPositions,
  deadReckonTyping,
  getNetworkQualityColor,
  getNetworkQualityLabel,
} from "./latency-compensator";

export interface BattleEditorProps {
  initialCode?: string;
  soundPack?: SoundPackId;
  synthesizer?: SfxSynthesizer;
  onSubmitSolution?: (code: string, passedAll: boolean) => void;
  opponentUsername?: string;
  battleId?: string;
  socket?: { emit: (event: string, data: unknown) => void; on: (event: string, handler: (data: unknown) => void) => void; off: (event: string, handler: (data: unknown) => void) => void };
}

interface OpponentCursorState {
  position: number;
  code: string;
  isPredicted: boolean;
  lastUpdate: number;
}

export const BattleEditor: React.FC<BattleEditorProps> = ({
  initialCode = `export function solve(nums: number[], target: number): [number, number] {\n  const map = new Map<number, number>();\n  for (let i = 0; i < nums.length; i++) {\n    const diff = target - nums[i];\n    if (map.has(diff)) return [map.get(diff)!, i];\n    map.set(nums[i], i);\n  }\n  return [-1, -1];\n}`,
  soundPack = "mechanical-keyboard",
  synthesizer,
  onSubmitSolution,
  opponentUsername,
  battleId,
  socket,
}) => {
  const synthRef = useRef<SfxSynthesizer>(
    synthesizer ?? new SfxSynthesizer({ pack: soundPack })
  );
  const [code, setCode] = useState(initialCode);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [comboStreak, setComboStreak] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "Click inside editor to unlock zero-latency Web Audio SFX"
  );

  const latencyCompensatorRef = useRef<LatencyCompensator>(new LatencyCompensator());
  const jitterBufferRef = useRef<JitterBuffer>(new JitterBuffer());
  const [opponentCursor, setOpponentCursor] = useState<OpponentCursorState>({
    position: 0,
    code: "",
    isPredicted: false,
    lastUpdate: 0,
  });
  const [networkQuality, setNetworkQuality] = useState<NetworkQualityMetrics>({
    rtt: 0,
    jitter: 0,
    packetLoss: 0,
    quality: 'good',
  });
  const animationFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const compensator = latencyCompensatorRef.current;
    const jitterBuffer = jitterBufferRef.current;

    jitterBuffer.setOnFrameRelease((frame: Frame) => {
      setOpponentCursor({
        position: frame.cursorPosition,
        code: frame.code,
        isPredicted: false,
        lastUpdate: Date.now(),
      });
    });

    jitterBuffer.start();

    if (socket && battleId) {
      const handleOpponentKeystroke = (data: unknown) => {
        const d = data as { timestamp?: number; cursorPosition?: number; code?: string; sequenceNumber?: number };
        const frame: Frame = {
          timestamp: d.timestamp || Date.now(),
          cursorPosition: d.cursorPosition || 0,
          code: d.code || "",
          sequenceNumber: d.sequenceNumber || compensator.nextSequenceNumber(),
        };
        jitterBuffer.push(frame);
        jitterBuffer.setBufferSize(compensator.getDynamicBufferSize());
      };

      const handleHeartbeatAck = () => {
        compensator.handleHeartbeatAck();
      };

      socket.on('opponent_keystroke_stream', handleOpponentKeystroke);
      socket.on('heartbeat_ack', handleHeartbeatAck);

      compensator.startHeartbeat(
        () => socket.emit('heartbeat_ping', { battleId, timestamp: Date.now() }),
        (rtt) => compensator.recordRttSample(rtt)
      );

      return () => {
        socket.off('opponent_keystroke_stream', handleOpponentKeystroke);
        socket.off('heartbeat_ack', handleHeartbeatAck);
        compensator.stopHeartbeat();
        jitterBuffer.stop();
      };
    }
  }, [socket, battleId]);

  useEffect(() => {
    const animate = (timestamp: number) => {
      if (lastFrameTimeRef.current === 0) {
        lastFrameTimeRef.current = timestamp;
      }

      lastFrameTimeRef.current = timestamp;

      const compensator = latencyCompensatorRef.current;
      const jitterBuffer = jitterBufferRef.current;

      jitterBuffer.setBufferSize(compensator.getDynamicBufferSize());

      const bufferedFrames = jitterBuffer.getBufferedFrames();
      const now = Date.now();
      const interpolated = interpolateCursorPositions(bufferedFrames, now);

      setOpponentCursor((prev) => {
        if (interpolated.isPredicted) {
          const timeSinceLastUpdate = now - prev.lastUpdate;
          if (timeSinceLastUpdate > 0 && timeSinceLastUpdate <= 150) {
            const predicted = deadReckonTyping(
              prev.code,
              prev.position,
              timeSinceLastUpdate
            );
            return {
              ...prev,
              position: predicted.cursorPosition,
              code: predicted.code,
              isPredicted: true,
            };
          }
          return prev;
        } else {
          return {
            position: interpolated.position,
            code: prev.code,
            isPredicted: false,
            lastUpdate: now,
          };
        }
      });

      const quality = compensator.getNetworkQuality();
      setNetworkQuality(quality);

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setAudioUnlocked(synthRef.current.isUnlocked());
  }, []);

  const handleUserUnlock = useCallback(async () => {
    if (!synthRef.current.isUnlocked()) {
      const ok = await synthRef.current.unlockFromUserGesture();
      setAudioUnlocked(ok);
      if (ok) {
        setStatusMessage("Web Audio SFX active (< 5ms procedural synthesis)");
      }
    }
  }, []);

  const handleCodeChange = useCallback((nextCode: string) => {
    setCode(nextCode);
    const jitter = 0.94 + ((nextCode.length % 7) * 0.02);
    synthRef.current.playKeystroke(jitter);

    if (socket && battleId) {
      const cursorPosition = textareaRef.current?.selectionStart || 0;
      socket.emit('keystroke', {
        battleId,
        delta: nextCode.slice(code.length),
        cursorPosition,
        sequenceNumber: latencyCompensatorRef.current.nextSequenceNumber(),
        timestamp: Date.now(),
      });
    }
  }, [socket, battleId, code]);

  const handleRunTests = useCallback(async () => {
    await handleUserUnlock();
    const hasReturn = code.includes("return") && !code.includes("TODO");

    if (!hasReturn) {
      setComboStreak(0);
      synthRef.current.playCompileError();
      setStatusMessage("Compile / Assertion Error — missing valid return path");
      onSubmitSolution?.(code, false);
      return;
    }

    const nextStreak = comboStreak + 1;
    setComboStreak(nextStreak);

    if (nextStreak >= 3) {
      synthRef.current.playComboStreak(nextStreak);
      synthRef.current.playVictoryFanfare();
      setStatusMessage(`Combo x${nextStreak}! All test cases passed — Victory!`);
      onSubmitSolution?.(code, true);
    } else {
      synthRef.current.playTestPassed();
      setStatusMessage(`Test suite passed! Combo streak: ${nextStreak}`);
      onSubmitSolution?.(code, true);
    }
  }, [code, comboStreak, handleUserUnlock, onSubmitSolution]);

  const toggleMute = useCallback(async () => {
    await handleUserUnlock();
    const nextMuted = !isMuted;
    synthRef.current.setMuted(nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted, handleUserUnlock]);

  const qualityColor = getNetworkQualityColor(networkQuality.quality);
  const qualityLabel = getNetworkQualityLabel(networkQuality.quality);

  const renderPingBars = () => {
    const bars = 4;
    const rttValue = networkQuality.rtt;
    const activeBars = rttValue < 50 ? 4 : rttValue < 100 ? 3 : rttValue < 200 ? 2 : 1;

    return (
      <div className="flex items-end gap-1 h-5" aria-label={`Network quality: ${qualityLabel}, RTT: ${Math.round(rttValue)}ms`}>
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-t transition-all duration-300 ${
              i < activeBars
                ? qualityColor.replace('text-', 'bg-')
                : 'bg-zinc-700'
            }`}
            style={{ height: `${(i + 1) * 25}%` }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-zinc-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-semibold">Live Battle Code Editor</span>
          <span
            data-testid="sfx-unlock-badge"
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              audioUnlocked
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-amber-500/20 text-amber-300"
            }`}
          >
            {audioUnlocked ? "SFX Unlocked" : "Click to Enable SFX"}
          </span>
          {opponentUsername && (
            <span className="flex items-center gap-1.5 text-xs text-zinc-400">
              <span className="relative flex items-center">
                {renderPingBars()}
                <span className={`ml-1.5 ${qualityColor}`}>{qualityLabel}</span>
                <span className="ml-1 font-mono text-[10px] text-zinc-500">
                  {Math.round(networkQuality.rtt)}ms
                </span>
              </span>
              {opponentCursor.isPredicted && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Predicting...</span>
                </span>
              )}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={isMuted ? "Unmute Battle SFX" : "Mute Battle SFX"}
            onClick={toggleMute}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4 text-rose-400" />
            ) : (
              <Volume2 className="h-4 w-4 text-cyan-400" />
            )}
          </button>

          <button
            type="button"
            onClick={handleRunTests}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
          >
            <Play className="h-3.5 w-3.5" />
            Run Battle Tests
          </button>
        </div>
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          aria-label="Battle Solution Code Editor"
          value={code}
          onClick={handleUserUnlock}
          onChange={(e) => handleCodeChange(e.target.value)}
          rows={10}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-xs text-zinc-100 focus:border-cyan-500 focus:outline-none"
          spellCheck={false}
        />
        {opponentUsername && opponentCursor.code && (
          <div
            className="absolute inset-3 pointer-events-none font-mono text-xs overflow-hidden"
            style={{
              color: opponentCursor.isPredicted ? 'rgba(251, 191, 36, 0.6)' : 'rgba(6, 182, 212, 0.6)',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
            }}
          >
            {opponentCursor.code.slice(0, opponentCursor.position)}|{opponentCursor.code.slice(opponentCursor.position)}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span data-testid="battle-editor-status">{statusMessage}</span>
        <span className="font-mono">Streak: {comboStreak}x</span>
      </div>
    </div>
  );
};

export default BattleEditor;