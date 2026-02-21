import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";
import type { User, Session } from "@supabase/supabase-js";

export interface AuthProfile {
  user_id: string;
  isp_id: string;
  isp_nome: string;
  instancia_isp: string;
  full_name: string;
  email: string;
  role: string;
}

export interface IspOption {
  isp_id: string;
  isp_nome: string;
  instancia_isp: string;
  description?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  isLoading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  selectedIsp: IspOption | null;
  availableIsps: IspOption[];
  selectIsp: (isp: IspOption) => void;
  clearSelectedIsp: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  error: null,
  isSuperAdmin: false,
  selectedIsp: null,
  availableIsps: [],
  selectIsp: () => {},
  clearSelectedIsp: () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Domínios super admin (veem todos os ISPs) */
const SUPER_ADMIN_DOMAINS = ["uniforce.com.br"];

/** Mapa estático de domínios → ISP info (fallback quando perfil não existe no banco) */
const DOMAIN_ISP_MAP: Record<string, { isp_id: string; isp_nome: string; instancia_isp: string }> = {
  "agytelecom.com.br": { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "agy" },
  "d-kiros.com.br": { isp_id: "d-kiros", isp_nome: "D-Kiros", instancia_isp: "dkiros" },
  "dkiros.com.br": { isp_id: "d-kiros", isp_nome: "D-Kiros", instancia_isp: "dkiros" },
  "uniforce.com.br": { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "agy" },
};

/** Lista de todos os ISPs disponíveis para super admins */
const ALL_ISPS: IspOption[] = [
  { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "agy", description: "Provedor de internet AGY Telecom" },
  { isp_id: "d-kiros", isp_nome: "D-Kiros", instancia_isp: "dkiros", description: "Provedor de internet D-Kiros" },
];

function isSuperAdminEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return SUPER_ADMIN_DOMAINS.includes(domain || "");
}

/**
 * Busca perfil do usuário no banco externo.
 * Se não existir, usa fallback estático por domínio.
 */
async function fetchUserProfile(userId: string, email: string): Promise<AuthProfile | null> {
  try {
    // Tentar buscar profile do banco externo
    const { data: dbProfile } = await externalSupabase
      .from("profiles")
      .select("id, isp_id, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (dbProfile && dbProfile.isp_id) {
      // Buscar info do ISP para obter nome e instância
      const { data: ispData } = await externalSupabase
        .from("isps")
        .select("isp_id, nome, instancia_isp")
        .eq("isp_id", dbProfile.isp_id)
        .maybeSingle();

      // Buscar role
      const { data: roleData } = await externalSupabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("isp_id", dbProfile.isp_id)
        .maybeSingle();

      return {
        user_id: userId,
        isp_id: dbProfile.isp_id,
        isp_nome: ispData?.nome || dbProfile.isp_id,
        instancia_isp: ispData?.instancia_isp || "",
        full_name: dbProfile.full_name || email.split("@")[0],
        email: dbProfile.email || email,
        role: isSuperAdminEmail(email) ? "super_admin" : (roleData?.role || "viewer"),
      };
    }
  } catch (err) {
    console.warn("⚠️ Erro ao buscar profile no banco externo, usando fallback:", err);
  }

  // Fallback: derivar do domínio do email
  const domain = email.split("@")[1]?.toLowerCase();
  const ispInfo = domain ? DOMAIN_ISP_MAP[domain] : null;

  if (ispInfo) {
    return {
      user_id: userId,
      isp_id: ispInfo.isp_id,
      isp_nome: ispInfo.isp_nome,
      instancia_isp: ispInfo.instancia_isp,
      full_name: email.split("@")[0],
      email: email,
      role: isSuperAdminEmail(email) ? "super_admin" : "viewer",
    };
  }

  console.warn("⚠️ Domínio não mapeado:", domain, "— email:", email);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIsp, setSelectedIsp] = useState<IspOption | null>(null);

  const isSuperAdmin = !!(user?.email && isSuperAdminEmail(user.email));

  const selectIsp = useCallback((isp: IspOption) => {
    setSelectedIsp(isp);
    sessionStorage.setItem("selected_isp", JSON.stringify(isp));
  }, []);

  const clearSelectedIsp = useCallback(() => {
    setSelectedIsp(null);
    sessionStorage.removeItem("selected_isp");
  }, []);

  useEffect(() => {
    // Escutar auth state do Supabase EXTERNO (backend oficial)
    const { data: { subscription } } = externalSupabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("🔐 Auth event (externo):", event);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setTimeout(async () => {
            try {
              const p = await fetchUserProfile(
                newSession.user.id,
                newSession.user.email || ""
              );
              setProfile(p);
              if (!p) {
                setError("Usuário não vinculado a um ISP. Entre em contato com o administrador.");
              } else {
                setError(null);
              }

              // Restore selected ISP from session for super admins
              const stored = sessionStorage.getItem("selected_isp");
              if (stored && isSuperAdminEmail(newSession.user.email || "")) {
                try {
                  setSelectedIsp(JSON.parse(stored));
                } catch {}
              }
            } catch (err: any) {
              console.error("❌ Erro fetchProfile:", err);
              setError("Erro ao carregar perfil do usuário.");
            } finally {
              setIsLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setError(null);
          setSelectedIsp(null);
          sessionStorage.removeItem("selected_isp");
          setIsLoading(false);
        }
      }
    );

    externalSupabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (!currentSession) {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await externalSupabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setError(null);
    setSelectedIsp(null);
    sessionStorage.removeItem("selected_isp");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        error,
        isSuperAdmin,
        selectedIsp,
        availableIsps: ALL_ISPS,
        selectIsp,
        clearSelectedIsp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
