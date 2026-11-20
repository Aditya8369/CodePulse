import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SpectatorSpatialAudio } from '../components/audio/spectator-spatial-audio';

describe('SpectatorSpatialAudio Component', () => {
  it('renders spatial audio mix with competitor tracks', () => {
    render(<SpectatorSpatialAudio battleId="battle_vad_1" />);
    expect(screen.getByText(/Spatial Voice Mix/i)).toBeInTheDocument();
    expect(screen.getByText('Player 1 (Left Channel)')).toBeInTheDocument();
    expect(screen.getByText('Player 2 (Right Channel)')).toBeInTheDocument();
  });

  it('toggles stereo panning mode to mono mix', () => {
    render(<SpectatorSpatialAudio battleId="battle_vad_2" />);
    const modeBtn = screen.getByText('3D Stereo Panning: ON');
    fireEvent.click(modeBtn);

    expect(screen.getByText('Mono Mix')).toBeInTheDocument();
  });

  it('triggers volume and mute callbacks on interaction', () => {
    const muteSpy = vi.fn();
    render(<SpectatorSpatialAudio battleId="battle_vad_3" onMuteToggle={muteSpy} />);

    const muteButtons = screen.getAllByTitle('Mute');
    expect(muteButtons.length).toBeGreaterThan(0);
    fireEvent.click(muteButtons[0]);

    expect(muteSpy).toHaveBeenCalled();
  });
});

