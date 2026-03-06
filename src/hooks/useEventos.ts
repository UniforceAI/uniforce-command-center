import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { Evento } from "@/types/evento";
import { useActiveIsp } from "@/hooks/useActiveIsp";

const ESSENTIAL_COLUMNS = [
  "id", "isp_id", "event_type", "event_datetime", "created_at", "updated_at",
  "cliente_id", "cliente_nome", "cliente_email", "cliente_celular",
  "cliente_cidade", "cliente_uf", "cliente_bairro", "cliente_segmento",
  "plano_nome", "valor_mensalidade", "dia_vencimento",
  "servico_status", "status_contrato", "data_instalacao",
  "cobranca_status", "data_vencimento", "data_pagamento",
  "valor_cobranca", "valor_pago", "metodo_cobranca",
  "dias_atraso", "vencido", "data_cancelamento",
  "ultimo_atendimento",
  "nps_score", "nps_comment",
  "churn_risk_score", "churn_risk_bucket",
  "alerta_tipo", "acao_recomendada_1", "acao_recomendada_2", "acao_recomendada_3",
  "ltv_meses_estimado", "ltv_reais_estimado",
  "geo_lat", "geo_lng",
  "downtime_min_24h",
  "rx_dbm", "tx_dbm", "snr_db",
  "instancia_isp",
  "filial_id"
].join(",");

const BATCH_SIZE = 1000;
const MAX_BATCHES = 50; // Increased from 10 to prevent silent truncation

async function fetchEventos(ispId: string): Promise<Evento[]> {
  // Batch 1: recent events
  let allData: any[] = [];
  let hasMore = true;

  for (let i = 0; i < MAX_BATCHES && hasMore; i++) {
    const start = i * BATCH_SIZE;
    const end = start + BATCH_SIZE - 1;

    const { data, error } = await externalSupabase
      .from("eventos")
      .select(ESSENTIAL_COLUMNS)
      .eq("isp_id", ispId)
      .order("event_datetime", { ascending: false })
      .range(start, end);

    if (error) throw error;
    if (data && data.length > 0) {
      allData = [...allData, ...data];
      hasMore = data.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  // Batch 2: all overdue events
  let vencidosData: any[] = [];
  let vencidosHasMore = true;
  let vencidosPage = 0;

  while (vencidosHasMore && vencidosPage < MAX_BATCHES) {
    const start = vencidosPage * BATCH_SIZE;
    const end = start + BATCH_SIZE - 1;

    const { data, error } = await externalSupabase
      .from("eventos")
      .select(ESSENTIAL_COLUMNS)
      .eq("isp_id", ispId)
      .gt("dias_atraso", 0)
      .order("dias_atraso", { ascending: false })
      .range(start, end);

    if (error) {
      console.warn("⚠️ Erro ao buscar vencidos:", error.message);
      break;
    }

    if (data && data.length > 0) {
      vencidosData = [...vencidosData, ...data];
      vencidosHasMore = data.length === BATCH_SIZE;
    } else {
      vencidosHasMore = false;
    }
    vencidosPage++;
  }

  // Merge and deduplicate
  const merged = [...allData, ...vencidosData];
  const uniqueData = Array.from(
    new Map(merged.map(item => [item.id, item])).values()
  );

  console.log(`✅ Eventos: ${allData.length} recentes + ${vencidosData.length} vencidos = ${uniqueData.length} únicos`);
  return uniqueData as Evento[];
}

export function useEventos() {
  const { ispId } = useActiveIsp();

  const { data, isLoading, error } = useQuery({
    queryKey: ["eventos", ispId],
    queryFn: () => fetchEventos(ispId),
    enabled: !!ispId,
    // refetchOnMount removido: herda global false (staleTime 8h cobre sessão completa).
    // F5 / reload: CacheRefreshGuard dispara refetchQueries explicitamente.
  });

  const eventos = data ?? [];
  const columns = useMemo(() => (eventos.length > 0 ? Object.keys(eventos[0]) : []), [eventos]);

  return { eventos, isLoading, error: error?.message ?? null, columns };
}
