import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";

export interface ChurnStatus {
  id: string;
  isp_id: string;
  instancia_isp: string;
  cliente_id: number;
  id_contrato: string | null;
  cliente_nome: string | null;
  cliente_cidade: string | null;
  cliente_bairro: string | null;
  plano_nome: string | null;
  valor_mensalidade: number | null;
  ltv_estimado: number | null;
  ltv_meses_estimado: number | null;
  tempo_cliente_meses: number | null;
  data_instalacao: string | null;
  status_churn: "ativo" | "risco" | "cancelado";
  churn_risk_score: number;
  churn_risk_bucket: string | null;
  dias_em_risco: number;
  motivo_risco_principal: string | null;
  data_cancelamento: string | null;
  status_internet: string | null;
  status_contrato: string | null;
  fidelidade: string | null;
  fidelidade_expiracao: string | null;
  desbloqueio_confianca: string | null;
  dias_atraso: number | null;
  faixa_atraso: string | null;
  ultimo_pagamento_data: string | null;
  qtd_chamados_30d: number;
  qtd_chamados_90d: number;
  ultimo_atendimento_data: string | null;
  nps_ultimo_score: number | null;
  nps_classificacao: string | null;
  score_financeiro: number;
  score_suporte: number;
  score_qualidade: number;
  score_nps: number;
  score_comportamental: number;
  created_at: string;
  updated_at: string;
}

export interface ChurnEvent {
  id: string;
  isp_id: string;
  cliente_id: number;
  id_contrato: string | null;
  tipo_evento: string;
  peso_evento: number;
  impacto_score: number;
  descricao: string | null;
  dados_evento: Record<string, any> | null;
  data_evento: string;
  created_at: string;
}

const BATCH_SIZE = 1000;
const MAX_BATCHES = 50; // Increased from 10 to prevent silent truncation (supports up to 50k records)

async function fetchChurnStatus(ispId: string): Promise<ChurnStatus[]> {
  let allStatus: any[] = [];
  let page = 0;
  while (page < MAX_BATCHES) {
    const { data, error } = await externalSupabase
      .from("churn_status")
      .select("*")
      .eq("isp_id", ispId)
      .order("updated_at", { ascending: false }) // updated_at reflete churns recém-detectados pelo cron
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    allStatus = allStatus.concat(data);
    if (data.length < BATCH_SIZE) break;
    page++;
  }
  console.log(`✅ useChurnData: ${allStatus.length} registros de churn_status (${page + 1} páginas)`);
  return allStatus as ChurnStatus[];
}

async function fetchChurnEvents(ispId: string): Promise<ChurnEvent[]> {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const { data, error } = await externalSupabase
    .from("churn_events")
    .select("*")
    .eq("isp_id", ispId)
    .gte("data_evento", since.toISOString())
    .order("data_evento", { ascending: false })
    .limit(1000);

  if (error) {
    console.warn("⚠️ Erro ao carregar churn_events:", error.message);
    return [];
  }
  return (data as ChurnEvent[]) || [];
}

export function useChurnData() {
  const { ispId } = useActiveIsp();

  const statusQuery = useQuery({
    queryKey: ["churn-status", ispId],
    queryFn: () => fetchChurnStatus(ispId),
    enabled: !!ispId,
    refetchOnMount: true,
  });

  const eventsQuery = useQuery({
    queryKey: ["churn-events", ispId],
    queryFn: () => fetchChurnEvents(ispId),
    enabled: !!ispId,
    refetchOnMount: true,
  });

  return {
    churnStatus: statusQuery.data ?? [],
    churnEvents: eventsQuery.data ?? [],
    isLoading: statusQuery.isLoading || eventsQuery.isLoading,
    error: statusQuery.error?.message ?? eventsQuery.error?.message ?? null,
  };
}
