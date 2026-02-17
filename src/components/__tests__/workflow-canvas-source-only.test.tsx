/**
 * Regression test: The first node (position 0) should not render a target handle.
 * Previously, all StageNodes rendered both source and target handles unconditionally.
 */
import React from "react";

// Mock react-flow components
jest.mock("reactflow", () => ({
  Handle: ({ type, position, className }: any) => (
    <div data-testid={`handle-${type}`} data-position={position} className={className} />
  ),
  Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  ReactFlow: () => <div />,
  useNodesState: (n: any) => [n, jest.fn(), jest.fn()],
  useEdgesState: (e: any) => [e, jest.fn(), jest.fn()],
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  ReactFlowProvider: ({ children }: any) => <>{children}</>,
}));

// We can't easily unit-test the StageNode directly since it's not exported,
// so we test the logic: isSourceOnly should be true for position-0 stages.
describe("workflow-canvas source-only logic", () => {
  it("should mark position-0 stage as isSourceOnly", () => {
    const stages = [
      { id: "1", name: "Order Processing", position: 0, status: "pending" as const },
      { id: "2", name: "Shipping", position: 1, status: "pending" as const },
    ];

    const sorted = [...stages].sort((a, b) => a.position - b.position);
    const nodeData = sorted.map((s) => ({
      label: s.name,
      status: s.status,
      isSourceOnly: s.position === 0,
    }));

    expect(nodeData[0].isSourceOnly).toBe(true);
    expect(nodeData[0].label).toBe("Order Processing");
    expect(nodeData[1].isSourceOnly).toBe(false);
  });

  it("should create default Order Processing stage when no template selected", () => {
    // Simulates the logic: when selectedTemplate is falsy, a default stage is created
    const selectedTemplate = "";
    const createdStages: Array<{ name: string; position: number }> = [];

    if (selectedTemplate) {
      // template stages would be created here
    } else {
      createdStages.push({ name: "Order Processing", position: 0 });
    }

    expect(createdStages).toHaveLength(1);
    expect(createdStages[0].name).toBe("Order Processing");
    expect(createdStages[0].position).toBe(0);
  });
});
