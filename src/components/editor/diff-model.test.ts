import { describe, expect, it } from 'vitest';
import { alignLines, changeRanges, commentStates, copySelection, displayRows, expandTabs, keyboardPosition, MAX_INPUT_CHARS, selectionText, splitSource, tokenizeLine, viewportRows } from './diff-model';

describe('source-preserving line alignment', () => {
  it('identifies unchanged, inserted, removed and modified rows', () => {
    expect(alignLines(['a', 'b'], ['a', 'x', 'b']).map(r => r.kind)).toEqual(['equal', 'add', 'equal']);
    expect(alignLines(['a', 'x', 'b'], ['a', 'b']).map(r => r.kind)).toEqual(['equal', 'remove', 'equal']);
    expect(alignLines(['old'], ['new'])).toEqual([{ kind: 'change', before: 0, after: 0 }]);
  });
  it('preserves every source line across repeated lines, long rewrites and randomized inputs', () => {
    let seed = 5;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % 12; };
    for (let run = 0; run < 70; run++) {
      const before = Array.from({ length: random() * 20 }, () => String(random()));
      const after = Array.from({ length: random() * 20 }, () => String(random()));
      const rows = alignLines(before, after);
      expect(rows.filter(r => r.before !== null).map(r => before[r.before!])).toEqual(before);
      expect(rows.filter(r => r.after !== null).map(r => after[r.after!])).toEqual(after);
    }
  });
  it('handles more than 100,000 lines while viewport work stays bounded', () => {
    const before = Array.from({ length: 100_001 }, (_, i) => `const value_${i} = ${i};`), after = [...before];
    after.splice(50_000, 0, '// added'); after[90_000] = 'return 42;';
    const rows = alignLines(before, after);
    expect(rows.filter(r => r.before !== null)).toHaveLength(100_001);
    expect(rows.filter(r => r.after !== null)).toHaveLength(100_002);
    const range = viewportRows(50_000 * 22, 640, rows.length);
    expect(range.end - range.start).toBeLessThanOrEqual(71);
  });
  it('normalizes display line endings and rejects oversized input clearly', () => {
    expect(splitSource('a\r\nb\rc')).toEqual(['a', 'b', 'c']);
    expect(() => splitSource('a'.repeat(MAX_INPUT_CHARS + 1))).toThrow(/8 million/);
    expect(() => splitSource('a'.repeat(50_001))).toThrow(/50,000/);
    expect(() => splitSource('\n'.repeat(200_000))).toThrow(/200,000/);
  });
});
describe('virtual viewport and character ranges', () => {
  it('clamps overscan at either file edge', () => {
    expect(viewportRows(-100, 44, 100)).toEqual({ start: 0, end: 22 });
    expect(viewportRows(22 * 99, 100, 100).end).toBe(100);
    expect(viewportRows(99999, 400, 4)).toEqual({ start: 4, end: 4 });
  });
  it('highlights the changed character range without matching prefixes/suffixes', () => {
    expect(changeRanges('const a = 1;', 'const a = 42;')).toEqual({ removed: [10, 11], added: [10, 12] });
    expect(changeRanges('same', 'same')).toEqual({ removed: [4, 4], added: [4, 4] });
    expect(expandTabs('x\ty\tz')).toBe('x   y   z');
  });
});
describe('worker syntax tokenization', () => {
  it('recognizes keywords, strings, comments and numbers without interpreting source', () => {
    const line = 'const x = "// not a comment"; return 42; // done';
    const { tokens } = tokenizeLine(line);
    expect(tokens.map(t => t.text).join('')).toBe(line);
    expect(tokens).toContainEqual({ text: 'const', kind: 'keyword' });
    expect(tokens).toContainEqual({ text: '"// not a comment"', kind: 'string' });
    expect(tokens).toContainEqual({ text: '42', kind: 'number' });
    expect(tokens.at(-1)?.kind).toBe('comment');
    expect(tokenizeLine('<script>alert(1)</script>').tokens.map(t => t.text).join('')).toBe('<script>alert(1)</script>');
  });
  it('tracks multiline comments so scrolling into a block keeps its syntax state', () => {
    const lines = ['const x = "/*";', '/* comment', 'continued', '*/ return 2;'];
    expect(commentStates(lines)).toEqual([false, false, true, true]);
    expect(tokenizeLine(lines[3], true).tokens).toContainEqual({ text: 'return', kind: 'keyword' });
  });
});
describe('native selection and unified mode', () => {
  it('expands changed lines into removed/added unified rows', () => {
    const rows = displayRows(alignLines(['old'], ['new']), true);
    expect(rows.map(r => r.kind)).toEqual(['remove', 'add']);
    expect(selectionText(rows, ['old'], ['new'], 'unified')).toBe('- old\n+ new');
  });
  it('copies exact original source rather than inserted alignment placeholders', () => {
    for (const [before, after] of [['a\nb', 'a\nx\nb'], ['a\n', 'a\nx\n'], ['\n\na', 'x\n\n\na'], ['', 'x']]) {
      const old = splitSource(before), next = splitSource(after), rows = displayRows(alignLines(old, next), false);
      for (const side of ['before', 'after'] as const) {
        const text = selectionText(rows, old, next, side);
        expect(copySelection(text, rows, 0, text.length, side)).toBe(side === 'before' ? before : after);
      }
    }
  });
});


describe('read-only keyboard navigation', () => {
  it('moves within and between lines, clamps short rows and pages, and handles blank first lines', () => {
    const text = 'abc\nx\ndefg';
    expect(keyboardPosition(text, 2, 'ArrowDown', 2)).toBe(5);
    expect(keyboardPosition(text, 7, 'ArrowUp', 2)).toBe(5);
    expect(keyboardPosition(text, 1, 'PageDown', 2)).toBe(7);
    expect(keyboardPosition(text, 7, 'Home', 2)).toBe(6);
    expect(keyboardPosition(text, 7, 'End', 2)).toBe(10);
    expect(keyboardPosition(text, 0, 'ArrowLeft', 2)).toBe(0);
    expect(keyboardPosition(text, text.length, 'ArrowRight', 2)).toBe(text.length);
    expect(keyboardPosition('\na', 0, 'Home', 2)).toBe(0);
    expect(keyboardPosition('\na', 1, 'ArrowUp', 2)).toBe(0);
  });
});
