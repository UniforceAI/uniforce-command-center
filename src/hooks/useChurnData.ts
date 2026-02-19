import { useState, useEffect } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";

export interface ChurnStatus {
  id: string;
  isp_id: string;
  cliente_id: number;
  cliente_nome: string;
  cliente_cidade: string;
  cliente_uf: string;
  cliente_bairro?: string;
  plano_nome: string;
  valor_mensalidade: number;
  status_churn: string; // 'ativo' | 'risco' | 'cancelado'
  churn_risk_score?: number;
  churn_risk_bucket?: string;
  dias_em_risco?: number;
  data_cancelamento?: string;
  motivo_risco_principal?: string;
  qtd_chamados_30d?: number;
  qtd_chamados_90d?: number;
  nps_ultimo_score?: number;
  dias_atraso?: number;
  ltv_estimado?: number;
  tempo_cliente_meses?: number;
  score_financeiro?: number;
  score_atendimento?: number;
  score_nps?: number;
  score_uso?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: any;
}

export interface ChurnEvent {
  id: string;
  isp_id: string;
  cliente_id: number;
  event_type: string;
  event_date: string;
  score_before?: number;
  score_after?: number;
  motivo?: string;
  detalhes?: string;
  created_at?: string;
  [key: string]: any;
}

export function useChurnData() {
  const { ispId } = useActiveIsp();
  const [churnStatus, setChurnStatus] = useState<ChurnStatus[]>([]);
  const [churnEvents, setChurnEvents] = useState<ChurnEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        console.log(`🔄 Buscando churn_status (isp_id=${ispId})...`);

        // Fetch churn_status in sequential batches
        const BATCH_SIZE = 1000;
        const MAX_STATUS_BATCHES = 20;
        let allStatus: any[] = [];
        let hasMore = true;

        for (let i = 0; i < MAX_STATUS_BATCHES && hasMore; i++) {
          if (cancelled) return;
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;

          const { data, error: batchError } = await externalSupabase
            .from("churn_status")
            .select("*")
            .eq("isp_id", ispId)
            .range(start, end);

          if (batchError) throw batchError;

          if (data && data.length > 0) {
            allStatus = [...allStatus, ...data];
            hasMore = data.length === BATCH_SIZE;
          } else {
            hasMore = false;
          }
        }

        if (cancelled) return;
        console.log(`✅ churn_status: ${allStatus.length}`);
        if (allStatus.length > 0) {
          console.log("📋 Amostra churn_status colunas:", Object.keys(allStatus[0]).join(", "));
        }
        setChurnStatus(allStatus as ChurnStatus[]);

        // Fetch churn_events — apenas 3 batches (3k registros)
        let allEvents: any[] = [];
        hasMore = true;

        for (let i = 0; i < 3 && hasMore; i++) {
          if (cancelled) return;
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;

          const { data, error: batchError } = await externalSupabase
            .from("churn_events")
            .select("*")
            .eq("isp_id", ispId)
            .order("event_date", { ascending: false })
            .range(start, end);

          if (batchError) {
            console.warn("churn_events error (tabela pode não existir):", batchError.message);
            break;
          }

          if (data && data.length > 0) {
            allEvents = [...allEvents, ...data];
            hasMore = data.length === BATCH_SIZE;
          } else {
            hasMore = false;
          }
        }

        if (cancelled) return;
        console.log(`✅ churn_events: ${allEvents.length}`);
        setChurnEvents(allEvents as ChurnEvent[]);

      } catch (err: any) {
        if (cancelled) return;
        console.error("❌ Erro useChurnData:", err);
        setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [ispId]);

  return { churnStatus, churnEvents, isLoading, error };
}
