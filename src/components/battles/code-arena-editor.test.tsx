import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { CodeArenaEditor } from './code-arena-editor';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('CodeArenaEditor', () => {
  const defaultProps = {
    problemTitle: 'Two Sum Algorithmic Challenge',
    problemDescription: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
  };

  it('renders problem specification and editor correctly', () => {
    render(<CodeArenaEditor {...defaultProps} />);

    expect(screen.getByTestId('code-arena-editor-container')).toBeInTheDocument();
    expect(screen.getByText('Two Sum Algorithmic Challenge')).toBeInTheDocument();
    expect(screen.getByTestId('execute-code-btn')).toBeInTheDocument();
    expect(screen.getByTestId('test-cases-list')).toBeInTheDocument();
  });

  it('switches tabs between tests, console output, and telemetry', () => {
    render(<CodeArenaEditor {...defaultProps} />);

    // Click Console Output Tab
    const consoleTab = screen.getByText('Console Output');
    fireEvent.click(consoleTab);
    expect(screen.getByTestId('execution-console-output')).toBeInTheDocument();

    // Click Telemetry Tab
    const telemetryTab = screen.getByText('Telemetry');
    fireEvent.click(telemetryTab);
    expect(screen.getByText('Total Execution Time')).toBeInTheDocument();
  });

  it('executes code and updates live test cases', async () => {
    const onRunCompleteMock = vi.fn();
    render(<CodeArenaEditor {...defaultProps} onRunComplete={onRunCompleteMock} />);

    const runBtn = screen.getByTestId('execute-code-btn');
    await act(async () => {
      fireEvent.click(runBtn);
      // Wait for test runner iterations
      await new Promise((r) => setTimeout(r, 600));
    });

    expect(screen.getByTestId('execution-verdict-summary')).toBeInTheDocument();
    expect(onRunCompleteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        passed: true,
        passedTests: 5,
        totalTests: 5,
      })
    );
  });
});
