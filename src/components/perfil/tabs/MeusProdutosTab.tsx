// src/components/perfil/tabs/MeusProdutosTab.tsx
// Aba "Meus Produtos" — exibe plano atual ou catálogo para checkout

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Package, CreditCard, CheckCircle2, ExternalLink, AlertCircle,
  RefreshCw, Star, Zap, Crown, ArrowUpCircle, Calendar, FlaskConical,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStripeSubscription, useStripeCheckout, useStripeCustomerPortal } from "@/hooks/useStripeSubscription";
import { useStripeProducts } from "@/hooks/useStripeProducts";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useAuth } from "@/contexts/AuthContext";

// Ícones por plano (baseado no nome)
function planIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("growth")) return <Crown className="h-5 w-5 text-yellow-500" />;
  if (n.includes("retention")) return <Zap className="h-5 w-5 text-blue-500" />;
  if (n.includes("basic")) return <Star className="h-5 w-5 text-primary" />;
  return <Package className="h-5 w-5 text-primary" />;
}

function statusBadge(status: string) {
  const variants: Record<string, { label: string; className: string }> = {
    active: { label: "Ativo", className: "bg-green-500/15 text-green-700 border-green-200" },
    past_due: { label: "Pagamento Atrasado", className: "bg-red-500/15 text-red-700 border-red-200" },
    trialing: { label: "Período Trial", className: "bg-blue-500/15 text-blue-700 border-blue-200" },
    canceled: { label: "Cancelado", className: "bg-gray-500/15 text-gray-700 border-gray-200" },
    incomplete: { label: "Incompleto", className: "bg-orange-500/15 text-orange-700 border-orange-200" },
    unpaid: { label: "Não Pago", className: "bg-red-500/15 text-red-700 border-red-200" },
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

export function MeusProdutosTab() {
  const { toast } = useToast();
  const { ispId } = useActiveIsp();
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === "super_admin";
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  const { data: subscriptionData, isLoading: subLoading, refetch: refetchSub } = useStripeSubscription();
  const { data: catalog, isLoading: catalogLoading } = useStripeProducts();
  const checkout = useStripeCheckout();
  const portal = useStripeCustomerPortal();

  const sub = subscriptionData?.subscription;
  const billingSource = subscriptionData?.stripe_billing_source;
  const isAsaasLegacy = billingSource === "asaas";
  const hasActiveSub = sub && sub.status !== "canceled";

  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(priceId);
    try {
      const baseUrl = window.location.origin;
      await checkout.mutateAsync({
        price_id: priceId,
        success_url: `${baseUrl}/configuracoes/perfil?tab=meus-produtos&success=true`,
        cancel_url: `${baseUrl}/configuracoes/perfil?tab=meus-produtos`,
        test_mode: testMode,
      });
    } catch (err) {
      toast({
        title: "Erro ao iniciar checkout",
        description: "Não foi possível iniciar o processo de contratação.",
        variant: "destructive",
      });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    try {
      await portal.mutateAsync(
        `${window.location.origin}/configuracoes/perfil?tab=meus-produtos`
      );
    } catch {
      toast({
        title: "Erro ao abrir portal",
        description: "Não foi possível abrir o portal de pagamentos.",
        variant: "destructive",
      });
    }
  };

  if (subLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ─── Super-admin test mode toggle ─── */}
      {isSuperAdmin && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${testMode ? "border-amber-300 bg-amber-50" : "border-border bg-muted/30"}`}>
          <FlaskConical className={`h-4 w-4 shrink-0 ${testMode ? "text-amber-600" : "text-muted-foreground"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${testMode ? "text-amber-800" : "text-foreground"}`}>
              {testMode ? "Modo de Teste Ativo — cartão 4242 4242 4242 4242" : "Modo de Teste Stripe"}
            </p>
            <p className="text-xs text-muted-foreground">Visível apenas para super_admin. Usa sk_test_* key, sem cobranças reais.</p>
          </div>
          <Switch
            checked={testMode}
            onCheckedChange={setTestMode}
            aria-label="Ativar modo de teste"
          />
        </div>
      )}

      {/* ─── Asaas Legacy Card ─── */}
      {isAsaasLegacy && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-5 flex items-start gap-4">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
              <CreditCard className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-blue-900">Assinatura via Asaas</p>
              <p className="text-sm text-blue-700 mt-1">
                Sua assinatura Uniforce é gerenciada pelo Asaas. O acesso via Stripe estará disponível
                quando a migração for concluída pela equipe Uniforce.
              </p>
              <p className="text-xs text-blue-500 mt-2">
                Dúvidas? Entre em contato: suporte@uniforce.com.br
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Plano Ativo ─── */}
      {hasActiveSub ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {planIcon(sub.product_name ?? "")}
                Plano Atual
              </CardTitle>
              {statusBadge(sub.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Nome e valor */}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{sub.product_name ?? "Plano Ativo"}</p>
                <p className="text-sm text-muted-foreground mt-0.5">Assinatura mensal recorrente</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(sub.monthly_amount, sub.currency)}
                </p>
                <p className="text-xs text-muted-foreground">/mês</p>
              </div>
            </div>

            <Separator />

            {/* Período e pagamento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Próxima cobrança</p>
                  <p className="text-sm font-medium">{formatDate(sub.current_period_end)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Forma de pagamento</p>
                  {sub.payment_method ? (
                    <p className="text-sm font-medium capitalize">
                      {sub.payment_method.brand} •••• {sub.payment_method.last4}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Não configurado</p>
                  )}
                </div>
              </div>
            </div>

            {/* Features do plano */}
            {sub.features.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Incluído no plano</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {sub.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      {feat}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alertas */}
            {sub.status === "past_due" && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Pagamento pendente. Atualize seu método de pagamento para evitar interrupção do serviço.</span>
              </div>
            )}
            {sub.cancel_at_period_end && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-50 border border-orange-200 text-sm text-orange-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Sua assinatura será cancelada em {formatDate(sub.current_period_end)}. Reative pelo portal de pagamentos.</span>
              </div>
            )}

            {/* Ações */}
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
      ) : (
        /* ─── Sem assinatura: CTA ─── */
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

      {/* ─── Catálogo de Planos (oculto para Asaas, a menos que seja super_admin em test mode) ─── */}
      {isAsaasLegacy && !testMode ? null : <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          {hasActiveSub ? (
            <><ArrowUpCircle className="h-4 w-4 text-primary" /> Outros Planos Disponíveis</>
          ) : (
            <><Package className="h-4 w-4 text-primary" /> Escolha seu Plano</>
          )}
        </h3>

        {catalogLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {catalog?.plans.map((plan) => {
              const isCurrent = sub?.product_id === plan.id;
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
                    <Button
                      className="w-full mt-auto"
                      variant={isCurrent ? "outline" : "default"}
                      disabled={isCurrent || checkoutLoading === plan.monthly_price_id || !plan.monthly_price_id}
                      onClick={() => plan.monthly_price_id && handleCheckout(plan.monthly_price_id)}
                    >
                      {checkoutLoading === plan.monthly_price_id ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : isCurrent ? (
                        "Plano Atual"
                      ) : hasActiveSub ? (
                        "Alterar para este Plano"
                      ) : (
                        "Contratar"
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      </div>}

      {/* Add-ons (visível apenas fora do modo Asaas, ou em test mode) */}
      {(!isAsaasLegacy || testMode) && catalog && catalog.addons.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" /> Add-ons Disponíveis
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {catalog.addons.map((addon) => (
              <Card key={addon.id} className="flex flex-col">
                <CardContent className="pt-4 pb-4 flex flex-col gap-3 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{addon.name}</p>
                      {addon.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{addon.description}</p>
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
                    {checkoutLoading === addon.monthly_price_id ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Adicionar"
                    )}
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
