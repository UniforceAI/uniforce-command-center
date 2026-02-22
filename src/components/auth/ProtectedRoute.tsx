import { ReactNode, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import uniconIcon from "@/assets/uniforce-icon.png";

interface ProtectedRouteProps {
  children: ReactNode;
  requireSelectedIsp?: boolean;
}

export function ProtectedRoute({ children, requireSelectedIsp = true }: ProtectedRouteProps) {
  const { user, profile, isLoading, error, isSuperAdmin, selectedIsp, signOut } = useAuth();
  const [showEscape, setShowEscape] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => setShowEscape(true), 5000);
      return () => clearTimeout(timer);
    }
    setShowEscape(false);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    const interval = setInterval(() => {
      setProgress((p) => (p >= 95 ? 95 : p + Math.random() * 3 + 0.5));
    }, 250);
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleForceLogout = async () => {
    localStorage.removeItem("uniforce-auth");
    sessionStorage.removeItem("uniforce_selected_isp");
    try { await signOut(); } catch {}
    window.location.href = "/auth";
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
        {/* Dark background matching InitialLoadingScreen */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, hsl(213 81% 54% / 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, hsl(126 91% 65% / 0.1) 0%, transparent 50%), hsl(210 100% 6%)",
          }}
        />

        {/* Animated gradient orbs */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
          style={{
            background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(126 91% 65%))",
            animation: "float-auth 8s ease-in-out infinite",
            top: "10%",
            left: "-10%",
          }}
        />
        <div
          className="absolute w-[400px] h-[400px] rounded-full opacity-15 blur-[100px]"
          style={{
            background: "linear-gradient(225deg, hsl(126 91% 65%), hsl(213 81% 54%))",
            animation: "float-auth 10s ease-in-out infinite reverse",
            bottom: "5%",
            right: "-5%",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-md text-center">
          {/* Logo with glow */}
          <div className="relative mb-10">
            <div
              className="absolute inset-0 rounded-full blur-2xl opacity-40"
              style={{
                background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(126 91% 65%))",
                transform: "scale(2.5)",
                animation: "pulse-auth 3s ease-in-out infinite",
              }}
            />
            <img
              src={uniconIcon}
              alt="Uniforce"
              className="h-16 w-16 relative z-10"
              style={{ filter: "drop-shadow(0 0 30px hsl(213 81% 54% / 0.5))" }}
            />
          </div>

          <h2
            className="text-xl font-semibold mb-2"
            style={{
              background: "linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(213 81% 74%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Verificando autenticação...
          </h2>

          {/* Progress bar */}
          <div className="w-48 mt-6">
            <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, hsl(213 81% 54%), hsl(126 91% 65%))",
                }}
              />
            </div>
          </div>

          {showEscape && (
            <div className="mt-8 space-y-3">
              <p className="text-sm text-white/40">Demorando mais que o esperado?</p>
              <button
                onClick={handleForceLogout}
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: "linear-gradient(135deg, hsl(0 72% 51%), hsl(0 72% 41%))",
                  color: "white",
                  boxShadow: "0 4px 15px hsl(0 72% 51% / 0.3)",
                }}
              >
                Limpar sessão e voltar ao login
              </button>
            </div>
          )}
        </div>

        <style>{`
          @keyframes float-auth {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(30px, -20px) scale(1.05); }
            66% { transform: translate(-20px, 20px) scale(0.95); }
          }
          @keyframes pulse-auth {
            0%, 100% { opacity: 0.3; transform: scale(2.5); }
            50% { opacity: 0.5; transform: scale(3); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (error || !profile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, hsl(213 81% 54% / 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, hsl(126 91% 65% / 0.1) 0%, transparent 50%), hsl(210 100% 6%)",
          }}
        />
        <div className="relative z-10 flex flex-col items-center justify-center px-8 max-w-md text-center">
          <div className="text-6xl mb-6">🔒</div>
          <h2
            className="text-xl font-bold mb-3"
            style={{
              background: "linear-gradient(135deg, hsl(0 0% 100%) 0%, hsl(213 81% 74%) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Acesso não autorizado
          </h2>
          <p className="text-white/50 text-sm mb-6">
            {error || "Usuário não vinculado a um ISP. Entre em contato com o administrador."}
          </p>
          <button
            onClick={handleForceLogout}
            className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: "linear-gradient(135deg, hsl(213 81% 54%), hsl(126 91% 65%))",
              color: "white",
              boxShadow: "0 4px 15px hsl(213 81% 54% / 0.3)",
            }}
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  if (requireSelectedIsp && isSuperAdmin && !selectedIsp) {
    return <Navigate to="/selecionar-cliente" replace />;
  }

  return <>{children}</>;
}
