import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { CustomChallengeModal } from './custom-challenge-modal';

// Mock dependencies
const mockAddCustomChallenge = vi.fn();
vi.mock('@/lib/custom-challenges', () => ({
  addCustomChallenge: (val: any) => mockAddCustomChallenge(val),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('CustomChallengeModal Stepper Wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders step 1 and validates required title', () => {
    render(<CustomChallengeModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByTestId('custom-challenge-modal')).toBeInTheDocument();
    expect(screen.getByTestId('step-1-basics')).toBeInTheDocument();

    // Click continue without title
    fireEvent.click(screen.getByTestId('next-step-btn'));
    expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
  });

  it('navigates through steps, adds and runs test cases, and publishes challenge', async () => {
    const onChallengeCreated = vi.fn();
    const onClose = vi.fn();

    render(
      <CustomChallengeModal
        isOpen={true}
        onClose={onClose}
        onChallengeCreated={onChallengeCreated}
      />
    );

    // Step 1: Fill Basics
    const titleInput = screen.getByTestId('challenge-title-input');
    fireEvent.change(titleInput, { target: { value: 'Reverse Polish Notation Evaluator' } });
    fireEvent.click(screen.getByTestId('next-step-btn'));

    // Step 2: Code & Specs
    expect(screen.getByTestId('step-2-code-specs')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('next-step-btn'));

    // Step 3: Test Runner
    expect(screen.getByTestId('step-3-test-runner')).toBeInTheDocument();
    expect(screen.getByTestId('test-case-row-0')).toBeInTheDocument();

    // Add another test case
    fireEvent.click(screen.getByTestId('add-test-case-btn'));
    expect(screen.getByTestId('test-case-row-2')).toBeInTheDocument();

    // Run sandboxed tests
    fireEvent.click(screen.getByTestId('run-test-cases-btn'));
    await waitFor(() => {
      expect(screen.getAllByText(/Passed/i).length).toBeGreaterThan(0);
    });

    // Step 4: Review
    fireEvent.click(screen.getByTestId('next-step-btn'));
    expect(screen.getByTestId('step-4-review')).toBeInTheDocument();
    expect(screen.getByText('Reverse Polish Notation Evaluator')).toBeInTheDocument();

    // Publish
    fireEvent.click(screen.getByTestId('publish-challenge-btn'));
    expect(mockAddCustomChallenge).toHaveBeenCalled();
    expect(onChallengeCreated).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
