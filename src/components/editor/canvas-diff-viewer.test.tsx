import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasDiffViewer } from './canvas-diff-viewer';
import { alignLines, displayRows, splitSource } from './diff-model';

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { FakeWorker.instances.push(this); }
  postMessage(request: { type: string; before: string; after: string; unified: boolean }) {
    if (request.type === 'prepare') queueMicrotask(() => this.onmessage?.({ data: { type: 'prepared', rows: displayRows(alignLines(splitSource(request.before), splitSource(request.after)), request.unified), duration: 1 } }));
  }
}
beforeEach(() => {
  FakeWorker.instances = []; vi.stubGlobal('Worker', FakeWorker);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('canvas comparison integration', () => {
  it('exposes native read-only panes and copies without alignment blank lines', async () => {
    render(<CanvasDiffViewer original={'a\nb'} modified={'a\nx\nb'} />);
    const old = await screen.findByRole('textbox', { name: 'Original code, read only' });
    expect(old).toHaveAttribute('readonly'); old.focus(); expect(old).toHaveFocus();
    (old as HTMLTextAreaElement).setSelectionRange(0, 0);
    fireEvent.keyDown(old, { key: 'ArrowRight', shiftKey: true });
    expect((old as HTMLTextAreaElement).selectionEnd).toBe(1);
    (old as HTMLTextAreaElement).setSelectionRange(0, (old as HTMLTextAreaElement).value.length);
    const setData = vi.fn(); fireEvent.copy(old, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', 'a\nb');
    fireEvent.click(screen.getByRole('button', { name: 'Copy modified' }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('a\nx\nb'));
  });
  it('switches to unified mode and terminates replaced workers', async () => {
    render(<CanvasDiffViewer original="old" modified="new" />);
    await screen.findByRole('textbox', { name: 'Modified code, read only' });
    const oldWorker = FakeWorker.instances[0];
    fireEvent.click(screen.getByRole('button', { name: 'Unified' }));
    expect(await screen.findByRole('textbox', { name: 'Unified code, read only' })).toHaveValue('- old\n+ new');
    expect(oldWorker.terminate).toHaveBeenCalledTimes(1);
  });
  it('ignores late responses from a replaced source and cleans up on unmount', async () => {
    const view = render(<CanvasDiffViewer original="a" modified="b" />);
    await screen.findByRole('textbox', { name: 'Modified code, read only' });
    const first = FakeWorker.instances[0]; view.rerender(<CanvasDiffViewer original="next" modified="latest" />);
    expect(await screen.findByRole('textbox', { name: 'Modified code, read only' })).toHaveValue('latest');
    act(() => first.onmessage?.({ data: { type: 'error', message: 'stale error' } }));
    expect(screen.queryByText('stale error')).not.toBeInTheDocument();
    const last = FakeWorker.instances.at(-1)!; view.unmount(); expect(last.terminate).toHaveBeenCalledTimes(1);
  });
  it('reports worker failure and allows retry while preserving source copy', async () => {
    render(<CanvasDiffViewer original="a" modified="b" />);
    await screen.findByRole('textbox', { name: 'Modified code, read only' });
    act(() => FakeWorker.instances[0].onerror?.());
    expect(screen.getByRole('alert')).toHaveTextContent('Retry');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('textbox', { name: 'Modified code, read only' })).toHaveValue('b');
  });
});
