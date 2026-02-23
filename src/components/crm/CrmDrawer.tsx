import { useState, useMemo } from "react";
import { ChurnStatus, ChurnEvent } from "@/hooks/useChurnData";
import { RiskBucket } from "@/hooks/useRiskBucketConfig";
import { WorkflowStatus, CrmWorkflowRecord } from "@/hooks/useCrmWorkflow";
import { useCrmComments } from "@/hooks/useCrmComments";
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
import { useToast } from "@/hooks/use-toast";
import {
  PlayCircle, CheckCircle2, XCircle, Tag, UserCheck,
  MessageSquare, Phone, Send, Handshake, Wrench,
  ThumbsDown, ThumbsUp, Minus, X, Plus, Clock, DollarSign,
  AlertTriangle, TrendingDown, Activity, FileText, Calendar,
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
};

const AVAILABLE_TAGS = ["VIP", "Alto Ticket", "Sensível", "Risco Jurídico", "Prioridade", "Crítico", "NPS Detrator", "Financeiro", "Suporte Recorrente"];

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
  onClose: () => void;
  onStartTreatment: () => Promise<void>;
  onUpdateStatus: (status: WorkflowStatus) => Promise<void>;
  onUpdateTags: (tags: string[]) => Promise<void>;
  onUpdateOwner: (ownerId: string | null) => Promise<void>;
}

export function CrmDrawer({
  cliente, score, bucket, workflow, events, onClose,
  onStartTreatment, onUpdateStatus, onUpdateTags, onUpdateOwner,
}: CrmDrawerProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const { comments, addComment } = useCrmComments(cliente?.cliente_id ?? null);
  const [noteText, setNoteText] = useState("");
  const [newTag, setNewTag] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  if (!cliente) return null;

  const tags = workflow?.tags || [];

  const handleAddTag = async (tag: string) => {
    if (!tag || tags.includes(tag)) return;
    try {
      await onUpdateTags([...tags, tag]);
      setNewTag("");
    } catch { toast({ title: "Erro ao adicionar tag", variant: "destructive" }); }
  };

  const handleRemoveTag = async (tag: string) => {
    try {
      await onUpdateTags(tags.filter(t => t !== tag));
    } catch { toast({ title: "Erro ao remover tag", variant: "destructive" }); }
  };

  const handleAddComment = async () => {
    if (!noteText.trim()) return;
    try {
      await addComment(noteText.trim(), "comment");
      setNoteText("");
      toast({ title: "Nota adicionada" });
    } catch { toast({ title: "Erro ao salvar nota", variant: "destructive" }); }
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

  // Driver principal
  const scores = [
    { name: "Financeiro", val: cliente.score_financeiro ?? 0 },
    { name: "Suporte", val: cliente.score_suporte ?? 0 },
    { name: "NPS", val: cliente.score_nps ?? 0 },
    { name: "Qualidade", val: cliente.score_qualidade ?? 0 },
    { name: "Comportamental", val: cliente.score_comportamental ?? 0 },
  ].sort((a, b) => b.val - a.val);
  const driverPrincipal = scores[0]?.name || "—";

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

          {/* Tags */}
          {workflow && (
            <div className="mt-3 space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Etiquetas
              </span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => (
                  <Badge key={t} variant="secondary" className="text-xs gap-1.5 pr-1 py-0.5">
                    {t}
                    <button onClick={() => handleRemoveTag(t)} className="hover:text-destructive transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Select value="" onValueChange={(v) => handleAddTag(v)}>
                  <SelectTrigger className="h-7 w-7 p-0 border-dashed rounded-full">
                    <Plus className="h-3 w-3" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_TAGS.filter(t => !tags.includes(t)).map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nova tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddTag(newTag); }}
                  className="h-7 w-[100px] text-xs"
                />
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

                {/* Comments history */}
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
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-medium flex items-center gap-1.5">
                              {c.type === "action" ? <Activity className="h-3.5 w-3.5 text-primary shrink-0" /> : <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                              {c.body}
                            </span>
                            <span className="text-muted-foreground text-[10px] shrink-0 ml-2 pt-0.5">
                              {safeFormatDate(c.created_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
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
                <div className="relative pl-5 border-l-2 border-border space-y-3">
                  {events.map((e, idx) => {
                    const dateStr = safeFormatDate(e.data_evento, { day: "2-digit", month: "2-digit", year: "2-digit" });
                    const isValid = dateStr !== "—";
                    const evtConfig = EVENTO_LABELS[e.tipo_evento];
                    const EvtIcon = evtConfig?.icon || AlertTriangle;
                    const evtColor = evtConfig?.color || "text-muted-foreground";

                    return (
                      <div key={e.id || idx} className="relative">
                        {/* Timeline dot */}
                        <div className={`absolute -left-[25px] top-2 w-3 h-3 rounded-full border-2 border-background ${e.impacto_score > 10 ? "bg-destructive" : e.impacto_score > 0 ? "bg-yellow-500" : "bg-muted-foreground"}`} />
                        <div className={`rounded-lg border p-3 text-sm space-y-1.5 hover:shadow-sm transition-shadow ${e.tipo_evento.includes("detrator") || e.tipo_evento.includes("cancelamento") ? "border-destructive/30 bg-destructive/5" : "bg-card"}`}>
                          <div className="flex justify-between items-center gap-2">
                            <span className={`font-medium flex items-center gap-1.5 ${evtColor}`}>
                              <EvtIcon className="h-3.5 w-3.5 shrink-0" />
                              {evtConfig?.label || e.tipo_evento}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              {e.impacto_score > 0 && (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/20 border text-[10px] font-mono">+{e.impacto_score}pts</Badge>
                              )}
                              {isValid && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Calendar className="h-2.5 w-2.5" />{dateStr}
                                </span>
                              )}
                            </div>
                          </div>
                          {e.descricao && (
                            <div className="text-muted-foreground text-xs leading-relaxed">{e.descricao}</div>
                          )}
                        </div>
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
