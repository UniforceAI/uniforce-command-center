// stripe-list-products/index.ts
// Supabase Edge Function — Lista produtos e preços ativos do Stripe
// Endpoint: GET /functions/v1/stripe-list-products
// Auth: Não obrigatória (catálogo público de planos)

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Produtos que são planos principais (não add-ons)
const MAIN_PLAN_IDS = [
  "prod_U41i5VULCVGKRl", // Uniforce Basic
  "prod_U41iUfju8I1C2n", // Uniforce Retention
  "prod_U41i4IUixqqdnT", // Uniforce Growth
];

// Produtos que são add-ons mensais
const ADDON_PRODUCT_IDS = [
  "prod_U41iBwKh8glQlZ", // NPS Check
  "prod_U41iWFzEhoLYhY", // Smart Cobrança
  "prod_U41i6NOGZwJlVH", // Support Helper N1
  "prod_U41iOcWCW1DPAx", // Auto Contract
  "prod_U41irI13heCWd1", // Enviar Campanhas
  "prod_U41idU07f8xSla", // Max Sales
];

// Produtos test mode (espelhados)
const TEST_MAIN_PLAN_IDS = [
  "prod_U6PrObhPyX8oQC", // Uniforce Basic [TEST]
  "prod_U6PrtJZY7mvP4U", // Uniforce Retention [TEST]
  "prod_U6Pr82ehi6o3WC", // Uniforce Growth [TEST]
];
const TEST_ADDON_IDS = [
  "prod_U6PrnYg4x1TuIw", // NPS Check [TEST]
  "prod_U6PrkmjdFmyTqs", // Smart Cobrança [TEST]
  "prod_U6PrOAAcTZVtTa", // Support Helper N1 [TEST]
  "prod_U6PrxoEdCWJfN4", // Auto Contract [TEST]
  "prod_U6Prj1GJBukQWu", // Enviar Campanhas [TEST]
  "prod_U6Prk0MgkLHVfc", // Max Sales [TEST]
];

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Suporta test mode via query param ?test=true ou header X-Stripe-Test-Mode
    const url = new URL(req.url);
    const isTestMode = url.searchParams.get("test") === "true"
      || req.headers.get("X-Stripe-Test-Mode") === "true";

    const stripeKey = isTestMode
      ? (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? Deno.env.get("STRIPE_SECRET_KEY") ?? "")
      : (Deno.env.get("STRIPE_SECRET_KEY") ?? "");

    const activePlanIds  = isTestMode ? TEST_MAIN_PLAN_IDS : MAIN_PLAN_IDS;
    const activeAddonIds = isTestMode ? TEST_ADDON_IDS     : ADDON_PRODUCT_IDS;

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Buscar todos os produtos ativos
    const [productsRes, pricesRes] = await Promise.all([
      stripe.products.list({ active: true, limit: 100 }),
      stripe.prices.list({ active: true, limit: 100 }),
    ]);

    // Mapear preços por produto
    const pricesByProduct: Record<string, Stripe.Price[]> = {};
    for (const price of pricesRes.data) {
      const productId = typeof price.product === "string" ? price.product : price.product.id;
      if (!pricesByProduct[productId]) pricesByProduct[productId] = [];
      pricesByProduct[productId].push(price);
    }

    // Formatar produtos
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
      .sort((a, b) => (a.monthly_amount ?? 0) - (b.monthly_amount ?? 0)); // ordena por preço asc

    const addons = productsRes.data
      .filter((p) => activeAddonIds.includes(p.id))
      .map((p) => formatProduct(p, "addon"))
      .sort((a, b) => (a.monthly_amount ?? 0) - (b.monthly_amount ?? 0));

    const services = productsRes.data
      .filter((p) => !activePlanIds.includes(p.id) && !activeAddonIds.includes(p.id))
      .map((p) => formatProduct(p, "service"));

    return new Response(
      JSON.stringify({ plans, addons, services }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("stripe-list-products error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao buscar produtos do Stripe" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
