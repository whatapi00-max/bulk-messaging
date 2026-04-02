import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getSocket } from "@/lib/socket";
import {
  APP_NOTIFY_EVENT,
  clearStoredNotifications,
  loadStoredNotifications,
  saveStoredNotifications,
  type AppNotificationPayload,
} from "@/lib/notifications";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  kind: "success" | "warning" | "error" | "info";
  createdAt: number;
  read: boolean;
}

interface TopBarProps {
  title: string;
}

export function TopBar({ title }: TopBarProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => loadStoredNotifications());
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveStoredNotifications(notifications);
  }, [notifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const currentUserEmail = user?.email?.trim() || "Unknown User";

    const withActor = (description: string, actor: string) => {
      if (description.includes("Changed By:")) {
        return description;
      }
      return `${description}\nChanged By: ${actor}`;
    };

    const pushNotification = (item: Omit<NotificationItem, "id" | "createdAt" | "read">) => {
      const next: NotificationItem = {
        ...item,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: Date.now(),
        read: false,
      };

      setNotifications((current) => [next, ...current].slice(0, 25));

      if (document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification(item.title, { body: item.description });
      }
    };

    const onAppNotification = (event: Event) => {
      const detail = (event as CustomEvent<AppNotificationPayload>).detail;
      pushNotification({
        title: detail.title,
        description: withActor(detail.description, currentUserEmail),
        kind: detail.kind ?? "info",
      });
    };

    const onCampaignProgress = (payload: { status?: string; phoneNumber?: string; errorMessage?: string }) => {
      if (payload.status === "sent") {
        pushNotification({
          title: "Message Sent",
          description: withActor(`Sent message to ${payload.phoneNumber ?? "recipient"}.`, "System"),
          kind: "success",
        });
        return;
      }

      if (payload.status === "failed") {
        pushNotification({
          title: "Message Failed",
          description: withActor(payload.errorMessage ?? `Failed sending to ${payload.phoneNumber ?? "recipient"}.`, "System"),
          kind: "error",
        });
      }
    };

    const onCampaignFailover = (payload: { phoneNumber?: string }) => {
      pushNotification({
        title: "Number Failover",
        description: withActor(`Message to ${payload.phoneNumber ?? "recipient"} was moved to another number.`, "System"),
        kind: "warning",
      });
    };

    const onMessageStatus = (payload: { status?: string }) => {
      pushNotification({
        title: "Message Status Updated",
        description: withActor(`Status changed to ${payload.status ?? "updated"}.`, "System"),
        kind: "info",
      });
    };

    const onConversationMessage = (payload: { message?: { content?: string; phoneNumber?: string } }) => {
      pushNotification({
        title: "New Incoming Message",
        description: withActor(payload.message?.content ?? "You received a new message.", "System"),
        kind: "info",
      });
    };

    socket.on("campaign:progress", onCampaignProgress);
    socket.on("campaign:failover", onCampaignFailover);
    socket.on("message:status", onMessageStatus);
    socket.on("conversation:new-message", onConversationMessage);
    window.addEventListener(APP_NOTIFY_EVENT, onAppNotification as EventListener);

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }

    return () => {
      socket.off("campaign:progress", onCampaignProgress);
      socket.off("campaign:failover", onCampaignFailover);
      socket.off("message:status", onMessageStatus);
      socket.off("conversation:new-message", onConversationMessage);
      window.removeEventListener(APP_NOTIFY_EVENT, onAppNotification as EventListener);
    };
  }, [user?.email]);

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const openNotifications = () => {
    setIsOpen((current) => !current);
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6 relative">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="relative" ref={panelRef}>
          <Button variant="ghost" size="icon" onClick={openNotifications} className="relative">
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-5 h-5 rounded-full bg-red-500 px-1 text-[10px] text-white flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>

          {isOpen && (
            <div className="absolute right-0 top-12 z-50 w-96 rounded-lg border bg-card shadow-lg">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <p className="font-semibold text-sm">Notifications</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setNotifications([]);
                    clearStoredNotifications();
                  }}
                >
                  Clear
                </Button>
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No notifications yet.</div>
                ) : (
                  notifications.map((item) => (
                    <div key={item.id} className="border-b px-4 py-3 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{item.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground break-words whitespace-pre-line">{item.description}</p>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            {new Date(item.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            item.kind === "success"
                              ? "success"
                              : item.kind === "warning"
                              ? "warning"
                              : item.kind === "error"
                              ? "destructive"
                              : "outline"
                          }
                        >
                          {item.kind}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">{user?.email}</span>
        </div>
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
