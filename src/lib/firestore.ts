import { db } from "./firebase";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc,
  query, where, Timestamp, setDoc,
} from "firebase/firestore";
import type { Project, WorkflowTemplate, Worker } from "./types";

const PREFIX = "wfz_";

// Projects
export async function getProjects(userId: string): Promise<Project[]> {
  const q = query(collection(db, PREFIX + "projects"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project));
}

export async function getProject(id: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, PREFIX + "projects", id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Project) : null;
}

export async function getProjectByToken(token: string): Promise<Project | null> {
  const q = query(collection(db, PREFIX + "projects"), where("shareToken", "==", token));
  const snap = await getDocs(q);
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Project);
}

export async function createProject(data: Omit<Project, "id">): Promise<string> {
  const ref = await addDoc(collection(db, PREFIX + "projects"), data);
  return ref.id;
}

export async function updateProject(id: string, data: Partial<Project>): Promise<void> {
  await updateDoc(doc(db, PREFIX + "projects", id), { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteProject(id: string): Promise<void> {
  await deleteDoc(doc(db, PREFIX + "projects", id));
}

// Templates
export async function getTemplates(userId: string): Promise<WorkflowTemplate[]> {
  const q = query(collection(db, PREFIX + "templates"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as WorkflowTemplate));
}

export async function createTemplate(data: Omit<WorkflowTemplate, "id">): Promise<string> {
  const ref = await addDoc(collection(db, PREFIX + "templates"), data);
  return ref.id;
}

export async function deleteTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, PREFIX + "templates", id));
}

// Workers
export async function getWorkers(userId: string): Promise<Worker[]> {
  const q = query(collection(db, PREFIX + "workers"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Worker));
}

export async function createWorker(data: Omit<Worker, "id">): Promise<string> {
  const ref = await addDoc(collection(db, PREFIX + "workers"), data);
  return ref.id;
}

export async function deleteWorker(id: string): Promise<void> {
  await deleteDoc(doc(db, PREFIX + "workers", id));
}
