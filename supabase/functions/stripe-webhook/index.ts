// stripe-webhook/index.ts
// Supabase Edge Function — Recebe e processa webhooks do Stripe
// Endpoint: POST /functions/v1/stripe-webhook
// Auth: Stripe-Signature header (não usa JWT Supabase)
// IMPORTANTE: Configurar STRIPE_WEBHOOK_SECRET no Supabase Vault
//             Adicionar URL desta função no Stripe Dashboard > Webhooks

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "stripe-signature, content-type",
};

// Eventos que este webhook processa
const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    apiVersion: "2024-06-20",
    httpClient: Stripe.createFetchHttpClient(),
  });

  // Service role para escrita no DB (bypass RLS)
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  // Tentar validar com secret live primeiro, depois test mode
  const liveSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const testSecret = Deno.env.get("STRIPE_TEST_WEBHOOK_SECRET") ?? "";

  let event: Stripe.Event;
  let isTestEvent = false;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature ?? "", liveSecret);
  } catch {
    if (testSecret) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature ?? "", testSecret);
        isTestEvent = true;
      } catch (err) {
        console.error("Webhook signature validation failed (live + test):", err);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      console.error("Webhook signature validation failed");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Idempotência: verificar se evento já foi processado
  const { data: existing } = await supabaseAdmin
    .from("stripe_webhook_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .single();

  if (existing) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Ignorar eventos não relevantes
  if (!HANDLED_EVENTS.includes(event.type)) {
    await supabaseAdmin.from("stripe_webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event,
    });
    return new Response(JSON.stringify({ received: true, processed: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let ispId: string | null = null;
  let errorMessage: string | null = null;

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        ispId = session.client_reference_id ?? session.metadata?.isp_id ?? null;

        if (session.mode === "subscription" && session.subscription && ispId) {
          // Buscar detalhes da assinatura criada
          const sub = await stripe.subscriptions.retrieve(session.subscription as string, {
            expand: ["items.data.price.product"],
          });

          const item = sub.items.data[0];
          const price = item?.price as Stripe.Price & { product: Stripe.Product };
          const product = price?.product as Stripe.Product;

          await supabaseAdmin
            .from("isps")
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: sub.id,
              stripe_subscription_status: sub.status,
              stripe_product_id: product?.id ?? null,
              stripe_price_id: price?.id ?? null,
              stripe_product_name: product?.name ?? null,
              stripe_monthly_amount: (price?.unit_amount ?? 0) / 100,
              stripe_current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              stripe_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              stripe_cancel_at_period_end: sub.cancel_at_period_end,
              stripe_trial_end: sub.trial_end
                ? new Date(sub.trial_end * 1000).toISOString()
                : null,
            })
            .eq("isp_id", ispId);

          // Concluir onboarding se ISP estava em payment_pending
          await supabaseAdmin.rpc("complete_isp_onboarding", { p_isp_id: ispId });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        ispId = sub.metadata?.isp_id ?? null;

        // Se não tem isp_id no metadata, buscar pelo stripe_customer_id
        if (!ispId) {
          const { data: ispRow } = await supabaseAdmin
            .from("isps")
            .select("isp_id")
            .eq("stripe_customer_id", sub.customer as string)
            .single();
          ispId = ispRow?.isp_id ?? null;
        }

        if (ispId) {
          const item = sub.items.data[0];
          const price = item?.price;

          // Buscar nome do produto
          let productName: string | null = null;
          let productId: string | null = null;
          if (price?.product) {
            const productId_ = typeof price.product === "string" ? price.product : price.product.id;
            productId = productId_;
            try {
              const product = await stripe.products.retrieve(productId_);
              productName = product.name;
            } catch { /* ignore */ }
          }

          await supabaseAdmin
            .from("isps")
            .update({
              stripe_subscription_id: sub.id,
              stripe_subscription_status: sub.status,
              stripe_product_id: productId,
              stripe_price_id: price?.id ?? null,
              stripe_product_name: productName,
              stripe_monthly_amount: (price?.unit_amount ?? 0) / 100,
              stripe_current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              stripe_current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              stripe_cancel_at_period_end: sub.cancel_at_period_end,
              stripe_trial_end: sub.trial_end
                ? new Date(sub.trial_end * 1000).toISOString()
                : null,
            })
            .eq("isp_id", ispId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        ispId = sub.metadata?.isp_id ?? null;

        if (!ispId) {
          const { data: ispRow } = await supabaseAdmin
            .from("isps")
            .select("isp_id")
            .eq("stripe_customer_id", sub.customer as string)
            .single();
          ispId = ispRow?.isp_id ?? null;
        }

        if (ispId) {
          await supabaseAdmin
            .from("isps")
            .update({
              stripe_subscription_id: null,
              stripe_subscription_status: "canceled",
              stripe_product_id: null,
              stripe_price_id: null,
              stripe_product_name: null,
              stripe_monthly_amount: null,
              stripe_current_period_start: null,
              stripe_current_period_end: null,
              stripe_cancel_at_period_end: false,
            })
            .eq("isp_id", ispId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const { data: ispRow } = await supabaseAdmin
          .from("isps")
          .select("isp_id")
          .eq("stripe_customer_id", invoice.customer as string)
          .single();
        ispId = ispRow?.isp_id ?? null;

        if (ispId) {
          await supabaseAdmin
            .from("isps")
            .update({ stripe_subscription_status: "past_due" })
            .eq("isp_id", ispId);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const { data: ispRow } = await supabaseAdmin
          .from("isps")
          .select("isp_id")
          .eq("stripe_customer_id", invoice.customer as string)
          .single();
        ispId = ispRow?.isp_id ?? null;

        if (ispId && invoice.subscription) {
          // Garantir que status está como active após pagamento
          await supabaseAdmin
            .from("isps")
            .update({ stripe_subscription_status: "active" })
            .eq("isp_id", ispId);
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Error processing webhook event ${event.type}:`, err);
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // Salvar evento no audit trail (marcando eventos de teste)
  await supabaseAdmin.from("stripe_webhook_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    isp_id: ispId,
    payload: { ...event, _is_test_event: isTestEvent },
    error_message: errorMessage,
  });

  return new Response(
    JSON.stringify({ received: true, processed: !errorMessage, event_type: event.type }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
});
