import { describe, expect, it, vi } from "vitest";
import { dispatchRaycastHover, dispatchRaycastSelection } from "./raycast";
import { buildUniverseLayout } from "./universe-layout";
import { createTestUniverse } from "@/test/universe-fixture";

const nodes = buildUniverseLayout(createTestUniverse(8)).nodes;

describe("raycast event dispatching", () => {
  it("selects the node matching the intersected instance id", () => {
    const onSelect = vi.fn();
    const stopPropagation = vi.fn();
    const selected = dispatchRaycastSelection(
      { instanceId: 2, stopPropagation },
      nodes,
      onSelect,
    );

    expect(selected).toBe(nodes[2]);
    expect(onSelect).toHaveBeenCalledWith(nodes[2]);
    expect(stopPropagation).toHaveBeenCalledOnce();
  });

  it("ignores pointer events without a valid instance id", () => {
    const onSelect = vi.fn();
    const stopPropagation = vi.fn();

    expect(dispatchRaycastSelection({ stopPropagation }, nodes, onSelect)).toBeNull();
    expect(dispatchRaycastSelection({ instanceId: 9999 }, nodes, onSelect)).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it("dispatches hover changes including clearing on pointer out", () => {
    const onHover = vi.fn();
    const stopPropagation = vi.fn();

    expect(dispatchRaycastHover({ instanceId: 0, stopPropagation }, nodes, onHover)).toBe(nodes[0]);
    expect(dispatchRaycastHover({}, nodes, onHover)).toBeNull();
    expect(onHover.mock.calls).toEqual([[nodes[0]], [null]]);
    expect(stopPropagation).toHaveBeenCalledOnce();
  });
});
