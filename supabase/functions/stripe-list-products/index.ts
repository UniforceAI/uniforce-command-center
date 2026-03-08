// stripe-list-products/index.ts
// Lista produtos e preços ativos do Stripe
// target_isp_id: ISP selecionado no dashboard (super_admin pode passar ISP diferente do seu)
// Test mode: automático quando isp_id='uniforce'

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-stripe-test-mode",
};

const MAIN_PLAN_IDS = [
  "prod_U41i5VULCVGKRl",
  "prod_U41iUfju8I1C2n",
  "prod_U41i4IUixqqdnT",
];
const ADDON_PRODUCT_IDS = [
  "prod_U41iBwKh8glQlZ",
  "prod_U41iWFzEhoLYhY",
  "prod_U41i6NOGZwJlVH",
  "prod_U41iOcWCW1DPAx",
  "prod_U41irI13heCWd1",
  "prod_U41idU07f8xSla",
];
const TEST_MAIN_PLAN_IDS = [
  "prod_U6PrObhPyX8oQC",
  "prod_U6PrtJZY7mvP4U",
  "prod_U6Pr82ehi6o3WC",
];
const TEST_ADDON_IDS = [
  "prod_U6PrnYg4x1TuIw",
  "prod_U6PrkmjdFmyTqs",
  "prod_U6PrOAAcTZVtTa",
  "prod_U6PrxoEdCWJfN4",
  "prod_U6Prj1GJBukQWu",
  "prod_U6Prk0MgkLHVfc",
];

const TEST_MODE_ISP_IDS = ["uniforce"];

// Decode JWT locally — reliable in Deno without extra network call
function getUserIdFromJWT(authHeader: string): string | null {
  try {
    const token = authHeader.replace("Bearer ", "");
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Ler target_isp_id do body (pode ser null)
    let targetIspId: string | null = null;
    try {
      const body = await req.json();
      targetIspId = body?.target_isp_id ?? null;
    } catch { /* body vazio é ok */ }

    // Detectar test mode via ISP efetivo
    let isTestMode = false;
    const authHeader = req.headers.get("Authorization");

    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: ownData } = await supabase.rpc("get_isp_stripe_data");
      const ownIspId: string | null = ownData?.[0]?.isp_id ?? null;

      let effectiveIspId = ownIspId;

      // Super_admin pode solicitar outro ISP
      if (targetIspId && targetIspId !== ownIspId) {
        // Decode JWT localmente (sem chamada de rede) + supabaseAdmin para bypassar RLS
        const userId = getUserIdFromJWT(authHeader);
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("role").eq("id", userId ?? "").maybeSingle();
        if (profile?.role === "super_admin") {
          effectiveIspId = targetIspId;
        }
        // Se não for super_admin, usa o próprio ISP (seguro — live env para clientes reais)
      } else if (targetIspId) {
        effectiveIspId = targetIspId;
      }

      isTestMode = TEST_MODE_ISP_IDS.includes(effectiveIspId ?? "");
    }

    const stripeKey = isTestMode
      ? (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "")
      : (Deno.env.get("STRIPE_SECRET_KEY") ?? "");

    const activePlanIds  = isTestMode ? TEST_MAIN_PLAN_IDS : MAIN_PLAN_IDS;
    const activeAddonIds = isTestMode ? TEST_ADDON_IDS      : ADDON_PRODUCT_IDS;

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const [productsRes, pricesRes] = await Promise.all([
      stripe.products.list({ active: true, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);

    const pricesByProduct: Record<string, Stripe.Price[]> = {};
    for (const price of pricesRes.data) {
      const productId = typeof price.product === "string" ? price.product : price.product.id;
      if (!pricesByProduct[productId]) pricesByProduct[productId] = [];
      pricesByProduct[productId].push(price);
    }

    const formatProduct = (product: Stripe.Product, type: "plan" | "addon" | "service") => {
      const prices = pricesByProduct[product.id] ?? [];
      const monthlyPrice = prices.find((p) => p.recurring?.interval === "month");
      const oneTimePrice = prices.find((p) => !p.recurring);
      return {
        id: product.id,
        name: product.name,
        description: product.description ?? "",
        type,
        features: product.marketing_features?.map((f) => f.name) ?? [],
        metadata: product.metadata ?? {},
        prices: prices.map((p) => ({
          id: p.id,
          amount: (p.unit_amount ?? 0) / 100,
          currency: p.currency.toUpperCase(),
          interval: p.recurring?.interval ?? "one_time",
          interval_count: p.recurring?.interval_count ?? 1,
        })),
        monthly_price_id: monthlyPrice?.id ?? null,
        monthly_amount: monthlyPrice ? (monthlyPrice.unit_amount ?? 0) / 100 : null,
        one_time_price_id: oneTimePrice?.id ?? null,
        one_time_amount: oneTimePrice ? (oneTimePrice.unit_amount ?? 0) / 100 : null,
      };
    };

    const plans = productsRes.data
      .filter((p) => activePlanIds.includes(p.id))
      .map((p) => formatProduct(p, "plan"))
      .sort((a, b) => (a.monthly_amount ?? 0) - (b.monthly_amount ?? 0));

    const addons = productsRes.data
      .filter((p) => activeAddonIds.includes(p.id))
      .map((p) => formatProduct(p, "addon"))
      .sort((a, b) => (a.monthly_amount ?? 0) - (b.monthly_amount ?? 0));

    const services = productsRes.data
      .filter((p) => !activePlanIds.includes(p.id) && !activeAddonIds.includes(p.id))
      .map((p) => formatProduct(p, "service"));

    return new Response(
      JSON.stringify({ plans, addons, services }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("stripe-list-products error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar produtos do Stripe" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
