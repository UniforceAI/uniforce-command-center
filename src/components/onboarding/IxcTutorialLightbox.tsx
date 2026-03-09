// components/onboarding/IxcTutorialLightbox.tsx
// Lightbox com tutorial passo a passo de como gerar a chave API do IXC

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    title: "Passo 1 — Ir para Configurações",
    description: "Acesse o menu principal do IXC e clique em 'Configurações' no painel lateral.",
    image: "https://yqdqmudsnjhixtxldqwi.supabase.co/storage/v1/object/public/Uniforce/erp_tutorial/ixc/Passo%201%20-%20Ir%20para%20Configuracoes.png",
  },
  {
    title: "Passo 2 — Ir para Usuários",
    description: "No menu de configurações, acesse 'Usuários' para criar uma conta exclusiva para a Uniforce.",
    image: "https://yqdqmudsnjhixtxldqwi.supabase.co/storage/v1/object/public/Uniforce/erp_tutorial/ixc/Passo%202%20-%20Ir%20para%20Usuarios.png",
  },
  {
    title: "Passo 3 — Criar novo usuário",
    description: "Clique em 'Novo' para abrir o formulário de criação de usuário. Recomendamos criar um usuário exclusivo para a integração Uniforce.",
    image: "https://yqdqmudsnjhixtxldqwi.supabase.co/storage/v1/object/public/Uniforce/erp_tutorial/ixc/Passo%203%20-%20Criar%20Acesso%20para%20a%20Uniforce.png",
  },
  {
    title: "Passo 4 — Cadastrar usuário Uniforce",
    description: "Cadastre o usuário com o e-mail adm@uniforce.com.br e habilite a permissão de acesso à API. Salve o cadastro.",
    image: "https://yqdqmudsnjhixtxldqwi.supabase.co/storage/v1/object/public/Uniforce/erp_tutorial/ixc/Passo%204%20-%20Gerar%20Chave%20API.png",
  },
  {
    title: "Passo 5 — Copiar a chave API",
    description: "Após salvar, a chave de acesso será exibida no formato 'usuario:chave'. Copie-a e cole no campo de integração da Uniforce.",
    image: "https://yqdqmudsnjhixtxldqwi.supabase.co/storage/v1/object/public/Uniforce/erp_tutorial/ixc/Passo%205%20-%20Copiar%20chave%20API%20do%20IXC.png",
  },
];

export function IxcTutorialLightbox({ open, onClose }: Props) {
  const [current, setCurrent] = useState(0);
  const step = STEPS[current];

  const prev = () => setCurrent((c) => Math.max(0, c - 1));
  const next = () => setCurrent((c) => Math.min(STEPS.length - 1, c + 1));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden"
        // Não fechar ao clicar fora — usuário deve usar o botão X ou Fechar
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Tutorial: Como gerar a chave API do IXC</DialogTitle>

        {/* Imagem */}
        <div className="relative bg-muted aspect-video w-full overflow-hidden">
          {step.image ? (
            <img
              src={step.image}
              alt={step.title}
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Imagem do tutorial
            </div>
          )}

          {/* Fechar */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 bg-background/80 hover:bg-background rounded-full p-1.5 shadow transition-colors"
            aria-label="Fechar tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {/* Paginação dots */}
          <div className="flex justify-center gap-1.5 mb-4">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all ${
                  i === current ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30"
                }`}
                aria-label={`Ir para passo ${i + 1}`}
              />
            ))}
          </div>

          <h3 className="font-semibold text-base text-foreground mb-2">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{step.description}</p>

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={prev} disabled={current === 0} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>

            <span className="text-sm text-muted-foreground">
              {current + 1} / {STEPS.length}
            </span>

            {current < STEPS.length - 1 ? (
              <Button onClick={next} className="gap-1">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={onClose}>
                Entendi, vou configurar →
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
