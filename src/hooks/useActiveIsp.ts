import { useAuth } from "@/contexts/AuthContext";

/**
 * Hook que retorna o ISP ativo para filtrar queries.
 * - Super admins: usa o ISP selecionado na tela de seleção
 * - Usuários normais: usa o ISP do profile
 */
export function useActiveIsp() {
  const { profile, isSuperAdmin, selectedIsp } = useAuth();

  // Super admin com ISP selecionado
  if (isSuperAdmin && selectedIsp) {
    return {
      ispId: selectedIsp.isp_id,
      ispNome: selectedIsp.isp_nome,
      instanciaIsp: selectedIsp.instancia_isp,
    };
  }

  // Usuário normal ou fallback
  return {
    ispId: profile?.isp_id || "agy-telecom",
    ispNome: profile?.isp_nome || "ISP",
    instanciaIsp: profile?.instancia_isp || "",
  };
}
