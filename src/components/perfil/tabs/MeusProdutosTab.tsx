// src/components/perfil/tabs/MeusProdutosTab.tsx
// Aba "Meus Produtos" — exibe plano atual (Asaas ou Stripe) e catálogo para checkout/alteração

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  Package, CreditCard, CheckCircle2, ExternalLink, AlertCircle,
  RefreshCw, Star, Zap, Crown, ArrowUpCircle, Calendar, FlaskConical,
  FileText, ArrowRightLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStripeSubscription, useStripeCheckout, useStripeCustomerPortal } from "@/hooks/useStripeSubscription";
import { useStripeProducts } from "@/hooks/useStripeProducts";
import { useAsaasSubscription } from "@/hooks/useAsaasSubscription";
import { useAsaasPlanChange } from "@/hooks/useAsaasPlanChange";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useState } from "react";

// ─── Utilitários ──────────────────────────────────────────────────────────────

function planIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("growth")) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (n.includes("retention")) return <Zap className="h-5 w-5 text-blue-500" />;
  if (n.includes("basic")) return <Star className="h-5 w-5 text-primary" />;
  return <Package className="h-5 w-5 text-primary" />;
}

function statusBadge(status: string) {
  const variants: Record<string, { label: string; className: string }> = {
    active:     { label: "Ativo",               className: "bg-green-500/15 text-green-700 border-green-200" },
    past_due:   { label: "Pagamento Atrasado",   className: "bg-red-500/15 text-red-700 border-red-200" },
    trialing:   { label: "Período Trial",        className: "bg-blue-500/15 text-blue-700 border-blue-200" },
    canceled:   { label: "Cancelado",            className: "bg-gray-500/15 text-gray-700 border-gray-200" },
    incomplete: { label: "Incompleto",           className: "bg-orange-500/15 text-orange-700 border-orange-200" },
    unpaid:     { label: "Não Pago",             className: "bg-red-500/15 text-red-700 border-red-200" },
  };
  const v = variants[status] ?? { label: status, className: "" };
  return <Badge variant="outline" className={`text-xs font-medium ${v.className}`}>{v.label}</Badge>;
}

function formatCurrency(amount: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function MeusProdutosTab() {
  const { toast } = useToast();
  const { ispId } = useActiveIsp();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  // Plano pendente de confirmação (ISPs Asaas)
  const [pendingPlan, setPendingPlan] = useState<{
    product_id: string;
    price_id: string;
    name: string;
    monthly_amount: number;
  } | null>(null);

  const isDevIsp = ispId === "uniforce";

  const { data: subscriptionData, isLoading: subLoading } = useStripeSubscription(ispId);
  const { data: catalog,          isLoading: catalogLoading } = useStripeProducts(ispId);

  const sub           = subscriptionData?.subscription;
  const billingSource = subscriptionData?.stripe_billing_source;
  const isAsaasLegacy = billingSource === "asaas";

  // Só busca dados Asaas após saber o billingSource — evita chamada desnecessária para ISPs Stripe
  const { data: asaasData, isLoading: asaasLoading } = useAsaasSubscription(
    !subLoading && isAsaasLegacy ? ispId : null
  );
  const checkout   = useStripeCheckout(ispId);
  const portal     = useStripeCustomerPortal(ispId);
  const planChange = useAsaasPlanChange(ispId);
  const hasActiveSub  = !!sub && sub.status !== "canceled";

  const asaasSub          = asaasData?.subscription ?? null;
  const isAsaasCustomPlan = asaasData?.is_custom_plan ?? false;

  // ISP Asaas sem CNPJ cadastrado: CREATE de assinatura irá falhar.
  // Mostra aviso e desabilita botões de seleção de plano.
  const isSetupPending = isAsaasLegacy && (asaasData?.setup_pending ?? false);

  // Detecta se um plano Stripe corresponde ao plano Asaas ativo (tolerância ±R$0,50)
  function isCurrentAsaasPlan(planAmount: number | null): boolean {
    if (!asaasSub || !planAmount || isAsaasCustomPlan) return false;
    return Math.abs(asaasSub.value - planAmount) <= 0.50;
  }

  // ─── Handlers Stripe ────────────────────────────────────────────────────────
  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(priceId);
    try {
      const baseUrl = window.location.origin;
      await checkout.mutateAsync({
        price_id: priceId,
        success_url: `${baseUrl}/configuracoes/perfil?tab=meus-produtos&success=true`,
        cancel_url:  `${baseUrl}/configuracoes/perfil?tab=meus-produtos`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("já está ativo")) {
        toast({
          title: "Add-on já contratado",
          description: msg,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao iniciar checkout",
          description: "Não foi possível iniciar o processo de contratação.",
          variant: "destructive",
        });
      }
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      await portal.mutateAsync(`${window.location.origin}/configuracoes/perfil?tab=meus-produtos`);
    } catch {
      toast({
        title: "Erro ao abrir portal",
        description: "Não foi possível abrir o portal de pagamentos.",
        variant: "destructive",
      });
    }
  };

  // ─── Handlers Asaas Plan Change ─────────────────────────────────────────────
  const handleAsaasPlanSelect = (plan: {
    id: string;
    monthly_price_id: string | null;
    name: string;
    monthly_amount: number | null;
  }) => {
    if (!plan.monthly_price_id) return;
    setPendingPlan({
      product_id: plan.id,
      price_id: plan.monthly_price_id,
      name: plan.name,
      monthly_amount: plan.monthly_amount ?? 0,
    });
  };

  const confirmAsaasPlanChange = async () => {
    if (!pendingPlan) return;
    try {
      const result = await planChange.mutateAsync({
        stripe_product_id: pendingPlan.product_id,
        stripe_price_id:   pendingPlan.price_id,
        target_isp_id:     ispId ?? undefined,
      });
      toast({
        title: result.action === "created" ? "Plano ativado!" : "Plano atualizado!",
        description: `${result.plan_name} — ${formatCurrency(result.plan_value)}/mês via Asaas`,
      });
    } catch (err) {
      toast({
        title: "Erro ao alterar plano",
        description: err instanceof Error ? err.message : "Não foi possível alterar o plano.",
        variant: "destructive",
      });
    } finally {
      setPendingPlan(null);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (subLoading || (isAsaasLegacy && asaasLoading)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ─── Dialog de confirmação de troca de plano (Asaas) ─── */}
      <AlertDialog open={!!pendingPlan} onOpenChange={(open) => !open && !planChange.isPending && setPendingPlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Confirmar alteração de plano
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Você está selecionando o plano{" "}
                  <span className="font-semibold text-foreground">{pendingPlan?.name}</span>{" "}
                  por{" "}
                  <span className="font-semibold text-primary">
                    {formatCurrency(pendingPlan?.monthly_amount ?? 0)}/mês
                  </span>.
                </p>
                {asaasSub ? (
                  <p>
                    Seu plano atual ({formatCurrency(asaasSub.value)}/mês) será substituído.
                    A mudança será aplicada imediatamente — cobranças pendentes também serão atualizadas.
                  </p>
                ) : (
                  <p>
                    Uma nova assinatura será criada no Asaas com vencimento no 1º dia do próximo mês.
                  </p>
                )}
                <p className="text-xs">
                  Dúvidas sobre sua fatura?{" "}
                  <span className="font-medium">suporte@uniforce.com.br</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={planChange.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAsaasPlanChange}
              disabled={planChange.isPending}
            >
              {planChange.isPending && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              Confirmar Alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Dev ISP banner ─── */}
      {isDevIsp && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-300 bg-amber-50">
          <FlaskConical className="h-4 w-4 shrink-0 text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">Ambiente de Desenvolvimento — Modo Teste Stripe</p>
            <p className="text-xs text-muted-foreground">
              Conta uniforce [DEV] usa Stripe test mode automaticamente. Cartão de teste: 4242 4242 4242 4242
            </p>
          </div>
        </div>
      )}

      {/* ─── Asaas: plano ativo ─── */}
      {isAsaasLegacy && asaasSub && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Plano Ativo
              </CardTitle>
              {isAsaasCustomPlan ? (
                <Badge variant="outline" className="text-xs font-medium bg-amber-500/15 text-amber-700 border-amber-200">
                  Plano Customizado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs font-medium bg-green-500/15 text-green-700 border-green-200">
                  Ativo
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {asaasSub.description ?? "Plano Uniforce"}
                </p>
                <p className="text-sm text-muted-foreground mt-0.5">Assinatura recorrente via Asaas</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">{formatCurrency(asaasSub.value)}</p>
                <p className="text-xs text-muted-foreground">/mês</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {asaasSub.next_due_date && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Próximo vencimento</p>
                    <p className="text-sm font-medium">{formatDate(asaasSub.next_due_date)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Forma de pagamento</p>
                  <p className="text-sm font-medium">
                    {asaasSub.billing_type === "BOLETO" ? "Boleto Bancário" :
                     asaasSub.billing_type === "PIX"    ? "PIX" :
                     asaasSub.billing_type ?? "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {asaasSub.billing_type === "BOLETO" && (
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => window.open("https://app.asaas.com", "_blank", "noopener,noreferrer")}
                >
                  <FileText className="h-4 w-4" />
                  Ver Boleto
                </Button>
              )}
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" asChild>
                <a href="mailto:suporte@uniforce.com.br">Gerenciar via suporte</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Asaas: sem assinatura ─── */}
      {isAsaasLegacy && !asaasSub && (
        isSetupPending ? (
          /* Setup incompleto: CNPJ ainda não cadastrado */
          <Card className="border-orange-200 bg-orange-50/50">
            <CardContent className="py-5 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-orange-900">Cadastro em andamento</p>
                <p className="text-sm text-orange-700 mt-1">
                  Sua conta está sendo configurada. Assim que o cadastro for concluído, você poderá
                  selecionar seu plano diretamente aqui.
                </p>
                <p className="text-xs text-orange-500 mt-2">
                  Precisa de ajuda?{" "}
                  <a href="mailto:suporte@uniforce.com.br" className="underline font-medium">
                    suporte@uniforce.com.br
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Pronto: pode selecionar plano */
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="py-5 flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900">Plano base via Asaas</p>
                <p className="text-sm text-blue-700 mt-1">
                  Sua conta é gerenciada pelo Asaas. Selecione um plano abaixo para ativar sua assinatura,
                  ou contrate add-ons via Stripe de forma independente.
                </p>
                <p className="text-xs text-blue-500 mt-2">
                  Dúvidas? Entre em contato:{" "}
                  <a href="mailto:suporte@uniforce.com.br" className="underline font-medium">
                    suporte@uniforce.com.br
                  </a>
                </p>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* ─── Stripe: plano ativo ─── */}
      {!isAsaasLegacy && hasActiveSub && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {planIcon(sub!.product_name ?? "")}
                Plano Atual
              </CardTitle>
              {statusBadge(sub!.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{sub!.product_name ?? "Plano Ativo"}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Assinatura mensal recorrente</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(sub!.monthly_amount, sub!.currency)}
                </p>
                <p className="text-xs text-muted-foreground">/mês</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Próxima cobrança</p>
                  <p className="text-sm font-medium">{formatDate(sub!.current_period_end)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Forma de pagamento</p>
                  {sub!.payment_method ? (
                    <p className="text-sm font-medium capitalize">
                      {sub!.payment_method.brand} •••• {sub!.payment_method.last4}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Não configurado</p>
                  )}
                </div>
              </div>
            </div>

            {sub!.features.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Incluído no plano</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {sub!.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {feat}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sub!.status === "past_due" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Pagamento pendente. Atualize seu método de pagamento para evitar interrupção do serviço.</span>
              </div>
            )}
            {sub!.cancel_at_period_end && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Sua assinatura será cancelada em {formatDate(sub!.current_period_end)}. Reative pelo portal de pagamentos.</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <Button onClick={handlePortal} disabled={portal.isPending} className="gap-2">
                {portal.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Gerenciar Assinatura
              </Button>
              <Button variant="outline" onClick={handlePortal} disabled={portal.isPending} className="gap-2">
                <ExternalLink className="h-4 w-4" />
                Portal de Pagamentos
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Stripe: sem plano ativo ─── */}
      {!isAsaasLegacy && !hasActiveSub && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-8 text-center space-y-3">
            <Package className="h-10 w-10 text-primary/60 mx-auto" />
            <p className="text-base font-semibold text-foreground">Nenhum plano ativo</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Escolha um dos planos abaixo para começar a usar a plataforma Uniforce.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Asaas: sem add-on Stripe ativo ─── */}
      {isAsaasLegacy && !hasActiveSub && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-8 text-center space-y-3">
            <Zap className="h-10 w-10 text-primary/60 mx-auto" />
            <p className="text-base font-semibold text-foreground">Nenhum Add-on Ativo</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Explore os add-ons disponíveis abaixo para expandir as funcionalidades da sua plataforma.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── Catálogo de Planos ─────────────────────────────────────────────────
           Visível para TODOS os ISPs.
           • ISPs Stripe  → botão abre Stripe Checkout
           • ISPs Asaas   → botão abre dialog de confirmação → atualiza assinatura Asaas
      ─── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          {isAsaasLegacy ? (
            asaasSub
              ? <><ArrowRightLeft className="h-4 w-4 text-primary" /> Alterar Plano via Asaas</>
              : <><Package className="h-4 w-4 text-primary" /> Escolha seu Plano via Asaas</>
          ) : (
            hasActiveSub
              ? <><ArrowUpCircle className="h-4 w-4 text-primary" /> Outros Planos Disponíveis</>
              : <><Package className="h-4 w-4 text-primary" /> Escolha seu Plano</>
          )}
        </h3>

        {isAsaasLegacy && (
          <p className="text-xs text-muted-foreground mb-3">
            Precificação centralizada pelo Stripe. Ao selecionar, o plano é aplicado diretamente na sua assinatura Asaas.
          </p>
        )}

        {catalogLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {catalog?.plans.map((plan) => {
              const isCurrentStripe = !isAsaasLegacy && sub?.product_id === plan.id;
              const isCurrentAsaas  = isAsaasLegacy && isCurrentAsaasPlan(plan.monthly_amount);
              const isCurrent = isCurrentStripe || isCurrentAsaas;

              return (
                <Card
                  key={plan.id}
                  className={`relative flex flex-col ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  {isCurrent && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground text-xs px-3">Plano Atual</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      {planIcon(plan.name)}
                      {plan.name}
                    </CardTitle>
                    <div>
                      <span className="text-2xl font-bold text-foreground">
                        {formatCurrency(plan.monthly_amount ?? 0)}
                      </span>
                      <span className="text-xs text-muted-foreground">/mês</span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3">
                    {plan.description && (
                      <p className="text-xs text-muted-foreground">{plan.description}</p>
                    )}
                    {plan.features.length > 0 && (
                      <ul className="space-y-1.5 flex-1">
                        {plan.features.map((feat, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                            {feat}
                          </li>
                        ))}
                      </ul>
                    )}

                    {isAsaasLegacy ? (
                      /* Asaas ISP: selecionar plano abre dialog de confirmação */
                      <Button
                        className="w-full mt-auto"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={isCurrent || planChange.isPending || !plan.monthly_price_id || (isSetupPending && !asaasSub)}
                        onClick={() => !isSetupPending && handleAsaasPlanSelect(plan)}
                      >
                        {isCurrent
                          ? "Plano Atual"
                          : isSetupPending && !asaasSub
                          ? "Cadastro Pendente"
                          : asaasSub
                          ? "Alterar para este Plano"
                          : "Selecionar Plano"}
                      </Button>
                    ) : (
                      /* Stripe ISP: checkout direto */
                      <Button
                        className="w-full mt-auto"
                        variant={isCurrent ? "outline" : "default"}
                        disabled={isCurrent || checkoutLoading === plan.monthly_price_id || !plan.monthly_price_id}
                        onClick={() => plan.monthly_price_id && handleCheckout(plan.monthly_price_id)}
                      >
                        {checkoutLoading === plan.monthly_price_id
                          ? <RefreshCw className="h-4 w-4 animate-spin" />
                          : isCurrent
                          ? "Plano Atual"
                          : hasActiveSub
                          ? "Alterar para este Plano"
                          : "Contratar"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Add-ons (todos os ISPs — compra via Stripe Checkout) ─── */}
      {catalog && catalog.addons.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Add-ons Disponíveis
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {catalog.addons.map((addon) => (
              <Card key={addon.id} className="flex flex-col">
                <CardContent className="pt-4 pb-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{addon.name}</p>
                      {addon.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{addon.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-primary">
                        {formatCurrency(addon.monthly_amount ?? 0)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">/mês</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-auto"
                    disabled={!addon.monthly_price_id || checkoutLoading === addon.monthly_price_id}
                    onClick={() => addon.monthly_price_id && handleCheckout(addon.monthly_price_id)}
                  >
                    {checkoutLoading === addon.monthly_price_id
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : "Adicionar"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
