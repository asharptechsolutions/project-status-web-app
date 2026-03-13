import { createClient } from "./supabase";

const supabase = createClient();
import type {
  Project,
  ProjectStage,
  ProjectAssignment,
  ProjectMessage,
  ProjectNote,
  ProjectFile,
  Template,
  PresetStage,
  Member,
  Company,
  ClientVisibilitySettings,
  AutomationSettings,
  OfficeHoursSettings,
  AvailabilitySlot,
  Appointment,
  StageDependency,
  ClientNotificationPreferences,
  TimeEntry,
  OrgBranding,
  EmailTemplate,
} from "./types";

// ============ PROJECT CLIENTS (junction) ============

export async function getProjectClients(projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("project_clients")
    .select("client_id")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (data || []).map((d: any) => d.client_id);
}

export async function setProjectClients(projectId: string, clientIds: string[]): Promise<void> {
  // Delete existing
  const { error: delError } = await supabase
    .from("project_clients")
    .delete()
    .eq("project_id", projectId);
  if (delError) throw new Error(delError.message);
  // Insert new
  if (clientIds.length > 0) {
    const rows = clientIds.map((cid) => ({ project_id: projectId, client_id: cid }));
    const { error: insError } = await supabase
      .from("project_clients")
      .insert(rows);
    if (insError) throw new Error(insError.message);
  }
}

export async function addProjectClient(projectId: string, clientId: string): Promise<void> {
  const { error } = await supabase
    .from("project_clients")
    .upsert({ project_id: projectId, client_id: clientId }, { onConflict: "project_id,client_id" });
  if (error) throw new Error(error.message);
}

export async function removeProjectClient(projectId: string, clientId: string): Promise<void> {
  const { error } = await supabase
    .from("project_clients")
    .delete()
    .eq("project_id", projectId)
    .eq("client_id", clientId);
  if (error) throw new Error(error.message);
}

// ============ PROJECTS ============

export async function getProjects(orgId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("team_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Project[];
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Project;
}

export async function createProject(
  project: Omit<Project, "id" | "created_at" | "updated_at">
): Promise<string> {
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateProject(
  id: string,
  updates: Partial<Project>
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ============ PROJECT STAGES ============

export async function getProjectStages(projectId: string): Promise<ProjectStage[]> {
  const { data, error } = await supabase
    .from("project_stages")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as ProjectStage[];
}

export async function getStagesForProjects(projectIds: string[]): Promise<ProjectStage[]> {
  if (projectIds.length === 0) return [];
  const { data, error } = await supabase
    .from("project_stages")
    .select("*")
    .in("project_id", projectIds);
  if (error) throw new Error(error.message);
  return (data || []) as ProjectStage[];
}

export async function createProjectStage(
  stage: Omit<ProjectStage, "id">
): Promise<ProjectStage> {
  const { data, error } = await supabase
    .from("project_stages")
    .insert(stage)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectStage;
}

export async function updateProjectStage(
  id: string,
  updates: Partial<ProjectStage>
): Promise<void> {
  const { error } = await supabase
    .from("project_stages")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteProjectStage(id: string): Promise<void> {
  const { error } = await supabase
    .from("project_stages")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function reorderStages(
  projectId: string,
  stageIds: string[]
): Promise<void> {
  for (let i = 0; i < stageIds.length; i++) {
    await supabase
      .from("project_stages")
      .update({ position: i })
      .eq("id", stageIds[i]);
  }
}

// ============ STAGE DEPENDENCIES ============

export async function getStageDependencies(projectId: string): Promise<StageDependency[]> {
  const { data, error } = await supabase
    .from("stage_dependencies")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (data || []) as StageDependency[];
}

export async function createStageDependency(
  dep: Omit<StageDependency, "id" | "created_at">
): Promise<StageDependency> {
  const { data, error } = await supabase
    .from("stage_dependencies")
    .upsert(dep, { onConflict: "source_stage_id,target_stage_id" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as StageDependency;
}

export async function deleteStageDependency(id: string): Promise<void> {
  const { error } = await supabase
    .from("stage_dependencies")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteStageDependenciesForStage(stageId: string): Promise<void> {
  const { error } = await supabase
    .from("stage_dependencies")
    .delete()
    .or(`source_stage_id.eq.${stageId},target_stage_id.eq.${stageId}`);
  if (error) throw new Error(error.message);
}

// ============ PROJECT ASSIGNMENTS ============

export async function getProjectAssignments(
  projectId: string
): Promise<ProjectAssignment[]> {
  const { data, error } = await supabase
    .from("project_assignments")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (data || []) as ProjectAssignment[];
}

export async function assignProject(
  projectId: string,
  memberId: string
): Promise<void> {
  const { error } = await supabase
    .from("project_assignments")
    .upsert({ project_id: projectId, member_id: memberId }, {
      onConflict: "project_id,member_id",
    });
  if (error) throw new Error(error.message);
}

export async function unassignProject(
  projectId: string,
  memberId: string
): Promise<void> {
  const { error } = await supabase
    .from("project_assignments")
    .delete()
    .eq("project_id", projectId)
    .eq("member_id", memberId);
  if (error) throw new Error(error.message);
}

// ============ PROJECT NOTES ============

export async function getProjectNotes(projectId: string): Promise<ProjectNote[]> {
  const { data, error } = await supabase
    .from("project_notes")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as ProjectNote[];
}

export async function addProjectNote(
  note: Omit<ProjectNote, "id" | "created_at">
): Promise<string> {
  const { data, error } = await supabase
    .from("project_notes")
    .insert(note)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function deleteProjectNote(id: string): Promise<void> {
  const { error } = await supabase
    .from("project_notes")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ============ MESSAGES ============

export async function getProjectMessages(
  projectId: string
): Promise<ProjectMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*, file:files(*)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as ProjectMessage[];
}

export async function sendProjectMessage(
  message: Omit<ProjectMessage, "id" | "created_at" | "file">
): Promise<string> {
  const { data, error } = await supabase
    .from("messages")
    .insert(message)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function sendFileMessage(
  projectId: string,
  senderId: string,
  senderName: string,
  file: File
): Promise<ProjectMessage> {
  const uploaded = await uploadFile(projectId, file, senderId);
  const { data, error } = await supabase
    .from("messages")
    .insert({
      project_id: projectId,
      sender_id: senderId,
      sender_name: senderName,
      content: "",
      file_id: uploaded.id,
    })
    .select("*, file:files(*)")
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectMessage;
}

// ============ FILES ============

export async function getProjectFiles(
  projectId: string
): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from("files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as ProjectFile[];
}

export async function createFileRecord(
  file: Omit<ProjectFile, "id" | "created_at">
): Promise<ProjectFile> {
  const { data, error } = await supabase
    .from("files")
    .insert(file)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as ProjectFile;
}

export async function deleteFileRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from("files")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Upload file to Supabase Storage
export async function uploadFile(
  projectId: string,
  file: File,
  uploadedBy: string
): Promise<ProjectFile> {
  const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const path = `project-files/${projectId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("files")
    .upload(path, file, { contentType: file.type });
  
  if (uploadError) {
    // If storage bucket doesn't exist, store as a placeholder URL
    console.warn("Storage upload failed, using placeholder:", uploadError.message);
  }

  const { data: urlData } = supabase.storage
    .from("files")
    .getPublicUrl(path);

  return createFileRecord({
    project_id: projectId,
    uploaded_by: uploadedBy,
    file_name: file.name,
    file_url: urlData?.publicUrl || "#",
    file_size: file.size,
    content_type: file.type,
  });
}

// ============ TEMPLATES ============

export async function getTemplates(orgId: string): Promise<Template[]> {
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .eq("team_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as Template[];
}

export async function createTemplate(
  template: Omit<Template, "id" | "created_at">
): Promise<string> {
  const { data, error } = await supabase
    .from("templates")
    .insert(template)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateTemplate(
  id: string,
  updates: Partial<Template>
): Promise<void> {
  const { error } = await supabase
    .from("templates")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ============ PRESET STAGES ============

export async function getPresetStages(orgId: string): Promise<PresetStage[]> {
  const { data, error } = await supabase
    .from("preset_stages")
    .select("*")
    .eq("team_id", orgId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as PresetStage[];
}

export async function createPresetStage(
  stage: Omit<PresetStage, "id" | "created_at">
): Promise<string> {
  const { data, error } = await supabase
    .from("preset_stages")
    .insert(stage)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function deletePresetStage(id: string): Promise<void> {
  const { error } = await supabase
    .from("preset_stages")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ============ COMPANIES ============

export async function getCompanies(orgId: string): Promise<Company[]> {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("team_id", orgId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Company[];
}

export async function createCompany(
  company: Omit<Company, "id" | "created_at" | "updated_at">
): Promise<string> {
  const { data, error } = await supabase
    .from("companies")
    .insert(company)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function updateCompany(
  id: string,
  updates: Partial<Company>
): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCompany(id: string): Promise<void> {
  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ============ MEMBERS ============

export async function getMembers(orgId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*, profiles(display_name, email, phone), companies(name)")
    .eq("team_id", orgId);
  if (error) throw new Error(error.message);
  return (data || []).map((d: any) => ({
    id: d.user_id,
    user_id: d.user_id,
    team_id: d.team_id,
    role: d.role,
    name: d.profiles?.display_name || d.profiles?.email || "",
    email: d.profiles?.email || "",
    phone: d.profiles?.phone || "",
    company_id: d.company_id || null,
    company_name: d.companies?.name || null,
    created_at: d.invited_at,
    joined_at: d.joined_at || null,
  })) as Member[];
}

export async function getMember(
  userId: string,
  orgId: string
): Promise<Member | null> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*, profiles(display_name, email, phone), companies(name)")
    .eq("user_id", userId)
    .eq("team_id", orgId)
    .single();
  if (error) return null;
  return {
    id: data.user_id,
    user_id: data.user_id,
    team_id: data.team_id,
    role: data.role,
    name: (data as any).profiles?.display_name || (data as any).profiles?.email || "",
    email: (data as any).profiles?.email || "",
    phone: (data as any).profiles?.phone || "",
    company_id: (data as any).company_id || null,
    company_name: (data as any).companies?.name || null,
    created_at: data.invited_at,
    joined_at: data.joined_at || null,
  } as Member;
}

export async function createMember(
  member: Omit<Member, "id" | "created_at">
): Promise<Member> {
  const row: Record<string, any> = {
    team_id: member.team_id,
    user_id: member.user_id,
    role: member.role,
  };
  if (member.company_id) row.company_id = member.company_id;
  const { data, error } = await supabase
    .from("team_members")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return {
    ...data,
    id: data.user_id,
    name: member.name || "",
    email: member.email || "",
    company_id: data.company_id || null,
    company_name: null,
    created_at: data.invited_at,
  } as Member;
}

export async function updateMember(
  userId: string,
  updates: Partial<Pick<Member, "role" | "name" | "email" | "phone" | "company_id">>
): Promise<void> {
  // Update role/company_id on team_members
  const teamUpdates: Record<string, any> = {};
  if (updates.role) teamUpdates.role = updates.role;
  if (updates.company_id !== undefined) teamUpdates.company_id = updates.company_id;
  if (Object.keys(teamUpdates).length > 0) {
    const { error } = await supabase
      .from("team_members")
      .update(teamUpdates)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  }
  // Update name/email/phone on profiles
  if (updates.name || updates.email || updates.phone !== undefined) {
    const profileUpdates: Record<string, string> = {};
    if (updates.name) profileUpdates.display_name = updates.name;
    if (updates.email) profileUpdates.email = updates.email;
    if (updates.phone !== undefined) profileUpdates.phone = updates.phone;
    const { error } = await supabase
      .from("profiles")
      .update(profileUpdates)
      .eq("id", userId);
    if (error) throw new Error(error.message);
  }
}

export async function deleteMember(userId: string): Promise<void> {
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

// ============ MESSAGE READ STATUS ============

export async function getMessageReadStatus(
  userId: string,
  projectId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("message_read_status")
    .select("last_read_at")
    .eq("user_id", userId)
    .eq("project_id", projectId)
    .single();
  if (error || !data) return null;
  return data.last_read_at;
}

export async function markMessagesRead(
  userId: string,
  projectId: string
): Promise<void> {
  const { error } = await supabase
    .from("message_read_status")
    .upsert(
      { user_id: userId, project_id: projectId, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,project_id" }
    );
  if (error) throw new Error(error.message);
}

// ============ ASSIGNED PROJECTS FOR CLIENT ============

export async function getAssignedProjects(
  memberId: string
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("project_assignments")
    .select("project_id, projects(*)")
    .eq("member_id", memberId);
  if (error) throw new Error(error.message);
  return (data || []).map((d: any) => d.projects).filter(Boolean) as Project[];
}

export async function getClientProjects(
  userId: string
): Promise<Project[]> {
  const { data, error } = await supabase
    .from("project_clients")
    .select("project_id, projects(*)")
    .eq("client_id", userId);
  if (error) throw new Error(error.message);
  return (data || []).map((d: any) => d.projects).filter(Boolean) as Project[];
}

// ============ CLIENT VISIBILITY SETTINGS ============

export async function getClientVisibilitySettings(
  orgId: string
): Promise<ClientVisibilitySettings | null> {
  const { data, error } = await supabase
    .from("client_visibility_settings")
    .select("*")
    .eq("team_id", orgId)
    .single();
  if (error) return null;
  return data as ClientVisibilitySettings;
}

export async function upsertClientVisibilitySettings(
  settings: Omit<ClientVisibilitySettings, "id" | "created_at" | "updated_at">
): Promise<void> {
  const { error } = await supabase
    .from("client_visibility_settings")
    .upsert(
      { ...settings, updated_at: new Date().toISOString() },
      { onConflict: "team_id" }
    );
  if (error) throw new Error(error.message);
}

// ============ AUTOMATION SETTINGS ============

export async function getAutomationSettings(
  orgId: string
): Promise<AutomationSettings | null> {
  const { data, error } = await supabase
    .from("automation_settings")
    .select("*")
    .eq("team_id", orgId)
    .single();
  if (error) return null;
  return data as AutomationSettings;
}

export async function upsertAutomationSettings(
  settings: Omit<AutomationSettings, "id" | "created_at" | "updated_at">
): Promise<void> {
  const { error } = await supabase
    .from("automation_settings")
    .upsert(
      { ...settings, updated_at: new Date().toISOString() },
      { onConflict: "team_id" }
    );
  if (error) throw new Error(error.message);
}

// ============ OFFICE HOURS SETTINGS ============

export async function getOfficeHoursSettings(
  orgId: string
): Promise<OfficeHoursSettings | null> {
  const { data, error } = await supabase
    .from("office_hours_settings")
    .select("*")
    .eq("team_id", orgId)
    .single();
  if (error) return null;
  return data as OfficeHoursSettings;
}

export async function upsertOfficeHoursSettings(
  settings: Omit<OfficeHoursSettings, "id" | "created_at" | "updated_at">
): Promise<void> {
  const { error } = await supabase
    .from("office_hours_settings")
    .upsert(
      { ...settings, updated_at: new Date().toISOString() },
      { onConflict: "team_id" }
    );
  if (error) throw new Error(error.message);
}

// ============ AVAILABILITY SLOTS ============

export async function getAvailabilitySlots(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("team_id", orgId)
    .gte("start_time", startDate)
    .lte("start_time", endDate)
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as AvailabilitySlot[];
}

export async function getAvailableSlotsForClient(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<AvailabilitySlot[]> {
  const { data, error } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("team_id", orgId)
    .eq("is_booked", false)
    .gte("start_time", startDate)
    .lte("start_time", endDate)
    .order("start_time", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as AvailabilitySlot[];
}

export async function createAvailabilitySlots(
  slots: Omit<AvailabilitySlot, "id" | "created_at">[]
): Promise<void> {
  if (slots.length === 0) return;
  const { error } = await supabase
    .from("availability_slots")
    .insert(slots);
  if (error) throw new Error(error.message);
}

export async function deleteAvailabilitySlot(id: string): Promise<void> {
  const { error } = await supabase
    .from("availability_slots")
    .delete()
    .eq("id", id)
    .eq("is_booked", false);
  if (error) throw new Error(error.message);
}

export async function deleteRecurringSlots(
  recurrenceGroupId: string
): Promise<void> {
  const { error } = await supabase
    .from("availability_slots")
    .delete()
    .eq("recurrence_group_id", recurrenceGroupId)
    .eq("is_booked", false);
  if (error) throw new Error(error.message);
}

export async function clearFutureUnbookedSlots(orgId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("availability_slots")
    .delete()
    .eq("team_id", orgId)
    .eq("is_booked", false)
    .gte("start_time", now);
  if (error) throw new Error(error.message);
}

export async function clearDayUnbookedSlots(
  orgId: string,
  dayStart: string,
  dayEnd: string
): Promise<void> {
  const { error } = await supabase
    .from("availability_slots")
    .delete()
    .eq("team_id", orgId)
    .eq("is_booked", false)
    .gte("start_time", dayStart)
    .lte("start_time", dayEnd);
  if (error) throw new Error(error.message);
}

// ============ APPOINTMENTS ============

export async function getAppointments(
  orgId: string,
  startDate: string,
  endDate: string
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*, slot:availability_slots(*), project:projects(name)")
    .eq("team_id", orgId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []).map((d: any) => ({
    ...d,
    slot: d.slot || undefined,
    project_name: d.project?.name || undefined,
    project: undefined,
  })) as Appointment[];
}

export async function getAppointmentsBySlots(
  slotIds: string[]
): Promise<Appointment[]> {
  if (slotIds.length === 0) return [];
  const { data, error } = await supabase
    .from("appointments")
    .select("*, project:projects(name)")
    .in("slot_id", slotIds);
  if (error) throw new Error(error.message);
  return (data || []).map((d: any) => ({
    ...d,
    project_name: d.project?.name || undefined,
    project: undefined,
  })) as Appointment[];
}

export async function getTodaysAppointments(
  orgId: string
): Promise<Appointment[]> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("appointments")
    .select("*, slot:availability_slots(*), project:projects(name)")
    .eq("team_id", orgId)
    .eq("status", "confirmed")
    .gte("slot.start_time", todayStart.toISOString())
    .lte("slot.start_time", todayEnd.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  // Filter out rows where the inner join didn't match (slot times outside range)
  return (data || [])
    .filter((d: any) => d.slot)
    .map((d: any) => ({
      ...d,
      slot: d.slot || undefined,
      project_name: d.project?.name || undefined,
      project: undefined,
    })) as Appointment[];
}

export async function getUpcomingAppointments(
  orgId: string,
  days: number = 7
): Promise<Appointment[]> {
  const now = new Date();
  const end = new Date();
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("appointments")
    .select("*, slot:availability_slots(*), project:projects(name)")
    .eq("team_id", orgId)
    .eq("status", "confirmed");
  if (error) throw new Error(error.message);
  // Filter client-side by slot start_time (Supabase doesn't support filtering on joined fields reliably)
  return (data || [])
    .filter((d: any) => {
      if (!d.slot) return false;
      const slotStart = new Date(d.slot.start_time);
      return slotStart >= now && slotStart <= end;
    })
    .sort((a: any, b: any) => new Date(a.slot.start_time).getTime() - new Date(b.slot.start_time).getTime())
    .map((d: any) => ({
      ...d,
      slot: d.slot || undefined,
      project_name: d.project?.name || undefined,
      project: undefined,
    })) as Appointment[];
}

export async function bookAppointment(data: {
  team_id: string;
  slot_id: string;
  project_id: string;
  client_id: string;
  client_name: string;
  notes?: string;
}): Promise<void> {
  // Insert appointment (UNIQUE on slot_id prevents double-booking)
  const { error: apptError } = await supabase
    .from("appointments")
    .insert({
      team_id: data.team_id,
      slot_id: data.slot_id,
      project_id: data.project_id,
      client_id: data.client_id,
      client_name: data.client_name,
      notes: data.notes || null,
      status: "confirmed",
    });
  if (apptError) {
    if (apptError.message.includes("duplicate") || apptError.message.includes("unique")) {
      throw new Error("This slot was just booked by someone else. Please pick another time.");
    }
    throw new Error(apptError.message);
  }

  // Mark slot as booked
  const { error: slotError } = await supabase
    .from("availability_slots")
    .update({ is_booked: true })
    .eq("id", data.slot_id);
  if (slotError) throw new Error(slotError.message);
}

export async function cancelAppointment(
  appointmentId: string,
  slotId: string
): Promise<void> {
  const { error: apptError } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", appointmentId);
  if (apptError) throw new Error(apptError.message);

  const { error: slotError } = await supabase
    .from("availability_slots")
    .update({ is_booked: false })
    .eq("id", slotId);
  if (slotError) throw new Error(slotError.message);
}

// ============ CLIENT NOTIFICATION PREFERENCES ============

export async function getClientNotificationPreferences(
  clientId: string,
  projectId: string
): Promise<ClientNotificationPreferences | null> {
  const { data, error } = await supabase
    .from("client_notification_preferences")
    .select("*")
    .eq("client_id", clientId)
    .eq("project_id", projectId)
    .single();
  if (error) return null;
  return data as ClientNotificationPreferences;
}

export async function upsertClientNotificationPreferences(
  prefs: Omit<ClientNotificationPreferences, "id" | "created_at" | "updated_at">
): Promise<void> {
  const { error } = await supabase
    .from("client_notification_preferences")
    .upsert(
      { ...prefs, updated_at: new Date().toISOString() },
      { onConflict: "client_id,project_id" }
    );
  if (error) throw new Error(error.message);
}

// ============ TIME TRACKING ============

export async function getTimeEntriesForStage(stageId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("stage_id", stageId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as TimeEntry[];
}

export async function getTimeEntriesForProject(projectId: string): Promise<TimeEntry[]> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (data || []) as TimeEntry[];
}

export async function getTimeSummaryByStage(projectId: string): Promise<Record<string, number>> {
  const entries = await getTimeEntriesForProject(projectId);
  const map: Record<string, number> = {};
  for (const e of entries) {
    if (e.duration_minutes) {
      map[e.stage_id] = (map[e.stage_id] || 0) + e.duration_minutes;
    }
  }
  return map;
}

export async function getActiveTimer(userId: string, teamId: string): Promise<TimeEntry | null> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("team_id", teamId)
    .is("end_time", null)
    .not("start_time", "is", null)
    .single();
  if (error) return null;
  return data as TimeEntry;
}

export async function startTimer(entry: {
  team_id: string;
  project_id: string;
  stage_id: string;
  user_id: string;
  billable?: boolean;
}): Promise<TimeEntry> {
  const { billable = true, ...rest } = entry;
  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      ...rest,
      start_time: new Date().toISOString(),
      end_time: null,
      duration_minutes: null,
      billable,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as TimeEntry;
}

export async function stopTimer(entryId: string): Promise<TimeEntry> {
  // Fetch the entry to calculate duration
  const { data: entry, error: fetchError } = await supabase
    .from("time_entries")
    .select("*")
    .eq("id", entryId)
    .single();
  if (fetchError || !entry) throw new Error(fetchError?.message || "Timer not found");

  const startTime = new Date(entry.start_time).getTime();
  const now = Date.now();
  const durationMinutes = Math.max(1, Math.round((now - startTime) / 60000));

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      end_time: new Date().toISOString(),
      duration_minutes: durationMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as TimeEntry;
}

export async function createManualTimeEntry(
  entry: Omit<TimeEntry, "id" | "created_at" | "updated_at" | "start_time" | "end_time">
): Promise<TimeEntry> {
  const { data, error } = await supabase
    .from("time_entries")
    .insert({
      ...entry,
      start_time: null,
      end_time: null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as TimeEntry;
}

export async function updateTimeEntry(
  id: string,
  updates: Partial<Pick<TimeEntry, "notes" | "billable" | "duration_minutes">>
): Promise<void> {
  const { error } = await supabase
    .from("time_entries")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from("time_entries")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ============ ORG BRANDING ============

export async function getOrgBranding(orgId: string): Promise<OrgBranding | null> {
  const { data, error } = await supabase
    .from("org_branding")
    .select("*")
    .eq("team_id", orgId)
    .single();
  if (error) return null;
  return data as OrgBranding;
}

export async function upsertOrgBranding(
  branding: Omit<OrgBranding, "id" | "created_at" | "updated_at">
): Promise<void> {
  const { error } = await supabase
    .from("org_branding")
    .upsert(
      { ...branding, updated_at: new Date().toISOString() },
      { onConflict: "team_id" }
    );
  if (error) throw new Error(error.message);
}

export async function uploadOrgLogo(orgId: string, file: File): Promise<string> {
  const fileName = `${orgId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await supabase.storage
    .from("org-logos")
    .upload(fileName, file, { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from("org-logos").getPublicUrl(fileName);
  return data.publicUrl;
}

// ============ EMAIL TEMPLATES ============

export async function getEmailTemplates(orgId: string): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("team_id", orgId)
    .order("template_type", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as EmailTemplate[];
}

export async function getEmailTemplate(
  orgId: string,
  templateType: string
): Promise<EmailTemplate | null> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*")
    .eq("team_id", orgId)
    .eq("template_type", templateType)
    .single();
  if (error) return null;
  return data as EmailTemplate;
}

export async function upsertEmailTemplate(
  template: Omit<EmailTemplate, "id" | "created_at" | "updated_at">
): Promise<void> {
  const { error } = await supabase
    .from("email_templates")
    .upsert(
      { ...template, updated_at: new Date().toISOString() },
      { onConflict: "team_id,template_type" }
    );
  if (error) throw new Error(error.message);
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("email_templates")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ============ SAMPLE DATA ============

export async function createSampleProject(orgId: string, userId: string): Promise<string> {
  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();

  const projectId = await createProject({
    team_id: orgId,
    name: "Kitchen Renovation — 123 Main St",
    description: "Full kitchen remodel including cabinets, countertops, plumbing, and electrical.",
    status: "active",
    client_name: "Sample Client",
    client_email: "",
    client_phone: "",
    created_by: userId,
  });

  const stages = [
    { name: "Site Assessment", status: "completed" as const, started_at: daysAgo(14), completed_at: daysAgo(12) },
    { name: "Design & Planning", status: "completed" as const, started_at: daysAgo(12), completed_at: daysAgo(7) },
    { name: "Demolition", status: "in_progress" as const, started_at: daysAgo(3), completed_at: null },
    { name: "Plumbing & Electrical", status: "pending" as const, started_at: null, completed_at: null },
    { name: "Installation & Finishing", status: "pending" as const, started_at: null, completed_at: null },
    { name: "Final Inspection", status: "pending" as const, started_at: null, completed_at: null },
  ];

  for (let i = 0; i < stages.length; i++) {
    await createProjectStage({
      project_id: projectId,
      name: stages[i].name,
      status: stages[i].status,
      position: i,
      started_at: stages[i].started_at,
      completed_at: stages[i].completed_at,
      started_by: stages[i].started_at ? userId : null,
      assigned_to: null,
      estimated_completion: null,
      planned_start: null,
    });
  }

  return projectId;
}
