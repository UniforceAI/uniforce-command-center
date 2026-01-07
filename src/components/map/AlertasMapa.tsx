import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
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
}

interface AlertasMapaProps {
  data: MapPoint[];
  activeFilter: "churn" | "vencido" | "sinal";
}

// Component to auto-fit bounds when data changes
function FitBounds({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (points.length > 0) {
      const bounds = points.reduce(
        (acc, p) => ({
          minLat: Math.min(acc.minLat, p.lat),
          maxLat: Math.max(acc.maxLat, p.lat),
          minLng: Math.min(acc.minLng, p.lng),
          maxLng: Math.max(acc.maxLng, p.lng),
        }),
        { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 }
      );
      
      map.fitBounds([
        [bounds.minLat, bounds.minLng],
        [bounds.maxLat, bounds.maxLng],
      ], { padding: [30, 30] });
    }
  }, [points, map]);
  
  return null;
}

const getColorByRisk = (point: MapPoint, filter: string): string => {
  if (filter === "churn") {
    const score = point.churn_risk_score ?? 0;
    if (score >= 80) return "#ef4444"; // red
    if (score >= 60) return "#f97316"; // orange
    if (score >= 40) return "#eab308"; // yellow
    return "#22c55e"; // green
  }
  
  if (filter === "vencido") {
    const dias = point.dias_atraso ?? 0;
    if (dias > 60) return "#ef4444"; // red
    if (dias > 30) return "#f97316"; // orange
    if (dias > 0) return "#eab308"; // yellow
    return "#22c55e"; // green
  }
  
  // sinal - based on alerta_tipo
  if (point.alerta_tipo) {
    if (point.alerta_tipo.toLowerCase().includes("crítico")) return "#ef4444";
    if (point.alerta_tipo.toLowerCase().includes("alto")) return "#f97316";
    if (point.alerta_tipo.toLowerCase().includes("médio")) return "#eab308";
  }
  return "#22c55e";
};

const getRadiusByRisk = (point: MapPoint, filter: string): number => {
  if (filter === "churn") {
    const score = point.churn_risk_score ?? 0;
    if (score >= 80) return 10;
    if (score >= 60) return 8;
    if (score >= 40) return 6;
    return 4;
  }
  
  if (filter === "vencido") {
    const dias = point.dias_atraso ?? 0;
    if (dias > 60) return 10;
    if (dias > 30) return 8;
    if (dias > 0) return 6;
    return 4;
  }
  
  return point.alerta_tipo ? 8 : 4;
};

export function AlertasMapa({ data, activeFilter }: AlertasMapaProps) {
  // Filter points with valid coordinates
  const validPoints = useMemo(() => {
    return data.filter(
      (p) =>
        p.geo_lat !== undefined &&
        p.geo_lng !== undefined &&
        !isNaN(p.geo_lat) &&
        !isNaN(p.geo_lng) &&
        p.geo_lat !== 0 &&
        p.geo_lng !== 0
    );
  }, [data]);

  // Brazil center as default
  const defaultCenter: [number, number] = [-15.77972, -47.92972];
  
  const centerPoint = useMemo((): [number, number] => {
    if (validPoints.length === 0) return defaultCenter;
    const avgLat = validPoints.reduce((sum, p) => sum + (p.geo_lat || 0), 0) / validPoints.length;
    const avgLng = validPoints.reduce((sum, p) => sum + (p.geo_lng || 0), 0) / validPoints.length;
    return [avgLat, avgLng];
  }, [validPoints]);

  const boundsPoints = useMemo(() => {
    return validPoints.map((p) => ({ lat: p.geo_lat!, lng: p.geo_lng! }));
  }, [validPoints]);

  if (validPoints.length === 0) {
    return (
      <div className="relative h-[300px] bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
        <div className="text-center text-white/60">
          <p className="text-sm">Nenhum cliente com geolocalização disponível</p>
          <p className="text-xs mt-1">Verifique os campos geo_lat e geo_lng nos dados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[300px] rounded-lg overflow-hidden">
      <MapContainer
        center={centerPoint}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={boundsPoints} />
        
        {validPoints.map((point, idx) => (
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
                {activeFilter === "sinal" && point.alerta_tipo && (
                  <p>Alerta: <span className="font-medium">{point.alerta_tipo}</span></p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex gap-3 text-xs bg-background/80 backdrop-blur-sm px-2 py-1 rounded z-[1000]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Crítico</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Alto</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Médio</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Baixo</span>
      </div>
    </div>
  );
}
