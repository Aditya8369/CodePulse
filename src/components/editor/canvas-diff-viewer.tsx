'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { copySelection, expandTabs, keyboardPosition, ROW_HEIGHT, selectionText, splitSource, viewportRows, type DisplayRow, type PaintRow, type Token } from './diff-model';
import type { DiffRequest } from './diff-tokenizer';
import styles from './canvas-diff-viewer.module.css';

type Viewport = { top: number; left: number; height: number };
type Side = 'before' | 'after' | 'unified';
const FONT = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
const colors = { plain: '#e2e8f0', keyword: '#c4b5fd', string: '#86efac', comment: '#94a3b8', number: '#fcd34d' };

function Pane({ side, text, rows, before, after, paint, viewport, onViewport }: {
  side: Side; text: string; rows: DisplayRow[]; before: string[]; after: string[];
  paint: Map<number, PaintRow>; viewport: Viewport; onViewport: (value: Viewport) => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ width: 600, height: 440 });
  const digits = String(Math.max(before.length, after.length)).length;
  const gutter = side === 'unified' ? Math.max(94, digits * 18 + 22) : Math.max(54, digits * 9 + 16);
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    const resize = () => { setSize({ width: el.clientWidth, height: el.clientHeight }); onViewport({ top: el.scrollTop, left: el.scrollLeft, height: el.clientHeight }); };
    resize(); const observer = new ResizeObserver(resize); observer.observe(el);
    return () => observer.disconnect();
  }, [onViewport]);
  useEffect(() => {
    const el = textarea.current;
    if (el && (Math.abs(el.scrollTop - viewport.top) > 1 || Math.abs(el.scrollLeft - viewport.left) > 1)) {
      el.scrollTop = viewport.top; el.scrollLeft = viewport.left;
    }
  }, [viewport]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const context = el.getContext('2d'); if (!context) return;
    const started = performance.now(), ratio = window.devicePixelRatio || 1;
    el.width = Math.ceil(size.width * ratio); el.height = Math.ceil(size.height * ratio);
    context.scale(ratio, ratio); context.font = FONT; context.textBaseline = 'alphabetic';
    context.fillStyle = '#0b1220'; context.fillRect(0, 0, size.width, size.height);
    const range = viewportRows(viewport.top, size.height, rows.length);
    const charWidth = context.measureText('M').width;
    const width = (value: string) => /^[\x00-\x7f]*$/.test(value) ? value.length * charWidth : context.measureText(value).width;
    for (let i = range.start; i < range.end; i++) {
      const row = rows[i], y = i * ROW_HEIGHT - viewport.top;
      const sourceSide = side === 'unified' ? (row.after === null ? 'before' : 'after') : side;
      const lineIndex = row[sourceSide];
      const line = lineIndex === null ? '' : expandTabs((sourceSide === 'before' ? before : after)[lineIndex]);
      const prefix = side === 'unified' ? row.prefix || '' : '';
      const changed = row.kind !== 'equal' && lineIndex !== null;
      const removed = row.kind === 'remove' || (row.kind === 'change' && sourceSide === 'before');
      if (changed) { context.fillStyle = removed ? '#3a1924' : '#123327'; context.fillRect(0, y, size.width, ROW_HEIGHT); }
      context.save(); context.beginPath(); context.rect(gutter, 0, size.width - gutter, size.height); context.clip();
      const x = gutter + width(prefix) - viewport.left;
      const info = paint.get(i);
      if (changed && info) {
        const [start, end] = sourceSide === 'before' ? info.removed : info.added;
        context.fillStyle = removed ? '#843344' : '#166b49';
        context.fillRect(x + width(line.slice(0, start)), y, width(line.slice(start, end)), ROW_HEIGHT);
      }
      context.fillStyle = '#cbd5e1'; context.fillText(prefix, gutter - viewport.left, y + 16);
      let offset = x;
      const tokens: Token[] = info?.[sourceSide] ?? [{ text: line, kind: 'plain' }];
      for (const token of tokens) {
        const tokenWidth = width(token.text);
        if (offset + tokenWidth >= gutter && offset <= size.width) {
          context.fillStyle = colors[token.kind];
          if (/^[\x00-\x7f]*$/.test(token.text)) {
            const start = Math.max(0, Math.floor((gutter - offset) / charWidth));
            const end = Math.min(token.text.length, Math.ceil((size.width - offset) / charWidth) + 1);
            context.fillText(token.text.slice(start, end), offset + start * charWidth, y + 16);
          } else context.fillText(token.text, offset, y + 16);
        }
        offset += tokenWidth;
      }
      context.restore(); context.fillStyle = '#111c30'; context.fillRect(0, y, gutter - 6, ROW_HEIGHT);
      context.fillStyle = '#94a3b8';
      const number = side === 'unified' ? `${row.before === null ? '' : row.before + 1} ${row.after === null ? '' : row.after + 1}` : lineIndex === null ? '' : String(lineIndex + 1);
      context.fillText(number, 5, y + 16);
    }
    el.dataset.paintMs = (performance.now() - started).toFixed(2);
    el.dataset.visibleRows = String(range.end - range.start);
  }, [size, viewport, rows, before, after, paint, side, gutter]);
  return <section className={styles.pane} aria-label={`${side} comparison pane`}>
    <h3>{side === 'before' ? 'Original' : side === 'after' ? 'Modified' : 'Unified diff'}</h3>
    <div className={styles.viewport}>
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      <textarea ref={textarea} className={styles.selection} style={{ paddingLeft: gutter, lineHeight: `${ROW_HEIGHT}px` }}
        aria-label={`${side === 'before' ? 'Original' : side === 'after' ? 'Modified' : 'Unified'} code, read only`}
        aria-describedby="diff-keyboard-help" value={text} readOnly wrap="off" spellCheck={false}
        onKeyDown={event => {
          if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) return;
          event.preventDefault();
          const el = event.currentTarget, backward = el.selectionDirection === 'backward';
          const focus = backward ? el.selectionStart : el.selectionEnd, anchor = backward ? el.selectionEnd : el.selectionStart;
          const target = !event.shiftKey && el.selectionStart !== el.selectionEnd && ['ArrowLeft', 'ArrowRight'].includes(event.key)
            ? event.key === 'ArrowLeft' ? el.selectionStart : el.selectionEnd
            : keyboardPosition(text, focus, event.key, Math.floor(el.clientHeight / ROW_HEIGHT));
          el.setSelectionRange(event.shiftKey ? Math.min(anchor, target) : target, event.shiftKey ? Math.max(anchor, target) : target, target < anchor ? 'backward' : 'forward');
          const line = text.slice(0, target).split('\n').length - 1, top = line * ROW_HEIGHT;
          if (top < el.scrollTop) el.scrollTop = top;
          else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_HEIGHT - el.clientHeight;
          const lineStart = target > 0 ? text.lastIndexOf('\n', target - 1) + 1 : 0;
          const x = expandTabs(text.slice(lineStart, target)).length * 8.43;
          if (x < el.scrollLeft) el.scrollLeft = x;
          else if (x > el.scrollLeft + el.clientWidth - gutter - 16) el.scrollLeft = x - el.clientWidth + gutter + 16;
          onViewport({ top: el.scrollTop, left: el.scrollLeft, height: el.clientHeight });
        }}
        onScroll={event => { const el = event.currentTarget; onViewport({ top: el.scrollTop, left: el.scrollLeft, height: el.clientHeight }); }}
        onCopy={event => { const el = event.currentTarget; if (el.selectionStart !== el.selectionEnd) { event.preventDefault(); event.clipboardData.setData('text/plain', copySelection(text, rows, el.selectionStart, el.selectionEnd, side)); } }} />
    </div>
  </section>;
}

export function CanvasDiffViewer({ original, modified }: { original: string; modified: string }) {
  const [unified, setUnified] = useState(false), [rows, setRows] = useState<DisplayRow[]>([]);
  const [paint, setPaint] = useState<Map<number, PaintRow>>(new Map());
  const [status, setStatus] = useState('Preparing comparison…'), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const [viewport, setViewport] = useState<Viewport>({ top: 0, left: 0, height: 440 });
  const [request, setRequest] = useState({ original, modified, unified, attempt });
  if (request.original !== original || request.modified !== modified || request.unified !== unified || request.attempt !== attempt) {
    setRequest({ original, modified, unified, attempt });
    setRows([]); setPaint(new Map()); setError(''); setStatus('Preparing comparison…'); setViewport({ top: 0, left: 0, height: 440 });
  }
  const worker = useRef<Worker | null>(null), frame = useRef<number | null>(null), nextViewport = useRef(viewport);
  const sources = useMemo(() => { try { return { before: splitSource(original), after: splitSource(modified), error: '' }; } catch (e) { return { before: [], after: [], error: (e as Error).message }; } }, [original, modified]);
  const onViewport = useCallback((value: Viewport) => {
    nextViewport.current = value;
    if (frame.current === null) frame.current = requestAnimationFrame(() => {
      const v = nextViewport.current; setViewport(old => old.top === v.top && old.left === v.left && old.height === v.height ? old : v); frame.current = null;
    });
  }, []);
  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);
  useEffect(() => {
    if (sources.error) return;
    let active = true;
    try {
      const instance = new Worker(new URL('./diff-tokenizer.ts', import.meta.url), { type: 'module' }); worker.current = instance;
      instance.onmessage = event => {
        if (!active) return;
        if (event.data.type === 'error') { setError(event.data.message); setStatus('Comparison unavailable.'); }
        else if (event.data.type === 'prepared') { setRows(event.data.rows); setStatus(`${event.data.rows.length.toLocaleString()} aligned rows · prepared in ${event.data.duration.toFixed(1)} ms`); }
        else if (event.data.type === 'tokens') setPaint(new Map((event.data.paint as PaintRow[]).map(row => [row.index, row])));
      };
      instance.onerror = () => { if (active) { setError('The background comparison could not start. Retry or use the source copy buttons.'); setStatus('Comparison unavailable.'); } };
      instance.postMessage({ type: 'prepare', before: original, after: modified, unified } satisfies DiffRequest);
      return () => { active = false; instance.terminate(); if (worker.current === instance) worker.current = null; };
    } catch { queueMicrotask(() => { if (active) setError('Web Workers are unavailable in this browser. Use the source copy buttons.'); }); return () => { active = false; }; }
  }, [original, modified, unified, attempt, sources.error]);
  useEffect(() => {
    if (!rows.length) return;
    const range = viewportRows(viewport.top, viewport.height, rows.length);
    worker.current?.postMessage({ type: 'tokens', ...range } satisfies DiffRequest);
  }, [rows, viewport]);
  const selections = useMemo(() => ({ before: selectionText(rows, sources.before, sources.after, 'before'), after: selectionText(rows, sources.before, sources.after, 'after'), unified: unified ? selectionText(rows, sources.before, sources.after, 'unified') : '' }), [rows, sources, unified]);
  const copy = async (value: string) => { try { await navigator.clipboard.writeText(value); setStatus('Source copied.'); } catch { setStatus('Clipboard unavailable. Select text and use your browser’s Copy command.'); } };
  return <div className={styles.viewer} data-diff-rows={rows.length}>
    <div className={styles.toolbar}>
      <div role="group" aria-label="Comparison layout"><button type="button" aria-pressed={!unified} onClick={() => setUnified(false)}>Side by side</button><button type="button" aria-pressed={unified} onClick={() => setUnified(true)}>Unified</button></div>
      <div><button type="button" onClick={() => void copy(original)}>Copy original</button><button type="button" onClick={() => void copy(modified)}>Copy modified</button></div>
    </div>
    <p className={styles.status} role="status" aria-live="polite">{status}</p>
    {(error || sources.error) && <p role="alert">{sources.error || error} <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry</button></p>}
    <p id="diff-keyboard-help" className={styles.help}>Focus a code pane to navigate with arrow keys, select with Shift, and copy with your browser’s Copy command. Green marks additions; red marks removals.</p>
    {!error && !sources.error && rows.length > 0 && <div className={unified ? styles.single : styles.split}>
      {(unified ? ['unified'] as const : ['before', 'after'] as const).map(side => <Pane key={side} side={side} text={selections[side]} rows={rows} before={sources.before} after={sources.after} paint={paint} viewport={viewport} onViewport={onViewport} />)}
    </div>}
  </div>;
}
