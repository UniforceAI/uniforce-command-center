import { externalSupabase } from "@/integrations/supabase/external-client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface DomainValidationResult {
  valid: boolean;
  isp_id?: string;
  isp_nome?: string;
  instancia_isp?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Uniforce internal team domains — always authorized as super_admin.
 */
const SUPER_ADMIN_DOMAINS = ["uniforce.com.br"];

/**
 * Sentinel ISP used internally for Uniforce team members.
 */
const UNIFORCE_SENTINEL: DomainValidationResult = {
  valid: true,
  isp_id: "uniforce",
  isp_nome: "Uniforce",
  instancia_isp: "uniforce",
};

/**
 * Static domain → ISP fallback map.
 *
 * This list covers known email domains for all registered ISPs.
 * It is used as a FALLBACK when the DB query fails or returns nothing.
 * The DB is always the primary source of truth.
 *
 * Format: "email.domain.com.br" → { isp_id, isp_nome, instancia_isp }
 * Values MUST match the `isps` table exactly.
 */
const STATIC_DOMAIN_MAP: Record<
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
};

// ─────────────────────────────────────────────────────────────
// Domain → ISP derivation (for scalability)
// ─────────────────────────────────────────────────────────────

/**
 * Derive candidate email domain patterns from an ISP's isp_id.
 *
 * Rationale: as new ISPs are added to the DB, this function generates
 * predictable domain patterns from the isp_id so we can attempt to match
 * them without storing a separate domains column in the DB.
 *
 * E.g., "zen-telecom" → ["zentelecom", "zen-telecom", "zentelecom.com.br"]
 */
function deriveDomainsFromIspId(ispId: string): string[] {
  const base = ispId.toLowerCase();
  const noHyphen = base.replace(/-/g, "");
  return [
    base,
    noHyphen,
    `${base}.com.br`,
    `${noHyphen}.com.br`,
    `${base}.com`,
    `${noHyphen}.com`,
  ];
}

// ─────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────

/**
 * Validates an email address for login.
 *
 * Strategy (in order):
 * 1. Uniforce super-admin domains → always valid
 * 2. Static domain map lookup (for known ISPs)
 * 3. DB lookup: query active ISPs and try to match domain via derivation
 *    → This makes the system auto-scale as new ISPs are added to the DB
 *
 * Returns the resolved ISP info if valid, or an error message if not.
 */
export async function validateEmailDomain(
  email: string
): Promise<DomainValidationResult> {
  const domain = email.split("@")[1]?.toLowerCase().trim();

  if (!domain) {
    return { valid: false, error: "Email inválido." };
  }

  // 1. Uniforce super-admin
  if (SUPER_ADMIN_DOMAINS.includes(domain)) {
    return UNIFORCE_SENTINEL;
  }

  // 2. Static map (fast path)
  const staticMatch = STATIC_DOMAIN_MAP[domain];
  if (staticMatch) {
    return { valid: true, ...staticMatch };
  }

  // 3. Dynamic DB lookup — try all active ISPs
  try {
    const { data: isps } = await externalSupabase
      .from("isps")
      .select("isp_id, isp_nome, instancia_isp")
      .eq("ativo", true)
      .neq("isp_id", "uniforce");

    if (isps) {
      for (const isp of isps) {
        const candidateDomains = deriveDomainsFromIspId(isp.isp_id);
        if (candidateDomains.includes(domain)) {
          console.info(
            `✅ Domain "${domain}" matched ISP "${isp.isp_id}" via DB derivation`
          );
          return {
            valid: true,
            isp_id: isp.isp_id,
            isp_nome: isp.isp_nome,
            instancia_isp: isp.instancia_isp,
          };
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ DB domain lookup failed, falling back to static map:", err);
  }

  return {
    valid: false,
    error:
      "Domínio de email não autorizado. Entre em contato com o administrador da Uniforce.",
  };
}

/**
 * Ensures a user profile exists in the external Supabase DB.
 *
 * Called by Auth.tsx as a safety net after sign-in, in case the
 * `handle_new_user` trigger didn't run (e.g., legacy accounts).
 * The trigger is the primary mechanism; this is just a fallback.
 */
export async function createUserProfileInExternal(
  userId: string,
  email: string,
  fullName: string,
  ispId: string
): Promise<{ success: boolean; error?: string }> {
  // Resolve ISP metadata
  let instanciaIsp = "";
  let ispNome = ispId;

  try {
    const { data: isp } = await externalSupabase
      .from("isps")
      .select("isp_nome, instancia_isp")
      .eq("isp_id", ispId)
      .maybeSingle();

    if (isp) {
      instanciaIsp = isp.instancia_isp || "";
      ispNome = isp.isp_nome || ispId;
    }
  } catch {
    // Non-fatal; continue with empty instancia_isp
  }

  // Upsert profile
  const { error: profileErr } = await externalSupabase
    .from("profiles")
    .upsert(
      {
        id: userId,
        isp_id: ispId,
        instancia_isp: instanciaIsp,
        full_name: fullName,
        email: email,
      },
      { onConflict: "id" }
    );

  if (profileErr) {
    console.error("❌ Erro ao criar profile:", profileErr);
    return { success: false, error: "Erro ao criar perfil: " + profileErr.message };
  }

  // Upsert default role (super_admin for uniforce, viewer for others)
  const defaultRole = ispId === "uniforce" ? "super_admin" : "viewer";
  const { error: roleErr } = await externalSupabase
    .from("user_roles")
    .upsert(
      {
        user_id: userId,
        isp_id: ispId,
        instancia_isp: instanciaIsp,
        role: defaultRole,
      },
      { onConflict: "user_id,isp_id,role" }
    );

  if (roleErr) {
    console.warn("⚠️ Erro ao criar role (pode já existir):", roleErr.message);
  }

  return { success: true };
}
