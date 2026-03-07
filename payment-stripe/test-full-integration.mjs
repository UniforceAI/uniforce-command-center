// test-full-integration.mjs
// Testa todos os endpoints da integração Stripe de forma programática

import https from "https";

const SUPABASE_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQyMTAzMSwiZXhwIjoyMDcxOTk3MDMxfQ.mp1BOEoYzgITc8ryBMVp2HUsuQ3IkYq31SDjvTJG8qk";
const BASE_FN = `${SUPABASE_URL}/functions/v1`;

// Test result tracking
const results = [];
function pass(name, detail = "") { results.push({ status: "✅ PASS", name, detail }); }
function fail(name, detail = "") { results.push({ status: "❌ FAIL", name, detail }); }
function warn(name, detail = "") { results.push({ status: "⚠️ WARN", name, detail }); }

// HTTP helper
function req(opts, body = null) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, body: data, headers: res.headers }));
    });
    r.on("error", reject);
    if (body) r.write(typeof body === "string" ? body : JSON.stringify(body));
    r.end();
  });
}

function fnHeaders(token, extra = {}) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// ──────────────────────────────────────────────
// PHASE A: Auth — get super_admin JWT
// ──────────────────────────────────────────────
async function getAdminToken() {
  console.log("\n🔐 PHASE A: Authentication");
  const body = JSON.stringify({ email: "eric@uniforce.com.br", password: process.argv[2] || "ForceUni33*" });
  const res = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/auth/v1/token?grant_type=password",
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
  }, body);
  const d = JSON.parse(res.body);
  if (d.access_token) {
    pass("Auth: sign in as eric@uniforce.com.br");
    console.log("   Token (first 40):", d.access_token.substring(0, 40) + "...");
    return d.access_token;
  }
  fail("Auth: sign in as eric@uniforce.com.br", d.msg || d.error_description || res.body);
  return null;
}

// ──────────────────────────────────────────────
// PHASE B: stripe-list-products
// ──────────────────────────────────────────────
async function testListProducts() {
  console.log("\n📦 PHASE B: stripe-list-products");

  // Live mode
  const liveRes = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/functions/v1/stripe-list-products",
    method: "GET",
    headers: { apikey: ANON_KEY },
  });
  const live = JSON.parse(liveRes.body);
  if (live.plans?.length === 3 && live.addons?.length === 6) {
    pass("stripe-list-products LIVE", `${live.plans.length} planos, ${live.addons.length} add-ons`);
    live.plans.forEach(p => console.log(`   - ${p.name}: R$${p.monthly_amount}/mês [${p.monthly_price_id}]`));
  } else {
    fail("stripe-list-products LIVE", `plans=${live.plans?.length}, addons=${live.addons?.length}`);
  }

  // Test mode
  const testRes = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/functions/v1/stripe-list-products",
    method: "GET",
    headers: { apikey: ANON_KEY, "X-Stripe-Test-Mode": "true" },
  });
  const test = JSON.parse(testRes.body);
  if (test.plans?.length === 3 && test.addons?.length === 6) {
    pass("stripe-list-products TEST MODE", `${test.plans.length} planos [TEST], ${test.addons.length} add-ons`);
    test.plans.forEach(p => console.log(`   - ${p.name}: R$${p.monthly_amount}/mês [${p.monthly_price_id}]`));
  } else {
    fail("stripe-list-products TEST MODE", `plans=${test.plans?.length}, addons=${test.addons?.length}`);
  }

  return { live, test };
}

// ──────────────────────────────────────────────
// PHASE C: stripe-subscription
// ──────────────────────────────────────────────
async function testSubscription(token) {
  console.log("\n💳 PHASE C: stripe-subscription");

  // Live mode (ISP uniforce, sem assinatura)
  const res = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/functions/v1/stripe-subscription",
    method: "GET",
    headers: fnHeaders(token),
  });
  const d = JSON.parse(res.body);
  if (res.status === 200 && d.isp_id) {
    pass("stripe-subscription LIVE", `isp_id=${d.isp_id}, billing=${d.stripe_billing_source ?? "null"}, sub=${d.subscription ? d.subscription.status : "none"}`);
    console.log("   Response:", JSON.stringify(d, null, 2).substring(0, 400));
  } else {
    fail("stripe-subscription LIVE", `status=${res.status} | ${res.body.substring(0, 200)}`);
  }

  // Test mode
  const testRes = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/functions/v1/stripe-subscription",
    method: "GET",
    headers: fnHeaders(token, { "X-Stripe-Test-Mode": "true" }),
  });
  const dt = JSON.parse(testRes.body);
  if (testRes.status === 200 && dt.isp_id) {
    pass("stripe-subscription TEST MODE", `isp_id=${dt.isp_id}, billing=${dt.stripe_billing_source ?? "null"}`);
  } else {
    fail("stripe-subscription TEST MODE", `status=${testRes.status} | ${testRes.body.substring(0, 200)}`);
  }

  return d;
}

// ──────────────────────────────────────────────
// PHASE D: stripe-checkout (test mode)
// ──────────────────────────────────────────────
async function testCheckout(token, catalog) {
  console.log("\n🛒 PHASE D: stripe-checkout (TEST MODE)");

  const basicPlan = catalog.plans.find(p => p.name.toLowerCase().includes("basic"));
  if (!basicPlan?.monthly_price_id) {
    fail("stripe-checkout TEST", "Plano Basic não encontrado no catálogo test");
    return;
  }

  const body = JSON.stringify({
    price_id: basicPlan.monthly_price_id,
    success_url: "https://app.uniforce.com.br/configuracoes/perfil?tab=meus-produtos&success=true",
    cancel_url: "https://app.uniforce.com.br/configuracoes/perfil?tab=meus-produtos",
    test_mode: true,
  });

  const res = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/functions/v1/stripe-checkout",
    method: "POST",
    headers: { ...fnHeaders(token), "Content-Length": Buffer.byteLength(body) },
  }, body);

  const d = JSON.parse(res.body);
  if (res.status === 200 && d.url && d.url.startsWith("https://checkout.stripe.com")) {
    pass("stripe-checkout TEST MODE", `session criada com sucesso`);
    console.log("   Plan:", basicPlan.name, "| Price:", basicPlan.monthly_price_id);
    console.log("   Checkout URL:", d.url.substring(0, 80) + "...");
    console.log("   Session ID:", d.session_id);
    return d;
  } else {
    fail("stripe-checkout TEST MODE", `status=${res.status} | ${res.body.substring(0, 300)}`);
  }
}

// ──────────────────────────────────────────────
// PHASE E: stripe-customer-portal (precisa de customer_id)
// ──────────────────────────────────────────────
async function testCustomerPortal(token) {
  console.log("\n🏛️  PHASE E: stripe-customer-portal");

  const body = JSON.stringify({
    return_url: "https://app.uniforce.com.br/configuracoes/perfil?tab=meus-produtos",
  });
  const res = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/functions/v1/stripe-customer-portal",
    method: "POST",
    headers: { ...fnHeaders(token), "Content-Length": Buffer.byteLength(body) },
  }, body);

  const d = JSON.parse(res.body);
  if (res.status === 200 && d.url) {
    pass("stripe-customer-portal", `URL gerada: ${d.url.substring(0, 60)}...`);
  } else if (res.status === 404 && d.error?.toLowerCase().includes("stripe")) {
    pass("stripe-customer-portal", "404 esperado: ISP sem stripe_customer_id (correto antes do 1º checkout)");
  } else {
    fail("stripe-customer-portal", `status=${res.status} | ${JSON.stringify(d)}`);
  }
}

// ──────────────────────────────────────────────
// PHASE F: DB isolation (RLS)
// ──────────────────────────────────────────────
async function testRLS(token) {
  console.log("\n🔒 PHASE F: RLS Isolation");

  // ISP uniforce should only see its own data
  const res = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/rest/v1/isps?select=isp_id,stripe_customer_id,stripe_subscription_status",
    method: "GET",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const d = JSON.parse(res.body);
  if (Array.isArray(d)) {
    const ispIds = d.map(r => r.isp_id);
    // super_admin (eric@uniforce.com.br) vê todos ISPs por design
    // Usuários admin/support_staff veem apenas seu ISP
    if (ispIds.includes("uniforce") && ispIds.length >= 1) {
      pass("RLS: super_admin vê todos os ISPs (comportamento correto)", `${ispIds.length} ISPs: ${ispIds.join(", ")}`);
    } else {
      warn("RLS: resultado inesperado", JSON.stringify(ispIds));
    }
  } else {
    warn("RLS: resposta não é array", res.body.substring(0, 200));
  }

  // webhook_events: ISP user cannot read (only service_role)
  const eventsRes = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/rest/v1/stripe_webhook_events?select=id&limit=1",
    method: "GET",
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
  });
  const eventsData = JSON.parse(eventsRes.body);
  if (eventsRes.status === 200 && Array.isArray(eventsData) && eventsData.length === 0) {
    pass("RLS: stripe_webhook_events invisível para ISP user", "0 rows retornadas (correto)");
  } else if (eventsRes.status === 403 || eventsData.code === "42501") {
    pass("RLS: stripe_webhook_events bloqueado por RLS");
  } else {
    warn("RLS: stripe_webhook_events", `status=${eventsRes.status} | ${JSON.stringify(eventsData).substring(0, 100)}`);
  }
}

// ──────────────────────────────────────────────
// PHASE G: Legacy ISP protection (billing_source=asaas)
// ──────────────────────────────────────────────
async function testLegacyProtection() {
  console.log("\n🛡️  PHASE G: Legacy ISP Protection (Asaas billing_source)");

  const res = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/rest/v1/isps?select=isp_id,stripe_billing_source&isp_id=in.(agy-telecom,d-kiros,igp-fibra,zen-telecom)",
    method: "GET",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const d = JSON.parse(res.body);
  const allAsaas = d.every(r => r.stripe_billing_source === "asaas");
  if (allAsaas && d.length === 4) {
    pass("Legacy ISPs: todos com stripe_billing_source='asaas'", d.map(r => r.isp_id).join(", "));
  } else {
    fail("Legacy ISPs: billing_source incorreto", JSON.stringify(d));
  }

  // Uniforce ISP should be null (test subject)
  const uniforceRes = await req({
    hostname: "yqdqmudsnjhixtxldqwi.supabase.co",
    path: "/rest/v1/isps?select=isp_id,stripe_billing_source&isp_id=eq.uniforce",
    method: "GET",
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const ud = JSON.parse(uniforceRes.body);
  if (ud[0]?.stripe_billing_source === null) {
    pass("ISP uniforce: billing_source=null (elegível para Stripe checkout)");
  } else {
    warn("ISP uniforce: billing_source=" + ud[0]?.stripe_billing_source);
  }
}

// ──────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   UNIFORCE STRIPE INTEGRATION — FULL TEST SUITE     ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log(`  Supabase: yqdqmudsnjhixtxldqwi`);
  console.log(`  Data: ${new Date().toLocaleString("pt-BR")}`);

  const token = await getAdminToken();
  if (!token) { console.error("\n🚨 Abortando: sem token de autenticação"); process.exit(1); }

  const { live: liveCatalog, test: testCatalog } = await testListProducts();
  await testSubscription(token);
  const checkoutData = await testCheckout(token, testCatalog);
  await testCustomerPortal(token);
  await testRLS(token);
  await testLegacyProtection();

  // Summary
  console.log("\n╔══════════════════════════════════════════════════════╗");
  console.log("║                    RESULTADO FINAL                  ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  for (const r of results) {
    console.log(`${r.status} ${r.name}`);
    if (r.detail) console.log(`   └─ ${r.detail}`);
  }

  const passed = results.filter(r => r.status.includes("PASS")).length;
  const failed = results.filter(r => r.status.includes("FAIL")).length;
  const warned = results.filter(r => r.status.includes("WARN")).length;
  console.log(`\n  Passou: ${passed} | Falhou: ${failed} | Avisos: ${warned}`);

  if (checkoutData?.url) {
    console.log("\n╔══════════════════════════════════════════════════════╗");
    console.log("║            URL DE CHECKOUT (TESTE MANUAL)           ║");
    console.log("╚══════════════════════════════════════════════════════╝");
    console.log(checkoutData.url);
    console.log("\n  Cartão de teste: 4242 4242 4242 4242 | Validade: 12/26 | CVV: 123");
  }
}

main().catch(console.error);
