import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useEventos } from "@/hooks/useEventos";

import { Evento } from "@/types/evento";
import { AlertasMapa } from "@/components/map/AlertasMapa";
import { 
  Users, 
  UserPlus,
  DollarSign, 
  AlertTriangle, 
  TrendingDown,
  CreditCard,
  Percent,
  AlertCircle,
  Clock,
  Phone,
  MessageSquare,
  Settings,
  Plus,
  Filter,
  MapPin
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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

// Map Filter Tabs - only shows tabs with available data
interface MapTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  availableTabs: string[];
}

const MapTabs = ({ activeTab, onTabChange, availableTabs }: MapTabsProps) => {
  const allTabs = [
    { id: "vencido", label: "Vencido" },
    { id: "sinal", label: "Sinal" },
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

const VisaoGeral = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const { eventos, isLoading, error } = useEventos();
  

  // Filtros
  const [periodo, setPeriodo] = useState("365");
  const [uf, setUf] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [cohortTab, setCohortTab] = useState("financeiro");
  const [mapTab, setMapTab] = useState("vencido");
  const [cohortDimension, setCohortDimension] = useState<"plano" | "cidade" | "bairro">("plano");
  const [top5Dimension, setTop5Dimension] = useState<"plano" | "cidade" | "bairro">("cidade");
  const [top5Filter, setTop5Filter] = useState<"churn" | "vencido">("vencido");

  // Mapeamento de IDs de cidade para nomes - apenas cidades COM DADOS
  const cidadeIdMap: Record<string, string> = {
    "4405": "Gaspar",
    "4419": "Ilhota",
    // Blumenau (4346) e Itajaí (4435) serão adicionados quando houver dados
  };

  // Helper function para converter ID de cidade para nome
  // IMPORTANTE: retorna NULL se não encontrar no mapa (para não exibir IDs)
  const getCidadeNome = (cidadeValue: any): string | null => {
    if (cidadeValue === null || cidadeValue === undefined) return null;
    const cidadeKey = String(cidadeValue);
    return cidadeIdMap[cidadeKey] || null; // NÃO retorna ID, retorna null
  };

  // Helper function para verificar se cliente está vencido - CONSISTENTE em todo código
  const isClienteVencido = (e: Evento): boolean => {
    return e.vencido === true || 
           String(e.vencido).toLowerCase() === "true" || 
           (e.dias_atraso !== null && e.dias_atraso !== undefined && Number(e.dias_atraso) > 0);
  };

  // Debug: análise completa de dados por cidade (clientes únicos)
  useEffect(() => {
    if (eventos.length > 0) {
      const clientesPorCidade: Record<string, Set<number>> = {};
      const clientesVencidosPorCidade: Record<string, Set<number>> = {};
      const ltvPorCidade: Record<string, number[]> = {};
      
      eventos.forEach(e => {
        const cidadeNome = getCidadeNome(e.cliente_cidade);
        if (!cidadeNome) return;
        
        if (!clientesPorCidade[cidadeNome]) {
          clientesPorCidade[cidadeNome] = new Set();
          clientesVencidosPorCidade[cidadeNome] = new Set();
          ltvPorCidade[cidadeNome] = [];
        }
        
        // Contar cliente único
        if (!clientesPorCidade[cidadeNome].has(e.cliente_id)) {
          clientesPorCidade[cidadeNome].add(e.cliente_id);
          if (e.ltv_reais_estimado) {
            ltvPorCidade[cidadeNome].push(e.ltv_reais_estimado);
          }
        }
        
        // Verificar se cliente está vencido - usar função helper
        if (isClienteVencido(e) && !clientesVencidosPorCidade[cidadeNome].has(e.cliente_id)) {
          clientesVencidosPorCidade[cidadeNome].add(e.cliente_id);
        }
      });
      
      // Resumo por cidade
      const resumo: Record<string, { clientes: number; vencidos: number; pctVencido: string; ltvMedio: string }> = {};
      Object.keys(clientesPorCidade).forEach(cidade => {
        const total = clientesPorCidade[cidade].size;
        const vencidos = clientesVencidosPorCidade[cidade].size;
        const ltv = ltvPorCidade[cidade];
        const ltvMedio = ltv.length > 0 ? ltv.reduce((a, b) => a + b, 0) / ltv.length : 0;
        resumo[cidade] = {
          clientes: total,
          vencidos: vencidos,
          pctVencido: (total > 0 ? (vencidos / total * 100).toFixed(1) : "0") + "%",
          ltvMedio: "R$ " + ltvMedio.toFixed(0)
        };
      });
      
      console.log("=== ANÁLISE POR CIDADE (4 cidades mapeadas) ===");
      console.table(resumo);
    }
  }, [eventos]);

  // Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) navigate("/auth");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Filter options
  const filterOptions = useMemo(() => {
    const ufs = new Set<string>();
    const cidades = new Set<string>();
    const bairros = new Set<string>();
    const planos = new Set<string>();
    eventos.forEach((e: Evento) => {
      if (e.cliente_uf) ufs.add(e.cliente_uf);
      if (e.cliente_cidade) cidades.add(e.cliente_cidade);
      if (e.cliente_bairro) bairros.add(e.cliente_bairro);
      if (e.plano_nome) planos.add(e.plano_nome);
    });
    return {
      ufs: Array.from(ufs).sort(),
      cidades: Array.from(cidades).sort(),
      bairros: Array.from(bairros).sort(),
      planos: Array.from(planos).sort(),
    };
  }, [eventos]);

  // Filtered events - FIX: proper date filtering
  const filteredEventos = useMemo(() => {
    let filtered = [...eventos] as Evento[];

    // Date filter - compare with event_datetime, data_instalacao, or created_at
    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasAtras);
      dataLimite.setHours(0, 0, 0, 0);

      filtered = filtered.filter((e) => {
        // Try multiple date fields
        const dateStr = e.event_datetime || e.data_instalacao || e.created_at;
        if (!dateStr) return false; // Exclude events without any date
        
        const eventDate = new Date(dateStr);
        if (isNaN(eventDate.getTime())) return false; // Invalid date
        
        return eventDate >= dataLimite;
      });
    }

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

    return filtered;
  }, [eventos, periodo, uf, cidade, bairro, plano, status]);


  // KPIs calculation - FIXED: use actual data fields correctly
  const kpis = useMemo(() => {
    // Get unique clients (last event per client)
    const clientesMap = new Map<number, Evento>();
    filteredEventos.forEach(e => {
      if (!clientesMap.has(e.cliente_id) || 
          new Date(e.event_datetime) > new Date(clientesMap.get(e.cliente_id)!.event_datetime)) {
        clientesMap.set(e.cliente_id, e);
      }
    });
    const clientesUnicos = Array.from(clientesMap.values());
    
    // Clientes ativos: status_contrato diferente de C (cancelado) ou servico_status diferente de C
    const clientesAtivos = clientesUnicos.filter(e => 
      e.status_contrato !== "C" && e.servico_status !== "C"
    ).length;
    
    // Total de clientes únicos
    const totalClientes = clientesUnicos.length;
    
    // Novos clientes (instalados no período)
    const hoje = new Date();
    const diasPeriodo = periodo === "todos" ? 365 : parseInt(periodo);
    const dataLimite = new Date();
    dataLimite.setDate(hoje.getDate() - diasPeriodo);
    const novosClientes = clientesUnicos.filter(e => {
      const dataInstalacao = e.data_instalacao ? new Date(e.data_instalacao) : 
                             e.created_at ? new Date(e.created_at) : null;
      return dataInstalacao && dataInstalacao >= dataLimite;
    }).length;

    // Churn (cancelados)
    const churned = filteredEventos.filter(e => 
      e.event_type === "CANCELAMENTO" || e.servico_status === "C" || e.status_contrato === "C"
    );
    const churnCount = new Set(churned.map(e => e.cliente_id)).size;

    // MRR Total - somar valor_mensalidade de todos clientes não cancelados
    const mrrTotal = clientesUnicos
      .filter(e => e.status_contrato !== "C" && e.servico_status !== "C")
      .reduce((acc, e) => acc + (e.valor_mensalidade || 0), 0);

    // Faturamento realizado (cobranças pagas)
    const faturamentoRealizado = filteredEventos
      .filter(e => e.event_type === "COBRANCA" && (e.cobranca_status === "Pago" || e.valor_pago))
      .reduce((acc, e) => acc + (e.valor_pago || e.valor_cobranca || 0), 0);

    // MRR em Risco - clientes com alerta ou risco
    const clientesEmRisco = clientesUnicos.filter(e => 
      e.churn_risk_score && e.churn_risk_score >= 50 ||
      e.alerta_tipo ||
      e.downtime_min_24h > 60
    );
    const mrrEmRisco = clientesEmRisco.reduce((acc, e) => acc + (e.valor_mensalidade || 0), 0);

    // LTV em Risco
    const ltvEmRisco = clientesEmRisco.reduce((acc, e) => acc + (e.ltv_reais_estimado || e.valor_mensalidade * 12 || 0), 0);

    // RR Vencido (receita recorrente vencida)
    const cobrancasVencidas = filteredEventos.filter(e => 
      e.event_type === "COBRANCA" && isClienteVencido(e)
    );
    const rrVencido = cobrancasVencidas.reduce((acc, e) => acc + (e.valor_cobranca || 0), 0);

    // Clientes vencidos únicos
    const clientesVencidosUnicos = new Set(cobrancasVencidas.map(e => e.cliente_id)).size;

    // % Inadimplência = clientes com cobrança vencida / total de clientes
    const pctInadimplencia = totalClientes > 0 
      ? ((clientesVencidosUnicos / totalClientes) * 100).toFixed(1)
      : "0.0";

    // % Inadimplência Crítica (vencido > 30 dias)
    const inadCritica = cobrancasVencidas.filter(e => e.dias_atraso && e.dias_atraso > 30);
    const pctInadCritica = totalClientes > 0 
      ? (new Set(inadCritica.map(e => e.cliente_id)).size / totalClientes * 100).toFixed(1)
      : "0.0";

    // % Detratores (NPS < 7)
    const npsScores = filteredEventos.filter(e => e.nps_score !== undefined && e.nps_score !== null);
    const detratores = npsScores.filter(e => e.nps_score! < 7).length;
    const pctDetratores = npsScores.length > 0 
      ? ((detratores / npsScores.length) * 100).toFixed(1)
      : "N/A";

    // LTV Médio - usar ltv_reais_estimado ou calcular estimativa
    const ltvValues = clientesUnicos
      .filter(e => e.ltv_reais_estimado || e.valor_mensalidade)
      .map(e => e.ltv_reais_estimado || (e.valor_mensalidade || 0) * 24); // Estimativa: 24 meses
    const ltvMedio = ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;
    
    // LTV em meses - usar apenas ltv_meses_estimado do banco
    const ltvMesesValues = clientesUnicos
      .filter(e => e.ltv_meses_estimado !== null && e.ltv_meses_estimado !== undefined)
      .map(e => e.ltv_meses_estimado!);
    const ltvMeses = ltvMesesValues.length > 0 
      ? Math.round(ltvMesesValues.reduce((a, b) => a + b, 0) / ltvMesesValues.length) 
      : 0; // Se não tiver dados, mostrar 0
    
    // Debug LTV COMPLETO
    console.log("📊 LTV ANÁLISE COMPLETA:", {
      totalClientesUnicos: clientesUnicos.length,
      clientesComLtvMeses: ltvMesesValues.length,
      valoresLtvMeses: ltvMesesValues,
      soma: ltvMesesValues.reduce((a, b) => a + b, 0),
      ltvMesesCalculado: ltvMeses,
      ltvReaisCalculado: ltvMedio,
      primeirosCom: clientesUnicos.filter(e => e.ltv_meses_estimado).slice(0, 5).map(e => ({
        cliente: e.cliente_id,
        ltv_meses: e.ltv_meses_estimado,
        ltv_reais: e.ltv_reais_estimado
      }))
    });

    // Ticket Médio
    const ticketMedio = clientesAtivos > 0 ? mrrTotal / clientesAtivos : 0;

    return {
      clientesAtivos,
      totalClientes,
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
  }, [filteredEventos, periodo]);

  // Generic function to calculate cohort data for any dimension
  const calculateCohortData = (dimension: "plano" | "cidade" | "bairro") => {
    const stats: Record<string, { 
      key: string; 
      label: string;
      total: number; 
      // Churn/Risco
      risco: number;
      cancelados: number;
      // Contratos
      ativos: number;
      bloqueados: number;
      // Financeiro - agora conta CLIENTES únicos vencidos
      clientesVencidos: number;
      valorVencido: number;
      // Suporte (placeholder - aguardando dados)
      chamados: number;
      reincidentes: number;
      // Rede
      comDowntime: number;
      comAlerta: number;
      // NPS
      npsTotal: number;
      npsCount: number;
      detratores: number;
      // LTV
      ltvTotal: number;
      mrrTotal: number;
    }> = {};

    const clientesPorKey = new Map<string, Set<number>>();
    const clienteContado = new Map<string, Set<number>>();
    const clientesVencidosPorKey = new Map<string, Set<number>>(); // Track clientes vencidos separadamente
    
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
    
    filteredEventos.forEach(e => {
      const key = getKey(e);
      if (!key) return;
      
      if (!clientesPorKey.has(key)) {
        clientesPorKey.set(key, new Set());
        clientesVencidosPorKey.set(key, new Set());
      }
      clientesPorKey.get(key)!.add(e.cliente_id);
      
      if (!stats[key]) {
        stats[key] = { 
          key, 
          label: getLabel(key, dimension),
          total: 0, risco: 0, cancelados: 0, ativos: 0, bloqueados: 0,
          clientesVencidos: 0, valorVencido: 0, chamados: 0, reincidentes: 0,
          comDowntime: 0, comAlerta: 0, npsTotal: 0, npsCount: 0, detratores: 0,
          ltvTotal: 0, mrrTotal: 0
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
        
        // Contratos
        if (e.status_contrato === "C" || e.servico_status === "C") {
          stats[key].cancelados++;
        } else if (e.servico_status === "B" || e.status_contrato === "B") {
          stats[key].bloqueados++;
        } else {
          stats[key].ativos++;
        }
        
        // Risco
        if (e.alerta_tipo || (e.downtime_min_24h && e.downtime_min_24h > 60) || (e.churn_risk_score && e.churn_risk_score >= 50)) {
          stats[key].risco++;
        }
        
        // Rede
        if (e.downtime_min_24h && e.downtime_min_24h > 60) {
          stats[key].comDowntime++;
        }
        if (e.alerta_tipo) {
          stats[key].comAlerta++;
        }
        
        // NPS
        if (e.nps_score !== null && e.nps_score !== undefined) {
          stats[key].npsTotal += e.nps_score;
          stats[key].npsCount++;
          if (e.nps_score < 7) {
            stats[key].detratores++;
          }
        }
      }
      
      // Financeiro - contar CLIENTE ÚNICO vencido (não eventos)
      if (isClienteVencido(e)) {
        const vencidosSet = clientesVencidosPorKey.get(key)!;
        if (!vencidosSet.has(e.cliente_id)) {
          vencidosSet.add(e.cliente_id);
        }
        stats[key].valorVencido += e.valor_cobranca || 0;
      }
    });

    // Add total count e clientes vencidos
    clientesPorKey.forEach((clientes, key) => {
      if (stats[key]) {
        stats[key].total = clientes.size;
        stats[key].clientesVencidos = clientesVencidosPorKey.get(key)?.size || 0;
      }
    });

    // Calculate all percentages - CORRIGIDO: usar clientesVencidos (únicos)
    return Object.values(stats)
      .map(p => ({
        ...p,
        plano: p.key, // For backward compatibility
        churnPct: p.total > 0 ? (p.cancelados / p.total * 100) : 0,
        contratosPct: p.total > 0 ? (p.bloqueados / p.total * 100) : 0,
        financeiroPct: p.total > 0 ? (p.clientesVencidos / p.total * 100) : 0, // CORRIGIDO
        suportePct: p.total > 0 ? (p.chamados / p.total * 100) : 0,
        redePct: p.total > 0 ? ((p.comDowntime + p.comAlerta) / p.total * 100) : 0,
        npsPct: p.npsCount > 0 ? (p.detratores / p.npsCount * 100) : 0,
        npsMedia: p.npsCount > 0 ? (p.npsTotal / p.npsCount) : 0,
        ltvMedio: p.total > 0 ? (p.ltvTotal / p.total) : 0,
      }));
  };

  // Cohort data based on selected dimension
  const cohortData = useMemo(() => {
    return calculateCohortData(cohortDimension);
  }, [filteredEventos, cohortDimension]);

  // Sorted cohort data based on selected tab
  const sortedCohortData = useMemo(() => {
    const sortKey = {
      churn: "churnPct",
      contratos: "contratosPct", 
      financeiro: "financeiroPct",
      suporte: "suportePct",
      rede: "redePct",
      nps: "npsPct",
      ltv: "ltvMedio",
    }[cohortTab] || "churnPct";

    return [...cohortData]
      .sort((a, b) => (b as any)[sortKey] - (a as any)[sortKey])
      .slice(0, 12);
  }, [cohortData, cohortTab]);

  // Metric info for current tab
  const cohortMetricInfo = useMemo(() => {
    const dimensionLabel = cohortDimension === "plano" ? "Plano" : cohortDimension === "cidade" ? "Cidade" : "Bairro";
    const info: Record<string, { dataKey: string; label: string; format: (v: number) => string }> = {
      churn: { dataKey: "churnPct", label: `% Churn por ${dimensionLabel}`, format: (v) => `${v.toFixed(1)}%` },
      contratos: { dataKey: "contratosPct", label: `% Bloqueados por ${dimensionLabel}`, format: (v) => `${v.toFixed(1)}%` },
      financeiro: { dataKey: "financeiroPct", label: `% Vencido por ${dimensionLabel}`, format: (v) => `${v.toFixed(1)}%` },
      suporte: { dataKey: "suportePct", label: `Chamados por ${dimensionLabel}`, format: (v) => `${v.toFixed(1)}%` },
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

  // Top 5 Data - USA MESMA DIMENSÃO DO GRÁFICO PRINCIPAL (cohortDimension)
  const top5Data = useMemo(() => {
    return calculateCohortData(cohortDimension);
  }, [filteredEventos, cohortDimension]);

  // Top 5 por métrica selecionada - ORDENADO IGUAL AO GRÁFICO (por % interno)
  const top5Risco = useMemo(() => {
    const pctKey = top5Filter === "churn" ? "churnPct" : "financeiroPct";
    const countKey = top5Filter === "churn" ? "cancelados" : "clientesVencidos";
    
    // Total de todos os cancelados/vencidos para calcular distribuição
    const totalCount = top5Data.reduce((sum, p) => sum + ((p as any)[countKey] || 0), 0);
    
    if (totalCount === 0) {
      return top5Data.slice(0, 5).map(p => ({
        key: p.key,
        label: p.label,
        pct: "0.0",
      }));
    }
    
    // ORDENAR pelo mesmo critério do gráfico (% interno), mas mostrar distribuição
    return [...top5Data]
      .sort((a, b) => ((b as any)[pctKey] || 0) - ((a as any)[pctKey] || 0))
      .slice(0, 5)
      .map(p => ({
        key: p.key,
        label: p.label,
        pct: (((p as any)[countKey] || 0) / totalCount * 100).toFixed(1),
      }));
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

  // Cobrança Inteligente
  const cobrancaInteligente = useMemo(() => {
    return filteredEventos
      .filter(e => e.event_type === "COBRANCA" && isClienteVencido(e))
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
  }, [filteredEventos]);

  // Map data (clients with geo coordinates) - include all relevant fields for filtering
  const mapData = useMemo(() => {
    const clientesMap = new Map<number, any>();
    filteredEventos
      .filter(e => e.geo_lat && e.geo_lng)
      .forEach(e => {
        const existing = clientesMap.get(e.cliente_id);
        // Keep the record with more risk data, or add if not exists
        if (!existing || (e.dias_atraso && e.dias_atraso > (existing.dias_atraso || 0))) {
          clientesMap.set(e.cliente_id, {
            cliente_id: e.cliente_id,
            cliente_nome: e.cliente_nome,
            cliente_cidade: e.cliente_cidade,
            geo_lat: e.geo_lat,
            geo_lng: e.geo_lng,
            churn_risk_score: e.churn_risk_score,
            dias_atraso: e.dias_atraso,
            vencido: e.vencido,
            alerta_tipo: e.alerta_tipo,
            downtime_min_24h: e.downtime_min_24h,
          });
        }
      });
    return Array.from(clientesMap.values());
  }, [filteredEventos]);

  // Calculate which map tabs have data - only vencido and sinal (churn removed)
  const availableMapTabs = useMemo(() => {
    return ["vencido", "sinal"];
  }, []);

  // Auto-select first available tab if current is not available
  useEffect(() => {
    if (availableMapTabs.length > 0 && !availableMapTabs.includes(mapTab)) {
      setMapTab(availableMapTabs[0]);
    }
  }, [availableMapTabs, mapTab]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user) return null;

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `R$ ${(value / 1000000).toFixed(1)} mi`;
    if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)} mil`;
    return `R$ ${value.toFixed(0)}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header with Filters */}
      <header className="border-b bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Filtros:</span>
            </div>
            
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
                <SelectItem value="365">1 ano</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>

            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Todas UFs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas UFs</SelectItem>
                {filterOptions.ufs.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={cidade} onValueChange={setCidade}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Todas Cidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas Cidades</SelectItem>
                {filterOptions.cidades.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={bairro} onValueChange={setBairro}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Todos Bairros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Bairros</SelectItem>
                {filterOptions.bairros.map(b => (
                  <SelectItem key={b} value={b}>{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={plano} onValueChange={setPlano}>
              <SelectTrigger className="w-[150px] h-9">
                <SelectValue placeholder="Todos Planos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Planos</SelectItem>
                {filterOptions.planos.map(p => (
                  <SelectItem key={p} value={p}>{p.substring(0, 40)}...</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Todos Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos Status</SelectItem>
                <SelectItem value="A">Ativo</SelectItem>
                <SelectItem value="D">Desativado</SelectItem>
                <SelectItem value="B">Bloqueado</SelectItem>
                <SelectItem value="C">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main className="p-6 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-primary">Command Center</h1>
          <p className="text-muted-foreground text-sm">Visão executiva em tempo real</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="ml-4">{error}</p>
          </div>
        ) : (
          <>
            {/* KPIs Row */}
            <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
              <KPICard
                title="Clientes Ativos"
                value={kpis.clientesAtivos.toLocaleString()}
                variant="primary"
                icon={<Users className="h-3.5 w-3.5" />}
              />
              <KPICard
                title="Novos Clientes"
                value={kpis.novosClientes.toLocaleString()}
                icon={<UserPlus className="h-3.5 w-3.5" />}
              />
              <KPICard
                title="Churn (Absoluto)"
                value={kpis.churnCount.toLocaleString()}
                icon={<TrendingDown className="h-3.5 w-3.5" />}
              />
              <KPICard
                title="MRR Total"
                value={formatCurrency(kpis.mrrTotal)}
                icon={<DollarSign className="h-3.5 w-3.5" />}
              />
              <KPICard
                title="Faturamento Realizado"
                value={formatCurrency(kpis.faturamentoRealizado)}
                icon={<CreditCard className="h-3.5 w-3.5" />}
              />
              <KPICard
                title="MRR em Risco"
                value={formatCurrency(kpis.mrrEmRisco)}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
              />
              <KPICard
                title="LTV em Risco"
                value={formatCurrency(kpis.ltvEmRisco)}
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
              />
              <KPICard
                title="RR Vencido"
                value={formatCurrency(kpis.rrVencido)}
                variant="warning"
                icon={<Clock className="h-3.5 w-3.5" />}
              />
              <KPICard
                title="% Inad Crítico"
                value={`${kpis.pctInadCritica}%`}
                icon={<Percent className="h-3.5 w-3.5" />}
              />
              <KPICard
                title="% Detratores"
                value={`${kpis.pctDetratores}%`}
                icon={<TrendingDown className="h-3.5 w-3.5" />}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
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
                      <span className="text-sm font-medium text-muted-foreground">
                        {cohortMetricInfo.label} por Plano
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {sortedCohortData.length} planos
                      </span>
                    </div>
                    {sortedCohortData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={sortedCohortData} layout="vertical" margin={{ left: 10, right: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis 
                            type="number" 
                            domain={[0, 'auto']}
                            tickFormatter={(v) => cohortTab === "ltv" ? `R$${(v/1000).toFixed(0)}k` : `${v.toFixed(0)}%`}
                            fontSize={11}
                          />
                          <YAxis 
                            dataKey="label" 
                            type="category" 
                            width={160} 
                            fontSize={9}
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <Tooltip 
                            formatter={(value: number) => [cohortMetricInfo.format(value), cohortMetricInfo.label]}
                            labelFormatter={(label) => label}
                          />
                          <Bar 
                            dataKey={cohortMetricInfo.dataKey} 
                            radius={[0, 4, 4, 0]}
                          >
                            {sortedCohortData.map((entry, index) => {
                              const value = (entry as any)[cohortMetricInfo.dataKey] || 0;
                              let color = "hsl(var(--success))";
                              if (cohortTab === "ltv") {
                                color = value > 5000 ? "hsl(var(--success))" : value > 2000 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
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
                    ) : (
                      <p className="text-center text-muted-foreground py-12">Sem dados para exibir</p>
                    )}
                  </CardContent>
                </Card>

                {/* Map Section */}
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          Mapa de Alertas
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{mapData.length} clientes em {new Set(mapData.map(e => e.cliente_cidade)).size} cidades</p>
                      </div>
                      {availableMapTabs.length > 0 && (
                        <MapTabs activeTab={mapTab} onTabChange={setMapTab} availableTabs={availableMapTabs} />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <AlertasMapa 
                      data={mapData} 
                      activeFilter={mapTab as "churn" | "vencido" | "sinal"} 
                    />
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
                    {/* Dimensão segue o gráfico principal */}
                    <p className="text-xs text-muted-foreground mt-1">
                      Por {cohortDimension === "plano" ? "Plano" : cohortDimension === "cidade" ? "Cidade" : "Bairro"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {top5Risco.length > 0 ? top5Risco.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground truncate max-w-[180px]" title={item.key}>
                          {item.label.length > 35 ? item.label.substring(0, 35) + "..." : item.label}
                        </span>
                        <span className={`font-medium ${parseFloat(item.pct) > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {item.pct}%
                        </span>
                      </div>
                    )) : (
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

            {/* Bottom Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Fila de Risco */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <CardTitle className="text-base">Fila de Risco (Hoje)</CardTitle>
                      <Badge variant="destructive" className="text-xs">{filaRisco.length}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{filaRisco.length} resultados</span>
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
                            <th className="text-left py-2 font-medium">Local</th>
                            <th className="text-left py-2 font-medium">Score</th>
                            <th className="text-left py-2 font-medium">Driver</th>
                            <th className="text-right py-2 font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filaRisco.map((item) => (
                            <tr key={item.id} className="border-b last:border-0">
                              <td className="py-2 max-w-[120px] truncate">{item.nome}</td>
                              <td className="py-2 max-w-[100px] truncate text-muted-foreground">{item.plano.substring(0, 20)}...</td>
                              <td className="py-2 text-muted-foreground">{item.local}</td>
                              <td className="py-2">
                                <Badge variant={item.score >= 75 ? "destructive" : "secondary"}>
                                  {item.score}%
                                </Badge>
                              </td>
                              <td className="py-2 text-muted-foreground">{item.driver}</td>
                              <td className="py-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <button className="p-1 hover:bg-muted rounded" title="Ligar">
                                    <Phone className="h-3.5 w-3.5" />
                                  </button>
                                  <button className="p-1 hover:bg-muted rounded" title="WhatsApp">
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </button>
                                  <button className="p-1 hover:bg-muted rounded" title="Configurar">
                                    <Settings className="h-3.5 w-3.5" />
                                  </button>
                                  <button className="p-1 hover:bg-muted rounded" title="Adicionar">
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhum cliente em risco alto/crítico
                    </p>
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
                            <th className="text-left py-2 font-medium">Vencimento</th>
                            <th className="text-right py-2 font-medium">Valor</th>
                            <th className="text-right py-2 font-medium">Atraso</th>
                            <th className="text-right py-2 font-medium">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cobrancaInteligente.map((item, i) => (
                            <tr key={`${item.id}-${i}`} className="border-b last:border-0">
                              <td className="py-2 max-w-[150px] truncate">{item.nome}</td>
                              <td className="py-2">
                                <Badge variant="destructive" className="text-xs">
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="py-2 text-muted-foreground">{item.vencimento}</td>
                              <td className="py-2 text-right font-medium">
                                R$ {item.valor.toFixed(2)}
                              </td>
                              <td className="py-2 text-right">
                                <Badge variant="destructive" className="text-xs">
                                  {item.atraso}d
                                </Badge>
                              </td>
                              <td className="py-2 text-right">
                                <div className="flex justify-end gap-1">
                                  <button className="p-1 hover:bg-muted rounded" title="Ligar">
                                    <Phone className="h-3.5 w-3.5" />
                                  </button>
                                  <button className="p-1 hover:bg-muted rounded" title="WhatsApp">
                                    <MessageSquare className="h-3.5 w-3.5" />
                                  </button>
                                  <button className="p-1 hover:bg-muted rounded" title="Configurar">
                                    <Settings className="h-3.5 w-3.5" />
                                  </button>
                                  <button className="p-1 hover:bg-muted rounded" title="Adicionar">
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma cobrança vencida
                    </p>
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
