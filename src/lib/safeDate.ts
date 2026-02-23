/**
 * Safely parse and format a date string.
 * Returns formatted date or fallback string if invalid.
 */
export function safeFormatDate(
  raw: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = "—"
): string {
  if (!raw) return fallback;
  try {
    const normalized = String(raw).replace(" ", "T");
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return fallback;
    return d.toLocaleDateString("pt-BR", options);
  } catch {
    return fallback;
  }
}

/**
 * Safely parse a date, returning null if invalid.
 */
export function safeParse(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  try {
    const normalized = String(raw).replace(" ", "T");
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}
