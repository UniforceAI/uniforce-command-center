import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEventos } from "@/hooks/useEventos";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { DataTable, StatusBadge, Column } from "@/components/shared/DataTable";
import { FAIXAS_AGING } from "@/types/evento";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  CreditCard,
  Calendar,
  Percent,
  Clock
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
  const [user, setUser] = useState<User | null>(null);
  const { eventos, isLoading, error, columns } = useEventos();

  // Filtros
  const [periodo, setPeriodo] = useState("30");
  const [plano, setPlano] = useState("todos");
  const [metodo, setMetodo] = useState("todos");

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

  // Filtrar eventos financeiros
  const eventosFinanceiros = useMemo(() => {
    return eventos.filter(e => {
      const tipo = (e.tipo_evento || e.tipo || e.categoria || "").toLowerCase();
      return tipo.includes("financ") || 
             tipo.includes("pagamento") || 
             tipo.includes("cobranca") ||
             tipo.includes("fatura") ||
             tipo.includes("boleto") ||
             tipo.includes("inadimpl") ||
             e.valor !== undefined;
    });
  }, [eventos]);

  // Extrair opções dinâmicas
  const filterOptions = useMemo(() => {
    const planos = new Set<string>();
    const metodos = new Set<string>();

    eventosFinanceiros.forEach((e) => {
      if (e.plano) planos.add(e.plano);
      if (e.plano_atual) planos.add(e.plano_atual);
      if (e.metodo_pagamento) metodos.add(e.metodo_pagamento);
      if (e.forma_pagamento) metodos.add(e.forma_pagamento);
    });

    return {
      planos: Array.from(planos).sort(),
      metodos: Array.from(metodos).sort(),
    };
  }, [eventosFinanceiros]);

  // Filtrar por período
  const filteredEventos = useMemo(() => {
    let filtered = [...eventosFinanceiros];

    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const dataLimite = new Date();
      dataLimite.setDate(dataLimite.getDate() - diasAtras);

      filtered = filtered.filter((e) => {
        const dataEvento = e.data_evento || e.created_at || e.data || e.vencimento;
        if (!dataEvento) return true;
        return new Date(dataEvento) >= dataLimite;
      });
    }

    if (plano !== "todos") {
      filtered = filtered.filter((e) => (e.plano || e.plano_atual) === plano);
    }

    if (metodo !== "todos") {
      filtered = filtered.filter((e) => (e.metodo_pagamento || e.forma_pagamento) === metodo);
    }

    return filtered;
  }, [eventosFinanceiros, periodo, plano, metodo]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    const temValor = filteredEventos.some(e => e.valor !== undefined);
    const temDiasAtraso = filteredEventos.some(e => e.dias_atraso !== undefined);
    const temStatus = filteredEventos.some(e => e.status !== undefined);

    // Contar por status (tentativas genéricas)
    const vencidos = filteredEventos.filter(e => {
      const status = (e.status || "").toLowerCase();
      return status.includes("vencid") || status.includes("atrasad") || 
             (e.dias_atraso && Number(e.dias_atraso) > 0);
    });

    const recuperados = filteredEventos.filter(e => {
      const status = (e.status || "").toLowerCase();
      return status.includes("recuperad") || status.includes("pago") || status.includes("quitad");
    });

    const emAberto = filteredEventos.filter(e => {
      const status = (e.status || "").toLowerCase();
      return status.includes("aberto") || status.includes("pendente") || status.includes("aguard");
    });

    // Valores
    const valorVencido = temValor 
      ? vencidos.reduce((acc, e) => acc + (Number(e.valor) || 0), 0)
      : null;
    
    const valorRecuperado = temValor
      ? recuperados.reduce((acc, e) => acc + (Number(e.valor) || 0), 0)
      : null;

    const valorAberto = temValor
      ? emAberto.reduce((acc, e) => acc + (Number(e.valor) || 0), 0)
      : null;

    const taxaRecuperacao = valorVencido && valorRecuperado
      ? ((valorRecuperado / (valorVencido + valorRecuperado)) * 100).toFixed(1)
      : null;

    return {
      totalEventos: filteredEventos.length,
      cobrancasAbertas: { 
        valor: emAberto.length, 
        disponivel: temStatus,
        tooltip: "Campo 'status' não encontrado"
      },
      cobrancasVencidas: { 
        valor: vencidos.length, 
        disponivel: temStatus || temDiasAtraso,
        tooltip: "Campo 'status' ou 'dias_atraso' não encontrado"
      },
      valorAberto: {
        valor: valorAberto !== null ? `R$ ${valorAberto.toLocaleString("pt-BR")}` : "Indisponível",
        disponivel: valorAberto !== null,
        tooltip: "Campo 'valor' não encontrado"
      },
      valorVencido: {
        valor: valorVencido !== null ? `R$ ${valorVencido.toLocaleString("pt-BR")}` : "Indisponível",
        disponivel: valorVencido !== null,
        tooltip: "Campo 'valor' não encontrado"
      },
      valorRecuperado: {
        valor: valorRecuperado !== null ? `R$ ${valorRecuperado.toLocaleString("pt-BR")}` : "Indisponível",
        disponivel: valorRecuperado !== null,
        tooltip: "Campo 'valor' não encontrado"
      },
      taxaRecuperacao: {
        valor: taxaRecuperacao !== null ? `${taxaRecuperacao}%` : "Indisponível",
        disponivel: taxaRecuperacao !== null,
        tooltip: "Necessário campo 'valor' e 'status'"
      },
    };
  }, [filteredEventos]);

  // Aging (dias de atraso)
  const agingData = useMemo(() => {
    const temDiasAtraso = filteredEventos.some(e => e.dias_atraso !== undefined);
    if (!temDiasAtraso) return [];

    const faixas = FAIXAS_AGING.map(faixa => ({
      faixa: faixa.label,
      quantidade: 0,
      valor: 0,
    }));

    filteredEventos.forEach(e => {
      const dias = Number(e.dias_atraso) || 0;
      if (dias <= 0) return;

      const faixaIndex = FAIXAS_AGING.findIndex(f => dias >= f.min && dias <= f.max);
      if (faixaIndex >= 0) {
        faixas[faixaIndex].quantidade++;
        faixas[faixaIndex].valor += Number(e.valor) || 0;
      }
    });

    return faixas.filter(f => f.quantidade > 0);
  }, [filteredEventos]);

  // Vencido por plano
  const vencidoPorPlano = useMemo(() => {
    const porPlano: Record<string, { quantidade: number; valor: number }> = {};

    filteredEventos
      .filter(e => {
        const status = (e.status || "").toLowerCase();
        return status.includes("vencid") || (e.dias_atraso && Number(e.dias_atraso) > 0);
      })
      .forEach(e => {
        const plano = e.plano || e.plano_atual || "Sem plano";
        if (!porPlano[plano]) {
          porPlano[plano] = { quantidade: 0, valor: 0 };
        }
        porPlano[plano].quantidade++;
        porPlano[plano].valor += Number(e.valor) || 0;
      });

    return Object.entries(porPlano)
      .map(([plano, data]) => ({ plano, ...data }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [filteredEventos]);

  // Fila de cobrança
  const filaCobranca = useMemo(() => {
    return filteredEventos
      .filter(e => {
        const status = (e.status || "").toLowerCase();
        return status.includes("vencid") || status.includes("aberto") || 
               (e.dias_atraso && Number(e.dias_atraso) > 0);
      })
      .map(e => ({
        cliente_id: e.cliente_id || e.id_cliente,
        cliente_nome: e.cliente_nome || e.nome_cliente || `Cliente ${e.cliente_id || e.id_cliente}`,
        plano: e.plano || e.plano_atual || "N/A",
        status: e.status || "Vencido",
        vencimento: e.vencimento || e.data_vencimento || e.data_evento || "N/A",
        valor: e.valor ? `R$ ${Number(e.valor).toLocaleString("pt-BR")}` : "N/A",
        metodo: e.metodo_pagamento || e.forma_pagamento || "N/A",
        atraso: e.dias_atraso ? `${e.dias_atraso} dias` : "N/A",
      }))
      .sort((a, b) => {
        const diasA = parseInt(a.atraso) || 0;
        const diasB = parseInt(b.atraso) || 0;
        return diasB - diasA;
      })
      .slice(0, 20);
  }, [filteredEventos]);

  const filaCobrancaColumns: Column<typeof filaCobranca[0]>[] = [
    { key: "cliente_nome", label: "Cliente" },
    { key: "plano", label: "Plano" },
    { key: "status", label: "Status", render: (item) => <StatusBadge status={item.status} /> },
    { key: "vencimento", label: "Vencimento" },
    { key: "valor", label: "Valor" },
    { key: "metodo", label: "Método" },
    { key: "atraso", label: "Atraso" },
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
  ];

  if (!user) return null;

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
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <KPICardNew
                title="Total Eventos"
                value={kpis.totalEventos}
                icon={DollarSign}
                variant="default"
              />
              <KPICardNew
                title="Cobranças Abertas"
                value={kpis.cobrancasAbertas.valor}
                disponivel={kpis.cobrancasAbertas.disponivel}
                tooltip={kpis.cobrancasAbertas.tooltip}
                icon={Clock}
                variant="warning"
              />
              <KPICardNew
                title="Cobranças Vencidas"
                value={kpis.cobrancasVencidas.valor}
                disponivel={kpis.cobrancasVencidas.disponivel}
                tooltip={kpis.cobrancasVencidas.tooltip}
                icon={Calendar}
                variant="danger"
              />
              <KPICardNew
                title="R$ em Aberto"
                value={kpis.valorAberto.valor}
                disponivel={kpis.valorAberto.disponivel}
                tooltip={kpis.valorAberto.tooltip}
                icon={CreditCard}
                variant="warning"
              />
              <KPICardNew
                title="R$ Vencido"
                value={kpis.valorVencido.valor}
                disponivel={kpis.valorVencido.disponivel}
                tooltip={kpis.valorVencido.tooltip}
                icon={TrendingDown}
                variant="danger"
              />
              <KPICardNew
                title="R$ Recuperado"
                value={kpis.valorRecuperado.valor}
                disponivel={kpis.valorRecuperado.disponivel}
                tooltip={kpis.valorRecuperado.tooltip}
                icon={TrendingUp}
                variant="success"
              />
              <KPICardNew
                title="Taxa Recuperação"
                value={kpis.taxaRecuperacao.valor}
                disponivel={kpis.taxaRecuperacao.disponivel}
                tooltip={kpis.taxaRecuperacao.tooltip}
                icon={Percent}
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
              <Card>
                <CardHeader>
                  <CardTitle>📊 Vencido por Plano</CardTitle>
                </CardHeader>
                <CardContent>
                  {vencidoPorPlano.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={vencidoPorPlano} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" fontSize={12} />
                        <YAxis dataKey="plano" type="category" fontSize={12} width={100} />
                        <Tooltip />
                        <Bar dataKey="quantidade" fill="#f97316" name="Quantidade" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      Dados insuficientes para ranking por plano
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Fila de Cobrança */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-orange-500" />
                  Fila de Cobrança Inteligente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  data={filaCobranca}
                  columns={filaCobrancaColumns}
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
