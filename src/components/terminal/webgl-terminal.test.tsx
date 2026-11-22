import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { WebglTerminal } from './webgl-terminal';

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
  },
}));

describe('WebglTerminal with History and Auto-Suggestions', () => {
  it('renders WebGL terminal container and prompt input', () => {
    render(<WebglTerminal sessionId="test-session-42" />);

    expect(screen.getByTestId('webgl-terminal-container')).toBeInTheDocument();
    expect(screen.getByText(/pty-sandbox:\/\/test-session-42/i)).toBeInTheDocument();
    expect(screen.getByTestId('terminal-command-input')).toBeInTheDocument();
  });

  it('displays auto-suggestions popup when user types matching command prefix', () => {
    render(<WebglTerminal />);

    const input = screen.getByTestId('terminal-command-input');
    fireEvent.change(input, { target: { value: 'car' } });

    expect(screen.getByTestId('command-suggestion-popup')).toBeInTheDocument();
    expect(screen.getByText('cargo test --release')).toBeInTheDocument();
  });

  it('autocompletes suggestion on Tab key', () => {
    render(<WebglTerminal />);

    const input = screen.getByTestId('terminal-command-input');
    fireEvent.change(input, { target: { value: 'car' } });
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(input).toHaveValue('cargo test --release');
  });

  it('navigates command history with ArrowUp and ArrowDown keys', () => {
    render(
      <WebglTerminal
        initialHistory={['python3 test.py', 'git log -n 5']}
      />
    );

    const input = screen.getByTestId('terminal-command-input');

    // Press ArrowUp to get previous command
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('python3 test.py');

    // Press ArrowUp again for older command
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('git log -n 5');

    // Press ArrowDown to return forward
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('python3 test.py');
  });

  it('toggles command history drawer', () => {
    render(<WebglTerminal />);

    const historyBtn = screen.getByTestId('toggle-history-btn');
    fireEvent.click(historyBtn);

    expect(screen.getByTestId('terminal-history-drawer')).toBeInTheDocument();
  });

  it('clears terminal viewport when clear button is clicked', () => {
    render(<WebglTerminal />);

    const clearBtn = screen.getByTestId('clear-terminal-btn');
    fireEvent.click(clearBtn);

    const viewport = screen.getByTestId('terminal-viewport');
    expect(viewport.textContent).not.toContain('CodePulse Ephemeral WebGL PTY Shell');
  });
});
