// src/hooks/usePageFilters.ts
// VERSÃO: session-infra-v1.2 (revisão final)
// Correções v1.1:
//   - BroadcastChannel: flag de loop prevention usa origem por ID (não flag global assíncrona)
//   - isPageReload() fallback deprecated removido; apenas getEntriesByType
//   - readFromStorage mescla tipado com validação de undefined
//   - Tipo de message do BroadcastChannel validado antes de aplicar
// Correções v1.2:
//   - stableDefaults: useMemo → useRef (evita re-compute com valores array/object nos defaults)
//   - isInitialMountRef: evita double-render no mount (useState + useEffect lendo storage 2x)

import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type FilterValue = string | number | boolean | string[] | null;
export type FilterMap   = Record<string, FilterValue>;

interface StoredFilters {
  filters: FilterMap;
  _session_ts: number;
}

interface BroadcastMessage {
  pageKey: string;
  ispId: string;
  filters: FilterMap;
  sourceId: string; // ID único por instância para evitar self-echo
}

interface UsePageFiltersOptions<T extends FilterMap> {
  pageKey: string;
  ispId: string | null | undefined;
  defaults: T;
}

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const STORAGE_VERSION   = "v3";
const SESSION_START_KEY = "uf_session_start";
const BROADCAST_CHANNEL = "uf_filters";

// ID único por instância do hook (distingue de mensagens próprias no BroadcastChannel)
const INSTANCE_ID = Math.random().toString(36).slice(2);

// ─────────────────────────────────────────────────────────────
// localStorage helpers (com try-catch)
// ─────────────────────────────────────────────────────────────

function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota exceeded */ }
}
function lsRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* incognito */ }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function storageKey(ispId: string, pageKey: string): string {
  return `uf_filters_${STORAGE_VERSION}_${ispId}_${pageKey}`;
}

function isPageReload(): boolean {
  try {
    const entries = performance.getEntriesByType("navigation");
    if (entries.length > 0) {
      return (entries[0] as PerformanceNavigationTiming).type === "reload";
    }
  } catch { /* SSR or unsupported */ }
  return false;
}

function getSessionStart(): number {
  return parseInt(lsGet(SESSION_START_KEY) ?? "0", 10) || 0;
}

function readFromStorage<T extends FilterMap>(
  key: string,
  defaults: T,
  sessionStart: number
): T {
  try {
    const raw = lsGet(key);
    if (!raw) return defaults;

    const stored: StoredFilters = JSON.parse(raw);

    // Dados de sessão anterior → ignorar
    if (!stored._session_ts || (sessionStart > 0 && stored._session_ts < sessionStart)) {
      return defaults;
    }

    // Mesclar com defaults: garante que novas chaves (adicionadas em updates) existam
    // Usar defaults como base, sobrescrever apenas com valores definidos (não undefined)
    const merged = { ...defaults };
    for (const [k, v] of Object.entries(stored.filters)) {
      if (k in defaults && v !== undefined) {
        (merged as FilterMap)[k] = v;
      }
    }
    return merged;
  } catch {
    return defaults;
  }
}

function writeToStorage(key: string, filters: FilterMap): void {
  const sessionStart = getSessionStart();
  const entry: StoredFilters = {
    filters,
    _session_ts: sessionStart || Date.now(), // fallback para evitar 0
  };
  lsSet(key, JSON.stringify(entry));
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function usePageFilters<T extends FilterMap>({
  pageKey,
  ispId,
  defaults,
}: UsePageFiltersOptions<T>): {
  filters: T;
  setFilter: (key: keyof T, value: FilterValue) => void;
  resetFilters: () => void;
} {
  // Estabilizar defaults com useRef: captura do primeiro render, nunca re-computa.
  // useMemo(() => defaults, Object.values(defaults)) quebrava para arrays/objects em defaults:
  // Object.values() retorna refs — array inline criada a cada render muda a dep → loop de invalidação.
  const stableDefaultsRef = useRef<T>(defaults);
  const stableDefaults = stableDefaultsRef.current;

  const key = ispId ? storageKey(ispId, pageKey) : null;

  // Previne double-render no mount: useState lê storage no initializer (síncrono);
  // o useEffect de re-sync também roda no primeiro mount — sem guard causaria render extra.
  const isInitialMountRef = useRef(true);

  // Inicializar estado: reset em reload ou sessão nova; restaurar caso contrário
  const [filters, setFiltersState] = useState<T>(() => {
    if (!key || isPageReload()) return stableDefaultsRef.current;
    return readFromStorage(key, stableDefaultsRef.current, getSessionStart());
  });

  // BroadcastChannel para sincronização entre tabs
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (!key || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(BROADCAST_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (e: MessageEvent<BroadcastMessage>) => {
      const msg = e.data;
      // Validar estrutura da mensagem antes de aplicar
      if (!msg || typeof msg !== "object") return;
      if (msg.pageKey !== pageKey || msg.ispId !== ispId) return;
      if (msg.sourceId === INSTANCE_ID) return; // mensagem nossa: ignorar
      if (!msg.filters || typeof msg.filters !== "object") return;

      // Mesclar com defaults para garantir schema correto
      const merged = { ...stableDefaults };
      for (const [k, v] of Object.entries(msg.filters)) {
        if (k in stableDefaults && v !== undefined) {
          (merged as FilterMap)[k] = v;
        }
      }
      setFiltersState(merged as T);
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [key, pageKey, ispId, stableDefaults]);

  // Re-sincronizar quando key muda (ISP troca, login/logout)
  // Pula o primeiro mount: useState já inicializou a partir do storage no initializer.
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }
    if (!key) {
      setFiltersState(stableDefaults);
      return;
    }
    // Não resetar em reload aqui (já foi tratado no useState inicial)
    const stored = readFromStorage(key, stableDefaults, getSessionStart());
    setFiltersState(stored);
  }, [key, stableDefaults]);

  const setFilter = useCallback((filterKey: keyof T, value: FilterValue) => {
    setFiltersState((prev) => {
      const next = { ...prev, [filterKey]: value } as T;
      if (key) {
        writeToStorage(key, next);

        // Broadcast para outras tabs com ID desta instância (evita self-echo)
        if (channelRef.current) {
          const msg: BroadcastMessage = {
            pageKey,
            ispId: ispId!,
            filters: next,
            sourceId: INSTANCE_ID,
          };
          channelRef.current.postMessage(msg);
        }
      }
      return next;
    });
  }, [key, pageKey, ispId]);

  const resetFilters = useCallback(() => {
    setFiltersState(stableDefaults);
    if (key) lsRemove(key);
  }, [key, stableDefaults]);

  return { filters, setFilter, resetFilters };
}
