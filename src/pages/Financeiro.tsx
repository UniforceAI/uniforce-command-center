import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEventos } from "@/hooks/useEventos";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { DataTable, StatusBadge, Column } from "@/components/shared/DataTable";
import { ExpandableCobrancaTable, ClienteAgrupado, Cobranca } from "@/components/shared/ExpandableCobrancaTable";
import { FAIXAS_AGING } from "@/types/evento";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CreditCard,
  Calendar,
  Percent,
  Clock,
  Users,
  ArrowUpDown
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

const Financeiro = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { eventos, isLoading, error, columns } = useEventos();

  // Filtros
  const [periodo, setPeriodo] = useState("7");
  const [plano, setPlano] = useState("todos");
  const [metodo, setMetodo] = useState("todos");
  const [filial, setFilial] = useState("todos");
  const [ordemPlanoDecrescente, setOrdemPlanoDecrescente] = useState(true);


  // Filtrar eventos financeiros (COBRANCA ou SNAPSHOT com dados de cobrança)
  const eventosFinanceiros = useMemo(() => {
    return eventos.filter(e => 
      e.event_type === "COBRANCA" || 
      (e.event_type === "SNAPSHOT" && (e.cobranca_status || e.valor_cobranca || e.data_vencimento))
    );
  }, [eventos]);

  // Extrair opções dinâmicas
  const filterOptions = useMemo(() => {
    const planos = new Set<string>();
    const metodos = new Set<string>();
    const statusCobranca = new Set<string>();
    const filiais = new Set<string>();

    eventosFinanceiros.forEach((e) => {
      if (e.plano_nome) planos.add(e.plano_nome);
      if (e.metodo_cobranca) metodos.add(e.metodo_cobranca);
      if (e.cobranca_status) statusCobranca.add(e.cobranca_status);
      if (e.filial_id !== null && e.filial_id !== undefined) filiais.add(String(e.filial_id));
    });

    return {
      planos: Array.from(planos).sort(),
      metodos: Array.from(metodos).sort(),
      statusCobranca: Array.from(statusCobranca).sort(),
      filiais: Array.from(filiais).sort((a, b) => Number(a) - Number(b)),
    };
  }, [eventosFinanceiros]);

  // Filtrar por período - usa data_vencimento para cobranças
  const filteredEventos = useMemo(() => {
    let filtered = [...eventosFinanceiros];

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
        // Usar event_datetime como data principal
        const dateToCheck = e.event_datetime ? new Date(e.event_datetime) : 
                           e.created_at ? new Date(e.created_at) : null;
        if (!dateToCheck || isNaN(dateToCheck.getTime())) return true;
        return dateToCheck >= dataLimite;
      });
    }

    if (plano !== "todos") {
      filtered = filtered.filter((e) => e.plano_nome === plano);
    }

    if (metodo !== "todos") {
      filtered = filtered.filter((e) => e.metodo_cobranca === metodo);
    }

    if (filial !== "todos") {
      filtered = filtered.filter((e) => String(e.filial_id) === filial);
    }

    return filtered;
  }, [eventosFinanceiros, periodo, plano, metodo, filial]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    // Clientes únicos
    const clientesUnicos = new Set(filteredEventos.map(e => e.cliente_id)).size;
    
    // Cobranças por status usando os campos reais
    const vencidos = filteredEventos.filter(e => e.vencido === true || e.dias_atraso > 0);
    const aVencer = filteredEventos.filter(e => e.cobranca_status === "A Vencer" && !e.vencido);
    const pagos = filteredEventos.filter(e => e.data_pagamento || e.cobranca_status === "Pago");
    
    // CLIENTES únicos com vencido (para consistência com o mapa)
    const clientesVencidosMap = new Map<number, any>();
    vencidos.forEach(e => {
      if (!clientesVencidosMap.has(e.cliente_id)) {
        clientesVencidosMap.set(e.cliente_id, e);
      }
    });
    const clientesVencidos = clientesVencidosMap.size;
    
    // Valores usando valor_cobranca
    const valorVencido = vencidos.reduce((acc, e) => acc + (e.valor_cobranca || e.valor_mensalidade || 0), 0);
    const valorAVencer = aVencer.reduce((acc, e) => acc + (e.valor_cobranca || e.valor_mensalidade || 0), 0);
    const valorPago = pagos.reduce((acc, e) => acc + (e.valor_pago || e.valor_cobranca || 0), 0);
    const valorTotal = filteredEventos.reduce((acc, e) => acc + (e.valor_cobranca || e.valor_mensalidade || 0), 0);
    
    // Taxa de inadimplência baseada em CLIENTES, não cobranças
    const taxaInadimplencia = clientesUnicos > 0 
      ? ((clientesVencidos / clientesUnicos) * 100).toFixed(1) 
      : "0";
    
    // Taxa de recuperação (pagos vs vencidos históricos)
    const taxaRecuperacao = (valorVencido + valorPago) > 0
      ? ((valorPago / (valorVencido + valorPago)) * 100).toFixed(1)
      : "0";
    
    // Aging - distribuição por dias de atraso
    const aging = {
      ate7: vencidos.filter(e => e.dias_atraso >= 1 && e.dias_atraso <= 7).length,
      ate15: vencidos.filter(e => e.dias_atraso >= 8 && e.dias_atraso <= 15).length,
      ate30: vencidos.filter(e => e.dias_atraso >= 16 && e.dias_atraso <= 30).length,
      ate60: vencidos.filter(e => e.dias_atraso >= 31 && e.dias_atraso <= 60).length,
      mais60: vencidos.filter(e => e.dias_atraso > 60).length,
    };
    
    // Ticket médio
    const ticketMedio = filteredEventos.length > 0 
      ? valorTotal / filteredEventos.length 
      : 0;

    return {
      totalCobrancas: filteredEventos.length,
      clientesUnicos,
      clientesVencidos, // NOVO: clientes únicos vencidos (igual ao mapa)
      cobrancasVencidas: vencidos.length, // cobranças vencidas
      aVencer: aVencer.length,
      pagos: pagos.length,
      valorVencido,
      valorAVencer,
      valorPago,
      valorTotal,
      taxaInadimplencia,
      taxaRecuperacao,
      aging,
      ticketMedio,
    };
  }, [filteredEventos]);

  // Aging (dias de atraso)
  const agingData = useMemo(() => {
    const faixas = FAIXAS_AGING.map(faixa => ({
      faixa: faixa.label,
      quantidade: 0,
      valor: 0,
    }));

    filteredEventos.forEach(e => {
      const dias = e.dias_atraso || 0;
      if (dias <= 0) return;

      const faixaIndex = FAIXAS_AGING.findIndex(f => dias >= f.min && dias <= f.max);
      if (faixaIndex >= 0) {
        faixas[faixaIndex].quantidade++;
        faixas[faixaIndex].valor += e.valor_cobranca || e.valor_mensalidade || 0;
      }
    });

    return faixas.filter(f => f.quantidade > 0);
  }, [filteredEventos]);

  // Vencido por plano - base sem limite
  const vencidoPorPlanoBase = useMemo(() => {
    const porPlano: Record<string, { quantidade: number; valor: number }> = {};

    filteredEventos
      .filter(e => e.vencido === true || e.dias_atraso > 0)
      .forEach(e => {
        const planoNome = e.plano_nome || "Sem plano";
        if (!porPlano[planoNome]) {
          porPlano[planoNome] = { quantidade: 0, valor: 0 };
        }
        porPlano[planoNome].quantidade++;
        porPlano[planoNome].valor += e.valor_cobranca || e.valor_mensalidade || 0;
      });

    return Object.entries(porPlano)
      .map(([plano, data]) => ({ plano, ...data }));
  }, [filteredEventos]);

  // Ordenar vencido por plano com base no estado (filtra itens com valor > 0)
  const vencidoPorPlano = useMemo(() => {
    return [...vencidoPorPlanoBase]
      .filter(p => p.valor > 0)
      .sort((a, b) => 
        ordemPlanoDecrescente ? b.valor - a.valor : a.valor - b.valor
      );
  }, [vencidoPorPlanoBase, ordemPlanoDecrescente]);

  // Por método de cobrança
  const porMetodo = useMemo(() => {
    const metodos: Record<string, { quantidade: number; valor: number }> = {};

    filteredEventos.forEach(e => {
      const metodo = e.metodo_cobranca || "Não informado";
      if (!metodos[metodo]) {
        metodos[metodo] = { quantidade: 0, valor: 0 };
      }
      metodos[metodo].quantidade++;
      metodos[metodo].valor += e.valor_cobranca || e.valor_mensalidade || 0;
    });

    return Object.entries(metodos)
      .map(([metodo, data]) => ({ metodo, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [filteredEventos]);

  // Fila de cobrança - agrupa por cliente, deduplicando por data+valor (mesma cobrança real)
  const filaCobranca = useMemo((): ClienteAgrupado[] => {
    const clientesMap = new Map<number, ClienteAgrupado>();
    const cobrancasVistas = new Set<string>();
    
    // Filtrar eventos vencidos (COBRANCA)
    const eventosVencidos = filteredEventos.filter(e => 
      e.event_type === "COBRANCA" && (e.vencido === true || e.dias_atraso > 0)
    );
    
    // Ordenar por dias_atraso DESC para pegar o registro mais recente de cada cobrança
    const sorted = [...eventosVencidos].sort((a, b) => (b.dias_atraso || 0) - (a.dias_atraso || 0));
    
    sorted.forEach(e => {
      // CHAVE ÚNICA: cliente + data de vencimento + valor arredondado
      // Isso identifica a mesma cobrança real, independente de quantos registros existam no banco
      const cobrancaKey = `${e.cliente_id}_${e.data_vencimento}_${Math.round(e.valor_cobranca || e.valor_mensalidade || 0)}`;
      
      // Pular se já processamos essa cobrança (mantém o primeiro = maior atraso)
      if (cobrancasVistas.has(cobrancaKey)) return;
      cobrancasVistas.add(cobrancaKey);
      
      const vencimentoDate = e.data_vencimento ? new Date(e.data_vencimento) : null;
      const cobranca: Cobranca = {
        cliente_id: e.cliente_id,
        cliente_nome: e.cliente_nome,
        plano: e.plano_nome || "Sem plano",
        status: e.cobranca_status,
        vencimento: vencimentoDate ? vencimentoDate.toLocaleDateString("pt-BR") : "N/A",
        vencimentoDate,
        valor: e.valor_cobranca || e.valor_mensalidade || 0,
        metodo: e.metodo_cobranca || "N/A",
        dias_atraso: e.dias_atraso || 0,
        celular: e.cliente_celular || "N/A",
        email: e.cliente_email,
      };
      
      const existing = clientesMap.get(e.cliente_id);
      if (existing) {
        existing.cobrancas.push(cobranca);
        existing.totalValor += cobranca.valor;
        existing.maiorAtraso = Math.max(existing.maiorAtraso, cobranca.dias_atraso);
      } else {
        clientesMap.set(e.cliente_id, {
          cliente_id: e.cliente_id,
          cliente_nome: e.cliente_nome,
          celular: e.cliente_celular || "N/A",
          email: e.cliente_email,
          cobrancas: [cobranca],
          totalValor: cobranca.valor,
          maiorAtraso: cobranca.dias_atraso,
        });
      }
    });
    
    return Array.from(clientesMap.values())
      .sort((a, b) => b.maiorAtraso - a.maiorAtraso);
  }, [filteredEventos]);

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
        { value: "14", label: "Últimos 14 dias" },
        { value: "30", label: "Últimos 30 dias" },
        { value: "60", label: "Últimos 60 dias" },
        { value: "todos", label: "Todo período" },
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
      id: "metodo",
      label: "Método Pagamento",
      value: metodo,
      onChange: setMetodo,
      disabled: filterOptions.metodos.length === 0,
      tooltip: "Campo método de pagamento não encontrado",
      options: [
        { value: "todos", label: "Todos" },
        ...filterOptions.metodos.map(m => ({ value: m, label: m })),
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
  ];

  

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Financeiro
              </h1>
              <p className="text-muted-foreground mt-1">Inadimplência e Recuperação</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-muted-foreground">
                {filteredEventos.length} eventos financeiros
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
              <p className="text-muted-foreground">Carregando dados financeiros...</p>
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
        ) : eventosFinanceiros.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Nenhum evento financeiro encontrado</h3>
                <p className="text-muted-foreground">
                  Não foram identificados eventos com tipo financeiro, pagamento ou cobrança
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <GlobalFilters filters={filters} />

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICardNew
                title="Total Cobranças"
                value={kpis.totalCobrancas.toLocaleString()}
                icon={DollarSign}
                variant="default"
              />
              <KPICardNew
                title="Clientes"
                value={kpis.clientesUnicos.toLocaleString()}
                icon={Users}
                variant="info"
              />
              <KPICardNew
                title="Clientes Vencidos"
                value={kpis.clientesVencidos.toLocaleString()}
                subtitle={`${kpis.cobrancasVencidas} cobranças`}
                icon={Calendar}
                variant="danger"
              />
              <KPICardNew
                title="R$ Vencido"
                value={`R$ ${kpis.valorVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={TrendingDown}
                variant="danger"
              />
              <KPICardNew
                title="% Inadimplência"
                value={`${kpis.taxaInadimplencia}%`}
                icon={Percent}
                variant="danger"
              />
              <KPICardNew
                title="Ticket Médio"
                value={`R$ ${kpis.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={TrendingUp}
                variant="info"
              />
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Aging */}
              <Card>
                <CardHeader>
                  <CardTitle>📊 Aging (Dias de Atraso)</CardTitle>
                </CardHeader>
                <CardContent>
                  {agingData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={agingData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="faixa" fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip />
                        <Bar dataKey="quantidade" fill="#ef4444" name="Quantidade" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Dados insuficientes - campo 'dias_atraso' não encontrado
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Vencido por Plano */}
              <Card className="flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
                  <CardTitle className="text-base font-medium">📊 Vencido por Plano</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setOrdemPlanoDecrescente(!ordemPlanoDecrescente)}
                    className="h-8 gap-1 text-xs"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    {ordemPlanoDecrescente ? "Maior valor" : "Menor valor"}
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col">
                  {vencidoPorPlano.length > 0 ? (
                    <div className="overflow-y-auto flex-1 max-h-[280px]">
                      <div style={{ height: Math.max(250, vencidoPorPlano.length * 36) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={vencidoPorPlano} layout="vertical" margin={{ right: 60, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              type="number" 
                              fontSize={11} 
                              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                              orientation="top"
                            />
                            <YAxis 
                              dataKey="plano" 
                              type="category" 
                              fontSize={10} 
                              width={120} 
                              tick={{ fontSize: 10 }}
                              tickFormatter={(value) => value.length > 18 ? `${value.substring(0, 18)}...` : value}
                            />
                            <Tooltip 
                              formatter={(v) => [`R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 'Valor Vencido']}
                              labelFormatter={(label) => label}
                            />
                            <Bar dataKey="valor" fill="#f97316" name="Valor Vencido" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Nenhuma cobrança vencida
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Gráficos Linha 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Por Método de Cobrança */}
              <Card>
                <CardHeader>
                  <CardTitle>💳 Por Método de Cobrança</CardTitle>
                </CardHeader>
                <CardContent>
                  {porMetodo.length > 0 ? (
                    <div className="space-y-3">
                      {porMetodo.map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <span className="font-medium">{m.metodo}</span>
                            <span className="text-muted-foreground ml-2">({m.quantidade} cobranças)</span>
                          </div>
                          <span className="font-semibold">R$ {m.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Sem dados de métodos
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Resumo por Status */}
              <Card>
                <CardHeader>
                  <CardTitle>📋 Resumo por Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Pagos</p>
                      <p className="text-2xl font-bold text-green-600">{kpis.pagos.toLocaleString()}</p>
                      <p className="text-sm text-green-600">R$ {kpis.valorPago.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">A Vencer</p>
                      <p className="text-2xl font-bold text-yellow-600">{kpis.aVencer.toLocaleString()}</p>
                      <p className="text-sm text-yellow-600">R$ {kpis.valorAVencer.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Vencidos</p>
                      <p className="text-2xl font-bold text-red-600">{kpis.clientesVencidos.toLocaleString()}</p>
                      <p className="text-sm text-red-600">R$ {kpis.valorVencido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                    <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Total Geral</p>
                      <p className="text-2xl font-bold text-blue-600">{kpis.totalCobrancas.toLocaleString()}</p>
                      <p className="text-sm text-blue-600">R$ {kpis.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Fila de Cobrança */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-500" />
                  Fila de Cobrança Inteligente
                  <Badge variant="secondary" className="ml-2">
                    {filaCobranca.length} clientes
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ExpandableCobrancaTable
                  data={filaCobranca}
                  emptyMessage="Nenhuma cobrança pendente identificada"
                  actions={[
                    { label: "Ver detalhes", onClick: (item) => console.log("Detalhes:", item) },
                    { label: "Marcar em negociação", onClick: (item) => console.log("Negociação:", item) },
                    { label: "Gerar lembrete", onClick: (item) => console.log("Lembrete:", item) },
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

export default Financeiro;
