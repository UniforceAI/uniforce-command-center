import { useState, useEffect } from "react";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { isPageReload } from "@/lib/refreshDetector";

// Module-level: persists across React remounts within the same browser page session.
// Cleared automatically on actual page reload (F5) because the module re-evaluates from scratch.
// This prevents `isPageReload()` from being misread as `true` on Supabase-triggered React remounts.
const _mountedOnce = new Set<string>();

function storageKey(ispId: string, pageKey: string) {
  return `uf_filters_v1_${ispId || "default"}_${pageKey}`;
}

function readStored<T>(key: string, defaults: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) }; // merge garante novos campos
  } catch {
    return defaults;
  }
}

export function usePageFilters<T extends Record<string, unknown>>(
  pageKey: string,
  defaults: T
) {
  const { ispId } = useActiveIsp();
  const key = storageKey(ispId || "default", pageKey);

  const [filters, setFilters] = useState<T>(() => {
    const firstMount = !_mountedOnce.has(key);
    _mountedOnce.add(key);
    // Only reset on genuine page reload (F5) — only on the FIRST mount of this key.
    // React remounts caused by Supabase SIGNED_IN re-sync are NOT reloads:
    // `_mountedOnce` prevents the stale navigation.type from triggering defaults.
    if (firstMount && isPageReload()) return defaults;
    return readStored(key, defaults);
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(filters));
    } catch {}
  }, [filters, key]);

  const setFilter = <K extends keyof T>(filterKey: K, value: T[K]) =>
    setFilters((prev) => ({ ...prev, [filterKey]: value }));

  const resetFilters = () => {
    setFilters(defaults);
    try {
      sessionStorage.removeItem(key);
    } catch {}
  };

  return { filters, setFilter, resetFilters };
}
