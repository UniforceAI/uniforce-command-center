// stripe-webhook/index.ts
// Processa eventos Stripe para LIVE e SANDBOX (uniforce)
//
// DESIGN:
//   event.livemode = true  → conta live de produção → colunas stripe_customer_id / stripe_subscription_id
//   event.livemode = false → conta sandbox (somente uniforce) → colunas stripe_test_customer_id / stripe_test_subscription_id
//
// SECRETS necessários no Supabase:
//   STRIPE_SECRET_KEY          → sk_live_...
//   STRIPE_TEST_SECRET_KEY     → sk_test_...
//   STRIPE_WEBHOOK_SECRET      → whsec_... (webhook live no Stripe Dashboard)
//   STRIPE_TEST_WEBHOOK_SECRET → whsec_... (webhook test no Stripe Dashboard)

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  // Sincronização automática Stripe→Asaas: quando produto é atualizado no Stripe,
  // propaga nome/descrição para todas as assinaturas Asaas dos ISPs naquele plano
  "product.updated",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  // Stripe envia apenas POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // ─── 1. Ler body RAW e assinatura ───────────────────────────────────────────
  const body = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  if (!signature) {
    console.error("stripe-webhook: missing stripe-signature header");
    return new Response(JSON.stringify({ error: "Missing stripe-signature" }), { status: 400 });
  }

  const liveWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const testWebhookSecret = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET") ?? "";

  // ─── 2. Verificar assinatura — tenta live primeiro, depois test ─────────────
  // Usa uma instância temporária apenas para verificação de assinatura
  const stripeVerifier = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  let event: Stripe.Event;
  try {
    event = await stripeVerifier.webhooks.constructEventAsync(body, signature, liveWebhookSecret);
  } catch {
    if (!testWebhookSecret) {
      console.error("stripe-webhook: signature invalid (no test secret configured)");
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }
    try {
      event = await stripeVerifier.webhooks.constructEventAsync(body, signature, testWebhookSecret);
    } catch (err) {
      console.error("stripe-webhook: signature invalid for both live and test secrets:", err);
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }
  }

  // ─── 3. Determinar modo: live vs sandbox ─────────────────────────────────────
  // event.livemode é a fonte de verdade definitiva do Stripe
  // Usar === true para garantir booleano estrito (evita edge cases com truthy)
  const isLive = event.livemode === true;
  const stripeKey = isLive
    ? (Deno.env.get("STRIPE_SECRET_KEY") ?? "")
    : (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? "");

  // Cliente Stripe correto para follow-up API calls (retrieve subscription, product, etc.)
  const stripe = new Stripe(stripeKey, {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Supabase Admin para escrita no DB (bypass RLS)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // ─── 4. Idempotência — evitar processar o mesmo evento duas vezes ────────────
  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
  }

  // ─── 5. Ignorar eventos não tratados (mas registrar no audit trail) ──────────
  if (!HANDLED_EVENTS.includes(event.type)) {
    await supabaseAdmin.from("stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: { livemode: isLive },
    });
    return new Response(JSON.stringify({ received: true, processed: false }), { status: 200 });
  }

  // ─── 6. Helpers para colunas corretas por modo ───────────────────────────────
  // Colunas separadas: live usa stripe_customer_id / stripe_subscription_id
  //                    test usa stripe_test_customer_id / stripe_test_subscription_id
  const custIdCol      = isLive ? "stripe_customer_id"      : "stripe_test_customer_id";
  const subIdCol       = isLive ? "stripe_subscription_id"   : "stripe_test_subscription_id";

  // Buscar isp_id pelo stripe customer_id (coluna correta por modo)
  async function findIspByCustomer(customerId: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from("isps")
      .select("isp_id")
      .eq(custIdCol, customerId)
      .maybeSingle();
    return data?.isp_id ?? null;
  }

  // ─── 7. Processar evento ─────────────────────────────────────────────────────
  let ispId: string | null = null;
  let errorMessage: string | null = null;

  try {
    switch (event.type) {

      // ── checkout.session.completed ──────────────────────────────────────────
      // Disparado quando um ISP conclui o checkout. Salva customer_id e sub_id.
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        ispId = (session.client_reference_id ?? session.metadata?.isp_id) || null;

        if (session.mode !== "subscription" || !session.subscription || !ispId) break;

        // Buscar detalhes completos da assinatura criada
        const sub = await stripe.subscriptions.retrieve(
          session.subscription as string,
          { expand: ["items.data.price.product"] }
        );

        const item  = sub.items.data[0];
        const price = item?.price as Stripe.Price & { product: Stripe.Product };
        const prod  = price?.product as Stripe.Product;

        // Stripe API ≥2024-09-30 moveu current_period_start/end para items.data[0]
        // Lê do root se disponível, senão do item (compatibilidade entre versões)
        const periodStart = (sub as any).current_period_start ?? (item as any)?.current_period_start ?? null;
        const periodEnd   = (sub as any).current_period_end   ?? (item as any)?.current_period_end   ?? null;

        if (isLive) {
          // Live: atualiza todas as colunas de billing
          await supabaseAdmin.from("isps").update({
            [custIdCol]: session.customer as string,
            stripe_subscription_id:      sub.id,
            stripe_subscription_status:  sub.status,
            stripe_product_id:           prod?.id ?? null,
            stripe_price_id:             price?.id ?? null,
            stripe_product_name:         prod?.name ?? null,
            stripe_monthly_amount:       (price?.unit_amount ?? 0) / 100,
            stripe_current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
            stripe_current_period_end:   periodEnd   ? new Date(periodEnd   * 1000).toISOString() : null,
            stripe_cancel_at_period_end: sub.cancel_at_period_end,
            stripe_trial_end:            sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
            stripe_billing_source:       "stripe",
          }).eq("isp_id", ispId);

          // Concluir onboarding se ISP estava em payment_pending
          await supabaseAdmin.rpc("complete_isp_onboarding", { p_isp_id: ispId });

          // Fire-and-forget: registrar ISP no Asaas para NF-e futura
          fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/asaas-customer-sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({ isp_id: ispId }),
          }).catch((err) => console.warn("asaas-customer-sync fire-and-forget failed:", err));
        } else {
          // Sandbox (uniforce): atualiza apenas colunas de teste
          await supabaseAdmin.from("isps").update({
            stripe_test_customer_id:     session.customer as string,
            stripe_test_subscription_id: sub.id,
            stripe_test_mode_enabled:    true,
          }).eq("isp_id", ispId);
        }

        // Registrar item na tabela de controle de produtos (live e sandbox)
        {
          const startedAt = new Date(sub.start_date * 1000).toISOString();
          const LIVE_PLAN_IDS = ["prod_U41i5VULCVGKRl","prod_U41iUfju8I1C2n","prod_U41i4IUixqqdnT"];
          const TEST_PLAN_IDS = ["prod_U6PrObhPyX8oQC","prod_U6PrtJZY7mvP4U","prod_U6Pr82ehi6o3WC"];
          const planIds = isLive ? LIVE_PLAN_IDS : TEST_PLAN_IDS;
          const productType = planIds.includes(prod?.id ?? "") ? "plan" : "addon";

          await supabaseAdmin.from("isp_subscription_items").upsert({
            isp_id: ispId,
            stripe_subscription_id: sub.id,
            product_id: prod?.id ?? price?.id ?? "unknown",
            product_name: prod?.name ?? "Produto Uniforce",
            product_type: productType,
            billing_source: "stripe",
            status: "active",
            started_at: startedAt,
            monthly_amount: (price?.unit_amount ?? 0) / 100,
            currency: price?.currency?.toUpperCase() ?? "BRL",
            is_test_mode: !isLive,
          }, { onConflict: "stripe_subscription_id,product_id" });

          // Setar subscription_started_at APENAS se ainda não definido (preserva data original)
          await supabaseAdmin.from("isps")
            .update({ subscription_started_at: startedAt })
            .eq("isp_id", ispId)
            .is("subscription_started_at", null);
        }

        break;
      }

      // ── customer.subscription.created / updated ─────────────────────────────
      // Garante sincronização quando assinatura é criada ou alterada no Stripe Dashboard
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        ispId = sub.metadata?.isp_id ?? null;
        if (!ispId) {
          ispId = await findIspByCustomer(sub.customer as string);
        }
        if (!ispId) break;

        const item  = sub.items.data[0];
        const price = item?.price;
        const productIdRaw = price?.product;
        const productId = typeof productIdRaw === "string" ? productIdRaw : productIdRaw?.id ?? null;

        let productName: string | null = null;
        if (productId) {
          try {
            const prod = await stripe.products.retrieve(productId);
            productName = prod.name;
          } catch { /* não crítico */ }
        }

        // Stripe API ≥2024-09-30 moveu current_period_start/end para items.data[0]
        const periodStart2 = (sub as any).current_period_start ?? (item as any)?.current_period_start ?? null;
        const periodEnd2   = (sub as any).current_period_end   ?? (item as any)?.current_period_end   ?? null;

        if (isLive) {
          await supabaseAdmin.from("isps").update({
            stripe_subscription_id:      sub.id,
            stripe_subscription_status:  sub.status,
            stripe_product_id:           productId,
            stripe_price_id:             price?.id ?? null,
            stripe_product_name:         productName,
            stripe_monthly_amount:       (price?.unit_amount ?? 0) / 100,
            stripe_current_period_start: periodStart2 ? new Date(periodStart2 * 1000).toISOString() : null,
            stripe_current_period_end:   periodEnd2   ? new Date(periodEnd2   * 1000).toISOString() : null,
            stripe_cancel_at_period_end: sub.cancel_at_period_end,
            stripe_trial_end:            sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          }).eq("isp_id", ispId);
        } else {
          // Sandbox: só atualiza o sub_id de teste e a flag
          await supabaseAdmin.from("isps").update({
            stripe_test_subscription_id: sub.id,
            stripe_test_mode_enabled:    true,
          }).eq("isp_id", ispId);
        }

        // Sincronizar cancel_at em isp_subscription_items
        if (sub.cancel_at) {
          const cancelAt = new Date(sub.cancel_at * 1000).toISOString();
          await supabaseAdmin.from("isp_subscription_items")
            .update({ status: "cancel_scheduled", cancel_at: cancelAt, updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", sub.id)
            .eq("status", "active");
        } else {
          // cancel_at removido → reativação
          await supabaseAdmin.from("isp_subscription_items")
            .update({ status: "active", cancel_at: null, updated_at: new Date().toISOString() })
            .eq("stripe_subscription_id", sub.id)
            .eq("status", "cancel_scheduled");
        }

        break;
      }

      // ── customer.subscription.deleted ───────────────────────────────────────
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;

        ispId = sub.metadata?.isp_id ?? null;
        if (!ispId) {
          ispId = await findIspByCustomer(sub.customer as string);
        }
        if (!ispId) break;

        if (isLive) {
          await supabaseAdmin.from("isps").update({
            stripe_subscription_id:      null,
            stripe_subscription_status:  "canceled",
            stripe_product_id:           null,
            stripe_price_id:             null,
            stripe_product_name:         null,
            stripe_monthly_amount:       null,
            stripe_current_period_start: null,
            stripe_current_period_end:   null,
            stripe_cancel_at_period_end: false,
          }).eq("isp_id", ispId);
        } else {
          await supabaseAdmin.from("isps").update({
            stripe_test_subscription_id: null,
          }).eq("isp_id", ispId);
        }

        // Marcar item como cancelado em isp_subscription_items
        await supabaseAdmin.from("isp_subscription_items")
          .update({ status: "canceled", canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("stripe_subscription_id", (event.data.object as Stripe.Subscription).id)
          .neq("status", "canceled"); // idempotente

        break;
      }

      // ── invoice.paid ────────────────────────────────────────────────────────
      // Garante status 'active' após cada pagamento bem-sucedido
      case "invoice.paid": {
        if (!isLive) break; // sandbox: sem relevância para billing real

        const invoice = event.data.object as Stripe.Invoice;
        ispId = await findIspByCustomer(invoice.customer as string);
        if (ispId && invoice.subscription) {
          await supabaseAdmin.from("isps")
            .update({ stripe_subscription_status: "active" })
            .eq("isp_id", ispId);
        }
        break;
      }

      // ── invoice.payment_failed ───────────────────────────────────────────────
      case "invoice.payment_failed": {
        if (!isLive) break; // sandbox: sem relevância para billing real

        const invoice = event.data.object as Stripe.Invoice;
        ispId = await findIspByCustomer(invoice.customer as string);
        if (ispId) {
          await supabaseAdmin.from("isps")
            .update({ stripe_subscription_status: "past_due" })
            .eq("isp_id", ispId);
        }
        break;
      }

      // ── product.updated ─────────────────────────────────────────────────────
      // Sincronização automática: quando um produto Stripe é atualizado,
      // propaga o novo nome/descrição para todas as assinaturas Asaas dos ISPs
      // que estão naquele plano (baseado em asaas_plan_change_requests).
      // Apenas produção (isLive); sandbox não tem ISPs Asaas reais.
      case "product.updated": {
        if (!isLive) break;

        const product = event.data.object as Stripe.Product;
        const productId = product.id;
        const productName = product.name;

        // Buscar ISPs mais recentemente atribuídos a este produto Stripe via Asaas
        // DISTINCT ON (isp_id): pega apenas a entrada mais recente por ISP
        const { data: planRequests, error: planErr } = await supabaseAdmin
          .from("asaas_plan_change_requests")
          .select("isp_id, asaas_subscription_id")
          .eq("stripe_product_id", productId)
          .eq("status", "completed")
          .order("requested_at", { ascending: false });

        if (planErr || !planRequests || planRequests.length === 0) {
          console.log(`product.updated: no Asaas ISPs found for product ${productId}`);
          break;
        }

        // Deduplicate: manter apenas o registro mais recente por ISP
        const uniqueIsps = new Map<string, string>(); // isp_id → asaas_subscription_id
        for (const req of planRequests) {
          if (req.isp_id && req.asaas_subscription_id && !uniqueIsps.has(req.isp_id)) {
            uniqueIsps.set(req.isp_id, req.asaas_subscription_id);
          }
        }

        if (uniqueIsps.size === 0) break;

        const asaasKey = Deno.env.get("ASAAS_API_KEY") ?? "";
        if (!asaasKey) {
          console.warn("product.updated sync: ASAAS_API_KEY not configured");
          break;
        }

        // Atualizar descrição em paralelo para todos os ISPs afetados
        const syncResults = await Promise.allSettled(
          Array.from(uniqueIsps.entries()).map(async ([ispIdTarget, subId]) => {
            const res = await fetch(`https://www.asaas.com/api/v3/subscriptions/${subId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json", "access_token": asaasKey },
              body: JSON.stringify({ description: productName }),
            });
            if (!res.ok) {
              const err = await res.text().catch(() => "");
              throw new Error(`ISP ${ispIdTarget}: ${err}`);
            }
            console.log(`product.updated sync: ISP ${ispIdTarget} sub ${subId} → "${productName}"`);
          })
        );

        const failed = syncResults.filter((r) => r.status === "rejected");
        if (failed.length > 0) {
          console.warn(`product.updated sync: ${failed.length}/${syncResults.length} failed:`,
            failed.map((r) => (r as PromiseRejectedResult).reason?.message).join("; ")
          );
        } else {
          console.log(`product.updated sync: ${syncResults.length} Asaas subscriptions updated for product ${productId}`);
        }

        ispId = null; // Sem ISP único no audit trail (múltiplos afetados)
        break;
      }
    }
  } catch (err) {
    console.error(`stripe-webhook: error processing ${event.type}:`, err);
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // ─── 8. Audit trail ─────────────────────────────────────────────────────────
  await supabaseAdmin.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type:      event.type,
    isp_id:          ispId,
    payload:         { livemode: isLive, event_type: event.type, isp_id: ispId },
    error_message:   errorMessage,
  });

  return new Response(
    JSON.stringify({ received: true, processed: !errorMessage, livemode: isLive, event_type: event.type }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
