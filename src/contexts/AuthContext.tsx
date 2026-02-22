import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
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

// ─────────────────────────────────────────────────────────────
// Context default
// ─────────────────────────────────────────────────────────────

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

/** Email domains that grant super_admin access (full multi-tenant visibility). */
const SUPER_ADMIN_DOMAINS = ["uniforce.com.br"];

/**
 * Sentinel ISP ID used internally for Uniforce team members.
 * It is never shown as a selectable ISP in the UI.
 */
const UNIFORCE_SENTINEL_ISP = "uniforce";

/**
 * Static domain→ISP fallback map.
 * Used only when the user's profile doesn't yet exist in the DB.
 * Values MUST match the `isps` table (isp_id, instancia_isp).
 */
const DOMAIN_ISP_FALLBACK: Record<
  string,
  { isp_id: string; isp_nome: string; instancia_isp: string }
> = {
  // AGY Telecom
  "agytelecom.com.br":  { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "ispbox" },
  "agy-telecom.com.br": { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "ispbox" },
  // D-Kiros
  "d-kiros.com.br":     { isp_id: "d-kiros",     isp_nome: "D-Kiros",     instancia_isp: "ixc"    },
  "dkiros.com.br":      { isp_id: "d-kiros",     isp_nome: "D-Kiros",     instancia_isp: "ixc"    },
  // Zen Telecom
  "zentelecom.com.br":  { isp_id: "zen-telecom", isp_nome: "Zen Telecom", instancia_isp: "ixc"    },
  "zen-telecom.com.br": { isp_id: "zen-telecom", isp_nome: "Zen Telecom", instancia_isp: "ixc"    },
  // IGP Fibra
  "igpfibra.com.br":    { isp_id: "igp-fibra",   isp_nome: "IGP Fibra",   instancia_isp: "ixc"    },
  "igp-fibra.com.br":   { isp_id: "igp-fibra",   isp_nome: "IGP Fibra",   instancia_isp: "ixc"    },
  // Uniforce (super admin — fallback selects first real ISP at runtime)
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

/**
 * Loads all active ISPs from the database (excluding the internal sentinel).
 * Falls back to an empty list on network failure (UI should handle gracefully).
 * ISP list is always authoritative from the DB — no hardcoded list needed.
 */
async function loadAvailableIsps(): Promise<IspOption[]> {
  const { data, error } = await externalSupabase
    .from("isps")
    .select("isp_id, isp_nome, instancia_isp")
    .eq("ativo", true)
    .neq("isp_id", UNIFORCE_SENTINEL_ISP)
    .order("isp_nome");

  if (error || !data?.length) {
    console.warn("⚠️ Could not load ISPs from DB:", error?.message);
    return [];
  }

  return data.map((row) => ({
    isp_id: row.isp_id,
    isp_nome: row.isp_nome,
    instancia_isp: row.instancia_isp,
  }));
}

/**
 * Loads the authenticated user's profile, ISP info, and role from the DB.
 * Falls back to domain-based derivation when the profile row doesn't exist yet.
 */
async function loadUserProfile(
  userId: string,
  email: string
): Promise<AuthProfile | null> {
  try {
    // 1. Fetch profile row
    const { data: profile } = await externalSupabase
      .from("profiles")
      .select("id, isp_id, instancia_isp, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.isp_id) {
      // 2. Fetch ISP metadata AND role in PARALLEL (not sequentially)
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

      const isp = ispResult.data;
      const roleRow = roleResult.data;

      const resolvedRole =
        roleRow?.role ||
        (isSuperAdminEmail(email) ? "super_admin" : "viewer");

      return {
        user_id: userId,
        isp_id: profile.isp_id,
        isp_nome: isp?.isp_nome || profile.isp_id,
        instancia_isp: profile.instancia_isp || isp?.instancia_isp || "",
        full_name: profile.full_name || email.split("@")[0],
        email: profile.email || email,
        role: resolvedRole,
      };
    }
  } catch (err) {
    console.warn("⚠️ Error loading profile from DB, trying domain fallback:", err);
  }

  // Domain fallback — used only when DB profile doesn't exist
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

  console.error("❌ Unknown email domain:", domain, "for user:", email);
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

  // ── Profile refresh (callable externally) ─────────────────
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const p = await loadUserProfile(user.id, user.email || "");
    setProfile(p);
  }, [user]);

  // ── Session initialisation & auth listener ─────────────────
  useEffect(() => {
    let mounted = true;

    async function handleSession(newSession: Session | null) {
      if (!mounted) return;
      setSession(newSession);
      const newUser = newSession?.user ?? null;
      setUser(newUser);

      if (!newUser) {
        setProfile(null);
        setError(null);
        setSelectedIsp(null);
        setAvailableIsps([]);
        sessionStorage.removeItem("uniforce_selected_isp");
        setIsLoading(false);
        return;
      }

      try {
        const email = newUser.email || "";

        // Load profile & ISPs concurrently with a timeout
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout")), 10000)
        );

        const [p, isps] = await Promise.race([
          Promise.all([
            loadUserProfile(newUser.id, email),
            isSuperAdminEmail(email) ? loadAvailableIsps() : Promise.resolve<IspOption[]>([]),
          ]),
          timeoutPromise,
        ]) as [AuthProfile | null, IspOption[]];

        if (!mounted) return;

        setProfile(p);
        setAvailableIsps(isps);

        if (!p) {
          setError(
            "Usuário não vinculado a um ISP. Entre em contato com o administrador."
          );
        } else {
          setError(null);
        }

        // Restore previously selected ISP for super admins
        if (isSuperAdminEmail(email)) {
          const stored = sessionStorage.getItem("uniforce_selected_isp");
          if (stored) {
            try {
              const parsed: IspOption = JSON.parse(stored);
              const stillValid = isps.find((i) => i.isp_id === parsed.isp_id);
              setSelectedIsp(stillValid ? parsed : null);
              if (!stillValid) sessionStorage.removeItem("uniforce_selected_isp");
            } catch {
              sessionStorage.removeItem("uniforce_selected_isp");
            }
          }
        }
      } catch (err: unknown) {
        if (!mounted) return;
        console.error("❌ Auth session error:", err);
        // On timeout/error, try domain fallback directly
        const email = newUser.email || "";
        const domain = emailDomain(email);
        const fallback = DOMAIN_ISP_FALLBACK[domain];
        if (fallback) {
          setProfile({
            user_id: newUser.id,
            isp_id: fallback.isp_id,
            isp_nome: fallback.isp_nome,
            instancia_isp: fallback.instancia_isp,
            full_name: email.split("@")[0],
            email,
            role: isSuperAdminEmail(email) ? "super_admin" : "viewer",
          });
          setError(null);
        } else {
          setError("Erro ao carregar perfil do usuário.");
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    // Subscribe to auth state changes FIRST
    const {
      data: { subscription },
    } = externalSupabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      // Skip full profile loading for password recovery events — user is just resetting password
      if (event === "PASSWORD_RECOVERY") {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      await handleSession(newSession);
    });

    // Bootstrap from persisted session
    externalSupabase.auth.getSession().then(({ data: { session: s } }) => {
      if (mounted) handleSession(s);
    });

    // Safety timeout: if isLoading is still true after 15s, force it off
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        setIsLoading((current) => {
          if (current) {
            console.warn("⚠️ Auth safety timeout: forcing isLoading=false");
            return false;
          }
          return current;
        });
      }
    }, 15000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
