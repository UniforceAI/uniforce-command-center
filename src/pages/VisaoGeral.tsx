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
  AlertCircle
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

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

const VisaoGeral = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const { eventos, isLoading, error, columns } = useEventos();

  // Filtros
  const [periodo, setPeriodo] = useState("30");
  const [uf, setUf] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [statusFiltro, setStatusFiltro] = useState("todos");

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
    const statuses = new Set<string>();

    eventos.forEach((e) => {
      if (e.uf) ufs.add(e.uf);
      if (e.estado) ufs.add(e.estado);
      if (e.plano) planos.add(e.plano);
      if (e.plano_atual) planos.add(e.plano_atual);
      if (e.status) statuses.add(e.status);
    });

    return {
      ufs: Array.from(ufs).sort(),
      planos: Array.from(planos).sort(),
      statuses: Array.from(statuses).sort(),
    };
  }, [eventos]);

  // Filtrar eventos por período
  const filteredEventos = useMemo(() => {
    let filtered = [...eventos];

    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasAtras);

      filtered = filtered.filter((e) => {
        const dataEvento = e.data_evento || e.created_at || e.data;
        if (!dataEvento) return true;
        return new Date(dataEvento) >= dataLimite;
      });
    }

    if (uf !== "todos") {
      filtered = filtered.filter((e) => (e.uf || e.estado) === uf);
    }

    if (plano !== "todos") {
      filtered = filtered.filter((e) => (e.plano || e.plano_atual) === plano);
    }

    return filtered;
  }, [eventos, periodo, uf, plano]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    const clientesUnicos = new Set(filteredEventos.map(e => e.cliente_id || e.id_cliente)).size;
    const eventosTotal = filteredEventos.length;
    
    // Tentar identificar eventos por tipo
    const eventosFinanceiro = filteredEventos.filter(e => 
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("financ") ||
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("pagamento") ||
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("cobranca")
    );
    
    const eventosRede = filteredEventos.filter(e => 
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("rede") ||
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("instabilidade") ||
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("conexao") ||
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("sinal")
    );

    const eventosSuporte = filteredEventos.filter(e => 
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("suporte") ||
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("chamado") ||
      (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase().includes("os")
    );

    // Tentar calcular valores monetários
    const temValor = filteredEventos.some(e => e.valor !== undefined && e.valor !== null);
    const valorTotal = temValor 
      ? filteredEventos.reduce((acc, e) => acc + (Number(e.valor) || 0), 0)
      : null;

    // Clientes em risco (heurística: muitos eventos = risco)
    const eventosPorCliente: Record<string, number> = {};
    filteredEventos.forEach(e => {
      const clienteId = String(e.cliente_id || e.id_cliente || "unknown");
      eventosPorCliente[clienteId] = (eventosPorCliente[clienteId] || 0) + 1;
    });
    
    const clientesEmRisco = Object.entries(eventosPorCliente)
      .filter(([_, count]) => count >= 3)
      .length;

    return {
      clientesAtivos: { valor: clientesUnicos, disponivel: true },
      eventosTotal: { valor: eventosTotal, disponivel: true },
      eventosFinanceiro: { valor: eventosFinanceiro.length, disponivel: true },
      eventosRede: { valor: eventosRede.length, disponivel: true },
      eventosSuporte: { valor: eventosSuporte.length, disponivel: true },
      mrrTotal: { 
        valor: valorTotal !== null ? `R$ ${valorTotal.toLocaleString("pt-BR")}` : "Indisponível", 
        disponivel: valorTotal !== null,
        tooltip: "Campo 'valor' não encontrado nos eventos"
      },
      clientesEmRisco: { valor: clientesEmRisco, disponivel: true },
      mrrEmRisco: { 
        valor: "Indisponível", 
        disponivel: false,
        tooltip: "Necessário campo 'valor_plano' para calcular"
      },
    };
  }, [filteredEventos]);

  // Dados para gráficos
  const chartData = useMemo(() => {
    // Agrupar por data
    const eventosPorDia: Record<string, { total: number; financeiro: number; rede: number; suporte: number }> = {};
    
    filteredEventos.forEach(e => {
      const data = e.data_evento || e.created_at || e.data;
      if (!data) return;
      
      const dia = new Date(data).toISOString().split("T")[0];
      if (!eventosPorDia[dia]) {
        eventosPorDia[dia] = { total: 0, financeiro: 0, rede: 0, suporte: 0 };
      }
      
      eventosPorDia[dia].total++;
      
      const tipo = (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase();
      if (tipo.includes("financ") || tipo.includes("pagamento")) {
        eventosPorDia[dia].financeiro++;
      }
      if (tipo.includes("rede") || tipo.includes("instabilidade")) {
        eventosPorDia[dia].rede++;
      }
      if (tipo.includes("suporte") || tipo.includes("chamado")) {
        eventosPorDia[dia].suporte++;
      }
    });

    return Object.entries(eventosPorDia)
      .map(([data, valores]) => ({
        data: new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        ...valores
      }))
      .sort((a, b) => a.data.localeCompare(b.data))
      .slice(-30); // Últimos 30 dias
  }, [filteredEventos]);

  // Distribuição por categoria
  const distribuicaoCategoria = useMemo(() => {
    const contagem: Record<string, number> = {};
    
    filteredEventos.forEach(e => {
      const cat = e.categoria || e.tipo_evento || e.tipo || "Outros";
      contagem[cat] = (contagem[cat] || 0) + 1;
    });

    return Object.entries(contagem)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredEventos]);

  // Fila de risco
  const filaRisco = useMemo(() => {
    const eventosPorCliente: Record<string, { eventos: typeof filteredEventos; count: number }> = {};
    
    filteredEventos.forEach(e => {
      const clienteId = String(e.cliente_id || e.id_cliente || "unknown");
      if (!eventosPorCliente[clienteId]) {
        eventosPorCliente[clienteId] = { eventos: [], count: 0 };
      }
      eventosPorCliente[clienteId].eventos.push(e);
      eventosPorCliente[clienteId].count++;
    });

    return Object.entries(eventosPorCliente)
      .filter(([_, data]) => data.count >= 2)
      .map(([clienteId, data]) => {
        const ultimoEvento = data.eventos[0];
        const score = Math.min(data.count * 20, 100);
        return {
          cliente_id: clienteId,
          cliente_nome: ultimoEvento.cliente_nome || ultimoEvento.nome_cliente || `Cliente ${clienteId}`,
          plano: ultimoEvento.plano || ultimoEvento.plano_atual || "N/A",
          cidade: ultimoEvento.cidade || ultimoEvento.uf || "N/A",
          score,
          nivel: score >= 80 ? "Crítico" : score >= 60 ? "Alto" : score >= 40 ? "Médio" : "Baixo",
          motivo: `${data.count} eventos no período`,
          qtd_eventos: data.count,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [filteredEventos]);

  const filaRiscoColumns: Column<typeof filaRisco[0]>[] = [
    { key: "cliente_nome", label: "Cliente" },
    { key: "plano", label: "Plano" },
    { key: "cidade", label: "Local" },
    { key: "score", label: "Score", render: (item) => `${item.score}%` },
    { key: "nivel", label: "Risco", render: (item) => <RiskBadge level={item.nivel} /> },
    { key: "motivo", label: "Motivo" },
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
      label: "UF/Região",
      value: uf,
      onChange: setUf,
      disabled: filterOptions.ufs.length === 0,
      tooltip: "Campo UF/Estado não encontrado nos dados",
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
      tooltip: "Campo Plano não encontrado nos dados",
      options: [
        { value: "todos", label: "Todos" },
        ...filterOptions.planos.map(p => ({ value: p, label: p })),
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
                {filteredEventos.length} eventos | {columns.length} colunas detectadas
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
            {/* Debug: Mostrar colunas disponíveis */}
            {columns.length > 0 && (
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium mb-2">📋 Colunas detectadas na tabela eventos:</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {columns.join(", ")}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Filtros Globais */}
            <GlobalFilters filters={filters} />

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              <KPICardNew
                title="Clientes Ativos"
                value={kpis.clientesAtivos.valor}
                icon={Users}
                variant="default"
              />
              <KPICardNew
                title="Total Eventos"
                value={kpis.eventosTotal.valor}
                icon={Activity}
                variant="info"
              />
              <KPICardNew
                title="Eventos Financeiro"
                value={kpis.eventosFinanceiro.valor}
                icon={DollarSign}
                variant="warning"
              />
              <KPICardNew
                title="Eventos Rede"
                value={kpis.eventosRede.valor}
                icon={Wifi}
                variant="danger"
              />
              <KPICardNew
                title="Eventos Suporte"
                value={kpis.eventosSuporte.valor}
                icon={FileText}
                variant="default"
              />
              <KPICardNew
                title="Clientes em Risco"
                value={kpis.clientesEmRisco.valor}
                icon={AlertTriangle}
                variant="danger"
              />
              <KPICardNew
                title="MRR Total"
                value={kpis.mrrTotal.valor}
                disponivel={kpis.mrrTotal.disponivel}
                tooltip={kpis.mrrTotal.tooltip}
                icon={DollarSign}
                variant="success"
              />
              <KPICardNew
                title="MRR em Risco"
                value={kpis.mrrEmRisco.valor}
                disponivel={kpis.mrrEmRisco.disponivel}
                tooltip={kpis.mrrEmRisco.tooltip}
                icon={TrendingDown}
                variant="danger"
              />
            </div>

            {/* Gráficos com Tabs */}
            <Card>
              <CardHeader>
                <CardTitle>📊 Evolução e Distribuição</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="evolucao">
                  <TabsList className="mb-4">
                    <TabsTrigger value="evolucao">Evolução</TabsTrigger>
                    <TabsTrigger value="distribuicao">Distribuição</TabsTrigger>
                    <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
                    <TabsTrigger value="rede">Rede</TabsTrigger>
                    <TabsTrigger value="suporte">Suporte</TabsTrigger>
                  </TabsList>

                  <TabsContent value="evolucao">
                    {chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="data" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="total" name="Total" stroke="#3b82f6" strokeWidth={2} />
                          <Line type="monotone" dataKey="financeiro" name="Financeiro" stroke="#eab308" strokeWidth={2} />
                          <Line type="monotone" dataKey="rede" name="Rede" stroke="#ef4444" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">Dados insuficientes para gráfico</p>
                    )}
                  </TabsContent>

                  <TabsContent value="distribuicao">
                    {distribuicaoCategoria.length > 0 ? (
                      <div className="flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={distribuicaoCategoria} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" fontSize={12} />
                            <YAxis dataKey="name" type="category" fontSize={12} width={120} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#3b82f6" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">Dados insuficientes para gráfico</p>
                    )}
                  </TabsContent>

                  <TabsContent value="financeiro">
                    <p className="text-center text-muted-foreground py-8">
                      Ver tela Financeiro para detalhes de inadimplência
                    </p>
                  </TabsContent>

                  <TabsContent value="rede">
                    <p className="text-center text-muted-foreground py-8">
                      {kpis.eventosRede.valor} eventos de rede/instabilidade no período
                    </p>
                  </TabsContent>

                  <TabsContent value="suporte">
                    <p className="text-center text-muted-foreground py-8">
                      {kpis.eventosSuporte.valor} eventos de suporte no período
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Fila de Risco */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Fila de Risco (Top 10)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={filaRisco}
                  columns={filaRiscoColumns}
                  emptyMessage="Nenhum cliente em risco identificado"
                  actions={[
                    { label: "Ver detalhes", onClick: (item) => console.log("Detalhes:", item) },
                    { label: "Abrir chamado", onClick: (item) => console.log("Chamado:", item) },
                  ]}
                />
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default VisaoGeral;
