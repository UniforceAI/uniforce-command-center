import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEventos } from "@/hooks/useEventos";
import { useChurnScore } from "@/hooks/useChurnScore";
import { useChurnData } from "@/hooks/useChurnData";
import { useRiskBucketConfig } from "@/hooks/useRiskBucketConfig";
import { useCrmWorkflow } from "@/hooks/useCrmWorkflow";
import { useChamados } from "@/hooks/useChamados";
import { GlobalFilters } from "@/components/shared/GlobalFilters";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";
import { KPICardNew } from "@/components/shared/KPICardNew";
import { ActionMenu } from "@/components/shared/ActionMenu";
import { CrmDrawer } from "@/components/crm/CrmDrawer";
import { FAIXAS_AGING } from "@/types/evento";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  Calendar,
  Percent,
  Clock,
  Users,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  Download,
  BarChart3,
  CreditCard,
  ClipboardList,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";

type SortColumn = "diasAtraso" | "valor" | "nome" | "plano" | "vencimento" | "churnScore" | "status";

const Financeiro = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuth();
  const { ispNome } = useActiveIsp();
  const { eventos, isLoading, error } = useEventos();
  const { scoreMap, getScoreTotalReal } = useChurnScore();
  const { churnStatus, churnEvents } = useChurnData();
  const { getBucket } = useRiskBucketConfig();
  const { workflowMap, addToWorkflow, updateStatus, updateTags, updateOwner } = useCrmWorkflow();
  const { chamados } = useChamados();
  const [selectedClienteId, setSelectedClienteId] = useState<number | null>(null);

  const churnMap = useMemo(() => {
    const m = new Map<number, { score: number; bucket: string }>();
    scoreMap.forEach((val, clienteId) => {
      m.set(clienteId, { score: val.score, bucket: val.bucket });
    });
    return m;
  }, [scoreMap]);
  // CRM profile drawer data
  const selectedCliente = useMemo(() => {
    if (!selectedClienteId) return null;
    return churnStatus.find(c => c.cliente_id === selectedClienteId) || null;
  }, [selectedClienteId, churnStatus]);

  const selectedEvents = useMemo(() => {
    if (!selectedClienteId) return [];
    return churnEvents.filter(e => e.cliente_id === selectedClienteId);
  }, [selectedClienteId, churnEvents]);

  const selectedChamados = useMemo(() => {
    if (!selectedClienteId) return [];
    return chamados.filter(c => {
      const id = typeof c.id_cliente === "string" ? parseInt(c.id_cliente as any) : c.id_cliente;
      return id === selectedClienteId;
    });
  }, [selectedClienteId, chamados]);

  // Filtros
  const [periodo, setPeriodo] = useState("7");
  const [plano, setPlano] = useState("todos");
  const [metodo, setMetodo] = useState("todos");
  const [filial, setFilial] = useState("todos");
  const [ordemPlanoDecrescente, setOrdemPlanoDecrescente] = useState(true);
  const [sortColuna, setSortColuna] = useState<SortColumn>("diasAtraso");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSortColuna = (col: SortColumn) => {
    if (sortColuna === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColuna(col);
      setSortDir("desc");
    }
  };

  // Filtrar eventos financeiros
  const eventosFinanceiros = useMemo(() => {
    return eventos.filter(e => 
      e.event_type === "COBRANCA" || 
      (e.event_type === "SNAPSHOT" && (e.cobranca_status || e.valor_cobranca || e.data_vencimento))
    );
  }, [eventos]);

  // Extrair opções dinâmicas
  const filterOptions = useMemo(() => {
    const planos = new Set<string>();
    const metodos = new Set<string>();
    const filiais = new Set<string>();
    eventosFinanceiros.forEach((e) => {
      if (e.plano_nome) planos.add(e.plano_nome);
      if (e.metodo_cobranca) metodos.add(e.metodo_cobranca);
      const fid = e.filial_id !== null && e.filial_id !== undefined ? String(e.filial_id).trim() : "";
      if (fid) filiais.add(fid);
    });
    return {
      planos: Array.from(planos).sort(),
      metodos: Array.from(metodos).sort(),
      filiais: Array.from(filiais).sort((a, b) => Number(a) - Number(b)),
    };
  }, [eventosFinanceiros]);

  // Filtrar por período
  const filteredEventos = useMemo(() => {
    let filtered = [...eventosFinanceiros];
    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      let maxDate = new Date(0);
      filtered.forEach((e) => {
        const d = e.event_datetime ? new Date(e.event_datetime) : null;
        if (d && !isNaN(d.getTime()) && d > maxDate) maxDate = d;
      });
      if (maxDate.getTime() === 0) maxDate = new Date();
      const dataLimite = new Date(maxDate);
      dataLimite.setDate(dataLimite.getDate() - diasAtras);
      filtered = filtered.filter((e) => {
        const dateToCheck = e.event_datetime ? new Date(e.event_datetime) : e.created_at ? new Date(e.created_at) : null;
        if (!dateToCheck || isNaN(dateToCheck.getTime())) return true;
        return dateToCheck >= dataLimite;
      });
    }
    if (plano !== "todos") filtered = filtered.filter((e) => e.plano_nome === plano);
    if (metodo !== "todos") filtered = filtered.filter((e) => e.metodo_cobranca === metodo);
    if (filial !== "todos") filtered = filtered.filter((e) => String(e.filial_id) === filial);
    return filtered;
  }, [eventosFinanceiros, periodo, plano, metodo, filial]);

  // ---- KPIs ----
  const kpis = useMemo(() => {
    const clientesUnicos = new Set(filteredEventos.map(e => e.cliente_id)).size;
    const vencidos = filteredEventos.filter(e => e.vencido === true || e.dias_atraso > 0);
    const aVencer = filteredEventos.filter(e => e.cobranca_status === "A Vencer" && !e.vencido);
    
    // Clientes únicos vencidos
    const clientesVencidosSet = new Set(vencidos.map(e => e.cliente_id));
    const clientesVencidos = clientesVencidosSet.size;
    
    // Clientes únicos a vencer
    const clientesAVencerSet = new Set(aVencer.map(e => e.cliente_id));
    const clientesAVencer = clientesAVencerSet.size;
    
    const valorVencido = vencidos.reduce((acc, e) => acc + (e.valor_cobranca || e.valor_mensalidade || 0), 0);
    const valorAVencer = aVencer.reduce((acc, e) => acc + (e.valor_cobranca || e.valor_mensalidade || 0), 0);
    
    const taxaInadimplencia = clientesUnicos > 0 
      ? ((clientesVencidos / clientesUnicos) * 100).toFixed(1) 
      : "0";
    
    const ticketMedio = filteredEventos.length > 0 
      ? filteredEventos.reduce((acc, e) => acc + (e.valor_cobranca || e.valor_mensalidade || 0), 0) / filteredEventos.length 
      : 0;

    // Atraso Médio: média de dias_atraso para quem está vencido
    const diasAtrasoArr = vencidos.map(e => e.dias_atraso || 0).filter(d => d > 0);
    const atrasoMedio = diasAtrasoArr.length > 0
      ? Math.round(diasAtrasoArr.reduce((a, b) => a + b, 0) / diasAtrasoArr.length)
      : 0;

    return {
      clientesUnicos,
      clientesVencidos,
      cobrancasVencidas: vencidos.length,
      clientesAVencer,
      cobrancasAVencer: aVencer.length,
      valorVencido,
      valorAVencer,
      taxaInadimplencia,
      ticketMedio,
      atrasoMedio,
    };
  }, [filteredEventos]);

  // Aging
  const agingData = useMemo(() => {
    const faixas = FAIXAS_AGING.map(faixa => ({ faixa: faixa.label, quantidade: 0, valor: 0 }));
    filteredEventos.forEach(e => {
      const dias = e.dias_atraso || 0;
      if (dias <= 0) return;
      const faixaIndex = FAIXAS_AGING.findIndex(f => dias >= f.min && dias <= f.max);
      if (faixaIndex >= 0) {
        faixas[faixaIndex].quantidade++;
        faixas[faixaIndex].valor += e.valor_cobranca || e.valor_mensalidade || 0;
      }
    });
    return faixas.filter(f => f.quantidade > 0);
  }, [filteredEventos]);

  // Vencido por plano
  const vencidoPorPlanoBase = useMemo(() => {
    const porPlano: Record<string, { quantidade: number; valor: number }> = {};
    filteredEventos
      .filter(e => e.vencido === true || e.dias_atraso > 0)
      .forEach(e => {
        const planoNome = e.plano_nome || "Sem plano";
        if (!porPlano[planoNome]) porPlano[planoNome] = { quantidade: 0, valor: 0 };
        porPlano[planoNome].quantidade++;
        porPlano[planoNome].valor += e.valor_cobranca || e.valor_mensalidade || 0;
      });
    return Object.entries(porPlano).map(([plano, data]) => ({ plano, ...data }));
  }, [filteredEventos]);

  const vencidoPorPlano = useMemo(() => {
    return [...vencidoPorPlanoBase]
      .filter(p => p.valor > 0)
      .sort((a, b) => ordemPlanoDecrescente ? b.valor - a.valor : a.valor - b.valor);
  }, [vencidoPorPlanoBase, ordemPlanoDecrescente]);

  // Por método — agrupar por clientes únicos
  const porMetodo = useMemo(() => {
    const metodos: Record<string, { clienteIds: Set<number>; valor: number }> = {};
    filteredEventos.forEach(e => {
      const m = e.metodo_cobranca || "Não informado";
      if (!metodos[m]) metodos[m] = { clienteIds: new Set(), valor: 0 };
      metodos[m].clienteIds.add(e.cliente_id);
      metodos[m].valor += e.valor_cobranca || e.valor_mensalidade || 0;
    });
    return Object.entries(metodos).map(([metodo, data]) => ({ metodo, clientes: data.clienteIds.size, valor: data.valor })).sort((a, b) => b.clientes - a.clientes);
  }, [filteredEventos]);

  // Dias reais de atraso
  const calcDiasAtrasoReal = (e: any): number => {
    if (!e.data_vencimento) return e.dias_atraso || 0;
    const venc = new Date(e.data_vencimento);
    if (isNaN(venc.getTime())) return e.dias_atraso || 0;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    venc.setHours(0, 0, 0, 0);
    const diff = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : (e.dias_atraso || 0);
  };

  // Lista de clientes vencidos com ordenação
  const clientesVencidosList = useMemo(() => {
    const todosEventosFinanceiros = eventos.filter(e =>
      e.event_type === "COBRANCA" ||
      (e.event_type === "SNAPSHOT" && (e.cobranca_status || e.valor_cobranca || e.data_vencimento))
    );
    const vencidos = todosEventosFinanceiros.filter(e => e.dias_atraso > 0 || e.vencido === true);
    const porCliente = new Map<number, { evento: typeof vencidos[0]; diasReal: number }>();
    vencidos.forEach(e => {
      const diasReal = calcDiasAtrasoReal(e);
      const existing = porCliente.get(e.cliente_id);
      if (!existing || diasReal > existing.diasReal) {
        porCliente.set(e.cliente_id, { evento: e, diasReal });
      }
    });

    const lista = Array.from(porCliente.values()).map(({ evento, diasReal }) => ({
      ...evento,
      diasAtrasoReal: diasReal,
    }));

    return lista.sort((a, b) => {
      let cmp = 0;
      switch (sortColuna) {
        case "diasAtraso": cmp = a.diasAtrasoReal - b.diasAtrasoReal; break;
        case "valor": cmp = (a.valor_cobranca || a.valor_mensalidade || 0) - (b.valor_cobranca || b.valor_mensalidade || 0); break;
        case "nome": cmp = (a.cliente_nome || "").localeCompare(b.cliente_nome || ""); break;
        case "plano": cmp = (a.plano_nome || "").localeCompare(b.plano_nome || ""); break;
        case "vencimento": {
          const da = a.data_vencimento ? new Date(a.data_vencimento).getTime() : 0;
          const db = b.data_vencimento ? new Date(b.data_vencimento).getTime() : 0;
          cmp = da - db;
          break;
        }
        case "churnScore": {
          const sa = churnMap.get(a.cliente_id)?.score ?? -1;
          const sb = churnMap.get(b.cliente_id)?.score ?? -1;
          cmp = sa - sb;
          break;
        }
        case "status": cmp = a.diasAtrasoReal - b.diasAtrasoReal; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [eventos, sortColuna, sortDir, churnMap]);

  // ---- Download ----
  const downloadTable = useCallback(async (format: "csv" | "xlsx" | "ods") => {
    const rows = clientesVencidosList.map(e => {
      const churnInfo = churnMap.get(e.cliente_id);
      const diasAtraso = (e as any).diasAtrasoReal ?? Math.round(e.dias_atraso || 0);
      return {
        "Cliente": e.cliente_nome || "",
        "Email": e.cliente_email || "",
        "Celular": e.cliente_celular || "",
        "Plano": e.plano_nome || "",
        "Valor Mensalidade": e.valor_mensalidade || 0,
        "Valor Cobrança": e.valor_cobranca || 0,
        "Método": e.metodo_cobranca || "",
        "Vencimento": e.data_vencimento || "",
        "Dias Atraso": diasAtraso,
        "Status Cobrança": e.cobranca_status || "",
        "Churn Score": churnInfo?.score ?? "",
        "Churn Bucket": churnInfo?.bucket ?? "",
        "Status Serviço": e.servico_status || "",
        "Bairro": e.cliente_bairro || "",
        "Cidade": e.cliente_cidade || "",
        "Segmento": e.cliente_segmento || "",
      };
    });

    if (format === "csv") {
      const headers = Object.keys(rows[0] || {});
      const csvLines = [headers.join(",")];
      rows.forEach(r => {
        csvLines.push(headers.map(h => {
          const val = String((r as any)[h] ?? "");
          return val.includes(",") || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(","));
      });
      const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
      downloadBlob(blob, "inadimplentes.csv");
    } else {
      // xlsx or ods
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Inadimplentes");
      const bookType = format === "ods" ? "ods" : "xlsx";
      XLSX.writeFile(wb, `inadimplentes.${bookType}`);
    }
    toast({ title: "Download iniciado", description: `Arquivo ${format.toUpperCase()} gerado.` });
  }, [clientesVencidosList, churnMap, toast]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Copy helpers ----
  const copyToClipboard = (text: string | undefined | null, label: string) => {
    if (!text) {
      toast({ title: `${label} indisponível`, description: "Este dado não está presente no cadastro do cliente.", variant: "destructive" });
      return;
    }
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!`, description: "Copiado para a área de transferência." });
  };

  const filters = [
    {
      id: "periodo", label: "Período", value: periodo, onChange: setPeriodo,
      options: [
        { value: "7", label: "Últimos 7 dias" },
        { value: "30", label: "Últimos 30 dias" },
        { value: "90", label: "Últimos 90 dias" },
        { value: "180", label: "Últimos 180 dias" },
        { value: "365", label: "Último ano" },
        { value: "todos", label: "Tudo" },
      ],
    },
    {
      id: "plano", label: "Plano", value: plano, onChange: setPlano,
      disabled: filterOptions.planos.length === 0,
      options: [{ value: "todos", label: "Todos" }, ...filterOptions.planos.map(p => ({ value: p, label: p }))],
    },
    {
      id: "metodo", label: "Método", value: metodo, onChange: setMetodo,
      disabled: filterOptions.metodos.length === 0,
      options: [{ value: "todos", label: "Todos" }, ...filterOptions.metodos.map(m => ({ value: m, label: m }))],
    },
    {
      id: "filial", label: "Filial", value: filial, onChange: setFilial,
      disabled: filterOptions.filiais.length === 0,
      options: [{ value: "todos", label: "Todas" }, ...filterOptions.filiais.map(f => ({ value: f, label: `Filial ${f}` }))],
    },
  ];

  // Sort arrow helper — Lucide icons
  const SortArrow = ({ col }: { col: SortColumn }) => {
    if (sortColuna !== col) return <ArrowUpDown className="h-3 w-3 ml-0.5 text-muted-foreground/50" />;
    return sortDir === "desc"
      ? <ChevronDown className="h-3 w-3 ml-0.5 text-primary" />
      : <ChevronUp className="h-3 w-3 ml-0.5 text-primary" />;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Financeiro
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">Inadimplência e Recuperação · {filteredEventos.length} eventos</p>
            </div>
            <IspActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 space-y-4">
        {isLoading ? (
          <LoadingScreen />
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

            {/* ===== KPIs Row 1 ===== */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Clientes Vencidos — manter como está */}
              <KPICardNew
                title="Clientes Vencidos"
                value={kpis.clientesVencidos.toLocaleString()}
                subtitle={`${kpis.cobrancasVencidas} cobranças`}
                icon={Calendar}
                variant="danger"
              />
              {/* R$ Vencido — sem centavos, texto menor */}
              <KPICardNew
                title="Vencido"
                value={`R$ ${Math.round(kpis.valorVencido).toLocaleString("pt-BR")}`}
                icon={TrendingDown}
                variant="danger"
              />
              {/* Clientes a Vencer — mesmo formato de Clientes Vencidos */}
              <KPICardNew
                title="Clientes a Vencer"
                value={kpis.clientesAVencer.toLocaleString()}
                subtitle={`${kpis.cobrancasAVencer} cobranças`}
                icon={Clock}
                variant="warning"
              />
              {/* Inadimplência — com footer sobre base total */}
              <KPICardNew
                title="Inadimplência"
                value={`${kpis.taxaInadimplencia}%`}
                subtitle={`${kpis.clientesVencidos} de ${kpis.clientesUnicos} clientes`}
                icon={Percent}
                variant="danger"
              />
              {/* Ticket Médio — manter */}
              <KPICardNew
                title="Ticket Médio"
                value={`R$ ${kpis.ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={TrendingUp}
                variant="info"
              />
              {/* Atraso Médio */}
              <KPICardNew
                title="Atraso Médio"
                value={`${kpis.atrasoMedio}d`}
                subtitle="Média dias p/ pagar"
                icon={Clock}
                variant="warning"
              />
            </div>

            {/* ===== Gráficos Row 1 ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Aging */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Aging (Dias de Atraso)</CardTitle></CardHeader>
                <CardContent>
                  {agingData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={agingData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="faixa" fontSize={12} />
                        <YAxis fontSize={12} />
                        <RechartsTooltip />
                        <Bar dataKey="quantidade" fill="#ef4444" name="Quantidade" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Dados insuficientes</p>
                  )}
                </CardContent>
              </Card>

              {/* Vencido por Plano */}
              <Card className="flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
                  <CardTitle className="text-base font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Vencido por Plano</CardTitle>
                  <Button 
                    variant="outline" size="sm"
                    onClick={() => setOrdemPlanoDecrescente(!ordemPlanoDecrescente)}
                    className="h-8 gap-1 text-xs"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    {ordemPlanoDecrescente ? "Maior valor" : "Menor valor"}
                  </Button>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 flex flex-col">
                  {vencidoPorPlano.length > 0 ? (
                    <div className="overflow-y-auto flex-1 max-h-[280px]">
                      <div style={{ height: Math.max(250, vencidoPorPlano.length * 36) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={vencidoPorPlano} layout="vertical" margin={{ right: 60, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} orientation="top" />
                            <YAxis dataKey="plano" type="category" fontSize={10} width={120} tickFormatter={(v) => v.length > 18 ? `${v.substring(0, 18)}...` : v} />
                            <RechartsTooltip formatter={(v) => [`R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 'Valor Vencido']} />
                            <Bar dataKey="valor" fill="#f97316" name="Valor Vencido" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Nenhuma cobrança vencida</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ===== Gráficos Row 2 ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Por Método */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" />Por Método de Cobrança</CardTitle></CardHeader>
                <CardContent>
                  {porMetodo.length > 0 ? (
                    <div className="space-y-3">
                      {porMetodo.map((m, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <span className="font-medium">{m.metodo}</span>
                            <span className="text-muted-foreground ml-2">({m.clientes} clientes)</span>
                          </div>
                          <span className="font-semibold">R$ {m.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Sem dados de métodos</p>
                  )}
                </CardContent>
              </Card>

              {/* Resumo por Status — reordenado */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" />Resumo por Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Row 1: A Vencer | Vencidos */}
                    <div className="p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">A Vencer</p>
                      <p className="text-2xl font-bold text-yellow-600">{kpis.clientesAVencer.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{kpis.cobrancasAVencer} cobranças</p>
                    </div>
                    <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <p className="text-sm text-muted-foreground">Vencidos</p>
                      <p className="text-2xl font-bold text-red-600">{kpis.clientesVencidos.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{kpis.cobrancasVencidas} cobranças</p>
                    </div>
                    {/* Row 2: MRR A Vencer | MRR Vencido */}
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">MRR A Vencer</p>
                      <p className="text-xl font-bold text-yellow-600">R$ {Math.round(kpis.valorAVencer).toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                      <p className="text-sm text-muted-foreground">MRR Vencido</p>
                      <p className="text-xl font-bold text-red-600">R$ {Math.round(kpis.valorVencido).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ===== Tabela Clientes Inadimplentes ===== */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Clientes Inadimplentes
                  <Badge variant="destructive" className="ml-2">
                    {clientesVencidosList.length} clientes
                  </Badge>
                </CardTitle>
                {/* Download button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                      <Download className="h-3.5 w-3.5" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => downloadTable("csv")}>CSV</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => downloadTable("xlsx")}>Excel (XLSX)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => downloadTable("ods")}>OpenOffice (ODS)</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[600px]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs cursor-pointer hover:bg-muted select-none" onClick={() => handleSortColuna("nome")}>
                          <div className="flex items-center gap-1">Cliente<SortArrow col="nome" /></div>
                        </TableHead>
                        <TableHead className="text-xs cursor-pointer hover:bg-muted select-none" onClick={() => handleSortColuna("plano")}>
                          <div className="flex items-center gap-1">Plano<SortArrow col="plano" /></div>
                        </TableHead>
                        <TableHead className="text-xs text-center cursor-pointer hover:bg-muted select-none" onClick={() => handleSortColuna("vencimento")}>
                          <div className="flex items-center justify-center gap-1">Última Fatura<SortArrow col="vencimento" /></div>
                        </TableHead>
                        <TableHead className="text-xs text-center cursor-pointer hover:bg-muted select-none" onClick={() => handleSortColuna("diasAtraso")}>
                          <div className="flex items-center justify-center gap-1">Dias Atraso<SortArrow col="diasAtraso" /></div>
                        </TableHead>
                        <TableHead className="text-xs text-right cursor-pointer hover:bg-muted select-none" onClick={() => handleSortColuna("valor")}>
                          <div className="flex items-center justify-end gap-1">Valor Vencido<SortArrow col="valor" /></div>
                        </TableHead>
                        <TableHead className="text-xs text-center cursor-pointer hover:bg-muted select-none" onClick={() => handleSortColuna("churnScore")}>
                          <div className="flex items-center justify-center gap-1">Churn Score<SortArrow col="churnScore" /></div>
                        </TableHead>
                        <TableHead className="text-xs cursor-pointer hover:bg-muted select-none" onClick={() => handleSortColuna("status")}>
                          <div className="flex items-center gap-1">Status<SortArrow col="status" /></div>
                        </TableHead>
                        <TableHead className="text-xs text-center w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientesVencidosList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8 text-sm">
                            Nenhum cliente inadimplente encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        clientesVencidosList.map((e, idx) => {
                          const diasAtraso = (e as any).diasAtrasoReal ?? Math.round(e.dias_atraso || 0);
                          const vencimentoStr = e.data_vencimento
                            ? new Date(e.data_vencimento).toLocaleDateString("pt-BR")
                            : "—";
                          const valor = e.valor_cobranca || e.valor_mensalidade || 0;
                          const churnInfo = churnMap.get(e.cliente_id);
                          return (
                            <TableRow key={`${e.cliente_id}-${idx}`} className="hover:bg-muted/50">
                              <TableCell className="text-xs font-medium max-w-[180px] truncate">
                                {e.cliente_nome || "—"}
                              </TableCell>
                              <TableCell className="text-xs max-w-[140px] truncate text-muted-foreground">
                                {e.plano_nome || "—"}
                              </TableCell>
                              <TableCell className="text-xs text-center">{vencimentoStr}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`border text-[10px] ${
                                  diasAtraso > 60 ? "bg-red-100 text-red-800 border-red-300" :
                                  diasAtraso > 30 ? "bg-orange-100 text-orange-800 border-orange-300" :
                                  diasAtraso > 15 ? "bg-yellow-100 text-yellow-800 border-yellow-300" :
                                  "bg-muted text-muted-foreground border-border"
                                }`}>{diasAtraso}d</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right font-medium">
                                {valor > 0 ? `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                {churnInfo ? (
                                  <Badge className={`text-[10px] font-mono border ${
                                    churnInfo.bucket === "CRÍTICO" ? "bg-red-100 text-red-800 border-red-200" :
                                    churnInfo.bucket === "ALERTA" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                                    "bg-green-100 text-green-800 border-green-200"
                                  }`}>
                                    {churnInfo.score} · {churnInfo.bucket}
                                  </Badge>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className={
                                  diasAtraso > 60 ? "border-destructive text-destructive" :
                                  diasAtraso > 30 ? "border-orange-500 text-orange-600" :
                                  "border-yellow-500 text-yellow-600"
                                }>
                                  {diasAtraso > 60 ? "Crítico" : diasAtraso > 30 ? "Grave" : "Em atraso"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <ActionMenu
                                  clientId={e.cliente_id}
                                  clientName={e.cliente_nome}
                                  clientPhone={e.cliente_celular}
                                  variant="cobranca"
                                  onOpenProfile={() => setSelectedClienteId(e.cliente_id)}
                                />
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

      {/* CRM Profile Drawer */}
      {selectedCliente && (
        <CrmDrawer
          cliente={selectedCliente}
          score={getScoreTotalReal(selectedCliente)}
          bucket={getBucket(getScoreTotalReal(selectedCliente))}
          workflow={workflowMap.get(selectedCliente.cliente_id)}
          events={selectedEvents}
          chamadosCliente={selectedChamados}
          onClose={() => setSelectedClienteId(null)}
          onStartTreatment={() => addToWorkflow(selectedCliente.cliente_id)}
          onUpdateStatus={(s) => updateStatus(selectedCliente.cliente_id, s)}
          onUpdateTags={(t) => updateTags(selectedCliente.cliente_id, t)}
          onUpdateOwner={(o) => updateOwner(selectedCliente.cliente_id, o || "")}
        />
      )}
    </div>
  );
};

export default Financeiro;
