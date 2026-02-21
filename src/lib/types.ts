export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Member {
  id: string;
  user_id: string;
  team_id: string;
  role: "owner" | "admin" | "worker" | "client";
  email: string;
  name: string;
  phone: string;
  company_id: string | null;
  company_name: string | null;
  created_at: string;
  joined_at: string | null;
}

export interface Project {
  id: string;
  team_id: string;
  name: string;
  description?: string;
  status: "active" | "completed" | "archived";
  client_name: string;
  client_email: string;
  client_phone: string;
  created_by: string;
  client_id?: string; // deprecated, use project_clients junction
  company_id?: string | null;
  workflow_locked?: boolean;
  workflow_positions?: Record<string, { x: number; y: number }> | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectStage {
  id: string;
  project_id: string;
  name: string;
  status: "pending" | "in_progress" | "completed";
  position: number;
  started_at: string | null;
  completed_at: string | null;
  started_by: string | null;
  assigned_to: string | null;
  estimated_completion: string | null;
}

export interface ProjectAssignment {
  id: string;
  project_id: string;
  member_id: string;
}

export interface ProjectMessage {
  id: string;
  project_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  file_id: string | null;
  file?: ProjectFile | null;
  created_at: string;
}

export interface ProjectNote {
  id: string;
  project_id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  uploaded_by: string;
  file_name: string;
  file_url: string;
  file_size: number;
  content_type: string;
  created_at: string;
}

export interface Template {
  id: string;
  team_id: string;
  name: string;
  description: string;
  stages: { name: string; position: number }[];
  created_by: string;
  created_at: string;
}

export interface PresetStage {
  id: string;
  team_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface Company {
  id: string;
  team_id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
  updated_at: string;
}

export interface MessageReadStatus {
  user_id: string;
  project_id: string;
  last_read_at: string;
}

export type UserRole = "admin" | "worker" | "client" | "owner";

// ============ PLATFORM ADMIN ============

export interface AdminStats {
  totalOrgs: number;
  totalUsers: number;
  totalProjects: number;
  totalMemberships: number;
}

export interface AdminOrganization {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  memberCount: number;
  projectCount: number;
}
