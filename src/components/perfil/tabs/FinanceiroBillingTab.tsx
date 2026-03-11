// src/components/perfil/tabs/FinanceiroBillingTab.tsx
// Aba "Financeiro" — histórico de faturas da assinatura Uniforce do ISP

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileText, ExternalLink, Download, CreditCard, RefreshCw,
  CheckCircle2, AlertCircle, Clock, Ban, Receipt,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useStripeInvoices } from "@/hooks/useStripeInvoices";
import { useStripeSubscription, useStripeCustomerPortal } from "@/hooks/useStripeSubscription";
import { useAsaasInvoices, type AsaasInvoiceStatus } from "@/hooks/useAsaasInvoices";
import { useAsaasSubscription } from "@/hooks/useAsaasSubscription";
import { useActiveIsp } from "@/hooks/useActiveIsp";

function formatCurrency(amount: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function invoiceStatusBadge(status: string) {
  const map: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
    paid: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Paga",
      className: "bg-green-500/15 text-green-700 border-green-200",
    },
    open: {
      icon: <Clock className="h-3 w-3" />,
      label: "Em aberto",
      className: "bg-orange-500/15 text-orange-700 border-orange-200",
    },
    void: {
      icon: <Ban className="h-3 w-3" />,
      label: "Cancelada",
      className: "bg-gray-500/15 text-gray-600 border-gray-200",
    },
    uncollectible: {
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Inadimplente",
      className: "bg-red-500/15 text-red-700 border-red-200",
    },
    draft: {
      icon: <Clock className="h-3 w-3" />,
      label: "Rascunho",
      className: "bg-gray-500/15 text-gray-600 border-gray-200",
    },
  };
  const v = map[status] ?? { icon: null, label: status, className: "" };
  return (
    <Badge variant="outline" className={`gap-1 text-xs font-medium ${v.className}`}>
      {v.icon}{v.label}
    </Badge>
  );
}

function asaasStatusBadge(status: AsaasInvoiceStatus) {
  const map: Record<AsaasInvoiceStatus, { icon: React.ReactNode; label: string; className: string }> = {
    paid: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Paga",
      className: "bg-green-500/15 text-green-700 border-green-200",
    },
    open: {
      icon: <Clock className="h-3 w-3" />,
      label: "Em aberto",
      className: "bg-orange-500/15 text-orange-700 border-orange-200",
    },
    overdue: {
      icon: <AlertCircle className="h-3 w-3" />,
      label: "Vencida",
      className: "bg-red-500/15 text-red-700 border-red-200",
    },
    refunded: {
      icon: <Ban className="h-3 w-3" />,
      label: "Reembolsada",
      className: "bg-gray-500/15 text-gray-600 border-gray-200",
    },
    other: {
      icon: <Clock className="h-3 w-3" />,
      label: "Outro",
      className: "bg-gray-500/15 text-gray-600 border-gray-200",
    },
  };
  const v = map[status];
  return (
    <Badge variant="outline" className={`gap-1 text-xs font-medium ${v.className}`}>
      {v.icon}{v.label}
    </Badge>
  );
}

export function FinanceiroBillingTab() {
  const { toast } = useToast();
  const { ispId } = useActiveIsp();
  const { data: subscriptionData, isLoading: subLoading } = useStripeSubscription(ispId);
  const portal = useStripeCustomerPortal(ispId);

  const billingSource = subscriptionData?.stripe_billing_source;
  const isAsaas = billingSource === "asaas";

  // Só busca dados do sistema de cobrança correto após conhecer o billingSource
  const { data: invoicesData,      isLoading: invoicesLoading }      = useStripeInvoices(
    !subLoading && !isAsaas ? ispId : null
  );
  const { data: asaasInvoicesData, isLoading: asaasInvoicesLoading } = useAsaasInvoices(
    !subLoading && isAsaas ? ispId : null
  );
  const { data: asaasSubData } = useAsaasSubscription(
    !subLoading && isAsaas ? ispId : null
  );

  const sub = subscriptionData?.subscription;
  const invoices = invoicesData?.invoices ?? [];
  const asaasInvoices = asaasInvoicesData?.invoices ?? [];
  const asaasSub = asaasSubData?.subscription ?? null;

  const handlePortal = async () => {
    try {
      await portal.mutateAsync(
        `${window.location.origin}/configuracoes/perfil?tab=financeiro`
      );
    } catch {
      toast({
        title: "Erro ao abrir portal",
        description: "Não foi possível abrir o portal de pagamentos.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── Resumo do plano atual ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Plano Ativo</p>
            {subLoading ? (
              <Skeleton className="h-6 w-32" />
            ) : (
              <p className="text-base font-semibold text-foreground">
                {isAsaas
                  ? (asaasSub?.description ?? "Plano Ativo")
                  : (sub?.product_name ?? "—")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Valor Mensal</p>
            {subLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <p className="text-base font-semibold text-foreground">
                {isAsaas
                  ? (asaasSub ? formatCurrency(asaasSub.value) : "—")
                  : (sub ? formatCurrency(sub.monthly_amount, sub.currency) : "—")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground mb-1">Próximo Vencimento</p>
            {subLoading ? (
              <Skeleton className="h-6 w-28" />
            ) : (
              <p className="text-base font-semibold text-foreground">
                {isAsaas
                  ? (asaasSub?.next_due_date ? formatDate(asaasSub.next_due_date) : "—")
                  : (sub ? formatDate(sub.current_period_end) : "—")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Histórico de Faturas: Asaas ─── */}
      {isAsaas && (
        <Card>
          <CardHeader className="pb-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Histórico de Cobranças
              </CardTitle>
              <CardDescription className="mt-0.5">
                Histórico de cobranças da sua assinatura
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {asaasInvoicesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : asaasInvoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma cobrança disponível</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs">Vencimento</TableHead>
                    <TableHead className="text-xs">Valor</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {asaasInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.description ?? inv.id.slice(0, 12) + "..."}
                      </TableCell>
                      <TableCell className="text-xs">
                        {inv.due_date ? formatDate(inv.due_date) : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {formatCurrency(inv.value)}
                      </TableCell>
                      <TableCell>
                        {asaasStatusBadge(inv.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.bank_slip_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={inv.bank_slip_url} target="_blank" rel="noopener noreferrer" title="Ver Boleto">
                                <Receipt className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          {inv.invoice_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer" title="Ver cobrança">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Histórico de Faturas: Stripe ─── */}
      {!isAsaas && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Histórico de Faturas
                </CardTitle>
                <CardDescription className="mt-0.5">
                  Faturas da sua assinatura Uniforce
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={handlePortal} disabled={portal.isPending} className="gap-2">
                {portal.isPending ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CreditCard className="h-3.5 w-3.5" />
                )}
                Portal de Pagamentos
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nenhuma fatura disponível</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Fatura</TableHead>
                    <TableHead className="text-xs">Período</TableHead>
                    <TableHead className="text-xs">Valor</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {inv.number ?? inv.id.slice(0, 12) + "..."}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(inv.period_start)} — {formatDate(inv.period_end)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {formatCurrency(
                          inv.status === "paid" ? inv.amount_paid : inv.amount_due,
                          inv.currency
                        )}
                      </TableCell>
                      <TableCell>
                        {invoiceStatusBadge(inv.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.hosted_invoice_url && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" title="Ver fatura">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                          {inv.invoice_pdf && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                              <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer" title="Baixar PDF">
                                <Download className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
