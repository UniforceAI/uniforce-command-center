// src/pages/Onboarding.tsx
// Wizard de onboarding self-service para novos ISPs
// Rota: /onboarding

import { useState, useEffect, useRef } from "react";
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
  ChevronRight, Users, Clock, Heart,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useStripeProducts } from "@/hooks/useStripeProducts";
import { useStripeCheckout } from "@/hooks/useStripeSubscription";
import { IxcTutorialLightbox } from "@/components/onboarding/IxcTutorialLightbox";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";
const LOGO_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/storage/v1/object/public/Uniforce/ICON%202.png";

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

// ─── Access Granted Animation ─────────────────────────────────────────────

function AccessGrantedScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"scanning" | "granted">("scanning");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("granted"), 1200);
    const t2 = setTimeout(() => onDone(), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="text-center space-y-6">
        {phase === "scanning" ? (
          <>
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full border-2 border-primary/40 animate-ping" style={{ animationDelay: "0.2s" }} />
              <div className="absolute inset-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Server className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Verificando credenciais...</p>
              <p className="text-sm text-muted-foreground mt-1">Estabelecendo conexão segura</p>
            </div>
          </>
        ) : (
          <>
            <div className="relative mx-auto h-24 w-24">
              <div className="absolute inset-0 rounded-full bg-green-500/10 animate-in zoom-in duration-500" />
              <div className="absolute inset-0 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-16 w-16 text-green-500 animate-in zoom-in duration-300" />
              </div>
            </div>
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <p className="text-2xl font-bold text-foreground">Acesso concedido.</p>
              <p className="text-lg text-primary font-medium mt-1">Bem-vindo à era da inteligência!</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
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

  const set = (k: keyof Step1Data) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const valid =
    form.admin_name.trim().length >= 2 &&
    form.isp_nome.trim().length >= 2 &&
    form.cnpj.length >= 14 &&
    form.email.includes("@") &&
    form.phone.trim().length >= 8 &&
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
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Usuário não criado.");
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

  return (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Building2 className="h-5 w-5 text-primary" />
          Criar sua conta
        </CardTitle>
        <CardDescription>
          Cada grande jornada começa com um primeiro passo. Vamos começar a sua.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="admin_name" className="text-sm">Seu nome *</Label>
            <Input id="admin_name" value={form.admin_name} onChange={set("admin_name")}
              placeholder="João Silva" className="mt-1.5 h-9" />
          </div>
          <div>
            <Label htmlFor="phone" className="text-sm">Telefone *</Label>
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
          <Label htmlFor="cnpj" className="text-sm">CNPJ *</Label>
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
  sandboxMode?: boolean;
}

function Step2({ step1, onNext, onBack, sandboxMode }: Step2Props) {
  const { toast } = useToast();
  const [apiCredentials, setApiCredentials] = useState("");
  const [erp_base_url, setErpBaseUrl] = useState("");
  const [ipBlocking, setIpBlocking] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [integrating, setIntegrating] = useState(false);
  const [validationFailed, setValidationFailed] = useState(false);
  const [showAccessGranted, setShowAccessGranted] = useState(false);
  const clientCountRef = useRef<number | null>(null);

  const credentialFormatValid = /^.+:.+$/.test(apiCredentials.trim());

  const splitCredentials = () => {
    const colonIdx = apiCredentials.indexOf(":");
    if (colonIdx < 1) return { api_key: apiCredentials.trim(), api_token: "" };
    return {
      api_key: apiCredentials.substring(0, colonIdx).trim(),
      api_token: apiCredentials.substring(colonIdx + 1).trim(),
    };
  };

  // "Integrar" — valida E cria ISP em sequência
  const handleIntegrate = async () => {
    if (!erp_base_url.trim() || !apiCredentials.trim()) {
      toast({ title: "Preencha a URL e a chave de acesso.", variant: "destructive" });
      return;
    }
    if (!credentialFormatValid) {
      toast({ title: "Formato inválido", description: "Use o formato usuario:chave_de_api", variant: "destructive" });
      return;
    }

    setIntegrating(true);
    setValidationFailed(false);
    const { api_key, api_token } = splitCredentials();

    try {
      // Passo 1: validar credenciais
      const { data: sessData } = await externalSupabase.auth.getSession();
      const token = sessData?.session?.access_token;
      const validRes = await fetch(`${FUNCTIONS_URL}/validate-erp-credentials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ erp_type: "ixc", base_url: erp_base_url.trim(), api_key, api_token }),
      });
      if (!validRes.ok) throw new Error(`HTTP ${validRes.status}`);
      const validData = await validRes.json();

      if (!validData.valid) {
        setValidationFailed(true);
        toast({
          title: "Não foi possível conectar ao IXC",
          description: "Verifique a URL e a chave de acesso. Consulte o tutorial abaixo para gerar uma nova chave.",
          variant: "destructive",
        });
        return;
      }

      if (validData.client_count != null) clientCountRef.current = validData.client_count;

      // Passo 2: criar ISP
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");
      const createRes = await fetch(`${FUNCTIONS_URL}/onboard-create-isp`, {
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
          sandbox_mode: sandboxMode ?? false,
        }),
      });
      if (!createRes.ok) {
        const body = await createRes.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error ?? `HTTP ${createRes.status}`);
      }
      const createData = await createRes.json();
      if (createData?.error) throw new Error(createData.error);

      // Passo 3: animação encantadora → avança para Step 3
      setShowAccessGranted(true);
      // onNext será chamado quando a animação terminar (via onDone prop)
      setTimeout(() => {
        onNext({
          erp_base_url: erp_base_url.trim(),
          erp_api_key: api_key,
          erp_api_token: api_token,
          ip_blocking_requested: ipBlocking,
          isp_id: createData.isp_id,
          client_count: clientCountRef.current,
        });
      }, 2800);

    } catch (err) {
      toast({ title: "Erro ao integrar", description: String(err), variant: "destructive" });
    } finally {
      setIntegrating(false);
    }
  };

  return (
    <>
      {showAccessGranted && <AccessGrantedScreen onDone={() => {}} />}

      <Card className="max-w-lg mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Server className="h-5 w-5 text-primary" />
            Conecte seu provedor
          </CardTitle>
          <CardDescription>
            Sua base de clientes é o coração do seu negócio. Vamos conectá-la à inteligência da Uniforce.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">URL do seu servidor IXC *</Label>
            <Input
              value={erp_base_url}
              onChange={(e) => { setErpBaseUrl(e.target.value); setValidationFailed(false); }}
              placeholder="https://ixc.seuprovedor.com.br"
              className="mt-1.5 h-9"
            />
          </div>

          <div>
            <Label className="text-sm">Chave de acesso à API do IXC *</Label>
            <Input
              value={apiCredentials}
              onChange={(e) => { setApiCredentials(e.target.value); setValidationFailed(false); }}
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
            <div className="rounded-md p-3 text-sm border border-amber-200 bg-amber-50">
              <p className="font-medium text-amber-900 mb-0.5">Perfeito — cuidamos disso para você</p>
              <p className="text-xs text-amber-800">
                Após a integração, enviaremos para <strong>{step1.email}</strong> as
                instruções completas com os IPs que precisam ser liberados no firewall do seu IXC.
                É rápido e fazemos junto com você.
              </p>
            </div>
          )}

          {/* Falha de validação */}
          {validationFailed && (
            <div className="flex items-start gap-2 rounded-md p-3 text-sm border border-destructive/20 bg-destructive/5 text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Não conseguimos conectar ao seu IXC</p>
                <p className="text-xs mt-0.5">
                  Verifique a URL e a chave de acesso. Veja o tutorial abaixo para gerar uma nova chave corretamente.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <Button
              onClick={handleIntegrate}
              disabled={integrating || !erp_base_url.trim() || !apiCredentials.trim() || !credentialFormatValid}
              className="w-full gap-2"
            >
              {integrating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {integrating ? "Integrando..." : "Integrar"}
            </Button>

            <Button variant="ghost" onClick={onBack} disabled={integrating} className="text-muted-foreground">
              Voltar
            </Button>
          </div>

          {/* Tutorial link — centralizado após os botões */}
          <div className="text-center pt-1">
            <button
              onClick={() => setTutorialOpen(true)}
              className="text-sm text-primary underline hover:opacity-80 inline-flex items-center gap-1"
            >
              Como gerar minha chave de acesso?
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Frase de branding abaixo do card */}
      <p className="text-center text-sm text-muted-foreground mt-6 flex items-center justify-center gap-1.5">
        Liberte o seu time para o que importa, para o que é humano!
        <Heart className="h-3.5 w-3.5 text-rose-400/60" />
      </p>

      <IxcTutorialLightbox open={tutorialOpen} onClose={() => setTutorialOpen(false)} />
    </>
  );
}

// ─── Step 3: Plano de Pagamento ──────────────────────────────────────────────

interface Step3Props {
  ispId: string;
  clientCount: number | null;
  sandboxMode: boolean;
  onBack: () => void;
}

function Step3({ ispId, clientCount, sandboxMode, onBack }: Step3Props) {
  const { toast } = useToast();
  // testMode=true → stripe-list-products usa conta TEST sem consultar DB do ISP
  const { data: catalog, isLoading, isError, refetch } = useStripeProducts(undefined, sandboxMode);
  const checkout = useStripeCheckout(ispId);
  const [lockInAccepted, setLockInAccepted] = useState(false);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  const plans = catalog?.plans ?? [];

  useEffect(() => {
    // Preselecionar o plano mais barato (Retention) por padrão
    if (plans.length > 0 && !selectedPriceId) {
      setSelectedPriceId(plans[0].monthly_price_id ?? null);
    }
  }, [plans]);

  const handleCheckout = async (priceId: string) => {
    const contractAcceptedAt = new Date().toISOString();
    const { error: updateErr } = await externalSupabase
      .from("isps")
      .update({ contract_accepted_at: contractAcceptedAt })
      .eq("isp_id", ispId);

    if (updateErr) {
      console.warn("contract_accepted_at update failed:", updateErr.message);
    }

    checkout.mutate(
      {
        price_id: priceId,
        success_url: `${window.location.origin}/onboarding?payment=success`,
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
          {clientCount != null
            ? `Inteligência para os seus ${clientCount.toLocaleString("pt-BR")} clientes — a partir de hoje.`
            : "Selecione o plano ideal para seu provedor."}
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">Não foi possível carregar os planos</p>
            <p className="text-sm text-muted-foreground mt-1">Verifique sua conexão e tente novamente.</p>
          </div>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <Loader2 className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan, i) => {
            const isFirst = i === 0;
            const isSelected = selectedPriceId === plan.monthly_price_id;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary shadow-lg ring-2 ring-primary"
                    : "hover:border-primary/30"
                }`}
                onClick={() => setSelectedPriceId(plan.monthly_price_id ?? null)}
              >
                {isFirst && !isSelected && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs">Recomendado para começar</Badge>
                  </div>
                )}
                {isSelected && (
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
                <CardContent className="flex-1">
                  {plan.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {plan.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
              if (selectedPriceId) handleCheckout(selectedPriceId);
            }}
            disabled={!lockInAccepted || checkout.isPending || !selectedPriceId}
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

      if (++attempts < 10) {
        setTimeout(check, 300);
      } else {
        setSessionChecking(false);
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

      // Persistir phone no user_metadata (Google OAuth não inclui telefone)
      if (phone.trim()) {
        await externalSupabase.auth.updateUser({
          data: { phone: phone.trim() },
        });
      }

      onComplete({
        admin_name: user.user_metadata?.full_name ?? user.email ?? "",
        isp_nome: ispNome.trim(),
        cnpj,
        email: user.email ?? "",
        phone: phone.trim(),
        password: "",
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
          <Label className="text-sm">CNPJ *</Label>
          <Input
            value={cnpj}
            onChange={(e) => setCnpj(cnpjMask(e.target.value))}
            placeholder="00.000.000/0001-00"
            className="mt-1.5 h-9"
          />
        </div>
        <div>
          <Label className="text-sm">Telefone *</Label>
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

// ─── PostPaymentScreen ───────────────────────────────────────────────────────

function PostPaymentScreen() {
  const [email, setEmail] = useState("");
  useEffect(() => {
    externalSupabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);
  return (
    <Card className="max-w-lg mx-auto text-center">
      <CardContent className="pt-10 pb-8 space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in duration-500">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">Assinatura confirmada!</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Sua assinatura foi ativada com sucesso. Enviamos um e-mail de boas-vindas para{" "}
            <strong>{email || "seu endereço de e-mail"}</strong> com o link de primeiro acesso.
          </p>
        </div>

        <div className="rounded-lg border bg-blue-50 border-blue-200 p-4 text-left">
          <p className="text-sm font-medium text-blue-900 mb-1">Próximo passo</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            Abra o e-mail que enviamos e clique no botão <strong>"Acessar o Painel"</strong> para
            fazer seu primeiro acesso e aceitar os Termos de Serviço.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Não recebeu o e-mail? Verifique a pasta de spam ou aguarde alguns minutos.
        </p>

        <a
          href="/configuracoes/perfil?new_account=1"
          className="inline-flex items-center gap-2 text-sm text-primary underline hover:opacity-80"
        >
          Acessar o painel agora <ChevronRight className="h-3.5 w-3.5" />
        </a>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile, isLoading: authLoading } = useAuth();

  const isGoogleCallback = searchParams.get("google") === "1";
  const isPaymentSuccess = searchParams.get("payment") === "success";
  const isSandboxMode = searchParams.get("sandbox") === "1";

  useEffect(() => {
    if (authLoading) return;
    if (profile?.isp_id && !isGoogleCallback && !isPaymentSuccess) {
      navigate("/", { replace: true });
    }
  }, [authLoading, profile?.isp_id, isGoogleCallback, isPaymentSuccess, navigate]);

  const [step, setStep] = useState<number | "google-complete" | "payment-success">(() => {
    if (isPaymentSuccess) return "payment-success";
    if (isGoogleCallback) return "google-complete";
    const urlStep = parseInt(searchParams.get("step") ?? "1", 10);
    return isNaN(urlStep) ? 1 : Math.max(1, Math.min(urlStep, 3));
  });

  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [step2Result, setStep2Result] = useState<Step2Result | null>(null);
  const [cameFromGoogle] = useState(() => isGoogleCallback);

  const indicatorStep =
    step === "google-complete" ? 1 :
    step === "payment-success" ? 3 :
    typeof step === "number" ? step : 1;

  return (
    <div className="min-h-screen bg-background">
      {/* Header com logo centralizado */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex justify-center">
          <img
            src={LOGO_URL}
            alt="Uniforce"
            className="h-10 w-auto object-contain"
            onError={(e) => {
              // fallback se logo não carregar
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      </header>

      <main className="container mx-auto px-6 py-10 max-w-4xl">
        {step !== "payment-success" && <StepIndicator current={indicatorStep} />}

        {step === "payment-success" && <PostPaymentScreen />}

        {step === 1 && (
          <Step1
            onNext={(data) => {
              setStep1Data(data);
              setStep(2);
            }}
          />
        )}

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
            sandboxMode={isSandboxMode}
            onNext={(result) => {
              setStep2Result(result);
              setStep(3);
            }}
            onBack={() => setStep(cameFromGoogle ? "google-complete" : 1)}
          />
        )}

        {step === 3 && step2Result?.isp_id && (
          <Step3
            ispId={step2Result.isp_id}
            clientCount={step2Result.client_count}
            sandboxMode={isSandboxMode}
            onBack={() => setStep(2)}
          />
        )}
      </main>
    </div>
  );
}
