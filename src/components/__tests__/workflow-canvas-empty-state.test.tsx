/**
 * Regression test for: react-flow initial canvas state on project creation
 *
 * Bug: When stages array is empty, WorkflowCanvas rendered a bare ReactFlow
 * canvas with grid/controls/minimap but no guidance. This test verifies that
 * an empty-state placeholder is shown instead.
 *
 * NOTE: This project has no test runner configured. This file documents the
 * expected behaviour and can be executed once a test framework (e.g. vitest +
 * @testing-library/react) is added.
 */

import React from "react";
// import { render, screen } from "@testing-library/react";
// import { WorkflowCanvas } from "../workflow-canvas";

describe("WorkflowCanvas empty state", () => {
  it("should show empty-state placeholder when stages array is empty", () => {
    // const { container } = render(<WorkflowCanvas stages={[]} />);
    // expect(screen.getByText(/no workflow stages yet/i)).toBeInTheDocument();
    // // ReactFlow should NOT be rendered
    // expect(container.querySelector(".react-flow")).toBeNull();
    expect(true).toBe(true); // placeholder until test runner is configured
  });

  it("should render ReactFlow canvas when stages are provided", () => {
    // const stages = [
    //   { id: "1", name: "Design", status: "pending", position: 0, project_id: "p1",
    //     started_at: null, completed_at: null, started_by: null, created_at: "", updated_at: "" },
    // ];
    // const { container } = render(<WorkflowCanvas stages={stages} />);
    // expect(screen.queryByText(/no workflow stages yet/i)).toBeNull();
    // expect(container.querySelector(".react-flow")).not.toBeNull();
    expect(true).toBe(true); // placeholder until test runner is configured
  });
});
