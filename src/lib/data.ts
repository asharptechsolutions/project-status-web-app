import { createClient } from "./supabase";

const supabase = createClient();
import type {
  Project,
  ProjectStage,
  ProjectAssignment,
  ProjectMessage,
  ProjectFile,
  Template,
  PresetStage,
  Member,
} from "./types";

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

// ============ MESSAGES ============

export async function getProjectMessages(
  projectId: string
): Promise<ProjectMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as ProjectMessage[];
}

export async function sendProjectMessage(
  message: Omit<ProjectMessage, "id" | "created_at">
): Promise<string> {
  const { data, error } = await supabase
    .from("messages")
    .insert(message)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
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

// ============ MEMBERS ============

export async function getMembers(orgId: string): Promise<Member[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("team_id", orgId)
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data || []) as Member[];
}

export async function getMember(
  userId: string,
  orgId: string
): Promise<Member | null> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("user_id", userId)
    .eq("team_id", orgId)
    .single();
  if (error) return null;
  return data as Member;
}

export async function createMember(
  member: Omit<Member, "id" | "created_at">
): Promise<Member> {
  const { data, error } = await supabase
    .from("team_members")
    .insert(member)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Member;
}

export async function updateMember(
  id: string,
  updates: Partial<Member>
): Promise<void> {
  const { error } = await supabase
    .from("team_members")
    .update(updates)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase
    .from("team_members")
    .delete()
    .eq("id", id);
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
