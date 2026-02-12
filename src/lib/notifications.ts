import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";
import type { Project, WorkflowNode } from "./types";
import basePath from "./base-path";

const PREFIX = "wfz_";

export async function notifyStageChange(
  project: Project,
  node: WorkflowNode,
  newStatus: WorkflowNode["status"],
  projectCompleted: boolean
) {
  // Only send if project has a client email
  if (!project.clientEmail) return;

  try {
    const trackUrl = typeof window !== "undefined"
      ? `${window.location.origin}${basePath}/track/?id=${project.id}`
      : undefined;

    await addDoc(collection(db, PREFIX + "notifications"), {
      projectId: project.id,
      projectName: project.name,
      clientName: project.clientName,
      clientEmail: project.clientEmail,
      stageName: node.label,
      stageStatus: newStatus,
      projectCompleted,
      trackUrl,
      userId: project.userId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Don't block the UI if notification fails
    console.error("Failed to queue notification:", error);
  }
}
