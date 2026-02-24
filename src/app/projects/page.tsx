"use client";
import { useEffect, useState, useCallback, useRef, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { AuthGate } from "@/components/auth-gate";
import { useAuth } from "@/lib/auth-context";
import {
  getProjects, createProject, updateProject, deleteProject,
  getProjectStages, getStagesForProjects, createProjectStage, updateProjectStage, deleteProjectStage,
  getTemplates, getPresetStages,
  getAssignedProjects, getClientProjects, getMembers, getCompanies, createCompany, createTemplate,
  setProjectClients, getProjectClients, addProjectClient, removeProjectClient,
  getStageDependencies, createStageDependency, deleteStageDependency, deleteStageDependenciesForStage,
} from "@/lib/data";
import type { Project, ProjectStage, Template, PresetStage, Member, Company, StageDependency } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Trash2, ArrowLeft, Play, CheckCircle2, ChevronRight,
  Pencil, Search, X, ArrowUpDown, Archive, ArchiveRestore,
  Clock, Loader2, GripVertical, UserPlus, Mail, Users, Building2, Save,
  AlertTriangle, TrendingUp, Link, FolderOpen, MoreHorizontal, BarChart3, Network,
} from "lucide-react";
import { toast } from "sonner";
import { DatePicker } from "@/components/ui/date-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ProjectNotes } from "@/components/project-notes";
import { ChatBubble, type ChatBubbleHandle } from "@/components/chat-bubble";
import dynamic from "next/dynamic";

const WorkflowCanvas = dynamic(
  () => import("@/components/workflow-canvas").then((m) => m.WorkflowCanvas),
  { ssr: false, loading: () => <div className="h-[400px] flex items-center justify-center border rounded-lg"><Loader2 className="h-6 w-6 animate-spin" /></div> },
);

const GanttChart = dynamic(
  () => import("@/components/gantt-chart").then((m) => m.GanttChart),
  { ssr: false, loading: () => <div className="h-[300px] flex items-center justify-center border rounded-lg"><Loader2 className="h-6 w-6 animate-spin" /></div> },
);

function ProjectsList() {
  const { orgId, userId, isAdmin, isWorker, isClient, member } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const handledParams = useRef(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [presetStages, setPresetStages] = useState<PresetStage[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedProject, setSelectedProjectRaw] = useState<Project | null>(null);
  const selectProject = useCallback((p: Project | null) => {
    setSelectedProjectRaw(p);
    if (p) {
      router.replace(`/projects/?id=${p.id}`, { scroll: false });
    } else {
      router.replace("/projects/", { scroll: false });
    }
  }, [router]);
  const [stages, setStages] = useState<ProjectStage[]>([]);
  const [stagesLoaded, setStagesLoaded] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [invitingClient, setInvitingClient] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [newStageName, setNewStageName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClientIds, setEditClientIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active-completed");
  const [sortBy, setSortBy] = useState("newest");
  const [projectClientIds, setProjectClientIds] = useState<string[]>([]);
  const [addingClient, setAddingClient] = useState(false);
  const [detailShowNewClient, setDetailShowNewClient] = useState(false);
  const [detailNewClientName, setDetailNewClientName] = useState("");
  const [detailNewClientEmail, setDetailNewClientEmail] = useState("");
  const [detailNewClientPhone, setDetailNewClientPhone] = useState("");
  const [detailInvitingClient, setDetailInvitingClient] = useState(false);
  const [showStageModal, setShowStageModal] = useState(false);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [stageModalName, setStageModalName] = useState("");
  const [stageModalWorker, setStageModalWorker] = useState<string | null>(null);
  const [stageModalEstDate, setStageModalEstDate] = useState<Date | undefined>(undefined);
  const [stageModalStatus, setStageModalStatus] = useState<ProjectStage["status"]>("pending");
  const [showClientsModal, setShowClientsModal] = useState(false);
  const [projectProgress, setProjectProgress] = useState<Record<string, number>>({});
  const [projectSchedule, setProjectSchedule] = useState<Record<string, number | null>>({});
  const [assignStageId, setAssignStageId] = useState<string | null>(null);
  const [showNewWorker, setShowNewWorker] = useState(false);
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerEmail, setNewWorkerEmail] = useState("");
  const [newWorkerPhone, setNewWorkerPhone] = useState("");
  const [invitingWorker, setInvitingWorker] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [editCompanyId, setEditCompanyId] = useState<string | null>(null);
  const [showNewCompany, setShowNewCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyEmail, setNewCompanyEmail] = useState("");
  const [newCompanyPhone, setNewCompanyPhone] = useState("");
  const [newCompanyAddress, setNewCompanyAddress] = useState("");
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const chatBubbleRef = useRef<ChatBubbleHandle>(null);
  const workflowLocked = selectedProject?.workflow_locked ?? false;
  const [viewMode, setViewMode] = useState<"canvas" | "gantt">("canvas");
  const [dependencies, setDependencies] = useState<StageDependency[]>([]);
  const [stageModalPlannedStart, setStageModalPlannedStart] = useState<Date | undefined>(undefined);

  // Compute schedule days from a list of stages (negative = behind, positive = ahead, null = no estimates)
  const computeScheduleDays = useCallback((stageList: ProjectStage[]): number | null => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const withEstimates = stageList.filter((s) => s.estimated_completion);
    if (withEstimates.length === 0) return null;
    const allCompleted = withEstimates.every((s) => s.status === "completed");
    if (allCompleted) {
      const lastEstimated = withEstimates.sort((a, b) =>
        (b.estimated_completion || "").localeCompare(a.estimated_completion || "")
      )[0];
      if (lastEstimated.completed_at) {
        const est = new Date(lastEstimated.estimated_completion + "T00:00:00");
        const completed = new Date(lastEstimated.completed_at);
        completed.setHours(0, 0, 0, 0);
        return Math.round((est.getTime() - completed.getTime()) / (1000 * 60 * 60 * 24));
      }
      return null;
    }
    let worstDays = Infinity;
    for (const s of withEstimates) {
      if (s.status === "completed") continue;
      const est = new Date(s.estimated_completion + "T00:00:00");
      const diff = Math.round((est.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diff < worstDays) worstDays = diff;
    }
    return worstDays !== Infinity ? worstDays : null;
  }, []);

  const handleLockedChange = useCallback(async (locked: boolean, positions?: Record<string, { x: number; y: number }>) => {
    if (!selectedProject) return;
    try {
      const updates: Partial<Project> = { workflow_locked: locked };
      if (locked && positions) {
        updates.workflow_positions = positions;
      }
      await updateProject(selectedProject.id, updates);
      const updatedProject = { ...selectedProject, ...updates };
      setSelectedProjectRaw(updatedProject);
      // Also update the projects array so navigating away/back keeps the state
      setProjects((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, ...updates } : p));
      toast.success(`Workflow ${locked ? "locked" : "unlocked"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update lock state");
    }
  }, [selectedProject]);

  const handlePositionsChange = useCallback(async (positions: Record<string, { x: number; y: number }>) => {
    if (!selectedProject) return;
    try {
      await updateProject(selectedProject.id, { workflow_positions: positions });
      setSelectedProjectRaw((prev) => prev ? { ...prev, workflow_positions: positions } : prev);
      setProjects((prev) => prev.map((p) => p.id === selectedProject.id ? { ...p, workflow_positions: positions } : p));
    } catch (err: any) {
      toast.error(err.message || "Failed to save positions");
    }
  }, [selectedProject]);

  // Derived member lists
  const clientMembers = useMemo(() => members.filter((m) => m.role === "client"), [members]);
  const workerMembers = useMemo(() => members.filter((m) => m.role === "worker" || m.role === "owner"), [members]);

  const workerNames = useMemo(() => {
    const map: Record<string, string> = {};
    workerMembers.forEach((w) => { map[w.user_id] = w.name || w.email; });
    return map;
  }, [workerMembers]);

  const companyMap = useMemo(() => {
    const map: Record<string, string> = {};
    companies.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [companies]);

  const load = useCallback(async () => {
    if (!orgId) return;
    try {
      const [p, t, ps, m, co] = await Promise.all([
        isClient && member ? getClientProjects(member.id) : getProjects(orgId),
        isAdmin ? getTemplates(orgId) : Promise.resolve([]),
        isAdmin ? getPresetStages(orgId) : Promise.resolve([]),
        getMembers(orgId),
        getCompanies(orgId),
      ]);
      setProjects(p);
      setTemplates(t);
      setPresetStages(ps);
      setMembers(m);
      setCompanies(co);
      // Compute progress and schedule per project
      if (p.length > 0) {
        const allStages = await getStagesForProjects(p.map((proj) => proj.id));
        const progressMap: Record<string, number> = {};
        const scheduleMap: Record<string, number | null> = {};
        for (const proj of p) {
          const projStages = allStages.filter((s) => s.project_id === proj.id);
          const completed = projStages.filter((s) => s.status === "completed").length;
          progressMap[proj.id] = projStages.length ? Math.round((completed / projStages.length) * 100) : 0;
          scheduleMap[proj.id] = computeScheduleDays(projStages);
        }
        setProjectProgress(progressMap);
        setProjectSchedule(scheduleMap);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [orgId, isAdmin, isClient, member]);

  useEffect(() => { load(); }, [load]);

  // Load stages, files, clients, and dependencies when viewing a project
  useEffect(() => {
    if (!selectedProject) { setStages([]); setStagesLoaded(false); setProjectClientIds([]); setDependencies([]); setDetailShowNewClient(false); setDetailNewClientName(""); setDetailNewClientEmail(""); setDetailNewClientPhone(""); return; }
    setStagesLoaded(false);
    getProjectStages(selectedProject.id).then((s) => { setStages(s); setStagesLoaded(true); }).catch(() => { setStagesLoaded(true); });
    getProjectClients(selectedProject.id).then(setProjectClientIds).catch(() => {});
    getStageDependencies(selectedProject.id).then(setDependencies).catch(() => {});
    window.scrollTo(0, 0);
  }, [selectedProject?.id]);

  // Keep project progress and schedule in sync when stages change
  useEffect(() => {
    if (!selectedProject || stages.length === 0) return;
    const completed = stages.filter((s) => s.status === "completed").length;
    const prog = Math.round((completed / stages.length) * 100);
    setProjectProgress((prev) => ({ ...prev, [selectedProject.id]: prog }));
    setProjectSchedule((prev) => ({ ...prev, [selectedProject.id]: computeScheduleDays(stages) }));
  }, [selectedProject?.id, stages, computeScheduleDays]);

  useEffect(() => {
    if (!handledParams.current) {
      if (searchParams.get("new") === "1") {
        setShowNew(true);
        router.replace("/projects/", { scroll: false });
        handledParams.current = true;
        return;
      }
    }
    const id = searchParams.get("id");
    if (id && projects.length) {
      const found = projects.find((p) => p.id === id);
      if (found) setSelectedProjectRaw(found);
    }
  }, [searchParams, projects, router]);

  // Invite a new client via the API (used in new project dialog)
  const handleInviteClient = async (
    name: string, email: string, phone: string,
    onSuccess: (userId: string) => void,
    setInviting: (v: boolean) => void,
    resetForm: () => void,
    companyId?: string | null,
  ) => {
    if (!orgId || !name.trim() || !email.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/invite/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          name: name.trim(),
          role: "client",
          teamId: orgId,
          phone: phone.trim() || undefined,
          ...(companyId ? { companyId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite client");
      toast.success(data.invited ? `Invitation sent to ${email}` : `${name} added as client`);
      // Refresh members to get the new client
      const updatedMembers = await getMembers(orgId);
      setMembers(updatedMembers);
      onSuccess(data.userId);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite client");
    } finally {
      setInviting(false);
    }
  };

  const handleCreateNewClient = () => {
    handleInviteClient(
      newClientName, newClientEmail, newClientPhone,
      (uid) => { setSelectedClientIds((prev) => [...prev, uid]); setShowNewClient(false); },
      setInvitingClient,
      () => { setNewClientName(""); setNewClientEmail(""); setNewClientPhone(""); },
      selectedCompanyId,
    );
  };

  const handleCreateNewClientForProject = () => {
    if (!selectedProject) return;
    handleInviteClient(
      detailNewClientName, detailNewClientEmail, detailNewClientPhone,
      async (uid) => {
        await addProjectClient(selectedProject.id, uid);
        setProjectClientIds((prev) => [...prev, uid]);
        setDetailShowNewClient(false);
      },
      setDetailInvitingClient,
      () => { setDetailNewClientName(""); setDetailNewClientEmail(""); setDetailNewClientPhone(""); },
      selectedProject.company_id,
    );
  };

  const handleCreateClientForEdit = () => {
    handleInviteClient(
      newClientName, newClientEmail, newClientPhone,
      (uid) => { setEditClientIds((prev) => [...prev, uid]); setShowNewClient(false); },
      setInvitingClient,
      () => { setNewClientName(""); setNewClientEmail(""); setNewClientPhone(""); },
      editCompanyId,
    );
  };

  const handleAssignWorker = async (workerId: string | null) => {
    if (!assignStageId) return;
    try {
      await updateProjectStage(assignStageId, { assigned_to: workerId });
      setStages((prev) =>
        prev.map((s) => s.id === assignStageId ? { ...s, assigned_to: workerId } : s)
      );
      setAssignStageId(null);
      toast.success(workerId ? "Worker assigned" : "Worker unassigned");
    } catch (err: any) {
      toast.error(err.message || "Failed to assign worker");
    }
  };

  const handleInviteNewWorker = async () => {
    if (!orgId || !newWorkerName.trim() || !newWorkerEmail.trim()) return;
    setInvitingWorker(true);
    try {
      const res = await fetch("/api/invite/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newWorkerEmail.toLowerCase().trim(),
          name: newWorkerName.trim(),
          role: "worker",
          teamId: orgId,
          phone: newWorkerPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite worker");
      toast.success(data.invited ? `Invitation sent to ${newWorkerEmail}` : `${newWorkerName} added as worker`);
      const updatedMembers = await getMembers(orgId);
      setMembers(updatedMembers);
      setShowNewWorker(false);
      setNewWorkerName(""); setNewWorkerEmail(""); setNewWorkerPhone("");
    } catch (err: any) {
      toast.error(err.message || "Failed to invite worker");
    } finally {
      setInvitingWorker(false);
    }
  };

  const handleSelectCompany = (companyId: string | null, setter: (v: string | null) => void, clientSetter: (v: string[]) => void) => {
    setter(companyId);
    setShowNewCompany(false);
    if (companyId) {
      const companyClients = clientMembers.filter((m) => m.company_id === companyId).map((m) => m.user_id);
      clientSetter(companyClients);
    } else {
      clientSetter([]);
    }
  };

  const handleCreateNewCompany = async (setter: (v: string | null) => void, clientSetter: (v: string[]) => void) => {
    if (!orgId || !newCompanyName.trim()) return;
    setCreatingCompany(true);
    try {
      const id = await createCompany({
        team_id: orgId,
        name: newCompanyName.trim(),
        email: newCompanyEmail.trim(),
        phone: newCompanyPhone.trim(),
        address: newCompanyAddress.trim(),
      });
      const updatedCompanies = await getCompanies(orgId);
      setCompanies(updatedCompanies);
      setter(id);
      setShowNewCompany(false);
      setNewCompanyName(""); setNewCompanyEmail(""); setNewCompanyPhone(""); setNewCompanyAddress("");
      // New company has no clients yet
      clientSetter([]);
      toast.success("Company created");
    } catch (err: any) {
      toast.error(err.message || "Failed to create company");
    } finally {
      setCreatingCompany(false);
    }
  };

  const handleCreate = async () => {
    if (!orgId || !userId) return;
    if (!newName.trim()) { toast.error("Project name is required"); return; }
    try {
      const primaryClient = clientMembers.find((m) => m.user_id === selectedClientIds[0]);
      const id = await createProject({
        team_id: orgId,
        name: newName.trim(),
        client_name: primaryClient?.name || "",
        client_email: primaryClient?.email || "",
        client_phone: primaryClient?.phone || "",
        client_id: selectedClientIds[0] || undefined,
        company_id: selectedCompanyId,
        status: "active",
        created_by: userId,
      });
      await setProjectClients(id, selectedClientIds);
      if (selectedTemplate) {
        const tmpl = templates.find((t) => t.id === selectedTemplate);
        if (tmpl?.stages) {
          for (const s of tmpl.stages) {
            await createProjectStage({
              project_id: id, name: s.name, status: "pending", position: s.position,
              started_at: null, completed_at: null, started_by: null, assigned_to: null, estimated_completion: null, planned_start: null,
            });
          }
        }
      } else {
        await createProjectStage({
          project_id: id, name: "Order Processing", status: "pending", position: 0,
          started_at: null, completed_at: null, started_by: null, assigned_to: null, estimated_completion: null, planned_start: null,
        });
      }
      const createdProject: Project = {
        id, team_id: orgId, name: newName.trim(),
        client_name: primaryClient?.name || "", client_email: primaryClient?.email || "",
        client_phone: primaryClient?.phone || "", client_id: selectedClientIds[0] || undefined,
        company_id: selectedCompanyId,
        status: "active", created_by: userId,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      setNewName(""); setSelectedClientIds([]); setShowNewClient(false);
      setNewClientName(""); setNewClientEmail(""); setNewClientPhone(""); setSelectedTemplate("");
      setSelectedCompanyId(null); setShowNewCompany(false); setShowNew(false);
      toast.success("Project created");
      load();
      selectProject(createdProject);
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    }
  };

  const handleAddDependency = async (sourceId: string, targetId: string) => {
    if (!selectedProject) return;
    try {
      const dep = await createStageDependency({
        project_id: selectedProject.id,
        source_stage_id: sourceId,
        target_stage_id: targetId,
        dependency_type: "finish_to_start",
      });
      setDependencies((prev) => {
        const existing = prev.find((d) => d.source_stage_id === sourceId && d.target_stage_id === targetId);
        if (existing) return prev;
        return [...prev, dep];
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to create dependency");
    }
  };

  const handleRemoveDependency = async (depId: string) => {
    try {
      await deleteStageDependency(depId);
      setDependencies((prev) => prev.filter((d) => d.id !== depId));
    } catch (err: any) {
      toast.error(err.message || "Failed to remove dependency");
    }
  };

  const handleGanttUpdateStage = async (stageId: string, updates: Partial<ProjectStage>) => {
    try {
      await updateProjectStage(stageId, updates);
      setStages((prev) => prev.map((s) => s.id === stageId ? { ...s, ...updates } : s));
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    }
  };

  const handleOpenAddStage = () => {
    setEditingStageId(null);
    setStageModalName("");
    setStageModalWorker(null);
    setStageModalEstDate(undefined);
    setStageModalPlannedStart(undefined);
    setShowStageModal(true);
  };

  const handleOpenEditStage = (stageId: string) => {
    const stage = stages.find((s) => s.id === stageId);
    if (!stage) return;
    setEditingStageId(stageId);
    setStageModalName(stage.name);
    setStageModalWorker(stage.assigned_to);
    setStageModalEstDate(stage.estimated_completion ? new Date(stage.estimated_completion + "T00:00:00") : undefined);
    setStageModalPlannedStart(stage.planned_start ? new Date(stage.planned_start + "T00:00:00") : undefined);
    setStageModalStatus(stage.status);
    setShowStageModal(true);
  };

  const handleSaveStage = async () => {
    if (!selectedProject || !stageModalName.trim()) return;
    try {
      const estDate = stageModalEstDate ? stageModalEstDate.toISOString().split("T")[0] : null;
      const plannedStart = stageModalPlannedStart ? stageModalPlannedStart.toISOString().split("T")[0] : null;
      if (editingStageId) {
        const currentStage = stages.find((s) => s.id === editingStageId);
        const now = new Date().toISOString();
        const updates: Partial<ProjectStage> = {
          name: stageModalName.trim(),
          assigned_to: stageModalWorker,
          estimated_completion: estDate,
          planned_start: plannedStart,
          status: stageModalStatus,
        };
        // Handle timestamp changes when status changes
        if (currentStage && stageModalStatus !== currentStage.status) {
          if (stageModalStatus === "pending") {
            updates.started_at = null;
            updates.started_by = null;
            updates.completed_at = null;
          } else if (stageModalStatus === "in_progress") {
            updates.started_at = currentStage.started_at || now;
            updates.started_by = currentStage.started_by || userId;
            updates.completed_at = null;
          } else if (stageModalStatus === "completed") {
            updates.started_at = currentStage.started_at || now;
            updates.started_by = currentStage.started_by || userId;
            updates.completed_at = now;
          }
        }
        await updateProjectStage(editingStageId, updates);
        setStages((prev) => prev.map((s) => s.id === editingStageId ? { ...s, ...updates } : s));
        toast.success("Stage updated");
      } else {
        const stage = await createProjectStage({
          project_id: selectedProject.id,
          name: stageModalName.trim(),
          status: "pending",
          position: stages.length,
          started_at: null,
          completed_at: null,
          started_by: null,
          assigned_to: stageModalWorker,
          estimated_completion: estDate,
          planned_start: plannedStart,
        });
        setStages((prev) => [...prev, stage]);
        toast.success("Stage added");
      }
      setShowStageModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save stage");
    }
  };

  const updateStageStatus = async (stageId: string, status: ProjectStage["status"]) => {
    if (!selectedProject || !userId) return;
    const now = new Date().toISOString();
    const updates: Partial<ProjectStage> = { status };
    if (status === "in_progress") { updates.started_at = now; updates.started_by = userId; }
    if (status === "completed") { updates.completed_at = now; }
    try {
      await updateProjectStage(stageId, updates);
      const newStages = stages.map((s) => s.id === stageId ? { ...s, ...updates } : s);
      setStages(newStages);
      const allDone = newStages.every((s) => s.status === "completed");
      if (allDone && selectedProject.status !== "completed") {
        await updateProject(selectedProject.id, { status: "completed" });
        setSelectedProjectRaw({ ...selectedProject, status: "completed" });
        load();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update stage");
    }
  };

  const removeStage = async (stageId: string) => {
    try {
      await deleteStageDependenciesForStage(stageId);
      await deleteProjectStage(stageId);
      setStages(stages.filter((s) => s.id !== stageId));
      setDependencies((prev) => prev.filter((d) => d.source_stage_id !== stageId && d.target_stage_id !== stageId));
    } catch (err: any) {
      toast.error(err.message || "Failed to remove stage");
    }
  };

  const handleDelete = async (id: string) => {
    try { await deleteProject(id); selectProject(null); toast.success("Project deleted"); load(); }
    catch (err: any) { toast.error(err.message || "Failed to delete project"); }
  };

  const handleArchive = async (id: string) => {
    try { await updateProject(id, { status: "archived" }); selectProject(null); toast.success("Project archived"); load(); }
    catch (err: any) { toast.error(err.message || "Failed to archive project"); }
  };

  const handleRestore = async (id: string) => {
    if (!selectedProject) return;
    const allDone = stages.length > 0 && stages.every((s) => s.status === "completed");
    try {
      await updateProject(id, { status: allDone ? "completed" : "active" });
      setSelectedProjectRaw({ ...selectedProject, status: allDone ? "completed" : "active" });
      toast.success("Project restored"); load();
    } catch (err: any) { toast.error(err.message || "Failed to restore project"); }
  };

  const openEdit = () => {
    if (!selectedProject) return;
    setEditName(selectedProject.name);
    setEditClientIds([...projectClientIds]);
    setEditCompanyId(selectedProject.company_id || null);
    setShowNewClient(false);
    setNewClientName(""); setNewClientEmail(""); setNewClientPhone("");
    setShowNewCompany(false);
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!selectedProject || !editName.trim()) return;
    try {
      await updateProject(selectedProject.id, { name: editName.trim(), company_id: editCompanyId });
      await setProjectClients(selectedProject.id, editClientIds);
      setProjectClientIds(editClientIds);
      setSelectedProjectRaw({ ...selectedProject, name: editName.trim(), company_id: editCompanyId });
      setShowEdit(false);
      toast.success("Project updated"); load();
    } catch (err: any) { toast.error(err.message || "Failed to update project"); }
  };

  const handleSaveAsTemplate = async () => {
    if (!orgId || !userId || !selectedProject || !templateName.trim() || stages.length === 0) return;
    setSavingTemplate(true);
    try {
      await createTemplate({
        team_id: orgId,
        name: templateName.trim(),
        description: `Created from project "${selectedProject.name}"`,
        stages: stages
          .sort((a, b) => a.position - b.position)
          .map((s, i) => ({ name: s.name, position: i })),
        created_by: userId,
      });
      setShowSaveTemplate(false);
      setTemplateName("");
      toast.success("Template saved");
      const updatedTemplates = await getTemplates(orgId);
      setTemplates(updatedTemplates);
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    } finally {
      setSavingTemplate(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  // Project detail view
  if (selectedProject) {
    const completedCount = stages.filter((s) => s.status === "completed").length;
    const progress = stages.length ? Math.round((completedCount / stages.length) * 100) : 0;

    const scheduleDays = computeScheduleDays(stages);

    return (
      <div className="p-4 max-w-4xl mx-auto w-full">
        <Button variant="ghost" className="mb-4" onClick={() => selectProject(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Projects
        </Button>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold">{selectedProject.name}</h1>
              {selectedProject.company_id && companyMap[selectedProject.company_id] && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" /> {companyMap[selectedProject.company_id]}
                </p>
              )}
            </div>
            <Badge className={selectedProject.status === "completed" ? "bg-green-600 text-white hover:bg-green-700" : selectedProject.status === "active" ? "bg-blue-600 text-white hover:bg-blue-700" : ""} variant={selectedProject.status === "completed" || selectedProject.status === "active" ? "default" : "secondary"}>
              {selectedProject.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowClientsModal(true)}>
                  <Users className="h-4 w-4" /> View Clients
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => chatBubbleRef.current?.openFiles()}>
                  <FolderOpen className="h-4 w-4" /> View Files
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  const url = `${window.location.origin}/track/?id=${selectedProject.id}`;
                  navigator.clipboard.writeText(url).then(() => toast.success("Client link copied to clipboard")).catch(() => toast.error("Failed to copy link"));
                }}>
                  <Link className="h-4 w-4" /> Copy Client Link
                </DropdownMenuItem>
                {isAdmin && stages.length > 0 && (
                  <DropdownMenuItem onClick={() => { setTemplateName(selectedProject.name); setShowSaveTemplate(true); }}>
                    <Save className="h-4 w-4" /> Save as Template
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    {selectedProject.status === "archived" ? (
                      <DropdownMenuItem onClick={() => handleRestore(selectedProject.id)}>
                        <ArchiveRestore className="h-4 w-4" /> Restore
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => setShowArchiveConfirm(true)}>
                        <Archive className="h-4 w-4" /> Archive
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setShowDeleteConfirm(true)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Controlled AlertDialogs for Archive and Delete */}
            <AlertDialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Project</AlertDialogTitle>
                  <AlertDialogDescription>Archive &quot;{selectedProject.name}&quot;? It will be hidden from the default view.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleArchive(selectedProject.id)}>Archive</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Project</AlertDialogTitle>
                  <AlertDialogDescription>Permanently delete &quot;{selectedProject.name}&quot;? This cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleDelete(selectedProject.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Schedule status */}
        {scheduleDays !== null && (
          <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg border text-sm ${
            scheduleDays < 0
              ? "border-red-500/30 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
              : scheduleDays === 0
                ? "border-green-500/30 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                : "border-green-500/30 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
          }`}>
            {scheduleDays < 0 ? (
              <><AlertTriangle className="h-4 w-4 shrink-0" /> {Math.abs(scheduleDays)} day{Math.abs(scheduleDays) !== 1 ? "s" : ""} behind schedule</>
            ) : scheduleDays === 0 ? (
              <><Clock className="h-4 w-4 shrink-0" /> On schedule</>
            ) : (
              <><TrendingUp className="h-4 w-4 shrink-0" /> {scheduleDays} day{scheduleDays !== 1 ? "s" : ""} ahead of schedule</>
            )}
          </div>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-1 mb-3">
          <Button
            size="sm"
            variant={viewMode === "canvas" ? "default" : "outline"}
            onClick={() => setViewMode("canvas")}
          >
            <Network className="h-4 w-4 mr-1" /> Canvas
          </Button>
          <Button
            size="sm"
            variant={viewMode === "gantt" ? "default" : "outline"}
            onClick={() => setViewMode("gantt")}
          >
            <BarChart3 className="h-4 w-4 mr-1" /> Timeline
          </Button>
        </div>

        {/* Workflow Canvas / Gantt Chart */}
        {stagesLoaded ? (
          viewMode === "canvas" ? (
            <WorkflowCanvas
              stages={stages}
              readOnly={isClient}
              isAdmin={isAdmin}
              isWorker={isWorker}
              onUpdateStatus={(stageId, status) => updateStageStatus(stageId, status)}
              onRemoveStage={(stageId) => removeStage(stageId)}
              onAssignWorker={(stageId) => setAssignStageId(stageId)}
              onAddStage={handleOpenAddStage}
              onEditStage={handleOpenEditStage}
              workerNames={workerNames}
              progress={progress}
              locked={workflowLocked}
              onLockedChange={handleLockedChange}
              savedPositions={selectedProject.workflow_positions}
              onPositionsChange={handlePositionsChange}
              dependencies={dependencies}
              onAddDependency={handleAddDependency}
              onRemoveDependency={handleRemoveDependency}
            />
          ) : (
            <GanttChart
              stages={stages}
              dependencies={dependencies}
              readOnly={isClient}
              isAdmin={isAdmin}
              isWorker={isWorker}
              workerNames={workerNames}
              progress={progress}
              onUpdateStage={isAdmin ? handleGanttUpdateStage : undefined}
              onAddStage={isAdmin ? handleOpenAddStage : undefined}
              onEditStage={isAdmin ? handleOpenEditStage : undefined}
              onAddDependency={isAdmin ? handleAddDependency : undefined}
            />
          )
        ) : (
          <div className="h-[400px] flex items-center justify-center border rounded-lg">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        {/* Preset stages quick-add */}
        {(isAdmin || isWorker) && presetStages.length > 0 && (
          <div className="mb-8">
            <p className="text-sm text-muted-foreground mb-2">Quick add preset stages:</p>
            <div className="flex flex-wrap gap-2">
              {presetStages.map((ps) => (
                <Button key={ps.id} variant="secondary" size="sm" onClick={async () => {
                  try {
                    const stage = await createProjectStage({
                      project_id: selectedProject.id, name: ps.name, status: "pending",
                      position: stages.length, started_at: null, completed_at: null, started_by: null, assigned_to: null, estimated_completion: null, planned_start: null,
                    });
                    setStages([...stages, stage]);
                  } catch (err: any) { toast.error(err.message || "Failed to add stage"); }
                }}>
                  <Plus className="h-3 w-3 mr-1" /> {ps.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Notes (internal, hidden from clients) */}
        {(isAdmin || isWorker) && (
          <div className="mt-8">
            <ProjectNotes projectId={selectedProject.id} />
          </div>
        )}

        {/* Floating Chat Bubble */}
        <ChatBubble ref={chatBubbleRef} projectId={selectedProject.id} />

        {/* Edit dialog */}
        <Dialog open={showEdit} onOpenChange={setShowEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>Update project details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Project Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div className="border-t pt-3 mt-1">
                <p className="text-sm font-medium mb-2">Company & Clients</p>
                <div className="space-y-3">
                  {/* Company Selection */}
                  <div>
                    <Label>Company</Label>
                    <Select
                      value={editCompanyId || "__none__"}
                      onValueChange={(v) => {
                        if (v === "__new__") {
                          setShowNewCompany(true);
                          setEditCompanyId(null);
                        } else {
                          handleSelectCompany(v === "__none__" ? null : v, setEditCompanyId, setEditClientIds);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <Building2 className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Select a company..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No company</SelectItem>
                        {companies.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                        <SelectItem value="__new__">+ Create New Company</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Inline New Company Form */}
                  {showNewCompany && (
                    <div className="space-y-3 border rounded-md p-3">
                      <div><Label>Company Name</Label><Input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="e.g. Acme Corp" /></div>
                      <div><Label>Email (optional)</Label><Input type="email" value={newCompanyEmail} onChange={(e) => setNewCompanyEmail(e.target.value)} placeholder="e.g. info@acme.com" /></div>
                      <div><Label>Phone (optional)</Label><Input type="tel" value={newCompanyPhone} onChange={(e) => setNewCompanyPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
                      <div><Label>Address (optional)</Label><Input value={newCompanyAddress} onChange={(e) => setNewCompanyAddress(e.target.value)} placeholder="e.g. 123 Main St" /></div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={() => handleCreateNewCompany(setEditCompanyId, setEditClientIds)} disabled={!newCompanyName.trim() || creatingCompany}>
                          {creatingCompany ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Building2 className="h-4 w-4 mr-1" />} Create Company
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewCompany(false); setNewCompanyName(""); setNewCompanyEmail(""); setNewCompanyPhone(""); setNewCompanyAddress(""); }}>
                          <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Clients */}
                  {editClientIds.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {editClientIds.map((cid) => {
                        const c = clientMembers.find((m) => m.user_id === cid);
                        if (!c) return null;
                        return (
                          <Badge key={cid} variant="secondary" className="flex items-center gap-1 py-1 px-2 text-sm">
                            {c.name}
                            <button type="button" onClick={() => setEditClientIds((prev) => prev.filter((id) => id !== cid))} className="ml-1 hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                  {(() => {
                    const available = clientMembers.filter((m) => !editClientIds.includes(m.user_id));
                    return available.length > 0 ? (
                      <Select value="" onValueChange={(v) => { if (v) setEditClientIds((prev) => [...prev, v]); }}>
                        <SelectTrigger><SelectValue placeholder="Add a client..." /></SelectTrigger>
                        <SelectContent>
                          {available.map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.name}{m.company_name ? ` - ${m.company_name}` : ""}{m.email ? ` (${m.email})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null;
                  })()}
                  {!showNewClient ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setShowNewClient(true)}>
                      <UserPlus className="h-4 w-4 mr-1" /> Add New Client
                    </Button>
                  ) : (
                    <div className="space-y-3 border rounded-md p-3">
                      <div><Label>Client Name</Label><Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="e.g. John Smith" /></div>
                      <div><Label>Client Email</Label><Input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="e.g. john@example.com" /></div>
                      <div><Label>Client Phone (optional)</Label><Input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={handleCreateClientForEdit} disabled={!newClientName.trim() || !newClientEmail.trim() || invitingClient}>
                          {invitingClient ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />} Invite Client
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewClient(false); setNewClientName(""); setNewClientEmail(""); setNewClientPhone(""); }}>
                          <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Button onClick={handleEdit} className="w-full" disabled={!editName.trim()}>Save Changes</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Assign Worker Dialog */}
        <Dialog open={!!assignStageId} onOpenChange={(open) => { if (!open) { setAssignStageId(null); setShowNewWorker(false); setNewWorkerName(""); setNewWorkerEmail(""); setNewWorkerPhone(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Worker</DialogTitle>
              <DialogDescription>
                Assign a worker to &quot;{stages.find((s) => s.id === assignStageId)?.name}&quot;
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {workerMembers.length > 0 && (
                <Select value="" onValueChange={(v) => { if (v) handleAssignWorker(v); }}>
                  <SelectTrigger><SelectValue placeholder="Select a worker..." /></SelectTrigger>
                  <SelectContent>
                    {workerMembers.map((w) => (
                      <SelectItem key={w.user_id} value={w.user_id}>
                        {w.name}{w.email ? ` (${w.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {stages.find((s) => s.id === assignStageId)?.assigned_to && (
                <Button variant="outline" className="w-full" onClick={() => handleAssignWorker(null)}>
                  Unassign Worker
                </Button>
              )}
              {!showNewWorker ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewWorker(true)}>
                  <UserPlus className="h-4 w-4 mr-1" /> Invite New Worker
                </Button>
              ) : (
                <div className="space-y-3 border rounded-md p-3">
                  <div><Label>Worker Name</Label><Input value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} placeholder="e.g. John Smith" /></div>
                  <div><Label>Worker Email</Label><Input type="email" value={newWorkerEmail} onChange={(e) => setNewWorkerEmail(e.target.value)} placeholder="e.g. john@example.com" /></div>
                  <div><Label>Worker Phone (optional)</Label><Input type="tel" value={newWorkerPhone} onChange={(e) => setNewWorkerPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={handleInviteNewWorker} disabled={!newWorkerName.trim() || !newWorkerEmail.trim() || invitingWorker}>
                      {invitingWorker ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />} Invite Worker
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewWorker(false); setNewWorkerName(""); setNewWorkerEmail(""); setNewWorkerPhone(""); }}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Stage Add/Edit Modal */}
        <Dialog open={showStageModal} onOpenChange={(open) => {
          if (!open) {
            setShowStageModal(false);
            setShowNewWorker(false);
            setNewWorkerName(""); setNewWorkerEmail(""); setNewWorkerPhone("");
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingStageId ? "Edit Stage" : "Add Stage"}</DialogTitle>
              <DialogDescription>
                {editingStageId ? "Update stage details" : "Add a new workflow stage"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Stage Name</Label>
                {!editingStageId && presetStages.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {presetStages.map((ps) => (
                      <button
                        key={ps.id}
                        type="button"
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                          stageModalName === ps.name
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted/50 hover:bg-muted border-transparent"
                        }`}
                        onClick={() => setStageModalName(ps.name)}
                      >
                        {ps.name}
                      </button>
                    ))}
                  </div>
                )}
                <Input
                  value={stageModalName}
                  onChange={(e) => setStageModalName(e.target.value)}
                  placeholder="e.g. Design Review"
                />
              </div>
              {editingStageId && (
                <div>
                  <Label>Status</Label>
                  <Select value={stageModalStatus} onValueChange={(v) => setStageModalStatus(v as ProjectStage["status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Assign Worker (optional)</Label>
                <Select
                  value={stageModalWorker || "__none__"}
                  onValueChange={(v) => setStageModalWorker(v === "__none__" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a worker..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No worker</SelectItem>
                    {workerMembers.map((w) => (
                      <SelectItem key={w.user_id} value={w.user_id}>
                        {w.name}{w.email ? ` (${w.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!showNewWorker ? (
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setShowNewWorker(true)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Invite New Worker
                  </Button>
                ) : (
                  <div className="space-y-3 border rounded-md p-3 mt-2">
                    <div><Label>Worker Name</Label><Input value={newWorkerName} onChange={(e) => setNewWorkerName(e.target.value)} placeholder="e.g. John Smith" /></div>
                    <div><Label>Worker Email</Label><Input type="email" value={newWorkerEmail} onChange={(e) => setNewWorkerEmail(e.target.value)} placeholder="e.g. john@example.com" /></div>
                    <div><Label>Worker Phone (optional)</Label><Input type="tel" value={newWorkerPhone} onChange={(e) => setNewWorkerPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={handleInviteNewWorker} disabled={!newWorkerName.trim() || !newWorkerEmail.trim() || invitingWorker}>
                        {invitingWorker ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />} Invite Worker
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewWorker(false); setNewWorkerName(""); setNewWorkerEmail(""); setNewWorkerPhone(""); }}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <Label>Date Range (optional)</Label>
                <DateRangePicker
                  startDate={stageModalPlannedStart}
                  endDate={stageModalEstDate}
                  onChangeStart={setStageModalPlannedStart}
                  onChangeEnd={setStageModalEstDate}
                  placeholder="Click a start date, drag to end"
                />
              </div>
              <Button onClick={handleSaveStage} className="w-full" disabled={!stageModalName.trim()}>
                {editingStageId ? "Save Changes" : "Add Stage"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Clients Modal */}
        <Dialog open={showClientsModal} onOpenChange={(open) => {
          if (!open) { setShowClientsModal(false); setDetailShowNewClient(false); setDetailNewClientName(""); setDetailNewClientEmail(""); setDetailNewClientPhone(""); }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clients</DialogTitle>
              <DialogDescription>
                Manage clients assigned to this project
                {selectedProject.company_id && companyMap[selectedProject.company_id] && (
                  <span className="ml-1">({companyMap[selectedProject.company_id]})</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {projectClientIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">No clients assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {projectClientIds.map((cid) => {
                    const c = clientMembers.find((m) => m.user_id === cid);
                    if (!c) return null;
                    return (
                      <Badge key={cid} variant="secondary" className="flex items-center gap-1 py-1 px-2 text-sm">
                        {c.name}
                        {c.company_name && <span className="text-muted-foreground">- {c.company_name}</span>}
                        {c.email && <span className="text-muted-foreground">({c.email})</span>}
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await removeProjectClient(selectedProject.id, cid);
                                setProjectClientIds((prev) => prev.filter((id) => id !== cid));
                                toast.success("Client removed");
                              } catch (err: any) { toast.error(err.message || "Failed to remove client"); }
                            }}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    );
                  })}
                </div>
              )}
              {isAdmin && (
                <>
                  {(() => {
                    const available = clientMembers.filter((m) => !projectClientIds.includes(m.user_id));
                    return available.length > 0 ? (
                      <Select
                        value=""
                        onValueChange={async (v) => {
                          if (!v) return;
                          setAddingClient(true);
                          try {
                            await addProjectClient(selectedProject.id, v);
                            setProjectClientIds((prev) => [...prev, v]);
                            toast.success("Client added");
                          } catch (err: any) { toast.error(err.message || "Failed to add client"); }
                          finally { setAddingClient(false); }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={addingClient ? "Adding..." : "Add existing client..."} />
                        </SelectTrigger>
                        <SelectContent>
                          {available.map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.name}{m.company_name ? ` - ${m.company_name}` : ""}{m.email ? ` (${m.email})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : null;
                  })()}
                  {!detailShowNewClient ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => setDetailShowNewClient(true)}>
                      <UserPlus className="h-4 w-4 mr-1" /> Invite New Client
                    </Button>
                  ) : (
                    <div className="space-y-3 border rounded-md p-3">
                      <div><Label>Client Name</Label><Input value={detailNewClientName} onChange={(e) => setDetailNewClientName(e.target.value)} placeholder="e.g. John Smith" /></div>
                      <div><Label>Client Email</Label><Input type="email" value={detailNewClientEmail} onChange={(e) => setDetailNewClientEmail(e.target.value)} placeholder="e.g. john@example.com" /></div>
                      <div><Label>Client Phone (optional)</Label><Input type="tel" value={detailNewClientPhone} onChange={(e) => setDetailNewClientPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" onClick={handleCreateNewClientForProject} disabled={!detailNewClientName.trim() || !detailNewClientEmail.trim() || detailInvitingClient}>
                          {detailInvitingClient ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />} Invite Client
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setDetailShowNewClient(false); setDetailNewClientName(""); setDetailNewClientEmail(""); setDetailNewClientPhone(""); }}>
                          <X className="h-4 w-4 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Save as Template Dialog */}
        <Dialog open={showSaveTemplate} onOpenChange={(open) => { if (!open) setShowSaveTemplate(false); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save as Template</DialogTitle>
              <DialogDescription>
                Save this project&apos;s {stages.length} workflow {stages.length === 1 ? "stage" : "stages"} as a reusable template.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Template Name</Label><Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="e.g. Standard Build Process" /></div>
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Stages:</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  {stages.sort((a, b) => a.position - b.position).map((s) => (
                    <li key={s.id}>{s.name}</li>
                  ))}
                </ol>
              </div>
              <Button onClick={handleSaveAsTemplate} className="w-full" disabled={!templateName.trim() || savingTemplate}>
                {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {savingTemplate ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Project list view
  const filteredProjects = projects
    .filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q || p.name.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" ? true : statusFilter === "active-completed" ? p.status !== "archived" : p.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "newest": return (b.created_at || "").localeCompare(a.created_at || "");
        case "oldest": return (a.created_at || "").localeCompare(b.created_at || "");
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        default: return 0;
      }
    });

  return (
    <div className="p-4 max-w-4xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        {isAdmin && (
          <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" /> New Project</Button>
        )}
      </div>

      {projects.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-8" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active-completed">Active & Completed</SelectItem>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <ArrowUpDown className="h-4 w-4 mr-2" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredProjects.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground">
          {projects.length === 0 ? (isAdmin ? "No projects yet. Create your first one!" : "No projects assigned to you.") : "No projects match your search."}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredProjects.map((p) => (
            <Card key={p.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => selectProject(p)}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.name}</p>
                    {p.company_id && companyMap[p.company_id] && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> {companyMap[p.company_id]}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">Created {new Date(p.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2 w-32">
                      <div className="flex-1 bg-secondary rounded-full h-2">
                        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${projectProgress[p.id] ?? 0}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground font-medium">{projectProgress[p.id] ?? 0}%</span>
                    </div>
                    {projectSchedule[p.id] != null && (
                      <span className={`text-xs font-medium flex items-center gap-1 ${
                        projectSchedule[p.id]! < 0
                          ? "text-red-600 dark:text-red-400"
                          : projectSchedule[p.id]! === 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-green-600 dark:text-green-400"
                      }`}>
                        {projectSchedule[p.id]! < 0 ? (
                          <><AlertTriangle className="h-3 w-3" />{Math.abs(projectSchedule[p.id]!)}d behind</>
                        ) : projectSchedule[p.id]! === 0 ? (
                          <>On schedule</>
                        ) : (
                          <><TrendingUp className="h-3 w-3" />{projectSchedule[p.id]!}d ahead</>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.status === "archived" ? (
                      <Badge variant="outline"><Archive className="h-3 w-3 mr-1" />Archived</Badge>
                    ) : (
                      <Badge className={p.status === "completed" ? "bg-green-600 text-white hover:bg-green-700" : p.status === "active" ? "bg-blue-600 text-white hover:bg-blue-700" : ""} variant={p.status === "completed" || p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New project dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
            <DialogDescription>Create a new workflow project</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Project Name</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Custom Gear Assembly" /></div>
            <div className="border-t pt-3 mt-1">
              <p className="text-sm font-medium mb-2">Company & Clients</p>
              <div className="space-y-3">
                {/* Company Selection */}
                <div>
                  <Label>Company</Label>
                  <Select
                    value={selectedCompanyId || "__none__"}
                    onValueChange={(v) => {
                      if (v === "__new__") {
                        setShowNewCompany(true);
                        setSelectedCompanyId(null);
                      } else {
                        handleSelectCompany(v === "__none__" ? null : v, setSelectedCompanyId, setSelectedClientIds);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <Building2 className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Select a company..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No company</SelectItem>
                      {companies.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                      <SelectItem value="__new__">+ Create New Company</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Inline New Company Form */}
                {showNewCompany && (
                  <div className="space-y-3 border rounded-md p-3">
                    <div><Label>Company Name</Label><Input value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="e.g. Acme Corp" /></div>
                    <div><Label>Email (optional)</Label><Input type="email" value={newCompanyEmail} onChange={(e) => setNewCompanyEmail(e.target.value)} placeholder="e.g. info@acme.com" /></div>
                    <div><Label>Phone (optional)</Label><Input type="tel" value={newCompanyPhone} onChange={(e) => setNewCompanyPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
                    <div><Label>Address (optional)</Label><Input value={newCompanyAddress} onChange={(e) => setNewCompanyAddress(e.target.value)} placeholder="e.g. 123 Main St" /></div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => handleCreateNewCompany(setSelectedCompanyId, setSelectedClientIds)} disabled={!newCompanyName.trim() || creatingCompany}>
                        {creatingCompany ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Building2 className="h-4 w-4 mr-1" />} Create Company
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewCompany(false); setNewCompanyName(""); setNewCompanyEmail(""); setNewCompanyPhone(""); setNewCompanyAddress(""); }}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Clients Section */}
                {selectedClientIds.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selectedClientIds.map((cid) => {
                      const c = clientMembers.find((m) => m.user_id === cid);
                      if (!c) return null;
                      return (
                        <Badge key={cid} variant="secondary" className="flex items-center gap-1 py-1 px-2 text-sm">
                          {c.name}
                          <button type="button" onClick={() => setSelectedClientIds((prev) => prev.filter((id) => id !== cid))} className="ml-1 hover:text-destructive">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {(() => {
                  const available = clientMembers.filter((m) => !selectedClientIds.includes(m.user_id));
                  return available.length > 0 ? (
                    <Select value="" onValueChange={(v) => { if (v) setSelectedClientIds((prev) => [...prev, v]); }}>
                      <SelectTrigger><SelectValue placeholder="Add a client..." /></SelectTrigger>
                      <SelectContent>
                        {available.map((m) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.name}{m.company_name ? ` - ${m.company_name}` : ""}{m.email ? ` (${m.email})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : null;
                })()}
                {!showNewClient ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowNewClient(true)}>
                    <UserPlus className="h-4 w-4 mr-1" /> Add New Client
                  </Button>
                ) : (
                  <div className="space-y-3 border rounded-md p-3">
                    <div><Label>Client Name</Label><Input value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="e.g. John Smith" /></div>
                    <div><Label>Client Email</Label><Input type="email" value={newClientEmail} onChange={(e) => setNewClientEmail(e.target.value)} placeholder="e.g. john@example.com" /></div>
                    <div><Label>Client Phone (optional)</Label><Input type="tel" value={newClientPhone} onChange={(e) => setNewClientPhone(e.target.value)} placeholder="e.g. (555) 123-4567" /></div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={handleCreateNewClient} disabled={!newClientName.trim() || !newClientEmail.trim() || invitingClient}>
                        {invitingClient ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />} Invite Client
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setShowNewClient(false); setNewClientName(""); setNewClientEmail(""); setNewClientPhone(""); }}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {templates.length > 0 && (
              <div>
                <Label>Template (optional)</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger><SelectValue placeholder="Start from scratch" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name} ({t.stages.length} stages)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={handleCreate} className="w-full" disabled={!newName.trim()}>Create Project</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProjectsPageInner() {
  return (
    <div className="min-h-[100dvh] flex flex-col">
      <Navbar />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>}>
        <ProjectsList />
      </Suspense>
    </div>
  );
}

export default function ProjectsPage() {
  return <AuthGate><ProjectsPageInner /></AuthGate>;
}
