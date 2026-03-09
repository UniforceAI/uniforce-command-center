// hooks/useTermsAcceptance.ts
// Verifica se o admin precisa aceitar a versão corrente dos Termos de Serviço.
// IMPORTANTE: usa externalSupabase (yqdqmudsnjhixtxldqwi) — fonte de dados Uniforce,
// onde a sessão autenticada do usuário reside.

import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useUserRole } from "@/hooks/useUserRole";

export function useTermsAcceptance() {
  const { ispId } = useActiveIsp();
  const { data: role } = useUserRole();

  const isAdmin = role === "admin" || role === "super_admin";

  return useQuery({
    queryKey: ["tos-acceptance", ispId],
    staleTime: 30 * 60 * 1000,
    enabled: !!ispId && isAdmin,
    queryFn: async () => {
      // 1. Buscar versão atual dos Termos de Serviço
      const { data: current, error: tosErr } = await externalSupabase
        .from("terms_of_service")
        .select("version")
        .eq("is_current", true)
        .single();

      if (tosErr || !current) {
        // Sem ToS cadastrado — não bloquear
        return { needsAcceptance: false, currentVersion: null, hasFinancialEmail: true };
      }

      const currentVersion = current.version as string;

      // 2. Verificar versão aceita e email financeiro do ISP
      const { data: isp } = await externalSupabase
        .from("isps")
        .select("tos_accepted_version, financial_email")
        .eq("isp_id", ispId)
        .single();

      return {
        needsAcceptance: isp?.tos_accepted_version !== currentVersion,
        currentVersion,
        hasFinancialEmail: !!isp?.financial_email,
      };
    },
  });
}
