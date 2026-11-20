'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { MonacoDiffWrapper } from '@/components/editor/monaco-diff-wrapper';

const oldSample = 'export function greet(name: string) {\n  return "Hello " + name;\n}\n';
const newSample = 'export function greet(name: string) {\n  // Keep the greeting friendly.\n  return "Welcome " + name.trim();\n}\n';

export default function CodeDiffPage() {
  const before = useRef<HTMLTextAreaElement>(null), after = useRef<HTMLTextAreaElement>(null);
  const sourcePanel = useRef<HTMLDetailsElement>(null);
  const [sources, setSources] = useState({ original: oldSample, modified: newSample });
  const compare = () => { setSources({ original: before.current?.value || '', modified: after.current?.value || '' }); };
  const benchmark = () => {
    const lines = Array.from({ length: 100_001 }, (_, i) => `const value_${i} = ${i};`);
    const original = lines.join('\n'); lines[2] = 'const value_2 = 42;'; lines.splice(50_000, 0, '// An inserted benchmark line'); lines[100_000] += ' // changed';
    const modified = lines.join('\n');
    // Avoid laying out two additional 100k-line editable textareas while the
    // comparison starts. The source panel can still be reopened for editing.
    if (sourcePanel.current) sourcePanel.current.open = false;
    if (before.current) before.current.value = original;
    if (after.current) after.current.value = modified;
    setSources({ original, modified });
  };
  return <main className="mx-auto min-h-screen max-w-7xl space-y-6 px-4 py-10 text-slate-100">
    <Link href="/" className="text-sm text-violet-300">CodePulse / Home</Link>
    <header><h1 className="text-3xl font-bold">Compare code</h1><p className="mt-2 text-sm text-slate-300">Compare large text files locally. Your source stays in this browser.</p></header>
    <details ref={sourcePanel} className="rounded-xl border border-slate-700 bg-slate-900 p-4" open>
      <summary className="cursor-pointer font-semibold">Source files</summary>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm">Original source<textarea ref={before} aria-label="Original source input" defaultValue={oldSample} maxLength={8_000_000} spellCheck={false} className="mt-2 h-40 w-full rounded border border-slate-600 bg-slate-950 p-3 font-mono text-xs" /></label>
        <label className="text-sm">Modified source<textarea ref={after} aria-label="Modified source input" defaultValue={newSample} maxLength={8_000_000} spellCheck={false} className="mt-2 h-40 w-full rounded border border-slate-600 bg-slate-950 p-3 font-mono text-xs" /></label>
      </div>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" onClick={compare} className="rounded bg-violet-600 px-4 py-2 text-sm font-semibold">Compare files</button><button type="button" onClick={benchmark} className="rounded border border-slate-600 px-4 py-2 text-sm">Load 100,001-line example</button></div>
      <p className="mt-3 text-xs text-slate-400">Up to 200,000 lines and 8 million characters per file. Syntax colors cover JavaScript/TypeScript keywords, strings, numbers and comments. Line alignment uses bounded lookahead; it preserves all source lines without promising a minimum edit script.</p>
    </details>
    <MonacoDiffWrapper original={sources.original} modified={sources.modified} />
  </main>;
}
