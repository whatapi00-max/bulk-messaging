import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
}

export function AppLayout({ children, title = "Billy777 Bulk Messaging" }: AppLayoutProps) {
  return (
    <div className="h-screen bg-background flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-0">
        <TopBar title={title} />
        <main className="flex-1 min-h-0 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
