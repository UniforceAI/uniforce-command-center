import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Rectangle, useMap, useMapEvents, Tooltip as LeafletTooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

interface MapPoint {
  cliente_id: string | number;
  cliente_nome?: string;
  cliente_cidade?: string;
  geo_lat?: number;
  geo_lng?: number;
  nivel_risco?: string;
  alerta_tipo?: string;
  dias_atraso?: number;
  churn_risk_score?: number;
  vencido?: boolean;
  downtime_min_24h?: number;
  qtd_chamados?: number;
  data_cancelamento?: string | null;
}

interface AlertasMapaProps {
  data: MapPoint[];
  activeFilter: "churn" | "vencido" | "chamados";
  viewMode?: "markers" | "grid";
  height?: string;
  disableScrollZoom?: boolean;
  fixedBounds?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  churnPeriodDays?: string; // "7" | "30" | "90" | "365" | "todos"
  persistKey?: string; // sessionStorage key for zoom/center persistence
}

// ── FitToBounds: fits map to fixedBounds when it changes (ISP switch), NOT on filter change ──
// This is the stable alternative to SmartFitBounds — does not depend on filter/points.
function FitToBounds({ bounds }: { bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } }) {
  const map = useMap();
  const { minLat, maxLat, minLng, maxLng } = bounds;

  useEffect(() => {
    map.fitBounds(
      [[minLat, minLng], [maxLat, maxLng]],
      { padding: [10, 10], maxZoom: 13, animate: false }
    );
  // Only re-fires when the actual bounds coordinates change (ISP/filial switch), not on filter change
  }, [minLat, maxLat, minLng, maxLng, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── SmartFitBounds: fires ONCE on initial mount when no fixedBounds available ──
function SmartFitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  const hasFitted = useRef(false);

  useEffect(() => {
    // Only fit once — prevents re-zoom on every filter switch
    if (hasFitted.current || points.length === 0) return;
    hasFitted.current = true;

    if (points.length <= 3) {
      map.fitBounds(
        points.map(p => [p.lat, p.lng] as [number, number]),
        { padding: [30, 30], maxZoom: 15 }
      );
      return;
    }

    // Use smaller grid to find the densest cluster
    const gridSize = 0.15;
    const cells = new Map<string, { count: number; points: typeof points }>();
    points.forEach(p => {
      const key = `${Math.floor(p.lat / gridSize)},${Math.floor(p.lng / gridSize)}`;
      const cell = cells.get(key) || { count: 0, points: [] };
      cell.count++;
      cell.points.push(p);
      cells.set(key, cell);
    });

    let densest = { count: 0, points: points, key: "" };
    cells.forEach((cell, key) => {
      if (cell.count > densest.count) densest = { ...cell, key };
    });

    const [dRow, dCol] = densest.key.split(",").map(Number);
    const clusterPoints: typeof points = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const adjKey = `${dRow + dr},${dCol + dc}`;
        const adj = cells.get(adjKey);
        if (adj) clusterPoints.push(...adj.points);
      }
    }

    const target = clusterPoints.length > points.length * 0.3 ? clusterPoints : points;
    const b = target.reduce(
      (acc, p) => ({
        minLat: Math.min(acc.minLat, p.lat), maxLat: Math.max(acc.maxLat, p.lat),
        minLng: Math.min(acc.minLng, p.lng), maxLng: Math.max(acc.maxLng, p.lng),
      }),
      { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 }
    );
    map.fitBounds(
      [[b.minLat, b.minLng], [b.maxLat, b.maxLng]],
      { padding: [40, 40], maxZoom: 14 }
    );
  }, [points, map]);

  return null;
}

// ── PersistMapView: saves/restores map zoom+center to sessionStorage ──
// Restore: immediately on mount (runs after FitToBounds/SmartGridFocus due to JSX order)
// Save: ONLY after 1000ms delay — prevents saving automated moves (FitToBounds, SmartGridFocus)
// and only captures genuine user pan/zoom interactions.
function PersistMapView({ persistKey }: { persistKey: string }) {
  const map = useMap();
  const ssKey = `uf_map_view_${persistKey}`;
  const saveEnabled = useRef(false);

  useEffect(() => {
    saveEnabled.current = false;
    // Restore saved view — runs after FitToBounds+SmartGridFocus effects (JSX order),
    // so setView here interrupts any running animation and places map at user's saved spot.
    try {
      const stored = sessionStorage.getItem(ssKey);
      if (stored) {
        const { lat, lng, zoom } = JSON.parse(stored);
        if (typeof lat === "number" && typeof lng === "number" && typeof zoom === "number") {
          map.setView([lat, lng], zoom, { animate: false });
        }
      }
    } catch {}
    // Enable saves only after automated initial moves have completed (~250ms animation + margin)
    const t = setTimeout(() => { saveEnabled.current = true; }, 1000);
    return () => clearTimeout(t);
  }, [map, ssKey]);

  useMapEvents({
    moveend: () => {
      if (!saveEnabled.current) return;
      try {
        const c = map.getCenter();
        sessionStorage.setItem(ssKey, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
      } catch {}
    },
  });

  return null;
}

// ── SmartGridFocus: zoom travado no square mais quente, 10×10 squares visíveis ──
// Dispara uma vez por ISP (boundsKey). Nunca re-dispara em troca de filtro.
// PersistMapView restore (which runs AFTER this effect in JSX order) will override with
// the saved user view when one exists, naturally interrupting this animation.
function SmartGridFocus({ validPoints, gridBounds, rows, cols }: {
  validPoints: MapPoint[];
  gridBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  rows: number; cols: number;
}) {
  const map = useMap();
  const hasFocused = useRef('');
  const { minLat, maxLat, minLng, maxLng } = gridBounds;
  const boundsKey = `${minLat.toFixed(5)},${maxLat.toFixed(5)},${minLng.toFixed(5)},${maxLng.toFixed(5)}`;

  useEffect(() => {
    if (validPoints.length === 0) return;
    // Já focou para este ISP — ignora troca de filtro
    if (hasFocused.current === boundsKey) return;
    hasFocused.current = boundsKey;

    const cellLat = (maxLat - minLat) / rows;
    const cellLng = (maxLng - minLng) / cols;

    // Contar pontos por célula
    const cells = new Map<string, { row: number; col: number; count: number }>();
    validPoints.forEach(p => {
      if (!p.geo_lat || !p.geo_lng) return;
      const row = Math.max(0, Math.min(rows - 1, Math.floor((p.geo_lat - minLat) / cellLat)));
      const col = Math.max(0, Math.min(cols - 1, Math.floor((p.geo_lng - minLng) / cellLng)));
      const key = `${row},${col}`;
      const c = cells.get(key) || { row, col, count: 0 };
      c.count++;
      cells.set(key, c);
    });

    if (cells.size === 0) return;

    // Square com maior concentração de problemas
    let hot = { row: 0, col: 0, count: 0 };
    cells.forEach(c => { if (c.count > hot.count) hot = c; });

    // Centro do square mais quente
    const centerLat = minLat + (hot.row + 0.5) * cellLat;
    const centerLng = minLng + (hot.col + 0.5) * cellLng;

    // Janela de 10×10 squares ao redor do centro (5 cells em cada direção)
    const halfLat = 5 * cellLat;
    const halfLng = 5 * cellLng;

    // Fly-in animado: FitToBounds já definiu a visão geral, agora zoom no problema
    map.fitBounds(
      [[centerLat - halfLat, centerLng - halfLng], [centerLat + halfLat, centerLng + halfLng]],
      { animate: true, padding: [4, 4] }
    );
  }, [boundsKey, validPoints, map, minLat, maxLat, minLng, maxLng, rows, cols]);

  return null;
}

// ── Color helpers ──

const GRID_COLORS: { bg: string; text: string; border: string; label: string }[] = [
  { bg: "rgba(100, 116, 139, 0.20)", text: "#94a3b8", border: "rgba(100,116,139,0.3)", label: "Vazio" },
  { bg: "rgba(34, 197, 94, 0.45)",   text: "#166534", border: "rgba(34,197,94,0.6)",   label: "Baixo" },
  { bg: "rgba(132, 204, 22, 0.50)",  text: "#3f6212", border: "rgba(132,204,22,0.6)",  label: "Moderado" },
  { bg: "rgba(234, 179, 8, 0.55)",   text: "#713f12", border: "rgba(234,179,8,0.65)",  label: "Médio" },
  { bg: "rgba(249, 115, 22, 0.60)",  text: "#7c2d12", border: "rgba(249,115,22,0.7)",  label: "Alto" },
  { bg: "rgba(239, 68, 68, 0.65)",   text: "#7f1d1d", border: "rgba(239,68,68,0.75)",  label: "Crítico" },
];

const getGridLevel = (intensity: number): number => {
  if (intensity <= 0) return 0;
  if (intensity < 0.15) return 1;
  if (intensity < 0.3) return 2;
  if (intensity < 0.5) return 3;
  if (intensity < 0.75) return 4;
  return 5;
};

const getColorByRisk = (point: MapPoint, filter: string): string => {
  if (filter === "vencido") {
    const d = point.dias_atraso ?? 0;
    if (d >= 25) return "#ef4444";
    if (d >= 15) return "#f97316";
    if (d >= 8) return "#eab308";
    return "#22c55e";
  }
  if (filter === "chamados") {
    const q = point.qtd_chamados ?? 0;
    if (q >= 5) return "#ef4444";
    if (q >= 2) return "#f97316";
    return "#22c55e";
  }
  return "#ef4444";
};

const getRadiusByRisk = (point: MapPoint, filter: string): number => {
  if (filter === "vencido") {
    const d = point.dias_atraso ?? 0;
    return d >= 25 ? 10 : d >= 15 ? 8 : d >= 8 ? 7 : 6;
  }
  if (filter === "chamados") {
    const q = point.qtd_chamados ?? 0;
    return q >= 5 ? 10 : q >= 3 ? 8 : q >= 2 ? 7 : 6;
  }
  return 7;
};

const fmtNum = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

function deterministicJitter(id: string | number, axis: "lat" | "lng", cellSize: number): number {
  const str = `${id}_${axis}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return ((hash % 1000) / 1000) * 0.8 * cellSize - 0.4 * cellSize;
}

// ── Fixed 32×32 grid = 1024 squares — cells fill 100% of each cell (no gap) ──
function computeAdaptiveGrid(
  _bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }
): { rows: number; cols: number } {
  return { rows: 32, cols: 32 };
}

// ── Grid Squares with inline numbers ──
// key={activeFilter} on this component forces full remount on filter switch,
// cleaning up ALL Leaflet permanent tooltip DOM elements and preventing number leaks.
function GridSquares({ points, filter, bounds, rows, cols }: {
  points: MapPoint[]; filter: string;
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  rows: number; cols: number;
}) {
  const gridData = useMemo(() => {
    const latRange = bounds.maxLat - bounds.minLat;
    const lngRange = bounds.maxLng - bounds.minLng;
    const cellLat = Math.max(0.0002, latRange / rows);
    const cellLng = Math.max(0.0002, lngRange / cols);

    const cells = new Map<string, { row: number; col: number; count: number; metricSum: number; points: MapPoint[] }>();
    points.forEach(p => {
      const jLat = p.geo_lat! + deterministicJitter(p.cliente_id, "lat", cellLat);
      const jLng = p.geo_lng! + deterministicJitter(p.cliente_id, "lng", cellLng);
      const row = Math.floor((jLat - bounds.minLat) / cellLat);
      const col = Math.floor((jLng - bounds.minLng) / cellLng);
      const key = `${row},${col}`;
      const cell = cells.get(key) || { row, col, count: 0, metricSum: 0, points: [] };
      cell.count++;
      cell.points.push(p);
      if (filter === "vencido") cell.metricSum += (p.dias_atraso ?? 0);
      else if (filter === "chamados") cell.metricSum += (p.qtd_chamados ?? 0);
      else cell.metricSum += (p.churn_risk_score ?? 0);
      cells.set(key, cell);
    });

    const maxCount = Math.max(1, ...Array.from(cells.values()).map(c => c.count));

    const result: {
      lat: number; lng: number; cellLat: number; cellLng: number;
      count: number; metricSum: number; intensity: number; points: MapPoint[];
      row: number; col: number;
    }[] = [];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const key = `${row},${col}`;
        const existing = cells.get(key) || { row, col, count: 0, metricSum: 0, points: [] };
        result.push({
          lat: bounds.minLat + row * cellLat,
          lng: bounds.minLng + col * cellLng,
          cellLat, cellLng,
          count: existing.count,
          metricSum: existing.metricSum,
          intensity: existing.count / maxCount,
          points: existing.points,
          row, col,
        });
      }
    }
    return result;
  }, [points, filter, bounds, rows, cols]);

  const getCellDisplayNumber = (cell: typeof gridData[0]): string => {
    if (cell.count === 0) return "";
    if (filter === "chamados") {
      const total = cell.points.reduce((s, p) => s + (p.qtd_chamados ?? 0), 0);
      return fmtNum(total);
    }
    return fmtNum(cell.count);
  };

  return (
    <>
      {gridData.map((cell) => {
        const level = getGridLevel(cell.intensity);
        const style = GRID_COLORS[level];
        const displayNum = getCellDisplayNumber(cell);
        const hasData = cell.count > 0;
        // Stable unique key per cell position — not index-based
        const cellKey = `${cell.row}-${cell.col}`;

        return (
          <Rectangle
            key={cellKey}
            bounds={[
              [cell.lat, cell.lng],
              [cell.lat + cell.cellLat, cell.lng + cell.cellLng],
            ]}
            pathOptions={{
              color: style.border,
              fillColor: style.bg,
              fillOpacity: 1,
              weight: 1,
              opacity: 1,
            }}
          >
            {hasData && (
              <LeafletTooltip
                permanent
                direction="center"
                className="grid-cell-label"
              >
                <span style={{
                  color: level >= 3 ? "#fff" : style.text,
                  fontWeight: 700,
                  fontSize: cell.count >= 1000 ? "7px" : cell.count >= 100 ? "8px" : "9px",
                  textShadow: level >= 3 ? "0 1px 2px rgba(0,0,0,0.5)" : "none",
                }}>{displayNum}</span>
              </LeafletTooltip>
            )}

            {hasData && (
              <Popup>
                <div className="text-xs space-y-0.5">
                  <p className="font-semibold">{cell.count} cliente{cell.count > 1 ? "s" : ""}</p>
                  {filter === "chamados" && (
                    <p>Total chamados: {cell.points.reduce((s, p) => s + (p.qtd_chamados ?? 0), 0)}</p>
                  )}
                  {filter === "vencido" && (
                    <p>Média atraso: {Math.round(cell.points.reduce((s, p) => s + (p.dias_atraso ?? 0), 0) / cell.count)}d</p>
                  )}
                  {filter === "churn" && (
                    <p>Cancelamentos: {cell.count}</p>
                  )}
                </div>
              </Popup>
            )}
          </Rectangle>
        );
      })}
    </>
  );
}

// ── Main Component ──

export function AlertasMapa({ data, activeFilter, viewMode = "grid", height, disableScrollZoom = false, fixedBounds, churnPeriodDays, persistKey }: AlertasMapaProps) {
  // Delay grid rendering until map animation has settled.
  // Fixes: permanent Leaflet tooltips were positioned during SmartGridFocus animate:true,
  // causing numbers to be invisible on initial load. 500ms is enough for the 250ms animation.
  const [mapReady, setMapReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMapReady(true), 500);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const validPoints = useMemo(() => {
    return data.filter((p) => {
      if (p.geo_lat === undefined || p.geo_lng === undefined || isNaN(p.geo_lat) || isNaN(p.geo_lng) || p.geo_lat === 0 || p.geo_lng === 0) return false;
      if (p.geo_lat < -34 || p.geo_lat > 6 || p.geo_lng < -74 || p.geo_lng > -28) return false;
      if (activeFilter === "vencido") return (p.dias_atraso !== undefined && p.dias_atraso !== null && p.dias_atraso > 0);
      if (activeFilter === "chamados") return p.qtd_chamados !== undefined && p.qtd_chamados > 0;
      if (activeFilter === "churn") {
        if (!p.data_cancelamento) return false;
        if (churnPeriodDays && churnPeriodDays !== "todos") {
          const d = new Date(p.data_cancelamento);
          const limite = new Date(Date.now() - parseInt(churnPeriodDays) * 864e5);
          if (d < limite) return false;
        }
        return true;
      }
      return true;
    });
  }, [data, activeFilter, churnPeriodDays]);

  const defaultCenter: [number, number] = [-15.77972, -47.92972];

  // When fixedBounds available, start centered on the ISP coverage area at a city-level zoom.
  // This prevents the flash of "whole Brazil" zoom-5 view before FitToBounds corrects it.
  const centerPoint = useMemo((): [number, number] => {
    if (fixedBounds) {
      return [
        (fixedBounds.minLat + fixedBounds.maxLat) / 2,
        (fixedBounds.minLng + fixedBounds.maxLng) / 2,
      ];
    }
    if (validPoints.length === 0) return defaultCenter;
    const avgLat = validPoints.reduce((s, p) => s + (p.geo_lat || 0), 0) / validPoints.length;
    const avgLng = validPoints.reduce((s, p) => s + (p.geo_lng || 0), 0) / validPoints.length;
    return [avgLat, avgLng];
  }, [validPoints, fixedBounds]);

  const initialZoom = fixedBounds ? 11 : 5;

  const boundsPoints = useMemo(() => validPoints.map(p => ({ lat: p.geo_lat!, lng: p.geo_lng! })), [validPoints]);

  const gridBounds = useMemo(() => {
    if (fixedBounds) return fixedBounds;
    if (validPoints.length === 0) return { minLat: -34, maxLat: 6, minLng: -74, maxLng: -28 };
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    validPoints.forEach(p => {
      minLat = Math.min(minLat, p.geo_lat!);
      maxLat = Math.max(maxLat, p.geo_lat!);
      minLng = Math.min(minLng, p.geo_lng!);
      maxLng = Math.max(maxLng, p.geo_lng!);
    });
    const latPad = (maxLat - minLat) * 0.1 || 0.01;
    const lngPad = (maxLng - minLng) * 0.1 || 0.01;
    return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLng: minLng - lngPad, maxLng: maxLng + lngPad };
  }, [validPoints, fixedBounds]);

  const { rows, cols } = useMemo(() => computeAdaptiveGrid(gridBounds), [gridBounds]);

  if (validPoints.length === 0) {
    return (
      <div className="relative bg-slate-800 rounded-b-lg overflow-hidden flex items-center justify-center" style={{ height: height || "520px" }}>
        <div className="text-center text-white/60">
          <p className="text-sm">Nenhum cliente com geolocalização disponível</p>
          <p className="text-xs mt-1">Verifique os campos geo_lat e geo_lng nos dados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-b-lg" style={{ height: height || "520px", isolation: "isolate", zIndex: 0 }}>
      <style>{`
        .grid-cell-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          font-family: system-ui, -apple-system, sans-serif;
          pointer-events: none !important;
        }
        .grid-cell-label::before {
          display: none !important;
        }
      `}</style>

      <MapContainer
        center={centerPoint}
        zoom={initialZoom}
        style={{ height: "100%", width: "100%", zIndex: 1 }}
        scrollWheelZoom={!disableScrollZoom}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />

        {/*
          Fit strategy:
          - fixedBounds provided → FitToBounds (stable, only re-fires when ISP changes, never on filter switch)
          - no fixedBounds (loading/fallback) → SmartFitBounds (fires once on mount)
          This eliminates the re-zoom on every filter switch that was causing tooltip misalignment.
        */}
        {fixedBounds
          ? <FitToBounds bounds={fixedBounds} />
          : <SmartFitBounds points={boundsPoints} />
        }
        {fixedBounds && viewMode === "grid" && (
          <SmartGridFocus
            validPoints={validPoints}
            gridBounds={gridBounds}
            rows={rows}
            cols={cols}
          />
        )}
        {/* PersistMapView must come AFTER SmartGridFocus in JSX so its restore effect runs
            after SmartGridFocus starts its animation, naturally overriding with saved user view */}
        {persistKey && <PersistMapView persistKey={persistKey} />}

        {viewMode === "grid" ? (
          /*
            mapReady: delays rendering until 500ms after mount so the SmartGridFocus animation
            (250ms) completes before Leaflet positions permanent tooltips. Prevents invisible numbers.
            key={activeFilter} forces full remount on filter switch, clearing stale tooltip DOM.
          */
          mapReady ? (
            <GridSquares
              key={activeFilter}
              points={validPoints}
              filter={activeFilter}
              bounds={gridBounds}
              rows={rows}
              cols={cols}
            />
          ) : null
        ) : (
          validPoints.map((point, idx) => (
            <CircleMarker
              key={point.cliente_id || idx}
              center={[point.geo_lat!, point.geo_lng!]}
              radius={getRadiusByRisk(point, activeFilter)}
              fillColor={getColorByRisk(point, activeFilter)}
              color={getColorByRisk(point, activeFilter)}
              weight={1}
              opacity={0.8}
              fillOpacity={0.6}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">{point.cliente_nome || `Cliente ${point.cliente_id}`}</p>
                  {point.cliente_cidade && <p className="text-muted-foreground">{point.cliente_cidade}</p>}
                  {activeFilter === "churn" && point.data_cancelamento && (
                    <p>Cancelado em: <span className="font-medium">{new Date(point.data_cancelamento).toLocaleDateString("pt-BR")}</span></p>
                  )}
                  {activeFilter === "vencido" && point.dias_atraso !== undefined && point.dias_atraso > 0 && (
                    <p>Dias em Atraso: <span className="font-medium">{point.dias_atraso}</span></p>
                  )}
                  {activeFilter === "chamados" && point.qtd_chamados !== undefined && (
                    <p>Chamados: <span className="font-medium">{point.qtd_chamados}</span></p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-2 text-[10px] bg-white/90 backdrop-blur-sm px-2.5 py-1.5 rounded shadow-sm z-[1000]">
        {viewMode === "grid" ? (
          GRID_COLORS.filter((_, i) => i > 0).map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-sm border" style={{ background: c.bg, borderColor: c.border }}></span>
              <span className="text-gray-700">{c.label}</span>
            </span>
          ))
        ) : (
          <>
            {activeFilter === "vencido" && (
              <>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#22c55e"}}></span> 1-7d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#eab308"}}></span> 8-14d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#f97316"}}></span> 15-24d</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#ef4444"}}></span> +25d</span>
              </>
            )}
            {activeFilter === "chamados" && (
              <>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#22c55e"}}></span> 1</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#f97316"}}></span> 2-4</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#ef4444"}}></span> 5+</span>
              </>
            )}
            {activeFilter === "churn" && (
              <>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#ef4444"}}></span> Cancelado no período</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
