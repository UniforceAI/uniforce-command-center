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
  vencido?: boolean;
  downtime_min_24h?: number;
  qtd_chamados?: number; // Quantidade de chamados do cliente
}

interface AlertasMapaProps {
  data: MapPoint[];
  activeFilter: "churn" | "vencido" | "chamados";
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
  if (filter === "vencido") {
    const dias = point.dias_atraso ?? 0;
    if (dias >= 25) return "#ef4444";
    if (dias >= 15) return "#f97316";
    if (dias >= 8) return "#eab308";
    return "#22c55e";
  }
  
  if (filter === "chamados") {
    const qtd = point.qtd_chamados ?? 0;
    if (qtd >= 5) return "#ef4444";
    if (qtd >= 2) return "#f97316";
    return "#22c55e";
  }

  if (filter === "churn") {
    const score = point.churn_risk_score ?? 0;
    if (score >= 75) return "#ef4444";
    if (score >= 50) return "#f97316";
    if (score >= 25) return "#eab308";
    return "#3b82f6"; // sem score = azul neutro
  }
  
  return "#22c55e";
};

const getRadiusByRisk = (point: MapPoint, filter: string): number => {
  if (filter === "vencido") {
    const dias = point.dias_atraso ?? 0;
    if (dias >= 25) return 10;
    if (dias >= 15) return 8;
    if (dias >= 8) return 7;
    return 6;
  }
  
  if (filter === "chamados") {
    const qtd = point.qtd_chamados ?? 0;
    if (qtd >= 5) return 10;
    if (qtd >= 3) return 8;
    if (qtd >= 2) return 7;
    return 6;
  }

  if (filter === "churn") {
    const score = point.churn_risk_score ?? 0;
    if (score >= 75) return 10;
    if (score >= 50) return 8;
    if (score >= 25) return 6;
    return 5;
  }
  
  return 5;
};

export function AlertasMapa({ data, activeFilter }: AlertasMapaProps) {
  // Filter points with valid coordinates AND apply filter
  const validPoints = useMemo(() => {
    return data.filter((p) => {
      // Must have valid coordinates
      if (
        p.geo_lat === undefined ||
        p.geo_lng === undefined ||
        isNaN(p.geo_lat) ||
        isNaN(p.geo_lng) ||
        p.geo_lat === 0 ||
        p.geo_lng === 0
      ) {
        return false;
      }

      // Apply filter - only show relevant clients
      if (activeFilter === "vencido") {
        // vencido=false no banco, mas dias_atraso > 0 indica vencimento real
        return (p.dias_atraso !== undefined && p.dias_atraso !== null && p.dias_atraso > 0);
      }
      
      if (activeFilter === "chamados") {
        return p.qtd_chamados !== undefined && p.qtd_chamados > 0;
      }

      if (activeFilter === "churn") {
        // Mostrar todos os clientes no mapa churn (coloridos por score quando disponível)
        return true;
      }
      
      return true;
    });
  }, [data, activeFilter]);

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
      <div className="relative h-[280px] bg-slate-800 rounded-b-lg overflow-hidden flex items-center justify-center">
        <div className="text-center text-white/60">
          <p className="text-sm">Nenhum cliente com geolocalização disponível</p>
          <p className="text-xs mt-1">Verifique os campos geo_lat e geo_lng nos dados</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[280px] overflow-hidden rounded-b-lg">
      <MapContainer
        center={centerPoint}
        zoom={5}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
                {activeFilter === "churn" && point.alerta_tipo && (
                  <p>Alerta: <span className="font-medium">{point.alerta_tipo}</span></p>
                )}
                {activeFilter === "chamados" && point.qtd_chamados !== undefined && (
                  <p>Chamados: <span className="font-medium">{point.qtd_chamados}</span></p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      
      {/* Contextual Legend */}
      <div className="absolute bottom-3 left-3 flex gap-3 text-xs bg-background/80 backdrop-blur-sm px-2 py-1 rounded z-[1000]">
        {activeFilter === "vencido" && (
          <>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#22c55e"}}></span> 1-7 dias</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#eab308"}}></span> 8-14 dias</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#f97316"}}></span> 15-24 dias</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#ef4444"}}></span> +25 dias</span>
          </>
        )}
        {activeFilter === "chamados" && (
          <>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#22c55e"}}></span> 1 chamado</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#f97316"}}></span> 2-4 chamados</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#ef4444"}}></span> 5+ chamados</span>
          </>
        )}
        {activeFilter === "churn" && (
          <>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#3b82f6"}}></span> Sem score</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#eab308"}}></span> Médio</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#f97316"}}></span> Alto</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{background: "#ef4444"}}></span> Crítico</span>
          </>
        )}
      </div>
    </div>
  );
}
