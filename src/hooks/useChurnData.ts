import { useState, useEffect } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";

export interface ChurnStatus {
  id: string;
  isp_id: string;
  instancia_isp: string;
  cliente_id: number;
  id_contrato: string | null;
  // Cliente
  cliente_nome: string | null;
  cliente_cidade: string | null;
  cliente_bairro: string | null;
  plano_nome: string | null;
  valor_mensalidade: number | null;
  ltv_estimado: number | null;
  ltv_meses_estimado: number | null;
  tempo_cliente_meses: number | null;
  data_instalacao: string | null;
  // Status e risco
  status_churn: "ativo" | "risco" | "cancelado";
  churn_risk_score: number;
  churn_risk_bucket: string | null;
  dias_em_risco: number;
  motivo_risco_principal: string | null;
  data_cancelamento: string | null;
  // Status do contrato (IXC)
  status_internet: string | null;
  status_contrato: string | null;
  fidelidade: string | null;
  fidelidade_expiracao: string | null;
  desbloqueio_confianca: string | null;
  // Financeiro
  dias_atraso: number | null;
  faixa_atraso: string | null;
  ultimo_pagamento_data: string | null;
  // Suporte
  qtd_chamados_30d: number;
  qtd_chamados_90d: number;
  ultimo_atendimento_data: string | null;
  // NPS
  nps_ultimo_score: number | null;
  nps_classificacao: string | null;
  // Scores
  score_financeiro: number;
  score_suporte: number;
  score_qualidade: number;
  score_nps: number;
  score_comportamental: number;
  // Timestamps
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

export function useChurnData() {
  const { ispId } = useActiveIsp();
  const [churnStatus, setChurnStatus] = useState<ChurnStatus[]>([]);
  const [churnEvents, setChurnEvents] = useState<ChurnEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ispId) return;

    const fetchAll = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Fetch churn_status with pagination to get all records
        let allStatus: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error: statusErr } = await externalSupabase
            .from("churn_status")
            .select("*")
            .eq("isp_id", ispId)
            .order("churn_risk_score", { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (statusErr) throw statusErr;
          if (!data || data.length === 0) break;
          allStatus = allStatus.concat(data);
          if (data.length < pageSize) break;
          page++;
        }

        console.log(`✅ useChurnData: ${allStatus.length} registros de churn_status para ${ispId}`);
        setChurnStatus(allStatus as ChurnStatus[]);

        // Fetch churn_events (últimos 90 dias)
        const since = new Date();
        since.setDate(since.getDate() - 90);
        const { data: eventsData, error: eventsErr } = await externalSupabase
          .from("churn_events")
          .select("*")
          .eq("isp_id", ispId)
          .gte("data_evento", since.toISOString())
          .order("data_evento", { ascending: false })
          .limit(1000);

        if (eventsErr) {
          console.warn("⚠️ Erro ao carregar churn_events:", eventsErr.message);
          // Não bloqueia — eventos são opcionais
        } else {
          setChurnEvents((eventsData as ChurnEvent[]) || []);
        }
      } catch (e: any) {
        console.error("❌ useChurnData error:", e);
        setError(e.message || "Erro ao carregar dados de churn");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAll();
  }, [ispId]);

  return { churnStatus, churnEvents, isLoading, error };
}
