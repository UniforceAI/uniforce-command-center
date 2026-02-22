import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";
import type { User, Session } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

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
  refreshProfile: () => Promise<void>;
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
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const SUPER_ADMIN_DOMAINS = ["uniforce.com.br"];
const UNIFORCE_SENTINEL_ISP = "uniforce";

const DOMAIN_ISP_FALLBACK: Record<
  string,
  { isp_id: string; isp_nome: string; instancia_isp: string }
> = {
  "agytelecom.com.br":  { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "ispbox" },
  "agy-telecom.com.br": { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "ispbox" },
  "d-kiros.com.br":     { isp_id: "d-kiros",     isp_nome: "D-Kiros",     instancia_isp: "ixc"    },
  "dkiros.com.br":      { isp_id: "d-kiros",     isp_nome: "D-Kiros",     instancia_isp: "ixc"    },
  "zentelecom.com.br":  { isp_id: "zen-telecom", isp_nome: "Zen Telecom", instancia_isp: "ixc"    },
  "zen-telecom.com.br": { isp_id: "zen-telecom", isp_nome: "Zen Telecom", instancia_isp: "ixc"    },
  "igpfibra.com.br":    { isp_id: "igp-fibra",   isp_nome: "IGP Fibra",   instancia_isp: "ixc"    },
  "igp-fibra.com.br":   { isp_id: "igp-fibra",   isp_nome: "IGP Fibra",   instancia_isp: "ixc"    },
  "uniforce.com.br":    { isp_id: "uniforce",    isp_nome: "Uniforce",    instancia_isp: "uniforce" },
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

function isSuperAdminEmail(email: string): boolean {
  return SUPER_ADMIN_DOMAINS.includes(emailDomain(email));
}

async function loadAvailableIsps(): Promise<IspOption[]> {
  try {
    const { data, error } = await externalSupabase
      .from("isps")
      .select("isp_id, isp_nome, instancia_isp")
      .eq("ativo", true)
      .neq("isp_id", UNIFORCE_SENTINEL_ISP)
      .order("isp_nome");

    if (error || !data?.length) return [];
    return data.map((row) => ({
      isp_id: row.isp_id,
      isp_nome: row.isp_nome,
      instancia_isp: row.instancia_isp,
    }));
  } catch {
    return [];
  }
}

async function loadUserProfile(
  userId: string,
  email: string
): Promise<AuthProfile | null> {
  try {
    const { data: profile } = await externalSupabase
      .from("profiles")
      .select("id, isp_id, instancia_isp, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.isp_id) {
      const [ispResult, roleResult] = await Promise.all([
        externalSupabase
          .from("isps")
          .select("isp_id, isp_nome, instancia_isp")
          .eq("isp_id", profile.isp_id)
          .maybeSingle(),
        externalSupabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("isp_id", profile.isp_id)
          .order("role")
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        user_id: userId,
        isp_id: profile.isp_id,
        isp_nome: ispResult.data?.isp_nome || profile.isp_id,
        instancia_isp: profile.instancia_isp || ispResult.data?.instancia_isp || "",
        full_name: profile.full_name || email.split("@")[0],
        email: profile.email || email,
        role: roleResult.data?.role || (isSuperAdminEmail(email) ? "super_admin" : "viewer"),
      };
    }
  } catch (err) {
    console.warn("⚠️ Profile DB error, using domain fallback:", err);
  }

  // Domain fallback
  const domain = emailDomain(email);
  const fallback = DOMAIN_ISP_FALLBACK[domain];
  if (fallback) {
    return {
      user_id: userId,
      isp_id: fallback.isp_id,
      isp_nome: fallback.isp_nome,
      instancia_isp: fallback.instancia_isp,
      full_name: email.split("@")[0],
      email,
      role: isSuperAdminEmail(email) ? "super_admin" : "viewer",
    };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIsp, setSelectedIsp] = useState<IspOption | null>(null);
  const [availableIsps, setAvailableIsps] = useState<IspOption[]>([]);

  // Refs to track state across async boundaries without re-renders
  const mountedRef = useRef(true);
  const profileLoadedRef = useRef(false);
  const initialLoadDoneRef = useRef(false);

  const isSuperAdmin = !!(user?.email && isSuperAdminEmail(user.email));

  // ── ISP selection ──────────────────────────────────────────
  const selectIsp = useCallback((isp: IspOption) => {
    setSelectedIsp(isp);
    sessionStorage.setItem("uniforce_selected_isp", JSON.stringify(isp));
  }, []);

  const clearSelectedIsp = useCallback(() => {
    setSelectedIsp(null);
    sessionStorage.removeItem("uniforce_selected_isp");
  }, []);

  // ── Profile loader (used by initial load & refresh) ────────
  const loadFullProfile = useCallback(async (targetUser: User) => {
    const email = targetUser.email || "";
    try {
      const [p, isps] = await Promise.all([
        loadUserProfile(targetUser.id, email),
        isSuperAdminEmail(email) ? loadAvailableIsps() : Promise.resolve<IspOption[]>([]),
      ]);

      if (!mountedRef.current) return;

      setProfile(p);
      setAvailableIsps(isps);
      profileLoadedRef.current = true;

      if (!p) {
        setError("Usuário não vinculado a um ISP. Entre em contato com o administrador.");
      } else {
        setError(null);
      }

      // Restore selected ISP for super admins
      if (isSuperAdminEmail(email)) {
        const stored = sessionStorage.getItem("uniforce_selected_isp");
        if (stored) {
          try {
            const parsed: IspOption = JSON.parse(stored);
            const valid = isps.find((i) => i.isp_id === parsed.isp_id);
            setSelectedIsp(valid ? parsed : null);
            if (!valid) sessionStorage.removeItem("uniforce_selected_isp");
          } catch {
            sessionStorage.removeItem("uniforce_selected_isp");
          }
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("❌ Profile load failed:", err);

      // Fallback by domain
      const domain = emailDomain(email);
      const fallback = DOMAIN_ISP_FALLBACK[domain];
      if (fallback) {
        setProfile({
          user_id: targetUser.id,
          isp_id: fallback.isp_id,
          isp_nome: fallback.isp_nome,
          instancia_isp: fallback.instancia_isp,
          full_name: email.split("@")[0],
          email,
          role: isSuperAdminEmail(email) ? "super_admin" : "viewer",
        });
        profileLoadedRef.current = true;
        setError(null);
      } else {
        setError("Erro ao carregar perfil do usuário.");
      }
    }
  }, []);

  // ── Public refresh ─────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadFullProfile(user);
  }, [user, loadFullProfile]);

  // ── Auth lifecycle ─────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    profileLoadedRef.current = false;
    initialLoadDoneRef.current = false;

    // 1. LISTENER — NEVER await inside this callback (prevents deadlock)
    const { data: { subscription } } = externalSupabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mountedRef.current) return;

        // Always sync session/user synchronously
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === "PASSWORD_RECOVERY") {
          setIsLoading(false);
          return;
        }

        // TOKEN_REFRESHED: silently update session, skip profile reload
        if (event === "TOKEN_REFRESHED") {
          // Session/user already updated above — nothing else to do
          return;
        }

        // SIGNED_OUT: clear everything
        if (event === "SIGNED_OUT" || !newSession?.user) {
          setProfile(null);
          setError(null);
          setSelectedIsp(null);
          setAvailableIsps([]);
          sessionStorage.removeItem("uniforce_selected_isp");
          profileLoadedRef.current = false;
          setIsLoading(false);
          return;
        }

        // SIGNED_IN (after initial load already ran): reload profile
        // Use setTimeout(0) to dispatch AFTER the callback completes
        if (initialLoadDoneRef.current) {
          setIsLoading(true);
          setTimeout(() => {
            if (!mountedRef.current) return;
            loadFullProfile(newSession.user).finally(() => {
              if (mountedRef.current) setIsLoading(false);
            });
          }, 0);
        }
      }
    );

    // 2. INITIAL LOAD — runs once, controls isLoading
    externalSupabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mountedRef.current) return;

      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setIsLoading(false);
        initialLoadDoneRef.current = true;
        return;
      }

      loadFullProfile(s.user).finally(() => {
        if (mountedRef.current) {
          setIsLoading(false);
          initialLoadDoneRef.current = true;
        }
      });
    });

    // Safety timeout (fallback for extreme edge cases)
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        setIsLoading((c) => {
          if (c) console.warn("⚠️ Auth safety timeout: forcing isLoading=false");
          return false;
        });
      }
    }, 20000);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [loadFullProfile]);

  // ── Sign out ───────────────────────────────────────────────
  const signOut = async () => {
    await externalSupabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setError(null);
    setSelectedIsp(null);
    setAvailableIsps([]);
    sessionStorage.removeItem("uniforce_selected_isp");
    profileLoadedRef.current = false;
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
        availableIsps,
        selectIsp,
        clearSelectedIsp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
