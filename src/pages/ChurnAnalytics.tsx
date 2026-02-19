import { useState, useMemo } from "react";
import { useChurnData } from "@/hooks/useChurnData";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useChamados } from "@/hooks/useChamados";
import { IspActions } from "@/components/shared/IspActions";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Users, Percent, Target, DollarSign, TrendingDown, AlertCircle } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  ScatterChart, Scatter, ZAxis,
} from "recharts";

const BUCKET_COLORS: Record<string, string> = {
  Baixo: "#22c55e",
  Médio: "#eab308",
  Alto: "#f97316",
  Crítico: "#ef4444",
};
const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

const STATUS_LABELS: Record<string, string> = {
  "A": "Ativo",
  "CA": "Bloqueado (Cob. Auto)",
  "CM": "Bloqueado (Cob. Manual)",
  "B": "Bloqueado",
  "D": "Desativado/Cancelado",
  "FA": "Férias",
  "S": "Suspenso",
  "Ativo": "Ativo",
  "Bloqueado": "Bloqueado",
  "Suspenso": "Suspenso",
  "Cancelado": "Cancelado",
};

const ChurnAnalytics = () => {
  const { churnStatus, isLoading, error } = useChurnData();
  const { ispId } = useActiveIsp();
  const { getChamadosPorCliente } = useChamados();

  // Mapa de chamados reais (90d) para correlação por plano/cidade
  const chamadosMap90d = useMemo(() => getChamadosPorCliente(90), [getChamadosPorCliente]);

  const [plano, setPlano] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [bucket, setBucket] = useState("todos");
  const [atraso, setAtraso] = useState("todos");

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
    if (atraso !== "todos") f = f.filter((c) => c.faixa_atraso === atraso);
    return f;
  }, [churnStatus, plano, cidade, bairro, bucket, atraso]);

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
    const scoreVariant = scoreMedioNum == null ? "default"
      : scoreMedioNum > 80 ? "danger"
      : scoreMedioNum > 25 ? "warning"
      : scoreMedioNum > 10 ? "info"
      : "default";
    return { totalAtivos, totalRisco, pctRisco, scoreMedio, mrrRisco, ltvRisco, scoreVariant };
  }, [ativos, emRisco]);

  // Distribuição por bucket
  const distribuicaoBucket = useMemo(() => {
    const map: Record<string, number> = {};
    ativos.forEach((c) => {
      const b = c.churn_risk_bucket || "Sem Score";
      map[b] = (map[b] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value, color: BUCKET_COLORS[name] || "#6b7280" }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [ativos]);

  const bucketTotal = distribuicaoBucket.reduce((s, d) => s + d.value, 0);

  // Distribuição por status de contrato
  const distribuicaoStatus = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((c) => {
      const raw = c.status_internet || c.status_contrato || "N/A";
      const label = STATUS_LABELS[raw] || raw;
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [filtered]);

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
      .filter(d => d.total >= 3)
      .sort((a, b) => b.risco - a.risco)
      .slice(0, 10);
  }, [ativos, chamadosMap90d]);

  // Distribuição de dias em atraso
  const distribuicaoAtraso = useMemo(() => {
    const faixas = [
      { label: "0 dias", min: 0, max: 0 },
      { label: "1-15 dias", min: 1, max: 15 },
      { label: "16-30 dias", min: 16, max: 30 },
      { label: "31-60 dias", min: 31, max: 60 },
      { label: "60+ dias", min: 61, max: Infinity },
    ];
    return faixas.map(f => ({
      label: f.label,
      qtd: ativos.filter(c => {
        const d = c.dias_atraso || 0;
        return d >= f.min && d <= f.max;
      }).length,
    }));
  }, [ativos]);

  // Correlação dias_atraso vs valor_mensalidade
  const corrAtrasoMrr = useMemo(() =>
    ativos
      .filter((c) => c.dias_atraso != null && c.valor_mensalidade != null && c.dias_atraso > 0)
      .map((c) => ({ x: Math.min(c.dias_atraso!, 120), y: c.valor_mensalidade!, z: 4 }))
      .slice(0, 400),
    [ativos]);

  // MRR em risco por cidade
  const mrrPorCidade = useMemo(() => {
    const map: Record<string, number> = {};
    emRisco.forEach((c) => {
      if (c.cliente_cidade) map[c.cliente_cidade] = (map[c.cliente_cidade] || 0) + (c.valor_mensalidade || 0);
    });
    return Object.entries(map)
      .map(([cidade, mrr]) => ({ cidade, mrr: Math.round(mrr) }))
      .sort((a, b) => b.mrr - a.mrr)
      .slice(0, 10);
  }, [emRisco]);

  const filters = [
    { id: "plano", label: "Plano", value: plano, onChange: setPlano, options: [{ value: "todos", label: "Todos" }, ...filterOptions.planos.map((p) => ({ value: p, label: p }))] },
    { id: "cidade", label: "Cidade", value: cidade, onChange: setCidade, options: [{ value: "todos", label: "Todas" }, ...filterOptions.cidades.map((c) => ({ value: c, label: c }))] },
    { id: "bairro", label: "Bairro", value: bairro, onChange: setBairro, options: [{ value: "todos", label: "Todos" }, ...filterOptions.bairros.map((b) => ({ value: b, label: b }))] },
    { id: "bucket", label: "Bucket Risco", value: bucket, onChange: setBucket, options: [{ value: "todos", label: "Todos" }, { value: "Crítico", label: "🔴 Crítico" }, { value: "Alto", label: "🟠 Alto" }, { value: "Médio", label: "🟡 Médio" }, { value: "Baixo", label: "🟢 Baixo" }] },
    { id: "atraso", label: "Faixa Atraso", value: atraso, onChange: setAtraso, options: [
      { value: "todos", label: "Todas" },
      { value: "0-0", label: "Em dia" },
      { value: "1-7", label: "1-7 dias" },
      { value: "8-15", label: "8-15 dias" },
      { value: "16-30", label: "16-30 dias" },
      { value: "30+", label: "30+ dias" },
    ]},
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

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICardNew title="Clientes Ativos" value={kpis.totalAtivos.toLocaleString()} icon={Users} variant="default" />
          <KPICardNew title="Em Risco" value={kpis.totalRisco.toLocaleString()} icon={AlertTriangle} variant="danger" />
          <KPICardNew title="% em Risco" value={`${kpis.pctRisco}%`} icon={Percent} variant="warning" />
          <KPICardNew title="Score Médio" value={kpis.scoreMedio !== "N/A" ? kpis.scoreMedio : "—"} icon={Target} variant={kpis.scoreVariant as any} />
          <KPICardNew title="MRR em Risco" value={`R$ ${kpis.mrrRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} variant="danger" />
          <KPICardNew title="LTV em Risco" value={`R$ ${kpis.ltvRisco.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={TrendingDown} variant="danger" />
        </div>

        {/* Linha 2: Bucket + Status Contrato */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Distribuição por Bucket de Risco</CardTitle>
            </CardHeader>
            <CardContent>
              {distribuicaoBucket.length > 0 ? (
                <div>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={distribuicaoBucket} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={3}>
                        {distribuicaoBucket.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any, n) => [`${v.toLocaleString()} clientes`, n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Legenda com contagem e % */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { key: "Baixo", emoji: "🟢" },
                      { key: "Médio", emoji: "🟡" },
                      { key: "Alto", emoji: "🟠" },
                      { key: "Crítico", emoji: "🔴" },
                    ].map(({ key, emoji }) => {
                      const entry = distribuicaoBucket.find(d => d.name === key);
                      if (!entry) return null;
                      const pct = bucketTotal > 0 ? ((entry.value / bucketTotal) * 100).toFixed(1) : "0";
                      return (
                        <div key={key} className="flex items-center gap-1.5 text-xs">
                          <span>{emoji}</span>
                          <span className="text-muted-foreground">{key}:</span>
                          <span className="font-medium">{entry.value.toLocaleString()}</span>
                          <span className="text-muted-foreground">({pct}%)</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-[260px] flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <AlertTriangle className="h-8 w-8 opacity-30" />
                  <span>Sem clientes com bucket de risco definido</span>
                  <span className="text-xs">({ativos.length} clientes ativos carregados)</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status de Contrato — Distribuição</CardTitle>
            </CardHeader>
            <CardContent>
              {distribuicaoStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={distribuicaoStatus} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
                    <Tooltip formatter={(v: any) => [v.toLocaleString(), "Clientes"]} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {distribuicaoStatus.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Linha 3: Top cidades em risco + Risco por plano */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Top 10 Cidades — Clientes em Risco</CardTitle>
            </CardHeader>
            <CardContent>
              {topCidades.length > 0 ? (
                <div className="max-h-[320px] overflow-y-auto">
                  <ResponsiveContainer width="100%" height={topCidades.length * 34 + 20}>
                    <BarChart data={topCidades} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="cidade" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(v: any) => [v, "Em risco"]} />
                      <Bar dataKey="qtd" fill="hsl(var(--destructive) / 0.7)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">
                  {emRisco.length === 0 ? `Nenhum cliente em risco identificado (${ativos.length} ativos)` : "Sem dados de cidade"}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Risco por Plano — qtd e % de risco</CardTitle>
            </CardHeader>
            <CardContent>
              {riscoPorPlano.length > 0 ? (
                <div className="max-h-[320px] overflow-y-auto">
                  <ResponsiveContainer width="100%" height={riscoPorPlano.length * 34 + 20}>
                    <BarChart data={riscoPorPlano} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="plano" tick={{ fontSize: 10 }} width={130} />
                      <Tooltip
                        formatter={(v: any, name, props) => {
                          const d = props.payload;
                          if (name === "risco") return [`${v} de ${d.total} (${d.pct}%) · ${d.chamados} chamados/90d`, "Em risco"];
                          return [v, name];
                        }}
                      />
                      <Bar dataKey="risco" fill="hsl(38 92% 50% / 0.8)" radius={[0, 4, 4, 0]} name="risco" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Sem dados de plano disponíveis</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Linha 4: Distribuição atraso + MRR por cidade + Scatter */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Faixas de Dias em Atraso</CardTitle>
            </CardHeader>
            <CardContent>
              {distribuicaoAtraso.some(d => d.qtd > 0) ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={distribuicaoAtraso} margin={{ top: 4, right: 4, bottom: 20, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => [v.toLocaleString(), "Clientes"]} />
                    <Bar dataKey="qtd" radius={[4, 4, 0, 0]}>
                      {distribuicaoAtraso.map((entry, idx) => (
                        <Cell key={idx} fill={idx === 0 ? "#22c55e" : idx === 1 ? "#eab308" : idx === 2 ? "#f97316" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">MRR em Risco por Cidade</CardTitle>
            </CardHeader>
            <CardContent>
              {mrrPorCidade.length > 0 ? (
                <div className="max-h-[200px] overflow-y-auto">
                  <ResponsiveContainer width="100%" height={mrrPorCidade.length * 24 + 20}>
                    <BarChart data={mrrPorCidade} layout="vertical" margin={{ left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="cidade" tick={{ fontSize: 9 }} width={80} />
                      <Tooltip formatter={(v: any) => [`R$ ${v.toLocaleString("pt-BR")}`, "MRR em risco"]} />
                      <Bar dataKey="mrr" fill="hsl(var(--destructive) / 0.6)" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">Dias Atraso × Mensalidade</CardTitle>
            </CardHeader>
            <CardContent>
              {corrAtrasoMrr.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <ScatterChart margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" name="Dias Atraso" tick={{ fontSize: 10 }} label={{ value: "Dias Atraso", position: "insideBottom", offset: -2, fontSize: 9 }} />
                    <YAxis dataKey="y" name="Mensalidade" tick={{ fontSize: 10 }} tickFormatter={v => `R$${v}`} />
                    <ZAxis dataKey="z" range={[20, 20]} />
                    <Tooltip formatter={(v: any, n) => [n === "x" ? `${v} dias` : `R$ ${v}`, n === "x" ? "Atraso" : "Mensalidade"]} />
                    <Scatter data={corrAtrasoMrr} fill="hsl(var(--destructive) / 0.5)" />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-xs">Sem dados de atraso</div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ChurnAnalytics;
