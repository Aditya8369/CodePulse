export const ROW_HEIGHT = 22;
export const OVERSCAN = 20;
export const MAX_INPUT_CHARS = 8_000_000;
export type DiffKind = 'equal' | 'add' | 'remove' | 'change';
export type DiffRow = { kind: DiffKind; before: number | null; after: number | null };
export type DisplayRow = DiffRow & { prefix?: string };
export type Token = { text: string; kind: 'plain' | 'keyword' | 'string' | 'comment' | 'number' };
export type PaintRow = { index: number; before: Token[]; after: Token[]; removed: [number, number]; added: [number, number] };

export function splitSource(text: string): string[] {
  if (typeof text !== 'string' || text.length > MAX_INPUT_CHARS) throw new Error('Use at most 8 million characters per file.');
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 200_000 || lines.some(line => line.length > 50_000)) throw new Error('Use at most 200,000 lines and 50,000 characters per line.');
  return lines;
}

export function alignLines(before: string[], after: string[]): DiffRow[] {
  const rows: DiffRow[] = [];
  let a = 0, b = 0;
  while (a < before.length || b < after.length) {
    if (a >= before.length) { rows.push({ kind: 'add', before: null, after: b++ }); continue; }
    if (b >= after.length) { rows.push({ kind: 'remove', before: a++, after: null }); continue; }
    if (before[a] === after[b]) { rows.push({ kind: 'equal', before: a++, after: b++ }); continue; }
    let deletion = 0, insertion = 0;
    // Bound alignment work for completely rewritten files; never discard source lines.
    for (let d = 1; d <= 64 && (!deletion || !insertion); d++) {
      if (!deletion && before[a + d] !== undefined && before[a + d] === after[b]) deletion = d;
      if (!insertion && after[b + d] !== undefined && after[b + d] === before[a]) insertion = d;
    }
    if (insertion && (!deletion || insertion <= deletion)) {
      for (let i = 0; i < insertion; i++) rows.push({ kind: 'add', before: null, after: b++ });
    } else if (deletion) {
      for (let i = 0; i < deletion; i++) rows.push({ kind: 'remove', before: a++, after: null });
    } else rows.push({ kind: 'change', before: a++, after: b++ });
  }
  return rows;
}

export function displayRows(rows: DiffRow[], unified: boolean): DisplayRow[] {
  if (!unified) return rows;
  return rows.flatMap(row => row.kind === 'change'
    ? [{ ...row, kind: 'remove' as const, after: null, prefix: '- ' }, { ...row, kind: 'add' as const, before: null, prefix: '+ ' }]
    : [{ ...row, prefix: row.kind === 'add' ? '+ ' : row.kind === 'remove' ? '- ' : '  ' }]);
}

export function viewportRows(scrollTop: number, height: number, count: number) {
  const first = Math.max(0, Math.floor(Math.max(0, scrollTop) / ROW_HEIGHT) - OVERSCAN);
  return { start: Math.min(first, count), end: Math.min(count, Math.ceil((Math.max(0, scrollTop) + Math.max(0, height)) / ROW_HEIGHT) + OVERSCAN) };
}
export function expandTabs(line: string) {
  let column = 0;
  return line.replace(/\t|[^\t]+/g, part => {
    if (part !== '\t') { column += part.length; return part; }
    const spaces = 4 - column % 4; column += spaces; return ' '.repeat(spaces);
  });
}
export function changeRanges(before: string, after: string): { removed: [number, number]; added: [number, number] } {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let a = before.length, b = after.length;
  while (a > start && b > start && before[a - 1] === after[b - 1]) { a--; b--; }
  return { removed: [start, a], added: [start, b] };
}
const keywords = new Set('const let var function return if else for while class new export import from async await throw try catch true false null undefined interface type public private switch case break continue'.split(' '));
export function tokenizeLine(text: string, inComment = false, collect = true) {
  const tokens: Token[] = [];
  const emit = (value: string, kind: Token['kind']) => {
    if (!collect || !value) return;
    const last = tokens[tokens.length - 1];
    if (last?.kind === kind) last.text += value;
    else tokens.push({ text: value, kind });
  };
  let i = 0;
  while (i < text.length) {
    if (inComment) {
      const end = text.indexOf('*/', i);
      if (end < 0) { emit(text.slice(i), 'comment'); break; }
      emit(text.slice(i, end + 2), 'comment'); i = end + 2; inComment = false; continue;
    }
    if (text.startsWith('//', i)) { emit(text.slice(i), 'comment'); break; }
    if (text.startsWith('/*', i)) { inComment = true; continue; }
    const char = text[i];
    if (char === '"' || char === "'" || char === '`') {
      let end = i + 1;
      while (end < text.length) { if (text[end] === '\\') end += 2; else if (text[end++] === char) break; }
      emit(text.slice(i, end), 'string'); i = end; continue;
    }
    const word = /^[A-Za-z_$][\w$]*|^\d+(?:\.\d+)?/.exec(text.slice(i));
    if (word) { emit(word[0], keywords.has(word[0]) ? 'keyword' : /^\d/.test(word[0]) ? 'number' : 'plain'); i += word[0].length; }
    else { emit(char, 'plain'); i++; }
  }
  return { tokens, inComment };
}
export function commentStates(lines: string[]) {
  let inComment = false;
  return lines.map(line => { const state = inComment; inComment = tokenizeLine(line, inComment, false).inComment; return state; });
}

export function selectionText(rows: DisplayRow[], before: string[], after: string[], side: 'before' | 'after' | 'unified') {
  return rows.map(row => {
    const index = side === 'unified' ? (row.after ?? row.before) : row[side];
    const source = side === 'unified' ? (row.after === null ? before : after) : side === 'before' ? before : after;
    return (row.prefix ?? '') + (index === null ? '' : source[index]);
  }).join('\n');
}

export function copySelection(text: string, rows: DisplayRow[], start: number, end: number, side: 'before' | 'after' | 'unified') {
  if (side === 'unified') return text.slice(start, end);
  const lines = text.split('\n'); let offset = 0; const selected: string[] = [];
  const lastIndex = rows.reduce((last, row) => Math.max(last, row[side] ?? -1), -1);
  for (let i = 0; i < lines.length && offset < end; i++) {
    const line = lines[i], lineEnd = offset + line.length;
    if (rows[i]?.[side] !== null && lineEnd >= start && offset < end) {
      selected.push(line.slice(Math.max(0, start - offset), Math.min(line.length, end - offset)));
      if (end > lineEnd && (rows[i][side] ?? lastIndex) < lastIndex) selected.push('\n');
    }
    offset = lineEnd + 1;
  }
  return selected.join('');
}

// Chromium on macOS does not move the caret in read-only textareas with arrows.
// Keep native selection/copy, while supplying the missing caret movement.
export function keyboardPosition(text: string, position: number, key: string, pageRows: number) {
  const start = position > 0 ? text.lastIndexOf('\n', position - 1) + 1 : 0;
  const end = text.indexOf('\n', position);
  if (key === 'ArrowLeft') return Math.max(0, position - 1);
  if (key === 'ArrowRight') return Math.min(text.length, position + 1);
  if (key === 'Home') return start;
  if (key === 'End') return end < 0 ? text.length : end;
  const up = key === 'ArrowUp' || key === 'PageUp';
  const steps = key.startsWith('Page') ? Math.max(1, pageRows) : 1;
  const column = position - start;
  let lineStart = start;
  for (let i = 0; i < steps; i++) {
    if (up) {
      if (lineStart === 0) return 0;
      lineStart = lineStart < 2 ? 0 : text.lastIndexOf('\n', lineStart - 2) + 1;
    } else {
      const next = text.indexOf('\n', lineStart);
      if (next < 0) return text.length;
      lineStart = next + 1;
    }
  }
  const lineEnd = text.indexOf('\n', lineStart);
  return Math.min(lineStart + column, lineEnd < 0 ? text.length : lineEnd);
}
