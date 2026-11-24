'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { WebRtcBattleMesh, P2PDiagnostics } from './webrtc-battle-mesh';
import { Wifi, Zap, RefreshCw, ShieldCheck, AlertTriangle, ArrowRight, User } from 'lucide-react';

export interface BattleRoomProps {
  battleId: string;
  userId: string;
  username: string;
  opponentUsername?: string;
  isInitiator?: boolean;
  socket?: any; // Socket.io client instance
  initialCode?: string;
  onCodeChange?: (code: string) => void;
}

export function BattleRoom({
  battleId,
  userId,
  username,
  opponentUsername = 'Opponent',
  isInitiator = true,
  socket,
  initialCode = '// Start solving the coding challenge...\nfunction solution() {\n  return 42;\n}\n',
  onCodeChange,
}: BattleRoomProps) {
  const [code, setCode] = useState(initialCode);
  const [opponentCode, setOpponentCode] = useState('');
  const [diagnostics, setDiagnostics] = useState<P2PDiagnostics>({
    mode: 'connecting',
    rttMs: 12,
    packetLossPercentage: 0,
    packetsSent: 0,
    packetsReceived: 0,
    lastPingTimestamp: Date.now(),
    isDataChannelOpen: false,
    iceConnectionState: 'new',
  });
  const [syncStatus, setSyncStatus] = useState<'synced' | 'verifying' | 'desync'>('synced');
  const [lastVerifiedHash, setLastVerifiedHash] = useState<string>('');

  const meshRef = useRef<WebRtcBattleMesh | null>(null);
  const sequenceCounterRef = useRef(0);

  // Initialize WebRtcBattleMesh
  useEffect(() => {
    const mesh = new WebRtcBattleMesh({
      battleId,
      userId,
      isInitiator,
      onKeystroke: (data) => {
        if (data.patch) {
          setOpponentCode(data.patch);
        }
      },
      onModeChange: (newMode) => {
        setDiagnostics((prev) => ({ ...prev, mode: newMode }));
      },
      onDiagnosticsUpdate: (diag) => {
        setDiagnostics(diag);
      },
      onStateCheckpointMismatch: () => {
        setSyncStatus('desync');
      },
      signalingSend: (event, payload) => {
        if (socket?.emit) {
          socket.emit(event, payload);
        }
      },
    });

    meshRef.current = mesh;
    void mesh.initialize();

    // Listen to signaling messages forwarded from server
    if (socket?.on) {
      const handleOffer = (payload: any) => void mesh.handleSignal('webrtc:p2p_offer', payload);
      const handleAnswer = (payload: any) => void mesh.handleSignal('webrtc:p2p_answer', payload);
      const handleIce = (payload: any) => void mesh.handleSignal('webrtc:p2p_ice_candidate', payload);
      const handleVerified = (payload: any) => {
        setSyncStatus('synced');
        setLastVerifiedHash(payload.hash?.substring(0, 8) || '');
      };
      const handleDesync = () => setSyncStatus('desync');

      socket.on('webrtc:p2p_offer', handleOffer);
      socket.on('webrtc:p2p_answer', handleAnswer);
      socket.on('webrtc:p2p_ice_candidate', handleIce);
      socket.on('webrtc:p2p_state_verified', handleVerified);
      socket.on('webrtc:p2p_state_desync', handleDesync);

      return () => {
        mesh.destroy();
        socket.off('webrtc:p2p_offer', handleOffer);
        socket.off('webrtc:p2p_answer', handleAnswer);
        socket.off('webrtc:p2p_ice_candidate', handleIce);
        socket.off('webrtc:p2p_state_verified', handleVerified);
        socket.off('webrtc:p2p_state_desync', handleDesync);
      };
    }

    return () => {
      mesh.destroy();
    };
  }, [battleId, userId, isInitiator, socket]);

  // Handle local keystroke input
  const handleEditorChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newCode = e.target.value;
      setCode(newCode);
      onCodeChange?.(newCode);

      sequenceCounterRef.current += 1;
      const sequence = sequenceCounterRef.current;

      // Broadcast keystroke over P2P DataChannel
      meshRef.current?.sendKeystroke({
        battleId,
        userId,
        sequence,
        patch: newCode,
        timestamp: Date.now(),
      });

      // Periodically transmit cryptographic SHA-256 state checkpoint (every 10 keystrokes)
      if (sequence % 10 === 0) {
        setSyncStatus('verifying');
        void meshRef.current?.sendStateCheckpoint(newCode, sequence);
      }
    },
    [battleId, userId, onCodeChange],
  );

  return (
    <div className="flex flex-col w-full h-full bg-slate-950 text-slate-100 rounded-xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Top Header & Visual Connection Diagnostics */}
      <header className="flex flex-wrap items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-bold text-sm tracking-wide text-indigo-400">
            <Zap className="w-4 h-4 text-indigo-400" />
            <span>1v1 ARENA</span>
          </div>
          <span className="text-slate-600">|</span>
          <div className="flex items-center text-xs text-slate-400 space-x-1">
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-medium text-slate-200">{username}</span>
            <span className="text-slate-500">vs</span>
            <span className="font-medium text-slate-200">{opponentUsername}</span>
          </div>
        </div>

        {/* Real-time Diagnostics Pills */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          {/* Connection Mode Badge */}
          {diagnostics.mode === 'p2p' ? (
            <div
              data-testid="p2p-badge"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-mono"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>P2P Direct (&lt; 15ms)</span>
            </div>
          ) : diagnostics.mode === 'websocket-relay' ? (
            <div
              data-testid="relay-badge"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono"
            >
              <Wifi className="w-3.5 h-3.5 text-amber-400" />
              <span>WebSocket Relay</span>
            </div>
          ) : (
            <div
              data-testid="connecting-badge"
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 font-mono"
            >
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
              <span>Connecting Mesh...</span>
            </div>
          )}

          {/* RTT Ping Metric */}
          <div
            data-testid="rtt-ping"
            className="flex items-center px-2 py-1 rounded bg-slate-800/80 border border-slate-700 font-mono text-slate-300"
          >
            <span>{diagnostics.rttMs}ms P2P Ping</span>
          </div>

          {/* Packet Loss Metric */}
          <div
            data-testid="packet-loss"
            className="flex items-center px-2 py-1 rounded bg-slate-800/80 border border-slate-700 font-mono text-slate-300"
          >
            <span>{diagnostics.packetLossPercentage}% loss</span>
          </div>

          {/* SHA-256 State Sync Checkpoint */}
          <div
            data-testid="sync-status"
            className={`flex items-center space-x-1 px-2 py-1 rounded font-mono ${
              syncStatus === 'synced'
                ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400'
                : syncStatus === 'verifying'
                  ? 'bg-indigo-950/40 border border-indigo-500/30 text-indigo-400'
                  : 'bg-rose-950/40 border border-rose-500/30 text-rose-400'
            }`}
          >
            {syncStatus === 'synced' ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SHA-256 Synced {lastVerifiedHash ? `(${lastVerifiedHash})` : ''}</span>
              </>
            ) : syncStatus === 'verifying' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Verifying Checkpoint...</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Viewport Desynced</span>
              </>
            )}
          </div>

          {/* Test Manual Relay Fallback */}
          {diagnostics.mode === 'p2p' && (
            <button
              onClick={() => meshRef.current?.fallbackToWebSocketRelay('User requested fallback test')}
              className="px-2 py-1 text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition"
              title="Force WebSocket Relay Fallback"
            >
              Simulate Relay
            </button>
          )}
        </div>
      </header>

      {/* Dual Editor Grid */}
      <main className="grid grid-cols-1 md:grid-cols-2 flex-1 divide-y md:divide-y-0 md:divide-x divide-slate-800">
        {/* Local Player Editor */}
        <div className="flex flex-col h-full bg-slate-950">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>YOUR WORKSPACE ({username})</span>
            <span className="text-emerald-400 font-semibold">Active Editor</span>
          </div>
          <textarea
            value={code}
            onChange={handleEditorChange}
            aria-label="Your Code Editor"
            className="flex-1 w-full p-4 bg-transparent font-mono text-sm leading-relaxed text-slate-200 outline-none resize-none focus:ring-1 focus:ring-indigo-500/40"
            placeholder="Type your solution here..."
            spellCheck={false}
          />
        </div>

        {/* Remote Opponent Live Viewport (Synced over DataChannel) */}
        <div className="flex flex-col h-full bg-slate-950/60">
          <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/60 border-b border-slate-800 text-xs font-mono text-slate-400">
            <span>OPPONENT VIEWPORT ({opponentUsername})</span>
            <span className="text-indigo-400 font-semibold">Live P2P Stream</span>
          </div>
          <textarea
            value={opponentCode}
            readOnly
            aria-label="Opponent Code Viewport"
            className="flex-1 w-full p-4 bg-transparent font-mono text-sm leading-relaxed text-slate-400 outline-none resize-none cursor-default"
            placeholder="Waiting for opponent keystrokes..."
            spellCheck={false}
          />
        </div>
      </main>
    </div>
  );
}

