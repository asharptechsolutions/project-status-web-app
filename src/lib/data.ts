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
