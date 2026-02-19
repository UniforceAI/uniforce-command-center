import { useState, useMemo } from "react";
import { useChurnData } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { IspActions } from "@/components/shared/IspActions";
import {
  AlertTriangle, Users, Percent, Target, DollarSign, TrendingDown, AlertCircle, Info, ChevronDown,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

/** Normaliza cidade: se for numérico retorna como string limpa, se nome retorna capitalizado */
function normalizarCidade(raw: string | null): string {
  if (!raw) return "Desconhecida";
  const s = raw.trim();
  if (!isNaN(Number(s))) return `Cidade ${s}`;
  return s;
}

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
    const scoreMedio = scoreMedioNum != null ? scoreMedioNum.toFixed(1) : "—";
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

  const barColor = (pct: number) => {
    if (pct >= 20) return "hsl(var(--destructive))";
    if (pct >= 10) return "hsl(var(--warning))";
    return "hsl(var(--primary))";
  };

  const cidadeColor = (idx: number) => {
    if (idx === 0) return "hsl(var(--destructive))";
    if (idx <= 2) return "hsl(38 92% 50%)"; // warning
    return "hsl(var(--primary))";
  };

  const activeFiltersCount = [plano, cidade, bairro, bucket].filter((v) => v !== "todos").length;

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="text-muted-foreground">Carregando dados de churn...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Churn Analytics</h1>
            <p className="text-muted-foreground text-xs mt-0.5">
              {ativos.length.toLocaleString()} ativos · {emRisco.length.toLocaleString()} em risco · base de {churnStatus.length.toLocaleString()} clientes
            </p>
          </div>
          <IspActions />
        </div>
      </header>

      {/* Filtros */}
      <div className="border-b bg-muted/20">
        <div className="container mx-auto px-6 py-3 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Filtrar por:</span>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Plano</span>
            <Select value={plano} onValueChange={setPlano}>
              <SelectTrigger className="h-7 text-xs w-[140px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                {filterOptions.planos.map((p) => (
                  <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Cidade</span>
            <Select value={cidade} onValueChange={setCidade}>
              <SelectTrigger className="h-7 text-xs w-[130px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todas</SelectItem>
                {filterOptions.cidades.map((c) => (
                  <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Bairro</span>
            <Select value={bairro} onValueChange={setBairro}>
              <SelectTrigger className="h-7 text-xs w-[130px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                {filterOptions.bairros.map((b) => (
                  <SelectItem key={b} value={b} className="text-xs">{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Risco</span>
            <Select value={bucket} onValueChange={setBucket}>
              <SelectTrigger className="h-7 text-xs w-[110px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todos</SelectItem>
                <SelectItem value="Crítico" className="text-xs">🔴 Crítico</SelectItem>
                <SelectItem value="Alto" className="text-xs">🟠 Alto</SelectItem>
                <SelectItem value="Médio" className="text-xs">🟡 Médio</SelectItem>
                <SelectItem value="Baixo" className="text-xs">🟢 Baixo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activeFiltersCount > 0 && (
            <button
              onClick={() => { setPlano("todos"); setCidade("todos"); setBairro("todos"); setBucket("todos"); }}
              className="text-xs text-muted-foreground hover:text-destructive underline"
            >
              Limpar filtros ({activeFiltersCount})
            </button>
          )}
        </div>
      </div>

      <main className="container mx-auto px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>Erro ao carregar dados: {error}</span>
          </div>
        )}

        {/* KPI Cards — 6 cards em grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {/* Clientes Risco */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm group hover:border-destructive/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Clientes Risco</span>
              <div className="p-1.5 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpis.totalRisco.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpis.pctRisco}% da base</p>
          </div>

          {/* % Risco */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-warning/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">% em Risco</span>
              <div className="p-1.5 rounded-lg bg-warning/10">
                <Percent className="h-3.5 w-3.5 text-warning" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpis.pctRisco}%</p>
            <p className="text-xs text-muted-foreground mt-0.5">Churn Rate</p>
          </div>

          {/* MRR Risco */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-destructive/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">MRR Risco</span>
              <div className="p-1.5 rounded-lg bg-destructive/10">
                <DollarSign className="h-3.5 w-3.5 text-destructive" />
              </div>
            </div>
            <p className="text-lg font-bold text-foreground leading-tight">
              R$ {kpis.mrrRisco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Receita ameaçada</p>
          </div>

          {/* LTV Risco */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-destructive/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">LTV Risco</span>
              <div className="p-1.5 rounded-lg bg-destructive/10">
                <TrendingDown className="h-3.5 w-3.5 text-destructive" />
              </div>
            </div>
            <p className="text-lg font-bold text-foreground leading-tight">
              R$ {kpis.ltvRisco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Valor estimado perdido</p>
          </div>

          {/* Score Médio */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-warning/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Score Médio</span>
              <div className="p-1.5 rounded-lg bg-warning/10">
                <Target className="h-3.5 w-3.5 text-warning" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpis.scoreMedio}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Score de risco</p>
          </div>

          {/* Total Clientes */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-sm hover:border-primary/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Total Clientes</span>
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Users className="h-3.5 w-3.5 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpis.totalAtivos.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Base ativa</p>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Cohort Churn por Plano */}
          <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">Cohort Churn por Plano</span>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {riscoPorPlano.length > 0 ? (
              <div className="p-5 flex flex-col gap-4 flex-1">
                <ResponsiveContainer width="100%" height={240}>
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
                        return [`${d.risco} de ${d.total} clientes (${d.pct}%)`, "Em risco"];
                      }}
                    />
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {riscoPorPlano.map((entry, idx) => (
                        <Cell key={idx} fill={barColor(entry.pct)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-1 overflow-y-auto max-h-[200px]">
                  {riscoPorPlano.map((d) => (
                    <div key={d.plano} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: barColor(d.pct) }} />
                        <span className="text-xs text-foreground truncate">{d.plano}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="text-xs font-semibold text-foreground">{d.risco} clientes</span>
                        <span className="text-xs text-muted-foreground">LTV: R$ {d.mrr.toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-10">
                Sem dados de plano disponíveis
              </div>
            )}
          </div>

          {/* Top 10 Cidades em Risco */}
          <div className="bg-card border border-border rounded-xl shadow-sm flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">Top 10 Cidades em Risco</span>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {topCidades.length > 0 ? (
              <div className="p-5 flex flex-col gap-4 flex-1">
                <ResponsiveContainer width="100%" height={240}>
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
                      formatter={(v: any) => [v, "Clientes em risco"]}
                    />
                    <Bar dataKey="qtd" radius={[0, 4, 4, 0]} maxBarSize={20} label={{ position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))" }}>
                      {topCidades.map((_, idx) => (
                        <Cell key={idx} fill={cidadeColor(idx)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                <div className="space-y-1 overflow-y-auto max-h-[200px]">
                  {topCidades.map((d, idx) => (
                    <div key={d.cidade} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cidadeColor(idx) }} />
                        <span className="text-xs text-foreground">{d.cidade}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">{d.qtd} em risco</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-10">
                {emRisco.length === 0 ? `Nenhum cliente em risco (${ativos.length} ativos)` : "Sem dados de cidade"}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
};

export default ChurnAnalytics;
