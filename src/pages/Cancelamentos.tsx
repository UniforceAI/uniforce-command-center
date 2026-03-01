import { useState, useMemo, useCallback } from "react";
import { FAIXAS_AGING } from "@/types/evento";
import { useChurnData, ChurnStatus, ChurnEvent } from "@/hooks/useChurnData";
import { useChamados } from "@/hooks/useChamados";
import { useRiskBucketConfig, RiskBucket } from "@/hooks/useRiskBucketConfig";
import { useCrmWorkflow } from "@/hooks/useCrmWorkflow";
import { useChurnScoreConfig, calcScoreSuporteConfiguravel } from "@/contexts/ChurnScoreConfigContext";
import { useChurnScore } from "@/hooks/useChurnScore";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { CrmDrawer } from "@/components/crm/CrmDrawer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertCircle, Users, TrendingDown, DollarSign, CalendarX,
  PackageX, ShieldAlert, Info, ArrowUpDown, ChevronUp, ChevronDown,
  BarChart3, Clock,
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const barColor = (pct: number) => {
  if (pct >= 20) return "hsl(var(--destructive))";
  if (pct >= 10) return "hsl(38 92% 50%)";
  return "hsl(var(--primary))";
};

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
  { label: "< 1 mês", min: 0, max: 0 },
  { label: "1–3 meses", min: 1, max: 3 },
  { label: "4–12 meses", min: 4, max: 12 },
  { label: "13–24 meses", min: 13, max: 24 },
  { label: "25–36 meses", min: 25, max: 36 },
  { label: "36+ meses", min: 37, max: 9999 },
];

type SortField = "cliente_nome" | "data_cancelamento" | "churn_risk_score" | "valor_mensalidade" | "dias_atraso" | "tempo_cliente_meses" | "ltv_estimado";
type SortDir = "asc" | "desc";

const fmtBRL = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const Cancelamentos = () => {
  const { churnStatus, churnEvents, isLoading, error } = useChurnData();
  const { getChamadosPorCliente, chamados: allChamados } = useChamados();
  const { getBucket } = useRiskBucketConfig();
  const { workflowMap, addToWorkflow, updateStatus, updateTags, updateOwner } = useCrmWorkflow();
  const { config } = useChurnScoreConfig();
  const { getScoreTotalReal } = useChurnScore();

  const chamadosMap30d = useMemo(() => getChamadosPorCliente(30), [getChamadosPorCliente]);
  const chamadosMap90d = useMemo(() => getChamadosPorCliente(90), [getChamadosPorCliente]);

  // Cancelados com score recalculado centralizado
  const cancelados = useMemo(() => {
    return churnStatus
      .filter((c) => c.status_churn === "cancelado")
      .map((c) => {
        const ch30 = chamadosMap30d.get(c.cliente_id)?.chamados_periodo ?? c.qtd_chamados_30d ?? 0;
        const ch90 = chamadosMap90d.get(c.cliente_id)?.chamados_periodo ?? c.qtd_chamados_90d ?? 0;
        const newScoreSuporte = calcScoreSuporteConfiguravel(ch30, ch90, config);
        const newTotalScore = getScoreTotalReal(c);
        return {
          ...c,
          qtd_chamados_30d: ch30,
          qtd_chamados_90d: ch90,
          score_suporte: newScoreSuporte,
          churn_risk_score: newTotalScore,
        };
      });
  }, [churnStatus, chamadosMap30d, chamadosMap90d, config, getScoreTotalReal]);

  const [plano, setPlano] = useState("todos");
  const [cidade, setCidade] = useState("todos");
  const [bairro, setBairro] = useState("todos");
  const [bucket, setBucket] = useState("todos");
  const [churnDimension, setChurnDimension] = useState<"plano" | "cidade" | "bairro">("plano");
  const [periodo, setPeriodo] = useState("7");
  const [cohortMetric, setCohortMetric] = useState<"qtd" | "mrr" | "ltv">("qtd");
  const [sortField, setSortField] = useState<SortField>("data_cancelamento");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedCliente, setSelectedCliente] = useState<ChurnStatus | null>(null);

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
    const ltvPerdido = filtered.reduce((acc, c) => {
      if (c.ltv_estimado != null && c.ltv_estimado > 0) return acc + c.ltv_estimado;
      if (c.valor_mensalidade && c.tempo_cliente_meses) return acc + (c.valor_mensalidade * c.tempo_cliente_meses);
      return acc;
    }, 0);
    const tickets = filtered.filter((c) => c.valor_mensalidade != null).map((c) => c.valor_mensalidade!);
    const ticketMedio = tickets.length > 0 ? tickets.reduce((a, b) => a + b, 0) / tickets.length : 0;
    const tempos = filtered.filter(c => c.tempo_cliente_meses != null).map(c => c.tempo_cliente_meses!);
    const tempoMedio = tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0;
    const datas = filtered.filter((c) => c.data_cancelamento).map((c) => new Date(c.data_cancelamento! + "T00:00:00"));
    const ultimoCancelamento = datas.length > 0
      ? new Date(Math.max(...datas.map((d) => d.getTime()))).toLocaleDateString("pt-BR")
      : null;
    return { totalCancelados, taxaChurn, mrrPerdido, ltvPerdido, ticketMedio, tempoMedio, ultimoCancelamento };
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

  // ─── Cohort por tempo de assinatura ───
  const cohortTempo = useMemo(() => {
    // Helper: derive months — for canceled clients, prefer date diff for accuracy
    const getMeses = (c: ChurnStatus): number | null => {
      // 1. Para cancelados: priorizar cálculo data_cancelamento - data_instalacao
      if (c.status_churn === "cancelado" && c.data_instalacao) {
        const inst = new Date(c.data_instalacao + "T00:00:00");
        if (!isNaN(inst.getTime())) {
          const end = c.data_cancelamento
            ? new Date(c.data_cancelamento + "T00:00:00")
            : new Date();
          if (!isNaN(end.getTime())) {
            const diff = (end.getTime() - inst.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
            return Math.max(0, Math.round(diff));
          }
        }
      }
      // 2. Campo direto
      if (c.tempo_cliente_meses != null && c.tempo_cliente_meses > 0) return c.tempo_cliente_meses;
      // 3. LTV meses (proxy calculado pelo backend)
      if (c.ltv_meses_estimado != null && c.ltv_meses_estimado > 0) return c.ltv_meses_estimado;
      // 4. Cálculo genérico por datas
      if (c.data_instalacao) {
        const inst = new Date(c.data_instalacao + "T00:00:00");
        if (!isNaN(inst.getTime())) {
          const diff = (new Date().getTime() - inst.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
          return Math.max(0, Math.round(diff));
        }
      }
      return null;
    };

    return COHORT_FAIXAS.map((faixa) => {
      const clientes = filtered.filter((c) => {
        const meses = getMeses(c);
        if (meses === null) return false; // exclude unknowns from cohort
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
    });
  }, [filtered]);

  // ─── Cohort Churn por Dimensão (cancelados vs total por plano/cidade/bairro) ───
  const churnPorDimensao = useMemo(() => {
    const getKey = (c: ChurnStatus): string | null => {
      switch (churnDimension) {
        case "plano": return c.plano_nome || null;
        case "cidade": return c.cliente_cidade || null;
        case "bairro": return c.cliente_bairro || null;
      }
    };

    // Apply filters to full dataset
    let f = [...churnStatus];
    if (plano !== "todos") f = f.filter((c) => c.plano_nome === plano);
    if (cidade !== "todos") f = f.filter((c) => c.cliente_cidade === cidade);
    if (bairro !== "todos") f = f.filter((c) => c.cliente_bairro === bairro);
    if (bucket !== "todos") f = f.filter((c) => getBucket(c.churn_risk_score) === bucket);

    const map: Record<string, { cancelados: number; total: number; mrr: number }> = {};
    f.forEach((c) => {
      const key = getKey(c);
      if (!key) return;
      if (!map[key]) map[key] = { cancelados: 0, total: 0, mrr: 0 };
      map[key].total++;
      if (c.status_churn === "cancelado") {
        map[key].cancelados++;
        map[key].mrr += c.valor_mensalidade || 0;
      }
    });

    const truncate = (s: string, max: number) => s.length > max ? s.substring(0, max) + "…" : s;

    return Object.entries(map)
      .map(([nome, d]) => ({
        nome,
        label: truncate(nome, 25),
        cancelados: d.cancelados,
        total: d.total,
        pct: d.total > 0 ? parseFloat(((d.cancelados / d.total) * 100).toFixed(1)) : 0,
        mrr: Math.round(d.mrr),
      }))
      .filter((d) => d.total >= 3 && d.cancelados > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 10);
  }, [churnStatus, plano, cidade, bairro, bucket, getBucket, churnDimension]);
  

  // ─── Top Motivos (enriched: events + status + score pillars) ───
  const topMotivos = useMemo(() => {
    const canceladoIds = new Set(filtered.map((c) => c.cliente_id));
    const motivoMap: Record<string, number> = {};

    // 1. motivo_risco_principal
    filtered.forEach((c) => {
      const m = c.motivo_risco_principal || STATUS_MOTIVO[c.status_internet || ""] || null;
      if (m) motivoMap[m] = (motivoMap[m] || 0) + 1;
    });

    // 2. churn_events
    churnEvents
      .filter((e) => canceladoIds.has(e.cliente_id))
      .forEach((e) => {
        const label = e.descricao || e.tipo_evento;
        if (label && !label.includes("score_") && e.tipo_evento !== "cancelamento_real") {
          motivoMap[label] = (motivoMap[label] || 0) + 1;
        }
      });

    // 3. Enrich from score pillars for diversity
    filtered.forEach((c) => {
      if (c.score_suporte > 0 && (c.qtd_chamados_90d ?? 0) >= 3) {
        motivoMap["Suporte recorrente"] = (motivoMap["Suporte recorrente"] || 0) + 1;
      }
      if (c.nps_ultimo_score != null && c.nps_ultimo_score <= 6) {
        motivoMap["NPS Detrator"] = (motivoMap["NPS Detrator"] || 0) + 1;
      }
      if (c.score_comportamental > 0) {
        motivoMap["Padrão comportamental"] = (motivoMap["Padrão comportamental"] || 0) + 1;
      }
      if (c.score_qualidade > 0) {
        motivoMap["Qualidade de rede"] = (motivoMap["Qualidade de rede"] || 0) + 1;
      }
    });

    return Object.entries(motivoMap)
      .map(([motivo, qtd]) => ({ motivo, qtd }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [filtered, churnEvents]);

  // ─── Cancelamentos por mês (line chart) ───
  const cancelPorMes = useMemo(() => {
    const map: Record<string, { qtd: number; mrr: number }> = {};
    cancelados.forEach((c) => {
      if (c.data_cancelamento) {
        const d = new Date(c.data_cancelamento + "T00:00:00");
        const key = `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
        if (!map[key]) map[key] = { qtd: 0, mrr: 0 };
        map[key].qtd += 1;
        map[key].mrr += c.valor_mensalidade || 0;
      }
    });
    return Object.entries(map)
      .map(([mes, data]) => ({ mes, ...data }))
      .sort((a, b) => {
        const [ma, ya] = a.mes.split("/").map(Number);
        const [mb, yb] = b.mes.split("/").map(Number);
        return ya !== yb ? ya - yb : ma - mb;
      });
  }, [cancelados]);

  // ─── Churn por Aging (Dias de Atraso) ───
  const agingChurnData = useMemo(() => {
    const faixas = [
      ...FAIXAS_AGING.map(f => ({ ...f, qtd: 0 })),
      { min: 0, max: 0, label: "Sem atraso", qtd: 0 },
    ];

    filtered.forEach((c) => {
      const dias = c.dias_atraso ?? 0;
      if (dias <= 0) {
        faixas[faixas.length - 1].qtd++;
        return;
      }
      const idx = FAIXAS_AGING.findIndex(f => dias >= f.min && dias <= f.max);
      if (idx >= 0) faixas[idx].qtd++;
    });

    const total = filtered.length;
    return faixas.map(f => ({
      faixa: f.label,
      qtd: f.qtd,
      pct: total > 0 ? parseFloat(((f.qtd / total) * 100).toFixed(1)) : 0,
    }));
  }, [filtered]);

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
  const selectedEvents = useMemo(() => {
    if (!selectedCliente) return [];
    const c = selectedCliente;
    const realEvents = churnEvents
      .filter((e) => e.cliente_id === c.cliente_id)
      .filter((e) => e.tipo_evento !== "chamado_reincidente" && e.tipo_evento !== "nps_detrator");

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

    const merged = [...deduped];
    const seenTypes = new Set<string>();
    for (const e of deduped) {
      const dateKey = e.data_evento?.split("T")[0] || "";
      seenTypes.add(`${e.tipo_evento}__${dateKey}`);
    }
    for (const s of synthetic) {
      const dateKey = s.data_evento?.split("T")[0] || "";
      const key = `${s.tipo_evento}__${dateKey}`;
      if (!seenTypes.has(key)) {
        seenTypes.add(key);
        merged.push(s);
      }
    }

    return merged.sort((a, b) => new Date(b.data_evento).getTime() - new Date(a.data_evento).getTime());
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
                {cancelados.length.toLocaleString()} cancelamentos · Análise de perdas
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
            {/* ── KPIs — 2 rows of 3 ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Row 1: Volume */}
              <Card className="border-l-4 border-l-destructive">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Cancelados</p>
                      <p className="text-3xl font-bold mt-1">{kpis.totalCancelados.toLocaleString()}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-destructive/10"><Users className="h-5 w-5 text-destructive" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-destructive">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Taxa Churn</p>
                      <p className="text-3xl font-bold mt-1">{kpis.taxaChurn}%</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Cancelados / Base total</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-destructive/10"><TrendingDown className="h-5 w-5 text-destructive" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-warning">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">MRR Perdido</p>
                      <p className="text-3xl font-bold mt-1">{fmtBRL(kpis.mrrPerdido)}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-warning/10"><DollarSign className="h-5 w-5 text-warning" /></div>
                  </div>
                </CardContent>
              </Card>
              {/* Row 2: Financial */}
              <Card className="border-l-4 border-l-destructive">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">LTV Perdido</p>
                      <p className="text-3xl font-bold mt-1">{fmtBRL(kpis.ltvPerdido)}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-destructive/10"><TrendingDown className="h-5 w-5 text-destructive" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ticket Médio</p>
                      <p className="text-3xl font-bold mt-1">{fmtBRL(kpis.ticketMedio)}</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-primary/10"><DollarSign className="h-5 w-5 text-primary" /></div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-l-4 border-l-primary">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tempo Médio</p>
                      <p className="text-3xl font-bold mt-1">{kpis.tempoMedio}<span className="text-lg font-normal text-muted-foreground ml-1">meses</span></p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Último canc.: {kpis.ultimoCancelamento || "—"}
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Evolução de Cancelamentos (Line) + Bucket Distribution ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Line Chart — 2/3 width */}
              {cancelPorMes.length > 0 && (
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Evolução de Cancelamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={cancelPorMes} margin={{ top: 8, right: 12, bottom: 8, left: -10 }}>
                        <defs>
                          <linearGradient id="cancelGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip
                          formatter={(v: any, name: string) => [
                            name === "qtd" ? `${v} cancelamentos` : fmtBRL(v),
                            name === "qtd" ? "Cancelamentos" : "MRR Perdido"
                          ]}
                          contentStyle={{ fontSize: 12, borderRadius: 8 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="qtd"
                          stroke="hsl(var(--destructive))"
                          strokeWidth={2}
                          fill="url(#cancelGradient)"
                          dot={{ r: 3, fill: "hsl(var(--destructive))" }}
                          activeDot={{ r: 5 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Distribuição por Bucket — 1/3 */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4" />
                    Bucket no Cancelamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {bucketDistribuicao.map((b) => (
                      <div key={b.bucket}>
                        <div className="flex items-center justify-between mb-1.5">
                          <Badge className={`${BUCKET_COLORS[b.bucket as RiskBucket]} border text-xs`}>
                            {b.bucket}
                          </Badge>
                          <span className="text-sm font-semibold tabular-nums">
                            {b.qtd} <span className="text-muted-foreground font-normal">({b.pct}%)</span>
                          </span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(Number(b.pct), 2)}%`, backgroundColor: b.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-4 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Churn Score no momento do registro
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── Cohort Churn por Dimensão ── */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Cohort Churn por {churnDimension === "plano" ? "Plano" : churnDimension === "cidade" ? "Cidade" : "Bairro"}
                  </CardTitle>
                  <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                    {(["plano", "cidade", "bairro"] as const).map((dim) => (
                      <button
                        key={dim}
                        onClick={() => setChurnDimension(dim)}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                          churnDimension === dim
                            ? "bg-background shadow text-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {dim === "plano" ? "Plano" : dim === "cidade" ? "Cidade" : "Bairro"}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Taxa de churn (cancelados / total) por {churnDimension} (filtros aplicados)</p>
              </CardHeader>
              <CardContent>
                {churnPorDimensao.length > 0 ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={churnPorDimensao} margin={{ top: 8, right: 8, bottom: 80, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="label"
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
                            return [`${d.cancelados} de ${d.total} (${d.pct}%)`, "Churn"];
                          }}
                          labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.nome || label}
                        />
                        <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={44}>
                          {churnPorDimensao.map((e, i) => <Cell key={i} fill={barColor(e.pct)} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>

                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {churnPorDimensao.map((d) => (
                        <div key={d.nome} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0 gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: barColor(d.pct) }} />
                            <span className="text-xs text-foreground truncate" title={d.nome}>{d.nome}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 text-xs">
                            <span className="font-semibold text-foreground">{d.cancelados} de {d.total}</span>
                            <span className="text-muted-foreground">{d.pct}%</span>
                            <span className="text-muted-foreground">MRR: {fmtBRL(d.mrr)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Sem dados</div>
                )}
              </CardContent>
            </Card>

            {/* ── Top Motivos + Cohort ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Motivos */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Top 10 Motivos de Cancelamento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topMotivos.length > 0 ? (
                    <div className="space-y-2.5">
                      {topMotivos.map((m, idx) => {
                        const maxQtd = topMotivos[0].qtd;
                        const pct = maxQtd > 0 ? (m.qtd / maxQtd) * 100 : 0;
                        return (
                          <div key={m.motivo}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium truncate max-w-[70%]" title={m.motivo}>
                                {m.motivo}
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                                {m.qtd}
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                      Sem dados disponíveis
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cohort List */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Cohort por Tempo de Assinatura
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {cohortTempo.length > 0 ? (
                    <div className="space-y-2.5">
                      {cohortTempo.map((item, idx) => {
                        const maxQtd = Math.max(...cohortTempo.map(c => c.qtd), 1);
                        const pct = (item.qtd / maxQtd) * 100;
                        const totalFiltered = filtered.length;
                        const pctTotal = totalFiltered > 0 ? ((item.qtd / totalFiltered) * 100).toFixed(1) : "0";
                        return (
                          <div key={item.faixa}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium">{item.faixa}</span>
                              <span className="text-xs font-semibold tabular-nums">
                                {item.qtd} <span className="text-muted-foreground font-normal">({pctTotal}%)</span>
                              </span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                      Sem dados disponíveis
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Churn por Aging (Dias de Atraso) ── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CalendarX className="h-4 w-4" />
                  Churn por Aging (Dias de Atraso)
                </CardTitle>
                <p className="text-[10px] text-muted-foreground">Distribuição dos cancelados por faixa de inadimplência no momento do cancelamento</p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={agingChurnData} margin={{ top: 8, right: 8, bottom: 8, left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="faixa" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: any, _n: any, props: any) => {
                          const d = props.payload;
                          return [`${d.qtd} cancelados (${d.pct}%)`, "Qtd"];
                        }}
                      />
                      <Bar dataKey="qtd" radius={[4, 4, 0, 0]} maxBarSize={48}>
                        {agingChurnData.map((e, i) => (
                          <Cell key={i} fill={e.faixa === "Sem atraso" ? "#22c55e" : e.pct >= 20 ? "#ef4444" : e.pct >= 10 ? "#f97316" : "#eab308"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* List breakdown */}
                  <div className="space-y-2.5">
                    {agingChurnData.map((item, idx) => {
                      const maxQtd = Math.max(...agingChurnData.map(d => d.qtd), 1);
                      const barPct = (item.qtd / maxQtd) * 100;
                      const color = item.faixa === "Sem atraso" ? "#22c55e" : COLORS[idx % COLORS.length];
                      return (
                        <div key={item.faixa}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">{item.faixa}</span>
                            <span className="text-xs font-semibold tabular-nums">
                              {item.qtd} <span className="text-muted-foreground font-normal">({item.pct}%)</span>
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(barPct, 3)}%`, backgroundColor: color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Tabela principal ── */}
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
                          <span className="flex items-center justify-center">Churn Score<SortIcon field="churn_risk_score" /></span>
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
          </>
        )}
      </main>

      {/* CRM Drawer */}
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
