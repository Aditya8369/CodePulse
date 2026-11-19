import type { UniverseNode } from "./universe-types";

export interface RaycastHit {
  instanceId?: number;
  stopPropagation?: () => void;
}

export function dispatchRaycastSelection<T extends UniverseNode>(
  event: RaycastHit,
  nodes: readonly T[],
  onSelect: (node: T) => void,
): T | null {
  if (event.instanceId === undefined) return null;
  const node = nodes[event.instanceId];
  if (!node) return null;
  event.stopPropagation?.();
  onSelect(node);
  return node;
}

export function dispatchRaycastHover<T extends UniverseNode>(
  event: RaycastHit,
  nodes: readonly T[],
  onHover: (node: T | null) => void,
): T | null {
  const node = event.instanceId === undefined ? null : nodes[event.instanceId] ?? null;
  event.stopPropagation?.();
  onHover(node);
  return node;
}
