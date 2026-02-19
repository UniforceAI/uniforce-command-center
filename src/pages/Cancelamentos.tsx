import { useState, useMemo } from "react";
import { useChurnData } from "@/hooks/useChurnData";
import { useEventos } from "@/hooks/useEventos";
import { IspActions } from "@/components/shared/IspActions";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Users, TrendingDown, DollarSign, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#6b7280"];

const Cancelamentos = () => {
  const { churnStatus, isLoading: churnLoading, error: churnError } = useChurnData();
  const { eventos, isLoading: eventosLoading } = useEventos();

  const [periodo, setPeriodo] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [motivo, setMotivo] = useState("todos");

  const isLoading = churnLoading || eventosLoading;

  const cancelados = useMemo(() =>
    churnStatus.filter((c) => c.status_churn === "cancelado"),
    [churnStatus]
  );

  // Total de ativos para calcular taxa
  const totalAtivos = useMemo(() =>
    churnStatus.filter((c) => c.status_churn !== "cancelado").length,
    [churnStatus]
  );

  const filterOptions = useMemo(() => {
    const planos = new Set<string>();
    const cidades = new Set<string>();
    const motivos = new Set<string>();
    cancelados.forEach((c) => {
      if (c.plano_nome) planos.add(c.plano_nome);
      if (c.cliente_cidade) cidades.add(c.cliente_cidade);
      if (c.motivo_risco_principal) motivos.add(c.motivo_risco_principal);
    });
    return { planos: Array.from(planos).sort(), cidades: Array.from(cidades).sort(), motivos: Array.from(motivos).sort() };
  }, [cancelados]);

  const filtered = useMemo(() => {
    let f = [...cancelados];

    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      let maxDate = new Date();
      f.forEach((c) => {
        if (c.data_cancelamento) {
          const d = new Date(c.data_cancelamento);
          if (d > maxDate) maxDate = d;
        }
      });
      const dataLimite = new Date(maxDate);
      dataLimite.setDate(dataLimite.getDate() - diasAtras);
      f = f.filter((c) => !c.data_cancelamento || new Date(c.data_cancelamento) >= dataLimite);
    }

    if (plano !== "todos") f = f.filter((c) => c.plano_nome === plano);
    if (cidade !== "todos") f = f.filter((c) => c.cliente_cidade === cidade);
    if (motivo !== "todos") f = f.filter((c) => c.motivo_risco_principal === motivo);

    return f.sort((a, b) => {
      const dA = a.data_cancelamento ? new Date(a.data_cancelamento).getTime() : 0;
      const dB = b.data_cancelamento ? new Date(b.data_cancelamento).getTime() : 0;
      return dB - dA;
    });
  }, [cancelados, periodo, plano, cidade, motivo]);

  const kpis = useMemo(() => {
    const totalCancelados = filtered.length;
    const totalBase = totalCancelados + totalAtivos;
    const taxaChurn = totalBase > 0 ? ((totalCancelados / totalBase) * 100).toFixed(2) : "0";
    const mrrPerdido = filtered.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    const ltvMedio = filtered.filter((c) => c.ltv_estimado != null).map((c) => c.ltv_estimado!);
    const ltvMedioVal = ltvMedio.length > 0 ? Math.round(ltvMedio.reduce((a, b) => a + b, 0) / ltvMedio.length) : 0;
    const tickets = filtered.filter((c) => c.valor_mensalidade != null).map((c) => c.valor_mensalidade!);
    const ticketMedio = tickets.length > 0 ? (tickets.reduce((a, b) => a + b, 0) / tickets.length).toFixed(2) : "0";
    return { totalCancelados, taxaChurn, mrrPerdido, ticketMedio, ltvMedioVal };
  }, [filtered, totalAtivos]);

  // Top 10 motivos
  const topMotivos = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((c) => {
      const m = c.motivo_risco_principal || "Não informado";
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map)
      .map(([motivo, qtd]) => ({ motivo, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [filtered]);

  // Cancelamentos por plano
  const cancelPorPlano = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((c) => {
      const p = c.plano_nome || "N/A";
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map)
      .map(([plano, qtd]) => ({ plano, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [filtered]);

  // Perfil comparativo: ativos vs cancelados (usando eventos para ativos)
  const comparativo = useMemo(() => {
    const ativos = churnStatus.filter((c) => c.status_churn === "ativo");

    const avg = (arr: number[]) => arr.length > 0 ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;

    return [
      {
        metric: "Cham. 90d",
        Ativos: avg(ativos.filter((c) => c.qtd_chamados_90d != null).map((c) => c.qtd_chamados_90d!)),
        Cancelados: avg(filtered.filter((c) => c.qtd_chamados_90d != null).map((c) => c.qtd_chamados_90d!)),
      },
      {
        metric: "Dias Atraso",
        Ativos: avg(ativos.filter((c) => c.dias_atraso != null).map((c) => c.dias_atraso!)),
        Cancelados: avg(filtered.filter((c) => c.dias_atraso != null).map((c) => c.dias_atraso!)),
      },
      {
        metric: "NPS",
        Ativos: avg(ativos.filter((c) => c.nps_ultimo_score != null).map((c) => c.nps_ultimo_score!)),
        Cancelados: avg(filtered.filter((c) => c.nps_ultimo_score != null).map((c) => c.nps_ultimo_score!)),
      },
      {
        metric: "Score",
        Ativos: avg(ativos.filter((c) => c.churn_risk_score != null).map((c) => c.churn_risk_score!)),
        Cancelados: avg(filtered.filter((c) => c.churn_risk_score != null).map((c) => c.churn_risk_score!)),
      },
      {
        metric: "Ticket",
        Ativos: avg(ativos.filter((c) => c.valor_mensalidade != null).map((c) => c.valor_mensalidade!)),
        Cancelados: avg(filtered.filter((c) => c.valor_mensalidade != null).map((c) => c.valor_mensalidade!)),
      },
    ];
  }, [churnStatus, filtered]);

  const filters = [
    { id: "periodo", label: "Período", value: periodo, onChange: setPeriodo, options: [{ value: "todos", label: "Todo período" }, { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" }, { value: "180", label: "Últimos 6 meses" }, { value: "365", label: "Último ano" }] },
    { id: "plano", label: "Plano", value: plano, onChange: setPlano, options: [{ value: "todos", label: "Todos" }, ...filterOptions.planos.map((p) => ({ value: p, label: p }))] },
    { id: "cidade", label: "Cidade", value: cidade, onChange: setCidade, options: [{ value: "todos", label: "Todas" }, ...filterOptions.cidades.map((c) => ({ value: c, label: c }))] },
    { id: "motivo", label: "Motivo", value: motivo, onChange: setMotivo, options: [{ value: "todos", label: "Todos" }, ...filterOptions.motivos.map((m) => ({ value: m, label: m }))] },
  ];

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">Carregando cancelamentos...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Cancelamentos
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">{cancelados.length.toLocaleString()} cancelamentos registrados</p>
            </div>
            <IspActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-6">
        {churnError && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Erro: {churnError}</span>
          </div>
        )}

        {/* Filtros */}
        <GlobalFilters filters={filters} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KPICardNew title="Total Cancelados" value={kpis.totalCancelados.toLocaleString()} icon={Users} variant="danger" />
          <KPICardNew title="Taxa de Churn" value={`${kpis.taxaChurn}%`} icon={TrendingDown} variant="danger" />
          <KPICardNew title="MRR Perdido" value={`R$ ${kpis.mrrPerdido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} variant="warning" />
          <KPICardNew title="Ticket Médio Perdido" value={`R$ ${kpis.ticketMedio}`} icon={DollarSign} variant="default" />
          <KPICardNew title="LTV Médio Perdido" value={`R$ ${kpis.ltvMedioVal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={Clock} variant="info" />
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clientes Cancelados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[420px]">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="text-xs whitespace-nowrap">Cliente</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Data Cancelamento</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Plano</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Cidade</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">Mensalidade</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Cham. 90d</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Dias Atraso</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">NPS</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Score</TableHead>
                    <TableHead className="text-xs whitespace-nowrap">Motivo</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-center">Meses Cliente</TableHead>
                    <TableHead className="text-xs whitespace-nowrap text-right">LTV</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground py-10 text-sm">
                        {churnStatus.length === 0
                          ? "Nenhum dado carregado da tabela churn_status."
                          : "Nenhum cancelamento com os filtros aplicados."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((c) => (
                      <TableRow key={c.id || c.cliente_id} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="text-xs font-medium max-w-[130px] truncate">{c.cliente_nome || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {c.data_cancelamento ? new Date(c.data_cancelamento).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-xs max-w-[100px] truncate">{c.plano_nome || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[90px] truncate">{c.cliente_cidade || "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {c.valor_mensalidade != null ? `R$ ${c.valor_mensalidade.toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs">{c.qtd_chamados_90d ?? "—"}</TableCell>
                        <TableCell className="text-center text-xs">{c.dias_atraso ?? "—"}</TableCell>
                        <TableCell className="text-center text-xs">{c.nps_ultimo_score ?? "—"}</TableCell>
                        <TableCell className="text-center text-xs">{c.churn_risk_score ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[130px] truncate text-muted-foreground">{c.motivo_risco_principal || "—"}</TableCell>
                        <TableCell className="text-center text-xs">{c.tempo_cliente_meses ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">
                          {c.ltv_estimado != null ? `R$ ${c.ltv_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Linha 3: Motivos + Por Plano */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top 10 Motivos de Cancelamento</CardTitle>
            </CardHeader>
            <CardContent>
              {topMotivos.length > 0 ? (
                <div className="max-h-[280px] overflow-y-auto">
                  <ResponsiveContainer width="100%" height={topMotivos.length * 30 + 20}>
                    <BarChart data={topMotivos} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="motivo" tick={{ fontSize: 10 }} width={140} />
                      <Tooltip formatter={(v: any) => [v, "Cancelamentos"]} />
                      <Bar dataKey="qtd" radius={[0, 4, 4, 0]}>
                        {topMotivos.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados de motivo disponíveis
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cancelamentos por Plano</CardTitle>
            </CardHeader>
            <CardContent>
              {cancelPorPlano.length > 0 ? (
                <div className="max-h-[280px] overflow-y-auto">
                  <ResponsiveContainer width="100%" height={cancelPorPlano.length * 30 + 20}>
                    <BarChart data={cancelPorPlano} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="plano" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip formatter={(v: any) => [v, "Cancelamentos"]} />
                      <Bar dataKey="qtd" fill="hsl(var(--destructive) / 0.7)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados de plano disponíveis
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Linha 4: Perfil comparativo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Perfil Comparativo — Ativos vs Cancelados</CardTitle>
          </CardHeader>
          <CardContent>
            {comparativo.some((d) => d.Ativos > 0 || d.Cancelados > 0) ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={comparativo} margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="Ativos" name="Ativos" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Cancelados" name="Cancelados" fill="hsl(var(--destructive) / 0.7)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                Sem dados comparativos disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Cancelamentos;
