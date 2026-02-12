import { db } from "./firebase";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc,
  query, where, Timestamp, setDoc,
} from "firebase/firestore";
import type { Project, WorkflowTemplate, Worker } from "./types";

const PREFIX = "wfz_";

function handleFirestoreError(operation: string, error: unknown): never {
  const err = error as { code?: string; message?: string };
  const code = err.code || "unknown";
  let message: string;

  switch (code) {
    case "permission-denied":
      message = "You don't have permission to perform this action. Please sign in again.";
      break;
    case "not-found":
      message = "The requested item was not found. It may have been deleted.";
      break;
    case "unavailable":
      message = "Service is temporarily unavailable. Please try again in a moment.";
      break;
    case "unauthenticated":
      message = "Your session has expired. Please sign in again.";
      break;
    case "resource-exhausted":
      message = "Too many requests. Please wait a moment and try again.";
      break;
    default:
      message = `Something went wrong while ${operation}. Please try again.`;
  }

  console.error(`Firestore error [${operation}]:`, code, err.message);
  throw new Error(message);
}

// Projects
export async function getProjects(userId: string): Promise<Project[]> {
  try {
    const q = query(collection(db, PREFIX + "projects"), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
  } catch (error) {
    handleFirestoreError("loading projects", error);
  }
}

export async function getProject(id: string): Promise<Project | null> {
  try {
    const snap = await getDoc(doc(db, PREFIX + "projects", id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as Project) : null;
  } catch (error) {
    handleFirestoreError("loading project", error);
  }
}

export async function getProjectByToken(token: string): Promise<Project | null> {
  try {
    const q = query(collection(db, PREFIX + "projects"), where("shareToken", "==", token));
    const snap = await getDocs(q);
    return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Project);
  } catch (error) {
    handleFirestoreError("loading shared project", error);
  }
}

export async function createProject(data: Omit<Project, "id">): Promise<string> {
  try {
    const ref = await addDoc(collection(db, PREFIX + "projects"), data);
    return ref.id;
  } catch (error) {
    handleFirestoreError("creating project", error);
  }
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  try {
    await updateDoc(doc(db, PREFIX + "projects", id), { ...data, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError("updating project", error);
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PREFIX + "projects", id));
  } catch (error) {
    handleFirestoreError("deleting project", error);
  }
}

// Templates
export async function getTemplates(userId: string): Promise<WorkflowTemplate[]> {
  try {
    const q = query(collection(db, PREFIX + "templates"), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkflowTemplate));
  } catch (error) {
    handleFirestoreError("loading templates", error);
  }
}

export async function createTemplate(data: Omit<WorkflowTemplate, "id">): Promise<string> {
  try {
    const ref = await addDoc(collection(db, PREFIX + "templates"), data);
    return ref.id;
  } catch (error) {
    handleFirestoreError("creating template", error);
  }
}

export async function deleteTemplate(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PREFIX + "templates", id));
  } catch (error) {
    handleFirestoreError("deleting template", error);
  }
}

// Workers
export async function getWorkers(userId: string): Promise<Worker[]> {
  try {
    const q = query(collection(db, PREFIX + "workers"), where("userId", "==", userId));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Worker));
  } catch (error) {
    handleFirestoreError("loading workers", error);
  }
}

export async function createWorker(data: Omit<Worker, "id">): Promise<string> {
  try {
    const ref = await addDoc(collection(db, PREFIX + "workers"), data);
    return ref.id;
  } catch (error) {
    handleFirestoreError("creating worker", error);
  }
}

export async function updateWorker(id: string, data: Partial<Omit<Worker, "id">>): Promise<void> {
  try {
    await updateDoc(doc(db, PREFIX + "workers", id), data);
  } catch (error) {
    handleFirestoreError("updating worker", error);
  }
}

export async function deleteWorker(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, PREFIX + "workers", id));
  } catch (error) {
    handleFirestoreError("deleting worker", error);
  }
}
