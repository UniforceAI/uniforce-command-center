import { useState, useMemo } from "react";
import { useChurnData } from "@/hooks/useChurnData";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useChamados } from "@/hooks/useChamados";
import { IspActions } from "@/components/shared/IspActions";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import {
  AlertTriangle, Users, Percent, Target, DollarSign, TrendingDown, AlertCircle, Info,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { cn } from "@/lib/utils";

const BUCKET_COLORS: Record<string, string> = {
  Baixo: "#22c55e",
  Médio: "#eab308",
  Alto: "#f97316",
  Crítico: "#ef4444",
};

const ChurnAnalytics = () => {
  const { churnStatus, isLoading, error } = useChurnData();
  const { getChamadosPorCliente } = useChamados();
  const chamadosMap90d = useMemo(() => getChamadosPorCliente(90), [getChamadosPorCliente]);

  const [plano, setPlano] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [bucket, setBucket] = useState("todos");

  const filterOptions = useMemo(() => {
    const planos = new Set<string>();
    const cidades = new Set<string>();
    const bairros = new Set<string>();
    churnStatus.forEach((c) => {
      if (c.plano_nome) planos.add(c.plano_nome);
      if (c.cliente_cidade) cidades.add(c.cliente_cidade);
      if (c.cliente_bairro) bairros.add(c.cliente_bairro);
    });
    return {
      planos: Array.from(planos).sort(),
      cidades: Array.from(cidades).sort(),
      bairros: Array.from(bairros).sort(),
    };
  }, [churnStatus]);

  const filtered = useMemo(() => {
    let f = [...churnStatus];
    if (plano !== "todos") f = f.filter((c) => c.plano_nome === plano);
    if (cidade !== "todos") f = f.filter((c) => c.cliente_cidade === cidade);
    if (bairro !== "todos") f = f.filter((c) => c.cliente_bairro === bairro);
    if (bucket !== "todos") f = f.filter((c) => c.churn_risk_bucket === bucket);
    return f;
  }, [churnStatus, plano, cidade, bairro, bucket]);

  const ativos = useMemo(() => filtered.filter((c) => c.status_churn !== "cancelado"), [filtered]);
  const emRisco = useMemo(() => filtered.filter((c) => c.status_churn === "risco"), [filtered]);

  const kpis = useMemo(() => {
    const totalAtivos = ativos.length;
    const totalRisco = emRisco.length;
    const pctRisco = totalAtivos > 0 ? ((totalRisco / totalAtivos) * 100).toFixed(1) : "0";
    const mrrRisco = emRisco.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    const ltvRisco = emRisco.reduce((acc, c) => acc + (c.ltv_estimado || 0), 0);
    const scores = ativos.filter((c) => c.churn_risk_score != null).map((c) => c.churn_risk_score);
    const scoreMedioNum = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const scoreMedio = scoreMedioNum != null ? scoreMedioNum.toFixed(1) : "N/A";
    return { totalAtivos, totalRisco, pctRisco, scoreMedio, mrrRisco, ltvRisco };
  }, [ativos, emRisco]);

  // Top 10 cidades por clientes em risco
  const topCidades = useMemo(() => {
    const map: Record<string, number> = {};
    emRisco.forEach((c) => {
      if (c.cliente_cidade) map[c.cliente_cidade] = (map[c.cliente_cidade] || 0) + 1;
    });
    return Object.entries(map)
      .map(([cidade, qtd]) => ({ cidade, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [emRisco]);

  // Risco por plano com chamados reais
  const riscoPorPlano = useMemo(() => {
    const map: Record<string, { risco: number; total: number; mrr: number; chamados: number }> = {};
    ativos.forEach((c) => {
      if (!c.plano_nome) return;
      if (!map[c.plano_nome]) map[c.plano_nome] = { risco: 0, total: 0, mrr: 0, chamados: 0 };
      map[c.plano_nome].total++;
      const chamadosCliente = chamadosMap90d.get(c.cliente_id)?.chamados_periodo ?? 0;
      map[c.plano_nome].chamados += chamadosCliente;
      if (c.status_churn === "risco") {
        map[c.plano_nome].risco++;
        map[c.plano_nome].mrr += c.valor_mensalidade || 0;
      }
    });
    return Object.entries(map)
      .map(([plano, d]) => ({
        plano,
        risco: d.risco,
        total: d.total,
        pct: d.total > 0 ? Math.round((d.risco / d.total) * 100) : 0,
        mrr: Math.round(d.mrr),
        chamados: d.chamados,
      }))
      .filter((d) => d.total >= 3)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [ativos, chamadosMap90d]);

  const filters = [
    { id: "plano", label: "Plano", value: plano, onChange: setPlano, options: [{ value: "todos", label: "Todos" }, ...filterOptions.planos.map((p) => ({ value: p, label: p }))] },
    { id: "cidade", label: "Cidade", value: cidade, onChange: setCidade, options: [{ value: "todos", label: "Todas" }, ...filterOptions.cidades.map((c) => ({ value: c, label: c }))] },
    { id: "bairro", label: "Bairro", value: bairro, onChange: setBairro, options: [{ value: "todos", label: "Todos" }, ...filterOptions.bairros.map((b) => ({ value: b, label: b }))] },
    {
      id: "bucket", label: "Bucket Risco", value: bucket, onChange: setBucket, options: [
        { value: "todos", label: "Todos" },
        { value: "Crítico", label: "🔴 Crítico" },
        { value: "Alto", label: "🟠 Alto" },
        { value: "Médio", label: "🟡 Médio" },
        { value: "Baixo", label: "🟢 Baixo" },
      ]
    },
  ];

  const kpiCards = [
    {
      label: "Clientes Risco",
      value: kpis.totalRisco.toLocaleString(),
      sub: `${kpis.pctRisco}% da base`,
      icon: AlertTriangle,
      accent: "hsl(var(--destructive))",
      bg: "hsl(var(--destructive) / 0.12)",
    },
    {
      label: "% em Risco",
      value: `${kpis.pctRisco}%`,
      sub: "Churn Rate",
      icon: Percent,
      accent: "hsl(var(--warning))",
      bg: "hsl(var(--warning) / 0.12)",
    },
    {
      label: "MRR Risco",
      value: `R$ ${kpis.mrrRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`,
      sub: "Receita ameaçada",
      icon: DollarSign,
      accent: "hsl(var(--destructive))",
      bg: "hsl(var(--destructive) / 0.12)",
    },
    {
      label: "LTV Risco",
      value: `R$ ${kpis.ltvRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`,
      sub: "Valor estimado perdido",
      icon: TrendingDown,
      accent: "hsl(var(--destructive))",
      bg: "hsl(var(--destructive) / 0.12)",
    },
    {
      label: "Score Médio",
      value: kpis.scoreMedio !== "N/A" ? kpis.scoreMedio : "—",
      sub: "Score de risco",
      icon: Target,
      accent: "hsl(var(--warning))",
      bg: "hsl(var(--warning) / 0.12)",
    },
    {
      label: "Total Clientes",
      value: kpis.totalAtivos.toLocaleString(),
      sub: "Base ativa",
      icon: Users,
      accent: "hsl(var(--primary))",
      bg: "hsl(var(--primary) / 0.12)",
    },
  ];

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">Carregando Churn Analytics...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Churn Analytics
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {ativos.length.toLocaleString()} clientes ativos · {emRisco.length.toLocaleString()} em risco · base de {churnStatus.length.toLocaleString()} clientes
              </p>
            </div>
            <IspActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-4">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Erro ao carregar dados: {error}</span>
          </div>
        )}

        <GlobalFilters filters={filters} />

        {/* KPI Cards — estilo escuro com ícone colorido */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiCards.map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border bg-card p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground leading-tight">{kpi.label}</span>
                <div
                  className="rounded-lg p-1.5 flex items-center justify-center"
                  style={{ background: kpi.bg }}
                >
                  <kpi.icon className="h-3.5 w-3.5" style={{ color: kpi.accent }} />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold leading-none tracking-tight">{kpi.value}</p>
                {kpi.sub && <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Dois gráficos principais */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Cohort Churn por Plano */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b flex items-center gap-2">
              <span className="text-sm font-semibold">Cohort Churn por Plano</span>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="p-5">
              {riscoPorPlano.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={riscoPorPlano}
                      margin={{ top: 8, right: 8, bottom: 60, left: -10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="plano"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                        formatter={(v: any, _name, props) => {
                          const d = props.payload;
                          return [`${d.risco} de ${d.total} (${d.pct}%) · ${d.chamados} chamados/90d`, "Em risco"];
                        }}
                      />
                      <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {riscoPorPlano.map((entry, idx) => (
                          <Cell
                            key={idx}
                            fill={
                              entry.pct >= 20
                                ? "hsl(var(--destructive))"
                                : entry.pct >= 12
                                ? "hsl(var(--warning))"
                                : "hsl(var(--primary))"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Legenda tabular */}
                  <div className="mt-4 space-y-1.5 max-h-[160px] overflow-y-auto">
                    {riscoPorPlano.map((d) => (
                      <div key={d.plano} className="flex items-center justify-between text-xs px-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              background:
                                d.pct >= 20
                                  ? "hsl(var(--destructive))"
                                  : d.pct >= 12
                                  ? "hsl(var(--warning))"
                                  : "hsl(var(--primary))",
                            }}
                          />
                          <span className="text-foreground font-medium truncate">{d.plano}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-muted-foreground">
                          <span className="font-semibold text-foreground">{d.risco} clientes</span>
                          <span>LTV: R$ {d.mrr.toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  Sem dados de plano disponíveis
                </div>
              )}
            </div>
          </div>

          {/* Top 10 Cidades em Risco */}
          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b flex items-center gap-2">
              <span className="text-sm font-semibold">Top Motivos de Contato por Cidade</span>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="p-5">
              {topCidades.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={topCidades}
                      layout="vertical"
                      margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="cidade"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        width={90}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: 12,
                        }}
                        formatter={(v: any) => [v, "Clientes em risco"]}
                      />
                      <Bar dataKey="qtd" radius={[0, 4, 4, 0]} maxBarSize={20} fill="hsl(var(--primary))">
                        {topCidades.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={
                              idx === 0
                                ? "hsl(var(--destructive))"
                                : idx <= 2
                                ? "hsl(var(--warning))"
                                : "hsl(var(--primary))"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Legenda tabular */}
                  <div className="mt-4 space-y-1.5 max-h-[160px] overflow-y-auto">
                    {topCidades.map((d, idx) => (
                      <div key={d.cidade} className="flex items-center justify-between text-xs px-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              background:
                                idx === 0
                                  ? "hsl(var(--destructive))"
                                  : idx <= 2
                                  ? "hsl(var(--warning))"
                                  : "hsl(var(--primary))",
                            }}
                          />
                          <span className="text-foreground font-medium">{d.cidade}</span>
                        </div>
                        <span className="font-semibold text-foreground">{d.qtd} em risco</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                  {emRisco.length === 0
                    ? `Nenhum cliente em risco identificado (${ativos.length} ativos)`
                    : "Sem dados de cidade"}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default ChurnAnalytics;
