// src/pages/Onboarding.tsx
// Wizard de onboarding self-service para novos ISPs
// Rota: /onboarding
//
// Steps:
//   1. Conta & Provedor (signup email/senha ou Google OAuth)
//   2. Integração IXC (campo único user:key + URL + IP blocking)
//   [tela transição: Conexão Confirmada]
//   3. Plano de pagamento (preselect via ?plano=<price_id> + lock-in 3 meses)

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2, Building2, Server, CreditCard, CheckCircle2, AlertCircle,
  ChevronRight, Users, Clock, HelpCircle, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useStripeProducts } from "@/hooks/useStripeProducts";
import { useStripeCheckout } from "@/hooks/useStripeSubscription";
import { IxcTutorialLightbox } from "@/components/onboarding/IxcTutorialLightbox";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

// ─── Helpers ────────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = [
    { n: 1, label: "Conta" },
    { n: 2, label: "Integração" },
    { n: 3, label: "Plano" },
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

function cnpjMask(v: string) {
  return v.replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .substring(0, 18);
}

// ─── Step 1: Conta & Provedor ────────────────────────────────────────────────

interface Step1Data {
  admin_name: string;
  isp_nome: string;
  cnpj: string;
  email: string;
  phone: string;
  password: string;
}

function Step1({ onNext }: { onNext: (data: Step1Data) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Step1Data>({
    admin_name: "", isp_nome: "", cnpj: "", email: "", phone: "", password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const set = (k: keyof Step1Data) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const valid =
    form.admin_name.trim().length >= 2 &&
    form.isp_nome.trim().length >= 2 &&
    form.email.includes("@") &&
    form.password.length >= 6 &&
    form.password === confirmPassword;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      const { data, error } = await externalSupabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: {
          data: {
            full_name: form.admin_name.trim(),
            phone: form.phone.trim(),
          },
          // Após confirmação de e-mail, redireciona de volta ao onboarding com os dados salvos
          emailRedirectTo: `${window.location.origin}/onboarding?confirmed=1`,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Usuário não criado.");

      if (!data.session) {
        // Email confirmation required — salvar dados no sessionStorage para recuperar após redirect
        sessionStorage.setItem("onboarding_step1", JSON.stringify(form));
        setAwaitingConfirmation(true);
        return;
      }

      // Sessão disponível imediatamente (email confirm desabilitado) — avançar
      onNext(form);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const friendly = msg.includes("already registered")
        ? "E-mail já cadastrado. Faça login ou use outro e-mail."
        : msg;
      toast({ title: "Erro no cadastro", description: friendly, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    await externalSupabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/onboarding?step=2&google=1`,
      },
    });
  };

  if (awaitingConfirmation) {
    return (
      <Card className="max-w-lg mx-auto text-center">
        <CardContent className="pt-10 pb-8 space-y-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-lg font-bold">Confirme seu e-mail</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enviamos um link de confirmação para <strong>{form.email}</strong>.
            Clique no link e volte aqui para continuar.
          </p>
          <p className="text-xs text-muted-foreground">
            Não recebeu?{" "}
            <button
              className="text-primary underline"
              onClick={async () => {
                await externalSupabase.auth.resend({ type: "signup", email: form.email.trim() });
                toast({ title: "E-mail reenviado!" });
              }}
            >
              Reenviar e-mail
            </button>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Criar sua conta
        </CardTitle>
        <CardDescription>Dados do administrador e do seu provedor.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="admin_name" className="text-sm">Seu nome *</Label>
            <Input id="admin_name" value={form.admin_name} onChange={set("admin_name")}
              placeholder="João Silva" className="mt-1.5 h-9" />
          </div>
          <div>
            <Label htmlFor="phone" className="text-sm">Telefone</Label>
            <Input id="phone" value={form.phone} onChange={set("phone")}
              placeholder="(11) 99999-0000" className="mt-1.5 h-9" />
          </div>
        </div>

        <div>
          <Label htmlFor="isp_nome" className="text-sm">Nome do Provedor / Razão Social *</Label>
          <Input id="isp_nome" value={form.isp_nome} onChange={set("isp_nome")}
            placeholder="Fibra Digital Telecomunicações" className="mt-1.5 h-9" />
        </div>

        <div>
          <Label htmlFor="cnpj" className="text-sm">CNPJ</Label>
          <Input id="cnpj" value={form.cnpj}
            onChange={(e) => setForm((p) => ({ ...p, cnpj: cnpjMask(e.target.value) }))}
            placeholder="00.000.000/0001-00" className="mt-1.5 h-9" />
        </div>

        <div>
          <Label htmlFor="email" className="text-sm">E-mail *</Label>
          <Input id="email" type="email" value={form.email} onChange={set("email")}
            placeholder="admin@seuprovedor.com.br" className="mt-1.5 h-9" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="password" className="text-sm">Senha *</Label>
            <Input id="password" type="password" value={form.password} onChange={set("password")}
              placeholder="Mínimo 6 caracteres" className="mt-1.5 h-9" />
          </div>
          <div>
            <Label htmlFor="confirm" className="text-sm">Confirmar Senha *</Label>
            <Input id="confirm" type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha" className="mt-1.5 h-9" />
            {confirmPassword && form.password !== confirmPassword && (
              <p className="text-xs text-destructive mt-1">Senhas não coincidem.</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={handleSubmit} disabled={!valid || loading} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
            {loading ? "Criando conta..." : "Criar conta e continuar"}
          </Button>

          <div className="relative flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button variant="outline" onClick={handleGoogle} className="w-full gap-2">
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar com Google
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Já tem uma conta?{" "}
          <a href="/auth" className="text-primary underline">Fazer login</a>
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Step 2: Integração IXC ──────────────────────────────────────────────────

interface Step2Data {
  erp_base_url: string;
  erp_api_key: string;
  erp_api_token: string;
  ip_blocking_requested: boolean;
}

interface Step2Result extends Step2Data {
  isp_id: string;
  client_count: number | null;
}

interface Step2Props {
  step1: Step1Data;
  onNext: (data: Step2Result) => void;
  onBack: () => void;
}

function Step2({ step1, onNext, onBack }: Step2Props) {
  const { toast } = useToast();
  const [apiCredentials, setApiCredentials] = useState(""); // formato "usuario:chave"
  const [erp_base_url, setErpBaseUrl] = useState("");
  const [ipBlocking, setIpBlocking] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validationMsg, setValidationMsg] = useState("");
  const [clientCount, setClientCount] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  // Valida "usuario:chave" — precisa ter conteúdo antes E depois do ":"
  const credentialFormatValid = /^.+:.+$/.test(apiCredentials.trim());

  const splitCredentials = () => {
    const colonIdx = apiCredentials.indexOf(":");
    if (colonIdx < 1) return { api_key: apiCredentials.trim(), api_token: "" };
    return {
      api_key: apiCredentials.substring(0, colonIdx).trim(),
      api_token: apiCredentials.substring(colonIdx + 1).trim(),
    };
  };

  const handleValidate = async () => {
    if (!erp_base_url.trim() || !apiCredentials.trim()) {
      toast({ title: "Preencha a URL e a chave de API.", variant: "destructive" });
      return;
    }
    if (!credentialFormatValid) {
      toast({ title: "Formato inválido", description: "Use o formato usuario:chave_de_api", variant: "destructive" });
      return;
    }
    setValidating(true);
    setValidated(false);
    setValidationMsg("");
    setClientCount(null);
    const { api_key, api_token } = splitCredentials();
    try {
      // Incluir JWT para evitar abuso do endpoint como relay HTTP anônimo
      const { data: sessData } = await externalSupabase.auth.getSession();
      const token = sessData?.session?.access_token;
      const res = await fetch(`${FUNCTIONS_URL}/validate-erp-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ erp_type: "ixc", base_url: erp_base_url.trim(), api_key, api_token }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setValidated(data.valid);
      setValidationMsg(data.message);
      if (data.client_count != null) setClientCount(data.client_count);
      if (!data.valid) {
        toast({ title: "Credenciais inválidas", description: data.message, variant: "destructive" });
      }
    } catch (err) {
      setValidationMsg("Erro ao validar. Verifique a URL e tente novamente.");
      toast({ title: "Erro ao validar", description: String(err), variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { api_key, api_token } = splitCredentials();
      const { data: sessData } = await externalSupabase.auth.getSession();
      const token = sessData?.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const res = await fetch(`${FUNCTIONS_URL}/onboard-create-isp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({
          isp_nome: step1.isp_nome,
          cnpj: step1.cnpj,
          instancia_isp: "ixc",
          erp_base_url: erp_base_url.trim(),
          erp_api_key: api_key,
          erp_api_token: api_token || api_key,
          ip_blocking_requested: ipBlocking,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data?.error) throw new Error(data.error);

      onNext({
        erp_base_url: erp_base_url.trim(),
        erp_api_key: api_key,
        erp_api_token: api_token,
        ip_blocking_requested: ipBlocking,
        isp_id: data.isp_id,
        client_count: clientCount,
      });
    } catch (err) {
      toast({ title: "Erro ao criar provedor", description: String(err), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const resetValidation = () => { setValidated(false); setValidationMsg(""); };

  return (
    <>
      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5 text-primary" />
            Integração IXC Provedor
          </CardTitle>
          <CardDescription>
            Conecte sua base de clientes ao painel Uniforce.{" "}
            <button
              onClick={() => setTutorialOpen(true)}
              className="text-primary underline inline-flex items-center gap-0.5 hover:opacity-80"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Como gerar minha chave API?
            </button>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">URL do seu servidor IXC *</Label>
            <Input
              value={erp_base_url}
              onChange={(e) => { setErpBaseUrl(e.target.value); resetValidation(); }}
              placeholder="https://ixc.seuprovedor.com.br"
              className="mt-1.5 h-9"
            />
          </div>

          <div>
            <Label className="text-sm">Chave de acesso à API do IXC *</Label>
            <Input
              value={apiCredentials}
              onChange={(e) => { setApiCredentials(e.target.value); resetValidation(); }}
              placeholder="155:1f6badf2d61ff35da9b62c26..."
              className="mt-1.5 h-9 font-mono text-sm"
            />
            {apiCredentials && !credentialFormatValid ? (
              <p className="text-xs text-destructive mt-1">
                Formato inválido. Use: <code className="bg-muted px-1 rounded">usuario:chave_de_api</code>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Formato: <code className="bg-muted px-1 rounded">usuario:chave_de_api</code>
              </p>
            )}
          </div>

          {/* IP Blocking */}
          <div className="flex items-start gap-3 p-3 rounded-md border bg-muted/30">
            <Switch
              id="ip-blocking"
              checked={ipBlocking}
              onCheckedChange={setIpBlocking}
            />
            <div>
              <Label htmlFor="ip-blocking" className="text-sm cursor-pointer">
                Meu servidor IXC usa restrição de acesso por IP
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ative se seu IXC só aceita conexões de IPs liberados no firewall.
              </p>
            </div>
          </div>

          {ipBlocking && (
            <div className="flex items-start gap-2 rounded-md p-3 text-sm border border-amber-200 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-amber-800">
                <p className="font-medium mb-1">Enviaremos um e-mail com os IPs para liberar</p>
                <p className="text-xs">
                  Após o cadastro, você receberá em <strong>{step1.email}</strong> as instruções
                  para liberar nosso servidor (IPv4: 31.97.82.25 / IPv6: 2a02:4780:14:ecfb::1) no firewall do IXC.
                </p>
              </div>
            </div>
          )}

          {/* Resultado da validação */}
          {validationMsg && (
            <div className={`flex items-start gap-2 rounded-md p-3 text-sm border ${
              validated
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-destructive/5 border-destructive/20 text-destructive"
            }`}>
              {validated
                ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              <div>
                <p>{validationMsg}</p>
                {validated && clientCount != null && (
                  <p className="mt-1 flex items-center gap-1 font-medium">
                    <Users className="h-3.5 w-3.5" />
                    {clientCount.toLocaleString("pt-BR")} clientes ativos identificados
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="outline"
              onClick={handleValidate}
              disabled={validating || !erp_base_url.trim() || !apiCredentials.trim() || !credentialFormatValid}
              className="w-full gap-2"
            >
              {validating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {validating ? "Validando conexão..." : "Testar Conexão"}
            </Button>

            <Button
              onClick={handleCreate}
              disabled={!validated || creating}
              className="w-full gap-2"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              {creating ? "Configurando..." : "Confirmar Integração"}
            </Button>

            <Button variant="ghost" onClick={onBack} disabled={creating} className="text-muted-foreground">
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>

      <IxcTutorialLightbox open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </>
  );
}

// ─── Tela de Transição: Conexão Confirmada ───────────────────────────────────

interface ConfirmationScreenProps {
  clientCount: number | null;
  onNext: () => void;
}

function ConfirmationScreen({ clientCount, onNext }: ConfirmationScreenProps) {
  return (
    <Card className="max-w-lg mx-auto text-center">
      <CardContent className="pt-10 pb-8 space-y-6">
        {/* Ícone animado */}
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in duration-500">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-1">Integração confirmada!</h2>
          <p className="text-muted-foreground text-sm">Sua base de dados foi conectada com sucesso.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          {clientCount != null && (
            <div className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Clientes Ativos</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{clientCount.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-muted-foreground">identificados no seu provedor</p>
            </div>
          )}

          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Prazo de Ativação</span>
            </div>
            <p className="text-2xl font-bold text-foreground">3 dias</p>
            <p className="text-xs text-muted-foreground">úteis para importação completa</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Avisaremos você por e-mail assim que os dados estiverem importados e o ambiente estiver configurado.
        </p>

        <Button onClick={onNext} className="w-full gap-2">
          Escolher Plano <ChevronRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Step 3: Plano de Pagamento ──────────────────────────────────────────────

interface Step3Props {
  ispId: string;
  onBack: () => void;
}

const PLAN_FEATURES: Record<string, string[]> = {
  "prod_U41i5VULCVGKRl": ["Dashboard Analytics", "Análise de Churn Score®", "Detecção de Inadimplência", "Suporte por e-mail"],
  "prod_U41iUfju8I1C2n": ["Dashboard de Retenção", "Churn Score® Avançado", "Régua de Inadimplência", "Alertas Automáticos", "Suporte prioritário"],
  "prod_U41i4IUixqqdnT": ["Tudo do Retention", "IA Generativa", "Support Helper N1", "Integração N8N", "Suporte dedicado"],
};

function Step3({ ispId, onBack }: Step3Props) {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  // Passa ispId para garantir que o hook esteja habilitado (novo ISP já foi criado)
  const { data: catalog, isLoading } = useStripeProducts(ispId);
  const checkout = useStripeCheckout(ispId);
  const [lockInAccepted, setLockInAccepted] = useState(false);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  const preselectedPlan = searchParams.get("plano");
  const plans = catalog?.plans ?? [];

  // Preselecionar plano via URL param
  useEffect(() => {
    if (preselectedPlan && plans.length > 0) {
      const match = plans.find((p) => p.monthly_price_id === preselectedPlan || p.id === preselectedPlan);
      if (match?.monthly_price_id) setSelectedPriceId(match.monthly_price_id);
    }
  }, [preselectedPlan, plans]);

  const handleCheckout = async (priceId: string) => {
    // Registrar aceite do lock-in de 3 meses (requer RLS UPDATE policy em isps — migration 012)
    const contractAcceptedAt = new Date().toISOString();
    const { error: updateErr } = await externalSupabase
      .from("isps")
      .update({ contract_accepted_at: contractAcceptedAt })
      .eq("isp_id", ispId);

    if (updateErr) {
      // Log para debug mas não bloqueia — o aceite é registrado como audit trail best-effort
      console.warn("contract_accepted_at update failed:", updateErr.message);
    }

    checkout.mutate(
      {
        price_id: priceId,
        success_url: `${window.location.origin}/configuracoes/perfil?tab=meus-produtos&success=true&new_account=1`,
        cancel_url: `${window.location.origin}/onboarding?step=3`,
      },
      {
        onError: (err) => {
          toast({
            title: "Erro ao iniciar pagamento",
            description: err instanceof Error ? err.message : "Tente novamente ou entre em contato com o suporte.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const today = new Date().toLocaleDateString("pt-BR");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          Escolha seu Plano
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione o plano ideal para seu provedor.
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
            const isPreselected = selectedPriceId === plan.monthly_price_id
              || (preselectedPlan && (plan.id === preselectedPlan || plan.monthly_price_id === preselectedPlan));
            // Usa features hardcoded se disponíveis; senão usa o catálogo real do Stripe
            const features = PLAN_FEATURES[plan.id] ?? plan.features ?? [];

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col cursor-pointer transition-all ${
                  isPreselected
                    ? "border-primary shadow-lg ring-2 ring-primary"
                    : isMiddle
                    ? "border-primary/50 shadow-md"
                    : "hover:border-primary/30"
                }`}
                onClick={() => setSelectedPriceId(plan.monthly_price_id ?? null)}
              >
                {isMiddle && !isPreselected && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs">Mais Popular</Badge>
                  </div>
                )}
                {isPreselected && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-green-600 text-white text-xs">Selecionado</Badge>
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Lock-in acceptance */}
      {!isLoading && plans.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-lg border bg-muted/30">
            <Checkbox
              id="lock-in"
              checked={lockInAccepted}
              onCheckedChange={(v) => setLockInAccepted(Boolean(v))}
              className="mt-0.5"
            />
            <div>
              <Label htmlFor="lock-in" className="text-sm cursor-pointer font-medium">
                Concordo com o período mínimo de 3 meses de vigência
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Assinatura iniciada em: <strong>{today}</strong>. Após o período mínimo, pode ser cancelada a qualquer momento.
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              const priceId = selectedPriceId ?? plans[1]?.monthly_price_id ?? plans[0]?.monthly_price_id;
              if (priceId) handleCheckout(priceId);
            }}
            disabled={!lockInAccepted || checkout.isPending || (!selectedPriceId && plans.length === 0)}
            className="w-full gap-2"
          >
            {checkout.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {checkout.isPending ? "Redirecionando..." : "Contratar e ir para pagamento"}
          </Button>
        </div>
      )}

      <div className="text-center mt-4">
        <Button variant="ghost" onClick={onBack} className="text-muted-foreground text-sm">
          Voltar
        </Button>
      </div>
    </div>
  );
}

// ─── Google OAuth Completion Form ────────────────────────────────────────────
// Exibido após redirect do Google OAuth: coleta dados do ISP (nome, CNPJ, telefone)

interface GoogleCompleteFormProps {
  onComplete: (data: Step1Data) => void;
}

function GoogleCompleteForm({ onComplete }: GoogleCompleteFormProps) {
  const { toast } = useToast();
  const [ispNome, setIspNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleUser, setGoogleUser] = useState<{ email: string; name: string } | null>(null);
  const [sessionChecking, setSessionChecking] = useState(true);

  // Aguarda a sessão do Google OAuth estar disponível (o token do hash é processado assincronamente)
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const check = async () => {
      const { data } = await externalSupabase.auth.getSession();
      if (cancelled) return;

      if (data.session?.user) {
        const u = data.session.user;
        setGoogleUser({
          email: u.email ?? "",
          name: u.user_metadata?.full_name ?? u.email ?? "",
        });
        setSessionChecking(false);
        return;
      }

      // Supabase pode demorar até ~2s para processar o hash do OAuth redirect
      if (++attempts < 10) {
        setTimeout(check, 300);
      } else {
        setSessionChecking(false); // timeout — mostrar erro no submit
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  const valid = ispNome.trim().length >= 2 && !sessionChecking;

  const handleSubmit = async () => {
    if (!valid) return;
    setLoading(true);
    try {
      const { data: sessData } = await externalSupabase.auth.getSession();
      const user = sessData?.session?.user;
      if (!user) throw new Error("Sessão Google não encontrada. Feche e tente novamente.");

      onComplete({
        admin_name: user.user_metadata?.full_name ?? user.email ?? "",
        isp_nome: ispNome.trim(),
        cnpj,
        email: user.email ?? "",
        phone: phone.trim(),
        password: "", // já autenticado via OAuth
      });
    } catch (err) {
      toast({ title: "Erro", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Complete seu cadastro
        </CardTitle>
        <CardDescription>
          {sessionChecking ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Conectando conta Google…
            </span>
          ) : googleUser ? (
            <span>Conta: <strong>{googleUser.email}</strong> · Preencha os dados do seu provedor.</span>
          ) : (
            "Precisamos de alguns dados do seu provedor para continuar."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm">Nome do Provedor / Razão Social *</Label>
          <Input
            value={ispNome}
            onChange={(e) => setIspNome(e.target.value)}
            placeholder="Fibra Digital Telecomunicações"
            className="mt-1.5 h-9"
          />
        </div>
        <div>
          <Label className="text-sm">CNPJ</Label>
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(cnpjMask(e.target.value))}
            placeholder="00.000.000/0001-00"
            className="mt-1.5 h-9"
          />
        </div>
        <div>
          <Label className="text-sm">Telefone</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(11) 99999-0000"
            className="mt-1.5 h-9"
          />
        </div>
        <Button onClick={handleSubmit} disabled={!valid || loading} className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
          {loading ? "Salvando..." : "Continuar para Integração"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, isLoading: authLoading } = useAuth();

  // Detectar callbacks de OAuth e confirmação de email via URL params
  const isGoogleCallback = searchParams.get("google") === "1";
  const isEmailConfirmed = searchParams.get("confirmed") === "1";

  // Redirecionar usuários já autenticados com ISP completo para o dashboard
  useEffect(() => {
    if (authLoading) return;
    if (profile?.isp_id && !isGoogleCallback && !isEmailConfirmed) {
      navigate("/", { replace: true });
    }
  }, [authLoading, profile?.isp_id, isGoogleCallback, isEmailConfirmed, navigate]);

  // "confirmation" é a tela de transição entre steps 2 e 3
  // "google-complete" é o formulário de complemento após OAuth Google
  const [step, setStep] = useState<number | "confirmation" | "google-complete">(() => {
    if (isGoogleCallback) return "google-complete";
    // Após confirmação de e-mail, restaurar step1Data do sessionStorage e ir para step 2
    if (isEmailConfirmed) {
      const saved = sessionStorage.getItem("onboarding_step1");
      if (saved) return 2;
    }
    const urlStep = parseInt(searchParams.get("step") ?? "1", 10);
    return isNaN(urlStep) ? 1 : Math.max(1, Math.min(urlStep, 3));
  });

  // Restaurar step1Data do sessionStorage após confirmação de e-mail
  const [step1Data, setStep1Data] = useState<Step1Data | null>(() => {
    if (isEmailConfirmed) {
      try {
        const saved = sessionStorage.getItem("onboarding_step1");
        if (saved) {
          sessionStorage.removeItem("onboarding_step1"); // usar uma vez
          return JSON.parse(saved) as Step1Data;
        }
      } catch { /* ignore */ }
    }
    return null;
  });
  const [step2Result, setStep2Result] = useState<Step2Result | null>(null);
  const [cameFromGoogle] = useState(() => isGoogleCallback);

  // Indicador numérico para o StepIndicator
  const indicatorStep =
    step === "confirmation" ? 2 :
    step === "google-complete" ? 1 :
    typeof step === "number" ? step : 1;

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
        <StepIndicator current={indicatorStep} />

        {step === 1 && (
          <Step1
            onNext={(data) => {
              setStep1Data(data);
              setStep(2);
            }}
          />
        )}

        {/* Google OAuth: preencher dados do ISP após login com Google */}
        {step === "google-complete" && (
          <GoogleCompleteForm
            onComplete={(data) => {
              setStep1Data(data);
              setStep(2);
            }}
          />
        )}

        {step === 2 && step1Data && (
          <Step2
            step1={step1Data}
            onNext={(result) => {
              setStep2Result(result);
              setStep("confirmation");
            }}
            onBack={() => setStep(cameFromGoogle ? "google-complete" : 1)}
          />
        )}

        {step === "confirmation" && step2Result && (
          <ConfirmationScreen
            clientCount={step2Result.client_count}
            onNext={() => setStep(3)}
          />
        )}

        {step === 3 && step2Result?.isp_id && (
          <Step3
            ispId={step2Result.isp_id}
            onBack={() => setStep("confirmation")}
          />
        )}
      </main>
    </div>
  );
}
