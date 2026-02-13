"use client";
import { useEffect, useState, useRef } from "react";
import { onProjectMessages, sendProjectMessage } from "@/lib/firestore";
import type { ProjectMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";

interface ProjectChatProps {
  projectId: string;
  senderEmail: string;
  senderName: string;
  senderRole: "manager" | "client";
}

export function ProjectChat({ projectId, senderEmail, senderName, senderRole }: ProjectChatProps) {
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = onProjectMessages(projectId, (msgs) => {
      setMessages(msgs);
      setLoading(false);
    });
    return unsub;
  }, [projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendProjectMessage({
        projectId,
        senderEmail: senderEmail.toLowerCase().trim(),
        senderName,
        senderRole,
        text: trimmed,
        createdAt: new Date().toISOString(),
      });
      setText("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const isOwnMessage = (msg: ProjectMessage) =>
    msg.senderEmail.toLowerCase() === senderEmail.toLowerCase();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Messages
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 overflow-y-auto border rounded-lg p-3 mb-3 space-y-3 bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              Loading messages...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages.map((msg) => {
              const own = isOwnMessage(msg);
              return (
                <div key={msg.id} className={`flex flex-col ${own ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${own ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                    {!own && (
                      <p className="text-xs font-medium mb-0.5 opacity-70">
                        {msg.senderName}
                        {msg.senderRole === "manager" && " (PM)"}
                      </p>
                    )}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{formatTime(msg.createdAt)}</span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !text.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
