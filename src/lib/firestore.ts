import { db } from "./firebase";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, getDocs, getDoc,
  query, where, Timestamp, setDoc, orderBy, limit,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "./firebase";
import type { Project, WorkflowTemplate, Worker, ProjectContact, ProjectFile } from "./types";

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

export async function updateTemplate(id: string, data: Partial<Omit<WorkflowTemplate, "id">>): Promise<void> {
  try {
    await updateDoc(doc(db, PREFIX + "templates", id), data);
  } catch (error) {
    handleFirestoreError("updating template", error);
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

// Access Codes for contact verification
export async function createAccessCode(email: string): Promise<void> {
  try {
    const { httpsCallable } = await import("firebase/functions");
    const { functions } = await import("./firebase");
    const sendCode = httpsCallable(functions, "sendVerificationCode");
    await sendCode({ email: email.toLowerCase().trim() });
  } catch (error: unknown) {
    // If Cloud Function is not deployed yet, fall back to local code generation
    if (error instanceof Error && (error.message.includes("not-found") || error.message.includes("INTERNAL"))) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await addDoc(collection(db, PREFIX + "access_codes"), {
        email: email.toLowerCase().trim(),
        code,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        used: false,
      });
      // Store code in sessionStorage so the UI can show it as fallback
      sessionStorage.setItem("wfz_fallback_code", code);
      return;
    }
    handleFirestoreError("sending verification code", error);
  }
}

export async function verifyAccessCode(email: string, code: string): Promise<boolean> {
  try {
    const q = query(
      collection(db, PREFIX + "access_codes"),
      where("email", "==", email.toLowerCase().trim()),
      where("code", "==", code),
      where("used", "==", false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return false;
    // Check expiry
    const data = snap.docs[0].data();
    if (new Date(data.expiresAt) < new Date()) return false;
    // Mark as used
    await updateDoc(snap.docs[0].ref, { used: true });
    return true;
  } catch (error) {
    handleFirestoreError("verifying access code", error);
  }
}

export async function getProjectsForContact(email: string): Promise<Project[]> {
  try {
    // Get all non-archived projects and filter by contacts array client-side
    // (Firestore doesn't support array-contains on nested object fields easily)
    const q = query(collection(db, PREFIX + "projects"));
    const snap = await getDocs(q);
    const normalizedEmail = email.toLowerCase().trim();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Project))
      .filter((p) => {
        const contacts = p.contacts || [];
        return contacts.some((c) => c.email.toLowerCase().trim() === normalizedEmail);
      });
  } catch (error) {
    handleFirestoreError("loading contact projects", error);
  }
}

// Send verification email via notifications collection (processed by Cloud Functions)
// NOTE: Email delivery not yet configured — code is shown directly to user for now
export async function sendAccessCodeEmail(email: string, code: string): Promise<void> {
  // No-op until Cloud Functions are set up for email delivery
  return;
}

// Project Files
export async function uploadProjectFile(
  projectId: string,
  file: File,
  uploadedBy: string
): Promise<ProjectFile> {
  try {
    const fileId = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const storageRef = ref(storage, `wfz_files/${projectId}/${fileId}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    const downloadUrl = await getDownloadURL(storageRef);

    const fileDoc: Omit<ProjectFile, "id"> = {
      projectId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type,
      downloadUrl,
      uploadedBy: uploadedBy.toLowerCase().trim(),
      uploadedAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, PREFIX + "files"), fileDoc);
    return { id: docRef.id, ...fileDoc };
  } catch (error) {
    handleFirestoreError("uploading file", error);
  }
}

export async function getProjectFiles(projectId: string): Promise<ProjectFile[]> {
  try {
    const q = query(
      collection(db, PREFIX + "files"),
      where("projectId", "==", projectId),
      orderBy("uploadedAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectFile));
  } catch (error) {
    handleFirestoreError("loading files", error);
  }
}

export async function deleteProjectFile(fileId: string, projectId: string, fileName: string): Promise<void> {
  try {
    // Delete from Storage
    const storageRef = ref(storage, `wfz_files/${projectId}/${fileName}`);
    try {
      await deleteObject(storageRef);
    } catch {
      // File may already be deleted from storage, continue
    }
    // Delete metadata from Firestore
    await deleteDoc(doc(db, PREFIX + "files", fileId));
  } catch (error) {
    handleFirestoreError("deleting file", error);
  }
}
