import { useState, useMemo } from "react";
import { ChurnStatus, ChurnEvent } from "@/hooks/useChurnData";
import { ChamadoData } from "@/hooks/useChamados";
import { RiskBucket } from "@/hooks/useRiskBucketConfig";
import { WorkflowStatus, CrmWorkflowRecord } from "@/hooks/useCrmWorkflow";
import { useCrmComments } from "@/hooks/useCrmComments";
import { useCrmTags, CrmTag } from "@/hooks/useCrmTags";
import { useAuth } from "@/contexts/AuthContext";
import { safeFormatDate } from "@/lib/safeDate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import {
  PlayCircle, CheckCircle2, XCircle, Tag, UserCheck,
  MessageSquare, Phone, Send, Handshake, Wrench,
  ThumbsDown, ThumbsUp, Minus, X, Plus, Clock, DollarSign,
  AlertTriangle, TrendingDown, Activity, FileText, Calendar,
  Trash2, Pencil, Save, Palette,
} from "lucide-react";

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

const QUICK_ACTIONS = [
  { key: "whatsapp", label: "WhatsApp", icon: Send, desc: "WhatsApp enviado" },
  { key: "ligacao", label: "Ligar", icon: Phone, desc: "Ligação realizada" },
  { key: "acordo", label: "Acordo", icon: Handshake, desc: "Acordo de pagamento" },
  { key: "visita", label: "Visita/OS", icon: Wrench, desc: "Visita/OS agendada" },
];

interface CrmDrawerProps {
  cliente: ChurnStatus | null;
  score: number;
  bucket: RiskBucket;
  workflow: CrmWorkflowRecord | undefined;
  events: ChurnEvent[];
  chamadosCliente: ChamadoData[];
  onClose: () => void;
  onStartTreatment: () => Promise<void>;
  onUpdateStatus: (status: WorkflowStatus) => Promise<void>;
  onUpdateTags: (tags: string[]) => Promise<void>;
  onUpdateOwner: (ownerId: string | null) => Promise<void>;
}

export function CrmDrawer({
  cliente, score, bucket, workflow, events, chamadosCliente, onClose,
  onStartTreatment, onUpdateStatus, onUpdateTags, onUpdateOwner,
}: CrmDrawerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { comments, addComment, updateComment, deleteComment } = useCrmComments(cliente?.cliente_id ?? null);
  const { tags: globalTags, createTag } = useCrmTags();
  const [noteText, setNoteText] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showTagPicker, setShowTagPicker] = useState(false);

  if (!cliente) return null;

  const clienteTags = workflow?.tags || [];

  const handleAddTag = async (tag: string) => {
    if (!tag || clienteTags.includes(tag)) return;
    try {
      await onUpdateTags([...clienteTags, tag]);
    } catch { toast({ title: "Erro ao adicionar tag", variant: "destructive" }); }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      await onUpdateTags(clienteTags.filter(t => t !== tag));
    } catch { toast({ title: "Erro ao remover tag", variant: "destructive" }); }
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
    try {
      await deleteComment(commentId);
      toast({ title: "Interação removida" });
    } catch { toast({ title: "Erro ao excluir", variant: "destructive" }); }
  };

  const handleQuickAction = async (actionType: string, label: string) => {
    setActionLoading(actionType);
    try {
      await addComment(`Ação: ${label}`, "action", { action_type: actionType });
      if (workflow) {
        await onUpdateStatus(workflow.status_workflow);
      }
      toast({ title: `${label} registrado` });
    } catch { toast({ title: "Erro ao registrar ação", variant: "destructive" }); }
    setActionLoading(null);
  };

  const handleAssumirOwner = async () => {
    if (!user) return;
    try {
      await onUpdateOwner(user.id);
      toast({ title: "Você assumiu este cliente" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  const handleStatusChange = async (status: WorkflowStatus) => {
    try {
      await onUpdateStatus(status);
      toast({ title: `Marcado como ${STATUS_LABELS[status].label}` });
    } catch { toast({ title: "Erro ao atualizar status", variant: "destructive" }); }
  };

  // Score breakdown
  const scores = [
    { name: "Financeiro", val: cliente.score_financeiro ?? 0 },
    { name: "Suporte", val: cliente.score_suporte ?? 0 },
    { name: "NPS", val: cliente.score_nps ?? 0 },
    { name: "Qualidade", val: cliente.score_qualidade ?? 0 },
    { name: "Comportamental", val: cliente.score_comportamental ?? 0 },
  ].sort((a, b) => b.val - a.val);
  const driverPrincipal = scores[0]?.name || "—";

  // Get tag color from global catalog
  const getTagColor = (tagName: string) => {
    const gt = globalTags.find(t => t.name === tagName);
    return gt?.color || "#64748b";
  };

  // Format chamado date
  const formatChamadoDate = (dateStr: string) => {
    try {
      if (dateStr.includes("/")) {
        const [datePart] = dateStr.split(" ");
        return datePart;
      }
      return safeFormatDate(dateStr, { day: "2-digit", month: "2-digit", year: "2-digit" });
    } catch { return dateStr; }
  };

  return (
    <Sheet open={!!cliente} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] overflow-hidden p-0 flex flex-col">
        {/* ── HEADER CRM ── */}
        <SheetHeader className="p-5 pb-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-lg font-bold leading-tight truncate">
                {cliente.cliente_nome || `Cliente #${cliente.cliente_id}`}
              </SheetTitle>
              <SheetDescription className="sr-only">Detalhes do cliente em risco</SheetDescription>
              {cliente.plano_nome && (
                <span className="text-xs text-muted-foreground mt-0.5 block">{cliente.plano_nome}</span>
              )}
            </div>
            <Badge className={`${BUCKET_COLORS[bucket]} border text-sm font-mono px-3 py-1 shrink-0`}>
              {score} · {bucket}
            </Badge>
          </div>

          {/* Status + Owner row */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {workflow ? (
              <Select value={workflow.status_workflow} onValueChange={(v) => handleStatusChange(v as WorkflowStatus)}>
                <SelectTrigger className="h-9 text-xs w-[170px] font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="em_tratamento">
                    <span className="flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5 text-yellow-600" />Em Tratamento</span>
                  </SelectItem>
                  <SelectItem value="resolvido">
                    <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />Resolvido</span>
                  </SelectItem>
                  <SelectItem value="perdido">
                    <span className="flex items-center gap-1.5"><XCircle className="h-3.5 w-3.5 text-destructive" />Perdido</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Button size="sm" className="h-9 text-xs gap-1.5 px-4" onClick={onStartTreatment}>
                <PlayCircle className="h-4 w-4" />Iniciar Tratamento
              </Button>
            )}

            {workflow && (
              <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={handleAssumirOwner}>
                <UserCheck className="h-3.5 w-3.5" />
                {workflow.owner_user_id === user?.id ? "Você é o responsável" : "Assumir responsabilidade"}
              </Button>
            )}
          </div>

          {/* Tags with color-coded global catalog */}
          {workflow && (
            <div className="mt-3 space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Etiquetas
              </span>
              <div className="flex flex-wrap gap-1.5">
                {clienteTags.map(t => (
                  <Badge
                    key={t}
                    className="text-xs gap-1.5 pr-1 py-0.5 text-white border-0"
                    style={{ backgroundColor: getTagColor(t) }}
                  >
                    {t}
                    <button onClick={() => handleRemoveTag(t)} className="hover:opacity-70 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}

                {/* Tag picker popover */}
                <Popover open={showTagPicker} onOpenChange={setShowTagPicker}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-dashed rounded-full">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-3 space-y-3" align="start">
                    <span className="text-xs font-semibold">Tags disponíveis</span>
                    {globalTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto">
                        {globalTags
                          .filter(t => !clienteTags.includes(t.name))
                          .map(t => (
                            <button
                              key={t.id}
                              onClick={() => { handleAddTag(t.name); setShowTagPicker(false); }}
                              className="text-xs px-2 py-1 rounded-full text-white hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: t.color }}
                            >
                              {t.name}
                            </button>
                          ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">Nenhuma tag criada ainda.</p>
                    )}
                    <Separator />
                    <span className="text-[11px] font-semibold">Criar nova tag</span>
                    <div className="flex gap-1.5 items-center">
                      <Input
                        placeholder="Nome..."
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleCreateGlobalTag(); }}
                        className="h-7 text-xs flex-1"
                      />
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="h-7 w-7 rounded-md border flex items-center justify-center shrink-0"
                            style={{ backgroundColor: newTagColor }}
                          >
                            <Palette className="h-3 w-3 text-white" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2" align="end">
                          <div className="grid grid-cols-5 gap-1.5">
                            {TAG_COLORS.map(c => (
                              <button
                                key={c}
                                className={`h-6 w-6 rounded-full border-2 ${newTagColor === c ? "border-foreground" : "border-transparent"}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setNewTagColor(c)}
                              />
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button size="sm" className="h-7 text-xs px-2" onClick={handleCreateGlobalTag} disabled={!newTagName.trim()}>
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Driver + Mini metrics */}
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            <div className="rounded-lg border bg-card p-2.5 shadow-sm">
              <Activity className="h-3.5 w-3.5 mx-auto text-primary mb-1" />
              <div className="text-xs font-bold">{driverPrincipal}</div>
              <div className="text-[9px] text-muted-foreground">Driver</div>
            </div>
            <div className="rounded-lg border bg-card p-2.5 shadow-sm">
              <DollarSign className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
              <div className="text-xs font-bold">
                {cliente.valor_mensalidade != null && cliente.valor_mensalidade > 0
                  ? `R$${cliente.valor_mensalidade.toFixed(0)}`
                  : "—"}
              </div>
              <div className="text-[9px] text-muted-foreground">Mensalidade</div>
            </div>
            <div className="rounded-lg border bg-card p-2.5 shadow-sm">
              <Clock className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
              <div className={`text-xs font-bold ${(cliente.dias_atraso ?? 0) > 30 ? "text-destructive" : ""}`}>
                {(cliente.dias_atraso ?? 0) > 0 ? `${Math.round(cliente.dias_atraso!)}d` : "Em dia"}
              </div>
              <div className="text-[9px] text-muted-foreground">Atraso</div>
            </div>
            <div className="rounded-lg border bg-card p-2.5 shadow-sm">
              <Phone className="h-3.5 w-3.5 mx-auto text-muted-foreground mb-1" />
              <div className="text-xs font-bold">{cliente.qtd_chamados_30d || 0}</div>
              <div className="text-[9px] text-muted-foreground">Chamados 30d</div>
            </div>
          </div>

          {/* Score breakdown */}
          <div className="mt-3 flex gap-1.5 flex-wrap">
            {scores.map(s => (
              <Badge key={s.name} variant="outline" className={`text-[10px] font-mono ${s.val > 0 ? 'border-yellow-300 bg-yellow-50 text-yellow-800' : ''}`}>
                {s.name}: {s.val}
              </Badge>
            ))}
          </div>
        </SheetHeader>

        {/* ── SCROLLABLE CONTENT ── */}
        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* ── BLOCK 2: Quadro de Tratativa ── */}
            {workflow && (
              <div className="space-y-4 rounded-xl border-2 border-primary/20 p-4 bg-card shadow-sm">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-primary">
                  <MessageSquare className="h-4 w-4" /> Quadro de Tratativa
                </h4>

                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-2">
                  {QUICK_ACTIONS.map(qa => (
                    <Button
                      key={qa.key}
                      size="sm"
                      variant="outline"
                      className="h-10 text-xs gap-2 justify-start font-medium hover:bg-primary/5 hover:border-primary/30 transition-colors"
                      onClick={() => handleQuickAction(qa.key, qa.desc)}
                      disabled={actionLoading === qa.key}
                    >
                      <qa.icon className="h-4 w-4 shrink-0" />{qa.label}
                    </Button>
                  ))}
                </div>

                {/* Notes textarea */}
                <div className="space-y-2">
                  <Textarea
                    placeholder="Escreva uma nota interna, observação ou próxima ação..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="min-h-[80px] text-sm resize-none"
                  />
                  <Button size="sm" className="h-8 text-xs px-4" onClick={handleAddComment} disabled={!noteText.trim()}>
                    <FileText className="h-3.5 w-3.5 mr-1.5" />Salvar nota
                  </Button>
                </div>

                <Separator />

                {/* Comments history with edit/delete */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Histórico de Interações ({comments.length})
                  </span>
                  {comments.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-3 text-center">Nenhuma interação registrada ainda.</p>
                  ) : (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {comments.map((c) => (
                        <div key={c.id} className={`rounded-lg border p-3 text-sm space-y-1 transition-colors ${c.type === "action" ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-muted"}`}>
                          {editingCommentId === c.id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                className="min-h-[60px] text-xs resize-none"
                              />
                              <div className="flex gap-1.5">
                                <Button size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={() => handleEditComment(c.id)}>
                                  <Save className="h-2.5 w-2.5" />Salvar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setEditingCommentId(null)}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
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
                                    <button
                                      onClick={() => { setEditingCommentId(c.id); setEditingText(c.body); }}
                                      className="p-0.5 hover:text-primary transition-colors"
                                      title="Editar"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleDeleteComment(c.id)}
                                    className="p-0.5 hover:text-destructive transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── BLOCK 3: Roadmap to Churn ── */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" />
                Roadmap to Churn
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
                            <EvtIcon className="h-3.5 w-3.5 shrink-0" />
                            {evtConfig?.label || e.tipo_evento}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {e.impacto_score > 0 && (
                              <Badge className="bg-destructive/10 text-destructive border-destructive/20 border text-[10px] font-mono">+{e.impacto_score}pts</Badge>
                            )}
                            {dateStr !== "—" && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Calendar className="h-2.5 w-2.5" />{dateStr}
                              </span>
                            )}
                          </div>
                        </div>
                        {e.descricao && (
                          <div className="text-muted-foreground text-xs leading-relaxed">{e.descricao}</div>
                        )}

                        {/* Chamados detail list */}
                        {isChamadoReincidente && chamadosCliente.length > 0 && (
                          <div className="mt-1 space-y-1 pl-3 border-l-2 border-yellow-300">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Chamados ({chamadosCliente.length})</span>
                            {chamadosCliente.map((ch, i) => (
                              <div key={ch.id || i} className="flex items-start gap-2 text-[11px] py-1 border-b border-border/30 last:border-0">
                                <Phone className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{ch.motivo_contato || ch.categoria || "Sem assunto"}</div>
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
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
