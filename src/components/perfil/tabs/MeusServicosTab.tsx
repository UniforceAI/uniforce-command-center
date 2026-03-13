// src/components/perfil/tabs/MeusServicosTab.tsx
// Aba "Meus Serviços" — visão de serviços contratados, commitment periods, ações de gerenciamento
// e status de implementação (absorvido da antiga aba Implementação)

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Package, Zap, Crown, Star, Calendar, CheckCircle2,
  AlertCircle, RefreshCw, ArrowUpCircle, Mail, ExternalLink,
  Rocket, Clock, Circle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useIspServices, ContractedItem } from "@/hooks/useIspServices";
import { useCancelSubscription } from "@/hooks/useCancelSubscription";
import { useUserRole } from "@/hooks/useUserRole";

const STRIPE_BILLING_PORTAL_URL = "https://billing.stripe.com/p/login/3cI28t3Vp4SHfaS4AK93y00";

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function planIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("i.a") || n.includes("ia")) return <Crown className="h-5 w-5 text-purple-500" />;
  if (n.includes("growth")) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (n.includes("retention")) return <Zap className="h-5 w-5 text-blue-500" />;
  if (n.includes("basic")) return <Star className="h-5 w-5 text-primary" />;
  return <Package className="h-5 w-5 text-primary" />;
}

function statusBadge(status: ContractedItem["status"]) {
  const variants: Record<string, { label: string; className: string }> = {
    active:            { label: "Ativo",      className: "bg-green-500/15 text-green-700 border-green-200" },
    cancel_scheduled:  { label: "Cancelando", className: "bg-orange-500/15 text-orange-700 border-orange-200" },
    canceled:          { label: "Cancelado",  className: "bg-gray-500/15 text-gray-700 border-gray-200" },
  };
  const v = variants[status] ?? { label: status, className: "" };
  return <Badge variant="outline" className={`text-xs font-medium ${v.className}`}>{v.label}</Badge>;
}

function CommitmentProgress({ item }: { item: ContractedItem }) {
  const startedAt = new Date(item.started_at).getTime();
  const commitmentEnd = new Date(item.commitment_ends_at).getTime();
  const now = Date.now();
  const totalDuration = commitmentEnd - startedAt;
  const elapsed = Math.max(0, Math.min(now - startedAt, totalDuration));
  const progress = totalDuration > 0 ? Math.max(0, Math.min(100, (elapsed / totalDuration) * 100)) : 100;
  const isFulfilled = item.days_until_commitment_free <= 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Período mínimo de permanência</span>
        <span className={isFulfilled ? "text-green-600 font-medium" : "text-orange-600 font-medium"}>
          {isFulfilled
            ? "Compromisso cumprido"
            : `${item.days_until_commitment_free} dias restantes`}
        </span>
      </div>
      <Progress value={progress} className="h-1.5" />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{formatDate(item.started_at)}</span>
        <span>{formatDate(item.commitment_ends_at)}</span>
      </div>
    </div>
  );
}

// Features conhecidas por nome de plano (fallback visual)
const PLAN_FEATURES: Record<string, string[]> = {
  retention: ["Dashboard de Retenção", "Análise Preditiva Churn Score®", "Clientes em Risco", "Inadimplência"],
  growth:    ["Dashboard de Retenção", "Análise Preditiva Churn Score®", "Clientes em Risco", "Inadimplência", "2 Agentes de Automação"],
  "i.a":     ["Dashboard de Retenção", "Análise Preditiva Churn Score®", "Clientes em Risco", "Inadimplência", "2 Agentes de Automação", "Agente IA (SupportHelper N1 / Max Sales)"],
};

function planFeatures(name: string): string[] {
  const n = name.toLowerCase();
  if (n.includes("i.a") || n.includes("ia")) return PLAN_FEATURES["i.a"];
  if (n.includes("growth")) return PLAN_FEATURES.growth;
  if (n.includes("retention")) return PLAN_FEATURES.retention;
  return [];
}

// ─── Implementação: utilitários ─────────────────────────────────────────────

const IMPL_STEP_LABELS = ["Não iniciado", "Em implantação", "Concluído"];
const IMPL_STEP_PROGRESS = [0, 50, 100];

function statusToStep(status: string): number {
  const s = status?.toLowerCase().trim() || "";
  if (s === "concluído" || s === "concluido") return 2;
  if (s === "em andamento") return 1;
  return 0;
}

// ─── Sub-componente: card de item contratado ──────────────────────────────────

interface ServiceItemCardProps {
  item: ContractedItem;
  canManage: boolean;
  onCancelRequest: (item: ContractedItem) => void;
  cancelingId: string | null;
}

function ServiceItemCard({ item, canManage, onCancelRequest, cancelingId }: ServiceItemCardProps) {
  const features = item.product_type === "plan" ? planFeatures(item.product_name) : [];
  const isAsaas = item.billing_source === "asaas";
  const isCancelingThis = cancelingId === item.id;
  const isInCommitment = item.days_until_commitment_free > 0;

  return (
    <Card className={item.product_type === "plan" ? "border-primary/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {item.product_type === "plan" ? planIcon(item.product_name) : <Zap className="h-5 w-5 text-primary" />}
            {item.product_name}
          </CardTitle>
          {statusBadge(item.status)}
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground text-lg">{formatCurrency(item.monthly_amount, item.currency)}</span>
          {" "}/mês · Assinatura recorrente ativa
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Commitment progress */}
        <CommitmentProgress item={item} />

        {/* Features do plano */}
        {features.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Incluído no plano</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {features.map((feat, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {feat}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cancel scheduled warning */}
        {item.status === "cancel_scheduled" && item.cancel_at && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Cancelamento agendado para {formatDate(item.cancel_at)}.</span>
          </div>
        )}

        {/* Ações */}
        {canManage && item.status !== "cancel_scheduled" && (
          <div className="flex flex-wrap gap-2 pt-1">
            {item.product_type === "plan" && !isAsaas && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={isInCommitment}
                  asChild={!isInCommitment}
                  title={isInCommitment ? "Disponível após período de carência" : undefined}
                >
                  {isInCommitment ? (
                    <span>
                      <ExternalLink className="h-4 w-4" />
                      Alterar Plano
                    </span>
                  ) : (
                    <a href={STRIPE_BILLING_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Alterar Plano
                    </a>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isInCommitment || isCancelingThis}
                  title={isInCommitment ? "Disponível após período de carência" : undefined}
                  asChild={!isInCommitment && !isCancelingThis}
                >
                  {isInCommitment ? (
                    <span>
                      {isCancelingThis && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                      Cancelar Assinatura
                    </span>
                  ) : (
                    <a href={STRIPE_BILLING_PORTAL_URL} target="_blank" rel="noopener noreferrer">
                      Cancelar Assinatura
                    </a>
                  )}
                </Button>
              </>
            )}
            {item.product_type === "plan" && isAsaas && (
              <>
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <a href="?tab=meus-produtos">
                    <ArrowUpCircle className="h-4 w-4" />
                    Alterar Plano
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isCancelingThis}
                  onClick={() => {
                    if (!isCancelingThis) onCancelRequest(item);
                  }}
                >
                  {isCancelingThis && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Cancelar Assinatura
                </Button>
              </>
            )}
            {item.product_type !== "plan" && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                disabled={isCancelingThis}
                onClick={() => {
                  if (!isCancelingThis) onCancelRequest(item);
                }}
              >
                {isCancelingThis && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Cancelar Agente
              </Button>
            )}
            {isInCommitment && item.product_type === "plan" && !isAsaas && (
              <p className="text-xs text-muted-foreground w-full">
                Disponível após período de carência ({item.days_until_commitment_free} dias restantes).
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seção de implementação (absorvida da antiga aba) ────────────────────────

function ImplementationSection({ leadStatus, loading }: { leadStatus: string; loading: boolean }) {
  const step = statusToStep(leadStatus);

  const milestones = [
    { label: "Onboarding inicial", done: step >= 1 },
    { label: "Configuração de integrações ERP", done: step >= 1 },
    { label: "Implantação dos workflows", done: step >= 1 },
    { label: "Treinamento da equipe", done: step >= 2 },
    { label: "Go-live e suporte ativo", done: step >= 2 },
  ];

  return (
    <div className="space-y-6">
      {/* Status principal */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              Status de Implementação
            </CardTitle>
            {!loading && (
              <Badge
                variant="outline"
                className={
                  step === 2
                    ? "bg-green-500/15 text-green-700 border-green-200"
                    : step === 1
                    ? "bg-blue-500/15 text-blue-700 border-blue-200"
                    : "bg-gray-500/15 text-gray-600 border-gray-200"
                }
              >
                {IMPL_STEP_LABELS[step]}
              </Badge>
            )}
          </div>
          <CardDescription>
            Acompanhe o progresso da sua implementação com a equipe Uniforce.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <div className="flex justify-between text-xs text-muted-foreground">
                {IMPL_STEP_LABELS.map((label, i) => (
                  <span key={label} className={i <= step ? "text-primary font-semibold" : ""}>
                    {label}
                  </span>
                ))}
              </div>
              <Progress value={IMPL_STEP_PROGRESS[step]} className="h-2.5" />
              <p className="text-sm text-muted-foreground">
                {step === 0 && "A implementação ainda não foi iniciada. Entre em contato com seu gerente de sucesso."}
                {step === 1 && "Implementação em andamento — acompanhe o progresso com seu gerente de sucesso."}
                {step === 2 && "Implementação concluída — serviço entregue e estável."}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Etapas do Processo</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <ul className="space-y-3">
              {milestones.map((milestone, i) => (
                <li key={i} className="flex items-center gap-3">
                  {milestone.done ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : step === 1 && i < 3 ? (
                    <Clock className="h-4 w-4 text-blue-400 shrink-0 animate-pulse" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      milestone.done
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {milestone.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

interface MeusServicosTabProps {
  leadStatus?: string;
  profileLoading?: boolean;
}

export function MeusServicosTab({ leadStatus = "", profileLoading = true }: MeusServicosTabProps) {
  const { toast } = useToast();
  const { ispId } = useActiveIsp();
  const { data: servicesData, isLoading } = useIspServices(ispId);
  const { data: userRole } = useUserRole();
  const cancelMutation = useCancelSubscription(ispId);

  const [cancelTarget, setCancelTarget] = useState<ContractedItem | null>(null);
  const [asaasCancelOpen, setAsaasCancelOpen] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  const canManage = userRole === "admin" || userRole === "super_admin";

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleCancelRequest = (item: ContractedItem) => {
    setCancelingId(item.id);
    if (item.billing_source === "asaas") {
      setAsaasCancelOpen(true);
    } else {
      setCancelTarget(item);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      const result = await cancelMutation.mutateAsync({
        stripe_subscription_id: cancelTarget.stripe_subscription_id,
        target_isp_id: ispId ?? undefined,
      });
      toast({
        title: "Cancelamento agendado",
        description: `${result.product_name} será cancelado em ${formatDate(result.effective_cancel_at)}.`,
      });
    } catch (err) {
      toast({
        title: "Erro ao cancelar",
        description: err instanceof Error ? err.message : "Não foi possível cancelar a assinatura.",
        variant: "destructive",
      });
    } finally {
      setCancelTarget(null);
      setCancelingId(null);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (isLoading || (!!ispId && servicesData === undefined)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const plan = servicesData?.plan ?? null;
  const addons = servicesData?.addons ?? [];
  const hasServices = !!plan || addons.length > 0;

  // ─── Dialog de cancelamento Stripe ────────────────────────────────────────
  const isFutureCommitment = cancelTarget ? cancelTarget.days_until_commitment_free > 0 : false;

  const cancelDialogDescription = cancelTarget
    ? isFutureCommitment
      ? `Sua assinatura de "${cancelTarget.product_name}" será cancelada em ${formatDate(cancelTarget.commitment_ends_at)} (em ${cancelTarget.days_until_commitment_free} dias). Você não será cobrado após essa data. Até lá, o serviço permanece ativo.`
      : `Sua assinatura de "${cancelTarget.product_name}" será encerrada ao final do período atual. Após essa data, o acesso ao produto será suspenso até reativação.`
    : "";

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ─── Dialog cancelamento Stripe ─── */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && !cancelMutation.isPending && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Cancelar Assinatura
            </AlertDialogTitle>
            <AlertDialogDescription>
              {cancelDialogDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending}>Manter Assinatura</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              Confirmar Cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Dialog cancelamento Asaas ─── */}
      <AlertDialog open={asaasCancelOpen} onOpenChange={(open) => { setAsaasCancelOpen(open); if (!open) setCancelingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelamento via Gerente de Conta</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Para cancelar sua assinatura, entre em contato com seu Gerente de Conta Uniforce.
                </p>
                <p className="font-medium text-foreground">suporte@uniforce.com.br</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction asChild>
              <a href="mailto:suporte@uniforce.com.br" className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Enviar Email
              </a>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Sem serviços ─── */}
      {!hasServices && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-10 text-center space-y-3">
            <Package className="h-10 w-10 text-primary/60 mx-auto" />
            <p className="text-base font-semibold text-foreground">Nenhum produto contratado</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Escolha um plano ou agente para começar a usar a plataforma Uniforce.
            </p>
            <Button variant="outline" asChild>
              <a href="?tab=meus-produtos">Ver planos disponíveis →</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ─── Plano base ─── */}
      {plan && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Plano Base
          </h3>
          <ServiceItemCard
            item={plan}
            canManage={canManage}
            onCancelRequest={handleCancelRequest}
            cancelingId={cancelingId}
          />
        </div>
      )}

      {/* ─── Meus Agentes ─── */}
      {addons.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Meus Agentes ({addons.length})
          </h3>
          <div className="space-y-4">
            {addons.map((addon) => (
              <ServiceItemCard
                key={addon.id}
                item={addon}
                canManage={canManage}
                onCancelRequest={handleCancelRequest}
                cancelingId={cancelingId}
              />
            ))}
          </div>
        </div>
      ) : hasServices ? (
        <Card>
          <CardContent className="py-8 text-center space-y-3">
            <Zap className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-medium text-foreground">Nenhum agente contratado</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Expanda as funcionalidades da sua plataforma adicionando agentes de automação.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a href="?tab=meus-produtos">Ver agentes disponíveis →</a>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ─── Info de vigência ─── */}
      {servicesData?.subscription_started_at && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>
            Cliente Uniforce desde {formatDate(servicesData.subscription_started_at)}
          </span>
        </div>
      )}

      {/* ─── Implementação (absorvida da antiga aba) ─── */}
      <Separator />
      <ImplementationSection leadStatus={leadStatus} loading={profileLoading} />
    </div>
  );
}
