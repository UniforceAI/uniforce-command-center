import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  requireSelectedIsp?: boolean;
}

export function ProtectedRoute({ children, requireSelectedIsp = true }: ProtectedRouteProps) {
  const { user, profile, isLoading, error, isSuperAdmin, selectedIsp, signOut } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-6xl">🔒</div>
          <h2 className="text-xl font-bold text-foreground">Acesso não autorizado</h2>
          <p className="text-muted-foreground">
            {error || "Usuário não vinculado a um ISP. Entre em contato com o administrador."}
          </p>
          <button
            onClick={async () => {
              await signOut();
              window.location.href = "/auth";
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  // Super admins must select an ISP before accessing dashboard
  if (requireSelectedIsp && isSuperAdmin && !selectedIsp) {
    return <Navigate to="/selecionar-cliente" replace />;
  }

  return <>{children}</>;
}
