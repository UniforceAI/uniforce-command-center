import { useState, useMemo, useEffect } from "react";
import { ChurnStatus, ChurnEvent } from "@/hooks/useChurnData";
import { ChamadoData } from "@/hooks/useChamados";
import { RiskBucket } from "@/hooks/useRiskBucketConfig";
import { WorkflowStatus, CrmWorkflowRecord } from "@/hooks/useCrmWorkflow";
import { useCrmComments } from "@/hooks/useCrmComments";
import { useCrmTags } from "@/hooks/useCrmTags";
import { useAuth } from "@/contexts/AuthContext";
import { safeFormatDate } from "@/lib/safeDate";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  PlayCircle, CheckCircle2, XCircle, Tag, UserCheck,
  MessageSquare, Phone, Send, Wrench,
  ThumbsDown, ThumbsUp, Minus, X, Plus, Clock, DollarSign,
  AlertTriangle, TrendingDown, Activity, FileText, Calendar,
  Trash2, Pencil, Save, Palette, Copy, CreditCard, ArrowRight,
  QrCode, Package, Mail, User, Hash, IdCard,
} from "lucide-react";
import { getCategoriaDisplay } from "@/lib/categoriasMap";

const BUCKET_COLORS: Record<RiskBucket, string> = {
  OK: "bg-green-100 text-green-800 border-green-200",
  ALERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "CRÍTICO": "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<WorkflowStatus, { label: string; icon: typeof PlayCircle; cls: string }> = {
  em_tratamento: { label: "Em Tratamento", icon: PlayCircle, cls: "text-yellow-600 border-yellow-300 bg-yellow-50" },
  resolvido: { label: "Resolvido", icon: CheckCircle2, cls: "text-green-600 border-green-300 bg-green-50" },
  perdido: { label: "Perdido", icon: XCircle, cls: "text-destructive border-red-300 bg-red-50" },
};

const EVENTO_LABELS: Record<string, { label: string; icon: typeof AlertTriangle; color: string }> = {
  inadimplencia_iniciou: { label: "Inadimplência iniciou", icon: DollarSign, color: "text-destructive" },
  inadimplencia_agravou: { label: "Atraso agravou", icon: TrendingDown, color: "text-destructive" },
  inadimplencia_resolvida: { label: "Pagamento efetuado", icon: CheckCircle2, color: "text-green-600" },
  bloqueio_automatico: { label: "Bloqueio automático", icon: XCircle, color: "text-destructive" },
  chamado_critico: { label: "Chamado crítico", icon: AlertTriangle, color: "text-yellow-600" },
  chamado_reincidente: { label: "Chamado reincidente", icon: Phone, color: "text-yellow-600" },
  nps_detrator: { label: "NPS Detrator", icon: ThumbsDown, color: "text-destructive" },
  cancelamento_real: { label: "Cancelamento confirmado", icon: XCircle, color: "text-destructive" },
  risco_aumentou: { label: "Risco aumentou", icon: TrendingDown, color: "text-yellow-600" },
  risco_reduziu: { label: "Risco reduziu", icon: CheckCircle2, color: "text-green-600" },
  score_critico: { label: "Score crítico atingido", icon: AlertTriangle, color: "text-destructive" },
  suspensao_fidelidade: { label: "Suspensão de fidelidade", icon: FileText, color: "text-yellow-600" },
  score_financeiro: { label: "Score Financeiro", icon: DollarSign, color: "text-orange-600" },
  score_qualidade: { label: "Score Qualidade", icon: Activity, color: "text-blue-600" },
  score_comportamental: { label: "Score Comportamental", icon: TrendingDown, color: "text-purple-600" },
};

const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#64748b",
];

interface ClienteExtraData {
  pix_codigo?: string;
  linha_digitavel?: string;
  pix_qrcode_img?: string;
  cliente_documento?: string;
  cliente_tipo_pessoa?: string;
  cliente_email?: string;
  cliente_celular?: string;
  dia_vencimento?: number;
  metodo_cobranca?: string;
  status_contrato?: string;
  tipo_servico?: string;
  tipo_conexao?: string;
}

interface CrmDrawerProps {
  cliente: ChurnStatus | null;
  score: number;
  bucket: RiskBucket;
  workflow: CrmWorkflowRecord | undefined;
  events: ChurnEvent[];
  chamadosCliente: ChamadoData[];
  npsData?: { nota?: number; classificacao?: string };
  onClose: () => void;
  onStartTreatment: () => Promise<void>;
  onUpdateStatus: (status: WorkflowStatus) => Promise<void>;
  onUpdateTags: (tags: string[]) => Promise<void>;
  onUpdateOwner: (ownerId: string | null) => Promise<void>;
}

/** Small helper to copy text and show toast */
function CopyButton({ value, label }: { value: string; label: string }) {
  const { toast } = useToast();
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); toast({ title: `${label} copiado!` }); }}
      className="p-1 rounded hover:bg-primary/10 hover:text-primary transition-colors" title={`Copiar ${label}`}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

export function CrmDrawer({
  cliente, score, bucket, workflow, events, chamadosCliente, npsData, onClose,
  onStartTreatment, onUpdateStatus, onUpdateTags, onUpdateOwner,
}: CrmDrawerProps) {
  const { user } = useAuth();
  const { ispId } = useActiveIsp();
  const { toast } = useToast();
  const clienteId = cliente?.cliente_id ?? null;
  const { comments, addComment, updateComment, deleteComment } = useCrmComments(clienteId);
  const { tags: globalTags, createTag } = useCrmTags();
  const [noteText, setNoteText] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [activeTab, setActiveTab] = useState("acompanhamento");

  const [extraData, setExtraData] = useState<ClienteExtraData | null>(null);

  useEffect(() => {
    if (!clienteId || !ispId) return;
    (async () => {
      try {
        const { data } = await externalSupabase
          .from("eventos")
          .select("pix_codigo, linha_digitavel, pix_qrcode_img, cliente_documento, cliente_tipo_pessoa, cliente_email, cliente_celular, dia_vencimento, metodo_cobranca, status_contrato, tipo_servico, tipo_conexao")
          .eq("isp_id", ispId)
          .eq("cliente_id", clienteId)
          .order("event_datetime", { ascending: false })
          .limit(1);
        if (data && data.length > 0) setExtraData(data[0]);
      } catch { /* silent */ }
    })();
  }, [clienteId, ispId]);

  const tempoContrato = useMemo(() => {
    if (!cliente) return null;
    const dtAtivacao = (cliente as any).data_ativacao || (cliente as any).data_instalacao;
    if (!dtAtivacao) return null;
    const d = new Date(dtAtivacao);
    if (isNaN(d.getTime())) return null;
    const diffMs = Date.now() - d.getTime();
    const meses = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
    if (meses >= 12) return `${Math.floor(meses / 12)}a ${meses % 12}m`;
    return `${meses}m`;
  }, [cliente]);

  const ltv = useMemo(() => {
    if (!cliente) return null;
    if ((cliente as any).ltv_estimado != null && (cliente as any).ltv_estimado > 0)
      return (cliente as any).ltv_estimado;
    if (cliente.valor_mensalidade && (cliente as any).tempo_cliente_meses)
      return cliente.valor_mensalidade * (cliente as any).tempo_cliente_meses;
    return null;
  }, [cliente]);

  if (!cliente) return null;

  const clienteTags = workflow?.tags || [];
  const hasPix = !!extraData?.pix_codigo;
  const hasBoleto = !!extraData?.linha_digitavel;
  const hasQrCode = !!extraData?.pix_qrcode_img;

  const clienteDocumento = extraData?.cliente_documento || (cliente as any).cliente_documento || "";
  const clienteTipoPessoa = extraData?.cliente_tipo_pessoa || (cliente as any).cliente_tipo_pessoa || "";
  const clienteEmail = extraData?.cliente_email || (cliente as any).cliente_email || "";
  const clienteCelular = extraData?.cliente_celular || (cliente as any).cliente_celular || (cliente as any).telefone || "";
  const diaVencimento = extraData?.dia_vencimento ?? (cliente as any).dia_vencimento ?? null;
  const metodoCobranca = extraData?.metodo_cobranca || (cliente as any).metodo_cobranca || "";
  const statusContrato = extraData?.status_contrato || (cliente as any).status_contrato || "";
  const tipoServico = extraData?.tipo_servico || (cliente as any).tipo_servico || "";
  const tipoConexao = extraData?.tipo_conexao || (cliente as any).tipo_conexao || "";
  const tipoPessoaLabel = clienteTipoPessoa === "J" ? "Jurídica" : clienteTipoPessoa === "F" ? "Física" : clienteTipoPessoa || "—";

  const handleAddTag = async (tag: string) => {
    if (!tag || clienteTags.includes(tag)) return;
    try { await onUpdateTags([...clienteTags, tag]); }
    catch { toast({ title: "Erro ao adicionar tag", variant: "destructive" }); }
  };

  const handleRemoveTag = async (tag: string) => {
    try { await onUpdateTags(clienteTags.filter(t => t !== tag)); }
    catch { toast({ title: "Erro ao remover tag", variant: "destructive" }); }
  };

  const handleCreateGlobalTag = async () => {
    if (!newTagName.trim()) return;
    try {
      await createTag(newTagName.trim(), newTagColor);
      toast({ title: `Tag "${newTagName}" criada` });
      setNewTagName("");
    } catch { toast({ title: "Erro ao criar tag", variant: "destructive" }); }
  };

  const handleAddComment = async () => {
    if (!noteText.trim()) return;
    try {
      await addComment(noteText.trim(), "comment");
      setNoteText("");
      toast({ title: "Nota adicionada" });
    } catch { toast({ title: "Erro ao salvar nota", variant: "destructive" }); }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editingText.trim()) return;
    try {
      await updateComment(commentId, editingText.trim());
      setEditingCommentId(null);
      setEditingText("");
      toast({ title: "Nota atualizada" });
    } catch { toast({ title: "Erro ao editar nota", variant: "destructive" }); }
  };

  const handleDeleteComment = async (commentId: string) => {
    try { await deleteComment(commentId); toast({ title: "Interação removida" }); }
    catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const handleQuickAction = async (actionType: string, label: string) => {
    setActionLoading(actionType);
    try {
      await addComment(`Ação: ${label}`, "action", { action_type: actionType });
      if (workflow) await onUpdateStatus(workflow.status_workflow);
      toast({ title: `${label} registrado` });
    } catch { toast({ title: "Erro ao registrar ação", variant: "destructive" }); }
    setActionLoading(null);
  };

  const handleAssumirOwner = async () => {
    if (!user) return;
    try { await onUpdateOwner(user.id); toast({ title: "Você assumiu este atendimento" }); }
    catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleStatusChange = async (status: WorkflowStatus) => {
    try { await onUpdateStatus(status); toast({ title: `Marcado como ${STATUS_LABELS[status].label}` }); }
    catch { toast({ title: "Erro ao atualizar status", variant: "destructive" }); }
  };

  const handleWhatsApp = () => {
    const sanitizedPhone = clienteCelular.replace(/\D/g, "");
    if (sanitizedPhone) {
      const fullPhone = sanitizedPhone.startsWith("55") ? sanitizedPhone : `55${sanitizedPhone}`;
      const encodedMessage = encodeURIComponent("Oi");
      const link = `https://wa.me/${fullPhone}?text=${encodedMessage}`;
      window.open(link, "_blank", "noopener,noreferrer");
    } else {
      toast({ title: "Telefone indisponível", description: "Este cliente não possui celular cadastrado.", variant: "destructive" });
    }
    handleQuickAction("whatsapp", "WhatsApp enviado");
  };

  const handleCopyPix = () => {
    if (!extraData?.pix_codigo) return;
    navigator.clipboard.writeText(extraData.pix_codigo);
    toast({ title: "PIX copiado!" });
    handleQuickAction("copy_pix", "PIX copiado");
  };

  const handleCopyBoleto = () => {
    if (!extraData?.linha_digitavel) return;
    navigator.clipboard.writeText(extraData.linha_digitavel);
    toast({ title: "Boleto copiado!" });
    handleQuickAction("copy_boleto", "Boleto copiado");
  };

  const handleCopyPixQrCode = () => {
    if (!extraData?.pix_qrcode_img) return;
    navigator.clipboard.writeText(extraData.pix_qrcode_img);
    toast({ title: "QR Code PIX copiado!" });
    handleQuickAction("copy_pix_qrcode", "QR Code PIX copiado");
  };

  const scores = [
    { name: "Financeiro", val: cliente.score_financeiro ?? 0 },
    { name: "Suporte", val: cliente.score_suporte ?? 0 },
    { name: "NPS", val: cliente.score_nps ?? 0 },
    { name: "Qualidade", val: cliente.score_qualidade ?? 0 },
    { name: "Comportamental", val: cliente.score_comportamental ?? 0 },
  ].sort((a, b) => b.val - a.val);
  const driverPrincipal = scores[0]?.name || "—";

  const getTagColor = (tagName: string) => {
    const gt = globalTags.find(t => t.name === tagName);
    return gt?.color || "#64748b";
  };

  const formatChamadoDate = (dateStr: string) => {
    try {
      if (dateStr.includes("/")) { const [datePart] = dateStr.split(" "); return datePart; }
      return safeFormatDate(dateStr, { day: "2-digit", month: "2-digit", year: "2-digit" });
    } catch { return dateStr; }
  };

  return (
    <Dialog open={!!cliente} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[90vh] p-0 flex flex-col overflow-hidden">
        {/* ── HEADER ── */}
        <DialogHeader className="px-6 pt-5 pb-5 border-b bg-muted/30 shrink-0 space-y-0">
          <DialogDescription className="sr-only">Detalhes do cliente em risco</DialogDescription>

          {/* Header core: actions/name on left + all badges on right */}
          <div className="flex items-start justify-between gap-5">
            <div className="flex-1 min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5 pb-1">
                {workflow ? (
                  <Select value={workflow.status_workflow} onValueChange={(v) => handleStatusChange(v as WorkflowStatus)}>
                    <SelectTrigger className="h-9 text-xs w-[180px] font-semibold border-primary/30"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="em_tratamento"><span className="flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5 text-yellow-600" />Em Tratamento</span></SelectItem>
                      <SelectItem value="resolvido"><span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />Resolvido</span></SelectItem>
                      <SelectItem value="perdido"><span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-destructive" />Perdido</span></SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Button size="sm" className="h-9 text-xs gap-1.5 px-5 font-semibold" onClick={onStartTreatment}>
                    <PlayCircle className="h-4 w-4" />Iniciar Tratamento
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5 font-semibold" onClick={handleAssumirOwner}>
                  <UserCheck className="h-3.5 w-3.5" />
                  {workflow?.owner_user_id === user?.id ? "Você é o responsável" : "Assumir Atendimento"}
                </Button>
              </div>

              <div className="space-y-2.5">
                <DialogTitle className="text-xl font-bold leading-tight truncate">
                  {cliente.cliente_nome || `Cliente #${cliente.cliente_id}`}
                </DialogTitle>

                {cliente.plano_nome && (
                  <div className="flex items-center gap-1.5">
                    <Package className="h-4 w-4 text-primary" />
                    <span className="text-base font-semibold text-primary leading-tight">{cliente.plano_nome}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-2.5 max-w-[300px]">
              <Badge className={`${BUCKET_COLORS[bucket]} border text-sm font-mono px-3 py-1 shrink-0`}>
                {score} · {bucket}
              </Badge>

              {(statusContrato || metodoCobranca || tipoServico || tipoConexao) && (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {statusContrato && (
                    <Badge variant="outline" className={`text-xs ${statusContrato === "Ativo" ? "border-green-300 bg-green-50 text-green-700" : "border-yellow-300 bg-yellow-50 text-yellow-700"}`}>
                      {statusContrato}
                    </Badge>
                  )}
                  {metodoCobranca && (
                    <Badge variant="outline" className="text-xs capitalize">{metodoCobranca}</Badge>
                  )}
                  {(tipoServico || tipoConexao) && (
                    <Badge variant="outline" className="text-xs">
                      {[tipoServico, tipoConexao].filter(Boolean).join(" · ")}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Client data fields */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            <div className="flex items-center gap-2 text-sm leading-6">
              <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold text-foreground">ID:</span>
              <span className="text-muted-foreground">{cliente.cliente_id}</span>
              <CopyButton value={String(cliente.cliente_id)} label="ID" />
            </div>
            {clienteDocumento && (
              <div className="flex items-center gap-2 text-sm leading-6">
                <IdCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground">Documento:</span>
                <span className="text-muted-foreground">{clienteDocumento}</span>
                <CopyButton value={clienteDocumento} label="Documento" />
              </div>
            )}
            <div className="flex items-center gap-2 text-sm leading-6">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold text-foreground">Pessoa:</span>
              <span className="text-muted-foreground">{tipoPessoaLabel}</span>
            </div>
            {clienteEmail && (
              <div className="flex items-center gap-2 text-sm min-w-0 leading-6">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground">E-mail:</span>
                <span className="text-muted-foreground truncate">{clienteEmail}</span>
                <CopyButton value={clienteEmail} label="E-mail" />
              </div>
            )}
            {clienteCelular && (
              <div className="flex items-center gap-2 text-sm leading-6">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground">Telefone:</span>
                <span className="text-muted-foreground">{clienteCelular}</span>
                <CopyButton value={clienteCelular} label="Telefone" />
              </div>
            )}
            {diaVencimento != null && (
              <div className="flex items-center gap-2 text-sm leading-6">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-foreground">Vencimento:</span>
                <span className="text-muted-foreground">Dia {diaVencimento}</span>
              </div>
            )}
          </div>

          {/* Row 4: Metric boxes */}
          <div className="mt-6 grid grid-cols-4 sm:grid-cols-7 gap-2 text-center">
            <div className="rounded-lg border bg-card p-2 shadow-sm">
              <Activity className="h-3.5 w-3.5 mx-auto text-primary mb-0.5" />
              <div className="text-xs font-bold">{driverPrincipal}</div>
              <div className="text-[9px] text-muted-foreground">Driver</div>
            </div>
            <div className="rounded-lg border bg-card p-2 shadow-sm">
              <DollarSign className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-0.5" />
              <div className="text-xs font-bold">{cliente.valor_mensalidade != null && cliente.valor_mensalidade > 0 ? `R$${cliente.valor_mensalidade.toFixed(0)}` : "—"}</div>
              <div className="text-[9px] text-muted-foreground">Mensalidade</div>
            </div>
            <div className="rounded-lg border bg-card p-2 shadow-sm">
              <Clock className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-0.5" />
              <div className={`text-xs font-bold ${(cliente.dias_atraso ?? 0) > 30 ? "text-destructive" : ""}`}>
                {(cliente.dias_atraso ?? 0) > 0 ? `${Math.round(cliente.dias_atraso!)}d` : "Em dia"}
              </div>
              <div className="text-[9px] text-muted-foreground">Atraso</div>
            </div>
            <div className="rounded-lg border bg-card p-2 shadow-sm">
              <Phone className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-0.5" />
              <div className="text-xs font-bold">{cliente.qtd_chamados_30d || 0}</div>
              <div className="text-[9px] text-muted-foreground">Chamados 30d</div>
            </div>
            {npsData?.nota != null && (
              <div className="rounded-lg border bg-card p-2 shadow-sm">
                {npsData.classificacao === "DETRATOR" ? <ThumbsDown className="h-3.5 w-3.5 mx-auto text-destructive mb-0.5" />
                 : npsData.classificacao === "PROMOTOR" ? <ThumbsUp className="h-3.5 w-3.5 mx-auto text-green-600 mb-0.5" />
                 : <Minus className="h-3.5 w-3.5 mx-auto text-yellow-600 mb-0.5" />}
                <div className="text-xs font-bold">{npsData.nota}</div>
                <div className="text-[9px] text-muted-foreground">NPS</div>
              </div>
            )}
            {tempoContrato && (
              <div className="rounded-lg border bg-card p-2 shadow-sm">
                <Calendar className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-0.5" />
                <div className="text-xs font-bold">{tempoContrato}</div>
                <div className="text-[9px] text-muted-foreground">Contrato</div>
              </div>
            )}
            {ltv != null && ltv > 0 && (
              <div className="rounded-lg border bg-card p-2 shadow-sm">
                <DollarSign className="h-3.5 w-3.5 mx-auto text-primary mb-0.5" />
                <div className="text-xs font-bold">R${Math.round(ltv).toLocaleString("pt-BR")}</div>
                <div className="text-[9px] text-muted-foreground">LTV</div>
              </div>
            )}
          </div>

          {/* Row 5: Score breakdown */}
          <div className="mt-5 flex items-center gap-1.5 flex-wrap">
            {scores.map(s => (
              <Badge key={s.name} variant="outline" className={`text-[10px] font-mono ${s.val > 0 ? 'border-yellow-300 bg-yellow-50 text-yellow-800' : ''}`}>
                {s.name}: {s.val}
              </Badge>
            ))}
          </div>

          {/* Row 6: Tags */}
          {workflow && (
            <div className="mt-5 space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Etiquetas
              </span>
              <div className="flex flex-wrap gap-1.5">
                {clienteTags.map(t => (
                  <Badge key={t} className="text-xs gap-1.5 pr-1 py-0.5 text-white border-0" style={{ backgroundColor: getTagColor(t) }}>
                    {t}
                    <button onClick={() => handleRemoveTag(t)} className="hover:opacity-70 transition-opacity"><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
                <Popover open={showTagPicker} onOpenChange={setShowTagPicker}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-dashed rounded-full"><Plus className="h-3 w-3" /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 space-y-3" align="start">
                    <span className="text-xs font-semibold">Tags disponíveis</span>
                    {globalTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto">
                        {globalTags.filter(t => !clienteTags.includes(t.name)).map(t => (
                          <button key={t.id} onClick={() => { handleAddTag(t.name); setShowTagPicker(false); }}
                            className="text-xs px-2 py-1 rounded-full text-white hover:opacity-80 transition-opacity" style={{ backgroundColor: t.color }}>{t.name}</button>
                        ))}
                      </div>
                    ) : <p className="text-[11px] text-muted-foreground italic">Nenhuma tag criada ainda.</p>}
                    <Separator />
                    <span className="text-[11px] font-semibold">Criar nova tag</span>
                    <div className="flex gap-1.5 items-center">
                      <Input placeholder="Nome..." value={newTagName} onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateGlobalTag(); }} className="h-7 text-xs flex-1" />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="h-7 w-7 rounded-md border flex items-center justify-center shrink-0" style={{ backgroundColor: newTagColor }}>
                            <Palette className="h-3 w-3 text-white" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="end">
                          <div className="grid grid-cols-5 gap-1.5">
                            {TAG_COLORS.map(c => (
                              <button key={c} className={`h-6 w-6 rounded-full border-2 ${newTagColor === c ? "border-foreground" : "border-transparent"}`}
                                style={{ backgroundColor: c }} onClick={() => setNewTagColor(c)} />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button size="sm" className="h-7 text-xs px-2" onClick={handleCreateGlobalTag} disabled={!newTagName.trim()}><Plus className="h-3 w-3" /></Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </DialogHeader>

        {/* ── TABBED CONTENT ── */}
        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="mx-5 mt-3 w-fit bg-muted/50 p-1">
              <TabsTrigger value="acompanhamento" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <MessageSquare className="h-3.5 w-3.5" />Acompanhamento
              </TabsTrigger>
              <TabsTrigger value="atendimento" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Phone className="h-3.5 w-3.5" />Atendimento
              </TabsTrigger>
              <TabsTrigger value="chamado" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Wrench className="h-3.5 w-3.5" />Abrir Chamado
              </TabsTrigger>
              <TabsTrigger value="mapa" className="text-xs gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <TrendingDown className="h-3.5 w-3.5" />Mapa de Churn
              </TabsTrigger>
            </TabsList>

            {/* ── TAB: Acompanhamento ── */}
            <TabsContent value="acompanhamento" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-[calc(90vh-520px)]">
                <div className="p-5 space-y-4">
                  {!workflow && (
                    <Button className="w-full h-10 gap-2" onClick={onStartTreatment}>
                      <PlayCircle className="h-4 w-4" />Enviar para Tratamento
                    </Button>
                  )}

                  <div className="space-y-2">
                    <span className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                      <Pencil className="h-3.5 w-3.5" /> Inserir Nota
                    </span>
                    <Textarea placeholder="Escreva uma observação, nota interna ou próxima ação..." value={noteText}
                      onChange={(e) => setNoteText(e.target.value)} className="min-h-[80px] text-sm resize-none" />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-8 text-xs px-4" onClick={handleAddComment} disabled={!noteText.trim()}>
                        <FileText className="h-3.5 w-3.5 mr-1.5" />Salvar nota
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setActiveTab("atendimento")}>
                        <ArrowRight className="h-3 w-3" />Ir para Atendimento
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" /> Histórico de Interações ({comments.length})
                    </span>
                    {comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-3 text-center">Nenhuma interação registrada ainda.</p>
                    ) : (
                      <div className="space-y-2 max-h-[250px] overflow-y-auto">
                        {comments.map((c) => (
                          <div key={c.id} className={`rounded-lg border p-3 text-sm space-y-1 ${c.type === "action" ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-muted"}`}>
                            {editingCommentId === c.id ? (
                              <div className="space-y-2">
                                <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="min-h-[60px] text-xs resize-none" />
                                <div className="flex gap-1.5">
                                  <Button size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => handleEditComment(c.id)}><Save className="h-2.5 w-2.5" />Salvar</Button>
                                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setEditingCommentId(null)}>Cancelar</Button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-start gap-2">
                                <span className="font-medium flex items-center gap-1.5 flex-1">
                                  {c.type === "action" ? <Activity className="h-3.5 w-3.5 text-primary shrink-0" /> : <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                  {c.body}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="text-muted-foreground text-[10px] mr-1">
                                    {safeFormatDate(c.created_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  {c.type === "comment" && (
                                    <button onClick={() => { setEditingCommentId(c.id); setEditingText(c.body); }} className="p-0.5 hover:text-primary transition-colors" title="Editar">
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button onClick={() => handleDeleteComment(c.id)} className="p-0.5 hover:text-destructive transition-colors" title="Excluir">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => setActiveTab("mapa")}>
                    <TrendingDown className="h-3.5 w-3.5" />Ver Mapa de Churn
                  </Button>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ── TAB: Atendimento ── */}
            <TabsContent value="atendimento" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-[calc(90vh-520px)]">
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11 text-xs gap-2 justify-start font-medium hover:bg-primary/5 hover:border-primary/30" onClick={handleWhatsApp}>
                      <Send className="h-4 w-4 shrink-0" />Enviar WhatsApp
                    </Button>
                    <Button variant="outline" className={`h-11 text-xs gap-2 justify-start font-medium ${hasPix ? "hover:bg-primary/5 hover:border-primary/30" : "opacity-40 cursor-not-allowed"}`}
                      onClick={handleCopyPix} disabled={!hasPix}>
                      <Copy className="h-4 w-4 shrink-0" />Copiar PIX
                      {!hasPix && <span className="text-[9px] text-muted-foreground ml-auto">indisponível</span>}
                    </Button>
                    <Button variant="outline" className={`h-11 text-xs gap-2 justify-start font-medium ${hasBoleto ? "hover:bg-primary/5 hover:border-primary/30" : "opacity-40 cursor-not-allowed"}`}
                      onClick={handleCopyBoleto} disabled={!hasBoleto}>
                      <CreditCard className="h-4 w-4 shrink-0" />Copiar Boleto
                      {!hasBoleto && <span className="text-[9px] text-muted-foreground ml-auto">indisponível</span>}
                    </Button>
                    <Button variant="outline" className={`h-11 text-xs gap-2 justify-start font-medium ${hasQrCode ? "hover:bg-primary/5 hover:border-primary/30" : "opacity-40 cursor-not-allowed"}`}
                      onClick={handleCopyPixQrCode} disabled={!hasQrCode}>
                      <QrCode className="h-4 w-4 shrink-0" />Copiar PIX QR Code
                      {!hasQrCode && <span className="text-[9px] text-muted-foreground ml-auto">indisponível</span>}
                    </Button>
                    <Button variant="outline" className="h-11 text-xs gap-2 justify-start font-medium hover:bg-primary/5 hover:border-primary/30"
                      onClick={() => handleQuickAction("ligacao", "Ligação realizada")}>
                      <Phone className="h-4 w-4 shrink-0" />Registrar Contato
                    </Button>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" className="h-11 text-xs gap-2 justify-start bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                      onClick={() => handleStatusChange("resolvido")}>
                      <CheckCircle2 className="h-4 w-4" />Caso Resolvido
                    </Button>
                    <Button variant="outline" className="h-11 text-xs gap-2 justify-start bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                      onClick={() => handleStatusChange("perdido")}>
                      <XCircle className="h-4 w-4" />Cliente em Churn
                    </Button>
                  </div>

                  <Separator />

                  <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5" onClick={() => setActiveTab("acompanhamento")}>
                    <ArrowRight className="h-3.5 w-3.5" />Ir para Acompanhamento
                  </Button>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ── TAB: Abrir Chamado ── */}
            <TabsContent value="chamado" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-[calc(90vh-520px)]">
                <div className="p-5 space-y-4">
                  <div className="text-center py-8 space-y-3">
                    <Wrench className="h-10 w-10 mx-auto text-muted-foreground/40" />
                    <h3 className="font-semibold text-muted-foreground">Abrir Chamado (OS)</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      Esta funcionalidade permitirá abrir ordens de serviço diretamente no ERP do provedor.
                      Em breve você poderá criar chamados de forma integrada.
                    </p>
                    <Button variant="outline" className="h-11 text-xs gap-2 font-medium"
                      onClick={() => { toast({ title: "Chamado aberto", description: "Ordem de serviço criada via ERP." }); handleQuickAction("os_opened", "OS aberta no ERP"); }}>
                      <Wrench className="h-4 w-4" />Abrir Chamado (OS)
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ── TAB: Mapa de Churn ── */}
            <TabsContent value="mapa" className="flex-1 overflow-hidden m-0">
              <ScrollArea className="h-[calc(90vh-520px)]">
                <div className="p-5 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-destructive" />
                    Mapa de Churn
                    {events.length > 0 && <Badge variant="secondary" className="text-[10px] ml-1">{events.length}</Badge>}
                  </h4>
                  {events.length > 0 ? (
                    <div className="space-y-2">
                      {events.map((e, idx) => {
                        const dateStr = safeFormatDate(e.data_evento, { day: "2-digit", month: "2-digit", year: "2-digit" });
                        const evtConfig = EVENTO_LABELS[e.tipo_evento];
                        const EvtIcon = evtConfig?.icon || AlertTriangle;
                        const evtColor = evtConfig?.color || "text-muted-foreground";
                        const isChamadoReincidente = e.tipo_evento === "chamado_reincidente";

                        return (
                          <div key={e.id || idx} className={`rounded-lg border p-3 text-sm space-y-2 ${e.tipo_evento.includes("detrator") || e.tipo_evento.includes("cancelamento") ? "border-destructive/30 bg-destructive/5" : "bg-card"}`}>
                            <div className="flex justify-between items-center gap-2">
                              <span className={`font-medium flex items-center gap-1.5 ${evtColor}`}>
                                <EvtIcon className="h-3.5 w-3.5 shrink-0" />{evtConfig?.label || e.tipo_evento}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                {e.impacto_score > 0 && <Badge className="bg-destructive/10 text-destructive border-destructive/20 border text-[10px] font-mono">+{e.impacto_score}pts</Badge>}
                                {dateStr !== "—" && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Calendar className="h-2.5 w-2.5" />{dateStr}</span>}
                              </div>
                            </div>
                            {e.descricao && <div className="text-muted-foreground text-xs leading-relaxed">{e.descricao}</div>}
                            {isChamadoReincidente && chamadosCliente.length > 0 && (
                              <div className="mt-1 space-y-1 pl-3 border-l-2 border-yellow-300">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Chamados ({chamadosCliente.length})</span>
                                {chamadosCliente.map((ch, i) => (
                                  <div key={ch.id || i} className="flex items-start gap-2 text-[11px] py-1 border-b border-border/30 last:border-0">
                                    <Phone className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium truncate">{(ch.motivo_contato && ch.motivo_contato !== "Não informado" ? ch.motivo_contato : null) || getCategoriaDisplay(ch.categoria, ispId) || "Sem assunto"}</div>
                                      <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
                                        <span>{formatChamadoDate(ch.data_abertura)}</span>
                                        {ch.setor && <span>· {ch.setor}</span>}
                                        {ch.status && <span>· {ch.status}</span>}
                                        {ch.protocolo && <span className="font-mono text-[10px]">#{ch.protocolo}</span>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic text-center py-6">Nenhum evento encontrado.</p>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
