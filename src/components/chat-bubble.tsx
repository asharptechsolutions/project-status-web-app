"use client";
import { useEffect, useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  getProjectMessages, sendProjectMessage, sendFileMessage, deleteFileRecord, getProjectFiles, getMessageReadStatus, markMessagesRead, markFilesRead,
  registerDeviceKey, getMyKeyGrant, getProjectKeyGrants, getDeviceKeysForUsers, createKeyGrants, getMembers, getProjectClients,
} from "@/lib/data";
import {
  getOrCreateDeviceKey, getDeviceLabel, unwrapProjectKey, wrapProjectKey,
  encryptText, decryptText, encryptFile, decryptFileBytes, decryptFileMetadata,
  type DeviceKeyRecord,
} from "@/lib/crypto";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { ProjectMessage, ProjectFile, UserDeviceKey } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle, Send, Paperclip, X, Download, Trash2,
  File, FileText, Image, FileArchive, Loader2, FolderOpen, ArrowLeft,
  Lock, ShieldCheck, UserCheck,
} from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  if (contentType.includes("pdf")) return <FileText className="h-4 w-4 text-red-500" />;
  if (contentType.includes("zip") || contentType.includes("archive")) return <FileArchive className="h-4 w-4 text-yellow-500" />;
  return <File className="h-4 w-4 text-muted-foreground" />;
}

async function downloadFile(url: string, fileName: string) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  } catch {
    // Fallback: open in new tab if fetch fails (e.g. CORS)
    window.open(url, "_blank");
  }
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export interface ChatBubbleHandle {
  openFiles: () => void;
}

interface ChatBubbleProps {
  projectId: string;
  chatDisabled?: boolean;
  filesDisabled?: boolean;
  /** True end-to-end encryption: content is encrypted/decrypted in the browser */
  encryptionEnabled?: boolean;
  /** Team id — used to discover participant devices for key approvals */
  teamId?: string;
}

export const ChatBubble = forwardRef<ChatBubbleHandle, ChatBubbleProps>(function ChatBubble({ projectId, chatDisabled, filesDisabled, encryptionEnabled, teamId }, ref) {
  const { userId, user, isAdmin, isClient } = useAuth();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"chat" | "files">(chatDisabled ? "files" : "chat");
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  // E2EE state — the unwrapped project key lives only in memory
  const [keyStatus, setKeyStatus] = useState<"off" | "loading" | "ready" | "pending">(encryptionEnabled ? "loading" : "off");
  const projectKeyRef = useRef<CryptoKey | null>(null);
  const deviceRef = useRef<DeviceKeyRecord | null>(null);
  const [pendingDevices, setPendingDevices] = useState<UserDeviceKey[]>([]);
  const [pendingNames, setPendingNames] = useState<Record<string, string>>({});
  const [showPending, setShowPending] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    openFiles: () => { setOpen(true); setView("files"); },
  }));

  const chatRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasNearBottomRef = useRef(true);
  const prevProjectIdRef = useRef(projectId);

  // Track last-read timestamp from DB (persists across tabs/sessions)
  const lastReadAtRef = useRef<string | null | undefined>(undefined); // undefined = not fetched yet
  const openRef = useRef(open);
  openRef.current = open;

  // Decrypt encrypted content in-memory (ciphertext never renders)
  const decorateMessages = useCallback(async (msgs: ProjectMessage[]): Promise<ProjectMessage[]> => {
    const key = projectKeyRef.current;
    return Promise.all(msgs.map(async (m) => {
      let out = m;
      if (m.encrypted) {
        if (key && m.iv) {
          try {
            out = { ...out, content: await decryptText(key, m.content, m.iv) };
          } catch {
            out = { ...out, content: "" };
          }
        } else {
          out = { ...out, content: "" };
        }
      }
      if (m.file?.encrypted && key && m.file.encrypted_metadata) {
        try {
          const meta = await decryptFileMetadata(key, m.file.encrypted_metadata);
          out = { ...out, file: { ...m.file, file_name: meta.name, content_type: meta.type } };
        } catch { /* show as-is */ }
      }
      return out;
    }));
  }, []);

  const loadMessages = useCallback(async () => {
    try {
      const msgs = await decorateMessages(await getProjectMessages(projectId));
      setMessages(msgs);

      // First load: fetch last_read_at from DB
      if (lastReadAtRef.current === undefined && userId) {
        const lastRead = await getMessageReadStatus(userId, projectId);
        lastReadAtRef.current = lastRead; // null if never read before
      }

      if (!openRef.current && lastReadAtRef.current) {
        const unread = msgs.filter(
          (m) => new Date(m.created_at) > new Date(lastReadAtRef.current!)
        ).length;
        setUnreadCount(unread);
      } else if (!openRef.current && lastReadAtRef.current === null) {
        // First visit ever (no DB row) — show 0 unread
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, userId, decorateMessages]);

  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;

  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const f = await getProjectFiles(projectId);
      const key = projectKeyRef.current;
      const decorated = await Promise.all(f.map(async (file) => {
        if (file.encrypted && key && file.encrypted_metadata) {
          try {
            const meta = await decryptFileMetadata(key, file.encrypted_metadata);
            return { ...file, file_name: meta.name, content_type: meta.type };
          } catch { return file; }
        }
        return file;
      }));
      setFiles(decorated);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setFilesLoading(false);
    }
  }, [projectId]);

  // ----- E2EE key bootstrap -----
  const initKey = useCallback(async () => {
    if (!encryptionEnabled || !userId) return;
    try {
      const device = deviceRef.current ?? await getOrCreateDeviceKey();
      deviceRef.current = device;
      await registerDeviceKey(userId, device.deviceId, device.publicKeyJwk, getDeviceLabel());
      const grant = await getMyKeyGrant(projectId, userId, device.deviceId);
      if (grant) {
        projectKeyRef.current = await unwrapProjectKey(grant.wrapped_key, grant.ephemeral_public_key, device.privateKey);
        setKeyStatus("ready");
        loadMessagesRef.current();
      } else {
        projectKeyRef.current = null;
        setKeyStatus("pending");
      }
    } catch (err) {
      console.error("E2EE setup failed:", err);
      setKeyStatus("pending");
    }
  }, [encryptionEnabled, userId, projectId]);

  const initKeyRef = useRef(initKey);
  initKeyRef.current = initKey;

  useEffect(() => {
    if (encryptionEnabled) {
      setKeyStatus("loading");
      projectKeyRef.current = null;
      initKeyRef.current();
    } else {
      setKeyStatus("off");
      projectKeyRef.current = null;
    }
  }, [encryptionEnabled, projectId, userId]);

  // While waiting for approval, retry until a grant appears
  useEffect(() => {
    if (keyStatus !== "pending") return;
    const t = setInterval(() => initKeyRef.current(), 10000);
    return () => clearInterval(t);
  }, [keyStatus]);

  // ----- Pending device discovery (for key holders) -----
  const loadPendingDevices = useCallback(async () => {
    if (!projectKeyRef.current || !teamId) return;
    try {
      const [grants, members, clientIds] = await Promise.all([
        getProjectKeyGrants(projectId),
        getMembers(teamId).catch(() => []),
        getProjectClients(projectId).catch(() => [] as string[]),
      ]);
      const participantIds = new Set<string>([
        ...members.filter((m) => m.role !== "client").map((m) => m.user_id),
        ...clientIds,
      ]);
      const names: Record<string, string> = {};
      members.forEach((m) => { names[m.user_id] = m.name || m.email; });
      const keys = await getDeviceKeysForUsers([...participantIds]);
      const granted = new Set(grants.map((g) => `${g.user_id}:${g.device_id}`));
      setPendingNames(names);
      setPendingDevices(keys.filter((k) => !granted.has(`${k.user_id}:${k.device_id}`)));
    } catch (err) {
      console.error("Failed to load pending devices:", err);
    }
  }, [projectId, teamId]);

  useEffect(() => {
    if (!open || keyStatus !== "ready") return;
    loadPendingDevices();
    const t = setInterval(loadPendingDevices, 15000);
    return () => clearInterval(t);
  }, [open, keyStatus, loadPendingDevices]);

  const approveDevice = async (dk: UserDeviceKey) => {
    const key = projectKeyRef.current;
    if (!key || !userId) return;
    setApprovingId(dk.id);
    try {
      const { wrappedKey, ephemeralPublicKey } = await wrapProjectKey(key, dk.public_key);
      await createKeyGrants([{
        project_id: projectId,
        user_id: dk.user_id,
        device_id: dk.device_id,
        wrapped_key: wrappedKey,
        ephemeral_public_key: ephemeralPublicKey,
        granted_by: userId,
      }]);
      setPendingDevices((prev) => prev.filter((p) => p.id !== dk.id));
      toast.success("Device approved");
    } catch (err: any) {
      toast.error(err.message || "Failed to approve device");
    } finally {
      setApprovingId(null);
    }
  };

  // Load files when switching to files view
  useEffect(() => {
    if (view === "files") loadFiles();
  }, [view, loadFiles]);

  // Reset state when projectId changes
  useEffect(() => {
    if (projectId !== prevProjectIdRef.current) {
      prevProjectIdRef.current = projectId;
      lastReadAtRef.current = undefined; // re-fetch from DB
      setOpen(false);
      setView("chat");
      setMessages([]);
      setLoading(true);
      setUnreadCount(0);
      setText("");
      setStagedFile(null);
      setFiles([]);
      setPendingDevices([]);
      setShowPending(false);
    }
  }, [projectId]);

  // Initial load + realtime subscription + background poll as safety net
  useEffect(() => {
    loadMessagesRef.current();

    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `project_id=eq.${projectId}` },
        () => { loadMessagesRef.current(); }
      )
      .subscribe();

    // Always keep a background poll as safety net (covers realtime failures, tab throttling, etc.)
    const pollInterval = setInterval(() => loadMessagesRef.current(), 5000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [projectId]);

  // Mark all as read when opening the panel, and scroll to bottom
  useEffect(() => {
    if (open) {
      setUnreadCount(0);
      wasNearBottomRef.current = true;
      if (userId) {
        const now = new Date().toISOString();
        lastReadAtRef.current = now;
        markMessagesRead(userId, projectId).catch(console.error);
      }
      requestAnimationFrame(() => {
        if (chatRef.current) {
          chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
      });
    }
  }, [open, messages.length, userId, projectId]);

  // Mark files seen when the files view is open, so the dashboard's "new file"
  // indicator clears once the user has looked at them.
  useEffect(() => {
    if (open && view === "files" && userId && !filesDisabled) {
      markFilesRead(userId, projectId).catch(console.error);
    }
  }, [open, view, userId, projectId, filesDisabled, files.length]);

  // Auto-scroll to bottom when new messages arrive or panel opens
  useEffect(() => {
    if (!chatRef.current || !wasNearBottomRef.current) return;
    // Wait for DOM to render new messages before scrolling
    requestAnimationFrame(() => {
      if (chatRef.current) {
        chatRef.current.scrollTop = chatRef.current.scrollHeight;
      }
    });
  }, [messages.length, open]);

  const handleScroll = () => {
    if (!chatRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current;
    wasNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 80;
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if ((!trimmed && !stagedFile) || !userId) return;
    const encKey = encryptionEnabled ? projectKeyRef.current : null;
    if (encryptionEnabled && !encKey) {
      toast.error("Waiting for encryption access — ask your project manager to approve this device");
      return;
    }
    setSending(true);
    try {
      const senderName = user?.user_metadata?.full_name || user?.email || "Unknown";
      const sendText = async (content: string) => {
        if (encKey) {
          const { ciphertext, iv } = await encryptText(encKey, content);
          await sendProjectMessage({
            project_id: projectId,
            sender_id: userId,
            sender_name: senderName,
            content: ciphertext,
            file_id: null,
            iv,
            encrypted: true,
          });
        } else {
          await sendProjectMessage({
            project_id: projectId,
            sender_id: userId,
            sender_name: senderName,
            content,
            file_id: null,
          });
        }
      };
      if (stagedFile) {
        if (encKey) {
          const payload = await encryptFile(encKey, stagedFile);
          // window.File — the lucide `File` icon import shadows the DOM constructor
          const encFile = new window.File([payload.blob], "encrypted.bin", { type: "application/octet-stream" });
          await sendFileMessage(projectId, userId, senderName, encFile, {
            iv: payload.iv,
            encryptedMetadata: payload.encryptedMetadata,
          });
        } else {
          await sendFileMessage(projectId, userId, senderName, stagedFile);
        }
        setStagedFile(null);
        if (trimmed) await sendText(trimmed);
      } else {
        await sendText(trimmed);
      }
      setText("");
      wasNearBottomRef.current = true;
      await loadMessages();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  // Fetch ciphertext, decrypt in-memory, save with the real name
  const handleDownload = async (file: ProjectFile) => {
    if (!file.encrypted) {
      await downloadFile(file.file_url, file.file_name);
      return;
    }
    const key = projectKeyRef.current;
    if (!key || !file.iv) {
      toast.error("Waiting for encryption access to download this file");
      return;
    }
    try {
      const res = await fetch(file.file_url);
      const decrypted = await decryptFileBytes(key, await res.arrayBuffer(), file.iv);
      const blobUrl = URL.createObjectURL(new Blob([decrypted], { type: file.content_type || "application/octet-stream" }));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Failed to decrypt file");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Max 10MB.");
      return;
    }
    setStagedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteFile = async (msg: ProjectMessage) => {
    if (!msg.file) return;
    try {
      await deleteFileRecord(msg.file.id);
      setMessages((prev) =>
        prev.map((m) => m.id === msg.id ? { ...m, file: null, file_id: null } : m)
      );
      toast.success(`Deleted ${msg.file.file_name}`);
    } catch (err: any) {
      toast.error(err.message || "Delete failed");
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
      >
        {open ? (
          <X className="h-6 w-6" />
        ) : chatDisabled ? (
          <FolderOpen className="h-6 w-6" />
        ) : (
          <>
            <MessageCircle className="h-6 w-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1 text-xs font-bold bg-red-500 text-white rounded-full">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] sm:w-[380px] h-[500px] flex flex-col bg-background border rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              {view === "files" ? (
                <>
                  {!chatDisabled && (
                    <button onClick={() => setView("chat")} className="text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                  )}
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-sm">Files</h3>
                </>
              ) : (
                <>
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-sm">Messages</h3>
                  {encryptionEnabled && (
                    <span title="End-to-end encrypted">
                      <Lock className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                    </span>
                  )}
                  {messages.length > 0 && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{messages.length}</span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              {view === "chat" && keyStatus === "ready" && pendingDevices.length > 0 && (
                <button
                  onClick={() => setShowPending((v) => !v)}
                  className="relative text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted"
                  title="Approve new devices"
                >
                  <UserCheck className="h-4 w-4" />
                  <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                    {pendingDevices.length}
                  </span>
                </button>
              )}
              {view === "chat" && !filesDisabled && (
                <button onClick={() => setView("files")} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted" title="View Files">
                  <FolderOpen className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Pending device approvals (visible to key holders) */}
          {view === "chat" && showPending && pendingDevices.length > 0 && (
            <div className="border-b bg-muted/30 px-3 py-2 space-y-2 max-h-40 overflow-y-auto">
              <p className="text-xs font-medium flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" /> New devices waiting for access
              </p>
              {pendingDevices.map((dk) => (
                <div key={dk.id} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs truncate">{pendingNames[dk.user_id] || "Project member"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{dk.device_label || "Unknown device"}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => approveDevice(dk)} disabled={approvingId === dk.id}>
                    {approvingId === dk.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* This device is waiting for a key grant */}
          {view === "chat" && keyStatus === "pending" && (
            <div className="border-b bg-amber-500/10 px-3 py-2 text-xs flex items-start gap-2">
              <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <span>
                This chat is end-to-end encrypted. Waiting for access — ask your project manager to open the chat
                and approve this device.
              </span>
            </div>
          )}

          {/* Files view */}
          {view === "files" && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filesLoading ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading files...
                </div>
              ) : files.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  No files uploaded yet.
                </div>
              ) : (
                files.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors">
                    {getFileIcon(file.content_type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.file_name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownload(file)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {isAdmin && (
                        <button
                          onClick={async () => {
                            try {
                              await deleteFileRecord(file.id);
                              setFiles((prev) => prev.filter((f) => f.id !== file.id));
                              setMessages((prev) =>
                                prev.map((m) => m.file_id === file.id ? { ...m, file: null, file_id: null } : m)
                              );
                              toast.success(`Deleted ${file.file_name}`);
                            } catch (err: any) {
                              toast.error(err.message || "Delete failed");
                            }
                          }}
                          className="p-1.5 rounded hover:bg-muted text-destructive"
                          title="Delete file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Messages */}
          {view === "chat" && <div
            ref={chatRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-3 space-y-3"
          >
            {loading ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                No messages yet. Start the conversation!
              </div>
            ) : (
              messages.map((msg) => {
                const own = msg.sender_id === userId;
                const hasFile = msg.file_id && msg.file;
                const fileRemoved = msg.file_id && !msg.file;

                return (
                  <div key={msg.id} className={`flex flex-col ${own ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 ${
                        own ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {!own && (
                        <p className="text-xs font-medium mb-0.5 opacity-70">{msg.sender_name}</p>
                      )}

                      {/* File attachment card */}
                      {hasFile && msg.file && (
                        <div className={`flex items-center gap-2 rounded-md p-2 mb-1 ${
                          own ? "bg-primary-foreground/10" : "bg-background border"
                        }`}>
                          {getFileIcon(msg.file.content_type)}
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium truncate ${own ? "" : ""}`}>{msg.file.file_name}</p>
                            <p className={`text-[10px] ${own ? "opacity-70" : "text-muted-foreground"}`}>{formatFileSize(msg.file.file_size)}</p>
                          </div>
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => handleDownload(msg.file!)}
                              className={`p-1 rounded hover:bg-black/10 ${own ? "" : "text-muted-foreground hover:text-foreground"}`}
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteFile(msg)}
                                className={`p-1 rounded hover:bg-black/10 ${own ? "" : "text-destructive"}`}
                                title="Delete file"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* File removed notice */}
                      {fileRemoved && (
                        <p className={`text-xs italic mb-1 ${own ? "opacity-70" : "text-muted-foreground"}`}>
                          [file removed]
                        </p>
                      )}

                      {/* Text content */}
                      {msg.content && (
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      )}

                      {/* Encrypted content this device can't read yet */}
                      {msg.encrypted && !msg.content && (
                        <p className={`text-xs italic flex items-center gap-1 ${own ? "opacity-70" : "text-muted-foreground"}`}>
                          <Lock className="h-3 w-3 shrink-0" /> Encrypted message — access pending
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 px-1">
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>}

          {/* Staged file preview */}
          {view === "chat" && userId && stagedFile && (
            <div className="mx-3 mb-1 flex items-center gap-2 rounded-md border bg-muted/50 px-2 py-1.5">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs truncate flex-1">{stagedFile.name}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(stagedFile.size)}</span>
              <button onClick={() => setStagedFile(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Input row — only for logged-in users */}
          {view === "chat" && userId && <div className="flex items-center gap-2 px-3 py-2 border-t">
            {/* Clients can attach too, unless the org disabled file access for them */}
            {(!isClient || !filesDisabled) && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending}
                  title="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileSelect}
                  disabled={sending}
                />
              </>
            )}
            <Input
              placeholder={keyStatus === "pending" ? "Waiting for encryption access..." : "Type a message..."}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={sending || keyStatus === "pending"}
              className="h-8 text-sm"
            />
            <Button
              onClick={handleSend}
              disabled={sending || keyStatus === "pending" || (!text.trim() && !stagedFile)}
              size="icon"
              className="h-8 w-8 shrink-0"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>}
        </div>
      )}
    </>
  );
});
