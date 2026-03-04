import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { isPageReload } from "@/lib/refreshDetector";

/**
 * All React Query cache keys that hold tenant-specific data.
 * When the user reloads the browser (F5 / Ctrl+F5), every entry
 * here is invalidated for the active ISP so the next render fetches
 * fresh data from the database instead of serving the persisted cache.
 */
const TENANT_QUERY_PREFIXES = [
  "churn-status",
  "churn-events",
  "chamados",
  "eventos",
  "nps-data",
  "crm-workflow",
  "risk-bucket-config",
] as const;

/**
 * CacheRefreshGuard
 *
 * Must be rendered inside <AuthProvider> and inside
 * <PersistQueryClientProvider> (i.e. inside App.tsx provider tree).
 *
 * On every browser reload it invalidates the current tenant's cached
 * queries so that stale data from localStorage is immediately replaced
 * by a fresh fetch from Supabase.
 *
 * Normal SPA navigation (no reload) is unaffected: data within staleTime
 * is still served instantly from the in-memory cache.
 */
export function CacheRefreshGuard({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { profile, isSuperAdmin, selectedIsp } = useAuth();

  // Capture reload status synchronously at component mount — before any
  // navigation changes the performance entry.
  const isReload = useRef(isPageReload());
  const invalidated = useRef(false);

  // Resolve the active ISP id (same logic as useActiveIsp, but without the
  // "agy-telecom" fallback so we don't invalidate before auth is ready).
  const ispId = isSuperAdmin && selectedIsp
    ? selectedIsp.isp_id
    : profile?.isp_id;

  useEffect(() => {
    if (!ispId || !isReload.current || invalidated.current) return;

    invalidated.current = true;

    TENANT_QUERY_PREFIXES.forEach((prefix) => {
      queryClient.invalidateQueries({ queryKey: [prefix, ispId] });
    });

    if (import.meta.env.DEV) {
      console.log(
        `🔄 CacheRefreshGuard: reload detectado — invalidando cache para ISP "${ispId}"`
      );
    }
  }, [ispId, queryClient]);

  return <>{children}</>;
}
