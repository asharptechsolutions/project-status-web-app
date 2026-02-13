"use client";
import { useEffect, useState, useRef } from "react";
import { getProjectMessages, sendProjectMessage } from "@/lib/data";
import { useAuth } from "@/lib/auth-context";
import type { ProjectMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircle, Send, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ProjectChatProps {
  projectId: string;
}

export function ProjectChat({ projectId }: ProjectChatProps) {
  const { userId, member } = useAuth();
  const [messages, setMessages] = useState<ProjectMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    try {
      const msgs = await getProjectMessages(projectId);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    // Poll for new messages every 10 seconds
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [projectId]);

  useEffect(() => {
    if (chatContainerRef.current && messages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !userId || !member) return;
    setSending(true);
    try {
      await sendProjectMessage({
        project_id: projectId,
        sender_id: userId,
        sender_name: member.name,
        content: trimmed,
      });
      setText("");
      await loadMessages();
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Messages
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadMessages}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={chatContainerRef} className="h-64 overflow-y-auto border rounded-lg p-3 mb-3 space-y-3 bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">No messages yet. Start the conversation!</div>
          ) : (
            messages.map((msg) => {
              const own = msg.sender_id === userId;
              return (
                <div key={msg.id} className={`flex flex-col ${own ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] rounded-lg px-3 py-2 ${own ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                    {!own && <p className="text-xs font-medium mb-0.5 opacity-70">{msg.sender_name}</p>}
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-0.5 px-1">{formatTime(msg.created_at)}</span>
                </div>
              );
            })
          )}
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
