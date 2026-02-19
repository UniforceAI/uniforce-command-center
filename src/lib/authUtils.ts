import { externalSupabase } from "@/integrations/supabase/external-client";

interface DomainValidationResult {
  valid: boolean;
  isp_id?: string;
  isp_nome?: string;
  error?: string;
}

/**
 * Mapa estático de domínios autorizados → ISP.
 * A tabela isps no banco externo pode estar vazia,
 * então usamos este mapa como fonte principal.
 */
const ISP_DOMAIN_MAP: Record<string, { isp_id: string; isp_nome: string }> = {
  "agytelecom.com.br": { isp_id: "agy-telecom", isp_nome: "AGY Telecom" },
  "d-kiros.com.br": { isp_id: "d-kiros", isp_nome: "D-Kiros" },
  "dkiros.com.br": { isp_id: "d-kiros", isp_nome: "D-Kiros" },
  "uniforce.com.br": { isp_id: "agy-telecom", isp_nome: "AGY Telecom" },
};

export async function validateEmailDomain(email: string): Promise<DomainValidationResult> {
  const domain = email.split("@")[1]?.toLowerCase();

  if (!domain) {
    return { valid: false, error: "Email inválido." };
  }

  const ispInfo = ISP_DOMAIN_MAP[domain];

  if (!ispInfo) {
    return {
      valid: false,
      error: "Domínio não autorizado. Entre em contato com o administrador.",
    };
  }

  return {
    valid: true,
    isp_id: ispInfo.isp_id,
    isp_nome: ispInfo.isp_nome,
  };
}

/**
 * Após signup confirmado, cria o profile e role no banco externo.
 */
export async function createUserProfileInExternal(
  userId: string,
  email: string,
  fullName: string,
  ispId: string
): Promise<{ success: boolean; error?: string }> {
  const { error: profileErr } = await externalSupabase
    .from("profiles")
    .upsert({
      id: userId,
      isp_id: ispId,
      full_name: fullName,
      email: email,
    }, { onConflict: "id" });

  if (profileErr) {
    console.error("❌ Erro ao criar profile:", profileErr);
    return { success: false, error: "Erro ao criar perfil: " + profileErr.message };
  }

  const { error: roleErr } = await externalSupabase
    .from("user_roles")
    .upsert({
      user_id: userId,
      isp_id: ispId,
      role: "viewer",
    }, { onConflict: "user_id,isp_id" });

  if (roleErr) {
    console.error("⚠️ Erro ao criar role (pode já existir):", roleErr);
  }

  return { success: true };
}
