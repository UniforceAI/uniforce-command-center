// asaas-webhook/index.ts
// Receptor de webhooks do Asaas — deploy com --no-verify-jwt
//
// Auth: verificar header 'asaas-access-token' === ASAAS_WEBHOOK_TOKEN
// Eventos tratados: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE, SUBSCRIPTION_DELETED
// Idempotência: asaas_webhook_events.asaas_event_id UNIQUE
// Audit trail: inserir em asaas_webhook_events (com error_message se falhar)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const HANDLED_EVENTS = [
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_OVERDUE",
  "SUBSCRIPTION_DELETED",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ─── Verificar token do webhook ───────────────────────────────────────────────
  const webhookToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
  const receivedToken = req.headers.get("asaas-access-token") ?? "";

  if (!webhookToken || receivedToken !== webhookToken) {
    console.error("asaas-webhook: invalid or missing asaas-access-token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  // ─── Ler payload ──────────────────────────────────────────────────────────────
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const eventId: string | null = payload.id ?? null;
  const eventType: string | null = payload.event ?? null;

  if (!eventId || !eventType) {
    return new Response(JSON.stringify({ error: "Missing event id or type" }), { status: 400 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // ─── Idempotência ─────────────────────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from("asaas_webhook_events")
    .select("id")
    .eq("asaas_event_id", eventId)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ received: true, duplicate: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ─── Ignorar eventos não tratados (mas registrar no audit) ────────────────────
  if (!HANDLED_EVENTS.includes(eventType)) {
    await supabaseAdmin.from("asaas_webhook_events").insert({
      asaas_event_id: eventId,
      event_type: eventType,
      payload,
    });
    return new Response(
      JSON.stringify({ received: true, processed: false }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // ─── Resolver isp_id pelo externalReference do customer ──────────────────────
  let ispId: string | null = null;
  let errorMessage: string | null = null;

  try {
    // Determinar modo (sandbox vs produção) pelo tipo de asaas_customer_id
    const payment = payload.payment ?? payload.subscription ?? null;
    const asaasCustomerId: string | null = payment?.customer ?? null;

    if (asaasCustomerId) {
      // Buscar ISP pela coluna asaas_customer_id (prod) ou asaas_test_customer_id (sandbox)
      const { data: ispProd } = await supabaseAdmin
        .from("isps")
        .select("isp_id")
        .eq("asaas_customer_id", asaasCustomerId)
        .maybeSingle();

      if (ispProd) {
        ispId = ispProd.isp_id;
      } else {
        const { data: ispTest } = await supabaseAdmin
          .from("isps")
          .select("isp_id")
          .eq("asaas_test_customer_id", asaasCustomerId)
          .maybeSingle();
        ispId = ispTest?.isp_id ?? null;
      }
    }

    // Processar evento
    switch (eventType) {
      case "PAYMENT_RECEIVED":
      case "PAYMENT_CONFIRMED":
        // Pagamento recebido: limpar billing_blocked e billing_blocked_since
        console.log(`asaas-webhook: ${eventType} for ISP ${ispId} — payment ${payment?.id}`);
        if (ispId) {
          await supabaseAdmin.from("isps")
            .update({ billing_blocked: false, billing_blocked_since: null })
            .eq("isp_id", ispId);
        }
        break;

      case "PAYMENT_OVERDUE": {
        // Pagamento vencido: registrar data de vencimento REAL da fatura (não a data de hoje)
        // O cron refresh_billing_blocked() ativa billing_blocked=true após 30 dias
        console.log(`asaas-webhook: PAYMENT_OVERDUE for ISP ${ispId} — payment ${payment?.id}`);
        if (ispId) {
          // Usar dueDate da fatura (vencimento real) ou fallback para now()
          // dueDate vem do Asaas no formato "YYYY-MM-DD"
          const rawDueDate: string | undefined = payment?.dueDate;
          let dueDateIso: string;
          if (rawDueDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDueDate)) {
            // Normalizar para ISO com hora fixa 00:00:00 UTC para evitar ambiguidade de fuso
            dueDateIso = `${rawDueDate}T00:00:00Z`;
          } else {
            dueDateIso = new Date().toISOString();
            console.warn(`asaas-webhook: PAYMENT_OVERDUE sem dueDate válido, usando now() para ISP ${ispId}`);
          }
          // Só seta billing_blocked_since se ainda não definido (COALESCE: preserva data original)
          await supabaseAdmin.from("isps")
            .update({ billing_blocked_since: dueDateIso })
            .eq("isp_id", ispId)
            .is("billing_blocked_since", null);
        }
        break;
      }

      case "SUBSCRIPTION_DELETED":
        // Assinatura cancelada no Asaas
        console.log(`asaas-webhook: SUBSCRIPTION_DELETED for ISP ${ispId}`);
        break;
    }
  } catch (err) {
    console.error(`asaas-webhook: error processing ${eventType}:`, err);
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // ─── Audit trail (upsert: idempotente se webhook for reentregue) ─────────────
  await supabaseAdmin.from("asaas_webhook_events").upsert({
    asaas_event_id: eventId,
    event_type: eventType,
    isp_id: ispId,
    payload,
    error_message: errorMessage,
  }, { onConflict: "asaas_event_id", ignoreDuplicates: false });

  return new Response(
    JSON.stringify({ received: true, processed: !errorMessage, event_type: eventType }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
