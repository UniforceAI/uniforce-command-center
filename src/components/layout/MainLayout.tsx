import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useInitialImportStatus } from "@/hooks/useInitialImportStatus";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { DataImportOverlay } from "@/components/shared/DataImportOverlay";

// Rotas de dados que mostram o overlay durante importação inicial
const DATA_ROUTES = [
  "/visao-geral",
  "/financeiro",
  "/chamados",
  "/crm",
  "/cancelamentos",
  "/nps",
  "/churn-analytics",
  "/churn-retencao",
];

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const location = useLocation();
  const { ispNome, instanciaIsp } = useActiveIsp();
  const { data: importData } = useInitialImportStatus();

  const isDataRoute = DATA_ROUTES.some((r) => location.pathname.startsWith(r));
  const showOverlay =
    isDataRoute &&
    importData !== undefined &&
    importData.status !== "complete";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-auto">
          <main className="flex-1">{children}</main>
          <footer className="border-t border-border/50 py-3 px-6 text-center bg-gray-100">
            <p className="text-[11px] text-muted-foreground">
              2026 © Uniforce - v1.1 Beta
            </p>
          </footer>
        </div>
      </div>
      {showOverlay && (
        <DataImportOverlay
          ispNome={ispNome}
          instanciaIsp={instanciaIsp}
          totalRecords={importData.totalRecords}
        />
      )}
    </SidebarProvider>
  );
}