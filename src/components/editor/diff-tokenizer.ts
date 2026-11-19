import { alignLines, changeRanges, commentStates, displayRows, expandTabs, splitSource, tokenizeLine, type DisplayRow, type PaintRow } from './diff-model';
export type DiffRequest = { type: 'prepare'; before: string; after: string; unified: boolean } | { type: 'tokens'; start: number; end: number };
let before: string[] = [], after: string[] = [], rows: DisplayRow[] = [], oldStates: boolean[] = [], newStates: boolean[] = [];
self.addEventListener('message', (event: MessageEvent<DiffRequest>) => {
  try {
    const request = event.data;
    if (request.type === 'prepare') {
      const start = performance.now(); before = splitSource(request.before); after = splitSource(request.after);
      rows = displayRows(alignLines(before, after), request.unified);
      oldStates = commentStates(before); newStates = commentStates(after);
      self.postMessage({ type: 'prepared', rows, duration: performance.now() - start });
    } else if (request.type === 'tokens') {
      const start = Math.max(0, Math.floor(request.start)), end = Math.min(rows.length, start + 200, Math.ceil(request.end));
      const paint: PaintRow[] = [];
      for (let i = start; i < end; i++) {
        const row = rows[i], oldText = row.before === null ? '' : expandTabs(before[row.before]), newText = row.after === null ? '' : expandTabs(after[row.after]);
        paint.push({ index: i, before: tokenizeLine(oldText, row.before === null ? false : oldStates[row.before]).tokens, after: tokenizeLine(newText, row.after === null ? false : newStates[row.after]).tokens, ...changeRanges(oldText, newText) });
      }
      self.postMessage({ type: 'tokens', paint });
    }
  } catch (error) { self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Unable to prepare the diff.' }); }
});
