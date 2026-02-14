export interface Organization {
  id: string;
  name: string;
  created_at: string;
}

export interface Member {
  id: string;
  clerk_user_id: string;
  org_id: string;
  role: "admin" | "worker" | "client";
  email: string;
  name: string;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string;
  status: "active" | "completed" | "archived";
  client_name: string;
  client_email: string;
  client_phone: string;
  client_id: string | null;
  created_by: string;
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
  org_id: string;
  name: string;
  description: string;
  stages: { name: string; position: number }[];
  created_by: string;
  created_at: string;
}

export interface PresetStage {
  id: string;
  org_id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface Client {
  id: string;
  org_id: string;
  company: string | null;
  name: string;
  email: string;
  phone: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Worker {
  id: string;
  org_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type UserRole = "admin" | "worker" | "client" | "platform_admin";
