// components/TermsOfServiceModal.tsx
// Modal bloqueante de Termos de Serviço — aparece no primeiro acesso do admin.
// Não pode ser fechado sem aceitar; botão habilita somente após scroll até o fim.
// IMPORTANTE: usa externalSupabase (yqdqmudsnjhixtxldqwi) para dados e JWT.

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { externalSupabase } from "@/integrations/supabase/external-client";

const FUNCTIONS_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co/functions/v1";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

interface Props {
  open: boolean;
  onAccept: () => void;
  tosVersion: string;
}

const FALLBACK_CONTENT = `1. Aceitação dos Termos

Ao contratar os serviços da Uniforce Tecnologia Ltda. ("Uniforce"), você ("Cliente") concorda com estes Termos de Serviço ("Termos"). Leia-os cuidadosamente antes de usar nossa plataforma.

2. Período Mínimo de Vigência

A assinatura do serviço tem período mínimo de vigência de 3 (três) meses a contar da data de ativação. Rescisões antecipadas estão sujeitas à cobrança proporcional ao período contratado.

3. Pagamento

O pagamento é processado mensalmente via cartão de crédito ou boleto. Faturas vencidas podem resultar em suspensão temporária do acesso.

4. Confidencialidade dos Dados

A Uniforce trata todos os dados do Cliente com confidencialidade, em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).

5. Limitação de Responsabilidade

A Uniforce não se responsabiliza por danos indiretos, lucros cessantes ou interrupções de serviço decorrentes de fatores externos à plataforma.

6. Foro

Fica eleito o foro da Comarca de Florianópolis/SC para dirimir quaisquer litígios decorrentes deste contrato.`;

/**
 * Renderiza conteúdo como HTML para exibição no modal de ToS.
 * Suporta dois formatos:
 * - Markdown com ## para títulos e **negrito**
 * - Texto simples com seções numeradas (1. Título, 2. Título, ...)
 */
function renderContent(text: string): string {
  const parts: string[] = [];

  for (const block of text.split(/\n\n+/)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;

    const first = lines[0];

    // Markdown heading: ## Título
    if (first.startsWith("## ")) {
      const title = first.slice(3).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      parts.push(`<h2 class="text-base font-semibold mt-6 mb-2 text-foreground">${title}</h2>`);
      for (const l of lines.slice(1)) {
        parts.push(`<p class="mb-2 text-sm text-muted-foreground leading-relaxed">${l.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")}</p>`);
      }
      continue;
    }

    // Numbered section: "1. Título", "12. Título"
    if (/^\d+\.\s+\S/.test(first)) {
      parts.push(`<h2 class="text-base font-semibold mt-6 mb-2 text-foreground">${first}</h2>`);
      if (lines.length > 1) {
        parts.push(`<p class="mb-3 text-sm text-muted-foreground leading-relaxed">${lines.slice(1).join(" ")}</p>`);
      }
      continue;
    }

    // ALL-CAPS title line (e.g. "TERMOS DE SERVIÇO (Terms of Service)")
    const stripped = first.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
    if (stripped === stripped.toUpperCase() && stripped.length > 10 && /[A-Z]/.test(stripped)) {
      parts.push(`<h1 class="text-lg font-bold mb-1 text-foreground">${first}</h1>`);
      for (const l of lines.slice(1)) {
        parts.push(`<p class="mb-2 text-sm text-muted-foreground">${l}</p>`);
      }
      continue;
    }

    // Process lines within a block individually
    for (const line of lines) {
      const words = line.trim().split(/\s+/);
      // Short standalone term (≤5 words, no colon, no digit start) = definition label
      if (words.length <= 5 && !line.includes(":") && !/^\d/.test(line)) {
        parts.push(`<p class="font-semibold text-sm text-foreground mt-3 mb-0.5">${line}</p>`);
      } else {
        const html = line.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
        parts.push(`<p class="mb-2 text-sm text-muted-foreground leading-relaxed">${html}</p>`);
      }
    }
  }

  return parts.join("");
}

export function TermsOfServiceModal({ open, onAccept, tosVersion }: Props) {
  const { toast } = useToast();
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [content, setContent] = useState<string | null>(null);

  // Carregar conteúdo via useEffect (evita múltiplas chamadas)
  useEffect(() => {
    if (!open || !tosVersion) return;
    let cancelled = false;
    setContent(null);
    externalSupabase
      .from("terms_of_service")
      .select("content")
      .eq("version", tosVersion)
      .single()
      .then(({ data }) => {
        if (!cancelled) setContent(data?.content ?? FALLBACK_CONTENT);
      });
    return () => { cancelled = true; };
  }, [open, tosVersion]);

  // Resetar scroll ao reabrir
  useEffect(() => {
    if (open) setScrolledToEnd(false);
  }, [open]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (atBottom && !scrolledToEnd) setScrolledToEnd(true);
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      // JWT da sessão Uniforce (externalSupabase)
      const { data: sessData } = await externalSupabase.auth.getSession();
      const token = sessData?.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const res = await fetch(`${FUNCTIONS_URL}/accept-terms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          apikey: ANON_KEY,
        },
        body: JSON.stringify({ tos_version: tosVersion }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string })?.error ?? `HTTP ${res.status}`);
      }
      onAccept();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Tente novamente.";
      toast({ title: "Erro ao registrar aceite", description: msg, variant: "destructive" });
    } finally {
      setAccepting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* bloqueado — não fecha sem aceitar */ }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Termos de Serviço — Uniforce
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            Versão {tosVersion} · Role até o fim para aceitar
          </p>
        </DialogHeader>

        {/* Área de scroll com detecção do fim */}
        <div
          className="flex-1 overflow-y-auto px-6 py-4 min-h-0"
          onScroll={handleScroll}
        >
          {content === null ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div
              className="max-w-none"
              dangerouslySetInnerHTML={{ __html: renderContent(content) }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t space-y-3">
          {!scrolledToEnd && content !== null && (
            <p className="text-xs text-center text-muted-foreground">
              ↓ Role até o fim do documento para habilitar o aceite
            </p>
          )}
          <Button
            onClick={handleAccept}
            disabled={!scrolledToEnd || accepting || content === null}
            className="w-full gap-2"
          >
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {accepting ? "Registrando aceite..." : "Li e Aceito os Termos de Serviço"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
