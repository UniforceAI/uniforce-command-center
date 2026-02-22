import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-auto">
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border/50 bg-card/50 py-3 px-6 text-center">
            <p className="text-[11px] text-muted-foreground">
              2026 © Uniforce - v1.1 Beta
            </p>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
}
