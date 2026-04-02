import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  MessageCircle,
  Phone,
  Users,
  Megaphone,
  FileX,
  Settings,
  FileText,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Megaphone, label: "Campaigns", href: "/campaigns" },
  { icon: Phone, label: "Numbers", href: "/numbers" },
  { icon: Users, label: "Leads", href: "/leads" },
  { icon: FileText, label: "Templates", href: "/templates" },
  { icon: MessageCircle, label: "Inbox", href: "/inbox" },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
  { icon: FileX, label: "Failed", href: "/failed" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b">
        <div className="w-8 h-8 rounded-lg bg-whatsapp flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm">Billy777</p>
          <p className="text-xs text-muted-foreground">Bulk Messaging</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.href ||
            (item.href !== "/" && location.pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
