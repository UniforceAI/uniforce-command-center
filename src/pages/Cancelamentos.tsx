import { useState, useMemo } from "react";
import { useChurnData } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { useRiskBucketConfig, RiskBucket } from "@/hooks/useRiskBucketConfig";
import { useCrmWorkflow } from "@/hooks/useCrmWorkflow";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, Users, TrendingDown, DollarSign, Clock, CalendarX,
  PackageX, Target, ShieldAlert, AlertTriangle, Info,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from "recharts";

const BUCKET_COLORS: Record<RiskBucket, string> = {
  OK: "bg-green-100 text-green-800 border-green-200",
  ALERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "CRÍTICO": "bg-red-100 text-red-800 border-red-200",
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#6b7280"];

const STATUS_MOTIVO: Record<string, string> = {
  D: "Desativação direta",
  CA: "Bloqueio por cobrança automática",
  CM: "Bloqueio por cobrança manual",
};

const COHORT_FAIXAS = [
  { label: "0–3 meses", min: 0, max: 3 },
  { label: "4–6 meses", min: 4, max: 6 },
  { label: "7–12 meses", min: 7, max: 12 },
  { label: "13–24 meses", min: 13, max: 24 },
  { label: "24+ meses", min: 25, max: 9999 },
];

const Cancelamentos = () => {
  const { churnStatus, isLoading, error } = useChurnData();
  const { getChamadosPorCliente } = useChamados();
  const { getBucket } = useRiskBucketConfig();
  const { workflowMap } = useCrmWorkflow();

  const chamadosMap90d = useMemo(() => getChamadosPorCliente(90), [getChamadosPorCliente]);

  const [plano, setPlano] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [bucket, setBucket] = useState("todos");
  const [periodo, setPeriodo] = useState("todos");
  const [cohortMetric, setCohortMetric] = useState<"qtd" | "mrr" | "ltv">("qtd");

  // Cancelados
  const cancelados = useMemo(
    () => churnStatus.filter((c) => c.status_churn === "cancelado"),
    [churnStatus]
  );

  const totalAtivos = useMemo(
    () => churnStatus.filter((c) => c.status_churn !== "cancelado").length,
    [churnStatus]
  );

  // MaxDate for period filter (based on data_cancelamento)
  const maxDate = useMemo(() => {
    let max = new Date(0);
    cancelados.forEach((c) => {
      if (c.data_cancelamento) {
        const d = new Date(c.data_cancelamento + "T00:00:00");
        if (!isNaN(d.getTime()) && d > max) max = d;
      }
    });
    return max.getTime() > 0 ? max : new Date();
  }, [cancelados]);

  const filterOptions = useMemo(() => {
    const planos = new Set<string>();
    const cidades = new Set<string>();
    const bairros = new Set<string>();
    cancelados.forEach((c) => {
      if (c.plano_nome) planos.add(c.plano_nome);
      if (c.cliente_cidade) cidades.add(c.cliente_cidade);
      if (c.cliente_bairro) bairros.add(c.cliente_bairro);
    });
    return {
      planos: Array.from(planos).sort(),
      cidades: Array.from(cidades).sort(),
      bairros: Array.from(bairros).sort(),
    };
  }, [cancelados]);

  const filtered = useMemo(() => {
    let f = [...cancelados];
    if (plano !== "todos") f = f.filter((c) => c.plano_nome === plano);
    if (cidade !== "todos") f = f.filter((c) => c.cliente_cidade === cidade);
    if (bairro !== "todos") f = f.filter((c) => c.cliente_bairro === bairro);
    if (bucket !== "todos") f = f.filter((c) => getBucket(c.churn_risk_score) === bucket);

    // Period filter: "últimos X dias" relative to maxDate
    if (periodo !== "todos") {
      const dias = parseInt(periodo);
      const limite = new Date(maxDate.getTime() - dias * 24 * 60 * 60 * 1000);
      f = f.filter((c) => {
        if (!c.data_cancelamento) return false;
        return new Date(c.data_cancelamento + "T00:00:00") >= limite;
      });
    }

    return f.sort((a, b) => {
      const dA = a.data_cancelamento ? new Date(a.data_cancelamento + "T00:00:00").getTime() : 0;
      const dB = b.data_cancelamento ? new Date(b.data_cancelamento + "T00:00:00").getTime() : 0;
      return dB - dA;
    });
  }, [cancelados, plano, cidade, bairro, bucket, periodo, maxDate, getBucket]);

  // ─── KPIs ───
  const kpis = useMemo(() => {
    const totalCancelados = filtered.length;
    const totalBase = totalCancelados + totalAtivos;
    const taxaChurn = totalBase > 0 ? ((totalCancelados / totalBase) * 100).toFixed(2) : "0";
    const mrrPerdido = filtered.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    const ltvPerdido = filtered.reduce((acc, c) => acc + (c.ltv_estimado || 0), 0);
    const tickets = filtered.filter((c) => c.valor_mensalidade != null).map((c) => c.valor_mensalidade!);
    const ticketMedio = tickets.length > 0 ? (tickets.reduce((a, b) => a + b, 0) / tickets.length).toFixed(2) : "0";
    const datas = filtered.filter((c) => c.data_cancelamento).map((c) => new Date(c.data_cancelamento! + "T00:00:00"));
    const ultimoCancelamento = datas.length > 0
      ? new Date(Math.max(...datas.map((d) => d.getTime()))).toLocaleDateString("pt-BR")
      : null;
    return { totalCancelados, taxaChurn, mrrPerdido, ltvPerdido, ticketMedio, ultimoCancelamento };
  }, [filtered, totalAtivos]);

  // ─── Distribuição por Bucket no cancelamento ───
  const bucketDistribuicao = useMemo(() => {
    const counts = { OK: 0, ALERTA: 0, "CRÍTICO": 0 };
    filtered.forEach((c) => {
      const b = getBucket(c.churn_risk_score);
      counts[b]++;
    });
    const total = filtered.length;
    return [
      { bucket: "CRÍTICO", qtd: counts["CRÍTICO"], pct: total > 0 ? ((counts["CRÍTICO"] / total) * 100).toFixed(1) : "0", color: "#ef4444" },
      { bucket: "ALERTA", qtd: counts.ALERTA, pct: total > 0 ? ((counts.ALERTA / total) * 100).toFixed(1) : "0", color: "#eab308" },
      { bucket: "OK", qtd: counts.OK, pct: total > 0 ? ((counts.OK / total) * 100).toFixed(1) : "0", color: "#22c55e" },
    ];
  }, [filtered, getBucket]);

  // ─── Antecedência média ───
  const antecedencia = useMemo(() => {
    const dias = filtered
      .filter((c) => c.dias_em_risco != null && c.dias_em_risco > 0)
      .map((c) => c.dias_em_risco);
    if (dias.length === 0) return null;
    const media = Math.round(dias.reduce((a, b) => a + b, 0) / dias.length);
    const sorted = [...dias].sort((a, b) => a - b);
    const mediana = sorted[Math.floor(sorted.length / 2)];
    const faixas = [
      { label: "0–7 dias", count: dias.filter((d) => d <= 7).length },
      { label: "8–15 dias", count: dias.filter((d) => d >= 8 && d <= 15).length },
      { label: "16–30 dias", count: dias.filter((d) => d >= 16 && d <= 30).length },
      { label: "30+ dias", count: dias.filter((d) => d > 30).length },
    ].filter((f) => f.count > 0);
    return { media, mediana, faixas, totalComDados: dias.length };
  }, [filtered]);

  // ─── Cohort por tempo de assinatura ───
  const cohortTempo = useMemo(() => {
    return COHORT_FAIXAS.map((faixa) => {
      const clientes = filtered.filter((c) => {
        const meses = c.tempo_cliente_meses ?? 0;
        return meses >= faixa.min && meses <= faixa.max;
      });
      return {
        faixa: faixa.label,
        qtd: clientes.length,
        mrr: clientes.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0),
        ltv: clientes.reduce((acc, c) => acc + (c.ltv_estimado || 0), 0),
      };
    }).filter((f) => f.qtd > 0);
  }, [filtered]);

  // ─── Top Motivos ───
  const topMotivos = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((c) => {
      const m = c.motivo_risco_principal || STATUS_MOTIVO[c.status_internet || ""] || "Motivo não identificado";
      map[m] = (map[m] || 0) + 1;
    });
    return Object.entries(map)
      .map(([motivo, qtd]) => ({ motivo, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [filtered]);

  // ─── Cancelamentos por mês ───
  const cancelPorMes = useMemo(() => {
    const map: Record<string, number> = {};
    cancelados.forEach((c) => {
      if (c.data_cancelamento) {
        const d = new Date(c.data_cancelamento + "T00:00:00");
        const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        map[key] = (map[key] || 0) + 1;
      }
    });
    return Object.entries(map)
      .map(([mes, qtd]) => ({ mes, qtd }))
      .sort((a, b) => {
        const [ma, ya] = a.mes.split("/").map(Number);
        const [mb, yb] = b.mes.split("/").map(Number);
        return ya !== yb ? ya - yb : ma - mb;
      });
  }, [cancelados]);

  // ─── Comparativo Ativos vs Cancelados ───
  const comparativo = useMemo(() => {
    const ativos = churnStatus.filter((c) => c.status_churn === "ativo");
    const avg = (arr: number[]) => (arr.length > 0 ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0);
    return [
      { metric: "Score Risco", Ativos: avg(ativos.map((c) => c.churn_risk_score)), Cancelados: avg(filtered.map((c) => c.churn_risk_score)) },
      { metric: "Dias Atraso", Ativos: avg(ativos.filter((c) => (c.dias_atraso ?? 0) > 0).map((c) => c.dias_atraso!)), Cancelados: avg(filtered.filter((c) => (c.dias_atraso ?? 0) > 0).map((c) => c.dias_atraso!)) },
      { metric: "Ticket (R$)", Ativos: avg(ativos.filter((c) => c.valor_mensalidade != null).map((c) => c.valor_mensalidade!)), Cancelados: avg(filtered.filter((c) => c.valor_mensalidade != null).map((c) => c.valor_mensalidade!)) },
      { metric: "Tempo (m)", Ativos: avg(ativos.filter((c) => c.tempo_cliente_meses != null).map((c) => c.tempo_cliente_meses!)), Cancelados: avg(filtered.filter((c) => c.tempo_cliente_meses != null).map((c) => c.tempo_cliente_meses!)) },
    ];
  }, [churnStatus, filtered]);

  // ─── Filters ───
  const filters = [
    {
      id: "periodo", label: "Período", value: periodo, onChange: setPeriodo,
      options: [
        { value: "todos", label: "Tudo" },
        { value: "30", label: "Últimos 30 dias" },
        { value: "90", label: "Últimos 90 dias" },
        { value: "180", label: "Últimos 180 dias" },
        { value: "365", label: "Último ano" },
      ],
    },
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

  if (isLoading) return <div className="min-h-screen bg-background"><LoadingScreen /></div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Cancelamentos
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {cancelados.length.toLocaleString()} cancelamentos · Prova do sistema de churn
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
            <span className="text-sm">Erro: {error}</span>
          </div>
        )}

        <GlobalFilters filters={filters} />

        {/* Estado vazio */}
        {cancelados.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-3">
              <PackageX className="h-12 w-12 text-muted-foreground opacity-30" />
              <h3 className="font-semibold text-muted-foreground">Sem dados suficientes</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {churnStatus.length > 0
                  ? `${churnStatus.length.toLocaleString()} contratos monitorados — nenhum com status cancelado.`
                  : "Nenhum dado carregado para o ISP selecionado."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── A) Relação com o modelo ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICardNew title="Total Cancelados" value={kpis.totalCancelados.toLocaleString()} icon={Users} variant="danger" />
              <KPICardNew title="% em Risco (Churn)" value={`${kpis.taxaChurn}%`} icon={TrendingDown} variant="danger"
                tooltip="Cancelados / (Cancelados + Ativos). Não é taxa de risco." />
              <KPICardNew title="MRR Perdido" value={`R$ ${kpis.mrrPerdido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} variant="warning" />
              <KPICardNew title="LTV Perdido" value={`R$ ${kpis.ltvPerdido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={TrendingDown} variant="danger" />
              <KPICardNew title="Ticket Médio" value={`R$ ${kpis.ticketMedio}`} icon={DollarSign} variant="default" />
              <KPICardNew title="Último Cancelamento" value={kpis.ultimoCancelamento || "—"} icon={CalendarX} variant="default" />
            </div>

            {/* Bucket distribution + Antecedência */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Distribuição por Bucket */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    Distribuição por Bucket no Cancelamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {bucketDistribuicao.map((b) => (
                      <div key={b.bucket} className="flex items-center gap-3">
                        <Badge className={`${BUCKET_COLORS[b.bucket as RiskBucket]} border text-xs min-w-[70px] justify-center`}>
                          {b.bucket}
                        </Badge>
                        <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${b.pct}%`, backgroundColor: b.color }}
                          />
                        </div>
                        <span className="text-sm font-semibold min-w-[80px] text-right">
                          {b.qtd} ({b.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Bucket calculado pelo score de risco no momento do registro
                  </p>
                </CardContent>
              </Card>

              {/* Antecedência */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Antecedência — Dias em Risco antes do Cancelamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {antecedencia ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-foreground">{antecedencia.media}d</p>
                          <p className="text-xs text-muted-foreground">Média</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-foreground">{antecedencia.mediana}d</p>
                          <p className="text-xs text-muted-foreground">Mediana</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-foreground">{antecedencia.totalComDados}</p>
                          <p className="text-xs text-muted-foreground">Com dados</p>
                        </div>
                      </div>
                      {antecedencia.faixas.length > 0 && (
                        <div className="space-y-1.5">
                          {antecedencia.faixas.map((f) => (
                            <div key={f.label} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{f.label}</span>
                              <span className="font-medium">{f.count} clientes</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Sem dados de dias em risco para calcular antecedência.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── C) Cohort por tempo de assinatura ── */}
            {cohortTempo.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Cohort de Cancelamento por Tempo de Assinatura
                    </CardTitle>
                    <div className="flex gap-1">
                      {(["qtd", "mrr", "ltv"] as const).map((m) => (
                        <Button
                          key={m}
                          size="sm"
                          variant={cohortMetric === m ? "default" : "ghost"}
                          className="h-7 text-xs"
                          onClick={() => setCohortMetric(m)}
                        >
                          {m === "qtd" ? "Quantidade" : m === "mrr" ? "MRR Perdido" : "LTV Perdido"}
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={cohortTempo} margin={{ top: 4, right: 8, bottom: 8, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        tickFormatter={
                          cohortMetric === "qtd"
                            ? (v) => `${v}`
                            : (v) => `R$${(v / 1000).toFixed(0)}k`
                        }
                      />
                      <Tooltip
                        formatter={(v: any) => [
                          cohortMetric === "qtd"
                            ? `${v} clientes`
                            : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`,
                          cohortMetric === "qtd" ? "Cancelados" : cohortMetric === "mrr" ? "MRR Perdido" : "LTV Perdido",
                        ]}
                      />
                      <Bar dataKey={cohortMetric} fill="hsl(var(--destructive) / 0.7)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Cancelamentos por mês */}
            {cancelPorMes.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Cancelamentos por Mês</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={cancelPorMes} margin={{ top: 4, right: 8, bottom: 8, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => [v.toLocaleString(), "Cancelamentos"]} />
                      <Bar dataKey="qtd" fill="hsl(var(--destructive) / 0.7)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* ── B) Tabela principal (cancelados) ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Clientes Cancelados — {filtered.length.toLocaleString()} registros
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[480px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs whitespace-nowrap">Cliente</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Data Canc.</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center">Score/Bucket</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Driver</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Plano</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-right">Mensalidade</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center">Dias Atraso</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center">Chamados 90d</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center">Meses</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center">NPS</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center">CRM</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-right">LTV</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={12} className="text-center text-muted-foreground py-10 text-sm">
                            Nenhum cancelamento com os filtros aplicados.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filtered.map((c) => {
                          const b = getBucket(c.churn_risk_score);
                          const wf = workflowMap.get(c.cliente_id);
                          return (
                            <TableRow key={c.id || c.cliente_id} className="hover:bg-muted/50 transition-colors">
                              <TableCell className="text-xs font-medium max-w-[130px] truncate">{c.cliente_nome || "—"}</TableCell>
                              <TableCell className="text-xs font-medium text-destructive">
                                {c.data_cancelamento
                                  ? new Date(c.data_cancelamento + "T00:00:00").toLocaleDateString("pt-BR")
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={`${BUCKET_COLORS[b]} border font-mono text-[10px]`}>
                                  {c.churn_risk_score} · {b}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs max-w-[120px] truncate text-muted-foreground">
                                {c.motivo_risco_principal || STATUS_MOTIVO[c.status_internet || ""] || "—"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[100px] truncate">{c.plano_nome || "—"}</TableCell>
                              <TableCell className="text-right text-xs">
                                {c.valor_mensalidade != null ? `R$ ${c.valor_mensalidade.toFixed(2)}` : "—"}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {c.dias_atraso != null && c.dias_atraso > 0 ? (
                                  <span className={c.dias_atraso > 30 ? "text-destructive font-medium" : "text-yellow-600"}>
                                    {Math.round(c.dias_atraso)}d
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {chamadosMap90d.get(c.cliente_id)?.chamados_periodo ?? 0}
                              </TableCell>
                              <TableCell className="text-center text-xs">{c.tempo_cliente_meses ?? "—"}</TableCell>
                              <TableCell className="text-center text-xs">
                                {c.nps_ultimo_score != null ? (
                                  <Badge variant="outline" className={`text-[10px] ${
                                    c.nps_ultimo_score <= 6 ? "border-destructive text-destructive" :
                                    c.nps_ultimo_score <= 8 ? "border-yellow-500 text-yellow-600" :
                                    "border-green-500 text-green-600"
                                  }`}>
                                    {c.nps_ultimo_score}
                                  </Badge>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-center text-xs">
                                {wf ? (
                                  <Badge variant="outline" className={`text-[10px] ${
                                    wf.status_workflow === "perdido" ? "border-destructive text-destructive" :
                                    wf.status_workflow === "resolvido" ? "border-green-500 text-green-600" :
                                    "border-yellow-500 text-yellow-600"
                                  }`}>
                                    {wf.status_workflow === "em_tratamento" ? "Tratando" :
                                     wf.status_workflow === "resolvido" ? "Resolvido" : "Perdido"}
                                  </Badge>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {c.ltv_estimado != null ? `R$ ${c.ltv_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—"}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Motivos + Comparativo */}
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
                          <YAxis type="category" dataKey="motivo" tick={{ fontSize: 10 }} width={150} />
                          <Tooltip formatter={(v: any) => [v, "Cancelamentos"]} />
                          <Bar dataKey="qtd" radius={[0, 4, 4, 0]}>
                            {topMotivos.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
                  )}
                </CardContent>
              </Card>

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
                        <Legend />
                        <Bar dataKey="Ativos" name="Ativos" fill="hsl(var(--primary) / 0.7)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Cancelados" name="Cancelados" fill="hsl(var(--destructive) / 0.7)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[240px] flex items-center justify-center text-muted-foreground text-sm">Sem dados comparativos disponíveis</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Cancelamentos;
