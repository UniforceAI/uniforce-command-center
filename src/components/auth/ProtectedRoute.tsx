import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, profile, isLoading, error } = useAuth();

  // Still loading auth state
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

  // Not logged in
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Logged in but no profile/ISP linked
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
              const { useAuth } = await import("@/contexts/AuthContext");
              // Fallback: sign out via supabase directly
              const { supabase } = await import("@/integrations/supabase/client");
              await supabase.auth.signOut();
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

  return <>{children}</>;
}
