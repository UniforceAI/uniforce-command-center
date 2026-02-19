import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEventos } from "@/hooks/useEventos";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { DataTable, RiskBadge, Column } from "@/components/shared/DataTable";
import { Evento } from "@/types/evento";
import { 
  Users, 
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  DollarSign,
  Wifi,
  RefreshCcw,
  ThumbsDown,
  Zap,
  Shield,
  UserCheck,
  RotateCcw,
  Clock,
  Percent,
  Target
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444"];

const ChurnRetencao = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { eventos, isLoading, error } = useEventos();

  // Filtros
  const [periodo, setPeriodo] = useState("7");
  const [uf, setUf] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [riscoBucket, setRiscoBucket] = useState("todos");

  // Extrair opções dinâmicas
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

  // Filtrar eventos
  const filteredEventos = useMemo(() => {
    let filtered = [...eventos] as Evento[];

    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      
      // Calcular data limite relativa ao registro mais recente
      let maxDate = new Date(0);
      filtered.forEach((e) => {
        const d = e.event_datetime ? new Date(e.event_datetime) : null;
        if (d && !isNaN(d.getTime()) && d > maxDate) maxDate = d;
      });
      if (maxDate.getTime() === 0) maxDate = new Date();
      
      const dataLimite = new Date(maxDate);
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

    return filtered;
  }, [eventos, periodo, uf, plano]);

  // Agrupar por cliente - pegar último registro de cada um
  const clientesUnicos = useMemo(() => {
    const clientesMap: Record<number, Evento> = {};
    
    filteredEventos.forEach(e => {
      if (!clientesMap[e.cliente_id] || 
          new Date(e.event_datetime) > new Date(clientesMap[e.cliente_id].event_datetime)) {
        clientesMap[e.cliente_id] = e;
      }
    });

    return Object.values(clientesMap);
  }, [filteredEventos]);

  // Clientes filtrados por bucket de risco
  const clientesFiltrados = useMemo(() => {
    if (riscoBucket === "todos") return clientesUnicos;
    return clientesUnicos.filter(c => c.churn_risk_bucket === riscoBucket);
  }, [clientesUnicos, riscoBucket]);

  // KPIs
  const kpis = useMemo(() => {
    const totalClientes = clientesUnicos.length;
    
    // Clientes por bucket de risco
    const clientesBaixo = clientesUnicos.filter(c => c.churn_risk_bucket === "Baixo").length;
    const clientesMedio = clientesUnicos.filter(c => c.churn_risk_bucket === "Médio").length;
    const clientesAlto = clientesUnicos.filter(c => c.churn_risk_bucket === "Alto").length;
    const clientesCritico = clientesUnicos.filter(c => c.churn_risk_bucket === "Crítico").length;
    
    const clientesEmRisco = clientesAlto + clientesCritico;
    const percentualRisco = totalClientes > 0 ? ((clientesEmRisco / totalClientes) * 100).toFixed(1) : "0";

    // MRR em risco (clientes alto + crítico)
    const mrrEmRisco = clientesUnicos
      .filter(c => c.churn_risk_bucket === "Alto" || c.churn_risk_bucket === "Crítico")
      .reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);

    // LTV em risco
    const ltvEmRisco = clientesUnicos
      .filter(c => c.churn_risk_bucket === "Alto" || c.churn_risk_bucket === "Crítico")
      .reduce((acc, c) => acc + (c.ltv_reais_estimado || 0), 0);

    // Score médio de churn
    const scoresChurn = clientesUnicos
      .filter(c => c.churn_risk_score !== undefined)
      .map(c => c.churn_risk_score!);
    const churnScoreMedio = scoresChurn.length > 0
      ? (scoresChurn.reduce((a, b) => a + b, 0) / scoresChurn.length).toFixed(1)
      : null;

    // Inadimplência associada
    const clientesInadimplentes = clientesUnicos.filter(c => c.dias_atraso > 0).length;
    const valorInadimplente = clientesUnicos
      .filter(c => c.dias_atraso > 0)
      .reduce((acc, c) => acc + (c.valor_cobranca || c.valor_mensalidade || 0), 0);

    // Detratores NPS
    const clientesDetratores = clientesUnicos.filter(c => c.nps_score !== undefined && c.nps_score < 7).length;

    return {
      totalClientes,
      clientesEmRisco,
      percentualRisco,
      clientesBaixo,
      clientesMedio,
      clientesAlto,
      clientesCritico,
      mrrEmRisco,
      ltvEmRisco,
      churnScoreMedio,
      clientesInadimplentes,
      valorInadimplente,
      clientesDetratores,
    };
  }, [clientesUnicos]);

  // Distribuição de Risco
  const distribuicaoRisco = useMemo(() => {
    return [
      { name: "Baixo", value: kpis.clientesBaixo, color: "#22c55e" },
      { name: "Médio", value: kpis.clientesMedio, color: "#eab308" },
      { name: "Alto", value: kpis.clientesAlto, color: "#f97316" },
      { name: "Crítico", value: kpis.clientesCritico, color: "#ef4444" },
    ].filter(d => d.value > 0);
  }, [kpis]);

  // Top ações recomendadas
  const topAcoes = useMemo(() => {
    const contagem: Record<string, number> = {};
    
    clientesFiltrados.forEach(c => {
      if (c.acao_recomendada_1) contagem[c.acao_recomendada_1] = (contagem[c.acao_recomendada_1] || 0) + 1;
      if (c.acao_recomendada_2) contagem[c.acao_recomendada_2] = (contagem[c.acao_recomendada_2] || 0) + 1;
      if (c.acao_recomendada_3) contagem[c.acao_recomendada_3] = (contagem[c.acao_recomendada_3] || 0) + 1;
    });

    return Object.entries(contagem)
      .map(([acao, quantidade]) => ({ acao, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [clientesFiltrados]);

  // Top alertas
  const topAlertas = useMemo(() => {
    const contagem: Record<string, number> = {};
    
    clientesFiltrados.forEach(c => {
      if (c.alerta_tipo) contagem[c.alerta_tipo] = (contagem[c.alerta_tipo] || 0) + 1;
    });

    return Object.entries(contagem)
      .map(([alerta, quantidade]) => ({ alerta, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 8);
  }, [clientesFiltrados]);

  // Evolução de score por UF
  const scorePorUF = useMemo(() => {
    const ufMap: Record<string, { total: number; soma: number }> = {};
    
    clientesUnicos.forEach(c => {
      if (c.cliente_uf && c.churn_risk_score !== undefined) {
        if (!ufMap[c.cliente_uf]) ufMap[c.cliente_uf] = { total: 0, soma: 0 };
        ufMap[c.cliente_uf].total++;
        ufMap[c.cliente_uf].soma += c.churn_risk_score;
      }
    });

    return Object.entries(ufMap)
      .map(([uf, data]) => ({
        uf,
        score_medio: Math.round(data.soma / data.total),
        clientes: data.total,
      }))
      .sort((a, b) => b.score_medio - a.score_medio)
      .slice(0, 10);
  }, [clientesUnicos]);

  // Fila de risco
  const filaRisco = useMemo(() => {
    return clientesFiltrados
      .filter(c => c.churn_risk_score !== undefined && c.churn_risk_score >= 40)
      .sort((a, b) => (b.churn_risk_score || 0) - (a.churn_risk_score || 0))
      .slice(0, 20)
      .map(c => ({
        cliente_id: c.cliente_id,
        cliente_nome: c.cliente_nome,
        plano: c.plano_nome,
        cidade: c.cliente_cidade,
        uf: c.cliente_uf,
        score: c.churn_risk_score || 0,
        bucket: c.churn_risk_bucket || "N/A",
        dias_atraso: c.dias_atraso || 0,
        valor_mensalidade: c.valor_mensalidade,
        ltv: c.ltv_reais_estimado,
        alerta: c.alerta_tipo,
        acao: c.acao_recomendada_1,
      }));
  }, [clientesFiltrados]);

  const filaRiscoColumns: Column<typeof filaRisco[0]>[] = [
    { key: "cliente_nome", label: "Cliente" },
    { key: "plano", label: "Plano" },
    { key: "cidade", label: "Cidade" },
    { key: "score", label: "Score", render: (item) => `${item.score}%` },
    { key: "bucket", label: "Risco", render: (item) => <RiskBadge level={item.bucket} /> },
    { key: "dias_atraso", label: "Dias Atraso" },
    { key: "valor_mensalidade", label: "MRR", render: (item) => `R$ ${(item.valor_mensalidade || 0).toFixed(2)}` },
    { key: "ltv", label: "LTV", render: (item) => item.ltv ? `R$ ${item.ltv.toLocaleString()}` : "N/A" },
    { key: "alerta", label: "Alerta" },
    { key: "acao", label: "Ação Recomendada" },
  ];

  // Playbooks baseados nos dados
  const playbooks = [
    {
      id: "critico",
      title: "🔴 Risco Crítico",
      color: "text-red-500 bg-red-100",
      descricao: "Clientes com score ≥ 75% - Ação imediata necessária",
      clientes: kpis.clientesCritico,
      mrrEmRisco: clientesUnicos
        .filter(c => c.churn_risk_bucket === "Crítico")
        .reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0),
    },
    {
      id: "alto",
      title: "🟠 Risco Alto",
      color: "text-orange-500 bg-orange-100",
      descricao: "Clientes com score 50-74% - Monitorar de perto",
      clientes: kpis.clientesAlto,
      mrrEmRisco: clientesUnicos
        .filter(c => c.churn_risk_bucket === "Alto")
        .reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0),
    },
    {
      id: "inadimplente",
      title: "💰 Inadimplentes",
      color: "text-yellow-500 bg-yellow-100",
      descricao: "Clientes com dias de atraso > 0",
      clientes: kpis.clientesInadimplentes,
      mrrEmRisco: kpis.valorInadimplente,
    },
    {
      id: "detrator",
      title: "👎 Detratores NPS",
      color: "text-purple-500 bg-purple-100",
      descricao: "Clientes com NPS < 7",
      clientes: kpis.clientesDetratores,
      mrrEmRisco: clientesUnicos
        .filter(c => c.nps_score !== undefined && c.nps_score < 7)
        .reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0),
    },
  ];

  const handleLogout = async () => {
    await signOut();
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
      id: "risco",
      label: "Nível de Risco",
      value: riscoBucket,
      onChange: setRiscoBucket,
      options: [
        { value: "todos", label: "Todos" },
        { value: "Crítico", label: "Crítico" },
        { value: "Alto", label: "Alto" },
        { value: "Médio", label: "Médio" },
        { value: "Baixo", label: "Baixo" },
      ],
    },
  ];

  

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Churn & Retenção
              </h1>
              <p className="text-muted-foreground mt-1">Análise de Risco e Ações de Retenção</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {clientesFiltrados.length.toLocaleString()} clientes analisados
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
              <p className="text-muted-foreground">Analisando risco de churn...</p>
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
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Nenhum evento encontrado</h3>
                <p className="text-muted-foreground">Verifique o isp_id configurado</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <GlobalFilters filters={filters} />

            {/* KPIs Principais */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <KPICardNew
                title="Total Clientes"
                value={kpis.totalClientes.toLocaleString()}
                icon={Users}
                variant="default"
              />
              <KPICardNew
                title="Em Risco"
                value={kpis.clientesEmRisco.toLocaleString()}
                icon={AlertTriangle}
                variant="danger"
              />
              <KPICardNew
                title="% em Risco"
                value={`${kpis.percentualRisco}%`}
                icon={Percent}
                variant="warning"
              />
              <KPICardNew
                title="Score Médio"
                value={kpis.churnScoreMedio || "N/A"}
                icon={Target}
                variant="info"
              />
              <KPICardNew
                title="MRR em Risco"
                value={`R$ ${kpis.mrrEmRisco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={DollarSign}
                variant="danger"
              />
              <KPICardNew
                title="LTV em Risco"
                value={`R$ ${kpis.ltvEmRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`}
                icon={TrendingDown}
                variant="warning"
              />
            </div>

            {/* KPIs de Buckets */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KPICardNew
                title="🟢 Risco Baixo"
                value={kpis.clientesBaixo.toLocaleString()}
                icon={Shield}
                variant="success"
              />
              <KPICardNew
                title="🟡 Risco Médio"
                value={kpis.clientesMedio.toLocaleString()}
                icon={AlertCircle}
                variant="warning"
              />
              <KPICardNew
                title="🟠 Risco Alto"
                value={kpis.clientesAlto.toLocaleString()}
                icon={AlertTriangle}
                variant="warning"
              />
              <KPICardNew
                title="🔴 Risco Crítico"
                value={kpis.clientesCritico.toLocaleString()}
                icon={Zap}
                variant="danger"
              />
            </div>

            {/* Playbooks */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {playbooks.map((pb) => (
                <Card key={pb.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">{pb.title}</CardTitle>
                    <CardDescription>{pb.descricao}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Clientes:</span>
                        <span className="font-bold">{pb.clientes.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MRR em Risco:</span>
                        <span className="font-bold text-destructive">
                          R$ {pb.mrrEmRisco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribuição de Risco */}
              <Card>
                <CardHeader>
                  <CardTitle>📊 Distribuição de Risco de Churn</CardTitle>
                </CardHeader>
                <CardContent>
                  {distribuicaoRisco.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={distribuicaoRisco}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {distribuicaoRisco.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Dados de risco não disponíveis</p>
                  )}
                </CardContent>
              </Card>

              {/* Score por UF */}
              <Card>
                <CardHeader>
                  <CardTitle>🗺️ Score Médio de Churn por UF</CardTitle>
                </CardHeader>
                <CardContent>
                  {scorePorUF.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={scorePorUF} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 100]} fontSize={12} />
                        <YAxis dataKey="uf" type="category" fontSize={12} width={50} />
                        <Tooltip formatter={(value) => `${value}%`} />
                        <Bar dataKey="score_medio" name="Score Médio" fill="#ef4444" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Dados por UF não disponíveis</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Ações Recomendadas */}
              <Card>
                <CardHeader>
                  <CardTitle>🎯 Top Ações Recomendadas</CardTitle>
                </CardHeader>
                <CardContent>
                  {topAcoes.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topAcoes} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="acao" type="category" fontSize={10} width={150} />
                        <Tooltip />
                        <Bar dataKey="quantidade" name="Clientes" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Ações não disponíveis</p>
                  )}
                </CardContent>
              </Card>

              {/* Top Alertas */}
              <Card>
                <CardHeader>
                  <CardTitle>⚠️ Top Tipos de Alerta</CardTitle>
                </CardHeader>
                <CardContent>
                  {topAlertas.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topAlertas} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="alerta" type="category" fontSize={10} width={150} />
                        <Tooltip />
                        <Bar dataKey="quantidade" name="Clientes" fill="#f97316" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Alertas não disponíveis</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Fila de Risco */}
            <Card>
              <CardHeader>
                <CardTitle>🚨 Fila de Ação - Clientes em Risco</CardTitle>
                <CardDescription>
                  Clientes ordenados por score de churn - priorize ações de retenção
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filaRisco.length > 0 ? (
                  <DataTable columns={filaRiscoColumns} data={filaRisco} />
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum cliente em risco identificado com os filtros atuais
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

export default ChurnRetencao;
