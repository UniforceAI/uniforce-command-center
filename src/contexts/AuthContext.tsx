// src/contexts/AuthContext.tsx
// VERSÃO: session-infra-v1.2
// Mudanças v1.2 vs v1.1:
//   - SIGNED_IN: NÃO sobrescreve SESSION_START_KEY se já existe (fix filtros apagados ao trocar aba)
//   - SIGNED_IN: return imediato se profileLoadedRef.current (fix tela de loading ao trocar aba)
//   - Root cause: Supabase re-dispara SIGNED_IN ao retornar de outra aba do browser.
//     Isso causava: (1) SESSION_START_KEY overwrite → readFromStorage descartava filtros como "stale"
//     (2) setIsLoading(true) → ProtectedRoute mostrava "Verificando autenticação..." → unmount de tudo
// Mudanças v1.1 vs versão anterior:
//   - isBillingBlocked: lê billing_blocked da tabela isps + guard triplo
//   - uf_session_start: gravado no SIGNED_IN; verificação de 8h no TOKEN_REFRESHED
//   - signingOutRef: previne double-signOut em race condition TOKEN_REFRESHED
//   - localStorage para ISP selecionado (chave uf_selected_isp_v2) — não mais sessionStorage
//   - localStorage helpers com try-catch (Incognito mode safe)
//   - Domain fallback usa get_isp_by_email_domain() RPC SECURITY DEFINER
//     CRÍTICO: query direta em isp_email_domains falha para novos users (RLS por isp_id)
//   - Mensagens de erro diferenciadas por tipo
//   - Static fallback mantido como safety net (inclui igpfibra.com)

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
  isBillingBlocked: boolean;
  emailConfirmed: boolean;
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
  emailConfirmed: false,
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

// Static fallback — usado APENAS se a RPC falhar (outage / cold start)
const DOMAIN_ISP_FALLBACK: Record<string, { isp_id: string; isp_nome: string; instancia_isp: string }> = {
  "agytelecom.com.br":  { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "ispbox" },
  "agy-telecom.com.br": { isp_id: "agy-telecom", isp_nome: "AGY Telecom", instancia_isp: "ispbox" },
  "d-kiros.com.br":     { isp_id: "d-kiros",     isp_nome: "D-Kiros",     instancia_isp: "ixc"    },
  "dkiros.com.br":      { isp_id: "d-kiros",     isp_nome: "D-Kiros",     instancia_isp: "ixc"    },
  "zentelecom.com.br":  { isp_id: "zen-telecom", isp_nome: "Zen Telecom", instancia_isp: "ixc"    },
  "zen-telecom.com.br": { isp_id: "zen-telecom", isp_nome: "Zen Telecom", instancia_isp: "ixc"    },
  "igpfibra.com.br":    { isp_id: "igp-fibra",   isp_nome: "IGP Fibra",   instancia_isp: "ixc"    },
  "igp-fibra.com.br":   { isp_id: "igp-fibra",   isp_nome: "IGP Fibra",   instancia_isp: "ixc"    },
  "igpfibra.com":       { isp_id: "igp-fibra",   isp_nome: "IGP Fibra",   instancia_isp: "ixc"    },
  "uniforce.com.br":    { isp_id: "uniforce",    isp_nome: "Uniforce",    instancia_isp: "uniforce" },
};

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
// Helpers
// ─────────────────────────────────────────────────────────────

function emailDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

function isSuperAdminEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@uniforce.com.br");
}

// Domain lookup via RPC SECURITY DEFINER (bypassa RLS).
// CRÍTICO: query direta em isp_email_domains falha para novos usuários cujo
// isp_id ainda não está no profile — RLS bloqueia. RPC é obrigatório.
async function lookupIspByDomainRpc(email: string): Promise<{
  isp_id: string; isp_nome: string; instancia_isp: string;
} | null> {
  const domain = emailDomain(email);
  if (!domain) return null;
  try {
    const { data, error } = await externalSupabase.rpc("get_isp_by_email_domain", { p_domain: domain });
    if (error || !data?.length) return null;
    const row = data[0] as { isp_id: string; isp_nome: string; instancia_isp: string };
    return row;
  } catch {
    return null;
  }
}

async function loadAvailableIsps(): Promise<IspOption[]> {
  try {
    const { data, error } = await externalSupabase
      .from("isps").select("isp_id, isp_nome, instancia_isp").eq("ativo", true).order("isp_nome");
    if (error || !data?.length) return [];
    return data as IspOption[];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// Profile loader — retorna profile + billing_blocked
// ─────────────────────────────────────────────────────────────

interface ProfileResult {
  profile: AuthProfile | null;
  billingBlocked: boolean;
  errorType: "no_isp" | "domain_not_registered" | "incomplete_config" | null;
}

async function loadUserProfile(userId: string, email: string): Promise<ProfileResult> {
  try {
    const { data: profileRow, error: profileErr } = await externalSupabase
      .from("profiles").select("id, isp_id, instancia_isp, full_name, email").eq("id", userId).maybeSingle();

    if (profileErr) throw profileErr;

    let ispId: string | null = profileRow?.isp_id ?? null;
    let instanciaIsp: string  = profileRow?.instancia_isp ?? "";

    // Se isp_id vazio: RPC primeiro, static fallback como safety net
    if (!ispId) {
      const rpcMatch = await lookupIspByDomainRpc(email);
      if (rpcMatch) {
        ispId = rpcMatch.isp_id;
        instanciaIsp = rpcMatch.instancia_isp;
      } else {
        // Safety net: fallback estático (outage / cold start)
        const domain = emailDomain(email);
        const staticMatch = DOMAIN_ISP_FALLBACK[domain];
        if (staticMatch) {
          ispId = staticMatch.isp_id;
          instanciaIsp = staticMatch.instancia_isp;
        } else {
          return { profile: null, billingBlocked: false, errorType: "domain_not_registered" };
        }
      }
    }

    if (!ispId) return { profile: null, billingBlocked: false, errorType: "no_isp" };

    const [ispResult, roleResult] = await Promise.all([
      externalSupabase.from("isps")
        .select("isp_id, isp_nome, instancia_isp, billing_blocked")
        .eq("isp_id", ispId).maybeSingle(),
      externalSupabase.from("user_roles")
        .select("role").eq("user_id", userId).eq("isp_id", ispId)
        .order("role").limit(1).maybeSingle(),
    ]);

    const isp  = ispResult.data;
    const role = roleResult.data?.role ?? (isSuperAdminEmail(email) ? "super_admin" : "viewer");

    if (!instanciaIsp && isp?.instancia_isp) instanciaIsp = isp.instancia_isp;

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
        user_id: userId, isp_id: ispId, isp_nome: isp?.isp_nome ?? ispId,
        instancia_isp: instanciaIsp,
        full_name: profileRow?.full_name ?? email.split("@")[0],
        email: profileRow?.email ?? email, role,
      },
      billingBlocked,
      errorType: null,
    };
  } catch (err) {
    console.warn("⚠️ Profile DB error:", err);
    // Last resort: static domain fallback
    const domain = emailDomain(email);
    const fallback = DOMAIN_ISP_FALLBACK[domain];
    if (fallback) {
      return {
        profile: { user_id: userId, ...fallback,
          full_name: email.split("@")[0], email,
          role: isSuperAdminEmail(email) ? "super_admin" : "viewer" },
        billingBlocked: false,
        errorType: null,
      };
    }
    return { profile: null, billingBlocked: false, errorType: "no_isp" };
  }
}

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]                     = useState<User | null>(null);
  const [session, setSession]               = useState<Session | null>(null);
  const [profile, setProfile]               = useState<AuthProfile | null>(null);
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [billingBlocked, setBillingBlocked] = useState(false);
  const [selectedIsp, setSelectedIsp]       = useState<IspOption | null>(null);
  const [availableIsps, setAvailableIsps]   = useState<IspOption[]>([]);

  const mountedRef         = useRef(true);
  const profileLoadedRef   = useRef(false);
  const initialLoadDone    = useRef(false);
  const signingOutRef      = useRef(false);   // previne signOut duplo no TOKEN_REFRESHED

  const isSuperAdmin     = profile?.role === "super_admin";
  // Guard triplo: billingBlocked state + não é super_admin + isp_id presente
  const isBillingBlocked = billingBlocked && !isSuperAdmin && !!profile?.isp_id;
  // Email confirmado: true se email_confirmed_at está preenchido (Google OAuth preenche automaticamente)
  const emailConfirmed   = !!user?.email_confirmed_at;

  // ── ISP selection (localStorage — persiste cross-tab e após freeze) ─
  const selectIsp = useCallback((isp: IspOption) => {
    setSelectedIsp(isp);
    lsSet(SELECTED_ISP_KEY, JSON.stringify(isp));
  }, []);

  const clearSelectedIsp = useCallback(() => {
    setSelectedIsp(null);
    lsRemove(SELECTED_ISP_KEY);
  }, []);

  // ── Profile loader ────────────────────────────────────────
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

      switch (profileResult.errorType) {
        case "domain_not_registered":
          setError("Domínio de email não cadastrado. Contate o administrador para associar seu email ao provedor.");
          break;
        case "no_isp":
          setError("Usuário não vinculado a um ISP. Entre em contato com o administrador.");
          break;
        case "incomplete_config":
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
  }, []);

  // ── Refresh público ───────────────────────────────────────
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadFullProfile(user);
  }, [user, loadFullProfile]);

  // ── Auth lifecycle ────────────────────────────────────────
  useEffect(() => {
    mountedRef.current       = true;
    profileLoadedRef.current = false;
    initialLoadDone.current  = false;
    signingOutRef.current    = false;

    const { data: { subscription } } = externalSupabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mountedRef.current) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (event === "PASSWORD_RECOVERY") { setIsLoading(false); return; }

        if (event === "SIGNED_IN") {
          // Gravar sessionStart APENAS no primeiro sign-in desta sessão.
          // Re-fires do Supabase (tab return, token refresh disfarçado de SIGNED_IN)
          // NÃO devem sobrescrever — senão _session_ts dos filtros salvos fica < novo sessionStart
          // e readFromStorage() descarta tudo como "sessão anterior".
          // O caso F5/reload é tratado pelo initSession() em usePageFilters.ts (module-level IIFE).
          if (!lsGet(SESSION_START_KEY)) {
            lsSet(SESSION_START_KEY, String(Date.now()));
          }
          signingOutRef.current = false;

          // Se profile já carregado → tab return / re-fire, não recarregar.
          // Sem este guard, ProtectedRoute mostra tela de loading ao voltar de outra aba.
          if (profileLoadedRef.current) return;
        }

        if (event === "TOKEN_REFRESHED") {
          // Guard de 8h client-side (Supabase timebox cuida server-side — defense-in-depth)
          if (signingOutRef.current) return;
          const sessionStart = parseInt(lsGet(SESSION_START_KEY) ?? "0", 10);
          if (sessionStart && Date.now() - sessionStart > SESSION_DURATION_MS) {
            signingOutRef.current = true;
            console.warn("⏰ Sessão expirada (8h) — forçando logout");
            setTimeout(() => { externalSupabase.auth.signOut().catch(() => {}); }, 0);
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
          lsRemove(SELECTED_ISP_KEY);
          profileLoadedRef.current = false;
          signingOutRef.current    = false;
          setIsLoading(false);
          return;
        }

        // SIGNED_IN após carga inicial — só chega aqui se profileLoadedRef é false
        // (login genuíno de novo user, não tab return)
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
    externalSupabase.auth.getSession().then(({ data: { session: s } }) => {
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

    const safetyTimer = setTimeout(() => {
      if (mountedRef.current) {
        setIsLoading((c) => { if (c) console.warn("⚠️ Auth safety timeout"); return false; });
      }
    }, 20_000);

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, [loadFullProfile]);

  // ── Sign out ──────────────────────────────────────────────
  const signOut = async () => {
    await externalSupabase.auth.signOut();
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
        user, session, profile, isLoading, error,
        isSuperAdmin, isBillingBlocked, emailConfirmed,
        selectedIsp, availableIsps,
        selectIsp, clearSelectedIsp,
        signOut, refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
