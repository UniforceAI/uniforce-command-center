import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Rectangle, useMap, Tooltip as LeafletTooltip } from "react-leaflet";
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
}

interface AlertasMapaProps {
  data: MapPoint[];
  activeFilter: "churn" | "vencido" | "chamados";
  viewMode?: "markers" | "grid";
  height?: string;
}

// Smart zoom: focus on densest cluster
function SmartFitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    if (points.length <= 3) {
      map.fitBounds(
        points.map(p => [p.lat, p.lng] as [number, number]),
        { padding: [30, 30], maxZoom: 13 }
      );
      return;
    }

    const gridSize = 0.5;
    const cells = new Map<string, { count: number; points: typeof points }>();
    points.forEach(p => {
      const key = `${Math.floor(p.lat / gridSize)},${Math.floor(p.lng / gridSize)}`;
      const cell = cells.get(key) || { count: 0, points: [] };
      cell.count++;
      cell.points.push(p);
      cells.set(key, cell);
    });

    let densest = { count: 0, points: points };
    cells.forEach(cell => {
      if (cell.count > densest.count) densest = cell;
    });

    const target = densest.count > points.length * 0.6 ? densest.points : points;
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

// ── Color helpers ──

// Grid: 6-level semi-transparent scale (city map visible underneath)
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

// Marker colors
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
  const s = point.churn_risk_score ?? 0;
  if (s >= 75) return "#ef4444";
  if (s >= 50) return "#f97316";
  if (s >= 25) return "#eab308";
  return "#3b82f6";
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
  const s = point.churn_risk_score ?? 0;
  return s >= 75 ? 10 : s >= 50 ? 8 : s >= 25 ? 6 : 5;
};

// Format number: 1234 → "1.2k"
const fmtNum = (n: number): string => {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

// ── Grid Squares with inline numbers (Toronto-style) ──

function GridSquares({ points, filter, bounds }: { points: MapPoint[]; filter: string; bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } }) {
  const gridData = useMemo(() => {
    if (points.length === 0) return [];

    const latRange = bounds.maxLat - bounds.minLat;
    const lngRange = bounds.maxLng - bounds.minLng;
    const gridCount = 25;
    const cellLat = Math.max(0.001, latRange / gridCount);
    const cellLng = Math.max(0.001, lngRange / gridCount);

    // Build occupied cells
    const cells = new Map<string, { row: number; col: number; count: number; metricSum: number; points: MapPoint[] }>();
    points.forEach(p => {
      const row = Math.floor((p.geo_lat! - bounds.minLat) / cellLat);
      const col = Math.floor((p.geo_lng! - bounds.minLng) / cellLng);
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
    const totalRows = Math.ceil(latRange / cellLat) + 1;
    const totalCols = Math.ceil(lngRange / cellLng) + 1;

    // Only emit cells that are within the convex "shape" of data —
    // we check row occupancy to avoid filling oceans/empty zones
    const occupiedRows = new Set<number>();
    const occupiedCols = new Set<number>();
    cells.forEach(c => { occupiedRows.add(c.row); occupiedCols.add(c.col); });

    // Expand occupied range by 1 cell padding
    const minRow = Math.max(0, Math.min(...occupiedRows) - 1);
    const maxRow = Math.min(totalRows - 1, Math.max(...occupiedRows) + 1);
    const minCol = Math.max(0, Math.min(...occupiedCols) - 1);
    const maxCol = Math.min(totalCols - 1, Math.max(...occupiedCols) + 1);

    const result: { lat: number; lng: number; cellLat: number; cellLng: number; count: number; metricSum: number; intensity: number; points: MapPoint[] }[] = [];

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const key = `${r},${c}`;
        const existing = cells.get(key);
        result.push({
          lat: bounds.minLat + r * cellLat,
          lng: bounds.minLng + c * cellLng,
          cellLat,
          cellLng,
          count: existing?.count ?? 0,
          metricSum: existing?.metricSum ?? 0,
          intensity: existing ? existing.count / maxCount : 0,
          points: existing?.points ?? [],
        });
      }
    }
    return result;
  }, [points, filter, bounds]);

  // Get the display number for a cell
  const getCellDisplayNumber = (cell: typeof gridData[0]): string => {
    if (cell.count === 0) return "";
    if (filter === "chamados") {
      const total = cell.points.reduce((s, p) => s + (p.qtd_chamados ?? 0), 0);
      return fmtNum(total);
    }
    if (filter === "vencido") {
      return fmtNum(cell.count);
    }
    // churn: show count of clients
    return fmtNum(cell.count);
  };

  return (
    <>
      {gridData.map((cell, idx) => {
        const level = getGridLevel(cell.intensity);
        const style = GRID_COLORS[level];
        const displayNum = getCellDisplayNumber(cell);
        const hasData = cell.count > 0;

        return (
          <Rectangle
            key={idx}
            bounds={[
              [cell.lat, cell.lng],
              [cell.lat + cell.cellLat, cell.lng + cell.cellLng],
            ]}
            pathOptions={{
              color: style.border,
              fillColor: style.bg,
              fillOpacity: 1, // opacity is baked into rgba
              weight: 1,
              opacity: 1,
            }}
          >
            {/* Show number inside each square */}
            {hasData && (
              <LeafletTooltip
                permanent
                direction="center"
                className="grid-cell-label"
              >
                <span style={{
                  color: level >= 3 ? "#fff" : style.text,
                  fontWeight: 700,
                  fontSize: cell.count >= 100 ? "9px" : "11px",
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
                    <p>Score médio: {Math.round(cell.points.reduce((s, p) => s + (p.churn_risk_score ?? 0), 0) / cell.count)}</p>
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

export function AlertasMapa({ data, activeFilter, viewMode = "grid", height }: AlertasMapaProps) {
  const validPoints = useMemo(() => {
    return data.filter((p) => {
      if (p.geo_lat === undefined || p.geo_lng === undefined || isNaN(p.geo_lat) || isNaN(p.geo_lng) || p.geo_lat === 0 || p.geo_lng === 0) return false;
      if (p.geo_lat < -34 || p.geo_lat > 6 || p.geo_lng < -74 || p.geo_lng > -28) return false;
      if (activeFilter === "vencido") return (p.dias_atraso !== undefined && p.dias_atraso !== null && p.dias_atraso > 0);
      if (activeFilter === "chamados") return p.qtd_chamados !== undefined && p.qtd_chamados > 0;
      return true;
    });
  }, [data, activeFilter]);

  const defaultCenter: [number, number] = [-15.77972, -47.92972];

  const centerPoint = useMemo((): [number, number] => {
    if (validPoints.length === 0) return defaultCenter;
    const avgLat = validPoints.reduce((s, p) => s + (p.geo_lat || 0), 0) / validPoints.length;
    const avgLng = validPoints.reduce((s, p) => s + (p.geo_lng || 0), 0) / validPoints.length;
    return [avgLat, avgLng];
  }, [validPoints]);

  const boundsPoints = useMemo(() => validPoints.map(p => ({ lat: p.geo_lat!, lng: p.geo_lng! })), [validPoints]);

  const gridBounds = useMemo(() => {
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
  }, [validPoints]);

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
    <div className="relative overflow-hidden rounded-b-lg" style={{ height: height || "520px" }}>
      {/* Custom CSS for grid cell labels */}
      <style>{`
        .grid-cell-label {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
          font-family: system-ui, -apple-system, sans-serif;
        }
        .grid-cell-label::before {
          display: none !important;
        }
      `}</style>

      <MapContainer
        center={centerPoint}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        />
        <SmartFitBounds points={boundsPoints} />

        {viewMode === "grid" ? (
          <GridSquares points={validPoints} filter={activeFilter} bounds={gridBounds} />
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
                  {activeFilter === "churn" && point.churn_risk_score !== undefined && (
                    <p>Risco Churn: <span className="font-medium">{point.churn_risk_score}%</span></p>
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
          GRID_COLORS.map((c, i) => (
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
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#3b82f6"}}></span> Baixo</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#eab308"}}></span> Médio</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#f97316"}}></span> Alto</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#ef4444"}}></span> Crítico</span>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
