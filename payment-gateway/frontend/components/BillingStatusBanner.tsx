// BillingStatusBanner.tsx
// Banners informativos de vencimento e atraso de fatura (Stripe e Asaas).
// NÃO bloqueante — o BillingGuard existente já bloqueia após 30 dias de inadimplência.
// Integrar em MainLayout acima do {children}.

import { AlertCircle, Clock, Info, X } from "lucide-react";
import { useState } from "react";
import { useStripeSubscription, StripeSubscription } from "@/hooks/useStripeSubscription";
import { useAsaasSubscription } from "@/hooks/useAsaasSubscription";
import { useActiveIsp } from "@/hooks/useActiveIsp";

type AlertLevel = "error" | "warning" | "info";

interface BillingAlert {
  level: AlertLevel;
  message: string;
}

function computeStripeBillingAlert(sub: StripeSubscription | null): BillingAlert | null {
  if (!sub) return null;

  if (sub.status === "past_due") {
    return {
      level: "error",
      message: "Sua fatura está em atraso. Regularize o pagamento para evitar interrupção do serviço.",
    };
  }

  if (sub.status !== "active" && sub.status !== "trialing") return null;

  const periodEnd = new Date(sub.current_period_end);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  periodEnd.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.ceil((periodEnd.getTime() - today.getTime()) / 86400000);

  if (daysUntilDue === 0) {
    return { level: "warning", message: "Hoje é o dia de vencimento da sua fatura." };
  }
  if (daysUntilDue > 0 && daysUntilDue <= 3) {
    return {
      level: "info",
      message: `Sua fatura vence em ${daysUntilDue} dia${daysUntilDue > 1 ? "s" : ""}.`,
    };
  }

  return null;
}

function computeAsaasBillingAlert(
  nextDueDate: string | null,
  status: string | null,
): BillingAlert | null {
  if (status === "OVERDUE") {
    return {
      level: "error",
      message: "Sua fatura está em atraso. Regularize o pagamento para evitar interrupção do serviço.",
    };
  }

  if (!nextDueDate) return null;

  const dueDate = new Date(nextDueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);

  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / 86400000);

  if (daysUntilDue === 0) {
    return { level: "warning", message: "Hoje é o dia de vencimento da sua fatura." };
  }
  if (daysUntilDue > 0 && daysUntilDue <= 3) {
    return {
      level: "info",
      message: `Sua fatura vence em ${daysUntilDue} dia${daysUntilDue > 1 ? "s" : ""}.`,
    };
  }

  return null;
}

const levelStyles: Record<AlertLevel, { bg: string; border: string; text: string; icon: typeof AlertCircle }> = {
  error:   { bg: "bg-red-50",    border: "border-red-200",    text: "text-red-800",    icon: AlertCircle },
  warning: { bg: "bg-amber-50",  border: "border-amber-200",  text: "text-amber-800",  icon: Clock },
  info:    { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-800",   icon: Info },
};

export function BillingStatusBanner() {
  const { ispId } = useActiveIsp();
  const [dismissed, setDismissed] = useState(false);

  const { data: stripeData, isLoading: stripeLoading } = useStripeSubscription(ispId);
  const isAsaas = stripeData?.stripe_billing_source === "asaas";
  const { data: asaasData } = useAsaasSubscription(!stripeLoading && isAsaas ? ispId : null);

  if (dismissed) return null;

  let alert: BillingAlert | null = null;

  if (isAsaas && asaasData?.subscription) {
    alert = computeAsaasBillingAlert(
      asaasData.subscription.next_due_date,
      asaasData.subscription.status ?? null,
    );
  } else if (stripeData?.subscription) {
    alert = computeStripeBillingAlert(stripeData.subscription);
  }

  if (!alert) return null;

  const style = levelStyles[alert.level];
  const Icon = style.icon;
  const isDismissible = alert.level === "info";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${style.bg} ${style.border} ${style.text}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <p className="flex-1 text-sm font-medium">{alert.message}</p>
      <a
        href="/configuracoes/perfil?tab=meus-produtos"
        className="text-xs font-semibold underline whitespace-nowrap hover:opacity-80"
      >
        Configurações Financeiras
      </a>
      {isDismissible && (
        <button onClick={() => setDismissed(true)} className="shrink-0 hover:opacity-60">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
