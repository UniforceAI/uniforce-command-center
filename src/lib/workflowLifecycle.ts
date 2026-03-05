/**
 * Pure utility functions for CRM lifecycle management.
 * Used by ClientesEmRisco and KanbanBoard.
 */

/** Count full calendar days between two dates (ignoring time). */
export function countCalendarDays(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const fromDay = Math.floor(from.getTime() / msPerDay);
  const toDay = Math.floor(to.getTime() / msPerDay);
  return toDay - fromDay;
}

/** Count business days (Mon–Fri) between two dates. */
export function countBusinessDays(from: Date, to: Date): number {
  let count = 0;
  const current = new Date(from);
  current.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (current < end) {
    current.setDate(current.getDate() + 1);
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Returns true if any score dimension in `current` is strictly higher
 * than the corresponding value in `snapshot` (a new churn signal appeared).
 */
export function hasNewSignal(
  current: {
    score_financeiro?: number | null;
    score_suporte?: number | null;
    score_qualidade?: number | null;
    score_nps?: number | null;
    score_comportamental?: number | null;
    dias_atraso?: number | null;
  },
  snapshot: Record<string, number>
): boolean {
  const fields: Array<[string, number | null | undefined]> = [
    ["financeiro", current.score_financeiro],
    ["suporte", current.score_suporte],
    ["qualidade", current.score_qualidade],
    ["nps", current.score_nps],
    ["comportamental", current.score_comportamental],
    ["dias_atraso", current.dias_atraso],
  ];
  return fields.some(([key, val]) => (val ?? 0) > (snapshot[key] ?? 0));
}
