import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

const CACHE_KEY = "uf-cache-v1";
const MAX_AGE = 1000 * 60 * 60 * 24; // 24h

/**
 * localStorage-based persister for React Query.
 * - Versioned key to allow easy invalidation on schema changes.
 * - Silently ignores quota errors (graceful degradation).
 */
export function createLocalStoragePersister(): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(client));
      } catch {
        // Quota exceeded — silently skip
      }
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return undefined;
        const parsed: PersistedClient = JSON.parse(raw);
        // If cache is older than 24h, discard
        if (Date.now() - parsed.timestamp > MAX_AGE) {
          localStorage.removeItem(CACHE_KEY);
          return undefined;
        }
        return parsed;
      } catch {
        localStorage.removeItem(CACHE_KEY);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        localStorage.removeItem(CACHE_KEY);
      } catch {}
    },
  };
}
