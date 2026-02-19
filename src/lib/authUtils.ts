import { externalSupabase } from "@/integrations/supabase/external-client";

interface DomainValidationResult {
  valid: boolean;
  isp_id?: string;
  isp_nome?: string;
  error?: string;
}

/**
 * Valida se o domínio do email está cadastrado na tabela isps do banco externo.
 * Compara o domínio extraído do email com os domínios associados aos ISPs.
 * 
 * Como a tabela isps não tem coluna de domínio explícita,
 * usamos um mapa estático baseado nos ISPs cadastrados.
 * 
 * TODO: Quando a tabela isps tiver coluna "allowed_domains",
 * substituir este mapa por query dinâmica.
 */
const ISP_DOMAIN_MAP: Record<string, string> = {
  "agytelecom.com.br": "agy-telecom",
  "d-kiros.com.br": "d-kiros",
  "uniforce.com.br": "agy-telecom", // Uniforce pode acessar AGY
};

export async function validateEmailDomain(email: string): Promise<DomainValidationResult> {
  const domain = email.split("@")[1]?.toLowerCase();

  if (!domain) {
    return { valid: false, error: "Email inválido." };
  }

  // 1. Verificar no mapa estático
  const ispId = ISP_DOMAIN_MAP[domain];
  
  if (!ispId) {
    return {
      valid: false,
      error: "Domínio não autorizado. Entre em contato com o administrador.",
    };
  }

  // 2. Validar se o ISP existe na tabela isps
  const { data: isp, error: ispErr } = await externalSupabase
    .from("isps")
    .select("isp_id, isp_nome")
    .eq("isp_id", ispId)
    .maybeSingle();

  if (ispErr || !isp) {
    return {
      valid: false,
      error: "ISP não encontrado na base de dados. Entre em contato com o administrador.",
    };
  }

  return {
    valid: true,
    isp_id: isp.isp_id,
    isp_nome: isp.isp_nome,
  };
}

/**
 * Após signup confirmado, cria o profile e role no banco externo.
 * Deve ser chamado após a confirmação do email.
 */
export async function createUserProfileInExternal(
  userId: string,
  email: string,
  fullName: string,
  ispId: string
): Promise<{ success: boolean; error?: string }> {
  // Criar profile
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

  // Criar role padrão
  const { error: roleErr } = await externalSupabase
    .from("user_roles")
    .upsert({
      user_id: userId,
      isp_id: ispId,
      role: "viewer",
    }, { onConflict: "user_id,isp_id" });

  if (roleErr) {
    console.error("⚠️ Erro ao criar role (pode já existir):", roleErr);
    // Não bloquear por erro de role
  }

  return { success: true };
}
