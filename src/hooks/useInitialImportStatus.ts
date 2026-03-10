// hooks/useInitialImportStatus.ts
// Verifica se a importação inicial de dados do ISP já foi concluída.
//
// OTIMIZAÇÃO: usa verificação em dois níveis para evitar polling desnecessário:
// 1. Checa isps.import_completed_at (campo leve, sem agregações)
//    → Se já preenchido: retorna 'complete' imediatamente, sem RPC pesado.
// 2. Só chama check_initial_import_status() (query nos eventos/chamados) se
//    import_completed_at ainda é NULL — ou seja, apenas ISPs novos em onboarding.
//
// Status possíveis:
//   'pending'   — nenhum dado importado ainda
//   'importing' — dados chegando, mas passaram menos de 40 min desde o último
//   'complete'  — ≥ 40 min sem novo dado (ou import_completed_at já marcado)

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useUserRole } from "@/hooks/useUserRole";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

// Intervalo de polling enquanto importação ainda está em andamento
const POLL_INTERVAL_MS = 2 * 60 * 1000;

export type ImportStatus = "pending" | "importing" | "complete";

export interface ImportStatusData {
  status: ImportStatus;
  firstRecordAt: string | null;
  lastRecordAt: string | null;
  totalRecords: number;
  importCompletedAt: string | null;
}

export function useInitialImportStatus() {
  const { ispId, ispNome, instanciaIsp } = useActiveIsp();
  const { data: role } = useUserRole();
  const queryClient = useQueryClient();

  const isAdmin = role === "admin" || role === "super_admin";

  // ── Passo 1: consulta leve — só busca import_completed_at do ISP ────────────
  // staleTime longo porque esta flag é write-once: quando vira não-nulo, nunca volta.
  const { data: ispFlag, isLoading: flagLoading } = useQuery<boolean>({
    queryKey: ["isp-import-flag", ispId],
    enabled: !!ispId && isAdmin,
    staleTime: 60 * 60 * 1000, // 1 hora — campo write-once
    queryFn: async () => {
      const { data } = await externalSupabase
        .from("isps")
        .select("import_completed_at")
        .eq("isp_id", ispId)
        .single();
      return data?.import_completed_at != null;
    },
  });

  // ── Passo 2: RPC pesado — só executa se import_completed_at é NULL ──────────
  // Se ispFlag === true (já completo), não executa.
  // Se ispFlag === false (ISP novo), executa com polling a cada 2 min.
  return useQuery<ImportStatusData>({
    queryKey: ["initial-import-status", ispId],
    enabled: !!ispId && isAdmin && flagLoading === false && ispFlag === false,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.status === "complete") return false;
      return POLL_INTERVAL_MS;
    },
    staleTime: POLL_INTERVAL_MS,
    queryFn: async () => {
      const { data, error } = await externalSupabase
        .rpc("check_initial_import_status", { p_isp_id: ispId });

      if (error) throw error;

      const row = data?.[0];
      if (!row) {
        return {
          status: "pending" as ImportStatus,
          firstRecordAt: null,
          lastRecordAt: null,
          totalRecords: 0,
          importCompletedAt: null,
        };
      }

      const result: ImportStatusData = {
        status: (row.status ?? "pending") as ImportStatus,
        firstRecordAt: row.first_record_at ?? null,
        lastRecordAt: row.last_record_at ?? null,
        totalRecords: Number(row.total_records ?? 0),
        importCompletedAt: row.import_completed_at ?? null,
      };

      // Quando importação acabou de completar: atualiza o flag local e envia e-mail
      if (result.status === "complete") {
        const prevData = queryClient.getQueryData<ImportStatusData>([
          "initial-import-status",
          ispId,
        ]);
        const wasNotComplete = !prevData || prevData.status !== "complete";
        if (wasNotComplete) {
          // Atualiza o flag leve para que próximas sessões não pollem
          queryClient.setQueryData(["isp-import-flag", ispId], true);
          sendImportCompleteEmail(ispId!, ispNome, instanciaIsp).catch(() => {});
        }
      }

      return result;
    },
  });
}

async function sendImportCompleteEmail(
  ispId: string,
  ispNome: string,
  instanciaIsp: string
): Promise<void> {
  const { data: sessData } = await externalSupabase.auth.getSession();
  const token = sessData?.session?.access_token;
  if (!token) return;

  await fetch(`${FUNCTIONS_URL}/notify-import-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ isp_id: ispId, isp_nome: ispNome, instancia_isp: instanciaIsp }),
  }).catch(() => {});
}
