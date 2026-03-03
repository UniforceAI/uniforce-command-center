/**
 * churnUnified.ts — Single Source of Truth for Churn Calculation
 *
 * Source: EXCLUSIVELY churn_status table (no more eventos dependency)
 * Cancelados: churn_status.filter(s => s.status_churn === 'cancelado' && s.data_cancelamento != null)
 * Total base: all unique cliente_id in churn_status
 */

import { ChurnStatus } from "@/hooks/useChurnData";

/**
 * Get cancelados from churn_status — simple filter, no more unification needed.
 */
export function getCancelados(churnStatus: ChurnStatus[]): ChurnStatus[] {
  const canceladosMap = new Map<number, ChurnStatus>();
  churnStatus.forEach(cs => {
    if (cs.status_churn !== "cancelado") return;
    if (!cs.data_cancelamento) return;
    const existing = canceladosMap.get(cs.cliente_id);
    if (!existing || (cs.churn_risk_score > existing.churn_risk_score)) {
      canceladosMap.set(cs.cliente_id, cs);
    }
  });
  return Array.from(canceladosMap.values());
}

/**
 * Compute totalClientesBase from churn_status — deduplicated by cliente_id.
 * Optionally filter by dimension.
 */
export function getTotalClientesBase(
  churnStatus: ChurnStatus[],
  filters?: { cidade?: string; bairro?: string; plano?: string }
): number {
  let filtered = churnStatus;
  if (filters) {
    if (filters.cidade && filters.cidade !== "todos")
      filtered = filtered.filter(cs => cs.cliente_cidade === filters.cidade);
    if (filters.bairro && filters.bairro !== "todos")
      filtered = filtered.filter(cs => cs.cliente_bairro === filters.bairro);
    if (filters.plano && filters.plano !== "todos")
      filtered = filtered.filter(cs => cs.plano_nome === filters.plano);
  }

  const ids = new Set<number>();
  filtered.forEach(cs => ids.add(cs.cliente_id));
  return ids.size;
}
