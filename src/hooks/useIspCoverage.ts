import { useState, useEffect, useCallback } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";

const BRAZIL_BOUNDS = { minLat: -34, maxLat: 6, minLng: -74, maxLng: -28 };
const STALE_DAYS = 7;
const MAX_GEO_ROWS = 5000;

export interface IspCoverageArea {
  id: string;
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
  client_count: number;
  area_km2: number | null;
  calculated_at: string;
}

export interface UseIspCoverageResult {
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } | undefined;
  coverage: IspCoverageArea | null;
  loading: boolean;
  isRecalculating: boolean;
  recalculate: () => void;
}

interface GeoPoint {
  geo_lat: number;
  geo_lng: number;
  filial_id: number | null;
}

function computeBoundsFromPoints(
  points: GeoPoint[],
  filialIdFilter: number | null
): {
  min_lat: number; max_lat: number; min_lng: number; max_lng: number;
  client_count: number; area_km2: number | null;
  p5_lat: number; p95_lat: number; p5_lng: number; p95_lng: number;
} | null {
  // Step 1: validate Brazil bounds + exclude zeros
  let valid = points.filter(
    (p) =>
      p.geo_lat && p.geo_lng &&
      !isNaN(p.geo_lat) && !isNaN(p.geo_lng) &&
      p.geo_lat >= BRAZIL_BOUNDS.minLat && p.geo_lat <= BRAZIL_BOUNDS.maxLat &&
      p.geo_lng >= BRAZIL_BOUNDS.minLng && p.geo_lng <= BRAZIL_BOUNDS.maxLng
  );

  // Step 2: filter by filial if specified
  if (filialIdFilter !== null && filialIdFilter !== 0) {
    valid = valid.filter((p) => p.filial_id === filialIdFilter);
  }

  if (valid.length === 0) return null;

  // Step 3: percentile bounds (P5/P95 if >= 50 points, else min/max)
  const lats = valid.map((p) => p.geo_lat).sort((a, b) => a - b);
  const lngs = valid.map((p) => p.geo_lng).sort((a, b) => a - b);
  const count = valid.length;

  // P2/P98 covers 96% of records — wide enough for islands/suburbs that P5/P95 missed
  const p = count >= 50 ? 0.02 : 0.0;
  const pHigh = count >= 50 ? 0.98 : 1.0;

  const p5lat = lats[Math.floor(count * p)];
  const p95lat = lats[Math.min(Math.floor(count * pHigh) - 1, count - 1)];
  const p5lng = lngs[Math.floor(count * p)];
  const p95lng = lngs[Math.min(Math.floor(count * pHigh) - 1, count - 1)];

  // Step 4: 60% safety margin on each side (minimum 0.24°) — 20% less than previous.
  // Total span = P98-P2 * 2.2
  const latMargin = Math.max((p95lat - p5lat) * 0.60, 0.24);
  const lngMargin = Math.max((p95lng - p5lng) * 0.60, 0.24);

  // Step 5: area km² for QA
  const avgLat = (p5lat + p95lat) / 2;
  const latKm = (p95lat - p5lat) * 111;
  const lngKm = (p95lng - p5lng) * 111 * Math.cos((avgLat * Math.PI) / 180);
  const area_km2 = latKm * lngKm;

  return {
    min_lat: p5lat - latMargin,
    max_lat: p95lat + latMargin,
    min_lng: p5lng - lngMargin,
    max_lng: p95lng + lngMargin,
    client_count: count,
    area_km2: area_km2 > 0 ? area_km2 : null,
    p5_lat: p5lat, p95_lat: p95lat,
    p5_lng: p5lng, p95_lng: p95lng,
  };
}

export function useIspCoverage(ispId: string, filialId: string | null): UseIspCoverageResult {
  const [coverage, setCoverage] = useState<IspCoverageArea | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [triggerFetch, setTriggerFetch] = useState(0);

  // Convert filialId string to DB integer: null → 0, "2" → 2
  const filialIdDb = filialId === null || filialId === "todos" ? 0 : parseInt(filialId, 10) || 0;
  const filialIdFilter = filialIdDb === 0 ? null : filialIdDb;

  const fetchOrCompute = useCallback(async () => {
    if (!ispId) return;
    setLoading(true);

    try {
      // Check cache
      const { data: cached } = await externalSupabase
        .from("isp_coverage_areas")
        .select("*")
        .eq("isp_id", ispId)
        .eq("filial_id", filialIdDb)
        .maybeSingle();

      if (cached) {
        const staleThreshold = new Date();
        staleThreshold.setDate(staleThreshold.getDate() - STALE_DAYS);
        const calculatedAt = new Date(cached.calculated_at);
        if (calculatedAt > staleThreshold) {
          setCoverage(cached as IspCoverageArea);
          setLoading(false);
          return;
        }
      }

      // Cache miss or stale — compute from raw events
      setIsRecalculating(true);

      const { data: geoRows } = await externalSupabase
        .from("eventos")
        .select("geo_lat, geo_lng, filial_id")
        .eq("isp_id", ispId)
        .not("geo_lat", "is", null)
        .not("geo_lng", "is", null)
        .limit(MAX_GEO_ROWS);

      if (!geoRows || geoRows.length === 0) {
        setIsRecalculating(false);
        setLoading(false);
        return;
      }

      const computed = computeBoundsFromPoints(geoRows as GeoPoint[], filialIdFilter);
      if (!computed) {
        setIsRecalculating(false);
        setLoading(false);
        return;
      }

      const payload = {
        isp_id: ispId,
        filial_id: filialIdDb,
        ...computed,
        calculated_at: new Date().toISOString(),
      };

      let savedRow: IspCoverageArea | null = null;

      if (cached) {
        // Update existing row
        const { data: updated } = await externalSupabase
          .from("isp_coverage_areas")
          .update(payload)
          .eq("id", cached.id)
          .select()
          .single();
        savedRow = updated as IspCoverageArea;
      } else {
        // Insert new row
        const { data: inserted } = await externalSupabase
          .from("isp_coverage_areas")
          .insert(payload)
          .select()
          .single();
        savedRow = inserted as IspCoverageArea;
      }

      if (savedRow) setCoverage(savedRow);
    } catch (err) {
      console.error("[useIspCoverage] Error:", err);
    } finally {
      setIsRecalculating(false);
      setLoading(false);
    }
  }, [ispId, filialIdDb, filialIdFilter]);

  useEffect(() => {
    setCoverage(null);
    fetchOrCompute();
  }, [fetchOrCompute, triggerFetch]);

  const recalculate = useCallback(async () => {
    // Delete cached row then re-fetch
    await externalSupabase
      .from("isp_coverage_areas")
      .delete()
      .eq("isp_id", ispId)
      .eq("filial_id", filialIdDb);
    setTriggerFetch((n) => n + 1);
  }, [ispId, filialIdDb]);

  const bounds = coverage
    ? {
        minLat: coverage.min_lat,
        maxLat: coverage.max_lat,
        minLng: coverage.min_lng,
        maxLng: coverage.max_lng,
      }
    : undefined;

  return { bounds, coverage, loading, isRecalculating, recalculate };
}
