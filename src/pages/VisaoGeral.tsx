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
import { 
  Users, 
  UserPlus,
  DollarSign, 
  AlertTriangle, 
  TrendingDown,
  CreditCard,
  Percent,
  TrendingUp,
  AlertCircle,
  Clock,
  Phone,
  MessageSquare,
  Settings,
  Plus,
  Filter,
  ChevronLeft,
  ChevronRight,
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
    { id: "contratos", label: "Contratos", icon: "📄" },
    { id: "financeiro", label: "Financeiro", icon: "$" },
    { id: "suporte", label: "Suporte", icon: "🎧" },
    { id: "rede", label: "Rede", icon: "📶" },
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
}

const MapTabs = ({ activeTab, onTabChange }: MapTabsProps) => {
  const tabs = [
    { id: "churn", label: "Churn" },
    { id: "vencido", label: "Vencido" },
    { id: "sinal", label: "Sinal" },
    { id: "nps", label: "NPS" },
    { id: "reinc", label: "Reinc." },
  ];

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
  const [plano, setPlano] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [cohortTab, setCohortTab] = useState("churn");
  const [mapTab, setMapTab] = useState("churn");
  const [cohortFilter, setCohortFilter] = useState("plano");

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
    const planos = new Set<string>();
    eventos.forEach((e: Evento) => {
      if (e.cliente_uf) ufs.add(e.cliente_uf);
      if (e.plano_nome) planos.add(e.plano_nome);
    });
    return {
      ufs: Array.from(ufs).sort(),
      planos: Array.from(planos).sort(),
    };
  }, [eventos]);

  // Filtered events - FIX: use proper date comparison
  const filteredEventos = useMemo(() => {
    let filtered = [...eventos] as Evento[];

    // Date filter - compare with event_datetime or created_at
    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasAtras);
      dataLimite.setHours(0, 0, 0, 0);

      filtered = filtered.filter((e) => {
        const eventDate = e.event_datetime ? new Date(e.event_datetime) : null;
        if (!eventDate) return true; // Keep events without date
        return eventDate >= dataLimite;
      });
    }

    if (uf !== "todos") {
      filtered = filtered.filter((e) => e.cliente_uf === uf);
    }
    if (plano !== "todos") {
      filtered = filtered.filter((e) => e.plano_nome === plano);
    }
    if (status !== "todos") {
      filtered = filtered.filter((e) => e.servico_status === status);
    }

    return filtered;
  }, [eventos, periodo, uf, plano, status]);

  // KPIs calculation
  const kpis = useMemo(() => {
    // Get unique clients
    const clientesMap = new Map<number, Evento>();
    filteredEventos.forEach(e => {
      if (!clientesMap.has(e.cliente_id) || 
          new Date(e.event_datetime) > new Date(clientesMap.get(e.cliente_id)!.event_datetime)) {
        clientesMap.set(e.cliente_id, e);
      }
    });
    const clientesUnicos = Array.from(clientesMap.values());
    const clientesAtivos = clientesUnicos.filter(e => e.servico_status === "A" || e.status_contrato === "Ativo").length;
    
    // Novos clientes (instalados no período)
    const hoje = new Date();
    const diasPeriodo = periodo === "todos" ? 365 : parseInt(periodo);
    const dataLimite = new Date();
    dataLimite.setDate(hoje.getDate() - diasPeriodo);
    const novosClientes = clientesUnicos.filter(e => {
      const dataInstalacao = e.data_instalacao ? new Date(e.data_instalacao) : null;
      return dataInstalacao && dataInstalacao >= dataLimite;
    }).length;

    // Churn (cancelados)
    const churned = filteredEventos.filter(e => 
      e.event_type === "CANCELAMENTO" || e.servico_status === "C"
    );
    const churnCount = new Set(churned.map(e => e.cliente_id)).size;

    // MRR
    const mrrTotal = clientesUnicos
      .filter(e => e.servico_status === "A" || e.status_contrato === "Ativo")
      .reduce((acc, e) => acc + (e.valor_mensalidade || 0), 0);

    // Faturamento realizado (pagos)
    const faturamentoRealizado = filteredEventos
      .filter(e => e.event_type === "COBRANCA" && (e.cobranca_status === "Pago" || e.valor_pago))
      .reduce((acc, e) => acc + (e.valor_pago || e.valor_cobranca || 0), 0);

    // MRR em Risco (clientes com churn_risk_score alto)
    const clientesEmRisco = clientesUnicos.filter(e => e.churn_risk_score && e.churn_risk_score >= 50);
    const mrrEmRisco = clientesEmRisco.reduce((acc, e) => acc + (e.valor_mensalidade || 0), 0);

    // LTV em Risco
    const ltvEmRisco = clientesEmRisco.reduce((acc, e) => acc + (e.ltv_reais_estimado || 0), 0);

    // RR Vencido (receita recorrente vencida)
    const cobrancasVencidas = filteredEventos.filter(e => 
      e.event_type === "COBRANCA" && (e.vencido === true || e.dias_atraso > 0)
    );
    const rrVencido = cobrancasVencidas.reduce((acc, e) => acc + (e.valor_cobranca || 0), 0);

    // % Inadimplência Crítica (vencido > 30 dias)
    const inadCritica = cobrancasVencidas.filter(e => e.dias_atraso > 30);
    const pctInadCritica = clientesUnicos.length > 0 
      ? (new Set(inadCritica.map(e => e.cliente_id)).size / clientesUnicos.length * 100).toFixed(1)
      : "0.0";

    // % Detratores (NPS < 7)
    const npsScores = filteredEventos.filter(e => e.nps_score !== undefined && e.nps_score !== null);
    const detratores = npsScores.filter(e => e.nps_score! < 7).length;
    const pctDetratores = npsScores.length > 0 
      ? ((detratores / npsScores.length) * 100).toFixed(1)
      : "0.0";

    // LTV Médio
    const ltvValues = clientesUnicos.filter(e => e.ltv_reais_estimado).map(e => e.ltv_reais_estimado!);
    const ltvMedio = ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;
    const ltvMesesValues = clientesUnicos.filter(e => e.ltv_meses_estimado).map(e => e.ltv_meses_estimado!);
    const ltvMeses = ltvMesesValues.length > 0 ? Math.round(ltvMesesValues.reduce((a, b) => a + b, 0) / ltvMesesValues.length) : 0;

    // Ticket Médio
    const ticketMedio = clientesAtivos > 0 ? mrrTotal / clientesAtivos : 0;

    return {
      clientesAtivos,
      novosClientes,
      churnCount,
      mrrTotal,
      faturamentoRealizado,
      mrrEmRisco,
      ltvEmRisco,
      rrVencido,
      pctInadCritica,
      pctDetratores,
      ltvMedio,
      ltvMeses,
      ticketMedio,
    };
  }, [filteredEventos, periodo]);

  // Cohort data by plan
  const cohortData = useMemo(() => {
    const planoStats: Record<string, { 
      plano: string; 
      churn: number; 
      total: number; 
      vencido: number;
      chamados: number;
      ltvTotal: number;
    }> = {};

    // Get unique clients per plan
    const clientesPorPlano = new Map<string, Set<number>>();
    filteredEventos.forEach(e => {
      if (!e.plano_nome) return;
      if (!clientesPorPlano.has(e.plano_nome)) {
        clientesPorPlano.set(e.plano_nome, new Set());
      }
      clientesPorPlano.get(e.plano_nome)!.add(e.cliente_id);
    });

    // Calculate stats per plan
    filteredEventos.forEach(e => {
      if (!e.plano_nome) return;
      const key = e.plano_nome;
      if (!planoStats[key]) {
        planoStats[key] = { plano: key, churn: 0, total: 0, vencido: 0, chamados: 0, ltvTotal: 0 };
      }

      if (e.churn_risk_score && e.churn_risk_score >= 50) {
        planoStats[key].churn++;
      }
      if (e.vencido === true || e.dias_atraso > 0) {
        planoStats[key].vencido++;
      }
      if (e.event_type === "ATENDIMENTO") {
        planoStats[key].chamados++;
      }
      if (e.ltv_reais_estimado) {
        planoStats[key].ltvTotal += e.ltv_reais_estimado;
      }
    });

    // Add total count
    clientesPorPlano.forEach((clientes, plano) => {
      if (planoStats[plano]) {
        planoStats[plano].total = clientes.size;
      }
    });

    // Calculate percentages and sort
    return Object.values(planoStats)
      .map(p => ({
        ...p,
        churnPct: p.total > 0 ? (p.churn / p.total * 100) : 0,
        vencidoPct: p.total > 0 ? (p.vencido / p.total * 100) : 0,
        label: p.plano.length > 60 ? p.plano.substring(0, 60) + "..." : p.plano,
      }))
      .sort((a, b) => b.churnPct - a.churnPct)
      .slice(0, 10);
  }, [filteredEventos]);

  // Top 5 Churn by plan
  const top5Churn = useMemo(() => {
    return cohortData.slice(0, 5).map(p => ({
      plano: p.plano,
      pct: p.churnPct.toFixed(1),
    }));
  }, [cohortData]);

  // Fila de Risco
  const filaRisco = useMemo(() => {
    const clientesMap = new Map<number, Evento>();
    filteredEventos
      .filter(e => e.churn_risk_score && e.churn_risk_score >= 60)
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
        local: `${e.cliente_cidade || ""}, ${e.cliente_uf || ""}`.trim() || "-",
        score: e.churn_risk_score || 0,
        driver: e.alerta_tipo || "Risco",
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [filteredEventos]);

  // Cobrança Inteligente
  const cobrancaInteligente = useMemo(() => {
    return filteredEventos
      .filter(e => e.event_type === "COBRANCA" && (e.vencido === true || e.dias_atraso > 0))
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

  // Map data (clients with geo coordinates)
  const mapData = useMemo(() => {
    const clientesMap = new Map<number, Evento>();
    filteredEventos
      .filter(e => e.geo_lat && e.geo_lng)
      .forEach(e => {
        if (!clientesMap.has(e.cliente_id)) {
          clientesMap.set(e.cliente_id, e);
        }
      });
    return Array.from(clientesMap.values());
  }, [filteredEventos]);

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
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Todas UFs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas UFs</SelectItem>
                {filterOptions.ufs.map(u => (
                  <SelectItem key={u} value={u}>{u}</SelectItem>
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
                  <div className="flex items-center gap-2">
                    <button className="p-1 hover:bg-muted rounded"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-sm text-muted-foreground">Plano</span>
                    <button className="p-1 hover:bg-muted rounded"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                </div>

                {/* Cohort Horizontal Bar Chart */}
                <Card>
                  <CardContent className="pt-4">
                    {cohortData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={cohortData} layout="vertical" margin={{ left: 10, right: 30 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis 
                            type="number" 
                            domain={[0, 'auto']}
                            tickFormatter={(v) => `${v.toFixed(0)}%`}
                            fontSize={11}
                          />
                          <YAxis 
                            dataKey="label" 
                            type="category" 
                            width={140} 
                            fontSize={10}
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(2)}%`, cohortTab === "churn" ? "Churn" : "Valor"]}
                            labelFormatter={(label) => label}
                          />
                          <Bar 
                            dataKey={cohortTab === "churn" ? "churnPct" : cohortTab === "financeiro" ? "vencidoPct" : "churnPct"} 
                            radius={[0, 4, 4, 0]}
                          >
                            {cohortData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.churnPct > 3 ? "hsl(var(--destructive))" : entry.churnPct > 1 ? "hsl(var(--warning))" : "hsl(var(--success))"} 
                              />
                            ))}
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
                      <MapTabs activeTab={mapTab} onTabChange={setMapTab} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {/* Map Placeholder - would integrate Mapbox here */}
                    <div className="relative h-[300px] bg-slate-800 rounded-lg overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center text-white/60">
                          <MapPin className="h-12 w-12 mx-auto mb-2" />
                          <p className="text-sm">Mapa com {mapData.length} clientes geolocalizados</p>
                          <p className="text-xs mt-1">Configure o Mapbox para visualização completa</p>
                        </div>
                      </div>
                      {/* Legend */}
                      <div className="absolute bottom-3 left-3 flex gap-3 text-xs text-white/80">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Crítico</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Alto</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500"></span> Médio</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Baixo</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-4">
                {/* Driver Principal */}
                <Card className="border-l-4 border-l-warning">
                  <CardContent className="py-4">
                    <p className="text-xs text-muted-foreground">Driver Principal</p>
                    <p className="text-lg font-bold text-warning">Financeiro</p>
                    <p className="text-xs text-muted-foreground">28% de clientes em atraso</p>
                  </CardContent>
                </Card>

                {/* Top 5 Churn */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Top 5 Churn</CardTitle>
                    <p className="text-xs text-muted-foreground">Por Plano</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {top5Churn.map((item, i) => (
                      <div key={i} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground truncate max-w-[180px]" title={item.plano}>
                          {item.plano.substring(0, 45)}...
                        </span>
                        <span className="text-destructive font-medium">{item.pct}%</span>
                      </div>
                    ))}
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
