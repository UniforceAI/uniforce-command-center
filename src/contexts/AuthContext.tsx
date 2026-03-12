// src/contexts/AuthContext.tsx
// VERSÃO: session-infra-v1.1 (pós-auditoria)
// Correções v1.1:
//   - localStorage com try-catch (fallback gracioso em Incognito mode)
//   - TOKEN_REFRESHED race condition: usa flag para evitar signOut duplo
//   - isBillingBlocked inclui guard de isp_id presente
//   - isSuperAdminEmail movido para antes de loadFullProfile (hoisting explícito)
//   - Fallback de domínio usa get_isp_by_email_domain() RPC (SECURITY DEFINER, bypassa RLS)
//   - Mensagem de erro diferenciada para "domínio não cadastrado" vs erro genérico

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from "react";
import { supabase } from "@/integrations/supabase/client";
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
  isBillingBlocked: boolean;
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
  isBillingBlocked: false,
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

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 horas
const SELECTED_ISP_KEY    = "uf_selected_isp_v2";
const SESSION_START_KEY   = "uf_session_start";

// ─────────────────────────────────────────────────────────────
// localStorage helpers (com try-catch para Incognito mode)
// ─────────────────────────────────────────────────────────────

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* incognito / quota */ }
}
function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* incognito */ }
}

// ─────────────────────────────────────────────────────────────
// Super admin check (uniforce.com.br — intencionalmente separado do DB
// para evitar network round-trip durante renderização de UI básica)
// ─────────────────────────────────────────────────────────────

function isSuperAdminEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@uniforce.com.br");
}

// ─────────────────────────────────────────────────────────────
// Domain lookup via RPC SECURITY DEFINER (bypassa RLS)
// Chamado apenas quando profiles.isp_id é NULL
// ─────────────────────────────────────────────────────────────

async function lookupIspByDomainRpc(email: string): Promise<{
  isp_id: string;
  isp_nome: string;
  instancia_isp: string;
} | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  const { data, error } = await supabase.rpc("get_isp_by_email_domain", { p_domain: domain });
  if (error) {
    console.warn("⚠️ get_isp_by_email_domain error:", error.message);
    return null;
  }
  if (!data || data.length === 0) return null;

  const row = data[0] as { isp_id: string; isp_nome: string; instancia_isp: string };
  return row;
}

// ─────────────────────────────────────────────────────────────
// ISP list loader
// ─────────────────────────────────────────────────────────────

async function loadAvailableIsps(): Promise<IspOption[]> {
  try {
    const { data, error } = await supabase
      .from("isps")
      .select("isp_id, isp_nome, instancia_isp")
      .eq("ativo", true)
      .order("isp_nome");
    if (error || !data?.length) return [];
    return data as IspOption[];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Profile loader
// ─────────────────────────────────────────────────────────────

interface ProfileResult {
  profile: AuthProfile | null;
  billingBlocked: boolean;
  errorType: "no_isp" | "domain_not_registered" | "incomplete_config" | null;
}

async function loadUserProfile(
  userId: string,
  email: string
): Promise<ProfileResult> {
  try {
    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select("id, isp_id, instancia_isp, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) throw profileErr;

    let ispId: string | null = profileRow?.isp_id ?? null;
    let instanciaIsp: string  = profileRow?.instancia_isp ?? "";

    // Se isp_id vazio: tentar lookup dinâmico via função SECURITY DEFINER
    if (!ispId) {
      const domainMatch = await lookupIspByDomainRpc(email);
      if (domainMatch) {
        ispId = domainMatch.isp_id;
        instanciaIsp = domainMatch.instancia_isp;
      } else {
        // Domínio não cadastrado em isp_email_domains
        return { profile: null, billingBlocked: false, errorType: "domain_not_registered" };
      }
    }

    if (!ispId) {
      return { profile: null, billingBlocked: false, errorType: "no_isp" };
    }

    const [ispResult, roleResult] = await Promise.all([
      supabase
        .from("isps")
        .select("isp_id, isp_nome, instancia_isp, billing_blocked")
        .eq("isp_id", ispId)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("isp_id", ispId)
        .order("role")
        .limit(1)
        .maybeSingle(),
    ]);

    const isp  = ispResult.data;
    const role = roleResult.data?.role ?? (isSuperAdminEmail(email) ? "super_admin" : "viewer");

    if (!instanciaIsp && isp?.instancia_isp) {
      instanciaIsp = isp.instancia_isp;
    }

    if (!instanciaIsp) {
      return {
        profile: { user_id: userId, isp_id: ispId, isp_nome: isp?.isp_nome ?? ispId,
          instancia_isp: "", full_name: profileRow?.full_name ?? email.split("@")[0],
          email: profileRow?.email ?? email, role },
        billingBlocked: false,
        errorType: "incomplete_config",
      };
    }

    const isSA = role === "super_admin";
    const billingBlocked = !isSA && (isp?.billing_blocked ?? false);

    return {
      profile: {
        user_id: userId,
        isp_id: ispId,
        isp_nome: isp?.isp_nome ?? ispId,
        instancia_isp: instanciaIsp,
        full_name: profileRow?.full_name ?? email.split("@")[0],
        email: profileRow?.email ?? email,
        role,
      },
      billingBlocked,
      errorType: null,
    };
  } catch (err) {
    console.warn("⚠️ Profile DB error:", err);
    return { profile: null, billingBlocked: false, errorType: "no_isp" };
  }
}

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                   = useState<User | null>(null);
  const [session, setSession]             = useState<Session | null>(null);
  const [profile, setProfile]             = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading]         = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [billingBlocked, setBillingBlocked] = useState(false);
  const [selectedIsp, setSelectedIsp]     = useState<IspOption | null>(null);
  const [availableIsps, setAvailableIsps] = useState<IspOption[]>([]);

  const mountedRef       = useRef(true);
  const profileLoadedRef = useRef(false);
  const initialLoadDone  = useRef(false);
  const signingOutRef    = useRef(false);   // previne signOut duplo no TOKEN_REFRESHED

  const isSuperAdmin    = profile?.role === "super_admin";
  // Guard triplo: billingBlocked state + não é super_admin + isp_id está presente
  const isBillingBlocked = billingBlocked && !isSuperAdmin && !!profile?.isp_id;

  // ── ISP selection (localStorage → cross-tab) ────────────────
  const selectIsp = useCallback((isp: IspOption) => {
    setSelectedIsp(isp);
    lsSet(SELECTED_ISP_KEY, JSON.stringify(isp));
  }, []);

  const clearSelectedIsp = useCallback(() => {
    setSelectedIsp(null);
    lsRemove(SELECTED_ISP_KEY);
  }, []);

  // ── Profile loader ──────────────────────────────────────────
  const loadFullProfile = useCallback(async (targetUser: User) => {
    const email = targetUser.email ?? "";
    try {
      const [profileResult, isps] = await Promise.all([
        loadUserProfile(targetUser.id, email),
        isSuperAdminEmail(email) ? loadAvailableIsps() : Promise.resolve<IspOption[]>([]),
      ]);

      if (!mountedRef.current) return;

      setProfile(profileResult.profile);
      setBillingBlocked(profileResult.billingBlocked);
      setAvailableIsps(isps);
      profileLoadedRef.current = true;

      // Mensagens de erro diferenciadas por tipo
      switch (profileResult.errorType) {
        case "domain_not_registered":
          setError("Domínio de email não cadastrado. Contate o administrador para associar seu email ao provedor.");
          break;
        case "no_isp":
          setError("Usuário não vinculado a um provedor. Contate o administrador.");
          break;
        case "incomplete_config":
          // instancia_isp vazia: perfil existe mas configuração incompleta — não deixar navegar
          setError("Configuração de perfil incompleta. Saia e entre novamente ou contate o suporte.");
          break;
        default:
          setError(null);
      }

      // Restaurar ISP selecionado para super admins
      if (isSuperAdminEmail(email)) {
        const stored = lsGet(SELECTED_ISP_KEY);
        if (stored) {
          try {
            const parsed: IspOption = JSON.parse(stored);
            const valid = isps.find((i) => i.isp_id === parsed.isp_id);
            setSelectedIsp(valid ?? null);
            if (!valid) lsRemove(SELECTED_ISP_KEY);
          } catch {
            lsRemove(SELECTED_ISP_KEY);
          }
        }
      }
    } catch (err) {
      if (!mountedRef.current) return;
      console.error("❌ Profile load failed:", err);
      setError("Erro ao carregar perfil. Tente recarregar a página.");
    }
  }, []); // sem deps: usa closures de funções puras ou refs

  // ── Refresh público ─────────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadFullProfile(user);
  }, [user, loadFullProfile]);

  // ── Auth lifecycle ─────────────────────────────────────────
  useEffect(() => {
    mountedRef.current     = true;
    profileLoadedRef.current = false;
    initialLoadDone.current  = false;
    signingOutRef.current    = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mountedRef.current) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === "PASSWORD_RECOVERY") {
          setIsLoading(false);
          return;
        }

        if (event === "SIGNED_IN") {
          // Gravar início de sessão (used by usePageFilters for filter expiry)
          lsSet(SESSION_START_KEY, String(Date.now()));
          signingOutRef.current = false;
        }

        if (event === "TOKEN_REFRESHED") {
          // Verificar expiração de 8h (Supabase timebox já cuida disso server-side,
          // mas verificamos client-side como defense-in-depth)
          if (signingOutRef.current) return; // signOut já em progresso
          const sessionStart = parseInt(lsGet(SESSION_START_KEY) ?? "0", 10);
          if (sessionStart && Date.now() - sessionStart > SESSION_DURATION_MS) {
            signingOutRef.current = true;
            console.warn("⏰ Sessão expirada (8h) — forçando logout");
            // Não await aqui (callback não pode ser async) — usar setTimeout(0) para executar depois
            setTimeout(() => { supabase.auth.signOut().catch(() => {}); }, 0);
          }
          return;
        }

        if (event === "SIGNED_OUT" || !newSession?.user) {
          setProfile(null);
          setError(null);
          setBillingBlocked(false);
          setSelectedIsp(null);
          setAvailableIsps([]);
          lsRemove(SESSION_START_KEY);
          lsRemove(SELECTED_ISP_KEY); // limpar ISP selecionado em logout forçado (token expiry)
          profileLoadedRef.current = false;
          signingOutRef.current = false;
          setIsLoading(false);
          return;
        }

        // SIGNED_IN ou USER_UPDATED após carga inicial
        if (initialLoadDone.current) {
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

    // Carga inicial
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mountedRef.current) return;
      setSession(s);
      setUser(s?.user ?? null);

      if (!s?.user) {
        setIsLoading(false);
        initialLoadDone.current = true;
        return;
      }

      loadFullProfile(s.user).finally(() => {
        if (mountedRef.current) {
          setIsLoading(false);
          initialLoadDone.current = true;
        }
      });
    });

    // Safety timeout
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        setIsLoading((c) => {
          if (c) console.warn("⚠️ Auth safety timeout");
          return false;
        });
      }
    }, 20_000);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [loadFullProfile]);

  // ── Sign out ───────────────────────────────────────────────
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setError(null);
    setBillingBlocked(false);
    setSelectedIsp(null);
    setAvailableIsps([]);
    lsRemove(SESSION_START_KEY);
    lsRemove(SELECTED_ISP_KEY);
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
        isBillingBlocked,
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
