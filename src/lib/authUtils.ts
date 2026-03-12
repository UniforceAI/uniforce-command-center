// src/lib/authUtils.ts
// VERSÃO: session-infra-v1.2 (revisão final)
// Correções v1.1:
//   - getIspByEmailDomain: usa RPC get_isp_by_email_domain() (SECURITY DEFINER)
//     em vez de query direta em isp_email_domains — necessário pois RLS restringe
//     à própria ISP; usuário recém-autenticado sem isp_id no profile ainda não passa no RLS
//   - ensureUserProfile: user_roles usa upsert+ignoreDuplicates (não insert que lança em conflito)
//   - profiles sem ISP: usa upsert (evita duplicate key se perfil base já foi criado pelo trigger)
// Correções v1.2:
//   - ensureUserProfile: verifica role existente antes de inserir 'viewer'
//     onConflict em (user_id,isp_id,role) NÃO previne inserção de role diferente —
//     admin pode ter atribuído 'admin' manualmente antes; check explícito evita duplicação

import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export interface DomainIspMapping {
  isp_id: string;
  isp_nome: string;
  instancia_isp: string;
}

// ─────────────────────────────────────────────────────────────
// Domain lookup (via RPC SECURITY DEFINER — bypassa RLS)
// ─────────────────────────────────────────────────────────────

/**
 * Dado o domínio do email (ex: "igpfibra.com"), retorna os dados do ISP.
 * Usa RPC get_isp_by_email_domain() com SECURITY DEFINER para contornar RLS
 * — necessário quando o perfil do usuário ainda não tem isp_id (recém autenticado).
 * Para adicionar novos domínios: INSERT em isp_email_domains (sem alterar código).
 */
export async function getIspByEmailDomain(
  email: string
): Promise<DomainIspMapping | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  const { data, error } = await supabase.rpc("get_isp_by_email_domain", {
    p_domain: domain,
  });

  if (error) {
    console.warn("getIspByEmailDomain RPC error:", error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  const row = data[0] as {
    isp_id: string;
    isp_nome: string;
    instancia_isp: string;
  };
  return {
    isp_id: row.isp_id,
    isp_nome: row.isp_nome ?? row.isp_id,
    instancia_isp: row.instancia_isp ?? "",
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Verifica se o email pertence ao domínio do Uniforce (super admin).
 * Verificação rápida de UI sem hit no DB.
 */
export function isUniforceEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@uniforce.com.br");
}

// ─────────────────────────────────────────────────────────────
// Profile bootstrap
// ─────────────────────────────────────────────────────────────

/**
 * Cria ou atualiza o profile do usuário quando o trigger handle_new_user()
 * não criou automaticamente (ex: domínio cadastrado DEPOIS do signup do usuário).
 *
 * Retorna true se profile está completo (com isp_id), false se domínio não reconhecido.
 */
export async function ensureUserProfile(
  userId: string,
  email: string
): Promise<boolean> {
  // Verificar se profile já existe e está completo
  const { data: existing } = await supabase
    .from("profiles")
    .select("id, isp_id")
    .eq("id", userId)
    .maybeSingle();

  if (existing?.isp_id) return true; // Profile completo — sem ação necessária

  // Tentar resolver ISP pelo domínio via RPC (bypassa RLS)
  const ispMapping = await getIspByEmailDomain(email);

  if (!ispMapping) {
    // Domínio não cadastrado — garantir ao menos o profile base
    // Usar upsert para evitar duplicate key se profile base já foi criado pelo trigger
    await supabase.from("profiles").upsert(
      {
        id: userId,
        isp_id: null,
        instancia_isp: "",
        full_name: email.split("@")[0],
        email,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );
    return false;
  }

  // Upsert profile com ISP resolvido
  await supabase.from("profiles").upsert(
    {
      id: userId,
      isp_id: ispMapping.isp_id,
      instancia_isp: ispMapping.instancia_isp,
      full_name: existing?.isp_id === undefined ? email.split("@")[0] : undefined,
      email,
    },
    { onConflict: "id" }
  );

  // Verificar se o usuário já tem QUALQUER role neste ISP.
  // upsert(ignoreDuplicates) com onConflict em (user_id,isp_id,role) NÃO previne inserção de
  // role diferente — ex: admin já atribuiu 'admin', mas aqui inseriria 'viewer' em row separada.
  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("isp_id", ispMapping.isp_id)
    .limit(1)
    .maybeSingle();

  if (!existingRole) {
    const initialRole = isUniforceEmail(email) ? "super_admin" : "viewer";
    await supabase.from("user_roles").insert({
      user_id: userId,
      isp_id: ispMapping.isp_id,
      instancia_isp: ispMapping.instancia_isp,
      role: initialRole,
    });
  }

  return true;
}
