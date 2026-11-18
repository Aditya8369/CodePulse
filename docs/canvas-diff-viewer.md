# Canvas code comparison

Open `/code-diff` from the sidebar, paste two source files and choose **Compare
files**. The comparison stays in the browser. The reusable `MonacoDiffWrapper`
integration point delegates to `CanvasDiffViewer`; it does not add Monaco or a
new package dependency.

The worker aligns lines with a bounded 64-line lookahead, tracks block-comment
state, and tokenizes only the viewport plus 20 rows of overscan. Alignment
preserves every source line but does not promise a minimum edit script. Syntax
colors cover JavaScript/TypeScript keywords, strings, numbers and comments; this
is not a language parser. Character highlights cover the changed prefix/suffix
range within paired lines.

Two viewport-sized canvases draw the side-by-side view; unified mode uses one.
Native read-only textareas supply scrollbars, selection and browser copy.
Keyboard navigation also handles Chromium on macOS, where read-only textarea
arrow movement is unavailable. Copy buttons preserve the original source,
including original line endings; copying selected comparison text normalizes
line endings and removes alignment-only blank rows. Workers and animation
frames are disposed when the source, layout or component changes.

Limits are 8 million UTF-16 characters, 200,000 lines and 50,000 characters per
line per file. Invalid input and worker/clipboard failures are shown explicitly.
Native text layers still hold the complete comparison; constant DOM size does
not mean constant memory or constant initial layout time.

## Verification

Use Node 22:

```sh
npm ci
npm test -- --maxWorkers=2
npx tsc --noEmit
npx eslint src/components/editor src/app/code-diff src/lib/constants.ts
npm run build
npm start
```

The 100,001-line example button provides a reproducible large input with an
insertion and changed lines. Compare small/large `[data-diff-rows]` descendant
counts, inspect canvas `data-paint-ms` and `data-visible-rows`, then scroll to the
bottom and switch layouts. Canvas timing measures drawing only, not worker
startup, transfer, React or native text layout.

On a local headless Chromium production run on macOS (2026-11-18), 5 and 100,002
aligned rows both used 20 viewer descendants. The large worker preparation took
95.0 ms and the initial two canvas draws took 0.8/0.4 ms. The complete example
button-to-visible-comparison operation took 2,370 ms, including fixture creation,
source input updates and native text layout. Thirty two-animation-frame scroll
samples averaged 23.3 ms, with a 49 ms maximum. These observations do **not**
establish sub-100-ms end-to-end loading or sustained 60 FPS on all hardware;
initial native text layout remains a performance limitation for that stronger
acceptance interpretation.

Browser checks covered both layouts, top/bottom synchronized scroll, bounded
paint rows, unchanged DOM size, native selection/copy with an inserted alignment
row and tabs, empty files, worker replacement, and 320/375/414-pixel layouts
without page overflow. Tests cover 100,000-line alignment, randomized source
preservation, token/comment parsing, character ranges, viewport bounds, keyboard
movement, exact copy and worker failure/cleanup.
