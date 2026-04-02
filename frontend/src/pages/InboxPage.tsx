import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { conversationsApi } from "@/api";
import { formatDate, cn } from "@/lib/utils";
import { Send } from "lucide-react";

interface ConversationRow {
  id: string;
  leadName?: string;
  phoneNumber: string;
  unreadCount: number;
  lastMessageAt?: string;
  status: string;
}

interface Message {
  id: string;
  direction: string;
  content: string;
  timestamp: string;
  status: string;
}

export default function InboxPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const { data: conversations = [] } = useQuery<ConversationRow[]>({
    queryKey: ["conversations"],
    queryFn: conversationsApi.list,
    refetchInterval: 10_000,
  });

  const { data: thread } = useQuery({
    queryKey: ["conversation-thread", selected],
    queryFn: () => conversationsApi.getThread(selected!),
    enabled: Boolean(selected),
  });

  const queryClient = useQueryClient();
  const replyMutation = useMutation({
    mutationFn: () => conversationsApi.reply(selected!, reply),
    onSuccess: () => {
      setReply("");
      queryClient.invalidateQueries({ queryKey: ["conversation-thread", selected] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  return (
    <AppLayout title="Inbox">
      <div className="flex h-[calc(100vh-9rem)] gap-0 border rounded-lg overflow-hidden bg-card">
        {/* Conversation list */}
        <div className="w-80 border-r flex flex-col">
          <div className="p-3 border-b">
            <Input placeholder="Search conversations..." />
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.map((convo) => (
              <button
                key={convo.id}
                className={cn(
                  "w-full text-left p-4 border-b hover:bg-muted transition-colors",
                  selected === convo.id ? "bg-muted" : ""
                )}
                onClick={() => setSelected(convo.id)}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{convo.leadName ?? convo.phoneNumber}</p>
                  {(convo.unreadCount ?? 0) > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs rounded-full px-2">
                      {convo.unreadCount}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(convo.lastMessageAt)}
                </p>
              </button>
            ))}
            {conversations.length === 0 && (
              <p className="text-center text-muted-foreground text-sm p-8">No conversations yet</p>
            )}
          </div>
        </div>

        {/* Thread view */}
        <div className="flex-1 flex flex-col">
          {selected && thread ? (
            <>
              <div className="p-4 border-b">
                <p className="font-semibold">
                  {conversations.find((c) => c.id === selected)?.leadName ??
                    conversations.find((c) => c.id === selected)?.phoneNumber}
                </p>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(thread.messages as Message[]).map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-md rounded-lg p-3 text-sm",
                      msg.direction === "outbound"
                        ? "ml-auto bg-whatsapp text-white"
                        : "mr-auto bg-muted"
                    )}
                  >
                    <p>{msg.content ?? "[media message]"}</p>
                    <p className="text-xs opacity-70 mt-1 text-right">{formatDate(msg.timestamp)}</p>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t flex gap-2">
                <Input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type a message..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && reply.trim()) {
                      e.preventDefault();
                      replyMutation.mutate();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={() => replyMutation.mutate()}
                  disabled={!reply.trim() || replyMutation.isPending}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Select a conversation to view messages
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
