import { useState, useEffect } from "react";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { isPageReload } from "@/lib/refreshDetector";

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

  const [filters, setFilters] = useState<T>(() =>
    isPageReload() ? defaults : readStored(key, defaults)
  );

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
