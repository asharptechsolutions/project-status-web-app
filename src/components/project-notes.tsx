"use client";
import { useEffect, useState } from "react";
import { getProjectNotes, addProjectNote, deleteProjectNote } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import type { ProjectNote } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StickyNote, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProjectNotesProps {
  projectId: string;
}

export function ProjectNotes({ projectId }: ProjectNotesProps) {
  const { userId, user, member, isAdmin, isWorker, isClient } = useAuth();
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [content, setContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  // Hidden from clients
  if (isClient) return null;

  const loadNotes = async () => {
    try {
      const data = await getProjectNotes(projectId);
      setNotes(data);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [projectId]);

  const handleAdd = async () => {
    const trimmed = content.trim();
    if (!trimmed || !userId || !member) return;
    setAdding(true);
    try {
      await addProjectNote({
        project_id: projectId,
        author_id: userId,
        author_name: member.name || user?.email || "Unknown",
        content: trimmed,
      });
      setContent("");
      await loadNotes();
    } catch (err: any) {
      toast.error(err.message || "Failed to add note");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    try {
      await deleteProjectNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success("Note deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete note");
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return "Today at " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) + " at " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-5 w-5" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Add note form (admin only) */}
        {isAdmin && (
          <div className="mb-4 space-y-2">
            <Textarea
              placeholder="Add a note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={2}
              disabled={adding}
            />
            <Button
              onClick={handleAdd}
              disabled={adding || !content.trim()}
              size="sm"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Note
            </Button>
          </div>
        )}

        {/* Notes list */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading notes...</p>
          ) : notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>
          ) : (
            notes.map((note) => (
              <div key={note.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm whitespace-pre-wrap break-words">{note.content}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {note.author_name} &middot; {formatTime(note.created_at)}
                    </p>
                  </div>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(note.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
