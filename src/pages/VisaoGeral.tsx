import { useState, useEffect, useMemo, useRef } from "react";
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
import { useChurnData } from "@/hooks/useChurnData";
import { useRiskBucketConfig } from "@/hooks/useRiskBucketConfig";

import { Evento } from "@/types/evento";
import { AlertasMapa } from "@/components/map/AlertasMapa";
import { ExecutiveSummary } from "@/components/shared/ExecutiveSummary";
import { RiskKPICard } from "@/components/shared/RiskKPICard";
import { ActionMenu, QuickActions } from "@/components/shared/ActionMenu";
import { EmptyState, NAValue } from "@/components/shared/EmptyState";
import { IspActions } from "@/components/shared/IspActions";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { InitialLoadingScreen } from "@/components/shared/InitialLoadingScreen";
import { 
  Users, 
  UserPlus,
  DollarSign, 
  AlertTriangle, 
  TrendingDown,
  CreditCard,
  Clock,
  Percent,
  AlertCircle,
  Phone,
  MessageSquare,
  Settings,
  Plus,
  Filter,
  MapPin,
  Zap,
  RefreshCcw,
  Wifi,
  ShieldAlert,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Legend,
} from "recharts";

// KPI Card Compacto
interface KPIProps {
  title: string;
  value: string | number;
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}

const KPICard = ({ title, value, variant = "default", icon }: KPIProps) => {
  const variants = {
    default: "bg-card border",
    primary: "bg-primary text-primary-foreground",
    success: "bg-success text-success-foreground",
    warning: "bg-warning text-warning-foreground", 
    danger: "bg-destructive text-destructive-foreground",
  };

  return (
    <div className={`rounded-lg p-4 ${variants[variant]}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`text-xs ${variant === "default" ? "text-muted-foreground" : "opacity-80"}`}>
          {title}
        </span>
      </div>
      <div className="text-xl font-bold">{value}</div>
    </div>
  );
};

// Cohort Filter Tabs
interface CohortTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const CohortTabs = ({ activeTab, onTabChange }: CohortTabsProps) => {
  const tabs = [
    { id: "churn", label: "Churn", icon: "%" },
    { id: "financeiro", label: "Financeiro", icon: "$" },
    { id: "suporte", label: "Suporte", icon: "🎧" },
    { id: "nps", label: "NPS", icon: "👍" },
    { id: "ltv", label: "LTV", icon: "💰" },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          <span className="mr-1">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// Map Filter Tabs
interface MapTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  availableTabs: string[];
}

const MapTabs = ({ activeTab, onTabChange, availableTabs }: MapTabsProps) => {
  const allTabs = [
    { id: "chamados", label: "Chamados" },
    { id: "vencido", label: "Vencido" },
    { id: "churn", label: "Churn" },
  ];

  const tabs = allTabs.filter(t => availableTabs.includes(t.id));

  if (tabs.length === 0) return null;

  return (
    <div className="flex gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            activeTab === tab.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

// Session-level flag — resets on new tab/login but persists across navigation
// Show initial screen once per calendar day (resets daily for fresh data loads)
const getHasShownInitial = () => {
  const stored = sessionStorage.getItem("uf_initial_shown");
  if (!stored) return false;
  // Check if it was set today
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
  const { churnStatus } = useChurnData();
  const { getBucket: getBucketVisao } = useRiskBucketConfig();

  // Detect first load (after login) vs sub-page navigation — module-level flag survives remounts
  const [showInitialScreen, setShowInitialScreen] = useState(() => !getHasShownInitial());

  useEffect(() => {
    if (!showInitialScreen) return;
    // Show for a minimum branding duration, then hide once data is ready
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
  const [status, setStatus] = useState("todos");
  const [cohortTab, setCohortTab] = useState("financeiro");
  const [mapTab, setMapTab] = useState("chamados");
  const [cohortDimension, setCohortDimension] = useState<"plano" | "cidade" | "bairro">("plano");
  const [filial, setFilial] = useState("todos");
  const [top5Dimension, setTop5Dimension] = useState<"plano" | "cidade" | "bairro">("cidade");
  const [top5Filter, setTop5Filter] = useState<"churn" | "vencido">("vencido");

  // Mapeamento de IDs de cidade para nomes - apenas cidades COM DADOS
  const cidadeIdMap: Record<string, string> = {
    "4405": "Gaspar",
    "4419": "Ilhota",
    // Blumenau (4346) e Itajaí (4435) serão adicionados quando houver dados
  };

  // Helper function para converter ID de cidade para nome
  // Se tiver no mapa usa o nome, senão usa o valor raw (pode ser nome ou ID)
  const getCidadeNome = (cidadeValue: any): string | null => {
    if (cidadeValue === null || cidadeValue === undefined || String(cidadeValue).trim() === "") return null;
    const cidadeKey = String(cidadeValue).trim();
    return cidadeIdMap[cidadeKey] || cidadeKey; // Usa valor raw como fallback
  };

  // Helper function para verificar se cliente está vencido - usa dias_atraso pois vencido=false no banco
  const isClienteVencido = (e: Evento): boolean => {
    return (e.dias_atraso !== null && e.dias_atraso !== undefined && Number(e.dias_atraso) > 0);
  };


  // Filter options
  const filterOptions = useMemo(() => {
    const ufs = new Set<string>();
    const cidades = new Set<string>();
    const bairros = new Set<string>();
    const planos = new Set<string>();
    const filiais = new Set<string>();
    eventos.forEach((e: Evento) => {
      if (e.cliente_uf) ufs.add(e.cliente_uf);
      if (e.cliente_cidade) cidades.add(e.cliente_cidade);
      if (e.cliente_bairro) bairros.add(e.cliente_bairro);
      if (e.plano_nome) planos.add(e.plano_nome);
      const fid = e.filial_id !== null && e.filial_id !== undefined ? String(e.filial_id).trim() : "";
      if (fid) filiais.add(fid);
    });
    return {
      ufs: Array.from(ufs).sort(),
      cidades: Array.from(cidades).sort(),
      bairros: Array.from(bairros).sort(),
      planos: Array.from(planos).sort(),
      filiais: Array.from(filiais).sort((a, b) => Number(a) - Number(b)),
    };
  }, [eventos]);

  // Filtered events — aplica filtros geográficos/plano/status (sem filtro de período aqui,
  // pois event_datetime é igual para todos os snapshots do mesmo dia).
  // O filtro de período é calculado separadamente via dataLimitePeriodo e aplicado nas métricas.
  const filteredEventos = useMemo(() => {
    let filtered = [...eventos] as Evento[];

    if (uf !== "todos") {
      filtered = filtered.filter((e) => e.cliente_uf === uf);
    }
    if (cidade !== "todos") {
      filtered = filtered.filter((e) => e.cliente_cidade === cidade);
    }
    if (bairro !== "todos") {
      filtered = filtered.filter((e) => e.cliente_bairro === bairro);
    }
    if (plano !== "todos") {
      filtered = filtered.filter((e) => e.plano_nome === plano);
    }
    if (status !== "todos") {
      filtered = filtered.filter((e) => e.servico_status === status || e.status_contrato === status);
    }
    if (filial !== "todos") {
      filtered = filtered.filter((e) => String(e.filial_id) === filial);
    }

    return filtered;
  }, [eventos, uf, cidade, bairro, plano, status, filial]);

  // Data do snapshot mais recente (para mostrar ao usuário quando foi a última atualização)
  const snapshotDate = useMemo(() => {
    if (eventos.length === 0) return null;
    let maxDate = new Date(0);
    eventos.forEach(e => {
      const d = new Date(e.event_datetime || e.created_at);
      if (!isNaN(d.getTime()) && d > maxDate) maxDate = d;
    });
    return maxDate.getTime() > 0 ? maxDate : null;
  }, [eventos]);

  // Data máxima dos chamados (referência real para o filtro de período em chamados)
  // Os chamados têm data_abertura no formato "DD/MM/YYYY HH:MM:SS"
  const maxChamadosDate = useMemo(() => {
    if (chamados.length === 0) return new Date();
    let maxDate = new Date(0);
    chamados.forEach(c => {
      try {
        let d: Date | null = null;
        if (c.data_abertura && c.data_abertura.includes("/")) {
          const [datePart] = c.data_abertura.split(" ");
          const [dia, mes, ano] = datePart.split("/");
          d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        } else if (c.data_abertura) {
          d = new Date(c.data_abertura);
        }
        if (d && !isNaN(d.getTime()) && d > maxDate) maxDate = d;
      } catch (e) {}
    });
    return maxDate.getTime() > 0 ? maxDate : new Date();
  }, [chamados]);

  // Calcula a data limite RELATIVA à data máxima dos chamados (não Date.now())
  // Isso evita que "7 dias" retorne vazio quando os dados têm delay de sincronização
  const dataLimitePeriodo = useMemo(() => {
    if (periodo === "todos") return null;
    const limite = new Date(maxChamadosDate.getTime() - parseInt(periodo) * 24 * 60 * 60 * 1000);
    return limite;
  }, [periodo, maxChamadosDate]);

  // Data máxima de vencimento encontrada no banco (referência para financeiro)
  // Usamos data_vencimento como base temporal de cobranças
  const maxVencimentoDate = useMemo(() => {
    let maxDate = new Date(0);
    eventos.forEach(e => {
      if (!e.data_vencimento) return;
      try {
        // Suporta formatos: YYYY-MM-DD, DD/MM/YYYY
        let d: Date | null = null;
        const raw = String(e.data_vencimento).replace(" ", "T");
        if (raw.includes("/")) {
          const [dia, mes, ano] = raw.split("/");
          d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        } else {
          d = new Date(raw);
        }
        if (d && !isNaN(d.getTime()) && d > maxDate) maxDate = d;
      } catch (_) {}
    });
    return maxDate.getTime() > 0 ? maxDate : new Date();
  }, [eventos]);

  // Data limite para financeiro: relativa ao vencimento mais recente no banco
  const dataLimiteFinanceiro = useMemo(() => {
    if (periodo === "todos") return null;
    return new Date(maxVencimentoDate.getTime() - parseInt(periodo) * 24 * 60 * 60 * 1000);
  }, [periodo, maxVencimentoDate]);

  // Para dados financeiros: filtra por data_vencimento dentro do período
  const filteredEventosPeriodo = useMemo(() => {
    if (!dataLimiteFinanceiro) return filteredEventos;
    return filteredEventos.filter(e => {
      if (!e.data_vencimento) return true; // sem data de vencimento, sempre inclui
      try {
        const raw = String(e.data_vencimento).replace(" ", "T");
        let d: Date | null = null;
        if (raw.includes("/")) {
          const [dia, mes, ano] = raw.split("/");
          d = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
        } else {
          d = new Date(raw);
        }
        return d && !isNaN(d.getTime()) && d >= dataLimiteFinanceiro;
      } catch (_) {
        return true;
      }
    });
  }, [filteredEventos, dataLimiteFinanceiro]);

  // Label amigável do período para exibição
  const periodoLabel = useMemo(() => {
    if (periodo === "todos") return "Todo o histórico";
    const n = parseInt(periodo);
    if (n === 7) return "Últimos 7 dias";
    if (n === 30) return "Últimos 30 dias";
    if (n === 90) return "Últimos 90 dias";
    if (n === 365) return "Último ano";
    return `Últimos ${n} dias`;
  }, [periodo]);

  // Data de início do período (relativa ao maxChamadosDate)
  const periodoInicio = useMemo(() => {
    if (!dataLimitePeriodo) return null;
    return dataLimitePeriodo;
  }, [dataLimitePeriodo]);


  // KPIs calculation
  const kpis = useMemo(() => {
    // BASE TOTAL: todos os clientes (sem filtro de período) — para MRR, LTV, ticket médio
    const clientesMapBase = new Map<number, Evento>();
    filteredEventos.forEach(e => {
      if (!clientesMapBase.has(e.cliente_id) || 
          new Date(e.event_datetime) > new Date(clientesMapBase.get(e.cliente_id)!.event_datetime)) {
        clientesMapBase.set(e.cliente_id, e);
      }
    });
    const clientesUnicos = Array.from(clientesMapBase.values());
    const totalClientes = clientesUnicos.length;

    // Clientes ativos (base total)
    const clientesAtivos = clientesUnicos.filter(e => 
      e.status_contrato !== "C" && e.servico_status !== "C"
    ).length;

    // MRR Total (base total — não muda com período)
    const mrrTotal = clientesUnicos
      .filter(e => e.status_contrato !== "C" && e.servico_status !== "C")
      .reduce((acc, e) => acc + (e.valor_mensalidade || 0), 0);

    // Ticket Médio
    const ticketMedio = clientesAtivos > 0 ? mrrTotal / clientesAtivos : 0;

    // Churn (base total)
    const churned = filteredEventos.filter(e => 
      e.event_type === "CANCELAMENTO" || e.servico_status === "C" || e.status_contrato === "C"
    );
    const churnCount = new Set(churned.map(e => e.cliente_id)).size;

    // Faturamento realizado (base total)
    const faturamentoRealizado = clientesUnicos
      .filter(e => e.cobranca_status === "Pago" || (e.valor_pago && e.valor_pago > 0))
      .reduce((acc, e) => acc + (e.valor_pago || e.valor_cobranca || 0), 0);

    // Novos clientes (instalados no período — relativo a snapshotDate, não hoje)
    const novosClientes = dataLimitePeriodo ? clientesUnicos.filter(e => {
      const dataInstalacao = e.data_instalacao ? new Date(e.data_instalacao) : null;
      return dataInstalacao && !isNaN(dataInstalacao.getTime()) && dataInstalacao >= dataLimitePeriodo;
    }).length : clientesUnicos.length;

    // INADIMPLÊNCIA: usa TODOS os clientes únicos (snapshot captura próxima fatura - data futura)
    // dias_atraso > 0 é o único campo confiável para identificar inadimplência real
    const clientesVencidos = clientesUnicos.filter(e => isClienteVencido(e));
    const rrVencido = clientesVencidos.reduce((acc, e) => acc + (e.valor_cobranca || e.valor_mensalidade || 0), 0);
    const clientesVencidosUnicos = clientesVencidos.length;

    // % Inadimplência = vencidos / total de clientes
    const pctInadimplencia = totalClientes > 0 
      ? ((clientesVencidosUnicos / totalClientes) * 100).toFixed(1)
      : "0.0";

    // % Inadimplência Crítica (vencido > 30 dias)
    const inadCritica = clientesVencidos.filter(e => e.dias_atraso && e.dias_atraso > 30);
    const pctInadCritica = totalClientes > 0 
      ? (inadCritica.length / totalClientes * 100).toFixed(1)
      : "0.0";

    // MRR em Risco — usa base total (não varia com período por ser snapshot)
    const clientesEmRisco = clientesUnicos.filter(e => 
      (e.churn_risk_score && e.churn_risk_score >= 50) ||
      e.alerta_tipo ||
      (e.downtime_min_24h && e.downtime_min_24h > 60)
    );
    const mrrEmRisco = clientesEmRisco.reduce((acc, e) => acc + (e.valor_mensalidade || 0), 0);
    const ltvEmRisco = clientesEmRisco.reduce((acc, e) => acc + (e.ltv_reais_estimado || (e.valor_mensalidade || 0) * 12), 0);

    // % Detratores (NPS < 7) — base total
    const npsScores = filteredEventos.filter(e => e.nps_score !== undefined && e.nps_score !== null);
    const detratores = npsScores.filter(e => e.nps_score! < 7).length;
    const pctDetratores = npsScores.length > 0 
      ? ((detratores / npsScores.length) * 100).toFixed(1)
      : "N/A";

    // LTV Médio GLOBAL — usar TODOS os eventos
    const allClientesMap = new Map<number, Evento>();
    eventos.forEach(e => {
      if (!allClientesMap.has(e.cliente_id) || 
          new Date(e.event_datetime) > new Date(allClientesMap.get(e.cliente_id)!.event_datetime)) {
        allClientesMap.set(e.cliente_id, e);
      }
    });
    const allClientesUnicos = Array.from(allClientesMap.values());
    const hojeCalcLtv = new Date();
    const ltvMesesCalculados = allClientesUnicos
      .filter(e => e.data_instalacao && e.data_instalacao.length >= 10)
      .map(e => {
        const dataInstalacao = new Date(e.data_instalacao);
        if (isNaN(dataInstalacao.getTime())) return null;
        const diffMs = hojeCalcLtv.getTime() - dataInstalacao.getTime();
        const meses = diffMs / (1000 * 60 * 60 * 24 * 30.44);
        return meses > 0 ? meses : 0;
      })
      .filter((m): m is number => m !== null && m > 0);
    const ltvMesesCalculado = ltvMesesCalculados.length > 0 
      ? ltvMesesCalculados.reduce((a, b) => a + b, 0) / ltvMesesCalculados.length 
      : 0;
    const ltvMeses = ltvMesesCalculado > 0 ? Math.round(ltvMesesCalculado) : 0;
    const ticketMedioGlobal = allClientesUnicos.length > 0 
      ? allClientesUnicos.reduce((acc, e) => acc + (e.valor_mensalidade || 0), 0) / allClientesUnicos.length 
      : 0;
    const ltvMedio = ltvMeses * ticketMedioGlobal;

    return {
      clientesAtivos,
      totalClientes,
      totalClientesPeriodo: totalClientes,
      novosClientes,
      churnCount,
      mrrTotal,
      faturamentoRealizado,
      mrrEmRisco,
      ltvEmRisco,
      rrVencido,
      pctInadimplencia,
      pctInadCritica,
      pctDetratores,
      ltvMedio,
      ltvMeses,
      ticketMedio,
    };
  }, [filteredEventos, dataLimitePeriodo, eventos]);

  // Chamados por cliente - memoizado para performance
  const chamadosStats = useMemo(() => {
    const diasPeriodo = periodo === "todos" ? undefined : parseInt(periodo);
    const chamadosPorCliente = getChamadosPorCliente(diasPeriodo);
    
    // Total de chamados no período
    let totalChamados = 0;
    let totalReincidentes = 0;
    const clientesComChamados = new Set<number>();
    
    chamadosPorCliente.forEach((dados, clienteId) => {
      totalChamados += dados.chamados_periodo;
      if (dados.reincidente) {
        totalReincidentes++;
      }
      if (dados.chamados_periodo > 0) {
        clientesComChamados.add(clienteId);
      }
    });

    console.log("🔍 DEBUG CHAMADOS:", {
      totalChamadosRaw: chamados.length,
      totalChamadosPeriodo: totalChamados,
      totalReincidentes,
      clientesComChamados: clientesComChamados.size,
      diasPeriodo,
      amostra: Array.from(chamadosPorCliente.entries()).slice(0, 3),
    });

    return {
      totalChamados,
      totalReincidentes,
      clientesComChamados: clientesComChamados.size,
      chamadosPorCliente,
    };
  }, [chamados, getChamadosPorCliente, periodo]);

  // Mapa de cliente_id cancelado vindo de churn_status (fonte de verdade para cancelamentos)
  const canceladosChurnMap = useMemo(() => {
    const map = new Set<number>();
    churnStatus.forEach(cs => {
      if (cs.status_churn === "cancelado") {
        map.add(cs.cliente_id);
      }
    });
    return map;
  }, [churnStatus]);

  // Criar mapa de cliente -> plano/cidade/bairro para usar em chamados
  const clientePlanoMap = useMemo(() => {
    const map = new Map<number, { plano: string; cidade: string | null; bairro: string | null }>();
    eventos.forEach(e => {
      if (!map.has(e.cliente_id)) {
        map.set(e.cliente_id, {
          plano: e.plano_nome || "Sem plano",
          cidade: getCidadeNome(e.cliente_cidade),
          bairro: e.cliente_bairro || null,
        });
      }
    });
    // Complementar com dados do churn_status (para clientes que cancelaram e não têm evento recente)
    churnStatus.forEach(cs => {
      if (!map.has(cs.cliente_id)) {
        map.set(cs.cliente_id, {
          plano: cs.plano_nome || "Sem plano",
          cidade: getCidadeNome(cs.cliente_cidade),
          bairro: cs.cliente_bairro || null,
        });
      }
    });
    return map;
  }, [eventos, churnStatus]);

  // Mapas de lookup por celular e CPF dos eventos (para match alternativo com nps_check)
  const eventoLookupMaps = useMemo(() => {
    const byCelular = new Map<string, number>(); // celular normalizado → cliente_id
    const byCpf = new Map<string, number>(); // cpf/cnpj normalizado → cliente_id
    const normalizePhone = (val: any): string | undefined => {
      if (!val) return undefined;
      const digits = String(val).replace(/\D/g, "");
      return digits.length >= 8 ? digits.slice(-11) : undefined;
    };
    eventos.forEach(e => {
      if (e.cliente_celular) {
        const norm = normalizePhone(e.cliente_celular);
        if (norm && !byCelular.has(norm)) byCelular.set(norm, e.cliente_id);
      }
    });
    console.log("📱 Lookup por celular construído:", byCelular.size, "entradas");
    return { byCelular, byCpf };
  }, [eventos]);

  // Data máxima de resposta NPS (referência para filtro de período do NPS)
  const maxNpsDate = useMemo(() => {
    let maxDate = new Date(0);
    npsData.forEach(r => {
      if (!r.data_resposta) return;
      const d = new Date(r.data_resposta.replace(" ", "T"));
      if (!isNaN(d.getTime()) && d > maxDate) maxDate = d;
    });
    return maxDate.getTime() > 0 ? maxDate : new Date();
  }, [npsData]);

  // Data limite para NPS: relativa à resposta mais recente
  const dataLimiteNPS = useMemo(() => {
    if (periodo === "todos") return null;
    return new Date(maxNpsDate.getTime() - parseInt(periodo) * 24 * 60 * 60 * 1000);
  }, [periodo, maxNpsDate]);

  // NPS filtrado por período e filtros geográficos/plano
  const npsDataFiltrado = useMemo(() => {
    return npsData.filter(r => {
      // Filtro de período por data_resposta
      if (dataLimiteNPS && r.data_resposta) {
        const d = new Date(r.data_resposta.replace(" ", "T"));
        if (!isNaN(d.getTime()) && d < dataLimiteNPS) return false;
      }
      return true;
    });
  }, [npsData, dataLimiteNPS]);

  // Mapa de cliente_id → dados NPS reais (match por cliente_id, celular ou CPF)
  // Filtrado por período (data_resposta) e respeitando filtros geográficos via clientePlanoMap
  const npsDataPorCliente = useMemo(() => {
    const map = new Map<number, { npsTotal: number; npsCount: number; detratores: number; neutros: number; promotores: number }>();
    
    let matchedById = 0, matchedByCelular = 0, unmatched = 0;

    const addToMap = (clienteId: number, r: typeof npsData[0]) => {
      // Filtro geográfico: só incluir se o cliente está no mapa filtrado (geo/plano)
      const infoCliente = clientePlanoMap.get(clienteId);
      if (!infoCliente && clienteId > 0) {
        // Cliente não encontrado nos eventos filtrados — verificar se filtros geo estão ativos
        const geoFiltroAtivo = cidade !== "todos" || bairro !== "todos" || plano !== "todos" || uf !== "todos";
        if (geoFiltroAtivo) return; // Excluir se filtro geo está ativo e cliente não tem dados
      }

      const existing = map.get(clienteId);
      if (existing) {
        existing.npsTotal += r.nota;
        existing.npsCount++;
        if (r.classificacao === "Detrator") existing.detratores++;
        else if (r.classificacao === "Neutro") existing.neutros++;
        else if (r.classificacao === "Promotor") existing.promotores++;
      } else {
        map.set(clienteId, {
          npsTotal: r.nota,
          npsCount: 1,
          detratores: r.classificacao === "Detrator" ? 1 : 0,
          neutros: r.classificacao === "Neutro" ? 1 : 0,
          promotores: r.classificacao === "Promotor" ? 1 : 0,
        });
      }
    };

    npsDataFiltrado.forEach(r => {
      // 1. Tentar match direto por cliente_id (se > 0 e existe nos eventos)
      if (r.cliente_id > 0 && clientePlanoMap.has(r.cliente_id)) {
        addToMap(r.cliente_id, r);
        matchedById++;
        return;
      }

      // 2. Tentar match por celular
      if (r.celular && eventoLookupMaps.byCelular.has(r.celular)) {
        const clienteId = eventoLookupMaps.byCelular.get(r.celular)!;
        addToMap(clienteId, r);
        matchedByCelular++;
        return;
      }

      // 3. Sem match — registrar com cliente_id original (pode não aparecer no cohort)
      if (r.cliente_id > 0) {
        addToMap(r.cliente_id, r);
      }
      unmatched++;
    });

    console.log("🔗 NPS match:", { matchedById, matchedByCelular, unmatched, totalNPS: npsDataFiltrado.length, totalMapped: map.size });
    return map;
  }, [npsDataFiltrado, eventoLookupMaps, clientePlanoMap, cidade, bairro, plano, uf]);

  // Data máxima de cancelamento (referência para filtro de período de churn)
  const maxCancelamentoDate = useMemo(() => {
    let maxDate = new Date(0);
    churnStatus.forEach(cs => {
      if (cs.status_churn === "cancelado" && cs.data_cancelamento) {
        const d = new Date(cs.data_cancelamento);
        if (!isNaN(d.getTime()) && d > maxDate) maxDate = d;
      }
    });
    return maxDate.getTime() > 0 ? maxDate : new Date();
  }, [churnStatus]);

  // Data limite para churn: relativa ao cancelamento mais recente no banco
  const dataLimiteChurn = useMemo(() => {
    if (periodo === "todos") return null;
    return new Date(maxCancelamentoDate.getTime() - parseInt(periodo) * 24 * 60 * 60 * 1000);
  }, [periodo, maxCancelamentoDate]);

  // Cohort direto de cancelamentos via churn_status
  const churnCohortDirect = useMemo(() => {
    const stats: Record<string, { cancelados: number; label: string }> = {};

    const getKey = (cs: typeof churnStatus[0]): string | null => {
      switch (cohortDimension) {
        case "plano": return cs.plano_nome || "Sem plano";
        case "cidade": return getCidadeNome(cs.cliente_cidade) || "Desconhecida";
        case "bairro": return cs.cliente_bairro || "Desconhecido";
        default: return null;
      }
    };

    churnStatus.forEach(cs => {
      if (cs.status_churn !== "cancelado") return;

      if (dataLimiteChurn && cs.data_cancelamento) {
        const dataCancelamento = new Date(cs.data_cancelamento);
        if (!isNaN(dataCancelamento.getTime()) && dataCancelamento < dataLimiteChurn) return;
      }

      if (cidade !== "todos" && String(cs.cliente_cidade) !== cidade && getCidadeNome(cs.cliente_cidade) !== cidade) return;
      if (bairro !== "todos" && cs.cliente_bairro !== bairro) return;
      if (plano !== "todos" && cs.plano_nome !== plano) return;

      const key = getKey(cs);
      if (!key) return;
      const label = cohortDimension === "plano" && key.length > 45 ? key.substring(0, 45) + "..." : key;
      if (!stats[key]) stats[key] = { cancelados: 0, label };
      stats[key].cancelados++;
    });

    return stats;
  }, [churnStatus, cohortDimension, dataLimiteChurn, cidade, bairro, plano]);

  // Generic function to calculate cohort data for any dimension
  // eventosBase: todos os eventos filtrados (para MRR, LTV, churn, etc.)
  // eventosPeriodo: eventos filtrados pelo período (para inadimplência financeira)
  // dataLimiteChurnParam: data limite para filtrar cancelamentos no cohort geral
  const calculateCohortData = (
    dimension: "plano" | "cidade" | "bairro",
    eventosBase: Evento[],
    eventosPeriodo: Evento[],
    dataLimiteChurnParam: Date | null = null
  ) => {
    const stats: Record<string, { 
      key: string; 
      label: string;
      total: number; 
      risco: number;
      cancelados: number;
      ativos: number;
      bloqueados: number;
      clientesVencidos: number;
      valorVencido: number;
      chamados: number;
      reincidentes: number;
      comDowntime: number;
      comAlerta: number;
      npsTotal: number;
      npsCount: number;
      detratores: number;
      neutros: number;
      promotores: number;
      ltvTotal: number;
      mrrTotal: number;
      mesesTotal: number;
      mesesCount: number;
      topClientes: { nome: string; dataInstalacao: string; meses: number; mensalidade: number; ltv: number }[];
    }> = {};

    const clientesPorKey = new Map<string, Set<number>>();
    const clienteContado = new Map<string, Set<number>>();
    
    const getKey = (e: Evento): string | null => {
      switch (dimension) {
        case "plano": return e.plano_nome || null;
        case "cidade": return getCidadeNome(e.cliente_cidade);
        case "bairro": return e.cliente_bairro || null;
        default: return null;
      }
    };

    const getLabel = (key: string, dimension: string): string => {
      if (dimension === "plano") {
        return key.length > 45 ? key.substring(0, 45) + "..." : key;
      }
      return key;
    };
    
    // Primeiro passo: processar base total para MRR, LTV, churn, NPS, etc.
    eventosBase.forEach(e => {
      const key = getKey(e);
      if (!key) return;
      
      if (!clientesPorKey.has(key)) {
        clientesPorKey.set(key, new Set());
      }
      clientesPorKey.get(key)!.add(e.cliente_id);
      
      if (!stats[key]) {
        stats[key] = { 
          key, 
          label: getLabel(key, dimension),
          total: 0, risco: 0, cancelados: 0, ativos: 0, bloqueados: 0,
          clientesVencidos: 0, valorVencido: 0, chamados: 0, reincidentes: 0,
          comDowntime: 0, comAlerta: 0, npsTotal: 0, npsCount: 0, detratores: 0, neutros: 0, promotores: 0,
          ltvTotal: 0, mrrTotal: 0, mesesTotal: 0, mesesCount: 0, topClientes: []
        };
        clienteContado.set(key, new Set());
      }

      const contados = clienteContado.get(key)!;
      
      // Contar cliente uma vez por dimensão
      if (!contados.has(e.cliente_id)) {
        contados.add(e.cliente_id);
        
        // MRR e LTV
        stats[key].mrrTotal += e.valor_mensalidade || 0;
        stats[key].ltvTotal += e.ltv_reais_estimado || (e.valor_mensalidade || 0) * 24;
        
        // Meses como cliente (para justificar LTV)
        if (e.data_instalacao && e.data_instalacao.length >= 10) {
          const dataInst = new Date(e.data_instalacao);
          if (!isNaN(dataInst.getTime())) {
            const meses = (new Date().getTime() - dataInst.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
            if (meses > 0) {
              stats[key].mesesTotal += meses;
              stats[key].mesesCount++;
              const clienteLtv = meses * (e.valor_mensalidade || 0);
              const clienteInfo = {
                nome: e.cliente_nome || `Cliente ${e.cliente_id}`,
                dataInstalacao: dataInst.toLocaleDateString("pt-BR"),
                meses: Math.round(meses),
                mensalidade: e.valor_mensalidade || 0,
                ltv: clienteLtv,
              };
              stats[key].topClientes.push(clienteInfo);
              if (stats[key].topClientes.length > 3) {
                stats[key].topClientes.sort((a, b) => b.ltv - a.ltv);
                stats[key].topClientes = stats[key].topClientes.slice(0, 3);
              }
            }
          }
        }
        
        // Contratos: bloqueados identificados pelos status reais do IXC
        if (e.servico_status === "B" || e.status_contrato === "B" || e.servico_status === "CA" || e.servico_status === "CM") {
          stats[key].bloqueados++;
        } else if (e.servico_status === "D" || e.status_contrato === "D") {
          // Desativados sem confirmação churn_status: conta como cancelado só se churn_status não disponível
          if (!canceladosChurnMap.has(e.cliente_id)) {
            stats[key].cancelados++;
          }
        } else {
          stats[key].ativos++;
        }
        
        // Risco
        if (e.alerta_tipo || (e.downtime_min_24h && e.downtime_min_24h > 60) || (e.churn_risk_score && e.churn_risk_score >= 50)) {
          stats[key].risco++;
        }
        
        // Rede
        if (e.downtime_min_24h && e.downtime_min_24h > 60) stats[key].comDowntime++;
        if (e.alerta_tipo) stats[key].comAlerta++;
        
        // NPS — será preenchido pelo passo de integração com nps_check abaixo
      }
    });

    // Segundo passo: contar CLIENTES VENCIDOS NO PERÍODO (usa eventosPeriodo)
    const clientesVencidosContados = new Map<string, Set<number>>();
    eventosPeriodo.forEach(e => {
      const key = getKey(e);
      if (!key || !stats[key]) return;
      if (!isClienteVencido(e)) return;
      if (!clientesVencidosContados.has(key)) clientesVencidosContados.set(key, new Set());
      const set = clientesVencidosContados.get(key)!;
      if (!set.has(e.cliente_id)) {
        set.add(e.cliente_id);
        stats[key].clientesVencidos++;
        stats[key].valorVencido += e.valor_cobranca || 0;
      }
    });

    // Terceiro passo: integrar cancelados reais da tabela churn_status
    if (canceladosChurnMap.size > 0) {
      const canceladosContados = new Map<string, Set<number>>();
      churnStatus.forEach(cs => {
        if (cs.status_churn !== "cancelado") return;

        // Aplicar filtro de período para cancelamentos no cohort geral
        if (dataLimiteChurnParam && cs.data_cancelamento) {
          const dataCancelamento = new Date(cs.data_cancelamento);
          if (!isNaN(dataCancelamento.getTime()) && dataCancelamento < dataLimiteChurnParam) return;
        }

        const infoCliente = clientePlanoMap.get(cs.cliente_id);

        let key: string | null = null;
        switch (dimension) {
          case "plano": key = (infoCliente?.plano) || cs.plano_nome || null; break;
          case "cidade": key = (infoCliente?.cidade) || getCidadeNome(cs.cliente_cidade); break;
          case "bairro": key = (infoCliente?.bairro) || cs.cliente_bairro || null; break;
        }
        if (!key) return;

        if (!stats[key]) {
          stats[key] = { 
            key, label: getLabel(key, dimension),
            total: 0, risco: 0, cancelados: 0, ativos: 0, bloqueados: 0,
            clientesVencidos: 0, valorVencido: 0, chamados: 0, reincidentes: 0,
            comDowntime: 0, comAlerta: 0, npsTotal: 0, npsCount: 0, detratores: 0, neutros: 0, promotores: 0,
            ltvTotal: 0, mrrTotal: 0, mesesTotal: 0, mesesCount: 0, topClientes: []
          };
          clientesPorKey.set(key, new Set());
        }

        if (!canceladosContados.has(key)) canceladosContados.set(key, new Set());
        const set = canceladosContados.get(key)!;
        if (!set.has(cs.cliente_id)) {
          set.add(cs.cliente_id);
          stats[key].cancelados++;
          if (!clientesPorKey.get(key)?.has(cs.cliente_id)) {
            clientesPorKey.get(key)!.add(cs.cliente_id);
            stats[key].mrrTotal += cs.valor_mensalidade || 0;
          }
        }
      });
    }

    // Add total count
    clientesPorKey.forEach((clientes, key) => {
      if (stats[key]) stats[key].total = clientes.size;
    });

    // Integrar dados de chamados
    chamadosStats.chamadosPorCliente.forEach((dadosChamado, clienteId) => {
      const infoCliente = clientePlanoMap.get(clienteId);
      if (!infoCliente) return;
      
      let key: string | null = null;
      switch (dimension) {
        case "plano": key = infoCliente.plano; break;
        case "cidade": key = infoCliente.cidade; break;
        case "bairro": key = infoCliente.bairro; break;
      }
      
      if (key && stats[key]) {
        stats[key].chamados += dadosChamado.chamados_periodo;
        if (dadosChamado.reincidente) {
          stats[key].reincidentes++;
        }
      }
    });

    // Integrar dados NPS reais da tabela nps_check (cruzado com eventos por cliente_id)
    npsDataPorCliente.forEach((npsStats, clienteId) => {
      const infoCliente = clientePlanoMap.get(clienteId);
      if (!infoCliente) return;

      let key: string | null = null;
      switch (dimension) {
        case "plano": key = infoCliente.plano; break;
        case "cidade": key = infoCliente.cidade; break;
        case "bairro": key = infoCliente.bairro; break;
      }

      if (key && stats[key]) {
        stats[key].npsTotal += npsStats.npsTotal;
        stats[key].npsCount += npsStats.npsCount;
        stats[key].detratores += npsStats.detratores;
        stats[key].neutros += npsStats.neutros;
        stats[key].promotores += npsStats.promotores;
      }
    });

    // Calculate all percentages
    return Object.values(stats)
      .map(p => ({
        ...p,
        plano: p.key,
        churnPct: p.total > 0 ? (p.cancelados / p.total * 100) : 0,
        contratosPct: p.total > 0 ? (p.bloqueados / p.total * 100) : 0,
        financeiroPct: p.total > 0 ? (p.clientesVencidos / p.total * 100) : 0,
        suportePct: p.total > 0 ? (p.chamados / p.total * 100) : 0,
        redePct: p.total > 0 ? ((p.comDowntime + p.comAlerta) / p.total * 100) : 0,
        npsPct: p.npsCount > 0 ? (p.detratores / p.npsCount * 100) : 0,
        npsMedia: p.npsCount > 0 ? (p.npsTotal / p.npsCount) : 0,
        ltvMedio: p.total > 0 ? (p.ltvTotal / p.total) : 0,
        mesesMedio: p.mesesCount > 0 ? (p.mesesTotal / p.mesesCount) : 0,
        ticketMedio: p.total > 0 ? (p.mrrTotal / p.total) : 0,
      }));
  };

  // Cohort data based on selected dimension
  const cohortData = useMemo(() => {
    return calculateCohortData(cohortDimension, filteredEventos, filteredEventosPeriodo, dataLimiteChurn);
  }, [filteredEventos, filteredEventosPeriodo, cohortDimension, chamadosStats, clientePlanoMap, npsDataPorCliente, canceladosChurnMap, churnStatus, dataLimiteChurn]);

  // Para o tab Churn: usar churnCohortDirect como fonte principal (todos os cancelados reais),
  // enriquecido com total de clientes do cohortData para calcular churnPct corretamente
  const churnSortedData = useMemo(() => {
    // Total de clientes por chave (de eventos + churnStatus) para calcular denominador
    const totalPorChave: Record<string, number> = {};
    cohortData.forEach(item => {
      totalPorChave[item.key] = item.total;
    });
    // Total de cancelados direto da churn_status
    const totalCanceladosGeral = Object.values(churnCohortDirect).reduce((s, d) => s + d.cancelados, 0);

    return Object.entries(churnCohortDirect)
      .map(([key, d]) => {
        const totalClientes = totalPorChave[key] || d.cancelados; // se só há cancelados, total = cancelados
        const churnPct = totalClientes > 0 ? (d.cancelados / totalClientes) * 100 : 100;
        return {
          key,
          label: d.label,
          cancelados: d.cancelados,
          total: totalClientes,
          churnPct,
          // campos dummy para compatibilidade
          ativos: 0, bloqueados: 0, clientesVencidos: 0, valorVencido: 0,
          chamados: 0, reincidentes: 0, comDowntime: 0, comAlerta: 0,
          npsTotal: 0, npsCount: 0, detratores: 0, neutros: 0, promotores: 0,
          ltvTotal: 0, mrrTotal: 0, mesesTotal: 0, mesesCount: 0, topClientes: [],
          contratosPct: 0, financeiroPct: 0, suportePct: 0, redePct: 0, npsPct: 0,
          npsMedia: 0, ltvMedio: 0, mesesMedio: 0, ticketMedio: 0,
        };
      })
      .filter(item => item.cancelados > 0)
      .sort((a, b) => b.cancelados - a.cancelados)
      .slice(0, 15);
  }, [churnCohortDirect, cohortData]);

  // Sorted cohort data based on selected tab - FILTRAR planos com mínimo de clientes
  const sortedCohortData = useMemo(() => {
    // Para Churn: usar cálculo direto de churn_status (muito mais completo)
    if (cohortTab === "churn") return churnSortedData;

    const sortKey = {
      contratos: "contratosPct", 
      financeiro: "financeiroPct",
      suporte: "chamados",
      rede: "redePct",
      nps: "npsCount",
      ltv: "ltvMedio",
    }[cohortTab] || "financeiroPct";

    // Para NPS: filtrar grupos com ao menos 1 resposta NPS
    // Para outros: filtrar grupos com mínimo de 3 clientes
    const filtered = cohortTab === "nps"
      ? cohortData.filter(item => item.npsCount > 0)
      : cohortData.filter(item => item.total >= 3);

    return [...filtered]
      .sort((a, b) => (b as any)[sortKey] - (a as any)[sortKey])
      .slice(0, 12);
  }, [cohortData, cohortTab, churnSortedData]);

  // Metric info for current tab
  const cohortMetricInfo = useMemo(() => {
    const dimensionLabel = cohortDimension === "plano" ? "Plano" : cohortDimension === "cidade" ? "Cidade" : "Bairro";
    const info: Record<string, { dataKey: string; label: string; format: (v: number) => string }> = {
      churn: { dataKey: "cancelados", label: `Cancelamentos por ${dimensionLabel}`, format: (v) => `${v} cancelados` },
      contratos: { dataKey: "contratosPct", label: `% Bloqueados por ${dimensionLabel}`, format: (v) => `${v.toFixed(1)}%` },
      financeiro: { dataKey: "financeiroPct", label: `% Inadimplência por ${dimensionLabel}`, format: (v) => `${v.toFixed(1)}%` },
      suporte: { dataKey: "chamados", label: `Total Chamados por ${dimensionLabel}`, format: (v) => `${v}` },
      rede: { dataKey: "redePct", label: `% Rede por ${dimensionLabel}`, format: (v) => `${v.toFixed(1)}%` },
      nps: { dataKey: "npsPct", label: `% Detratores por ${dimensionLabel}`, format: (v) => `${v.toFixed(1)}%` },
      ltv: { dataKey: "ltvMedio", label: `LTV Médio por ${dimensionLabel}`, format: (v) => `R$ ${(v/1000).toFixed(1)}k` },
    };
    return info[cohortTab] || info.financeiro;
  }, [cohortTab, cohortDimension]);

  // Driver Principal - calcular qual é o maior problema
  const driverPrincipal = useMemo(() => {
    const vencidos = filteredEventos.filter(e => isClienteVencido(e));
    const comAlerta = filteredEventos.filter(e => e.alerta_tipo);
    const comDowntime = filteredEventos.filter(e => e.downtime_min_24h && e.downtime_min_24h > 60);
    
    const clientesUnicos = new Set(filteredEventos.map(e => e.cliente_id)).size;
    const clientesVencidos = new Set(vencidos.map(e => e.cliente_id)).size;
    const clientesAlerta = new Set(comAlerta.map(e => e.cliente_id)).size;
    const clientesDowntime = new Set(comDowntime.map(e => e.cliente_id)).size;

    const pctVencido = clientesUnicos > 0 ? (clientesVencidos / clientesUnicos * 100) : 0;
    const pctAlerta = clientesUnicos > 0 ? (clientesAlerta / clientesUnicos * 100) : 0;
    const pctDowntime = clientesUnicos > 0 ? (clientesDowntime / clientesUnicos * 100) : 0;

    if (pctVencido >= pctAlerta && pctVencido >= pctDowntime) {
      return { tipo: "Financeiro", pct: pctVencido.toFixed(0), desc: "clientes em atraso" };
    } else if (pctAlerta >= pctDowntime) {
      return { tipo: "Alerta Técnico", pct: pctAlerta.toFixed(0), desc: "clientes com alertas" };
    } else {
      return { tipo: "Rede/Downtime", pct: pctDowntime.toFixed(0), desc: "clientes com downtime" };
    }
  }, [filteredEventos]);

  // Top 5 Data - calculado com sua própria dimensão independente
  const top5Data = useMemo(() => {
    return calculateCohortData(top5Dimension, filteredEventos, filteredEventosPeriodo, dataLimiteChurn);
  }, [filteredEventos, filteredEventosPeriodo, top5Dimension, chamadosStats, clientePlanoMap, npsDataPorCliente, canceladosChurnMap, churnStatus, dataLimiteChurn]);

  // Top 5 por métrica selecionada - mostra TAXA REAL (não distribuição)
  const top5Risco = useMemo(() => {
    const countKey = top5Filter === "churn" ? "cancelados" : "clientesVencidos";
    
    // Filtrar itens com pelo menos 3 clientes
    const minClientes = 3;
    const filtered = top5Data.filter(item => item.total >= minClientes);
    
    // Calcular taxa real (count/total) e ordenar pela taxa
    const withRate = filtered.map(p => ({
      key: p.key,
      label: p.label,
      count: (p as any)[countKey] || 0,
      total: p.total,
      rate: p.total > 0 ? ((p as any)[countKey] || 0) / p.total * 100 : 0,
    }));
    
    // Ordenar por taxa (maior primeiro), depois por count absoluto — EXCLUIR rate = 0
    const top5Sorted = [...withRate]
      .filter(item => item.rate > 0) // ← remove cidades/planos sem nenhum vencido/cancelado
      .sort((a, b) => b.rate - a.rate || b.count - a.count)
      .slice(0, 5);
    
    return top5Sorted;
  }, [top5Data, top5Filter]);

  // Fila de Risco - FIXED: use available fields (alerta_tipo, downtime, etc.)
  const filaRisco = useMemo(() => {
    const clientesMap = new Map<number, Evento>();
    filteredEventos
      .filter(e => 
        e.alerta_tipo || // Tem alerta
        (e.downtime_min_24h && e.downtime_min_24h > 60) || // Downtime alto
        (e.churn_risk_score && e.churn_risk_score >= 60) || // Score alto
        (e.dias_atraso && e.dias_atraso > 30) // Muito atrasado
      )
      .forEach(e => {
        if (!clientesMap.has(e.cliente_id)) {
          clientesMap.set(e.cliente_id, e);
        }
      });

    return Array.from(clientesMap.values())
      .map(e => ({
        id: e.cliente_id,
        nome: e.cliente_nome || `Cliente ${e.cliente_id}`,
        plano: e.plano_nome || "-",
        local: e.cliente_bairro 
          ? `${e.cliente_bairro}, ${e.cliente_cidade || ""}` 
          : e.cliente_cidade || "-",
        score: e.churn_risk_score || (e.downtime_min_24h ? Math.min(100, 50 + e.downtime_min_24h / 2) : 70),
        driver: e.alerta_tipo || (e.dias_atraso && e.dias_atraso > 0 ? "Atraso financeiro" : "Risco técnico"),
        celular: e.cliente_celular,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [filteredEventos]);

  // Cobrança Inteligente — usa eventos do PERÍODO para refletir vencidos na janela selecionada
  const cobrancaInteligente = useMemo(() => {
    const source = filteredEventosPeriodo.length > 0 ? filteredEventosPeriodo : filteredEventos;
    const clientesVencidosMap = new Map<number, Evento>();
    source
      .filter(e => isClienteVencido(e))
      .forEach(e => {
        if (!clientesVencidosMap.has(e.cliente_id) || (e.dias_atraso || 0) > (clientesVencidosMap.get(e.cliente_id)?.dias_atraso || 0)) {
          clientesVencidosMap.set(e.cliente_id, e);
        }
      });
    return Array.from(clientesVencidosMap.values())
      .map(e => ({
        id: e.cliente_id,
        nome: e.cliente_nome || `Cliente ${e.cliente_id}`,
        status: e.cobranca_status || "Vencido",
        vencimento: e.data_vencimento || "-",
        valor: e.valor_cobranca || 0,
        atraso: e.dias_atraso || 0,
      }))
      .sort((a, b) => b.atraso - a.atraso)
      .slice(0, 8);
  }, [filteredEventos, filteredEventosPeriodo]);

  // Mapeamento de bairros para coordenadas aproximadas (região de Blumenau/Gaspar/Ilhota/Itajaí)
  const bairroCoords: Record<string, { lat: number; lng: number }> = {
    // Gaspar
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
    // Ilhota
    "Ilhotinha": { lat: -26.9050, lng: -48.8300 },
    "Ilhota Centro": { lat: -26.9000, lng: -48.8250 },
    // Blumenau - alguns bairros
    "Velha": { lat: -26.9200, lng: -49.0800 },
    "Garcia": { lat: -26.9100, lng: -49.0600 },
    "Itoupava Norte": { lat: -26.8700, lng: -49.0500 },
    // Itajaí - alguns bairros
    "São João": { lat: -26.9100, lng: -48.6700 },
    "Fazenda": { lat: -26.9200, lng: -48.6600 },
  };

  // Map data - usa TODOS os eventos sem filtro de período para mostrar todos os clientes no mapa
  // Aplica apenas filtros de UF/cidade/bairro/plano/filial
  const mapEventos = useMemo(() => {
    let filtered = [...eventos] as Evento[];
    if (uf !== "todos") filtered = filtered.filter((e) => e.cliente_uf === uf);
    if (cidade !== "todos") filtered = filtered.filter((e) => e.cliente_cidade === cidade);
    if (bairro !== "todos") filtered = filtered.filter((e) => e.cliente_bairro === bairro);
    if (plano !== "todos") filtered = filtered.filter((e) => e.plano_nome === plano);
    if (filial !== "todos") filtered = filtered.filter((e) => String(e.filial_id) === filial);
    return filtered;
  }, [eventos, uf, cidade, bairro, plano, filial]);

  const mapData = useMemo(() => {
    const clientesMap = new Map<number, any>();
    
    // Chamados sem filtro de período para mostrar todos
    const chamadosPorCliente = getChamadosPorCliente(undefined);
    
    mapEventos.forEach(e => {
      // Determinar coordenadas: usar geo_lat/geo_lng se existir, senão usar bairro
      let lat = e.geo_lat;
      let lng = e.geo_lng;
      
      // Se não tem coordenadas exatas, tentar usar o bairro
      if ((!lat || !lng || lat === 0 || lng === 0) && e.cliente_bairro) {
        const bairroKey = e.cliente_bairro;
        const coords = bairroCoords[bairroKey];
        if (coords) {
          // Adicionar pequena variação para não empilhar pontos
          lat = coords.lat + (Math.random() - 0.5) * 0.01;
          lng = coords.lng + (Math.random() - 0.5) * 0.01;
        }
      }
      
      // Só incluir se tiver coordenadas válidas
      if (!lat || !lng || isNaN(lat) || isNaN(lng)) return;
      
      // Obter quantidade de chamados do cliente
      const chamadosCliente = chamadosPorCliente.get(e.cliente_id);
      const qtdChamados = chamadosCliente?.total_chamados || 0;
      
      const existing = clientesMap.get(e.cliente_id);
      // Keep the record with more risk data, or add if not exists
      if (!existing || (e.dias_atraso && e.dias_atraso > (existing.dias_atraso || 0))) {
        clientesMap.set(e.cliente_id, {
          cliente_id: e.cliente_id,
          cliente_nome: e.cliente_nome,
          cliente_cidade: e.cliente_cidade,
          cliente_bairro: e.cliente_bairro,
          geo_lat: lat,
          geo_lng: lng,
          churn_risk_score: e.churn_risk_score,
          dias_atraso: e.dias_atraso,
          vencido: e.vencido,
          alerta_tipo: e.alerta_tipo,
          downtime_min_24h: e.downtime_min_24h,
          qtd_chamados: qtdChamados,
        });
      }
    });
    return Array.from(clientesMap.values());
  }, [mapEventos, getChamadosPorCliente]);

  // Estatísticas de chamados para o mapa
  const chamadosMapStats = useMemo(() => {
    const clientesComChamados = mapData.filter(c => c.qtd_chamados && c.qtd_chamados > 0);
    const totalChamados = clientesComChamados.reduce((sum, c) => sum + (c.qtd_chamados || 0), 0);
    const clientesCriticos = clientesComChamados.filter(c => c.qtd_chamados >= 5).length;
    const clientesAtencao = clientesComChamados.filter(c => c.qtd_chamados >= 2 && c.qtd_chamados < 5).length;
    const clientesNormal = clientesComChamados.filter(c => c.qtd_chamados === 1).length;
    
    return {
      totalClientes: clientesComChamados.length,
      totalChamados,
      clientesCriticos,
      clientesAtencao,
      clientesNormal,
    };
  }, [mapData]);

  // Calculate which map tabs have data - sem "todos" e "sinal", com "churn"
  const availableMapTabs = useMemo(() => {
    return ["chamados", "vencido", "churn"];
  }, []);

  // Estatísticas de clientes vencidos - usa mapEventos (sem filtro de período) para contagem real
  // NOTA: no banco, vencido=false mas dias_atraso > 0 indica vencimento real
  const vencidosStats = useMemo(() => {
    const clientesVencidosMap = new Map<number, any>();
    mapEventos.filter(e => (e.dias_atraso !== null && e.dias_atraso !== undefined && Number(e.dias_atraso) > 0)).forEach(e => {
      if (!clientesVencidosMap.has(e.cliente_id)) {
        clientesVencidosMap.set(e.cliente_id, e);
      }
    });
    
    const totalVencidos = clientesVencidosMap.size;
    let comCoordenadas = 0;
    let comGeoExata = 0;
    let comBairroFallback = 0;
    
    clientesVencidosMap.forEach(e => {
      const temGeo = e.geo_lat && e.geo_lng && e.geo_lat !== 0 && e.geo_lng !== 0;
      const temBairro = e.cliente_bairro && bairroCoords[e.cliente_bairro];
      if (temGeo) { comGeoExata++; comCoordenadas++; }
      else if (temBairro) { comBairroFallback++; comCoordenadas++; }
    });
    
    return { totalVencidos, comCoordenadas, comGeoExata, comBairroFallback, semCoordenadas: totalVencidos - comCoordenadas };
  }, [mapEventos, bairroCoords]);

  // Auto-select first available tab if current is not available
  useEffect(() => {
    if (availableMapTabs.length > 0 && !availableMapTabs.includes(mapTab)) {
      setMapTab(availableMapTabs[0]);
    }
  }, [availableMapTabs, mapTab]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const user = profile;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)} mi`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)} mil`;
    return `R$ ${value.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Compacto */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Visão Geral
            </h1>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
              <span className="font-semibold text-primary">{periodoLabel}</span>
              {periodoInicio && (
                <span>({periodoInicio.toLocaleDateString("pt-BR")} → {maxChamadosDate.toLocaleDateString("pt-BR")})</span>
              )}
              <span className="text-muted-foreground/40">·</span>
              <span>Chamados: <strong className="text-foreground">{chamadosStats.totalChamados.toLocaleString()}</strong></span>
              {kpis.novosClientes > 0 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>Novos: <strong className="text-foreground">{kpis.novosClientes}</strong></span>
                </>
              )}
              {snapshotDate && (
                <span className="bg-muted px-1.5 py-0.5 rounded border">
                  Atualizado: {snapshotDate.toLocaleDateString("pt-BR")} {snapshotDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
          <IspActions />
        </div>
      </header>

      <main className="p-3 space-y-3">

        {isLoading || showInitialScreen ? (
          showInitialScreen ? (
            <InitialLoadingScreen />
          ) : (
            <LoadingScreen />
          )
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="ml-4">{error}</p>
          </div>
        ) : (
          <>
            {/* Filtros - acima do resumo executivo */}
            <GlobalFilters filters={[
              {
                id: "periodo",
                label: "Período",
                value: periodo,
                onChange: setPeriodo,
                options: [
                  { value: "7", label: "7 dias" },
                  { value: "30", label: "30 dias" },
                  { value: "90", label: "90 dias" },
                  { value: "365", label: "1 ano" },
                  { value: "todos", label: "Todos" },
                ],
              },
              {
                id: "uf",
                label: "UF",
                value: uf,
                onChange: setUf,
                options: [
                  { value: "todos", label: "Todas" },
                  ...filterOptions.ufs.map(u => ({ value: u, label: u })),
                ],
              },
              {
                id: "cidade",
                label: "Cidade",
                value: cidade,
                onChange: setCidade,
                options: [
                  { value: "todos", label: "Todas" },
                  ...filterOptions.cidades.map(c => ({ value: c, label: c })),
                ],
              },
              {
                id: "bairro",
                label: "Bairro",
                value: bairro,
                onChange: setBairro,
                options: [
                  { value: "todos", label: "Todos" },
                  ...filterOptions.bairros.map(b => ({ value: b, label: b })),
                ],
              },
              {
                id: "plano",
                label: "Plano",
                value: plano,
                onChange: setPlano,
                options: [
                  { value: "todos", label: "Todos" },
                  ...filterOptions.planos.map(p => ({ value: p, label: p.length > 20 ? p.substring(0, 20) + "…" : p })),
                ],
              },
              {
                id: "status",
                label: "Status",
                value: status,
                onChange: setStatus,
                options: [
                  { value: "todos", label: "Todos" },
                  { value: "A", label: "Ativo" },
                  { value: "D", label: "Desativado" },
                  { value: "B", label: "Bloqueado" },
                  { value: "C", label: "Cancelado" },
                ],
              },
              {
                id: "filial",
                label: "Filial",
                value: filial,
                onChange: setFilial,
                disabled: filterOptions.filiais.length === 0,
                tooltip: "Campo filial não encontrado nos dados",
                options: [
                  { value: "todos", label: "Todas" },
                  ...filterOptions.filiais.map(f => ({ value: f, label: `Filial ${f}` })),
                ],
              },
            ]} />

            {/* Resumo Executivo */}
            <ExecutiveSummary
              clientesEmAlerta={vencidosStats.totalVencidos + filaRisco.filter(r => r.driver.includes("técnico")).length}
              mrrSobRisco={kpis.mrrEmRisco}
              perdaEstimada30d={kpis.mrrEmRisco * 0.3}
              alertLevel={vencidosStats.totalVencidos > 50 ? "critical" : vencidosStats.totalVencidos > 20 ? "warning" : "normal"}
              drivers={[
                {
                  id: "inadimplencia",
                  label: "Inadimplência",
                  count: vencidosStats.totalVencidos,
                  unit: "clientes",
                  severity: vencidosStats.totalVencidos > 50 ? "critical" : vencidosStats.totalVencidos > 20 ? "high" : "medium",
                  icon: <DollarSign className="h-3 w-3 mr-1" />,
                  onClick: () => navigate("/financeiro"),
                },
                {
                  id: "suporte",
                  label: "Chamados",
                  count: chamadosStats.totalChamados,
                  unit: "chamados",
                  severity: chamadosStats.totalReincidentes > 20 ? "high" : chamadosStats.totalChamados > 100 ? "medium" : "low",
                  icon: <RefreshCcw className="h-3 w-3 mr-1" />,
                  onClick: () => navigate("/chamados"),
                },
                {
                  id: "alerta_tecnico",
                  label: "Alertas Técnicos",
                  count: filaRisco.filter(r => r.driver.includes("técnico")).length,
                  unit: "clientes",
                  severity: "high",
                  icon: <Wifi className="h-3 w-3 mr-1" />,
                },
              ]}
              onVerFilaRisco={() => {
                const filaSection = document.getElementById("fila-risco");
                filaSection?.scrollIntoView({ behavior: "smooth" });
              }}
              onVerCobranca={() => navigate("/financeiro")}
            />

            {/* KPIs Principais */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              <RiskKPICard
                title="Clientes Ativos"
                value={kpis.clientesAtivos.toLocaleString()}
                icon={Users}
                variant="info"
              />
              <RiskKPICard
                title="Clientes em Alerta"
                value={churnStatus.filter(c => c.status_churn === "risco" && getBucketVisao(c.churn_risk_score) === "ALERTA").length}
                icon={AlertTriangle}
                variant="warning"
                subtitle="bucket ALERTA (churn_status)"
              />
              <RiskKPICard
                title="Clientes Críticos"
                value={churnStatus.filter(c => c.status_churn === "risco" && getBucketVisao(c.churn_risk_score) === "CRÍTICO").length}
                icon={ShieldAlert}
                variant="danger"
                subtitle="bucket CRÍTICO (churn_status)"
              />
              <RiskKPICard
                title="RR Vencido"
                value={formatCurrency(kpis.rrVencido)}
                icon={Clock}
                variant="warning"
                subtitle={`${kpis.pctInadimplencia}% de inadimplência`}
              />
              <RiskKPICard
                title={`Chamados`}
                value={chamadosStats.totalChamados.toLocaleString()}
                icon={RefreshCcw}
                variant={chamadosStats.totalChamados > 100 ? "warning" : "default"}
                subtitle={`${periodoLabel} · ${chamadosStats.clientesComChamados} clientes`}
              />
              <RiskKPICard
                title="Alertas Técnicos"
                value={filaRisco.filter(r => r.driver.includes("técnico")).length}
                icon={Wifi}
                variant="warning"
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Left: Cohort Chart */}
              <div className="lg:col-span-3 space-y-4">
                {/* Cohort Tabs */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CohortTabs activeTab={cohortTab} onTabChange={setCohortTab} />
                  <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
                    <button 
                      onClick={() => setCohortDimension("plano")}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        cohortDimension === "plano" 
                          ? "bg-background shadow text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Plano
                    </button>
                    <button 
                      onClick={() => setCohortDimension("cidade")}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        cohortDimension === "cidade" 
                          ? "bg-background shadow text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Cidade
                    </button>
                    <button 
                      onClick={() => setCohortDimension("bairro")}
                      className={`px-3 py-1 text-sm rounded transition-colors ${
                        cohortDimension === "bairro" 
                          ? "bg-background shadow text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Bairro
                    </button>
                  </div>
                </div>

                {/* Cohort Horizontal Bar Chart - DYNAMIC based on tab */}
                <Card>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {cohortMetricInfo.label}
                        </span>
                        {cohortTab === "suporte" && (
                          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                            🎫 {periodoLabel}: {chamadosStats.totalChamados} chamados

                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {cohortTab === "churn"
                          ? `${sortedCohortData.length} ${cohortDimension === "plano" ? "planos" : cohortDimension === "cidade" ? "cidades" : "bairros"} · ${sortedCohortData.reduce((s, d) => s + (d.cancelados || 0), 0)} cancelados (churn_status)`
                          : `${sortedCohortData.length} ${cohortDimension === "plano" ? "planos" : cohortDimension === "cidade" ? "cidades" : "bairros"} (mín. 3 clientes)`
                        }
                      </span>
                    </div>
                    {sortedCohortData.length > 0 ? (
                      cohortTab === "nps" ? (
                        // NPS: stacked bar chart com Promotores, Neutros e Detratores
                        (() => {
                          // Filtrar apenas grupos com alguma resposta NPS
                          const npsChartData = sortedCohortData
                            .filter(d => d.npsCount > 0)
                            .map(d => ({
                              label: d.label,
                              key: d.key,
                              npsCount: d.npsCount,
                              promotores: d.npsCount > 0 ? Math.round((d.promotores / d.npsCount) * 100) : 0,
                              neutros: d.npsCount > 0 ? Math.round((d.neutros / d.npsCount) * 100) : 0,
                              detratores: d.npsCount > 0 ? Math.round((d.detratores / d.npsCount) * 100) : 0,
                              promotoresAbs: d.promotores,
                              neutrosAbs: d.neutros,
                              detratoresAbs: d.detratores,
                              npsMedia: d.npsMedia,
                            }))
                            .sort((a, b) => b.promotores - a.promotores);

                          if (npsChartData.length === 0) {
                            return (
                              <div className="py-12 text-center">
                                <p className="text-muted-foreground mb-1">Sem dados NPS para exibir</p>
                                <p className="text-xs text-muted-foreground">Os clientes precisam ter respondido pesquisas NPS para aparecer aqui</p>
                              </div>
                            );
                          }

                          return (
                            <ResponsiveContainer width="100%" height={Math.max(280, npsChartData.length * 44)}>
                              <BarChart data={npsChartData} layout="vertical" margin={{ left: 10, right: 10, top: 4, bottom: 4 }} barCategoryGap="20%">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
                                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                                <YAxis dataKey="label" type="category" width={160} fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                                <RechartsTooltip
                                  content={({ active, payload }) => {
                                    if (!active || !payload || !payload.length) return null;
                                    const d = payload[0].payload;
                                    return (
                                      <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm min-w-[200px]">
                                        <p className="font-semibold text-foreground mb-2">{d.key}</p>
                                        <div className="space-y-1">
                                          <p className="flex justify-between gap-4">
                                            <span className="text-[hsl(142,71%,45%)] font-medium">Promotores</span>
                                            <span className="font-bold">{d.promotoresAbs} ({d.promotores}%)</span>
                                          </p>
                                          <p className="flex justify-between gap-4">
                                            <span className="text-[hsl(38,92%,50%)] font-medium">Neutros</span>
                                            <span className="font-bold">{d.neutrosAbs} ({d.neutros}%)</span>
                                          </p>
                                          <p className="flex justify-between gap-4">
                                            <span className="text-destructive font-medium">Detratores</span>
                                            <span className="font-bold">{d.detratoresAbs} ({d.detratores}%)</span>
                                          </p>
                                          <div className="border-t border-border/50 pt-1 mt-1">
                                            <p className="text-muted-foreground">Total respostas: <span className="text-foreground font-medium">{d.npsCount}</span></p>
                                            <p className="text-muted-foreground">Nota média: <span className="text-foreground font-medium">{d.npsMedia?.toFixed(1)}</span></p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }}
                                />
                                <Legend
                                  verticalAlign="bottom"
                                  height={28}
                                  formatter={(value) => (
                                    <span className="text-xs text-foreground">{value}</span>
                                  )}
                                />
                                <Bar dataKey="promotores" name="Promotores" stackId="nps" fill="hsl(142, 71%, 45%)" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="neutros" name="Neutros" stackId="nps" fill="hsl(38, 92%, 50%)" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="detratores" name="Detratores" stackId="nps" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          );
                        })()
                      ) : (
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={sortedCohortData} layout="vertical" margin={{ left: 10, right: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis 
                            type="number" 
                            domain={[0, 'auto']}
                            tickFormatter={(v) => (cohortTab === "ltv") ? `R$${(v/1000).toFixed(0)}k` : (cohortTab === "suporte" || cohortTab === "churn") ? `${v}` : `${v.toFixed(1)}%`}
                            fontSize={11}
                          />
                          <YAxis 
                            dataKey="label" 
                            type="category" 
                            width={160} 
                            fontSize={9}
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <RechartsTooltip 
                            content={({ active, payload, label }) => {
                              if (!active || !payload || !payload.length) return null;
                              const data = payload[0].payload;
                              const value = (data as any)[cohortMetricInfo.dataKey] || 0;
                              return (
                                <div className="bg-popover border rounded-lg shadow-lg p-3 text-sm">
                                  <p className="font-semibold text-foreground mb-1">{data.key}</p>
                                 <div className="space-y-1 text-muted-foreground">
                                    {cohortTab === "financeiro" && (
                                      <>
                                        <p>Valor em atraso: <span className="text-destructive font-medium">R$ {((data.valorVencido || 0) / 1000).toFixed(1)}k</span></p>
                                        <p>Clientes vencidos: <span className="text-foreground font-medium">{data.clientesVencidos}</span> de {data.total} ({data.total > 0 ? (data.clientesVencidos / data.total * 100).toFixed(1) : 0}% de inadimplência)</p>
                                        <p>MRR do grupo: <span className="text-primary font-medium">R$ {((data.mrrTotal || 0) / 1000).toFixed(1)}k</span></p>
                                      </>
                                    )}
                                    {cohortTab === "churn" && (
                                      <>
                                        <p>Cancelados: <span className="text-destructive font-medium">{data.cancelados}</span> clientes</p>
                                        <p>Churn rate: <span className="text-foreground font-medium">{data.total > 0 ? (data.cancelados / data.total * 100).toFixed(1) : "—"}%</span> ({data.cancelados} de {data.total} total)</p>
                                        <p className="text-[10px] text-muted-foreground mt-1">Fonte: tabela churn_status</p>
                                      </>
                                    )}
                                    {cohortTab === "ltv" && (
                                      <>
                                        <p>LTV Médio: <span className="text-primary font-medium">R$ {(value / 1000).toFixed(1)}k</span></p>
                                        <p className="text-xs mt-1 border-t pt-1 border-border/50">
                                          <span className="text-muted-foreground">Fórmula: </span>
                                          <span className="text-foreground font-medium">{data.mesesMedio?.toFixed(0) || 0} meses</span>
                                          <span className="text-muted-foreground"> × </span>
                                          <span className="text-foreground font-medium">R$ {(data.ticketMedio || 0).toFixed(0)}/mês</span>
                                        </p>
                                        <p>Tempo médio: <span className="text-foreground font-medium">{data.mesesMedio?.toFixed(0) || 0} meses ({((data.mesesMedio || 0) / 12).toFixed(1)} anos)</span></p>
                                        <p>Ticket médio: <span className="text-foreground font-medium">R$ {(data.ticketMedio || 0).toFixed(2)}</span></p>
                                        <p>Total clientes: <span className="text-foreground font-medium">{data.total}</span> | MRR: <span className="text-foreground font-medium">R$ {(data.mrrTotal / 1000).toFixed(1)}k</span></p>
                                        
                                        {data.topClientes && data.topClientes.length > 0 && (
                                          <div className="mt-1.5 pt-1.5 border-t border-border/50">
                                            <p className="text-[10px] font-semibold text-muted-foreground mb-1">📋 Top clientes (comprovação):</p>
                                            {data.topClientes.map((c: any, idx: number) => (
                                              <div key={idx} className="text-[10px] text-muted-foreground leading-tight mb-0.5">
                                                <span className="text-foreground">{c.nome}</span>
                                                <br />
                                                <span>Desde {c.dataInstalacao} ({c.meses} meses) • R$ {c.mensalidade.toFixed(0)}/mês • LTV: R$ {(c.ltv/1000).toFixed(1)}k</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </>
                                    )}
                                    {cohortTab === "suporte" && (
                                      <>
                                        <p>Chamados: <span className="text-warning font-medium">{data.chamados}</span></p>
                                        <p>Total clientes: <span className="text-foreground font-medium">{data.total}</span></p>
                                        <p>Reincidentes: <span className="text-foreground font-medium">{data.reincidentes || 0}</span></p>
                                        <p>MRR: <span className="text-foreground font-medium">R$ {((data.mrrTotal || 0) / 1000).toFixed(1)}k</span></p>
                                      </>
                                    )}
                                    {cohortTab === "contratos" && (
                                      <>
                                        <p>Bloqueados: <span className="text-destructive font-medium">{data.bloqueados}</span> ({data.total > 0 ? (data.bloqueados / data.total * 100).toFixed(1) : 0}%)</p>
                                        <p>Ativos: <span className="text-foreground font-medium">{data.ativos}</span></p>
                                        <p>Total clientes: <span className="text-foreground font-medium">{data.total}</span></p>
                                        <p>MRR: <span className="text-foreground font-medium">R$ {((data.mrrTotal || 0) / 1000).toFixed(1)}k</span></p>
                                      </>
                                    )}
                                    {cohortTab === "rede" && (
                                      <>
                                        <p>Com problemas: <span className="text-destructive font-medium">{(data.comDowntime || 0) + (data.comAlerta || 0)}</span> ({value.toFixed(1)}%)</p>
                                        <p>Downtime: <span className="text-foreground font-medium">{data.comDowntime || 0}</span></p>
                                        <p>Alertas: <span className="text-foreground font-medium">{data.comAlerta || 0}</span></p>
                                        <p>Total clientes: <span className="text-foreground font-medium">{data.total}</span></p>
                                      </>
                                    )}
                                    {!["financeiro", "churn", "nps", "ltv", "suporte", "contratos", "rede"].includes(cohortTab) && (
                                      <p>{cohortMetricInfo.format(value)}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar 
                            dataKey={cohortMetricInfo.dataKey} 
                            radius={[0, 4, 4, 0]}
                          >
                            {sortedCohortData.map((entry, index) => {
                              const value = (entry as any)[cohortMetricInfo.dataKey] || 0;
                              let color = "hsl(var(--primary))";
                              if (cohortTab === "ltv") {
                                color = "hsl(var(--primary))";
                              } else if (cohortTab === "financeiro") {
                                color = value > 10 ? "hsl(var(--destructive))" : value > 3 ? "hsl(var(--warning))" : value > 0 ? "hsl(217, 91%, 60%)" : "hsl(var(--muted))";
                              } else {
                                color = value > 30 ? "hsl(var(--destructive))" : value > 10 ? "hsl(var(--warning))" : "hsl(var(--success))";
                              }
                              return (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={color} 
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      )
                    ) : (
                      <p className="text-center text-muted-foreground py-12">Sem dados para exibir</p>
                    )}
                  </CardContent>
                </Card>

              </div>

              {/* Right Sidebar */}
              <div className="space-y-4">
                {/* Driver Principal - com dados reais */}
                <Card className="border-l-4 border-l-warning">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">Driver Principal</p>
                    <p className="text-lg font-bold text-warning">{driverPrincipal.tipo}</p>
                    <p className="text-xs text-muted-foreground">{driverPrincipal.pct}% de {driverPrincipal.desc}</p>
                  </CardContent>
                </Card>

                {/* Top 5 Risco com Filtros independentes */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Top 5 Risco</CardTitle>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setTop5Filter("churn")}
                          className={`px-2 py-0.5 text-xs rounded ${
                            top5Filter === "churn"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          Churn
                        </button>
                        <button
                          onClick={() => setTop5Filter("vencido")}
                          className={`px-2 py-0.5 text-xs rounded ${
                            top5Filter === "vencido"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          }`}
                        >
                          Vencido
                        </button>
                      </div>
                    </div>
                    {/* Legenda explicativa */}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      📊 Taxa de {top5Filter === "churn" ? "cancelamento" : "inadimplência"} por {top5Dimension === "plano" ? "plano" : top5Dimension === "cidade" ? "cidade" : "bairro"}
                    </p>
                    {/* Filtros de dimensão independentes */}
                    <div className="flex items-center gap-1 mt-2">
                      <button
                        onClick={() => setTop5Dimension("plano")}
                        className={`px-2 py-0.5 text-xs rounded ${
                          top5Dimension === "plano"
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        Plano
                      </button>
                      <button
                        onClick={() => setTop5Dimension("cidade")}
                        className={`px-2 py-0.5 text-xs rounded ${
                          top5Dimension === "cidade"
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        Cidade
                      </button>
                      <button
                        onClick={() => setTop5Dimension("bairro")}
                        className={`px-2 py-0.5 text-xs rounded ${
                          top5Dimension === "bairro"
                            ? "bg-secondary text-secondary-foreground"
                            : "text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        Bairro
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {top5Risco.length > 0 ? top5Risco.map((item, i) => {
                      return (
                        <Tooltip key={i}>
                          <TooltipTrigger asChild>
                            <div className="flex justify-between items-center text-sm cursor-help hover:bg-muted/50 rounded px-1 -mx-1 py-0.5">
                              <span className="text-muted-foreground truncate max-w-[140px]" title={item.key}>
                                {item.label.length > 25 ? item.label.substring(0, 25) + "..." : item.label}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{item.count}/{item.total}</span>
                                <span className={`font-medium min-w-[45px] text-right ${item.rate > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                  {item.rate.toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[250px]">
                            <p className="font-semibold mb-1">{item.key}</p>
                            <p className="text-xs text-muted-foreground">
                              {top5Filter === "churn" ? "Cancelados" : "Vencidos"}: <span className="text-foreground font-medium">{item.count}</span> de {item.total} clientes
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Taxa: <span className="text-destructive font-medium">{item.rate.toFixed(1)}%</span>
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    }) : (
                      <p className="text-center text-muted-foreground text-xs py-2">Sem dados</p>
                    )}
                  </CardContent>
                </Card>

                {/* LTV Médio */}
                <Card className="bg-primary text-primary-foreground">
                  <CardContent className="py-4">
                    <p className="text-xs opacity-80">LTV Médio</p>
                    <p className="text-2xl font-bold">{kpis.ltvMeses} meses</p>
                    <p className="text-lg font-semibold text-success">
                      {formatCurrency(kpis.ltvMedio)}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Map Section - Full Width */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Mapa de Alertas
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {mapTab === "todos" ? (
                        <>
                          <span className="font-medium text-foreground">{mapData.length}</span> clientes geolocalizados em {new Set(mapData.map(e => e.cliente_cidade)).size} cidades
                        </>
                      ) : mapTab === "vencido" ? (
                        <>
                          <span className="font-medium text-foreground">{vencidosStats.totalVencidos}</span> vencidos total | 
                          <span className="font-medium ml-1">{vencidosStats.comCoordenadas}</span> no mapa
                        </>
                      ) : mapTab === "chamados" ? (
                        <>
                          <span className="font-medium text-foreground">{chamadosMapStats.totalClientes}</span> clientes com chamados | 
                          <span className="font-medium text-foreground ml-1">{chamadosMapStats.totalChamados}</span> total
                        </>
                      ) : (
                        <>{mapData.length} clientes em {new Set(mapData.map(e => e.cliente_cidade)).size} cidades</>
                      )}
                    </p>
                  </div>
                  {availableMapTabs.length > 0 && (
                    <MapTabs activeTab={mapTab} onTabChange={setMapTab} availableTabs={availableMapTabs} />
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <AlertasMapa 
                  data={mapData} 
                  activeFilter={mapTab as "churn" | "vencido" | "chamados"} 
                />
              </CardContent>
            </Card>

            {/* Bottom Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fila de Risco */}
              <Card id="fila-risco">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <CardTitle className="text-base">Fila de Risco (Hoje)</CardTitle>
                      <Badge variant="destructive" className="text-xs">{filaRisco.length}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {filaRisco.length} resultados • Score em construção
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  {filaRisco.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 font-medium">Cliente</th>
                            <th className="text-left py-2 font-medium">Plano</th>
                            <th className="text-left py-2 font-medium">Sinais</th>
                            <th className="text-right py-2 font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filaRisco.map((item) => (
                            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-2">
                                <div className="max-w-[140px]">
                                  <p className="font-medium truncate">{item.nome}</p>
                                  <p className="text-xs text-muted-foreground truncate">{item.local}</p>
                                </div>
                              </td>
                              <td className="py-2 max-w-[100px] truncate text-muted-foreground text-xs">
                                {item.plano.length > 25 ? item.plano.substring(0, 25) + "..." : item.plano}
                              </td>
                              <td className="py-2">
                                <div className="flex flex-wrap gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge 
                                        variant={item.driver.includes("financeiro") ? "destructive" : "secondary"} 
                                        className="text-xs cursor-help"
                                      >
                                        {item.driver.length > 15 ? item.driver.substring(0, 15) + "..." : item.driver}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>{item.driver}</TooltipContent>
                                  </Tooltip>
                                </div>
                              </td>
                              <td className="py-2 text-right">
                                <div className="flex justify-end items-center gap-1">
                                  <QuickActions
                                    clientId={item.id}
                                    clientName={item.nome}
                                    clientPhone={item.celular}
                                  />
                                  <ActionMenu
                                    clientId={item.id}
                                    clientName={item.nome}
                                    clientPhone={item.celular}
                                    variant="risco"
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title="Nenhum cliente em risco alto"
                      description="Não há clientes com sinais de alerta no momento."
                      variant="card"
                    />
                  )}
                </CardContent>
              </Card>

              {/* Cobrança Inteligente */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-warning" />
                      <CardTitle className="text-base">Cobrança Inteligente</CardTitle>
                      <Badge className="text-xs bg-muted text-muted-foreground">{cobrancaInteligente.length}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{cobrancaInteligente.length} resultados</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {cobrancaInteligente.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-muted-foreground">
                            <th className="text-left py-2 font-medium">Cliente</th>
                            <th className="text-left py-2 font-medium">Status</th>
                            <th className="text-right py-2 font-medium">Valor</th>
                            <th className="text-right py-2 font-medium">Atraso</th>
                            <th className="text-right py-2 font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cobrancaInteligente.map((item, i) => (
                            <tr key={`${item.id}-${i}`} className="border-b last:border-0 hover:bg-muted/50">
                              <td className="py-2">
                                <div className="max-w-[150px]">
                                  <p className="font-medium truncate">{item.nome}</p>
                                  <p className="text-xs text-muted-foreground">{item.vencimento}</p>
                                </div>
                              </td>
                              <td className="py-2">
                                <Badge variant="destructive" className="text-xs">
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="py-2 text-right font-medium">
                                R$ {item.valor.toFixed(2)}
                              </td>
                              <td className="py-2 text-right">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge 
                                      variant={item.atraso > 30 ? "destructive" : "secondary"} 
                                      className="text-xs cursor-help"
                                    >
                                      {item.atraso}d
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {item.atraso > 60 ? "Crítico: +60 dias" : 
                                     item.atraso > 30 ? "Alto: 31-60 dias" : 
                                     item.atraso > 15 ? "Médio: 16-30 dias" : "Baixo: 1-15 dias"}
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                              <td className="py-2 text-right">
                                <div className="flex justify-end items-center gap-1">
                                  <QuickActions
                                    clientId={item.id}
                                    clientName={item.nome}
                                  />
                                  <ActionMenu
                                    clientId={item.id}
                                    clientName={item.nome}
                                    variant="cobranca"
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <EmptyState
                      title="Nenhuma cobrança vencida"
                      description="Todos os clientes estão em dia."
                      variant="card"
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default VisaoGeral;
