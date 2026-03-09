// components/TermsOfServiceModal.tsx
// Modal bloqueante de Termos de Serviço — aparece no primeiro acesso do admin
// Não pode ser fechado sem aceitar; botão habilita após scroll até o fim

import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  open: boolean;
  onAccept: () => void;
  tosVersion: string;
}

// Conteúdo padrão caso o banco ainda não tenha o conteúdo completo
const FALLBACK_CONTENT = `## 1. Aceitação dos Termos

Ao contratar os serviços da Uniforce Tecnologia Ltda. ("Uniforce"), você ("Cliente") concorda com estes Termos de Serviço ("Termos"). Leia-os cuidadosamente antes de usar nossa plataforma.

## 2. Descrição dos Serviços

A Uniforce oferece uma plataforma de gestão de retenção e análise de dados para provedores de internet (ISPs), incluindo Dashboard de Retenção, Churn Score®, análise de inadimplência e módulos adicionais conforme contratados.

## 3. Período Mínimo de Vigência

A assinatura do serviço tem período mínimo de vigência de **3 (três) meses** a contar da data de ativação. Rescisões antecipadas estão sujeitas à cobrança proporcional ao período contratado.

## 4. Pagamento

O pagamento é processado mensalmente via cartão de crédito através da plataforma Stripe. Faturas vencidas podem resultar em suspensão temporária do acesso.

## 5. Confidencialidade dos Dados

A Uniforce trata todos os dados do Cliente com confidencialidade, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018). Os dados são utilizados exclusivamente para prestação dos serviços contratados.

## 6. Limitação de Responsabilidade

A Uniforce não se responsabiliza por danos indiretos, lucros cessantes ou interrupções de serviço decorrentes de fatores externos à plataforma.

## 7. Modificações

A Uniforce pode modificar estes Termos com aviso prévio de 30 dias. O uso continuado dos serviços após este período implica aceitação das modificações.

## 8. Foro

Fica eleito o foro da Comarca de São Paulo/SP para dirimir quaisquer litígios decorrentes deste contrato.`;

function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mt-5 mb-2 text-foreground">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mb-3 text-sm text-muted-foreground leading-relaxed">')
    .replace(/^/, '<p class="mb-3 text-sm text-muted-foreground leading-relaxed">')
    .replace(/$/, '</p>');
}

export function TermsOfServiceModal({ open, onAccept, tosVersion }: Props) {
  const { toast } = useToast();
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const contentLoadedRef = useRef(false);

  // Carregar conteúdo do ToS ao abrir
  const loadContent = useCallback(async () => {
    if (contentLoadedRef.current) return;
    contentLoadedRef.current = true;
    const { data } = await supabase
      .from("terms_of_service")
      .select("content")
      .eq("version", tosVersion)
      .single();
    setContent(data?.content ?? FALLBACK_CONTENT);
  }, [tosVersion]);

  // Detectar scroll até o fim
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (atBottom && !scrolledToEnd) setScrolledToEnd(true);
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      const { error } = await supabase.functions.invoke("accept-terms", {
        body: { tos_version: tosVersion },
      });
      if (error) throw error;
      onAccept();
    } catch (err) {
      toast({
        title: "Erro ao registrar aceite",
        description: "Por favor, tente novamente.",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={() => { /* bloqueado — não fecha sem aceitar */ }}
    >
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Termos de Serviço — Uniforce
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Versão {tosVersion} · Leia até o fim para aceitar
          </p>
        </DialogHeader>

        {/* Área de scroll com detecção de fim */}
        <div
          className="flex-1 overflow-y-auto border rounded-md p-4 min-h-0"
          onScroll={handleScroll}
          onLoad={() => loadContent()}
          ref={(el) => { if (el) loadContent(); }}
        >
          {content === null ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              className="prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 pt-4 space-y-3">
          {!scrolledToEnd && (
            <p className="text-xs text-center text-muted-foreground">
              Role até o fim do documento para habilitar o botão de aceite.
            </p>
          )}

          <Button
            onClick={handleAccept}
            disabled={!scrolledToEnd || accepting}
            className="w-full gap-2"
          >
            {accepting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {accepting ? "Registrando aceite..." : "Li e Aceito os Termos de Serviço"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
