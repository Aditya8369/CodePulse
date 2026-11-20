import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArchitectureCanvas } from '../components/editor/architecture-canvas';

describe('ArchitectureCanvas Whiteboard Component', () => {
  it('renders whiteboard toolbar with service and database tools', () => {
    render(<ArchitectureCanvas battleId="match_wb_101" />);
    expect(screen.getByText(/Architecture Whiteboard/i)).toBeInTheDocument();
    expect(screen.getByText('+ Service')).toBeInTheDocument();
    expect(screen.getByText('+ Database')).toBeInTheDocument();
  });

  it('adds a new service node when "+ Service" button is clicked', () => {
    const addSpy = vi.fn();
    render(<ArchitectureCanvas battleId="match_wb_102" onShapeAdd={addSpy} />);

    const addBtn = screen.getByText('+ Service');
    fireEvent.click(addBtn);

    expect(addSpy).toHaveBeenCalled();
    expect(addSpy.mock.calls[0][0].type).toBe('microservice');
  });

  it('triggers Mermaid.js export callback when export button is clicked', () => {
    const exportSpy = vi.fn();
    render(<ArchitectureCanvas battleId="match_wb_103" onExport={exportSpy} />);

    const exportBtn = screen.getByText('Mermaid');
    fireEvent.click(exportBtn);

    expect(exportSpy).toHaveBeenCalledWith('mermaid');
  });
});
