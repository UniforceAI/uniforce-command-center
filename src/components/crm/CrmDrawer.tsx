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
import { useToast } from "@/hooks/use-toast";
import {
  PlayCircle, CheckCircle2, XCircle, Tag, UserCheck,
  MessageSquare, Phone, Send, Handshake, Wrench,
  ThumbsDown, ThumbsUp, Minus, X, Plus, Clock, DollarSign,
  AlertTriangle, TrendingDown,
} from "lucide-react";

const BUCKET_COLORS: Record<RiskBucket, string> = {
  OK: "bg-green-100 text-green-800 border-green-200",
  ALERTA: "bg-yellow-100 text-yellow-800 border-yellow-200",
  "CRÍTICO": "bg-red-100 text-red-800 border-red-200",
};

const STATUS_LABELS: Record<WorkflowStatus, { label: string; icon: typeof PlayCircle; cls: string }> = {
  em_tratamento: { label: "Em Tratamento", icon: PlayCircle, cls: "text-yellow-600" },
  resolvido: { label: "Resolvido", icon: CheckCircle2, cls: "text-green-600" },
  perdido: { label: "Perdido", icon: XCircle, cls: "text-destructive" },
};

const EVENTO_LABELS: Record<string, string> = {
  inadimplencia_iniciou: "🔴 Inadimplência iniciou",
  inadimplencia_agravou: "⬆️ Atraso agravou",
  inadimplencia_resolvida: "✅ Pagamento efetuado",
  bloqueio_automatico: "🔒 Bloqueio automático",
  chamado_critico: "🚨 Chamado crítico",
  chamado_reincidente: "📞 Chamado reincidente",
  nps_detrator: "👎 NPS detrator",
  cancelamento_real: "❌ Cancelamento confirmado",
  risco_aumentou: "⚠️ Risco aumentou",
  risco_reduziu: "📉 Risco reduziu",
  score_critico: "🔥 Score crítico atingido",
  suspensao_fidelidade: "📋 Suspensão de fidelidade",
};

const AVAILABLE_TAGS = ["VIP", "Alto Ticket", "Sensível", "Risco Jurídico", "Prioridade"];

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
    try {
      await addComment(`Ação: ${label}`, "action", { action_type: actionType });
      // Also update last_action_at via status update (keeps current status)
      if (workflow) {
        await onUpdateStatus(workflow.status_workflow);
      }
      toast({ title: `${label} registrado` });
    } catch { toast({ title: "Erro ao registrar ação", variant: "destructive" }); }
  };

  const handleAssumirOwner = async () => {
    if (!user) return;
    try {
      await onUpdateOwner(user.id);
      toast({ title: "Você assumiu este cliente" });
    } catch { toast({ title: "Erro", variant: "destructive" }); }
  };

  return (
    <Sheet open={!!cliente} onOpenChange={() => onClose()}>
      <SheetContent side="right" className="w-[480px] overflow-y-auto p-0">
        <SheetHeader className="p-5 pb-3 border-b bg-muted/30">
          <SheetTitle className="text-base font-bold">
            {cliente.cliente_nome || `#${cliente.cliente_id}`}
          </SheetTitle>
          <SheetDescription className="sr-only">Detalhes do cliente em risco</SheetDescription>

          {/* Score + Bucket + Status */}
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Badge className={`${BUCKET_COLORS[bucket]} border text-xs font-mono px-2`}>
              {score} · {bucket}
            </Badge>
            {workflow && (() => {
              const s = STATUS_LABELS[workflow.status_workflow];
              const Icon = s.icon;
              return (
                <Badge variant="outline" className={`${s.cls} text-xs gap-1`}>
                  <Icon className="h-3 w-3" />{s.label}
                </Badge>
              );
            })()}
            {cliente.plano_nome && (
              <span className="text-[11px] text-muted-foreground">{cliente.plano_nome}</span>
            )}
          </div>
        </SheetHeader>

        <div className="p-5 space-y-5">
          {/* ── BLOCK 1: CRM Header ── */}
          <div className="space-y-3">
            {/* Status workflow selector + Owner */}
            <div className="flex items-center gap-3">
              {workflow ? (
                <Select value={workflow.status_workflow} onValueChange={(v) => onUpdateStatus(v as WorkflowStatus)}>
                  <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="em_tratamento">Em Tratamento</SelectItem>
                    <SelectItem value="resolvido">Resolvido</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Button size="sm" className="h-8 text-xs gap-1.5" onClick={onStartTreatment}>
                  <PlayCircle className="h-3.5 w-3.5" />Iniciar Tratamento
                </Button>
              )}

              {workflow && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={handleAssumirOwner}>
                  <UserCheck className="h-3 w-3" />
                  {workflow.owner_user_id === user?.id ? "Você" : "Assumir"}
                </Button>
              )}
            </div>

            {/* Tags */}
            {workflow && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                  <Tag className="h-3 w-3" /> Etiquetas
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <Badge key={t} variant="secondary" className="text-[10px] gap-1 pr-1">
                      {t}
                      <button onClick={() => handleRemoveTag(t)} className="hover:text-destructive">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                  <Select value="" onValueChange={(v) => handleAddTag(v)}>
                    <SelectTrigger className="h-6 w-6 p-0 border-dashed">
                      <Plus className="h-3 w-3" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_TAGS.filter(t => !tags.includes(t)).map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Mini metrics */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md border bg-muted/30 p-2">
                <DollarSign className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                <div className="text-xs font-bold">
                  {cliente.valor_mensalidade != null && cliente.valor_mensalidade > 0
                    ? `R$${cliente.valor_mensalidade.toFixed(0)}`
                    : "—"}
                </div>
                <div className="text-[9px] text-muted-foreground">Mensalidade</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <Clock className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                <div className={`text-xs font-bold ${(cliente.dias_atraso ?? 0) > 30 ? "text-destructive" : ""}`}>
                  {(cliente.dias_atraso ?? 0) > 0 ? `${Math.round(cliente.dias_atraso!)}d` : "Em dia"}
                </div>
                <div className="text-[9px] text-muted-foreground">Atraso</div>
              </div>
              <div className="rounded-md border bg-muted/30 p-2">
                <Phone className="h-3 w-3 mx-auto text-muted-foreground mb-0.5" />
                <div className="text-xs font-bold">{cliente.qtd_chamados_30d || 0}</div>
                <div className="text-[9px] text-muted-foreground">Chamados 30d</div>
              </div>
            </div>
          </div>

          {/* ── BLOCK 2: Quadro de Tratativa ── */}
          {workflow && (
            <div className="space-y-3 rounded-lg border p-3 bg-card">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3" /> Quadro de Tratativa
              </h4>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleQuickAction("whatsapp", "WhatsApp enviado")}>
                  <Send className="h-3 w-3" />WhatsApp
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleQuickAction("ligacao", "Ligação realizada")}>
                  <Phone className="h-3 w-3" />Ligar
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleQuickAction("acordo", "Acordo de pagamento")}>
                  <Handshake className="h-3 w-3" />Acordo
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => handleQuickAction("visita", "Visita/OS agendada")}>
                  <Wrench className="h-3 w-3" />Visita/OS
                </Button>
              </div>

              {/* Notes textarea */}
              <div className="space-y-1.5">
                <Textarea
                  placeholder="Adicionar nota interna..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  className="min-h-[60px] text-xs resize-none"
                />
                <Button size="sm" className="h-7 text-xs" onClick={handleAddComment} disabled={!noteText.trim()}>
                  Salvar nota
                </Button>
              </div>

              {/* Comments history */}
              {comments.length > 0 && (
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">Histórico</span>
                  {comments.map((c) => (
                    <div key={c.id} className={`rounded border p-2 text-[11px] space-y-0.5 ${c.type === "action" ? "bg-primary/5 border-primary/20" : "bg-muted/30"}`}>
                      <div className="flex justify-between">
                        <span className="font-medium">
                          {c.type === "action" ? "⚡ " : "💬 "}
                          {c.body}
                        </span>
                        <span className="text-muted-foreground text-[10px] shrink-0 ml-2">
                          {safeFormatDate(c.created_at, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── BLOCK 3: Roadmap to Churn ── */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Roadmap to Churn {events.length > 0 && `(${events.length})`}
            </h4>
            {events.length > 0 ? (
              <div className="relative pl-4 border-l-2 border-border space-y-3">
                {events.map((e, idx) => {
                  const dateStr = safeFormatDate(e.data_evento, { day: "2-digit", month: "2-digit", year: "2-digit" });
                  const isValid = dateStr !== "—";
                  return (
                    <div key={e.id || idx} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-border border-2 border-background" />
                      <div className={`rounded-md border p-2.5 text-xs space-y-1 ${e.tipo_evento === "nps_detrator" ? "border-destructive/30 bg-destructive/5" : "bg-card"}`}>
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-medium">{EVENTO_LABELS[e.tipo_evento] || e.tipo_evento}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {e.impacto_score > 0 && (
                              <Badge variant="outline" className="text-[10px] font-mono">+{e.impacto_score}pts</Badge>
                            )}
                            {isValid && (
                              <span className="text-[10px] text-muted-foreground">{dateStr}</span>
                            )}
                          </div>
                        </div>
                        {e.descricao && (
                          <div className="text-muted-foreground text-[11px]">{e.descricao}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum evento encontrado nos últimos 90 dias.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
