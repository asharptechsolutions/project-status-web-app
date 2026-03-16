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
  time_tracking_enabled?: boolean;
  time_tracking_auto_start?: boolean;
  time_tracking_default_billable?: boolean;
  time_tracking_require_notes?: boolean;
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
  planned_start: string | null;
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

// ============ STAGE DEPENDENCIES ============

export interface StageDependency {
  id: string;
  project_id: string;
  source_stage_id: string;
  target_stage_id: string;
  dependency_type: "finish_to_start";
  created_at: string;
}

// ============ TIME TRACKING ============

export interface TimeEntry {
  id: string;
  team_id: string;
  project_id: string;
  stage_id: string;
  user_id: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  notes: string | null;
  billable: boolean;
  created_at: string;
  updated_at: string;
}

// ============ CLIENT VISIBILITY SETTINGS ============

export interface ClientVisibilitySettings {
  id: string;
  team_id: string;
  show_worker_names: boolean;
  show_estimated_completion: boolean;
  show_progress_percentage: boolean;
  show_stage_status: boolean;
  allow_file_access: boolean;
  allow_chat: boolean;
  allow_booking: boolean;
  show_time_tracking: boolean;
  created_at: string;
  updated_at: string;
}

// ============ AUTOMATION SETTINGS ============

export interface AutomationSettings {
  id: string;
  team_id: string;
  auto_start_next_stage: boolean;
  auto_complete_project: boolean;
  notify_client_stage_complete: boolean;
  notify_worker_on_assign: boolean;
  auto_advance_blocked_stages: boolean;
  created_at: string;
  updated_at: string;
}

// ============ CLIENT NOTIFICATION PREFERENCES ============

export interface ClientNotificationPreferences {
  id: string;
  team_id: string;
  client_id: string;
  project_id: string;
  notify_stage_complete: boolean;
  created_at: string;
  updated_at: string;
}

// ============ ORG BRANDING ============

export interface OrgBranding {
  id: string;
  team_id: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string | null;
  accent_color: string | null;
  email_accent_color: string | null;
  created_at: string;
  updated_at: string;
}

// ============ EMAIL TEMPLATES ============

export interface EmailTemplate {
  id: string;
  team_id: string;
  template_type: string;
  subject: string;
  body: string;
  layout: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============ APPOINTMENT SCHEDULING ============

export interface WeeklyScheduleDay {
  start: string; // "HH:MM" e.g. "09:00"
  end: string;   // "HH:MM" e.g. "17:00"
}

// Index 0 = Sunday, 6 = Saturday. null = day is disabled.
export type WeeklySchedule = (WeeklyScheduleDay | null)[];

export interface OfficeHoursSettings {
  id: string;
  team_id: string;
  day_start: string; // "HH:MM" time string
  day_end: string;
  timezone: string;
  slot_duration_minutes: number;
  weekly_schedule?: WeeklySchedule | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilitySlot {
  id: string;
  team_id: string;
  created_by: string;
  start_time: string; // ISO timestamp
  end_time: string;
  is_booked: boolean;
  recurrence_group_id: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  team_id: string;
  slot_id: string;
  project_id: string;
  client_id: string;
  client_name: string;
  notes: string | null;
  status: "confirmed" | "cancelled" | "completed";
  created_at: string;
  // joined fields
  slot?: AvailabilitySlot;
  project_name?: string;
}

// ============ WEBHOOKS & SLACK INTEGRATION ============

export type WebhookEventType =
  | "stage_completed"
  | "stage_started"
  | "project_created"
  | "project_completed"
  | "client_added"
  | "member_invited";

export interface Webhook {
  id: string;
  team_id: string;
  name: string;
  url: string;
  secret: string | null;
  events: WebhookEventType[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  team_id: string;
  event_type: WebhookEventType;
  payload: Record<string, unknown>;
  status_code: number | null;
  response_body: string | null;
  success: boolean;
  attempt: number;
  error_message: string | null;
  created_at: string;
}

export interface SlackIntegration {
  id: string;
  team_id: string;
  webhook_url: string;
  channel_name: string | null;
  events: WebhookEventType[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
