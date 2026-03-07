// src/pages/Onboarding.tsx
// Wizard de onboarding para novos ISPs
// Rota: /onboarding (acessada automaticamente quando profile.isp_id === null)
//
// Steps:
//   1. Dados do Provedor (nome, CNPJ, ERP)
//   2. Credenciais ERP (URL, API key) → valida ao vivo
//   3. Pagamento (Stripe Checkout)

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Building2, Server, CreditCard, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useStripeProducts } from "@/hooks/useStripeProducts";
import { useStripeCheckout } from "@/hooks/useStripeSubscription";

// ─── Helpers ────────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = [
    { n: 1, label: "Provedor" },
    { n: 2, label: "Credenciais ERP" },
    { n: 3, label: "Pagamento" },
  ];
  return (
    <div className="flex items-center gap-2 justify-center mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center gap-2">
          <div className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-bold border-2 transition-colors ${
            current === s.n
              ? "bg-primary text-primary-foreground border-primary"
              : current > s.n
              ? "bg-green-500 text-white border-green-500"
              : "bg-muted text-muted-foreground border-border"
          }`}>
            {current > s.n ? <CheckCircle2 className="h-4 w-4" /> : s.n}
          </div>
          <span className={`text-sm hidden sm:block ${current === s.n ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
            {s.label}
          </span>
          {i < steps.length - 1 && <div className="w-8 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

// ─── Step 1: Dados do Provedor ───────────────────────────────────────────────

interface Step1Data {
  isp_nome: string;
  cnpj: string;
  instancia_isp: string;
}

function Step1({ onNext }: { onNext: (data: Step1Data) => void }) {
  const [form, setForm] = useState<Step1Data>({ isp_nome: "", cnpj: "", instancia_isp: "" });

  const valid = form.isp_nome.trim().length >= 2 && form.instancia_isp !== "";

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Dados do Provedor
        </CardTitle>
        <CardDescription>Informações básicas sobre seu provedor de internet.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="isp_nome" className="text-sm">Nome Fantasia *</Label>
          <Input
            id="isp_nome"
            value={form.isp_nome}
            onChange={(e) => setForm((p) => ({ ...p, isp_nome: e.target.value }))}
            placeholder="Ex: Fibra Digital Telecomunicações"
            className="mt-1.5 h-9"
          />
        </div>

        <div>
          <Label htmlFor="cnpj" className="text-sm">CNPJ</Label>
          <Input
            id="cnpj"
            value={form.cnpj}
            onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))}
            placeholder="00.000.000/0001-00"
            className="mt-1.5 h-9"
          />
        </div>

        <div>
          <Label htmlFor="erp" className="text-sm">Sistema ERP *</Label>
          <Select
            value={form.instancia_isp}
            onValueChange={(v) => setForm((p) => ({ ...p, instancia_isp: v }))}
          >
            <SelectTrigger id="erp" className="mt-1.5 h-9">
              <SelectValue placeholder="Selecione o sistema..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ixc">IXC Provedor</SelectItem>
              <SelectItem value="ispbox">ISPBox</SelectItem>
              <SelectItem value="mk">MK Solutions</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={() => onNext(form)} disabled={!valid} className="w-full gap-2 mt-2">
          Próximo <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Step 2: Credenciais ERP ─────────────────────────────────────────────────

interface Step2Data {
  erp_base_url: string;
  erp_api_key: string;
  erp_api_token: string;
}

interface Step2Props {
  ispNome: string;
  erpType: string;
  onNext: (data: Step2Data & { isp_id: string }) => void;
  onBack: () => void;
  step1: Step1Data;
}

function Step2({ ispNome, erpType, onNext, onBack, step1 }: Step2Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<Step2Data>({ erp_base_url: "", erp_api_key: "", erp_api_token: "" });
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validationMsg, setValidationMsg] = useState("");
  const [creating, setCreating] = useState(false);

  const erpLabel = { ixc: "IXC Provedor", ispbox: "ISPBox", mk: "MK Solutions" }[erpType] ?? erpType;
  const urlPlaceholder = erpType === "ixc"
    ? "https://erp.seuisp.com.br"
    : erpType === "ispbox"
    ? "https://app.ispbox.com.br/seuisp"
    : "https://mk.seuisp.com.br";

  const handleValidate = async () => {
    if (!form.erp_base_url.trim() || !form.erp_api_key.trim()) {
      toast({ title: "Preencha a URL e a chave de API.", variant: "destructive" });
      return;
    }
    setValidating(true);
    setValidated(false);
    setValidationMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("validate-erp-credentials", {
        body: {
          erp_type: erpType,
          base_url: form.erp_base_url.trim(),
          api_key: form.erp_api_key.trim(),
          api_token: form.erp_api_token.trim() || undefined,
        },
      });
      if (error) throw error;
      setValidated(data.valid);
      setValidationMsg(data.message);
      if (!data.valid) {
        toast({ title: "Credenciais inválidas", description: data.message, variant: "destructive" });
      }
    } catch (err) {
      setValidationMsg("Erro ao validar. Tente novamente.");
      toast({ title: "Erro ao validar", description: String(err), variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data: sessData } = await externalSupabase.auth.refreshSession();
      const extToken = sessData?.session?.access_token
        ?? (await externalSupabase.auth.getSession()).data.session?.access_token;

      const { data, error } = await supabase.functions.invoke("onboard-create-isp", {
        body: {
          isp_nome: step1.isp_nome,
          cnpj: step1.cnpj,
          instancia_isp: step1.instancia_isp,
          erp_base_url: form.erp_base_url.trim(),
          erp_api_key: form.erp_api_key.trim(),
          erp_api_token: form.erp_api_token.trim() || undefined,
        },
        headers: extToken ? { Authorization: `Bearer ${extToken}` } : {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onNext({ ...form, isp_id: data.isp_id });
    } catch (err) {
      toast({ title: "Erro ao criar provedor", description: String(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="h-5 w-5 text-primary" />
          Credenciais {erpLabel}
        </CardTitle>
        <CardDescription>
          Acesso à API do seu ERP para integrar os dados de clientes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm">URL Base do Sistema *</Label>
          <Input
            value={form.erp_base_url}
            onChange={(e) => { setForm((p) => ({ ...p, erp_base_url: e.target.value })); setValidated(false); }}
            placeholder={urlPlaceholder}
            className="mt-1.5 h-9"
          />
        </div>

        <div>
          <Label className="text-sm">
            {erpType === "ixc" ? "Usuário / Token API *" : "Token API *"}
          </Label>
          <Input
            value={form.erp_api_key}
            onChange={(e) => { setForm((p) => ({ ...p, erp_api_key: e.target.value })); setValidated(false); }}
            placeholder={erpType === "ixc" ? "usuario_api" : "token_xxxx"}
            className="mt-1.5 h-9"
          />
        </div>

        {erpType === "ixc" && (
          <div>
            <Label className="text-sm">Senha / API Key (IXC)</Label>
            <Input
              type="password"
              value={form.erp_api_token}
              onChange={(e) => { setForm((p) => ({ ...p, erp_api_token: e.target.value })); setValidated(false); }}
              placeholder="Chave de API IXC"
              className="mt-1.5 h-9"
            />
          </div>
        )}

        {/* Validation result */}
        {validationMsg && (
          <div className={`flex items-start gap-2 rounded-md p-3 text-sm border ${
            validated
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-destructive/5 border-destructive/20 text-destructive"
          }`}>
            {validated
              ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
            {validationMsg}
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="outline"
            onClick={handleValidate}
            disabled={validating || !form.erp_base_url.trim() || !form.erp_api_key.trim()}
            className="w-full gap-2"
          >
            {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {validating ? "Validando..." : "Testar Conexão"}
          </Button>

          <Button
            onClick={handleCreate}
            disabled={!validated || creating}
            className="w-full gap-2"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
            {creating ? "Criando provedor..." : "Continuar para Pagamento"}
          </Button>

          <Button variant="ghost" onClick={onBack} disabled={creating} className="text-muted-foreground">
            Voltar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Pagamento ───────────────────────────────────────────────────────

interface Step3Props {
  ispId: string;
  onBack: () => void;
}

function Step3({ ispId, onBack }: Step3Props) {
  const { data: catalog, isLoading } = useStripeProducts();
  const checkout = useStripeCheckout();

  const plans = catalog?.plans ?? [];

  const handleCheckout = (priceId: string) => {
    checkout.mutate({
      price_id: priceId,
      success_url: `${window.location.origin}/configuracoes/perfil?tab=meus-produtos&success=true`,
      cancel_url: `${window.location.origin}/onboarding?step=3`,
    });
  };

  const planFeatures: Record<string, string[]> = {
    "prod_U41i5VULCVGKRl": ["NPS Automático", "Churn Prediction", "Dashboard Analytics", "Suporte por e-mail"],
    "prod_U41iUfju8I1C2n": ["Tudo do Basic", "Smart Cobrança", "Régua de Retenção", "Suporte prioritário"],
    "prod_U41i4IUixqqdnT": ["Tudo do Retention", "IA Generativa", "Support Helper N1", "Suporte dedicado"],
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Escolha seu Plano
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione o plano ideal para o seu provedor. Você pode fazer upgrade a qualquer momento.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const isMiddle = i === 1;
            const features = planFeatures[plan.id] ?? [];
            return (
              <Card key={plan.id} className={`relative flex flex-col ${isMiddle ? "border-primary shadow-lg" : ""}`}>
                {isMiddle && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs">Mais Popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">
                      R$ {plan.monthly_amount?.toLocaleString("pt-BR") ?? "—"}
                    </span>
                    <span className="text-muted-foreground text-sm">/mês</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-4">
                  <ul className="space-y-1.5 flex-1">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    onClick={() => handleCheckout(plan.monthly_price_id!)}
                    disabled={checkout.isPending}
                    variant={isMiddle ? "default" : "outline"}
                    className="w-full"
                  >
                    {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Contratar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="text-center mt-6">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground text-sm">
          Voltar e editar credenciais
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Data, setStep2Data] = useState<(Step2Data & { isp_id: string }) | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Uniforce</h1>
            <p className="text-xs text-muted-foreground">Configuração inicial do provedor</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-4xl">
        <StepIndicator current={step} />

        {step === 1 && (
          <Step1
            onNext={(data) => {
              setStep1Data(data);
              setStep(2);
            }}
          />
        )}

        {step === 2 && step1Data && (
          <Step2
            ispNome={step1Data.isp_nome}
            erpType={step1Data.instancia_isp}
            step1={step1Data}
            onNext={(data) => {
              setStep2Data(data);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && step2Data && (
          <Step3
            ispId={step2Data.isp_id}
            onBack={() => setStep(2)}
          />
        )}
      </main>
    </div>
  );
}
