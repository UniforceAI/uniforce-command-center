// hooks/useTermsAcceptance.ts
// Verifica se o usuário admin precisa aceitar os Termos de Serviço
// Retorna { needsAcceptance, currentVersion, isLoading }

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useUserRole } from "@/hooks/useUserRole";

export function useTermsAcceptance() {
  const { ispId } = useActiveIsp();
  const { data: role } = useUserRole();

  const isAdmin = role === "admin" || role === "super_admin";

  return useQuery({
    queryKey: ["tos-acceptance", ispId],
    staleTime: 30 * 60 * 1000, // 30 minutos
    enabled: !!ispId && isAdmin,
    queryFn: async () => {
      // 1. Buscar versão atual dos ToS
      const { data: current, error: tosErr } = await supabase
        .from("terms_of_service")
        .select("version")
        .eq("is_current", true)
        .single();

      if (tosErr || !current) {
        // Se não há ToS cadastrado, não bloquear
        return { needsAcceptance: false, currentVersion: null };
      }

      const currentVersion = current.version;

      // 2. Verificar versão aceita pelo ISP
      const { data: isp } = await supabase
        .from("isps")
        .select("tos_accepted_version")
        .eq("isp_id", ispId)
        .single();

      const acceptedVersion = isp?.tos_accepted_version;

      return {
        needsAcceptance: acceptedVersion !== currentVersion,
        currentVersion,
      };
    },
  });
}
