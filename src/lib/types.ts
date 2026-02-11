export interface WorkflowNode {
  id: string;
  label: string;
  assignedTo?: string;
  status: "pending" | "in-progress" | "completed";
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientEmail?: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  shareToken: string;
  status: "active" | "completed" | "archived";
  templateId?: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  nodes: Omit<WorkflowNode, "status" | "startedAt" | "completedAt">[];
  edges: WorkflowEdge[];
  userId: string;
  createdAt: string;
}

export interface Worker {
  id: string;
  name: string;
  role?: string;
  userId: string;
}
