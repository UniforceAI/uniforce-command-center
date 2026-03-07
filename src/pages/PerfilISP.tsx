// src/pages/PerfilISP.tsx
// Página "Meu Provedor" — hub com 5 abas
// Substitui o PerfilISP.tsx original
//
// INSTALAÇÃO:
// 1. Copiar este arquivo para src/pages/PerfilISP.tsx no repo Lovable
// 2. Copiar pasta src/components/perfil/tabs/ com os 5 componentes de aba
// 3. Copiar src/hooks/useStripeSubscription.ts, useStripeProducts.ts, useStripeInvoices.ts
// 4. Fazer deploy das Edge Functions stripe-* no Supabase

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Server, CheckCircle2, AlertCircle } from "lucide-react";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Componentes de aba
import { MeuProvedorTab } from "@/components/perfil/tabs/MeuProvedorTab";
import { ContasTab } from "@/components/perfil/tabs/ContasTab";
import { MeusProdutosTab } from "@/components/perfil/tabs/MeusProdutosTab";
import { FinanceiroBillingTab } from "@/components/perfil/tabs/FinanceiroBillingTab";
import { ImplementacaoTab } from "@/components/perfil/tabs/ImplementacaoTab";

function erpDisplayName(instancia: string): string {
  const map: Record<string, string> = {
    ispbox: "ISPBox",
    ixc: "IXC Provedor",
    mk: "MK Solutions",
    uniforce: "Uniforce",
  };
  return map[instancia?.toLowerCase()] || instancia || "—";
}

const VALID_TABS = ["meu-provedor", "contas", "meus-produtos", "financeiro", "implementacao"];

export default function PerfilISP() {
  const { ispId, ispNome, instanciaIsp } = useActiveIsp();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [leadStatus, setLeadStatus] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  // Lê aba ativa da URL (?tab=meus-produtos) e valida
  const tabFromUrl = searchParams.get("tab");
  const activeTab = VALID_TABS.includes(tabFromUrl ?? "") ? (tabFromUrl as string) : "meu-provedor";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  // Exibir toast de sucesso após retorno do Stripe Checkout
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast({
        title: "Assinatura ativada!",
        description: "Seu plano foi contratado com sucesso. Bem-vindo à Uniforce!",
      });
      // Limpar o param da URL sem reload
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("success");
      setSearchParams(newParams, { replace: true });
    }
  }, []);

  // Carregar logo
  useEffect(() => {
    if (!ispNome) return;
    const slug = ispNome.toLowerCase().replace(/\s+/g, "-");
    const { data } = supabase.storage.from("cliente-logos").getPublicUrl(`${slug}/logo`);
    fetch(data.publicUrl, { method: "HEAD" })
      .then((res) => { if (res.ok) setLogoUrl(data.publicUrl + `?t=${Date.now()}`); })
      .catch(() => {});
  }, [ispNome]);

  return (
    <div className="min-h-screen bg-background">
      {/* ─── Header ─── */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-14 w-14 rounded-full border-2 border-border bg-primary/10 shadow-sm overflow-hidden">
                {logoUrl ? (
                  <img src={logoUrl} alt={ispNome} className="h-full w-full object-cover" />
                ) : (
                  <Building2 className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Meu Provedor</h1>
                <p className="text-muted-foreground text-sm mt-0.5">{ispNome}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {instanciaIsp && (
                <Badge variant="outline" className="text-xs gap-1">
                  <Server className="h-3 w-3" />
                  {erpDisplayName(instanciaIsp)}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ─── Conteúdo com Tabs ─── */}
      <main className="container mx-auto px-6 py-6 max-w-5xl">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="grid grid-cols-5 w-full mb-6">
            <TabsTrigger value="meu-provedor" className="text-xs sm:text-sm">
              Meu Provedor
            </TabsTrigger>
            <TabsTrigger value="contas" className="text-xs sm:text-sm">
              Contas
            </TabsTrigger>
            <TabsTrigger value="meus-produtos" className="text-xs sm:text-sm">
              Meus Produtos
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs sm:text-sm">
              Financeiro
            </TabsTrigger>
            <TabsTrigger value="implementacao" className="text-xs sm:text-sm">
              Implementação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="meu-provedor">
            <MeuProvedorTab
              onProfileLoaded={({ leadStatus }) => {
                setLeadStatus(leadStatus);
                setProfileLoading(false);
              }}
            />
          </TabsContent>

          <TabsContent value="contas">
            <ContasTab />
          </TabsContent>

          <TabsContent value="meus-produtos">
            <MeusProdutosTab />
          </TabsContent>

          <TabsContent value="financeiro">
            <FinanceiroBillingTab />
          </TabsContent>

          <TabsContent value="implementacao">
            <ImplementacaoTab leadStatus={leadStatus} loading={profileLoading} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
