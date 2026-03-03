/**
 * churnUnified.ts — Single Source of Truth for Churn Calculation
 *
 * Primary source: eventos.data_cancelamento (deduplicado por cliente_id)
 * Fallback: churn_status com status_churn === "cancelado" para clientes
 *           não encontrados em eventos
 * Enrichment: churn_status fornece scores, motivos, buckets
 *
 * Denominador: clientes únicos da base de eventos (mesma lógica da Visão Geral)
 */

import { Evento } from "@/types/evento";
import { ChurnStatus } from "@/hooks/useChurnData";

/**
 * Convert an Evento record into a ChurnStatus-compatible object.
 * Used when a client has a cancellation in eventos but no record in churn_status.
 */
export function eventoToChurnStatus(e: Evento): ChurnStatus {
  return {
    id: e.id,
    isp_id: e.isp_id,
    instancia_isp: e.instancia_isp || "",
    cliente_id: e.cliente_id,
    id_contrato: e.id_contrato != null ? String(e.id_contrato) : null,
    cliente_nome: e.cliente_nome || null,
    cliente_cidade: e.cliente_cidade || null,
    cliente_bairro: e.cliente_bairro || null,
    plano_nome: e.plano_nome || null,
    valor_mensalidade: e.valor_mensalidade || null,
    ltv_estimado: e.ltv_reais_estimado || null,
    ltv_meses_estimado: e.ltv_meses_estimado || null,
    tempo_cliente_meses: null,
    data_instalacao: e.data_instalacao || null,
    status_churn: "cancelado",
    churn_risk_score: e.churn_risk_score || 0,
    churn_risk_bucket: e.churn_risk_bucket || null,
    dias_em_risco: 0,
    motivo_risco_principal: null,
    data_cancelamento: e.data_cancelamento || null,
    status_internet: e.servico_status || null,
    status_contrato: e.status_contrato || null,
    fidelidade: null,
    fidelidade_expiracao: null,
    desbloqueio_confianca: null,
    dias_atraso: e.dias_atraso != null ? e.dias_atraso : null,
    faixa_atraso: null,
    ultimo_pagamento_data: e.data_pagamento || null,
    qtd_chamados_30d: 0,
    qtd_chamados_90d: 0,
    ultimo_atendimento_data: e.ultimo_atendimento || null,
    nps_ultimo_score: e.nps_score != null ? e.nps_score : null,
    nps_classificacao: null,
    score_financeiro: 0,
    score_suporte: 0,
    score_qualidade: 0,
    score_nps: 0,
    score_comportamental: 0,
    created_at: e.created_at,
    updated_at: e.updated_at,
  };
}

/**
 * Build unified cancelados list from eventos (primary) + churn_status (fallback/enrichment).
 * Returns ChurnStatus[] so downstream code (table, charts, cohort) works unchanged.
 */
export function buildUnifiedCancelados(
  eventos: Evento[],
  churnStatus: ChurnStatus[]
): ChurnStatus[] {
  // Build churn_status lookup by cliente_id (keep highest score per client)
  const csMap = new Map<number, ChurnStatus>();
  churnStatus.forEach(cs => {
    const existing = csMap.get(cs.cliente_id);
    if (!existing || cs.churn_risk_score > existing.churn_risk_score) {
      csMap.set(cs.cliente_id, cs);
    }
  });

  // ALL-OR-NOTHING logic (same as Visão Geral):
  // If eventos has ANY data_cancelamento → use ONLY eventos
  // Otherwise → use ONLY churn_status
  const hasEventosCancelamento = eventos.some(e => !!e.data_cancelamento);



  const canceladosMap = new Map<number, ChurnStatus>();

  if (hasEventosCancelamento) {
    // Primary source: eventos only (deduplicated by cliente_id)
    eventos.forEach(e => {
      if (!e.data_cancelamento) return;
      if (canceladosMap.has(e.cliente_id)) return;

      const cs = csMap.get(e.cliente_id);
      if (cs) {
        // Enrich with churn_status data but use eventos date
        canceladosMap.set(e.cliente_id, {
          ...cs,
          data_cancelamento: e.data_cancelamento,
          status_churn: "cancelado",
        });
      } else {
        // No churn_status record — create synthetic from evento
        canceladosMap.set(e.cliente_id, eventoToChurnStatus(e));
      }
    });
  } else {
    // Fallback: use ONLY churn_status cancelados
    churnStatus.forEach(cs => {
      if (cs.status_churn !== "cancelado") return;
      if (canceladosMap.has(cs.cliente_id)) return;
      canceladosMap.set(cs.cliente_id, cs);
    });
  }

  return Array.from(canceladosMap.values());
}

/**
 * Compute totalClientesBase from eventos — deduplicated by cliente_id.
 * Optionally filter by dimension (same filters as Visão Geral).
 */
export function getTotalClientesBase(
  eventos: Evento[],
  filters?: { cidade?: string; bairro?: string; plano?: string; filial?: string }
): number {
  let filtered = eventos;
  if (filters) {
    if (filters.cidade && filters.cidade !== "todos")
      filtered = filtered.filter(e => e.cliente_cidade === filters.cidade);
    if (filters.bairro && filters.bairro !== "todos")
      filtered = filtered.filter(e => e.cliente_bairro === filters.bairro);
    if (filters.plano && filters.plano !== "todos")
      filtered = filtered.filter(e => e.plano_nome === filters.plano);
    if (filters.filial && filters.filial !== "todos")
      filtered = filtered.filter(e => String(e.filial_id) === filters.filial);
  }

  const ids = new Set<number>();
  filtered.forEach(e => ids.add(e.cliente_id));
  return ids.size;
}

