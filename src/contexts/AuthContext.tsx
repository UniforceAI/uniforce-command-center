import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: AuthProfile | null;
  isLoading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  error: null,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/**
 * Busca o perfil completo do usuário no banco externo:
 * 1. profiles → isp_id, full_name
 * 2. isps → isp_nome, instancia_isp
 * 3. user_roles → role
 */
/**
 * Mapa estático de domínios → ISP info (mesmo do authUtils).
 * Usado como fallback quando o profile externo não existe.
 */
const DOMAIN_ISP_MAP: Record<string, { isp_id: string; isp_nome: string; instancia_isp: string }> = {
  "agytelecom.com.br": { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "agy" },
  "d-kiros.com.br": { isp_id: "d-kiros", isp_nome: "D-Kiros", instancia_isp: "dkiros" },
  "dkiros.com.br": { isp_id: "d-kiros", isp_nome: "D-Kiros", instancia_isp: "dkiros" },
  "uniforce.com.br": { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "agy" },
};

async function fetchUserProfile(userId: string, email: string): Promise<AuthProfile | null> {
  // 1. Tentar buscar profile no banco externo
  const { data: profile } = await externalSupabase
    .from("profiles")
    .select("id, isp_id, full_name, email")
    .eq("id", userId)
    .maybeSingle();

  // 2. Se profile existe E tem isp_id, buscar ISP e role
  if (profile?.isp_id) {
    const { data: isp } = await externalSupabase
      .from("isps")
      .select("isp_id, isp_nome, instancia_isp")
      .eq("isp_id", profile.isp_id)
      .maybeSingle();

    const { data: roleData } = await externalSupabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("isp_id", profile.isp_id)
      .maybeSingle();

    if (isp) {
      return {
        user_id: userId,
        isp_id: isp.isp_id,
        isp_nome: isp.isp_nome,
        instancia_isp: isp.instancia_isp,
        full_name: profile.full_name || email,
        email: profile.email || email,
        role: roleData?.role || "viewer",
      };
    }
  }

  // 3. Fallback: derivar ISP do domínio do email
  const domain = email.split("@")[1]?.toLowerCase();
  const ispInfo = domain ? DOMAIN_ISP_MAP[domain] : null;

  if (ispInfo) {
    return {
      user_id: userId,
      isp_id: ispInfo.isp_id,
      isp_nome: ispInfo.isp_nome,
      instancia_isp: ispInfo.instancia_isp,
      full_name: profile?.full_name || email.split("@")[0],
      email: email,
      role: "admin", // fallback for known domains
    };
  }

  console.warn("⚠️ Nenhum ISP encontrado para:", email);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // IMPORTANT: Set up listener BEFORE getSession
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log("🔐 Auth event:", event);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Defer profile fetch to avoid Supabase deadlock
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
          setIsLoading(false);
        }
      }
    );

    // Then check current session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (!currentSession) {
        setIsLoading(false);
      }
      // Profile will be loaded by onAuthStateChange
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setError(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isLoading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
