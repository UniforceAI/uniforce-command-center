import { useState, useMemo } from "react";
import { useChurnData } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { useRiskBucketConfig } from "@/hooks/useRiskBucketConfig";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import {
  AlertTriangle, Users, Percent, Target, DollarSign, TrendingDown,
  AlertCircle, Info,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

function normalizarCidade(raw: string | null): string {
  if (!raw) return "Desconhecida";
  const s = raw.trim();
  if (!isNaN(Number(s))) return `Cidade ${s}`;
  return s;
}

function fmtBRL(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

const barColor = (pct: number) => {
  if (pct >= 20) return "hsl(var(--destructive))";
  if (pct >= 10) return "hsl(38 92% 50%)";
  return "hsl(var(--primary))";
};

const cidadeColor = (idx: number) => {
  if (idx === 0) return "hsl(var(--destructive))";
  if (idx <= 2) return "hsl(38 92% 50%)";
  return "hsl(var(--primary))";
};

const ChurnAnalytics = () => {
  const { churnStatus, isLoading, error } = useChurnData();
  const { getChamadosPorCliente } = useChamados();
  const { getBucket } = useRiskBucketConfig();
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
      if (c.cliente_cidade) cidades.add(normalizarCidade(c.cliente_cidade));
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
    if (cidade !== "todos") f = f.filter((c) => normalizarCidade(c.cliente_cidade) === cidade);
    if (bairro !== "todos") f = f.filter((c) => c.cliente_bairro === bairro);
    if (bucket !== "todos") f = f.filter((c) => getBucket(c.churn_risk_score) === bucket);
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
    const scoreMedio = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "—";
    return { totalAtivos, totalRisco, pctRisco, scoreMedio, mrrRisco, ltvRisco };
  }, [ativos, emRisco]);

  const topCidades = useMemo(() => {
    const map: Record<string, number> = {};
    emRisco.forEach((c) => {
      const nome = normalizarCidade(c.cliente_cidade);
      map[nome] = (map[nome] || 0) + 1;
    });
    return Object.entries(map)
      .map(([cidade, qtd]) => ({ cidade, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [emRisco]);

  const riscoPorPlano = useMemo(() => {
    const map: Record<string, { risco: number; total: number; mrr: number }> = {};
    ativos.forEach((c) => {
      if (!c.plano_nome) return;
      if (!map[c.plano_nome]) map[c.plano_nome] = { risco: 0, total: 0, mrr: 0 };
      map[c.plano_nome].total++;
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
      }))
      .filter((d) => d.total >= 3)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [ativos]);

  const filters = [
    {
      id: "plano", label: "Plano", value: plano, onChange: setPlano,
      disabled: filterOptions.planos.length === 0,
      tooltip: "Sem dados de plano para esse ISP",
      options: [{ value: "todos", label: "Todos" }, ...filterOptions.planos.map((p) => ({ value: p, label: p }))],
    },
    {
      id: "cidade", label: "Cidade", value: cidade, onChange: setCidade,
      disabled: filterOptions.cidades.length === 0,
      tooltip: "Sem dados de cidade para esse ISP",
      options: [{ value: "todos", label: "Todas" }, ...filterOptions.cidades.map((c) => ({ value: c, label: c }))],
    },
    {
      id: "bairro", label: "Bairro", value: bairro, onChange: setBairro,
      disabled: filterOptions.bairros.length === 0,
      tooltip: "Sem dados de bairro para esse ISP",
      options: [{ value: "todos", label: "Todos" }, ...filterOptions.bairros.map((b) => ({ value: b, label: b }))],
    },
    {
      id: "bucket", label: "Nível Risco", value: bucket, onChange: setBucket,
      options: [
        { value: "todos", label: "Todos" },
        { value: "CRÍTICO", label: "🔴 Crítico" },
        { value: "ALERTA", label: "🟡 Alerta" },
        { value: "OK", label: "🟢 OK" },
      ],
    },
  ];

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <LoadingScreen />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Churn Analytics</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ativos.length.toLocaleString()} ativos · {emRisco.length.toLocaleString()} em risco · base de {churnStatus.length.toLocaleString()} clientes
          </p>
        </div>
        <IspActions />
      </header>

      <main className="px-6 py-6 space-y-6 max-w-[1400px] mx-auto">
        {/* Filtros — usando GlobalFilters padronizado */}
        <GlobalFilters filters={filters} />
        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── KPI CARDS ── estilo igual ao print de referência */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">

          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 min-h-[90px]">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs text-muted-foreground font-medium">Clientes Risco</span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{kpis.totalRisco.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{kpis.pctRisco}% da base</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 min-h-[90px]">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs text-muted-foreground font-medium">Rescisões</span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {churnStatus.filter((c) => c.status_churn === "cancelado").length.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">cancelamentos</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 min-h-[90px]">
            <div className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs text-muted-foreground font-medium">MRR Risco</span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">{fmtBRL(kpis.mrrRisco)}</p>
            <p className="text-xs text-muted-foreground">receita ameaçada</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 min-h-[90px]">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs text-muted-foreground font-medium">LTV Risco</span>
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">{fmtBRL(kpis.ltvRisco)}</p>
            <p className="text-xs text-muted-foreground">valor estimado perdido</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 min-h-[90px]">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs text-muted-foreground font-medium">% em Risco</span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{kpis.pctRisco}%</p>
            <p className="text-xs text-muted-foreground">score médio: {kpis.scoreMedio}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-1 min-h-[90px]">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Total Clientes</span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{kpis.totalAtivos.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">base ativa</p>
          </div>

        </div>

        {/* ── GRÁFICOS ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Cohort Churn por Plano */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Cohort Churn por Plano</span>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {riscoPorPlano.length > 0 ? (
              <div className="p-5 space-y-4">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={riscoPorPlano} margin={{ top: 8, right: 8, bottom: 80, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="plano"
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      angle={-40}
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
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(_v: any, _n: any, props: any) => {
                        const d = props.payload;
                        return [`${d.risco} de ${d.total} (${d.pct}%)`, "Em risco"];
                      }}
                    />
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={44}>
                      {riscoPorPlano.map((e, i) => <Cell key={i} fill={barColor(e.pct)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {riscoPorPlano.map((d) => (
                    <div key={d.plano} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0 gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: barColor(d.pct) }} />
                        <span className="text-xs text-foreground truncate">{d.plano}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 text-xs">
                        <span className="font-semibold text-foreground">{d.risco} clientes</span>
                        <span className="text-muted-foreground">LTV: R$ {d.mrr.toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
            )}
          </div>

          {/* Top 10 Cidades em Risco */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Top 10 Cidades em Risco</span>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {topCidades.length > 0 ? (
              <div className="p-5 space-y-4">
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={topCidades} layout="vertical" margin={{ top: 4, right: 44, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="cidade"
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      width={80}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: any) => [v, "em risco"]}
                    />
                    <Bar
                      dataKey="qtd"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={20}
                      label={{ position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    >
                      {topCidades.map((_, i) => <Cell key={i} fill={cidadeColor(i)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  {topCidades.map((d, i) => (
                    <div key={d.cidade} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cidadeColor(i) }} />
                        <span className="text-xs text-foreground">{d.cidade}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">{d.qtd} em risco</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                {emRisco.length === 0 ? "Nenhum cliente em risco" : "Sem dados de cidade"}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default ChurnAnalytics;
