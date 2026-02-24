import { useState, useMemo, useCallback } from "react";
import { useChurnData, ChurnStatus, ChurnEvent } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { useRiskBucketConfig, RiskBucket } from "@/hooks/useRiskBucketConfig";
import { useCrmWorkflow } from "@/hooks/useCrmWorkflow";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { CrmDrawer } from "@/components/crm/CrmDrawer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, Users, TrendingDown, DollarSign, CalendarX,
  PackageX, ShieldAlert, Info, ArrowUpDown, ChevronUp, ChevronDown,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const BUCKET_COLORS: Record<RiskBucket, string> = {
  OK: "bg-green-100 text-green-800 border-green-200",
  ALERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "CRÍTICO": "bg-red-100 text-red-800 border-red-200",
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f59e0b", "#6b7280"];
const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

const STATUS_MOTIVO: Record<string, string> = {
  D: "Desativação direta",
  CA: "Bloqueio por cobrança automática",
  CM: "Bloqueio por cobrança manual",
};

const COHORT_FAIXAS = [
  { label: "0–3m", min: 0, max: 3 },
  { label: "4–6m", min: 4, max: 6 },
  { label: "7–12m", min: 7, max: 12 },
  { label: "13–24m", min: 13, max: 24 },
  { label: "24m+", min: 25, max: 9999 },
];

type SortField = "cliente_nome" | "data_cancelamento" | "churn_risk_score" | "valor_mensalidade" | "dias_atraso" | "tempo_cliente_meses" | "ltv_estimado";
type SortDir = "asc" | "desc";

const Cancelamentos = () => {
  const { churnStatus, churnEvents, isLoading, error } = useChurnData();
  const { getChamadosPorCliente, chamados: allChamados } = useChamados();
  const { getBucket } = useRiskBucketConfig();
  const { workflowMap, addToWorkflow, updateStatus, updateTags, updateOwner } = useCrmWorkflow();

  const chamadosMap90d = useMemo(() => getChamadosPorCliente(90), [getChamadosPorCliente]);

  const [plano, setPlano] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [bucket, setBucket] = useState("todos");
  const [periodo, setPeriodo] = useState("todos");
  const [cohortMetric, setCohortMetric] = useState<"qtd" | "mrr" | "ltv">("qtd");
  const [sortField, setSortField] = useState<SortField>("data_cancelamento");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedCliente, setSelectedCliente] = useState<ChurnStatus | null>(null);

  // Cancelados
  const cancelados = useMemo(
    () => churnStatus.filter((c) => c.status_churn === "cancelado"),
    [churnStatus]
  );

  const totalAtivos = useMemo(
    () => churnStatus.filter((c) => c.status_churn !== "cancelado").length,
    [churnStatus]
  );

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

    if (periodo !== "todos") {
      const dias = parseInt(periodo);
      const limite = new Date(maxDate.getTime() - dias * 24 * 60 * 60 * 1000);
      f = f.filter((c) => {
        if (!c.data_cancelamento) return false;
        return new Date(c.data_cancelamento + "T00:00:00") >= limite;
      });
    }

    // Sort
    f.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortField) {
        case "cliente_nome": valA = a.cliente_nome || ""; valB = b.cliente_nome || ""; break;
        case "data_cancelamento":
          valA = a.data_cancelamento ? new Date(a.data_cancelamento + "T00:00:00").getTime() : 0;
          valB = b.data_cancelamento ? new Date(b.data_cancelamento + "T00:00:00").getTime() : 0;
          break;
        case "churn_risk_score": valA = a.churn_risk_score; valB = b.churn_risk_score; break;
        case "valor_mensalidade": valA = a.valor_mensalidade ?? 0; valB = b.valor_mensalidade ?? 0; break;
        case "dias_atraso": valA = a.dias_atraso ?? 0; valB = b.dias_atraso ?? 0; break;
        case "tempo_cliente_meses": valA = a.tempo_cliente_meses ?? 0; valB = b.tempo_cliente_meses ?? 0; break;
        case "ltv_estimado": valA = a.ltv_estimado ?? 0; valB = b.ltv_estimado ?? 0; break;
        default: valA = 0; valB = 0;
      }
      if (typeof valA === "string") {
        return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === "asc" ? valA - valB : valB - valA;
    });

    return f;
  }, [cancelados, plano, cidade, bairro, bucket, periodo, maxDate, getBucket, sortField, sortDir]);

  // ─── KPIs ───
  const kpis = useMemo(() => {
    const totalCancelados = filtered.length;
    const totalBase = totalCancelados + totalAtivos;
    const taxaChurn = totalBase > 0 ? ((totalCancelados / totalBase) * 100).toFixed(2) : "0";
    const mrrPerdido = filtered.reduce((acc, c) => acc + (c.valor_mensalidade || 0), 0);
    // LTV = mensalidade * tempo_cliente_meses (se disponível), senão usa ltv_estimado
    const ltvPerdido = filtered.reduce((acc, c) => {
      if (c.ltv_estimado != null && c.ltv_estimado > 0) return acc + c.ltv_estimado;
      if (c.valor_mensalidade && c.tempo_cliente_meses) return acc + (c.valor_mensalidade * c.tempo_cliente_meses);
      return acc;
    }, 0);
    const tickets = filtered.filter((c) => c.valor_mensalidade != null).map((c) => c.valor_mensalidade!);
    const ticketMedio = tickets.length > 0 ? (tickets.reduce((a, b) => a + b, 0) / tickets.length).toFixed(2) : "0";
    const datas = filtered.filter((c) => c.data_cancelamento).map((c) => new Date(c.data_cancelamento! + "T00:00:00"));
    const ultimoCancelamento = datas.length > 0
      ? new Date(Math.max(...datas.map((d) => d.getTime()))).toLocaleDateString("pt-BR")
      : null;
    return { totalCancelados, taxaChurn, mrrPerdido, ltvPerdido, ticketMedio, ultimoCancelamento };
  }, [filtered, totalAtivos]);

  // ─── Distribuição por Bucket ───
  const bucketDistribuicao = useMemo(() => {
    const counts = { OK: 0, ALERTA: 0, "CRÍTICO": 0 };
    filtered.forEach((c) => { counts[getBucket(c.churn_risk_score)]++; });
    const total = filtered.length;
    return [
      { bucket: "CRÍTICO", qtd: counts["CRÍTICO"], pct: total > 0 ? ((counts["CRÍTICO"] / total) * 100).toFixed(1) : "0", color: "#ef4444" },
      { bucket: "ALERTA", qtd: counts.ALERTA, pct: total > 0 ? ((counts.ALERTA / total) * 100).toFixed(1) : "0", color: "#eab308" },
      { bucket: "OK", qtd: counts.OK, pct: total > 0 ? ((counts.OK / total) * 100).toFixed(1) : "0", color: "#22c55e" },
    ];
  }, [filtered, getBucket]);

  // ─── Cohort por tempo de assinatura (PieChart) ───
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
        ltv: clientes.reduce((acc, c) => {
          if (c.ltv_estimado != null && c.ltv_estimado > 0) return acc + c.ltv_estimado;
          if (c.valor_mensalidade && c.tempo_cliente_meses) return acc + (c.valor_mensalidade * c.tempo_cliente_meses);
          return acc;
        }, 0),
      };
    }).filter((f) => f.qtd > 0);
  }, [filtered]);

  // ─── Top Motivos (using events + churn_status data, grouped by date ranges) ───
  const topMotivos = useMemo(() => {
    // Get cancelled client IDs
    const canceladoIds = new Set(filtered.map((c) => c.cliente_id));
    
    // Collect motivos from multiple sources
    const motivoMap: Record<string, number> = {};
    
    // 1. From churn_status motivo_risco_principal  
    filtered.forEach((c) => {
      const m = c.motivo_risco_principal || STATUS_MOTIVO[c.status_internet || ""] || null;
      if (m) motivoMap[m] = (motivoMap[m] || 0) + 1;
    });
    
    // 2. From churn_events for cancelled clients (broader motivos)
    churnEvents
      .filter((e) => canceladoIds.has(e.cliente_id))
      .forEach((e) => {
        // Map event types to readable motivos
        const label = e.descricao || e.tipo_evento;
        if (label && !label.includes("score_") && e.tipo_evento !== "cancelamento_real") {
          motivoMap[label] = (motivoMap[label] || 0) + 1;
        }
      });

    return Object.entries(motivoMap)
      .map(([motivo, qtd]) => ({ motivo, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [filtered, churnEvents]);

  // ─── Cancelamentos por mês (all data, not just filtered) ───
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

  // ─── Sort handler ───
  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }, [sortField]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />;
  };

  // ─── CRM Drawer helpers ───
  // Build events: real events + synthetic fallback from client data
  const selectedEvents = useMemo(() => {
    if (!selectedCliente) return [];
    const c = selectedCliente;
    const realEvents = churnEvents.filter((e) => e.cliente_id === c.cliente_id);
    
    // Deduplicate: remove events with same tipo_evento on the same date
    const deduped: typeof realEvents = [];
    const seen = new Set<string>();
    for (const e of realEvents) {
      const dateKey = e.data_evento?.split("T")[0] || "";
      const key = `${e.tipo_evento}__${dateKey}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(e);
      }
    }

    // If we have real events, use them
    if (deduped.length > 0) return deduped;

    // Otherwise, generate synthetic events from client scores/data
    const synthetic: ChurnEvent[] = [];
    const baseDate = c.data_cancelamento || c.updated_at || new Date().toISOString();
    const makeEvent = (tipo: string, desc: string, impacto: number, date?: string): ChurnEvent => ({
      id: `synthetic-${tipo}-${c.cliente_id}`,
      isp_id: c.isp_id,
      cliente_id: c.cliente_id,
      id_contrato: c.id_contrato,
      tipo_evento: tipo,
      peso_evento: 1,
      impacto_score: impacto,
      descricao: desc,
      dados_evento: null,
      data_evento: date || baseDate,
      created_at: baseDate,
    });

    if (c.score_financeiro > 0) {
      const desc = c.dias_atraso && c.dias_atraso > 0
        ? `Atraso de ${Math.round(c.dias_atraso)} dias detectado`
        : `Score financeiro elevado`;
      synthetic.push(makeEvent("inadimplencia_iniciou", desc, c.score_financeiro, c.ultimo_pagamento_data || baseDate));
    }
    if (c.score_suporte > 0 || c.qtd_chamados_90d >= 3) {
      const total30 = c.qtd_chamados_30d || 0;
      const total90 = c.qtd_chamados_90d || 0;
      const desc = total30 > 0
        ? `${total30} chamados (30d) / ${total90} chamados (90d)`
        : `${total90} chamados nos últimos 90 dias`;
      synthetic.push(makeEvent("chamado_reincidente", desc, c.score_suporte || 5));
    }
    if (c.score_nps > 0 && c.nps_ultimo_score != null) {
      const tipo = c.nps_ultimo_score <= 6 ? "nps_detrator" : "risco_aumentou";
      synthetic.push(makeEvent(tipo, `NPS Score: ${c.nps_ultimo_score} (${c.nps_classificacao || "—"})`, c.score_nps));
    }
    if (c.score_qualidade > 0) {
      synthetic.push(makeEvent("score_qualidade", `Score de qualidade elevado`, c.score_qualidade));
    }
    if (c.score_comportamental > 0) {
      synthetic.push(makeEvent("score_comportamental", `Score comportamental elevado`, c.score_comportamental));
    }
    if (c.status_churn === "cancelado" && c.data_cancelamento) {
      synthetic.push(makeEvent("cancelamento_real", `Cancelamento confirmado em ${new Date(c.data_cancelamento + "T00:00:00").toLocaleDateString("pt-BR")}`, 0, c.data_cancelamento));
    }

    return synthetic.sort((a, b) => new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime());
  }, [selectedCliente, churnEvents]);

  const selectedChamados = useMemo(() => {
    if (!selectedCliente) return [];
    return allChamados.filter((ch) => {
      const id = typeof ch.id_cliente === "string" ? parseInt(ch.id_cliente) : ch.id_cliente;
      return id === selectedCliente.cliente_id;
    });
  }, [selectedCliente, allChamados]);

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
            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <KPICardNew title="Total Cancelados" value={kpis.totalCancelados.toLocaleString()} icon={Users} variant="danger" />
              <KPICardNew title="% em Risco (Churn)" value={`${kpis.taxaChurn}%`} icon={TrendingDown} variant="danger"
                tooltip="Cancelados / (Cancelados + Ativos)" />
              <KPICardNew title="MRR Perdido" value={`R$ ${kpis.mrrPerdido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={DollarSign} variant="warning" />
              <KPICardNew title="LTV Perdido" value={`R$ ${kpis.ltvPerdido.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`} icon={TrendingDown} variant="danger" />
              <KPICardNew title="Ticket Médio" value={`R$ ${kpis.ticketMedio}`} icon={DollarSign} variant="default" />
              <KPICardNew title="Último Cancelamento" value={kpis.ultimoCancelamento || "—"} icon={CalendarX} variant="default" />
            </div>

            {/* Bucket distribution + Cohort Pie */}
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

              {/* Cohort Pie Chart */}
              {cohortTempo.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Cohort por Tempo de Assinatura
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
                            {m === "qtd" ? "Qtd" : m === "mrr" ? "MRR" : "LTV"}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={cohortTempo}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={100}
                          paddingAngle={3}
                          dataKey={cohortMetric}
                          nameKey="faixa"
                          label={({ faixa, percent }) =>
                            percent > 0.04 ? `${faixa} (${(percent * 100).toFixed(0)}%)` : ""
                          }
                          labelLine={{ strokeWidth: 1 }}
                        >
                          {cohortTempo.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: any) => [
                            cohortMetric === "qtd"
                              ? `${v} clientes`
                              : `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`,
                            cohortMetric === "qtd" ? "Cancelados" : cohortMetric === "mrr" ? "MRR Perdido" : "LTV Perdido",
                          ]}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

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

            {/* ── Tabela principal (cancelados) com sorting ── */}
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
                        <TableHead className="text-xs whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("cliente_nome")}>
                          <span className="flex items-center">Cliente<SortIcon field="cliente_nome" /></span>
                        </TableHead>
                        <TableHead className="text-xs whitespace-nowrap cursor-pointer select-none" onClick={() => toggleSort("data_cancelamento")}>
                          <span className="flex items-center">Data Canc.<SortIcon field="data_cancelamento" /></span>
                        </TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("churn_risk_score")}>
                          <span className="flex items-center justify-center">Score/Bucket<SortIcon field="churn_risk_score" /></span>
                        </TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Driver</TableHead>
                        <TableHead className="text-xs whitespace-nowrap">Plano</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-right cursor-pointer select-none" onClick={() => toggleSort("valor_mensalidade")}>
                          <span className="flex items-center justify-end">Mensalidade<SortIcon field="valor_mensalidade" /></span>
                        </TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("dias_atraso")}>
                          <span className="flex items-center justify-center">Dias Atraso<SortIcon field="dias_atraso" /></span>
                        </TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center">Chamados 90d</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center cursor-pointer select-none" onClick={() => toggleSort("tempo_cliente_meses")}>
                          <span className="flex items-center justify-center">Meses<SortIcon field="tempo_cliente_meses" /></span>
                        </TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center">NPS</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-center">CRM</TableHead>
                        <TableHead className="text-xs whitespace-nowrap text-right cursor-pointer select-none" onClick={() => toggleSort("ltv_estimado")}>
                          <span className="flex items-center justify-end">LTV<SortIcon field="ltv_estimado" /></span>
                        </TableHead>
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
                          const ltvCalc = c.ltv_estimado != null && c.ltv_estimado > 0
                            ? c.ltv_estimado
                            : (c.valor_mensalidade && c.tempo_cliente_meses ? c.valor_mensalidade * c.tempo_cliente_meses : null);
                          return (
                            <TableRow
                              key={c.id || c.cliente_id}
                              className="hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => setSelectedCliente(c)}
                            >
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
                                {ltvCalc != null ? `R$ ${ltvCalc.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}` : "—"}
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

            {/* Top Motivos (full width) */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top 10 Motivos de Cancelamento</CardTitle>
              </CardHeader>
              <CardContent>
                {topMotivos.length > 0 ? (
                  <div className="max-h-[320px] overflow-y-auto">
                    <ResponsiveContainer width="100%" height={Math.max(200, topMotivos.length * 32 + 20)}>
                      <BarChart data={topMotivos} layout="vertical" margin={{ left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="motivo" tick={{ fontSize: 10 }} width={180} />
                        <Tooltip formatter={(v: any) => [v, "Ocorrências"]} />
                        <Bar dataKey="qtd" radius={[0, 4, 4, 0]}>
                          {topMotivos.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Sem dados disponíveis</div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* CRM Drawer for client history */}
      {selectedCliente && (
        <CrmDrawer
          cliente={selectedCliente}
          score={selectedCliente.churn_risk_score}
          bucket={getBucket(selectedCliente.churn_risk_score)}
          workflow={workflowMap.get(selectedCliente.cliente_id)}
          events={selectedEvents}
          chamadosCliente={selectedChamados}
          onClose={() => setSelectedCliente(null)}
          onStartTreatment={() => addToWorkflow(selectedCliente.cliente_id)}
          onUpdateStatus={(s) => updateStatus(selectedCliente.cliente_id, s)}
          onUpdateTags={(t) => updateTags(selectedCliente.cliente_id, t)}
          onUpdateOwner={(o) => updateOwner(selectedCliente.cliente_id, o || "")}
        />
      )}
    </div>
  );
};

export default Cancelamentos;
