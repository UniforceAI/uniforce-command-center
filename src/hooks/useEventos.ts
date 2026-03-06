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
const MAX_RECORDS = 50_000; // safety cap
const PARALLEL_LIMIT = 6;   // max simultaneous requests per round

/**
 * Busca todas as páginas de uma query de eventos em paralelo.
 * @param count - total de registros (obtido via HEAD request)
 * @param buildQuery - factory que recebe (from, end) e retorna a query pronta com .range()
 */
async function fetchEventosBatches(
  count: number,
  buildQuery: (from: number, to: number) => ReturnType<typeof externalSupabase.from>
): Promise<any[]> {
  const total = Math.min(count, MAX_RECORDS);
  const totalPages = Math.ceil(total / BATCH_SIZE);
  const allData: any[] = [];

  for (let start = 0; start < totalPages; start += PARALLEL_LIMIT) {
    const end = Math.min(start + PARALLEL_LIMIT, totalPages);
    const results = await Promise.all(
      Array.from({ length: end - start }, (_, i) => start + i).map(page =>
        buildQuery(page * BATCH_SIZE, Math.min((page + 1) * BATCH_SIZE - 1, total - 1))
      )
    );
    for (const { data, error } of results) {
      if (error) throw error;
      if (data?.length) allData.push(...data);
    }
  }
  return allData;
}

async function fetchEventos(ispId: string): Promise<Evento[]> {
  // Step 1: dois COUNTs em paralelo (HEAD — sem body, muito leve)
  const [countRecentes, countVencidos] = await Promise.all([
    externalSupabase
      .from("eventos")
      .select("*", { count: "exact", head: true })
      .eq("isp_id", ispId),
    externalSupabase
      .from("eventos")
      .select("*", { count: "exact", head: true })
      .eq("isp_id", ispId)
      .gt("dias_atraso", 0),
  ]);

  // Se COUNT falhar, fallback sequencial
  if (countRecentes.error || countRecentes.count === null) {
    console.warn("⚠️ COUNT falhou para eventos — usando busca sequencial");
    return fetchEventosSequential(ispId);
  }

  // Step 2: busca paralela dos dois conjuntos em sequência
  // (sequencial entre si para não sobrecarregar o pool de conexões)
  const allRecentes = await fetchEventosBatches(
    countRecentes.count,
    (from, to) => externalSupabase
      .from("eventos")
      .select(ESSENTIAL_COLUMNS)
      .eq("isp_id", ispId)
      .order("event_datetime", { ascending: false })
      .range(from, to)
  );

  const allVencidos = countVencidos.count && countVencidos.count > 0
    ? await fetchEventosBatches(
        countVencidos.count,
        (from, to) => externalSupabase
          .from("eventos")
          .select(ESSENTIAL_COLUMNS)
          .eq("isp_id", ispId)
          .gt("dias_atraso", 0)
          .order("dias_atraso", { ascending: false })
          .range(from, to)
      )
    : [];

  // Step 3: merge + dedup por id (vencidos que já estão em recentes são ignorados)
  const dedup = new Map<string, any>();
  for (const item of allRecentes) dedup.set(item.id, item);
  for (const item of allVencidos) if (!dedup.has(item.id)) dedup.set(item.id, item);

  const uniqueData = Array.from(dedup.values());
  console.log(`✅ Eventos: ${allRecentes.length} recentes + ${allVencidos.length} vencidos = ${uniqueData.length} únicos`);
  return uniqueData as Evento[];
}

// Fallback sequencial — usado se COUNT falhar
async function fetchEventosSequential(ispId: string): Promise<Evento[]> {
  const MAX_SEQ = Math.ceil(MAX_RECORDS / BATCH_SIZE);
  let allData: any[] = [];
  let vencidosData: any[] = [];

  for (let i = 0; i < MAX_SEQ; i++) {
    const { data, error } = await externalSupabase
      .from("eventos").select(ESSENTIAL_COLUMNS).eq("isp_id", ispId)
      .order("event_datetime", { ascending: false }).range(i * BATCH_SIZE, (i + 1) * BATCH_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    allData = allData.concat(data);
    if (data.length < BATCH_SIZE) break;
  }
  for (let i = 0; i < MAX_SEQ; i++) {
    const { data, error } = await externalSupabase
      .from("eventos").select(ESSENTIAL_COLUMNS).eq("isp_id", ispId).gt("dias_atraso", 0)
      .order("dias_atraso", { ascending: false }).range(i * BATCH_SIZE, (i + 1) * BATCH_SIZE - 1);
    if (error) { console.warn("⚠️ vencidos:", error.message); break; }
    if (!data?.length) break;
    vencidosData = vencidosData.concat(data);
    if (data.length < BATCH_SIZE) break;
  }

  const dedup = new Map<string, any>();
  for (const item of [...allData, ...vencidosData]) dedup.set(item.id, item);
  return Array.from(dedup.values()) as Evento[];
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
