import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useEventos } from "@/hooks/useEventos";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { DataTable, RiskBadge, Column } from "@/components/shared/DataTable";
import { Evento } from "@/types/evento";
import { 
  Users, 
  FileText, 
  DollarSign, 
  AlertTriangle, 
  TrendingDown,
  Activity,
  Wifi,
  ThumbsUp,
  Target,
  AlertCircle,
  Clock,
  CreditCard,
  Percent,
  TrendingUp,
  Signal
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];

const VisaoGeral = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const { eventos, isLoading, error } = useEventos();

  // Filtros
  const [periodo, setPeriodo] = useState("30");
  const [uf, setUf] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [tipoEvento, setTipoEvento] = useState("todos");

  // Verificar autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Extrair opções dinâmicas dos dados
  const filterOptions = useMemo(() => {
    const ufs = new Set<string>();
    const planos = new Set<string>();
    const tiposEvento = new Set<string>();

    eventos.forEach((e: Evento) => {
      if (e.cliente_uf) ufs.add(e.cliente_uf);
      if (e.plano_nome) planos.add(e.plano_nome);
      if (e.event_type) tiposEvento.add(e.event_type);
    });

    return {
      ufs: Array.from(ufs).sort(),
      planos: Array.from(planos).sort(),
      tiposEvento: Array.from(tiposEvento).sort(),
    };
  }, [eventos]);

  // Filtrar eventos por período
  const filteredEventos = useMemo(() => {
    let filtered = [...eventos] as Evento[];

    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasAtras);

      filtered = filtered.filter((e) => {
        if (!e.event_datetime) return true;
        return new Date(e.event_datetime) >= dataLimite;
      });
    }

    if (uf !== "todos") {
      filtered = filtered.filter((e) => e.cliente_uf === uf);
    }

    if (plano !== "todos") {
      filtered = filtered.filter((e) => e.plano_nome === plano);
    }

    if (tipoEvento !== "todos") {
      filtered = filtered.filter((e) => e.event_type === tipoEvento);
    }

    return filtered;
  }, [eventos, periodo, uf, plano, tipoEvento]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    const clientesUnicos = new Set(filteredEventos.map(e => e.cliente_id)).size;
    const eventosTotal = filteredEventos.length;
    
    // Eventos por tipo
    const eventosCobranca = filteredEventos.filter(e => e.event_type === "COBRANCA");
    const eventosAtendimento = filteredEventos.filter(e => e.event_type === "ATENDIMENTO");
    const eventosRede = filteredEventos.filter(e => e.event_type === "REDE");
    const eventosNPS = filteredEventos.filter(e => e.event_type === "NPS");
    
    // MRR (soma dos valores de mensalidade únicos por cliente)
    const clientesMRR: Record<number, number> = {};
    filteredEventos.forEach(e => {
      if (e.valor_mensalidade && !clientesMRR[e.cliente_id]) {
        clientesMRR[e.cliente_id] = e.valor_mensalidade;
      }
    });
    const mrrTotal = Object.values(clientesMRR).reduce((acc, val) => acc + val, 0);

    // Inadimplência
    const cobrancasVencidas = eventosCobranca.filter(e => e.vencido === true || e.dias_atraso > 0);
    const valorInadimplente = cobrancasVencidas.reduce((acc, e) => acc + (e.valor_cobranca || 0), 0);
    
    // Clientes em risco de churn
    const clientesChurnRisco = filteredEventos.filter(e => 
      e.churn_risk_score !== undefined && e.churn_risk_score >= 50
    );
    const clientesChurnCritico = filteredEventos.filter(e => 
      e.churn_risk_score !== undefined && e.churn_risk_score >= 75
    );

    // NPS médio
    const npsScores = filteredEventos
      .filter(e => e.nps_score !== undefined && e.nps_score !== null)
      .map(e => e.nps_score!);
    const npsMedia = npsScores.length > 0 
      ? (npsScores.reduce((a, b) => a + b, 0) / npsScores.length).toFixed(1)
      : null;

    // Promotores, Neutros, Detratores
    const promotores = npsScores.filter(s => s >= 9).length;
    const neutros = npsScores.filter(s => s >= 7 && s < 9).length;
    const detratores = npsScores.filter(s => s < 7).length;
    const npsScore = npsScores.length > 0 
      ? Math.round(((promotores - detratores) / npsScores.length) * 100)
      : null;

    // Tempo médio de atendimento
    const temposAtendimento = eventosAtendimento
      .filter(e => e.tempo_atendimento_min)
      .map(e => e.tempo_atendimento_min!);
    const tmaMedia = temposAtendimento.length > 0
      ? Math.round(temposAtendimento.reduce((a, b) => a + b, 0) / temposAtendimento.length)
      : null;

    // FCR - First Call Resolution
    const atendimentosResolvidos = eventosAtendimento.filter(e => e.resolvido_primeiro_contato === true).length;
    const fcrRate = eventosAtendimento.length > 0 
      ? ((atendimentosResolvidos / eventosAtendimento.length) * 100).toFixed(1)
      : null;

    // Reincidência
    const reincidentes = eventosAtendimento.filter(e => e.reincidente_30d === true).length;
    const reincidenciaRate = eventosAtendimento.length > 0
      ? ((reincidentes / eventosAtendimento.length) * 100).toFixed(1)
      : null;

    // LTV médio
    const ltvValues = filteredEventos
      .filter(e => e.ltv_reais_estimado)
      .map(e => e.ltv_reais_estimado!);
    const ltvMedio = ltvValues.length > 0
      ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length
      : null;

    return {
      clientesAtivos: clientesUnicos,
      eventosTotal,
      eventosCobranca: eventosCobranca.length,
      eventosAtendimento: eventosAtendimento.length,
      eventosRede: eventosRede.length,
      eventosNPS: eventosNPS.length,
      mrrTotal,
      valorInadimplente,
      clientesChurnRisco: new Set(clientesChurnRisco.map(e => e.cliente_id)).size,
      clientesChurnCritico: new Set(clientesChurnCritico.map(e => e.cliente_id)).size,
      npsScore,
      npsMedia,
      tmaMedia,
      fcrRate,
      reincidenciaRate,
      ltvMedio,
      cobrancasVencidas: cobrancasVencidas.length,
    };
  }, [filteredEventos]);

  // Dados para gráficos
  const chartData = useMemo(() => {
    const eventosPorDia: Record<string, { total: number; cobranca: number; atendimento: number; rede: number }> = {};
    
    filteredEventos.forEach(e => {
      if (!e.event_datetime) return;
      
      const dia = new Date(e.event_datetime).toISOString().split("T")[0];
      if (!eventosPorDia[dia]) {
        eventosPorDia[dia] = { total: 0, cobranca: 0, atendimento: 0, rede: 0 };
      }
      
      eventosPorDia[dia].total++;
      
      if (e.event_type === "COBRANCA") eventosPorDia[dia].cobranca++;
      if (e.event_type === "ATENDIMENTO") eventosPorDia[dia].atendimento++;
      if (e.event_type === "REDE") eventosPorDia[dia].rede++;
    });

    return Object.entries(eventosPorDia)
      .map(([data, valores]) => ({
        data: new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        ...valores
      }))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-30);
  }, [filteredEventos]);

  // Distribuição por tipo de evento
  const distribuicaoTipoEvento = useMemo(() => {
    const contagem: Record<string, number> = {};
    
    filteredEventos.forEach(e => {
      const tipo = e.event_type || "Outros";
      contagem[tipo] = (contagem[tipo] || 0) + 1;
    });

    return Object.entries(contagem)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEventos]);

  // Distribuição de Churn Risk
  const distribuicaoChurnRisk = useMemo(() => {
    const buckets: Record<string, number> = { "Baixo": 0, "Médio": 0, "Alto": 0, "Crítico": 0 };
    const clientesProcessados = new Set<number>();
    
    filteredEventos.forEach(e => {
      if (e.churn_risk_bucket && !clientesProcessados.has(e.cliente_id)) {
        buckets[e.churn_risk_bucket] = (buckets[e.churn_risk_bucket] || 0) + 1;
        clientesProcessados.add(e.cliente_id);
      }
    });

    return Object.entries(buckets)
      .filter(([_, value]) => value > 0)
      .map(([name, value]) => ({ name, value }));
  }, [filteredEventos]);

  // Top categorias de atendimento
  const topCategorias = useMemo(() => {
    const contagem: Record<string, number> = {};
    
    filteredEventos
      .filter(e => e.event_type === "ATENDIMENTO" && e.categoria)
      .forEach(e => {
        contagem[e.categoria!] = (contagem[e.categoria!] || 0) + 1;
      });

    return Object.entries(contagem)
      .map(([categoria, quantidade]) => ({ categoria, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [filteredEventos]);

  // Fila de risco
  const filaRisco = useMemo(() => {
    const clientesMap: Record<number, Evento> = {};
    
    // Pegar último evento de cada cliente
    filteredEventos
      .filter(e => e.churn_risk_score !== undefined && e.churn_risk_score >= 40)
      .forEach(e => {
        if (!clientesMap[e.cliente_id] || 
            new Date(e.event_datetime) > new Date(clientesMap[e.cliente_id].event_datetime)) {
          clientesMap[e.cliente_id] = e;
        }
      });

    return Object.values(clientesMap)
      .map(e => ({
        cliente_id: e.cliente_id,
        cliente_nome: e.cliente_nome,
        plano: e.plano_nome,
        cidade: e.cliente_cidade,
        uf: e.cliente_uf,
        score: e.churn_risk_score || 0,
        nivel: e.churn_risk_bucket || "Médio",
        dias_atraso: e.dias_atraso || 0,
        valor_mensalidade: e.valor_mensalidade,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }, [filteredEventos]);

  const filaRiscoColumns: Column<typeof filaRisco[0]>[] = [
    { key: "cliente_nome", label: "Cliente" },
    { key: "plano", label: "Plano" },
    { key: "cidade", label: "Cidade" },
    { key: "score", label: "Score", render: (item) => `${item.score}%` },
    { key: "nivel", label: "Risco", render: (item) => <RiskBadge level={item.nivel} /> },
    { key: "dias_atraso", label: "Dias Atraso" },
    { key: "valor_mensalidade", label: "Mensalidade", render: (item) => `R$ ${item.valor_mensalidade?.toFixed(2) || "0"}` },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const filters = [
    {
      id: "periodo",
      label: "Período",
      value: periodo,
      onChange: setPeriodo,
      options: [
        { value: "7", label: "Últimos 7 dias" },
        { value: "30", label: "Últimos 30 dias" },
        { value: "90", label: "Últimos 90 dias" },
        { value: "365", label: "Último ano" },
        { value: "todos", label: "Todo período" },
      ],
    },
    {
      id: "uf",
      label: "UF",
      value: uf,
      onChange: setUf,
      disabled: filterOptions.ufs.length === 0,
      options: [
        { value: "todos", label: "Todas" },
        ...filterOptions.ufs.map(u => ({ value: u, label: u })),
      ],
    },
    {
      id: "plano",
      label: "Plano",
      value: plano,
      onChange: setPlano,
      disabled: filterOptions.planos.length === 0,
      options: [
        { value: "todos", label: "Todos" },
        ...filterOptions.planos.map(p => ({ value: p, label: p })),
      ],
    },
    {
      id: "tipoEvento",
      label: "Tipo Evento",
      value: tipoEvento,
      onChange: setTipoEvento,
      disabled: filterOptions.tiposEvento.length === 0,
      options: [
        { value: "todos", label: "Todos" },
        ...filterOptions.tiposEvento.map(t => ({ value: t, label: t })),
      ],
    },
  ];

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Visão Geral
              </h1>
              <p className="text-muted-foreground mt-1">Command Center - Métricas Executivas</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {filteredEventos.length.toLocaleString()} eventos | {kpis.clientesAtivos.toLocaleString()} clientes
              </div>
              <Button variant="outline" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Carregando eventos...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Erro ao carregar dados</h3>
                <p className="text-muted-foreground">{error}</p>
              </div>
            </div>
          </div>
        ) : eventos.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Nenhum evento encontrado</h3>
                <p className="text-muted-foreground">Verifique o isp_id configurado</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filtros Globais */}
            <GlobalFilters filters={filters} />

            {/* KPIs Linha 1 - Volumes */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <KPICardNew
                title="Clientes Ativos"
                value={kpis.clientesAtivos.toLocaleString()}
                icon={Users}
                variant="default"
              />
              <KPICardNew
                title="Total Eventos"
                value={kpis.eventosTotal.toLocaleString()}
                icon={Activity}
                variant="info"
              />
              <KPICardNew
                title="Cobranças"
                value={kpis.eventosCobranca.toLocaleString()}
                icon={CreditCard}
                variant="warning"
              />
              <KPICardNew
                title="Atendimentos"
                value={kpis.eventosAtendimento.toLocaleString()}
                icon={FileText}
                variant="info"
              />
              <KPICardNew
                title="Eventos Rede"
                value={kpis.eventosRede.toLocaleString()}
                icon={Signal}
                variant="danger"
              />
              <KPICardNew
                title="Pesquisas NPS"
                value={kpis.eventosNPS.toLocaleString()}
                icon={ThumbsUp}
                variant="success"
              />
            </div>

            {/* KPIs Linha 2 - Financeiro */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <KPICardNew
                title="MRR Total"
                value={`R$ ${kpis.mrrTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={DollarSign}
                variant="success"
              />
              <KPICardNew
                title="Inadimplência"
                value={`R$ ${kpis.valorInadimplente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={AlertTriangle}
                variant="danger"
              />
              <KPICardNew
                title="Cobranças Vencidas"
                value={kpis.cobrancasVencidas.toLocaleString()}
                icon={Clock}
                variant="warning"
              />
              <KPICardNew
                title="LTV Médio"
                value={kpis.ltvMedio ? `R$ ${kpis.ltvMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "N/A"}
                icon={TrendingUp}
                variant="info"
              />
              <KPICardNew
                title="Ticket Médio"
                value={kpis.clientesAtivos > 0 ? `R$ ${(kpis.mrrTotal / kpis.clientesAtivos).toFixed(2)}` : "N/A"}
                icon={Target}
                variant="default"
              />
            </div>

            {/* KPIs Linha 3 - Risco e Qualidade */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <KPICardNew
                title="Clientes em Risco"
                value={kpis.clientesChurnRisco.toLocaleString()}
                icon={AlertTriangle}
                variant="warning"
              />
              <KPICardNew
                title="Risco Crítico"
                value={kpis.clientesChurnCritico.toLocaleString()}
                icon={AlertCircle}
                variant="danger"
              />
              <KPICardNew
                title="NPS Score"
                value={kpis.npsScore !== null ? kpis.npsScore : "N/A"}
                icon={ThumbsUp}
                variant={kpis.npsScore !== null && kpis.npsScore >= 50 ? "success" : kpis.npsScore !== null && kpis.npsScore >= 0 ? "warning" : "danger"}
              />
              <KPICardNew
                title="TMA (min)"
                value={kpis.tmaMedia !== null ? kpis.tmaMedia : "N/A"}
                icon={Clock}
                variant="info"
              />
              <KPICardNew
                title="FCR (%)"
                value={kpis.fcrRate !== null ? `${kpis.fcrRate}%` : "N/A"}
                icon={Target}
                variant="success"
              />
              <KPICardNew
                title="Reincidência"
                value={kpis.reincidenciaRate !== null ? `${kpis.reincidenciaRate}%` : "N/A"}
                icon={TrendingDown}
                variant="warning"
              />
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Evolução de Eventos */}
              <Card>
                <CardHeader>
                  <CardTitle>📈 Evolução de Eventos</CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="data" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} />
                        <Line type="monotone" dataKey="cobranca" name="Cobrança" stroke="#eab308" strokeWidth={2} />
                        <Line type="monotone" dataKey="atendimento" name="Atendimento" stroke="#22c55e" strokeWidth={2} />
                        <Line type="monotone" dataKey="rede" name="Rede" stroke="#ef4444" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Dados insuficientes</p>
                  )}
                </CardContent>
              </Card>

              {/* Distribuição por Tipo */}
              <Card>
                <CardHeader>
                  <CardTitle>📊 Distribuição por Tipo de Evento</CardTitle>
                </CardHeader>
                <CardContent>
                  {distribuicaoTipoEvento.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={distribuicaoTipoEvento}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {distribuicaoTipoEvento.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Dados insuficientes</p>
                  )}
                </CardContent>
              </Card>

              {/* Distribuição de Risco de Churn */}
              <Card>
                <CardHeader>
                  <CardTitle>⚠️ Distribuição de Risco de Churn</CardTitle>
                </CardHeader>
                <CardContent>
                  {distribuicaoChurnRisk.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={distribuicaoChurnRisk} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="name" type="category" fontSize={12} width={80} />
                        <Tooltip />
                        <Bar dataKey="value" name="Clientes" fill="#ef4444" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Dados de risco não disponíveis</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Categorias de Atendimento */}
              <Card>
                <CardHeader>
                  <CardTitle>📋 Top Categorias de Atendimento</CardTitle>
                </CardHeader>
                <CardContent>
                  {topCategorias.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topCategorias} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="categoria" type="category" fontSize={10} width={120} />
                        <Tooltip />
                        <Bar dataKey="quantidade" name="Atendimentos" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Dados de atendimento não disponíveis</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Fila de Risco */}
            <Card>
              <CardHeader>
                <CardTitle>🚨 Fila de Risco - Clientes com Maior Score de Churn</CardTitle>
              </CardHeader>
              <CardContent>
                {filaRisco.length > 0 ? (
                  <DataTable columns={filaRiscoColumns} data={filaRisco} />
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum cliente em risco identificado no período
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default VisaoGeral;
