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
    if (!existing) {
      canceladosMap.set(cs.cliente_id, cs);
      return;
    }
    // Prefere o cancelamento mais recente (cliente pode ter múltiplos contratos cancelados).
    // Isso garante que o filtro de período em Cancelamentos.tsx e VisaoGeral.tsx
    // operem sobre a mesma data que ambas as páginas usam como referência.
    // Tie-break: maior churn_risk_score quando as datas são iguais.
    if (cs.data_cancelamento > existing.data_cancelamento! ||
      (cs.data_cancelamento === existing.data_cancelamento &&
        (cs.churn_risk_score ?? 0) > (existing.churn_risk_score ?? 0))) {
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
