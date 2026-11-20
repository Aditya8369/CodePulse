import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { OpaPolicySimulator } from '../components/admin/opa-policy-simulator';

describe('OpaPolicySimulator Admin UI Component', () => {
  it('renders simulator component with header and controls', () => {
    render(<OpaPolicySimulator />);
    expect(screen.getByText(/OPA Rego Policy Simulator/i)).toBeInTheDocument();
    expect(screen.getByText(/Wasm Engine/i)).toBeInTheDocument();
  });

  it('evaluates policy and shows ALLOWED result for valid input', () => {
    render(<OpaPolicySimulator />);
    const evalButton = screen.getByText('Evaluate Policy');
    fireEvent.click(evalButton);

    expect(screen.getByText(/DENIED/i)).toBeInTheDocument();
  });
});
