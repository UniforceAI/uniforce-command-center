import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEventos } from "@/hooks/useEventos";
import { useChamados } from "@/hooks/useChamados";
import { useNPSData } from "@/hooks/useNPSData";
import { useChurnData, ChurnStatus } from "@/hooks/useChurnData";
import { useRiskBucketConfig, RiskBucket } from "@/hooks/useRiskBucketConfig";
import { useChurnScore } from "@/hooks/useChurnScore";
import { useCrmWorkflow, WorkflowStatus } from "@/hooks/useCrmWorkflow";
import { useChurnScoreConfig, calcScoreFinanceiroConfiguravel } from "@/contexts/ChurnScoreConfigContext";
import { CrmDrawer } from "@/components/crm/CrmDrawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Evento } from "@/types/evento";
import { AlertasMapa } from "@/components/map/AlertasMapa";
import { IspActions } from "@/components/shared/IspActions";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { InitialLoadingScreen } from "@/components/shared/InitialLoadingScreen";
import { ActionMenu, QuickActions } from "@/components/shared/ActionMenu";
import { EmptyState } from "@/components/shared/EmptyState";
import { RiskKPICard } from "@/components/shared/RiskKPICard";
import {
  Users,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Clock,
  Percent,
  AlertCircle,
  Phone,
  MapPin,
  Zap,
  RefreshCcw,
  Wifi,
  ShieldAlert,
  ArrowRight,
  Target,
  MessageSquare,
  ThumbsDown,
  Eye,
  Lightbulb,
  BarChart3,
  Maximize2,
  X,
  Grid3X3,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// Map Filter Tabs
const MapTabs = ({ activeTab, onTabChange, availableTabs }: { activeTab: string; onTabChange: (tab: string) => void; availableTabs: string[] }) => {
  const allTabs = [
    { id: "chamados", label: "Chamados" },
    { id: "vencido", label: "Vencido" },
    { id: "churn", label: "Churn" },
  ];
  const tabs = allTabs.filter(t => availableTabs.includes(t.id));
  if (tabs.length === 0) return null;
  return (
    <div className="flex gap-1.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            activeTab === tab.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted/60 text-muted-foreground hover:bg-muted"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// Geo metric types
type GeoMetric = "churn" | "financeiro" | "nps" | "ltv";
const GEO_METRIC_LABELS: Record<GeoMetric, string> = {
  churn: "Churn por Bairro",
  financeiro: "Inadimplência por Bairro",
  nps: "NPS por Bairro",
  ltv: "LTV por Bairro",
};

// Session-level flag
const getHasShownInitial = () => {
  const stored = sessionStorage.getItem("uf_initial_shown");
  if (!stored) return false;
  const today = new Date().toISOString().slice(0, 10);
  return stored === today;
};
const setHasShownInitial = () => {
  const today = new Date().toISOString().slice(0, 10);
  sessionStorage.setItem("uf_initial_shown", today);
};

const VisaoGeral = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, signOut } = useAuth();
  const { ispNome, ispId } = useActiveIsp();
  const { eventos, isLoading, error } = useEventos();
  const { chamados, getChamadosPorCliente, isLoading: isLoadingChamados } = useChamados();
  const { npsData } = useNPSData(ispId);
  const { churnStatus, churnEvents } = useChurnData();
  const { getBucket: getBucketVisao } = useRiskBucketConfig();
  const { scoreMap, getScoreTotalReal, getScoreSuporteReal, getScoreNPSReal, npsMap, chamadosPorClienteMap, config: churnConfig } = useChurnScore();
  const { workflowMap, addToWorkflow, updateStatus, updateTags, updateOwner } = useCrmWorkflow();

  const [showInitialScreen, setShowInitialScreen] = useState(() => !getHasShownInitial());

  useEffect(() => {
    if (!showInitialScreen) return;
    const timer = setTimeout(() => {
      setShowInitialScreen(false);
      setHasShownInitial();
    }, isLoading ? 12000 : 4000);
    return () => clearTimeout(timer);
  }, [isLoading, showInitialScreen]);

  // Filtros
  const [periodo, setPeriodo] = useState("7");
  const [uf, setUf] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [filial, setFilial] = useState("todos");
  const [mapTab, setMapTab] = useState("chamados");
  const [churnChartMode, setChurnChartMode] = useState<"volume" | "taxa">("taxa");
  const [geoMetric, setGeoMetric] = useState<GeoMetric>("churn");
  const [fatoresMode, setFatoresMode] = useState<"risco" | "cancelados">("risco");
  const [selectedClienteRisco, setSelectedClienteRisco] = useState<ChurnStatus | null>(null);
  const [mapLightboxOpen, setMapLightboxOpen] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<"markers" | "grid">("grid");

  // Mapeamento de IDs de cidade para nomes
  const cidadeIdMap: Record<string, string> = {
    "4405": "Gaspar",
    "4419": "Ilhota",
  };

  const getCidadeNome = (cidadeValue: any): string | null => {
    if (cidadeValue === null || cidadeValue === undefined || String(cidadeValue).trim() === "") return null;
    const cidadeKey = String(cidadeValue).trim();
    return cidadeIdMap[cidadeKey] || cidadeKey;
  };

  const isClienteVencido = (e: Evento): boolean => {
    return (e.dias_atraso !== null && e.dias_atraso !== undefined && Number(e.dias_atraso) > 0);
  };

  // Filter options
  const filterOptions = useMemo(() => {
    const cidades = new Set<string>();
    const bairros = new Set<string>();
    const planos = new Set<string>();
    const filiais = new Set<string>();
    eventos.forEach((e: Evento) => {
      if (e.cliente_cidade) cidades.add(e.cliente_cidade);
      if (e.cliente_bairro) bairros.add(e.cliente_bairro);
      if (e.plano_nome) planos.add(e.plano_nome);
      const fid = e.filial_id !== null && e.filial_id !== undefined ? String(e.filial_id).trim() : "";
      if (fid) filiais.add(fid);
    });
    return {
      cidades: Array.from(cidades).sort(),
      bairros: Array.from(bairros).sort(),
      planos: Array.from(planos).sort(),
      filiais: Array.from(filiais).sort((a, b) => Number(a) - Number(b)),
    };
  }, [eventos]);

  // Filtered events
  const filteredEventos = useMemo(() => {
    let filtered = [...eventos] as Evento[];
    if (cidade !== "todos") filtered = filtered.filter((e) => e.cliente_cidade === cidade);
    if (bairro !== "todos") filtered = filtered.filter((e) => e.cliente_bairro === bairro);
    if (plano !== "todos") filtered = filtered.filter((e) => e.plano_nome === plano);
    if (filial !== "todos") filtered = filtered.filter((e) => String(e.filial_id) === filial);
    return filtered;
  }, [eventos, cidade, bairro, plano, filial]);

  // Snapshot date
  const snapshotDate = useMemo(() => {
    if (eventos.length === 0) return null;
    let maxDate = new Date(0);
    eventos.forEach(e => {
      const d = new Date(e.event_datetime || e.created_at);
      if (!isNaN(d.getTime()) && d > maxDate) maxDate = d;
    });
    return maxDate.getTime() > 0 ? maxDate : null;
  }, [eventos]);

  // Compute data age span (in days) for smart period filter
  const dataSpanDays = useMemo(() => {
    if (eventos.length === 0) return 0;
    let minDate = new Date();
    let maxDate = new Date(0);
    eventos.forEach(e => {
      const d = new Date(e.event_datetime || e.created_at);
      if (!isNaN(d.getTime())) {
        if (d < minDate) minDate = d;
        if (d > maxDate) maxDate = d;
      }
    });
    // Also consider churn data
    churnStatus.forEach(cs => {
      if (cs.data_cancelamento) {
        const d = new Date(cs.data_cancelamento);
        if (!isNaN(d.getTime())) {
          if (d < minDate) minDate = d;
          if (d > maxDate) maxDate = d;
        }
      }
    });
    return Math.max(0, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
  }, [eventos, churnStatus]);

  // Max dates for relative period calculation
  const maxCancelamentoDate = useMemo(() => {
    let maxDate = new Date(0);
    // Check eventos data_cancelamento first
    filteredEventos.forEach(e => {
      const dataCancelamento = (e as any).data_cancelamento;
      if (dataCancelamento) {
        const d = new Date(dataCancelamento);
        if (!isNaN(d.getTime()) && d > maxDate) maxDate = d;
      }
    });
    // Fallback to churn_status
    if (maxDate.getTime() === 0) {
      churnStatus.forEach(cs => {
        if (cs.status_churn === "cancelado" && cs.data_cancelamento) {
          const d = new Date(cs.data_cancelamento);
          if (!isNaN(d.getTime()) && d > maxDate) maxDate = d;
        }
      });
    }
    return maxDate.getTime() > 0 ? maxDate : new Date();
  }, [filteredEventos, churnStatus]);

  const dataLimiteChurn = useMemo(() => {
    if (periodo === "todos") return null;
    return new Date(maxCancelamentoDate.getTime() - parseInt(periodo) * 24 * 60 * 60 * 1000);
  }, [periodo, maxCancelamentoDate]);

  const periodoLabel = useMemo(() => {
    if (periodo === "todos") return "Todo o histórico";
    const n = parseInt(periodo);
    if (n === 7) return "Últimos 7 dias";
    if (n === 30) return "Últimos 30 dias";
    if (n === 90) return "Últimos 90 dias";
    if (n === 365) return "Último ano";
    return `Últimos ${n} dias`;
  }, [periodo]);

  // =========================================================
  // BLOCO 1 — SAÚDE ATUAL (KPIs grandes)
  // =========================================================
  const saudeAtual = useMemo(() => {
    // Clientes únicos da base filtrada
    const clientesMapBase = new Map<number, Evento>();
    filteredEventos.forEach(e => {
      if (!clientesMapBase.has(e.cliente_id) ||
        new Date(e.event_datetime) > new Date(clientesMapBase.get(e.cliente_id)!.event_datetime)) {
        clientesMapBase.set(e.cliente_id, e);
      }
    });
    const clientesUnicos = Array.from(clientesMapBase.values());
    const totalClientes = clientesUnicos.length;
    const clientesAtivos = clientesUnicos.filter(e =>
      e.status_contrato !== "C" && e.servico_status !== "C"
    ).length;

    // Churn no período — usa data_cancelamento da tabela eventos como fonte primária
    let canceladosPeriodo = 0;
    let receitaPerdida = 0;
    let ticketsPerdidos: number[] = [];
    
    // Primeiro: contar via eventos.data_cancelamento (fonte primária)
    const canceladosViaEventos = new Set<number>();
    filteredEventos.forEach(e => {
      const dataCancelamento = (e as any).data_cancelamento;
      if (!dataCancelamento) return;
      const d = new Date(dataCancelamento);
      if (isNaN(d.getTime())) return;
      if (dataLimiteChurn && d < dataLimiteChurn) return;
      if (canceladosViaEventos.has(e.cliente_id)) return;
      canceladosViaEventos.add(e.cliente_id);
      canceladosPeriodo++;
      receitaPerdida += e.valor_mensalidade || 0;
      if (e.valor_mensalidade) ticketsPerdidos.push(e.valor_mensalidade);
    });
    
    // Fallback: se eventos não retornou cancelamentos, usar churn_status
    if (canceladosPeriodo === 0) {
      churnStatus.forEach(cs => {
        if (cs.status_churn !== "cancelado") return;
        if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
        if (bairro !== "todos" && cs.cliente_bairro !== bairro) return;
        if (plano !== "todos" && cs.plano_nome !== plano) return;
        if (dataLimiteChurn && cs.data_cancelamento) {
          const d = new Date(cs.data_cancelamento);
          if (!isNaN(d.getTime()) && d < dataLimiteChurn) return;
        }
        canceladosPeriodo++;
        receitaPerdida += cs.valor_mensalidade || 0;
        if (cs.valor_mensalidade) ticketsPerdidos.push(cs.valor_mensalidade);
      });
    }

    const churnPct = totalClientes > 0 ? (canceladosPeriodo / totalClientes * 100) : 0;
    const ticketMedioPerdido = ticketsPerdidos.length > 0
      ? ticketsPerdidos.reduce((a, b) => a + b, 0) / ticketsPerdidos.length
      : 0;

    // Clientes em alto risco — DEDUPLICATED by cliente_id (same logic as ClientesEmRisco menu)
    const riscoMap = new Map<number, { score: number; bucket: RiskBucket; mrr: number }>();
    churnStatus.forEach(cs => {
      if (cs.status_churn === "cancelado") return;
      if (cs.status_internet === "D") return;
      if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
      if (bairro !== "todos" && cs.cliente_bairro !== bairro) return;
      if (plano !== "todos" && cs.plano_nome !== plano) return;
      const score = getScoreTotalReal(cs);
      const bucket = getBucketVisao(score);
      if (bucket !== "ALERTA" && bucket !== "CRÍTICO") return;
      const existing = riscoMap.get(cs.cliente_id);
      if (!existing || score > existing.score) {
        riscoMap.set(cs.cliente_id, { score, bucket, mrr: cs.valor_mensalidade || 0 });
      }
    });
    const clientesAltoRisco = riscoMap.size;
    let mrrEmRisco = 0;
    riscoMap.forEach(v => { mrrEmRisco += v.mrr; });
    const pctAltoRisco = clientesAtivos > 0 ? (clientesAltoRisco / clientesAtivos * 100) : 0;

    // Inadimplência ativa
    const vencidos = clientesUnicos.filter(e => isClienteVencido(e));
    const totalVencido = vencidos.reduce((acc, e) => acc + (e.valor_cobranca || e.valor_mensalidade || 0), 0);
    const pctInadimplencia = totalClientes > 0 ? (vencidos.length / totalClientes * 100) : 0;

    return {
      totalClientes,
      clientesAtivos,
      canceladosPeriodo,
      churnPct,
      receitaPerdida,
      ticketMedioPerdido,
      clientesAltoRisco,
      pctAltoRisco,
      mrrEmRisco,
      vencidosCount: vencidos.length,
      totalVencido,
      pctInadimplencia,
    };
  }, [filteredEventos, churnStatus, scoreMap, dataLimiteChurn, cidade, bairro, plano, getScoreTotalReal, getBucketVisao]);

  // =========================================================
  // BLOCO 2 — FATORES DE RISCO
  // =========================================================
  const fatoresRisco = useMemo(() => {
    const isRisco = fatoresMode === "risco";
    let populacao: { cliente_id: number; dias_atraso?: number; nps_classificacao?: string; cliente_cidade?: string; cliente_bairro?: string; plano_nome?: string }[] = [];

    if (isRisco) {
      const clientesMapBase = new Map<number, Evento>();
      filteredEventos.forEach(e => {
        if (e.status_contrato === "C" || e.servico_status === "C") return;
        if (!clientesMapBase.has(e.cliente_id) ||
          new Date(e.event_datetime) > new Date(clientesMapBase.get(e.cliente_id)!.event_datetime)) {
          clientesMapBase.set(e.cliente_id, e);
        }
      });
      populacao = Array.from(clientesMapBase.values()).map(e => ({
        cliente_id: e.cliente_id,
        dias_atraso: e.dias_atraso,
        cliente_cidade: e.cliente_cidade,
        cliente_bairro: e.cliente_bairro,
        plano_nome: e.plano_nome,
      }));
    } else {
      churnStatus.forEach(cs => {
        if (cs.status_churn !== "cancelado") return;
        if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
        if (bairro !== "todos" && cs.cliente_bairro !== bairro) return;
        if (plano !== "todos" && cs.plano_nome !== plano) return;
        if (dataLimiteChurn && cs.data_cancelamento) {
          const d = new Date(cs.data_cancelamento);
          if (!isNaN(d.getTime()) && d < dataLimiteChurn) return;
        }
        populacao.push({
          cliente_id: cs.cliente_id,
          dias_atraso: cs.dias_atraso,
          nps_classificacao: cs.nps_classificacao,
          cliente_cidade: cs.cliente_cidade,
          cliente_bairro: cs.cliente_bairro,
          plano_nome: cs.plano_nome,
        });
      });
    }

    const totalBase = populacao.length;
    if (totalBase === 0) return { factors: [], totalBase: 0 };

    // 1. 2+ chamados em 30 dias
    const chamados30 = getChamadosPorCliente(30);
    const clienteIds = new Set(populacao.map(p => p.cliente_id));
    let com2maisChamados = 0;
    chamados30.forEach((data, cId) => {
      if (clienteIds.has(cId) && data.chamados_periodo >= 2) com2maisChamados++;
    });

    // 2. Pressão Financeira (Aging Progressivo)
    let aging7_14 = 0, aging15_30 = 0, aging30plus = 0;
    populacao.forEach(p => {
      const da = p.dias_atraso ?? 0;
      if (da >= 7 && da <= 14) aging7_14++;
      else if (da > 14 && da <= 30) aging15_30++;
      else if (da > 30) aging30plus++;
    });
    const totalAging = aging7_14 + aging15_30 + aging30plus;

    // 3. Detratores NPS
    let detratores = 0;
    let comNps = 0;
    if (isRisco) {
      churnStatus.forEach(cs => {
        if (cs.status_churn === "cancelado" || cs.status_internet === "D") return;
        if (!clienteIds.has(cs.cliente_id)) return;
        if (cs.nps_classificacao) {
          comNps++;
          if (cs.nps_classificacao.toUpperCase() === "DETRATOR") detratores++;
        }
      });
    } else {
      populacao.forEach(p => {
        const cs = churnStatus.find(c => c.cliente_id === p.cliente_id && c.status_churn === "cancelado");
        if (cs?.nps_classificacao) {
          comNps++;
          if (cs.nps_classificacao.toUpperCase() === "DETRATOR") detratores++;
        }
      });
    }

    const factors = [
      {
        id: "chamados",
        label: "2+ chamados em 30 dias",
        icon: <Phone className="h-4 w-4" />,
        count: com2maisChamados,
        pct: totalBase > 0 ? (com2maisChamados / totalBase * 100) : 0,
        route: "/",
        aging: null,
      },
      {
        id: "aging",
        label: "Pressão Financeira (Aging)",
        icon: <CreditCard className="h-4 w-4" />,
        count: totalAging,
        pct: totalBase > 0 ? (totalAging / totalBase * 100) : 0,
        route: "/financeiro",
        aging: { aging7_14, aging15_30, aging30plus, totalBase },
      },
      {
        id: "nps",
        label: "Detratores NPS",
        icon: <ThumbsDown className="h-4 w-4" />,
        count: detratores,
        pct: comNps > 0 ? (detratores / comNps * 100) : 0,
        route: "/nps",
        aging: null,
      },
    ].filter(f => f.count > 0).sort((a, b) => b.pct - a.pct);

    return { factors, totalBase };
  }, [fatoresMode, saudeAtual.clientesAtivos, filteredEventos, getChamadosPorCliente, churnStatus, cidade, bairro, plano, dataLimiteChurn]);

  // =========================================================
  // BLOCO 3 — DISTRIBUIÇÃO GEOGRÁFICA (multi-metric por bairro)
  // =========================================================
  const geoPorBairro = useMemo(() => {
    // Total de clientes por bairro (base filtrada)
    const totalPorBairro = new Map<string, Set<number>>();
    filteredEventos.forEach(e => {
      if (!e.cliente_bairro) return;
      if (!totalPorBairro.has(e.cliente_bairro)) totalPorBairro.set(e.cliente_bairro, new Set());
      totalPorBairro.get(e.cliente_bairro)!.add(e.cliente_id);
    });

    if (geoMetric === "churn") {
      // Cancelados por bairro
      const canceladosPorBairro = new Map<string, Set<number>>();
      churnStatus.forEach(cs => {
        if (cs.status_churn !== "cancelado") return;
        if (!cs.cliente_bairro) return;
        if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
        if (plano !== "todos" && cs.plano_nome !== plano) return;
        if (dataLimiteChurn && cs.data_cancelamento) {
          const d = new Date(cs.data_cancelamento);
          if (!isNaN(d.getTime()) && d < dataLimiteChurn) return;
        }
        if (!canceladosPorBairro.has(cs.cliente_bairro)) canceladosPorBairro.set(cs.cliente_bairro, new Set());
        canceladosPorBairro.get(cs.cliente_bairro)!.add(cs.cliente_id);
        if (!totalPorBairro.has(cs.cliente_bairro)) totalPorBairro.set(cs.cliente_bairro, new Set());
        totalPorBairro.get(cs.cliente_bairro)!.add(cs.cliente_id);
      });
      const data: { bairro: string; value: number; total: number; taxa: number; label: string }[] = [];
      canceladosPorBairro.forEach((ids, b) => {
        const total = totalPorBairro.get(b)?.size || ids.size;
        data.push({ bairro: b, value: ids.size, total, taxa: total > 0 ? (ids.size / total * 100) : 0, label: `${ids.size} cancelados de ${total}` });
      });
      return data.filter(d => d.value > 0).sort((a, b) => churnChartMode === "taxa" ? b.taxa - a.taxa : b.value - a.value).slice(0, 15);
    }

    if (geoMetric === "financeiro") {
      // Vencidos por bairro
      const vencidosPorBairro = new Map<string, Set<number>>();
      filteredEventos.forEach(e => {
        if (!e.cliente_bairro || !isClienteVencido(e)) return;
        if (!vencidosPorBairro.has(e.cliente_bairro)) vencidosPorBairro.set(e.cliente_bairro, new Set());
        vencidosPorBairro.get(e.cliente_bairro)!.add(e.cliente_id);
      });
      const data: { bairro: string; value: number; total: number; taxa: number; label: string }[] = [];
      vencidosPorBairro.forEach((ids, b) => {
        const total = totalPorBairro.get(b)?.size || ids.size;
        data.push({ bairro: b, value: ids.size, total, taxa: total > 0 ? (ids.size / total * 100) : 0, label: `${ids.size} inadimplentes de ${total}` });
      });
      return data.filter(d => d.value > 0).sort((a, b) => churnChartMode === "taxa" ? b.taxa - a.taxa : b.value - a.value).slice(0, 15);
    }

    if (geoMetric === "nps") {
      // Detratores NPS por bairro
      const detratoresPorBairro = new Map<string, Set<number>>();
      const respondeuPorBairro = new Map<string, Set<number>>();
      churnStatus.forEach(cs => {
        if (cs.status_churn === "cancelado" || cs.status_internet === "D") return;
        if (!cs.cliente_bairro) return;
        if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
        if (plano !== "todos" && cs.plano_nome !== plano) return;
        if (cs.nps_classificacao) {
          if (!respondeuPorBairro.has(cs.cliente_bairro)) respondeuPorBairro.set(cs.cliente_bairro, new Set());
          respondeuPorBairro.get(cs.cliente_bairro)!.add(cs.cliente_id);
          if (cs.nps_classificacao.toUpperCase() === "DETRATOR") {
            if (!detratoresPorBairro.has(cs.cliente_bairro)) detratoresPorBairro.set(cs.cliente_bairro, new Set());
            detratoresPorBairro.get(cs.cliente_bairro)!.add(cs.cliente_id);
          }
        }
      });
      const data: { bairro: string; value: number; total: number; taxa: number; label: string }[] = [];
      detratoresPorBairro.forEach((ids, b) => {
        const respondeu = respondeuPorBairro.get(b)?.size || ids.size;
        data.push({ bairro: b, value: ids.size, total: respondeu, taxa: respondeu > 0 ? (ids.size / respondeu * 100) : 0, label: `${ids.size} detratores de ${respondeu} respondentes` });
      });
      return data.filter(d => d.value > 0).sort((a, b) => churnChartMode === "taxa" ? b.taxa - a.taxa : b.value - a.value).slice(0, 15);
    }

    if (geoMetric === "ltv") {
      // LTV médio por bairro
      const ltvPorBairro = new Map<string, { total: number; count: number }>();
      churnStatus.forEach(cs => {
        if (cs.status_churn === "cancelado" || cs.status_internet === "D") return;
        if (!cs.cliente_bairro) return;
        if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
        if (plano !== "todos" && cs.plano_nome !== plano) return;
        const ltv = cs.ltv_estimado || (cs.valor_mensalidade || 0) * (cs.tempo_cliente_meses || 12);
        if (!ltvPorBairro.has(cs.cliente_bairro)) ltvPorBairro.set(cs.cliente_bairro, { total: 0, count: 0 });
        const v = ltvPorBairro.get(cs.cliente_bairro)!;
        v.total += ltv;
        v.count++;
      });
      const data: { bairro: string; value: number; total: number; taxa: number; label: string }[] = [];
      ltvPorBairro.forEach((v, b) => {
        const avg = v.count > 0 ? v.total / v.count : 0;
        data.push({ bairro: b, value: Math.round(avg), total: v.count, taxa: avg, label: `LTV médio R$ ${avg.toFixed(0)} (${v.count} clientes)` });
      });
      return data.filter(d => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 15);
    }

    return [];
  }, [filteredEventos, churnStatus, dataLimiteChurn, cidade, plano, churnChartMode, geoMetric]);

  // =========================================================
  // BLOCO 4 — IMPACTO FINANCEIRO
  // =========================================================
  const impactoFinanceiro = useMemo(() => {
    let receitaEmRisco = 0;
    let ltvsPerdidos: number[] = [];

    churnStatus.forEach(cs => {
      if (cs.status_churn === "cancelado") return;
      if (cs.status_internet === "D") return;
      if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
      if (bairro !== "todos" && cs.cliente_bairro !== bairro) return;
      if (plano !== "todos" && cs.plano_nome !== plano) return;
      const sm = scoreMap.get(cs.cliente_id);
      if (sm && (sm.bucket === "ALERTA" || sm.bucket === "CRÍTICO")) {
        receitaEmRisco += cs.ltv_estimado || (cs.valor_mensalidade || 0) * 12;
      }
    });

    churnStatus.forEach(cs => {
      if (cs.status_churn !== "cancelado") return;
      if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
      if (bairro !== "todos" && cs.cliente_bairro !== bairro) return;
      if (plano !== "todos" && cs.plano_nome !== plano) return;
      if (dataLimiteChurn && cs.data_cancelamento) {
        const d = new Date(cs.data_cancelamento);
        if (!isNaN(d.getTime()) && d < dataLimiteChurn) return;
      }
      const ltv = cs.ltv_estimado || (cs.valor_mensalidade || 0) * (cs.tempo_cliente_meses || 12);
      ltvsPerdidos.push(ltv);
    });

    const ltvMedioPerdido = ltvsPerdidos.length > 0
      ? ltvsPerdidos.reduce((a, b) => a + b, 0) / ltvsPerdidos.length
      : 0;

    return {
      receitaEmRisco,
      receitaJaPerdida: saudeAtual.receitaPerdida,
      ticketMedioChurnado: saudeAtual.ticketMedioPerdido,
      ltvMedioPerdido,
    };
  }, [churnStatus, scoreMap, dataLimiteChurn, cidade, bairro, plano, saudeAtual]);

  // =========================================================
  // BLOCO 5 — AÇÕES PRIORITÁRIAS (inteligência)
  // =========================================================
  const acoesPrioritarias = useMemo(() => {
    const acoes: { id: string; texto: string; severity: "critical" | "high" | "medium"; route: string; count: number }[] = [];

    let riscoComAtraso = 0;
    churnStatus.forEach(cs => {
      if (cs.status_churn === "cancelado" || cs.status_internet === "D") return;
      if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
      if (bairro !== "todos" && cs.cliente_bairro !== bairro) return;
      if (plano !== "todos" && cs.plano_nome !== plano) return;
      const sm = scoreMap.get(cs.cliente_id);
      if (sm && (sm.bucket === "ALERTA" || sm.bucket === "CRÍTICO") && cs.dias_atraso && cs.dias_atraso > 15) {
        riscoComAtraso++;
      }
    });
    if (riscoComAtraso > 0) {
      acoes.push({ id: "risco_atraso", texto: `${riscoComAtraso} clientes com alto risco + atraso > 15 dias. Priorizar cobrança preventiva.`, severity: "critical", route: "/clientes-em-risco", count: riscoComAtraso });
    }

    if (geoPorBairro.length > 0 && geoMetric === "churn") {
      const mediaChurn = geoPorBairro.reduce((s, d) => s + d.taxa, 0) / geoPorBairro.length;
      const bairrosAltos = geoPorBairro.filter(b => b.taxa > mediaChurn * 1.5);
      if (bairrosAltos.length > 0) {
        const top = bairrosAltos[0];
        acoes.push({ id: "bairro_churn", texto: `${top.bairro} com churn ${top.taxa.toFixed(1)}% — ${(top.taxa / (mediaChurn || 1)).toFixed(1)}x acima da média.`, severity: "high", route: "/cancelamentos", count: top.value });
      }
    }

    let detratoresSemContato = 0;
    churnStatus.forEach(cs => {
      if (cs.status_churn === "cancelado" || cs.status_internet === "D") return;
      if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
      if (bairro !== "todos" && cs.cliente_bairro !== bairro) return;
      if (plano !== "todos" && cs.plano_nome !== plano) return;
      if (cs.nps_classificacao?.toUpperCase() === "DETRATOR") {
        if (!cs.ultimo_atendimento_data) { detratoresSemContato++; }
        else {
          const lastContact = new Date(cs.ultimo_atendimento_data);
          const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (lastContact < sevenDaysAgo) detratoresSemContato++;
        }
      }
    });
    if (detratoresSemContato > 0) {
      acoes.push({ id: "detratores", texto: `${detratoresSemContato} detratores NPS sem contato nos últimos 7 dias.`, severity: "medium", route: "/nps", count: detratoresSemContato });
    }

    if (saudeAtual.pctInadimplencia > 10) {
      acoes.push({ id: "inadimplencia", texto: `Inadimplência em ${saudeAtual.pctInadimplencia.toFixed(1)}% da base (${saudeAtual.vencidosCount} clientes). Ação de cobrança recomendada.`, severity: saudeAtual.pctInadimplencia > 20 ? "critical" : "high", route: "/financeiro", count: saudeAtual.vencidosCount });
    }

    return acoes.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2 };
      return order[a.severity] - order[b.severity];
    });
  }, [churnStatus, scoreMap, geoPorBairro, geoMetric, saudeAtual, cidade, bairro, plano]);

  // =========================================================
  // FILA DE RISCO (top 8 clientes - mesma lógica do Clientes em Risco)
  // =========================================================
  const filaRisco = useMemo(() => {
    const map = new Map<number, ChurnStatus>();
    churnStatus.forEach(cs => {
      if (cs.status_internet === "D") return;
      if (cs.status_churn === "cancelado") return;
      if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
      if (bairro !== "todos" && cs.cliente_bairro !== bairro) return;
      if (plano !== "todos" && cs.plano_nome !== plano) return;
      const score = getScoreTotalReal(cs);
      const b = getBucketVisao(score);
      if (b !== "ALERTA" && b !== "CRÍTICO") return;
      const existing = map.get(cs.cliente_id);
      if (!existing || score > getScoreTotalReal(existing)) {
        map.set(cs.cliente_id, cs);
      }
    });
    return Array.from(map.values())
      .sort((a, b) => getScoreTotalReal(b) - getScoreTotalReal(a))
      .slice(0, 8);
  }, [churnStatus, scoreMap, cidade, bairro, plano, getScoreTotalReal, getBucketVisao]);

  // Handlers for CRM drawer in Visão Geral
  const handleStartTreatmentVG = useCallback(async (c: ChurnStatus) => {
    const autoTags: string[] = [];
    const b = getBucketVisao(getScoreTotalReal(c));
    if (b === "CRÍTICO") autoTags.push("Crítico");
    if ((c.ltv_estimado ?? 0) >= 3000) autoTags.push("Alto Ticket");
    const nps = npsMap.get(c.cliente_id);
    if (nps?.classificacao === "DETRATOR") autoTags.push("NPS Detrator");
    await addToWorkflow(c.cliente_id, autoTags);
    toast({ title: "Cliente adicionado ao workflow" });
  }, [getBucketVisao, getScoreTotalReal, npsMap, addToWorkflow, toast]);

  const handleUpdateStatusVG = useCallback(async (clienteId: number, status: WorkflowStatus) => {
    await updateStatus(clienteId, status);
    toast({ title: `Marcado como ${status}` });
  }, [updateStatus, toast]);

  // Events for selected client in drawer
  const selectedClienteRiscoEvents = useMemo(() => {
    if (!selectedClienteRisco) return [];
    const c = selectedClienteRisco;
    const evts: any[] = [];
    const now = new Date().toISOString();
    const realEvents = churnEvents
      .filter((e) => e.cliente_id === c.cliente_id)
      .filter((e) => e.tipo_evento !== "chamado_reincidente" && e.tipo_evento !== "nps_detrator")
      .slice(0, 10);
    evts.push(...realEvents);
    const scoreFinanceiro = calcScoreFinanceiroConfiguravel(c.dias_atraso, churnConfig);
    if (scoreFinanceiro > 0) {
      evts.push({ id: "synth-financeiro", isp_id: c.isp_id, cliente_id: c.cliente_id, id_contrato: null, tipo_evento: "score_financeiro", peso_evento: 3, impacto_score: scoreFinanceiro, descricao: `${Math.round(c.dias_atraso ?? 0)} dias em atraso — impacto de +${scoreFinanceiro}pts`, dados_evento: { dias_atraso: c.dias_atraso }, data_evento: c.ultimo_pagamento_data || now, created_at: now });
    }
    const ch30Real = chamadosPorClienteMap.d30.get(c.cliente_id)?.chamados_periodo ?? 0;
    const rawUltimoChamado = chamadosPorClienteMap.d30.get(c.cliente_id)?.ultimo_chamado ?? c.ultimo_atendimento_data ?? now;
    const ultimoChamadoData = typeof rawUltimoChamado === "string" ? rawUltimoChamado.replace(" ", "T") : now;
    if (ch30Real >= 2) {
      const impacto = ch30Real >= 3 ? churnConfig.chamados30dBase + (ch30Real - 2) * churnConfig.chamadoAdicional : churnConfig.chamados30dBase;
      evts.push({ id: "real-reincidente", isp_id: c.isp_id, cliente_id: c.cliente_id, id_contrato: null, tipo_evento: "chamado_reincidente", peso_evento: ch30Real >= 3 ? 3 : 2, impacto_score: impacto, descricao: `${ch30Real} chamados nos últimos 30 dias — impacto de +${impacto}pts`, dados_evento: { qtd_chamados_30d_real: ch30Real }, data_evento: ultimoChamadoData, created_at: ultimoChamadoData });
    }
    const npsCliente = npsMap.get(c.cliente_id);
    if (npsCliente?.classificacao === "DETRATOR") {
      const npsData = npsCliente.data ?? now;
      evts.push({ id: "real-nps-detrator", isp_id: c.isp_id, cliente_id: c.cliente_id, id_contrato: null, tipo_evento: "nps_detrator", peso_evento: 4, impacto_score: churnConfig.npsDetrator, descricao: `NPS Detrator — nota ${npsCliente.nota}/10 — impacto de +${churnConfig.npsDetrator}pts`, dados_evento: { nota_nps: npsCliente.nota, classificacao: npsCliente.classificacao }, data_evento: npsData, created_at: npsData });
    }
    evts.sort((a, b) => (b.impacto_score || 0) - (a.impacto_score || 0));
    return evts;
  }, [selectedClienteRisco, churnEvents, chamadosPorClienteMap, npsMap, churnConfig]);

  const selectedClienteRiscoChamados = useMemo(() => {
    if (!selectedClienteRisco) return [];
    return chamados.filter(c => {
      const cid = typeof c.id_cliente === 'string' ? parseInt(c.id_cliente as any, 10) : c.id_cliente;
      return cid === selectedClienteRisco.cliente_id;
    });
  }, [selectedClienteRisco, chamados]);

  function getPrioridade(c: ChurnStatus, bucket: RiskBucket): string {
    const ltv = c.ltv_estimado ?? 0;
    if (ltv >= 3000 && bucket === "CRÍTICO") return "P0";
    if (ltv >= 3000 && bucket === "ALERTA") return "P1";
    if (bucket === "CRÍTICO") return "P1";
    if (ltv >= 1500 && bucket === "ALERTA") return "P2";
    if (bucket === "ALERTA") return "P2";
    return "P3";
  }

  // =========================================================
  // MAP DATA
  // =========================================================
  const bairroCoords: Record<string, { lat: number; lng: number }> = {
    "Centro": { lat: -26.9316, lng: -48.9586 },
    "Gaspar Grande": { lat: -26.9180, lng: -48.9750 },
    "Gasparinho": { lat: -26.9450, lng: -48.9700 },
    "Bela Vista": { lat: -26.9250, lng: -48.9500 },
    "Coloninha": { lat: -26.9400, lng: -48.9400 },
    "Margem Esquerda": { lat: -26.9350, lng: -48.9650 },
    "Sete De Setembro": { lat: -26.9280, lng: -48.9480 },
    "Santa Terezinha": { lat: -26.9200, lng: -48.9350 },
    "Figueira": { lat: -26.9100, lng: -48.9600 },
    "Alto Gasparinho": { lat: -26.9500, lng: -48.9800 },
    "Poço Grande": { lat: -26.9000, lng: -48.9700 },
    "Baixas": { lat: -26.8900, lng: -48.9500 },
    "Barracão": { lat: -26.9600, lng: -48.9300 },
    "Belchior": { lat: -26.8800, lng: -48.9400 },
    "Belchior Alto": { lat: -26.8700, lng: -48.9350 },
    "Belchior Baixo": { lat: -26.8850, lng: -48.9450 },
    "Bateias": { lat: -26.9700, lng: -48.9200 },
    "Baú Baixo": { lat: -26.8950, lng: -48.9550 },
    "Baú Central": { lat: -26.8900, lng: -48.9600 },
    "Arraial": { lat: -26.9150, lng: -48.9450 },
    "Vila Nova": { lat: -26.9380, lng: -48.9520 },
    "Barra Luiz Alves": { lat: -26.8600, lng: -48.9300 },
    "Barra De Luiz Alves": { lat: -26.8600, lng: -48.9300 },
    "Ilhotinha": { lat: -26.9050, lng: -48.8300 },
    "Ilhota Centro": { lat: -26.9000, lng: -48.8250 },
    "Velha": { lat: -26.9200, lng: -49.0800 },
    "Garcia": { lat: -26.9100, lng: -49.0600 },
    "Itoupava Norte": { lat: -26.8700, lng: -49.0500 },
    "São João": { lat: -26.9100, lng: -48.6700 },
    "Fazenda": { lat: -26.9200, lng: -48.6600 },
  };

  const mapEventos = useMemo(() => {
    let filtered = [...eventos] as Evento[];
    if (cidade !== "todos") filtered = filtered.filter((e) => e.cliente_cidade === cidade);
    if (bairro !== "todos") filtered = filtered.filter((e) => e.cliente_bairro === bairro);
    if (plano !== "todos") filtered = filtered.filter((e) => e.plano_nome === plano);
    if (filial !== "todos") filtered = filtered.filter((e) => String(e.filial_id) === filial);
    return filtered;
  }, [eventos, cidade, bairro, plano, filial]);

  const mapData = useMemo(() => {
    const clientesMap = new Map<number, any>();
    const chamadosPorCliente = getChamadosPorCliente(undefined);
    mapEventos.forEach(e => {
      let lat = e.geo_lat;
      let lng = e.geo_lng;
      if ((!lat || !lng || lat === 0 || lng === 0) && e.cliente_bairro) {
        const coords = bairroCoords[e.cliente_bairro];
        if (coords) {
          lat = coords.lat + (Math.random() - 0.5) * 0.01;
          lng = coords.lng + (Math.random() - 0.5) * 0.01;
        }
      }
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      const chamadosCliente = chamadosPorCliente.get(e.cliente_id);
      const qtdChamados = chamadosCliente?.total_chamados || 0;
      const existing = clientesMap.get(e.cliente_id);
      if (!existing || (e.dias_atraso && e.dias_atraso > (existing.dias_atraso || 0))) {
        clientesMap.set(e.cliente_id, {
          cliente_id: e.cliente_id, cliente_nome: e.cliente_nome, cliente_cidade: e.cliente_cidade, cliente_bairro: e.cliente_bairro,
          geo_lat: lat, geo_lng: lng,
          churn_risk_score: scoreMap.get(e.cliente_id)?.score ?? e.churn_risk_score,
          dias_atraso: e.dias_atraso, vencido: e.vencido, alerta_tipo: e.alerta_tipo, downtime_min_24h: e.downtime_min_24h, qtd_chamados: qtdChamados,
        });
      }
    });
    return Array.from(clientesMap.values());
  }, [mapEventos, getChamadosPorCliente, scoreMap]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)} mi`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)} mil`;
    return `R$ ${value.toFixed(0)}`;
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const severityStyles = {
    critical: "border-l-destructive bg-destructive/5",
    high: "border-l-warning bg-warning/5",
    medium: "border-l-primary bg-primary/5",
  };

  const BUCKET_COLORS: Record<string, string> = {
    OK: "bg-green-100 text-green-800 border-green-200",
    ALERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
    "CRÍTICO": "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Compacto */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Cockpit de Retenção
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span className="font-semibold text-primary">{periodoLabel}</span>
              {snapshotDate && (
                <span className="bg-muted px-1.5 py-0.5 rounded border">
                  Snapshot: {snapshotDate.toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              {["7", "30", "90"].map(p => {
                const dias = parseInt(p);
                const unavailable = dataSpanDays < dias;
                return (
                  <button key={p} onClick={() => !unavailable && setPeriodo(p)}
                    disabled={unavailable}
                    title={unavailable ? `Sem dados anteriores a ${dias} dias` : `Últimos ${dias} dias`}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${periodo === p ? "bg-primary text-primary-foreground shadow-sm" : unavailable ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:bg-background"}`}>
                    {p}d
                  </button>
                );
              })}
            </div>
            <IspActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-5">
        {showInitialScreen && <InitialLoadingScreen />}

        {isLoading && !showInitialScreen ? (
          <LoadingScreen />
        ) : error ? (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Erro ao carregar dados: {error}</span>
          </div>
        ) : (
          <>
            {/* FILTROS GLOBAIS */}
            <GlobalFilters filters={[
              {
                id: "plano", label: "Plano", value: plano, onChange: setPlano,
                disabled: filterOptions.planos.length === 0,
                tooltip: "Nenhum plano encontrado",
                options: [{ value: "todos", label: "Todos" }, ...filterOptions.planos.map(p => ({ value: p, label: p.length > 30 ? p.substring(0, 30) + "…" : p }))],
              },
              {
                id: "cidade", label: "Cidade", value: cidade, onChange: setCidade,
                disabled: filterOptions.cidades.length === 0,
                tooltip: "Nenhuma cidade encontrada",
                options: [{ value: "todos", label: "Todas" }, ...filterOptions.cidades.map(c => ({ value: c, label: cidadeIdMap[c] || c }))],
              },
              {
                id: "bairro", label: "Bairro", value: bairro, onChange: setBairro,
                disabled: filterOptions.bairros.length === 0,
                tooltip: "Nenhum bairro encontrado",
                options: [{ value: "todos", label: "Todos" }, ...filterOptions.bairros.map(b => ({ value: b, label: b }))],
              },
              {
                id: "filial", label: "Filial", value: filial, onChange: setFilial,
                disabled: filterOptions.filiais.length === 0,
                tooltip: "Campo filial não encontrado nos dados",
                options: [
                  { value: "todos", label: "Todas" },
                  ...filterOptions.filiais.map(f => ({ value: f, label: `Filial ${f}` })),
                ],
              },
            ]} />

            {/* ============================================= */}
            {/* BLOCO 1 — SAÚDE ATUAL DA BASE */}
            {/* ============================================= */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Target className="h-3.5 w-3.5" />
                Saúde Atual da Base
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Churn */}
                <Card className="border-l-4 border-l-destructive overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Churn no Período</p>
                        <p className="text-3xl font-bold mt-1 text-destructive">{saudeAtual.churnPct.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {saudeAtual.canceladosPeriodo} cancelamentos
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {periodoLabel}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-destructive/10">
                        <TrendingDown className="h-5 w-5 text-destructive" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 2: Receita Perdida */}
                <Card className="border-l-4 border-l-warning overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Receita Perdida</p>
                        <p className="text-3xl font-bold mt-1">{formatCurrency(saudeAtual.receitaPerdida)}<span className="text-sm font-normal text-muted-foreground">/mês</span></p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Ticket médio: {formatCurrency(saudeAtual.ticketMedioPerdido)}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-warning/10">
                        <DollarSign className="h-5 w-5 text-warning" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 3: Clientes em Alto Risco */}
                <Card className={`border-l-4 overflow-hidden ${saudeAtual.clientesAltoRisco > 0 ? "border-l-destructive" : "border-l-success"}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Clientes em Alto Risco</p>
                        <p className="text-3xl font-bold mt-1">{saudeAtual.clientesAltoRisco}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {saudeAtual.pctAltoRisco.toFixed(1)}% da base
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          MRR em risco: {formatCurrency(saudeAtual.mrrEmRisco)}
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-destructive/10">
                        <ShieldAlert className="h-5 w-5 text-destructive" />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Card 4: Inadimplência */}
                <Card className={`border-l-4 overflow-hidden ${saudeAtual.pctInadimplencia > 15 ? "border-l-destructive" : saudeAtual.pctInadimplencia > 5 ? "border-l-warning" : "border-l-success"}`}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground font-medium">Inadimplência Ativa</p>
                        <p className="text-3xl font-bold mt-1">{saudeAtual.pctInadimplencia.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatCurrency(saudeAtual.totalVencido)} em aberto
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {saudeAtual.vencidosCount} clientes vencidos
                        </p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-warning/10">
                        <CreditCard className="h-5 w-5 text-warning" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* ============================================= */}
            {/* BLOCO 2 — PRINCIPAIS FATORES DE RISCO */}
            {/* ============================================= */}
            {fatoresRisco.factors.length > 0 && (
              <section className="rounded-xl bg-destructive/[0.03] border border-destructive/10 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Principais Fatores de Risco
                    <span className="text-[10px] font-normal normal-case text-muted-foreground">({fatoresMode === "risco" ? "Em Risco" : `${fatoresRisco.totalBase} cancelados`})</span>
                  </h2>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setFatoresMode("risco")}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${fatoresMode === "risco" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      Em Risco
                    </button>
                    <button
                      onClick={() => setFatoresMode("cancelados")}
                      className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${fatoresMode === "cancelados" ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      Cancelados
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {fatoresRisco.factors.map((f) => (
                    <Card key={f.id} className="hover:shadow-md transition-shadow cursor-pointer group border-destructive/20 bg-card" onClick={() => navigate(f.route)}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-destructive/10 group-hover:bg-destructive/20 transition-colors">
                              {f.icon}
                            </div>
                            <div>
                              <p className="text-xl font-bold">{f.pct.toFixed(1)}%</p>
                              <p className="text-[11px] text-muted-foreground leading-tight">{f.label}</p>
                            </div>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">
                            {f.count}
                          </Badge>
                        </div>
                        {/* Aging breakdown — compact inline */}
                        {f.aging && (
                          <div className="mt-2 flex gap-2 text-[10px]">
                            <span className="bg-muted px-1.5 py-0.5 rounded">7–14d: <strong>{f.aging.aging7_14}</strong></span>
                            <span className="bg-warning/10 text-warning px-1.5 py-0.5 rounded">15–30d: <strong>{f.aging.aging15_30}</strong></span>
                            <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">30+d: <strong>{f.aging.aging30plus}</strong></span>
                          </div>
                        )}
                        {!f.aging && (
                          <div className="mt-2">
                            <div className="w-full bg-muted rounded-full h-1">
                              <div
                                className={`h-1 rounded-full transition-all ${f.pct > 20 ? "bg-destructive" : f.pct > 10 ? "bg-warning" : "bg-primary"}`}
                                style={{ width: `${Math.min(100, f.pct)}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {/* Ver button */}
                        <div className="mt-3 flex justify-end">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            Ver <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* ============================================= */}
            {/* BLOCO 3 — DISTRIBUIÇÃO GEOGRÁFICA */}
            {/* ============================================= */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                Distribuição Geográfica
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Gráfico por bairro — multi-metric */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      {/* Metric selector (clickable title) */}
                      <div className="flex flex-wrap gap-1">
                        {(["financeiro", "churn", "ltv", "nps"] as GeoMetric[]).map(m => (
                          <button
                            key={m}
                            onClick={() => setGeoMetric(m)}
                            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${geoMetric === m ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                          >
                            {m === "churn" ? "Churn" : m === "financeiro" ? "Financeiro" : m === "nps" ? "NPS" : "LTV"}
                          </button>
                        ))}
                      </div>
                      {/* Taxa / Volume toggle (not for LTV) */}
                      {geoMetric !== "ltv" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => setChurnChartMode("taxa")}
                            className={`px-2 py-1 text-[10px] rounded font-medium transition-colors ${churnChartMode === "taxa" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                          >
                            Taxa
                          </button>
                          <button
                            onClick={() => setChurnChartMode("volume")}
                            className={`px-2 py-1 text-[10px] rounded font-medium transition-colors ${churnChartMode === "volume" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                          >
                            Volume
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {geoPorBairro.length} bairros · {geoMetric === "ltv" ? "Ordenado por LTV médio" : `Ordenado por ${churnChartMode === "taxa" ? "taxa %" : "volume"}`}
                    </p>
                  </CardHeader>
                  <CardContent className="p-0 px-2 pb-2">
                    {geoPorBairro.length > 0 ? (
                      <ResponsiveContainer width="100%" height={Math.max(300, geoPorBairro.length * 32)}>
                        <BarChart data={geoPorBairro} layout="vertical" margin={{ left: 10, right: 16, top: 4, bottom: 4 }} barCategoryGap="16%">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                          <XAxis type="number" fontSize={10} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis dataKey="bairro" type="category" width={130} fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload || !payload.length) return null;
                              const d = payload[0].payload;
                              return (
                                <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm min-w-[220px]">
                                  <p className="font-semibold text-foreground mb-1">{d.bairro}</p>
                                  <p className="text-muted-foreground">{d.label}</p>
                                  {geoMetric !== "ltv" && <p className="text-muted-foreground">Taxa: <span className="font-medium text-foreground">{d.taxa.toFixed(1)}%</span></p>}
                                </div>
                              );
                            }}
                          />
                          <Bar dataKey={geoMetric === "ltv" || churnChartMode === "volume" ? "value" : "taxa"} radius={[0, 4, 4, 0]}>
                            {geoPorBairro.map((entry, index) => {
                              const v = geoMetric === "ltv" ? entry.value : (churnChartMode === "taxa" ? entry.taxa : entry.value);
                              let color: string;
                              if (geoMetric === "ltv") {
                                color = v > 5000 ? "hsl(var(--primary))" : v > 2000 ? "hsl(var(--success))" : "hsl(var(--muted-foreground))";
                              } else {
                                color = churnChartMode === "taxa"
                                  ? (v > 10 ? "hsl(var(--destructive))" : v > 5 ? "hsl(var(--warning))" : "hsl(var(--success))")
                                  : (v > 15 ? "hsl(var(--destructive))" : v > 8 ? "hsl(var(--warning))" : "hsl(var(--success))");
                              }
                              return <Cell key={index} fill={color} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : geoMetric === "nps" ? (
                      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                        <ThumbsDown className="h-8 w-8 text-muted-foreground/40 mb-3" />
                        <p className="text-sm font-medium text-muted-foreground mb-1">Dados de NPS indisponíveis</p>
                        <p className="text-xs text-muted-foreground/70 mb-3 max-w-[260px]">
                          Importe seus dados de NPS ou contrate o Agente NPS Check da Uniforce para pesquisas automatizadas.
                        </p>
                        <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => navigate("/nps")}>
                          Configurar NPS
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-12 text-sm">Sem dados para "{GEO_METRIC_LABELS[geoMetric]}"</p>
                    )}
                  </CardContent>
                </Card>

                {/* Mapa ampliado */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Mapa de Alertas
                        </CardTitle>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {mapData.length} clientes geolocalizados
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Grid/Markers toggle */}
                        <div className="flex gap-1 bg-muted rounded-md p-0.5">
                          <button
                            onClick={() => setMapViewMode("grid")}
                            title="Mapa de quadrantes"
                            className={`p-1 rounded text-xs transition-colors ${mapViewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}
                          >
                            <Grid3X3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setMapViewMode("markers")}
                            title="Marcadores individuais"
                            className={`p-1 rounded text-xs transition-colors ${mapViewMode === "markers" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}
                          >
                            <MapPin className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <MapTabs activeTab={mapTab} onTabChange={setMapTab} availableTabs={["chamados", "vencido", "churn"]} />
                        <button
                          onClick={() => setMapLightboxOpen(true)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Expandir mapa"
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {!mapLightboxOpen && (
                      <AlertasMapa
                        data={mapData}
                        activeFilter={mapTab as "churn" | "vencido" | "chamados"}
                        viewMode={mapViewMode}
                        height="520px"
                      />
                    )}
                    {mapLightboxOpen && (
                      <div className="flex items-center justify-center bg-muted/20" style={{ height: "520px" }}>
                        <p className="text-xs text-muted-foreground">Mapa expandido em tela cheia</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>

            {/* Map Lightbox */}
            {mapLightboxOpen && (
              <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setMapLightboxOpen(false)}>
                <div className="relative w-full max-w-[95vw] h-[85vh] bg-card rounded-xl overflow-hidden border shadow-2xl" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Mapa de Alertas
                      </CardTitle>
                      <div className="flex gap-1 bg-muted rounded-md p-0.5">
                        <button
                          onClick={() => setMapViewMode("grid")}
                          className={`p-1 rounded text-xs transition-colors ${mapViewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}
                        >
                          <Grid3X3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setMapViewMode("markers")}
                          className={`p-1 rounded text-xs transition-colors ${mapViewMode === "markers" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-background"}`}
                        >
                          <MapPin className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <MapTabs activeTab={mapTab} onTabChange={setMapTab} availableTabs={["chamados", "vencido", "churn"]} />
                    </div>
                    <button onClick={() => setMapLightboxOpen(false)} className="p-2 rounded-md hover:bg-muted transition-colors">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="h-[calc(85vh-56px)]">
                    <AlertasMapa
                      data={mapData}
                      activeFilter={mapTab as "churn" | "vencido" | "chamados"}
                      viewMode={mapViewMode}
                      height="100%"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ============================================= */}
            {/* BLOCO 4 — IMPACTO FINANCEIRO */}
            {/* ============================================= */}
            <section>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5" />
                Impacto Financeiro
              </h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <RiskKPICard
                  title="Receita em Risco (LTV)"
                  value={formatCurrency(impactoFinanceiro.receitaEmRisco)}
                  icon={AlertTriangle}
                  variant="danger"
                  subtitle={`Soma LTV de ${saudeAtual.clientesAltoRisco} clientes em risco`}
                />
                <RiskKPICard
                  title="Receita Já Perdida"
                  value={`${formatCurrency(impactoFinanceiro.receitaJaPerdida)}/mês`}
                  icon={TrendingDown}
                  variant="warning"
                  subtitle={`${saudeAtual.canceladosPeriodo} cancelamentos · ${periodoLabel}`}
                />
                <RiskKPICard
                  title="Ticket Médio Churnado"
                  value={formatCurrency(impactoFinanceiro.ticketMedioChurnado)}
                  icon={CreditCard}
                  variant="info"
                  subtitle="Mensalidade média dos cancelados"
                />
                <RiskKPICard
                  title="LTV Médio Perdido"
                  value={formatCurrency(impactoFinanceiro.ltvMedioPerdido)}
                  icon={DollarSign}
                  variant="info"
                  subtitle="Valor de vida médio perdido"
                />
              </div>
            </section>

            {/* ============================================= */}
            {/* BLOCO 5 — AÇÕES PRIORITÁRIAS */}
            {/* ============================================= */}
            {acoesPrioritarias.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5" />
                  Ações Prioritárias
                </h2>
                <div className="space-y-2">
                  {acoesPrioritarias.map((acao) => (
                    <Card key={acao.id} className={`border-l-4 ${severityStyles[acao.severity]} hover:shadow-md transition-shadow`}>
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className={`p-1.5 rounded-lg mt-0.5 ${acao.severity === "critical" ? "bg-destructive/10" : acao.severity === "high" ? "bg-warning/10" : "bg-primary/10"}`}>
                            <Zap className={`h-4 w-4 ${acao.severity === "critical" ? "text-destructive" : acao.severity === "high" ? "text-warning" : "text-primary"}`} />
                          </div>
                          <p className="text-sm text-foreground leading-relaxed">{acao.texto}</p>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 text-xs shrink-0" onClick={() => navigate(acao.route)}>
                          Ver detalhes
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* ============================================= */}
            {/* CLIENTES EM RISCO (top 8 - mesma UX do menu) */}
            {/* ============================================= */}
            <section>
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-destructive" />
                      <CardTitle className="text-base">Clientes em Risco</CardTitle>
                      <Badge variant="destructive" className="text-xs">{filaRisco.length}</Badge>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate("/clientes-em-risco")}>
                      Ver todos ({saudeAtual.clientesAltoRisco})
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {filaRisco.length > 0 ? (
                    <div className="overflow-auto max-h-[450px]">
                      <Table>
                        <TableHeader className="sticky top-0 bg-card z-10">
                          <TableRow>
                            <TableHead className="text-xs whitespace-nowrap">Cliente</TableHead>
                            <TableHead className="text-xs whitespace-nowrap text-center">Churn Score</TableHead>
                            <TableHead className="text-xs whitespace-nowrap text-center">Dias Atraso</TableHead>
                            <TableHead className="text-xs whitespace-nowrap text-center">Chamados 90d</TableHead>
                            <TableHead className="text-xs whitespace-nowrap text-center">NPS</TableHead>
                            <TableHead className="text-xs whitespace-nowrap text-center">Prioridade</TableHead>
                            <TableHead className="text-xs whitespace-nowrap">Motivo</TableHead>
                            <TableHead className="text-xs whitespace-nowrap text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filaRisco.map((c) => {
                            const score = getScoreTotalReal(c);
                            const bucket = getBucketVisao(score);
                            const npsCliente = npsMap.get(c.cliente_id);
                            const prioridade = getPrioridade(c, bucket);
                            const ch90 = chamadosPorClienteMap.d90.get(c.cliente_id)?.chamados_periodo ?? c.qtd_chamados_90d ?? 0;
                            const PRIORIDADE_COLORS: Record<string, string> = {
                              P0: "bg-red-100 text-red-800 border-red-300",
                              P1: "bg-orange-100 text-orange-800 border-orange-300",
                              P2: "bg-yellow-100 text-yellow-800 border-yellow-300",
                              P3: "bg-gray-100 text-gray-700 border-gray-200",
                            };
                            return (
                              <TableRow key={c.id || c.cliente_id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedClienteRisco(c)}>
                                <TableCell className="text-xs font-medium max-w-[160px]">
                                  <div>
                                    <p className="truncate font-medium">{c.cliente_nome || `Cliente ${c.cliente_id}`}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">
                                      {c.cliente_bairro ? `${c.cliente_bairro}, ${getCidadeNome(c.cliente_cidade) || ""}` : getCidadeNome(c.cliente_cidade) || ""}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={`${BUCKET_COLORS[bucket] || "bg-muted"} border font-mono text-xs`}>{score}</Badge>
                                </TableCell>
                                <TableCell className="text-center text-xs">
                                  {c.dias_atraso != null && c.dias_atraso > 0 ? (
                                    <span className={c.dias_atraso > 30 ? "text-destructive font-medium" : "text-yellow-600"}>{Math.round(c.dias_atraso)}d</span>
                                  ) : "—"}
                                </TableCell>
                                <TableCell className="text-center text-xs">
                                  {ch90 > 0 ? (
                                    <span className={ch90 >= 5 ? "text-destructive font-medium" : ch90 >= 3 ? "text-yellow-600" : ""}>{ch90}</span>
                                  ) : "—"}
                                </TableCell>
                                <TableCell className="text-center">
                                  {npsCliente ? (
                                    <Badge className={`border text-[10px] ${
                                      npsCliente.classificacao === "DETRATOR" ? "bg-red-100 text-red-800 border-red-200" :
                                      npsCliente.classificacao === "NEUTRO" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                                      npsCliente.classificacao === "PROMOTOR" ? "bg-green-100 text-green-800 border-green-200" : "bg-muted"
                                    }`}>{npsCliente.nota ?? npsCliente.classificacao}</Badge>
                                  ) : <span className="text-xs text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge className={`${PRIORIDADE_COLORS[prioridade] || "bg-muted"} border text-[10px]`}>{prioridade}</Badge>
                                </TableCell>
                                <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground">
                                  {c.motivo_risco_principal || (c.dias_atraso && c.dias_atraso > 0 ? "Atraso financeiro" : "Risco identificado")}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end items-center gap-1">
                                    <QuickActions clientId={c.cliente_id} clientName={c.cliente_nome || `Cliente ${c.cliente_id}`} />
                                    <ActionMenu clientId={c.cliente_id} clientName={c.cliente_nome || `Cliente ${c.cliente_id}`} variant="risco" />
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-6">
                      <EmptyState title="Nenhum cliente em risco alto" description="Não há clientes com sinais de alerta no momento." variant="card" />
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          </>
        )}
      </main>

      {/* CRM Drawer for selected risk client */}
      {selectedClienteRisco && (
        <CrmDrawer
          cliente={selectedClienteRisco}
          score={getScoreTotalReal(selectedClienteRisco)}
          bucket={getBucketVisao(getScoreTotalReal(selectedClienteRisco))}
          workflow={workflowMap.get(selectedClienteRisco.cliente_id)}
          events={selectedClienteRiscoEvents}
          chamadosCliente={selectedClienteRiscoChamados}
          onClose={() => setSelectedClienteRisco(null)}
          onStartTreatment={async () => {
            await handleStartTreatmentVG(selectedClienteRisco);
          }}
          onUpdateStatus={async (status) => {
            await handleUpdateStatusVG(selectedClienteRisco.cliente_id, status);
          }}
          onUpdateTags={async (tags) => {
            await updateTags(selectedClienteRisco.cliente_id, tags);
          }}
          onUpdateOwner={async (ownerId) => {
            await updateOwner(selectedClienteRisco.cliente_id, ownerId);
          }}
        />
      )}
    </div>
  );
};

export default VisaoGeral;
