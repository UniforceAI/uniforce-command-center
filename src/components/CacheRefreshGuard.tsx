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
 * On every browser reload (F5 / Ctrl+F5) it triggers an immediate refetch
 * of all tenant-specific queries, bypassing staleTime and serving fresh data
 * from Supabase regardless of what is cached in localStorage.
 *
 * Normal SPA navigation (no reload) is unaffected: data within staleTime
 * (8h) is served instantly from the in-memory cache without any network call.
 *
 * Why refetchQueries instead of invalidateQueries:
 *   invalidateQueries marks data as stale but relies on refetchOnMount=true
 *   to trigger the actual network call. Since hooks now use refetchOnMount=false
 *   (global default), we call refetchQueries directly to force an immediate
 *   background fetch for all currently-observed queries, and invalidateQueries
 *   for non-observed ones (they will refetch on next mount).
 */
export function CacheRefreshGuard({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { profile, isSuperAdmin, selectedIsp } = useAuth();

  // Capture reload status synchronously at component mount — before any
  // navigation changes the performance entry.
  const isReload = useRef(isPageReload());
  const triggered = useRef(false);

  // Resolve the active ISP id (same logic as useActiveIsp, but without the
  // "agy-telecom" fallback so we don't fire before auth is ready).
  const ispId = isSuperAdmin && selectedIsp
    ? selectedIsp.isp_id
    : profile?.isp_id;

  useEffect(() => {
    if (!ispId || !isReload.current || triggered.current) return;

    triggered.current = true;

    TENANT_QUERY_PREFIXES.forEach((prefix) => {
      const queryKey = [prefix, ispId];
      // refetchQueries: força refetch imediato nos observers ativos (componentes montados).
      // invalidateQueries: marca como stale os não-observados; serão refetchados ao montar.
      queryClient.refetchQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey });
    });

    if (import.meta.env.DEV) {
      console.log(
        `🔄 CacheRefreshGuard: reload detectado — refetch forçado para ISP "${ispId}"`
      );
    }
  }, [ispId, queryClient]);

  return <>{children}</>;
}
