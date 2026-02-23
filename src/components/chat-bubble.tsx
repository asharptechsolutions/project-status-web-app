"use client";
import { useEffect, useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { getProjectMessages, sendProjectMessage, sendFileMessage, deleteFileRecord, getProjectFiles, getMessageReadStatus, markMessagesRead } from "@/lib/data";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import type { ProjectMessage, ProjectFile } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle, Send, Paperclip, X, Download, Trash2,
  File, FileText, Image, FileArchive, Loader2, FolderOpen, ArrowLeft,
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
}

export const ChatBubble = forwardRef<ChatBubbleHandle, ChatBubbleProps>(function ChatBubble({ projectId, chatDisabled, filesDisabled }, ref) {
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

  const loadMessages = useCallback(async () => {
    try {
      const msgs = await getProjectMessages(projectId);
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
  }, [projectId, userId]);

  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;

  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const f = await getProjectFiles(projectId);
      setFiles(f);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setFilesLoading(false);
    }
  }, [projectId]);

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
    setSending(true);
    try {
      const senderName = user?.user_metadata?.full_name || user?.email || "Unknown";
      if (stagedFile) {
        await sendFileMessage(projectId, userId, senderName, stagedFile);
        setStagedFile(null);
        if (trimmed) {
          await sendProjectMessage({
            project_id: projectId,
            sender_id: userId,
            sender_name: senderName,
            content: trimmed,
            file_id: null,
          });
        }
      } else {
        await sendProjectMessage({
          project_id: projectId,
          sender_id: userId,
          sender_name: senderName,
          content: trimmed,
          file_id: null,
        });
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
                  {messages.length > 0 && (
                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{messages.length}</span>
                  )}
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
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
                        onClick={() => downloadFile(file.file_url, file.file_name)}
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
                              onClick={() => downloadFile(msg.file!.file_url, msg.file!.file_name)}
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
            {!isClient && (
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
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              disabled={sending}
              className="h-8 text-sm"
            />
            <Button
              onClick={handleSend}
              disabled={sending || (!text.trim() && !stagedFile)}
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
