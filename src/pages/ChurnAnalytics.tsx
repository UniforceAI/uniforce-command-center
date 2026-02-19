import { useState, useMemo } from "react";
import { useChurnData } from "@/hooks/useChurnData";
import { IspActions } from "@/components/shared/IspActions";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Users, Percent, Target, DollarSign, TrendingDown, AlertCircle } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, ScatterChart, Scatter, ZAxis,
} from "recharts";

const BUCKET_COLORS: Record<string, string> = {
  Baixo: "#22c55e",
  Médio: "#eab308",
  Alto: "#f97316",
  Crítico: "#ef4444",
};

const ChurnAnalytics = () => {
  const { churnStatus, isLoading, error } = useChurnData();

  const [periodo, setPeriodo] = useState("todos");
  const [plano, setPlano] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [bucket, setBucket] = useState("todos");

  // Opções dinâmicas
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
    const scores = ativos.filter((c) => c.churn_risk_score != null).map((c) => c.churn_risk_score!);
    const scoreMedio = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : "N/A";
    const mrrRisco = emRisco.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    const ltvRisco = emRisco.reduce((acc, c) => acc + (c.ltv_estimado || 0), 0);
    return { totalAtivos, totalRisco, pctRisco, scoreMedio, mrrRisco, ltvRisco };
  }, [ativos, emRisco]);

  // Distribuição por bucket
  const distribuicaoBucket = useMemo(() => {
    const map: Record<string, number> = {};
    ativos.forEach((c) => {
      const b = c.churn_risk_bucket || "N/A";
      map[b] = (map[b] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: BUCKET_COLORS[name] || "#6b7280" }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [ativos]);

  // Top 10 bairros por score médio
  const topBairros = useMemo(() => {
    const map: Record<string, { soma: number; total: number }> = {};
    ativos.forEach((c) => {
      if (c.cliente_bairro && c.churn_risk_score != null) {
        if (!map[c.cliente_bairro]) map[c.cliente_bairro] = { soma: 0, total: 0 };
        map[c.cliente_bairro].soma += c.churn_risk_score;
        map[c.cliente_bairro].total++;
      }
    });
    return Object.entries(map)
      .map(([bairro, d]) => ({ bairro, score: Math.round(d.soma / d.total), qtd: d.total }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [ativos]);

  // Risco médio por plano
  const riscoPorPlano = useMemo(() => {
    const map: Record<string, { soma: number; total: number }> = {};
    ativos.forEach((c) => {
      if (c.plano_nome && c.churn_risk_score != null) {
        if (!map[c.plano_nome]) map[c.plano_nome] = { soma: 0, total: 0 };
        map[c.plano_nome].soma += c.churn_risk_score;
        map[c.plano_nome].total++;
      }
    });
    return Object.entries(map)
      .map(([plano, d]) => ({ plano, score: Math.round(d.soma / d.total), qtd: d.total }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
  }, [ativos]);

  // Correlação dias_atraso vs score
  const corrAtraso = useMemo(() =>
    ativos
      .filter((c) => c.churn_risk_score != null && c.dias_atraso != null)
      .map((c) => ({ x: Math.min(c.dias_atraso!, 120), y: c.churn_risk_score!, z: 4 }))
      .slice(0, 300),
    [ativos]);

  // Correlação chamados_30d vs score
  const corrChamados = useMemo(() =>
    ativos
      .filter((c) => c.churn_risk_score != null && c.qtd_chamados_30d != null)
      .map((c) => ({ x: Math.min(c.qtd_chamados_30d!, 20), y: c.churn_risk_score!, z: 4 }))
      .slice(0, 300),
    [ativos]);

  // Correlação NPS vs score
  const corrNps = useMemo(() =>
    ativos
      .filter((c) => c.churn_risk_score != null && c.nps_ultimo_score != null)
      .map((c) => ({ x: c.nps_ultimo_score!, y: c.churn_risk_score!, z: 4 }))
      .slice(0, 300),
    [ativos]);

  const filters = [
    { id: "plano", label: "Plano", value: plano, onChange: setPlano, options: [{ value: "todos", label: "Todos" }, ...filterOptions.planos.map((p) => ({ value: p, label: p }))] },
    { id: "cidade", label: "Cidade", value: cidade, onChange: setCidade, options: [{ value: "todos", label: "Todas" }, ...filterOptions.cidades.map((c) => ({ value: c, label: c }))] },
    { id: "bairro", label: "Bairro", value: bairro, onChange: setBairro, options: [{ value: "todos", label: "Todos" }, ...filterOptions.bairros.map((b) => ({ value: b, label: b }))] },
    { id: "bucket", label: "Bucket", value: bucket, onChange: setBucket, options: [{ value: "todos", label: "Todos" }, { value: "Crítico", label: "Crítico" }, { value: "Alto", label: "Alto" }, { value: "Médio", label: "Médio" }, { value: "Baixo", label: "Baixo" }] },
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
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Churn Analytics
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Visão estratégica de risco e evasão</p>
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

        {/* Filtros */}
        <GlobalFilters filters={filters} />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICardNew title="Clientes Ativos" value={kpis.totalAtivos.toLocaleString()} icon={Users} variant="default" />
          <KPICardNew title="Em Risco" value={kpis.totalRisco.toLocaleString()} icon={AlertTriangle} variant="danger" />
          <KPICardNew title="% em Risco" value={`${kpis.pctRisco}%`} icon={Percent} variant="warning" />
          <KPICardNew title="Score Médio" value={kpis.scoreMedio} icon={Target} variant="info" />
          <KPICardNew title="MRR em Risco" value={`R$ ${kpis.mrrRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} variant="danger" />
          <KPICardNew title="LTV em Risco" value={`R$ ${kpis.ltvRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={TrendingDown} variant="danger" />
        </div>

        {/* Linha 2: Donut + (espaço para evolução) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição por Bucket</CardTitle>
            </CardHeader>
            <CardContent>
              {distribuicaoBucket.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={distribuicaoBucket} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                      {distribuicaoBucket.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, "Clientes"]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Score Médio por Bucket</CardTitle>
            </CardHeader>
            <CardContent>
              {distribuicaoBucket.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={distribuicaoBucket} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip formatter={(v: any) => [v, "Clientes"]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {distribuicaoBucket.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">
                  Nenhum dado disponível
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Linha 3: Top bairros + Risco por plano */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top 10 Bairros — Score Médio</CardTitle>
            </CardHeader>
            <CardContent>
              {topBairros.length > 0 ? (
                <div className="max-h-[320px] overflow-y-auto">
                  <ResponsiveContainer width="100%" height={topBairros.length * 32 + 20}>
                    <BarChart data={topBairros} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="bairro" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(v: any) => [`${v}`, "Score Médio"]} />
                      <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Sem dados de bairro disponíveis</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Risco Médio por Plano</CardTitle>
            </CardHeader>
            <CardContent>
              {riscoPorPlano.length > 0 ? (
                <div className="max-h-[320px] overflow-y-auto">
                  <ResponsiveContainer width="100%" height={riscoPorPlano.length * 32 + 20}>
                    <BarChart data={riscoPorPlano} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="plano" tick={{ fontSize: 10 }} width={120} />
                      <Tooltip formatter={(v: any) => [`${v}`, "Score Médio"]} />
                      <Bar dataKey="score" fill="hsl(var(--destructive) / 0.7)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Sem dados de plano disponíveis</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Linha 4: Correlações */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Dias atraso vs score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Dias Atraso × Score</CardTitle>
            </CardHeader>
            <CardContent>
              {corrAtraso.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" name="Dias Atraso" tick={{ fontSize: 10 }} label={{ value: "Dias Atraso", position: "insideBottom", offset: -2, fontSize: 10 }} />
                    <YAxis dataKey="y" name="Score" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <ZAxis dataKey="z" range={[20, 20]} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: any, n) => [v, n === "x" ? "Dias" : "Score"]} />
                    <Scatter data={corrAtraso} fill="hsl(var(--destructive) / 0.5)" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </CardContent>
          </Card>

          {/* Chamados 30d vs score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Chamados 30d × Score</CardTitle>
            </CardHeader>
            <CardContent>
              {corrChamados.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" name="Chamados 30d" tick={{ fontSize: 10 }} label={{ value: "Chamados 30d", position: "insideBottom", offset: -2, fontSize: 10 }} />
                    <YAxis dataKey="y" name="Score" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <ZAxis dataKey="z" range={[20, 20]} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: any, n) => [v, n === "x" ? "Chamados" : "Score"]} />
                    <Scatter data={corrChamados} fill="hsl(var(--primary) / 0.5)" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </CardContent>
          </Card>

          {/* NPS vs score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">NPS × Score</CardTitle>
            </CardHeader>
            <CardContent>
              {corrNps.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" name="NPS" domain={[0, 10]} tick={{ fontSize: 10 }} label={{ value: "NPS", position: "insideBottom", offset: -2, fontSize: 10 }} />
                    <YAxis dataKey="y" name="Score" domain={[0, 100]} tick={{ fontSize: 10 }} />
                    <ZAxis dataKey="z" range={[20, 20]} />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(v: any, n) => [v, n === "x" ? "NPS" : "Score"]} />
                    <Scatter data={corrNps} fill="hsl(var(--chart-2) / 0.6)" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ChurnAnalytics;
