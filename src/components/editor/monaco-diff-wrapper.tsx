'use client';

import { CanvasDiffViewer } from './canvas-diff-viewer';

// Retain the integration filename requested by #580 without adding a Monaco dependency.
export function MonacoDiffWrapper({ original, modified }: { original: string; modified: string }) {
  return <CanvasDiffViewer original={original} modified={modified} />;
}
