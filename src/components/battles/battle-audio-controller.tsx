'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  SpatialAudioEngine,
  AudioMixSettings,
  PlayerSide,
} from '../audio/spatial-audio-engine';

export interface BattleAudioControllerProps {
  leftPlayerUsername?: string;
  rightPlayerUsername?: string;
  leftPlayerWpm?: number;
  rightPlayerWpm?: number;
  onAudioEngineReady?: (engine: SpatialAudioEngine) => void;
  className?: string;
}

export const BattleAudioController: React.FC<BattleAudioControllerProps> = ({
  leftPlayerUsername = 'Player 1',
  rightPlayerUsername = 'Player 2',
  leftPlayerWpm = 0,
  rightPlayerWpm = 0,
  onAudioEngineReady,
  className = '',
}) => {
  const engineRef = useRef<SpatialAudioEngine | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mix, setMix] = useState<AudioMixSettings>({
    masterVolume: 0.8,
    sfxVolume: 0.9,
    commentaryVolume: 1.0,
    spatialEnabled: true,
    duckingEnabled: true,
  });

  const [activeTab, setActiveTab] = useState<'quick' | 'mixer'>('quick');

  // Initialize engine on first interaction
  const handleStartAudio = async () => {
    if (!engineRef.current) {
      engineRef.current = new SpatialAudioEngine();
    }
    await engineRef.current.ensureContext();
    setIsInitialized(true);
    if (onAudioEngineReady) {
      onAudioEngineReady(engineRef.current);
    }
  };

  // Sync adrenaline modulation with highest active WPM
  useEffect(() => {
    if (isInitialized && engineRef.current) {
      const topWpm = Math.max(leftPlayerWpm, rightPlayerWpm);
      engineRef.current.updateAdrenalineWpm(topWpm);
    }
  }, [leftPlayerWpm, rightPlayerWpm, isInitialized]);

  const handleMixChange = (key: keyof AudioMixSettings, value: number | boolean) => {
    if (!engineRef.current) return;
    const updated = engineRef.current.updateMixSettings({ [key]: value });
    setMix({ ...updated });
  };

  const handleToggleMute = () => {
    if (!engineRef.current) return;
    if (isMuted) {
      engineRef.current.updateMixSettings({ masterVolume: mix.masterVolume });
      setIsMuted(false);
    } else {
      engineRef.current.updateMixSettings({ masterVolume: 0 });
      setIsMuted(true);
    }
  };

  const triggerTestSfx = (type: 'click' | 'error' | 'chime' | 'countdown', side: PlayerSide) => {
    if (!engineRef.current) return;
    if (type === 'click') engineRef.current.playKeystrokeClick(side);
    else if (type === 'error') engineRef.current.playCompileErrorBuzzer(side);
    else if (type === 'chime') engineRef.current.playTestSuccessChime(side);
    else if (type === 'countdown') engineRef.current.playCountdownBeep(true);
  };

  return (
    <div
      role="region"
      aria-label="Battle Audio Soundscape Controller"
      className={`rounded-xl border border-white/10 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-md text-white font-sans ${className}`}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-3 w-3 relative">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                isInitialized ? 'bg-cyan-400 opacity-75' : 'bg-amber-400 opacity-50'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isInitialized ? 'bg-cyan-500' : 'bg-amber-500'
              }`}
            />
          </span>
          <h3 className="text-sm font-bold tracking-wider uppercase text-cyan-400">
            3D Spatial Audio Soundscape
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {!isInitialized ? (
            <button
              onClick={handleStartAudio}
              className="px-3 py-1 text-xs font-semibold rounded bg-cyan-600 hover:bg-cyan-500 text-white transition-all shadow-md hover:shadow-cyan-500/20 active:scale-95"
            >
              Enable Soundscape
            </button>
          ) : (
            <button
              onClick={handleToggleMute}
              className={`px-3 py-1 text-xs font-semibold rounded transition-all ${
                isMuted
                  ? 'bg-rose-600 text-white hover:bg-rose-500'
                  : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
          )}
        </div>
      </div>

      {isInitialized && (
        <>
          {/* Spatial Stereo Indicator Bar */}
          <div className="mb-4 rounded-lg bg-slate-800/80 p-2.5 border border-white/5">
            <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5 font-medium">
              <span className="flex items-center gap-1 text-sky-400">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Left: {leftPlayerUsername} ({leftPlayerWpm} WPM)
              </span>
              <span className="text-[10px] uppercase tracking-widest text-slate-500">
                HRTF Binaural Stereo
              </span>
              <span className="flex items-center gap-1 text-purple-400">
                Right: {rightPlayerUsername} ({rightPlayerWpm} WPM)
                <span className="w-2 h-2 rounded-full bg-purple-400" />
              </span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-slate-700 overflow-hidden flex">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (leftPlayerWpm / 150) * 100)}%` }}
              />
              <div className="flex-1 bg-transparent" />
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${Math.min(100, (rightPlayerWpm / 150) * 100)}%` }}
              />
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setActiveTab('quick')}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                activeTab === 'quick' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Quick Test
            </button>
            <button
              onClick={() => setActiveTab('mixer')}
              className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
                activeTab === 'mixer' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              Mixer Controls
            </button>
          </div>

          {activeTab === 'quick' ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col gap-1.5 p-2 rounded bg-sky-950/30 border border-sky-500/20">
                <span className="text-sky-400 font-semibold text-[11px] uppercase tracking-wider">
                  Left Ear ({leftPlayerUsername})
                </span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => triggerTestSfx('click', 'left')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                  >
                    Click
                  </button>
                  <button
                    onClick={() => triggerTestSfx('chime', 'left')}
                    className="px-2 py-1 bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60 rounded"
                  >
                    Chime
                  </button>
                  <button
                    onClick={() => triggerTestSfx('error', 'left')}
                    className="px-2 py-1 bg-rose-950/60 text-rose-400 hover:bg-rose-900/60 rounded"
                  >
                    Buzzer
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 p-2 rounded bg-purple-950/30 border border-purple-500/20">
                <span className="text-purple-400 font-semibold text-[11px] uppercase tracking-wider">
                  Right Ear ({rightPlayerUsername})
                </span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => triggerTestSfx('click', 'right')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                  >
                    Click
                  </button>
                  <button
                    onClick={() => triggerTestSfx('chime', 'right')}
                    className="px-2 py-1 bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900/60 rounded"
                  >
                    Chime
                  </button>
                  <button
                    onClick={() => triggerTestSfx('error', 'right')}
                    className="px-2 py-1 bg-rose-950/60 text-rose-400 hover:bg-rose-900/60 rounded"
                  >
                    Buzzer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Master Volume</span>
                  <span>{Math.round(mix.masterVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={mix.masterVolume}
                  onChange={(e) => handleMixChange('masterVolume', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>SFX Volume (Keystrokes & Bells)</span>
                  <span>{Math.round(mix.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={mix.sfxVolume}
                  onChange={(e) => handleMixChange('sfxVolume', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Commentary Audio</span>
                  <span>{Math.round(mix.commentaryVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={mix.commentaryVolume}
                  onChange={(e) => handleMixChange('commentaryVolume', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={mix.spatialEnabled}
                    onChange={(e) => handleMixChange('spatialEnabled', e.target.checked)}
                    className="rounded bg-slate-700 border-white/10 text-cyan-500 focus:ring-0"
                  />
                  <span>3D HRTF Spatial Panning</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={mix.duckingEnabled}
                    onChange={(e) => handleMixChange('duckingEnabled', e.target.checked)}
                    className="rounded bg-slate-700 border-white/10 text-cyan-500 focus:ring-0"
                  />
                  <span>Voice Ducking (Auto SFX Dim)</span>
                </label>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

