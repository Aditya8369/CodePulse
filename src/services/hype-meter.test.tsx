import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { LiveHypeMeter } from '../components/battles/live-hype-meter';

describe('LiveHypeMeter Component', () => {
  it('renders hype meter and reaction trigger emojis', () => {
    render(<LiveHypeMeter battleId="battle_test_1" initialHypeIndex={45} />);
    expect(screen.getByText(/Live Spectator Hype/i)).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('triggers onReact callback when emoji clicked', () => {
    const reactSpy = vi.fn();
    render(<LiveHypeMeter battleId="battle_test_2" onReact={reactSpy} />);

    const fireButton = screen.getByText('🔥');
    fireEvent.click(fireButton);

    expect(reactSpy).toHaveBeenCalledWith('🔥');
  });
});
