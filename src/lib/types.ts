export interface WorkflowNode {
  id: string;
  label: string;
  assignedTo?: string;
  status: "pending" | "in-progress" | "completed";
  startedAt?: string;
  completedAt?: string;
  estimatedCompletion?: string;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface ProjectContact {
  email: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  contacts: ProjectContact[];
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

export interface ProjectFile {
  id: string;
  projectId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  downloadUrl: string;
  uploadedBy: string;
  uploadedAt: string;
}
