import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEventos } from "@/hooks/useEventos";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { DataTable, RiskBadge, Column } from "@/components/shared/DataTable";
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
  RotateCcw
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
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const ChurnRetencao = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const { eventos, isLoading, error, columns } = useEventos();

  // Filtros
  const [periodo, setPeriodo] = useState("30");
  const [uf, setUf] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [driver, setDriver] = useState("todos");

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

  // Extrair opções dinâmicas
  const filterOptions = useMemo(() => {
    const ufs = new Set<string>();
    const planos = new Set<string>();

    eventos.forEach((e) => {
      if (e.uf) ufs.add(e.uf);
      if (e.estado) ufs.add(e.estado);
      if (e.plano) planos.add(e.plano);
      if (e.plano_atual) planos.add(e.plano_atual);
    });

    return {
      ufs: Array.from(ufs).sort(),
      planos: Array.from(planos).sort(),
    };
  }, [eventos]);

  // Filtrar eventos
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

  // Classificar eventos por driver de churn
  const classificarDriver = (evento: any): string => {
    const tipo = (evento.tipo_evento || evento.tipo || evento.categoria || "").toLowerCase();
    const motivo = (evento.motivo || evento.descricao || "").toLowerCase();

    if (tipo.includes("financ") || tipo.includes("pagamento") || tipo.includes("cobranca") || 
        motivo.includes("inadimpl") || motivo.includes("pagamento")) {
      return "Financeiro";
    }
    if (tipo.includes("rede") || tipo.includes("instabilidade") || tipo.includes("conexao") ||
        tipo.includes("sinal") || motivo.includes("lento") || motivo.includes("queda")) {
      return "Rede/Instabilidade";
    }
    if (tipo.includes("nps") || tipo.includes("detrator") || motivo.includes("insatisf")) {
      return "NPS Detrator";
    }
    return "Outro";
  };

  // Agrupar por cliente e calcular score de risco
  const clientesComRisco = useMemo(() => {
    const porCliente: Record<string, {
      eventos: typeof filteredEventos;
      drivers: Record<string, number>;
      ultimoEvento: any;
    }> = {};

    filteredEventos.forEach(e => {
      const clienteId = String(e.cliente_id || e.id_cliente || "unknown");
      if (!porCliente[clienteId]) {
        porCliente[clienteId] = { eventos: [], drivers: {}, ultimoEvento: e };
      }
      porCliente[clienteId].eventos.push(e);
      
      const driver = classificarDriver(e);
      porCliente[clienteId].drivers[driver] = (porCliente[clienteId].drivers[driver] || 0) + 1;

      // Atualizar último evento
      const dataAtual = new Date(porCliente[clienteId].ultimoEvento.data_evento || porCliente[clienteId].ultimoEvento.created_at || 0);
      const dataNovo = new Date(e.data_evento || e.created_at || 0);
      if (dataNovo > dataAtual) {
        porCliente[clienteId].ultimoEvento = e;
      }
    });

    return Object.entries(porCliente).map(([clienteId, data]) => {
      const qtdEventos = data.eventos.length;
      const driverPrincipal = Object.entries(data.drivers)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || "Outro";
      
      // Score baseado em quantidade de eventos e drivers
      const scoreBase = Math.min(qtdEventos * 15, 60);
      const scoreDriver = driverPrincipal === "Financeiro" ? 20 : 
                          driverPrincipal === "Rede/Instabilidade" ? 15 : 
                          driverPrincipal === "NPS Detrator" ? 25 : 10;
      const scoreReincidencia = Object.keys(data.drivers).length > 1 ? 15 : 0;
      
      const score = Math.min(scoreBase + scoreDriver + scoreReincidencia, 100);
      
      return {
        cliente_id: clienteId,
        cliente_nome: data.ultimoEvento.cliente_nome || data.ultimoEvento.nome_cliente || `Cliente ${clienteId}`,
        plano: data.ultimoEvento.plano || data.ultimoEvento.plano_atual || "N/A",
        cidade: data.ultimoEvento.cidade || data.ultimoEvento.uf || "N/A",
        qtd_eventos: qtdEventos,
        driver_principal: driverPrincipal,
        drivers: data.drivers,
        score,
        nivel: score >= 80 ? "Crítico" : score >= 60 ? "Alto" : score >= 40 ? "Médio" : "Baixo",
        valor_plano: data.ultimoEvento.valor_plano || data.ultimoEvento.valor || null,
      };
    });
  }, [filteredEventos]);

  // Filtrar por driver se selecionado
  const clientesFiltrados = useMemo(() => {
    if (driver === "todos") return clientesComRisco;
    return clientesComRisco.filter(c => c.driver_principal === driver);
  }, [clientesComRisco, driver]);

  // KPIs
  const kpis = useMemo(() => {
    const totalClientes = new Set(eventos.map(e => e.cliente_id || e.id_cliente)).size;
    const clientesEmRisco = clientesFiltrados.filter(c => c.score >= 40).length;
    const clientesCriticos = clientesFiltrados.filter(c => c.nivel === "Crítico" || c.nivel === "Alto").length;
    
    const temValorPlano = clientesFiltrados.some(c => c.valor_plano !== null);
    const mrrEmRisco = temValorPlano
      ? clientesFiltrados
          .filter(c => c.score >= 40)
          .reduce((acc, c) => acc + (Number(c.valor_plano) || 0), 0)
      : null;

    // Verificar se existe evento de cancelamento
    const temCancelamento = eventos.some(e => {
      const tipo = (e.tipo_evento || e.tipo || "").toLowerCase();
      return tipo.includes("cancel") || tipo.includes("rescis") || tipo.includes("churn");
    });

    const cancelamentos = temCancelamento
      ? eventos.filter(e => {
          const tipo = (e.tipo_evento || e.tipo || "").toLowerCase();
          return tipo.includes("cancel") || tipo.includes("rescis") || tipo.includes("churn");
        }).length
      : null;

    const churnRate = temCancelamento && totalClientes > 0
      ? ((cancelamentos! / totalClientes) * 100).toFixed(2)
      : null;

    return {
      totalClientes: { valor: totalClientes, disponivel: true },
      clientesEmRisco: { valor: clientesEmRisco, disponivel: true },
      percentualRisco: { 
        valor: totalClientes > 0 ? `${((clientesEmRisco / totalClientes) * 100).toFixed(1)}%` : "0%", 
        disponivel: true 
      },
      churnRescisoes: { 
        valor: cancelamentos ?? "Indisponível", 
        disponivel: temCancelamento,
        tooltip: "Não existe evento de cancelamento/rescisão identificado"
      },
      mrrEmRisco: {
        valor: mrrEmRisco !== null ? `R$ ${mrrEmRisco.toLocaleString("pt-BR")}` : "Indisponível",
        disponivel: mrrEmRisco !== null,
        tooltip: "Campo 'valor_plano' não encontrado"
      },
      ltvEmRisco: {
        valor: "Indisponível",
        disponivel: false,
        tooltip: "Necessário histórico de cliente e valor de plano"
      },
      churnRate: {
        valor: churnRate !== null ? `${churnRate}%` : "Proxy: % em risco",
        disponivel: churnRate !== null,
        tooltip: temCancelamento ? undefined : "Usando % de clientes em risco como proxy (não existe evento de cancelamento)"
      },
    };
  }, [eventos, clientesFiltrados]);

  // Drivers de Churn (gráfico de barras horizontais)
  const driversData = useMemo(() => {
    const contagem: Record<string, number> = {};
    
    clientesFiltrados.forEach(c => {
      Object.entries(c.drivers).forEach(([driver, count]) => {
        contagem[driver] = (contagem[driver] || 0) + count;
      });
    });

    return Object.entries(contagem)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [clientesFiltrados]);

  // Top motivos de contato
  const topMotivos = useMemo(() => {
    const contagem: Record<string, number> = {};
    
    filteredEventos.forEach(e => {
      const motivo = e.motivo || e.categoria || e.tipo_evento || e.tipo || "Outros";
      contagem[motivo] = (contagem[motivo] || 0) + 1;
    });

    return Object.entries(contagem)
      .map(([motivo, quantidade]) => ({ motivo, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade)
      .slice(0, 10);
  }, [filteredEventos]);

  // Fila de risco
  const filaRisco = useMemo(() => {
    return clientesFiltrados
      .filter(c => c.nivel === "Crítico" || c.nivel === "Alto")
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
  }, [clientesFiltrados]);

  const filaRiscoColumns: Column<typeof filaRisco[0]>[] = [
    { key: "cliente_nome", label: "Cliente" },
    { key: "plano", label: "Plano" },
    { key: "cidade", label: "Cidade" },
    { key: "score", label: "Score", render: (item) => `${item.score}%` },
    { key: "nivel", label: "Risco", render: (item) => <RiskBadge level={item.nivel} /> },
    { key: "driver_principal", label: "Driver Principal" },
    { key: "qtd_eventos", label: "Eventos" },
  ];

  // Playbooks
  const playbooks = [
    {
      id: "rede",
      title: "Playbook Rede",
      icon: Wifi,
      color: "text-red-500 bg-red-100",
      descricao: "Ações para clientes com problemas de conexão/instabilidade",
      criterios: ["Eventos de rede/instabilidade", "Reclamações de lentidão", "Quedas frequentes"],
      acoes: [
        "Abrir OS preventiva de manutenção",
        "Monitorar conexão por 24h",
        "Priorizar diagnóstico técnico",
        "Oferecer visita técnica gratuita",
      ],
      clientes: clientesFiltrados.filter(c => c.driver_principal === "Rede/Instabilidade").length,
    },
    {
      id: "financeiro",
      title: "Playbook Financeiro",
      icon: DollarSign,
      color: "text-orange-500 bg-orange-100",
      descricao: "Ações para clientes com pendências financeiras",
      criterios: ["Atraso em pagamentos", "Múltiplas cobranças", "Negociações anteriores"],
      acoes: [
        "Oferecer PIX com desconto",
        "Propor parcelamento",
        "Avaliar bloqueio parcial",
        "Contato proativo de cobrança",
      ],
      clientes: clientesFiltrados.filter(c => c.driver_principal === "Financeiro").length,
    },
    {
      id: "experiencia",
      title: "Playbook Experiência",
      icon: UserCheck,
      color: "text-blue-500 bg-blue-100",
      descricao: "Ações para detratores NPS e insatisfação geral",
      criterios: ["NPS Detrator", "Reclamações múltiplas", "Feedback negativo"],
      acoes: [
        "Retorno imediato do supervisor",
        "Oferecer desconto de fidelização",
        "Priorizar próximo atendimento",
        "Presente/brinde de recuperação",
      ],
      clientes: clientesFiltrados.filter(c => c.driver_principal === "NPS Detrator").length,
    },
    {
      id: "reincidencia",
      title: "Playbook Reincidência",
      icon: RotateCcw,
      color: "text-purple-500 bg-purple-100",
      descricao: "Ações para clientes com múltiplos drivers",
      criterios: ["Múltiplos tipos de eventos", "Histórico recorrente", "Cliente crônico"],
      acoes: [
        "Escalar para N2/Supervisão",
        "Auditoria completa do contrato",
        "Diagnóstico técnico + comercial",
        "Proposta de upgrade/migração",
      ],
      clientes: clientesFiltrados.filter(c => Object.keys(c.drivers).length > 1).length,
    },
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
      tooltip: "Campo UF não encontrado nos dados",
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
    {
      id: "driver",
      label: "Driver",
      value: driver,
      onChange: setDriver,
      options: [
        { value: "todos", label: "Todos" },
        { value: "Financeiro", label: "Financeiro" },
        { value: "Rede/Instabilidade", label: "Rede/Instabilidade" },
        { value: "NPS Detrator", label: "NPS Detrator" },
        { value: "Outro", label: "Outro" },
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
                Churn & Retenção
              </h1>
              <p className="text-muted-foreground mt-1">Identificação e Ação sobre Risco de Churn</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {clientesFiltrados.length} clientes analisados
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

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <KPICardNew
                title="Total Clientes"
                value={kpis.totalClientes.valor}
                icon={Users}
                variant="default"
              />
              <KPICardNew
                title="Clientes em Risco"
                value={kpis.clientesEmRisco.valor}
                subtitle={kpis.percentualRisco.valor}
                icon={AlertTriangle}
                variant="danger"
              />
              <KPICardNew
                title="Churn/Rescisões"
                value={kpis.churnRescisoes.valor}
                disponivel={kpis.churnRescisoes.disponivel}
                tooltip={kpis.churnRescisoes.tooltip}
                icon={TrendingDown}
                variant="danger"
              />
              <KPICardNew
                title="MRR em Risco"
                value={kpis.mrrEmRisco.valor}
                disponivel={kpis.mrrEmRisco.disponivel}
                tooltip={kpis.mrrEmRisco.tooltip}
                icon={DollarSign}
                variant="warning"
              />
              <KPICardNew
                title="LTV em Risco"
                value={kpis.ltvEmRisco.valor}
                disponivel={kpis.ltvEmRisco.disponivel}
                tooltip={kpis.ltvEmRisco.tooltip}
                icon={TrendingDown}
                variant="warning"
              />
              <KPICardNew
                title="Churn Rate"
                value={kpis.churnRate.valor}
                disponivel={kpis.churnRate.disponivel}
                tooltip={kpis.churnRate.tooltip}
                icon={RefreshCcw}
                variant="danger"
              />
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Drivers de Churn */}
              <Card>
                <CardHeader>
                  <CardTitle>🎯 Drivers de Churn</CardTitle>
                  <CardDescription>Principais causas de risco identificadas</CardDescription>
                </CardHeader>
                <CardContent>
                  {driversData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={driversData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="name" type="category" fontSize={12} width={120} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#ef4444" name="Eventos" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Dados insuficientes para classificar drivers
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Top Motivos */}
              <Card>
                <CardHeader>
                  <CardTitle>📋 Top Motivos de Contato</CardTitle>
                  <CardDescription>Principais categorias de eventos</CardDescription>
                </CardHeader>
                <CardContent>
                  {topMotivos.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={topMotivos} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="motivo" type="category" fontSize={12} width={120} />
                        <Tooltip />
                        <Bar dataKey="quantidade" fill="#3b82f6" name="Quantidade" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Dados insuficientes
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Playbooks */}
            <div>
              <h2 className="text-xl font-bold mb-4">📚 Playbooks de Ação</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {playbooks.map((playbook) => (
                  <Dialog key={playbook.id}>
                    <DialogTrigger asChild>
                      <Card className="cursor-pointer hover:shadow-lg transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-lg ${playbook.color}`}>
                              <playbook.icon className="h-5 w-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold">{playbook.title}</h3>
                              <p className="text-xs text-muted-foreground">{playbook.clientes} clientes</p>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{playbook.descricao}</p>
                        </CardContent>
                      </Card>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <playbook.icon className="h-5 w-5" />
                          {playbook.title}
                        </DialogTitle>
                        <DialogDescription>{playbook.descricao}</DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <h4 className="font-medium mb-2">📋 Critérios de entrada:</h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {playbook.criterios.map((c, i) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">✅ Ações recomendadas:</h4>
                          <ul className="list-disc list-inside text-sm space-y-1">
                            {playbook.acoes.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-sm font-medium">
                            {playbook.clientes} clientes elegíveis para este playbook
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ))}
              </div>
            </div>

            {/* Fila de Risco */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Fila de Risco (Alto/Crítico)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={filaRisco}
                  columns={filaRiscoColumns}
                  emptyMessage="Nenhum cliente em risco alto/crítico"
                  actions={[
                    { label: "Ver detalhes", onClick: (item) => console.log("Detalhes:", item) },
                    { label: "Aplicar playbook", onClick: (item) => console.log("Playbook:", item) },
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

export default ChurnRetencao;
