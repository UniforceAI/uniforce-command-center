// src/components/BillingGuard.tsx
// VERSÃO: session-infra-v1.2 (revisão final)
// Correções v1.1:
//   - isPathAllowed: match exato ou prefixo "/" (evita bypass por rota similar)
//   - queryClient.invalidateQueries: escopo restrito a billing_status + profile
//   - Polling: refetchInterval pausa quando tab está oculta (visibilityState)
//   - recoveryFiredRef: guard para evitar double-trigger em race condition
//   - Guard reset em novo ciclo de bloqueio
// Correções v1.2:
//   - refreshProfile(): .catch() adicionado — erro silencioso no recovery levava guard a bloquear

import { ReactNode, useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { externalSupabase } from "@/integrations/supabase/external-client";

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

// Páginas permitidas mesmo com billing bloqueado.
// Matching: pathname === p  OU  pathname começa com p + "/"
// Ex: "/configuracoes" NÃO permite "/configuracoes-extras" (bypass).
const ALLOWED_PATHS = [
  "/configuracoes",
  "/perfil",
  "/logout",
  "/auth",
];

// Página de destino quando bloqueado (aba financeira do perfil)
const BILLING_REDIRECT = "/configuracoes/perfil?tab=meus-pagamentos";

// Intervalo de polling quando está bloqueado e tab visível
const POLL_INTERVAL_MS = 60_000;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Verifica se o pathname está na lista de rotas permitidas.
 * Match exato OU prefixo seguido de "/" para evitar bypass tipo
 * "/configuracoes-extra" passando pelo check de "/configuracoes".
 */
function isPathAllowed(pathname: string): boolean {
  return ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

async function fetchBillingStatus(ispId: string): Promise<boolean> {
  const { data, error } = await externalSupabase
    .from("isps")
    .select("billing_blocked")
    .eq("isp_id", ispId)
    .maybeSingle();

  if (error) throw error;
  return data?.billing_blocked ?? false;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

interface BillingGuardProps {
  children: ReactNode;
}

export function BillingGuard({ children }: BillingGuardProps) {
  const { isBillingBlocked, profile, refreshProfile } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Guard para evitar re-trigger do recovery no mesmo ciclo de bloqueio
  const recoveryFiredRef = useRef(false);

  const ispId = profile?.isp_id;
  const isAllowedPath = isPathAllowed(location.pathname);

  // Polling a cada 60s APENAS quando está bloqueado.
  // Pausa quando a tab está em background (visibilityState) para evitar
  // requests desnecessários em abas não-focadas.
  const { data: polledBlocked } = useQuery({
    queryKey: ["billing_status", ispId],
    queryFn: () => fetchBillingStatus(ispId!),
    enabled: !!ispId && isBillingBlocked,
    refetchInterval: () =>
      isBillingBlocked && document.visibilityState !== "hidden"
        ? POLL_INTERVAL_MS
        : false,
    staleTime: 30_000,
    retry: 2,
  });

  // Reset do guard quando começa novo ciclo de bloqueio
  // (ex: ISP paga, desbloqueia, mas atrasa novamente no mês seguinte)
  useEffect(() => {
    if (isBillingBlocked) {
      recoveryFiredRef.current = false;
    }
  }, [isBillingBlocked]);

  // Quando polling detecta desbloqueio → invalidar cache restrito e recarregar perfil.
  // recoveryFiredRef evita dupla chamada em race condition (polling + staleTime).
  useEffect(() => {
    if (
      isBillingBlocked &&
      polledBlocked === false &&
      !recoveryFiredRef.current
    ) {
      recoveryFiredRef.current = true;
      // Invalidar APENAS queries de billing e perfil — não todo o cache
      queryClient.invalidateQueries({ queryKey: ["billing_status"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      refreshProfile().catch((err) =>
        console.error("BillingGuard: refreshProfile failed on recovery:", err)
      );
    }
  }, [polledBlocked, isBillingBlocked, queryClient, refreshProfile]);

  // Sem ISP carregado: não bloquear (loading em andamento)
  if (!ispId) return <>{children}</>;

  // Rota permitida mesmo com billing bloqueado
  if (isAllowedPath) return <>{children}</>;

  // Bloqueio ativo: redirecionar para aba financeira
  if (isBillingBlocked) {
    return <Navigate to={BILLING_REDIRECT} replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
