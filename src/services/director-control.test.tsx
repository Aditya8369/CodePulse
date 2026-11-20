import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DirectorControlPanel } from '../components/esports/director-control-panel';

describe('DirectorControlPanel Component', () => {
  it('renders director panel with camera switches and overlay triggers', () => {
    render(<DirectorControlPanel tournamentId="tourney_test_1" />);
    expect(screen.getByText(/Tournament Caster Studio/i)).toBeInTheDocument();
    expect(screen.getByText('Split Screen (1v1)')).toBeInTheDocument();
    expect(screen.getByText('Lower Third Banner')).toBeInTheDocument();
  });

  it('triggers camera switch callback when camera button clicked', () => {
    const switchSpy = vi.fn();
    render(<DirectorControlPanel tournamentId="tourney_test_2" onSwitchCamera={switchSpy} />);

    const p1CamBtn = screen.getByText('Player 1 (Challenger)');
    fireEvent.click(p1CamBtn);

    expect(switchSpy).toHaveBeenCalledWith('player1');
  });

  it('toggles lower-third graphic overlay state', () => {
    const toggleSpy = vi.fn();
    render(<DirectorControlPanel tournamentId="tourney_test_3" onToggleLowerThird={toggleSpy} />);

    const lowerThirdBtn = screen.getByText('Lower Third Banner');
    fireEvent.click(lowerThirdBtn);

    expect(toggleSpy).toHaveBeenCalledWith(
      true,
      'Grand Championship Finals',
      'Match Point - Clutch Round',
    );
  });
});

