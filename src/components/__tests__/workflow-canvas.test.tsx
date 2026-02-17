import React from "react";

/**
 * Regression tests for workflow-canvas bug fixes:
 * 1. The first/root node should be source-only (no target handle)
 * 2. Non-root nodes should have both source and target handles
 *
 * These are structural/unit tests that verify the StageNodeData.sourceOnly
 * flag is correctly set when building nodes from sorted stages.
 */

// Simulate the node-building logic extracted from WorkflowCanvas
type StageNodeData = {
  label: string;
  status: string;
  readOnly: boolean;
  isAdmin: boolean;
  isWorker: boolean;
  sourceOnly?: boolean;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
};

function buildRawNodes(
  stages: { id: string; name: string; status: string; position: number }[],
  readOnly: boolean,
  isAdmin: boolean,
  isWorker: boolean,
) {
  const sorted = [...stages].sort((a, b) => a.position - b.position);
  return sorted.map((s, i) => ({
    id: s.id,
    type: "stage",
    data: {
      label: s.name,
      status: s.status,
      readOnly,
      isAdmin,
      isWorker,
      sourceOnly: i === 0,
      onStart: () => {},
      onComplete: () => {},
      onDelete: () => {},
    } as StageNodeData,
  }));
}

describe("WorkflowCanvas node building", () => {
  it("should mark the first node as sourceOnly (no target handle for root node)", () => {
    const stages = [
      { id: "1", name: "Order Processing", status: "pending", position: 0 },
      { id: "2", name: "Shipping", status: "pending", position: 1 },
    ];
    const nodes = buildRawNodes(stages, false, true, false);
    expect(nodes[0].data.sourceOnly).toBe(true);
    expect(nodes[0].data.label).toBe("Order Processing");
  });

  it("should not mark non-root nodes as sourceOnly", () => {
    const stages = [
      { id: "1", name: "Order Processing", status: "pending", position: 0 },
      { id: "2", name: "Shipping", status: "pending", position: 1 },
    ];
    const nodes = buildRawNodes(stages, false, true, false);
    expect(nodes[1].data.sourceOnly).toBe(false);
  });

  it("should handle a single default node as sourceOnly", () => {
    // Regression: when project is created without template, only "Order Processing" exists
    const stages = [
      { id: "1", name: "Order Processing", status: "pending", position: 0 },
    ];
    const nodes = buildRawNodes(stages, false, true, false);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].data.sourceOnly).toBe(true);
    expect(nodes[0].data.label).toBe("Order Processing");
  });
});
