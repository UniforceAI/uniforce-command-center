// components/FinancialProfileBanner.tsx
// Banner de completar perfil financeiro — aparece após novo cadastro ou aceite de ToS

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";

interface Props {
  onDismiss: () => void;
}

export function FinancialProfileBanner({ onDismiss }: Props) {
  const { ispId } = useActiveIsp();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!email.trim() || !ispId) return;
    setSaving(true);
    try {
      const { error } = await externalSupabase
        .from("isps")
        .update({
          financial_email: email.trim(),
          financial_contact_name: name.trim() || null,
        })
        .eq("isp_id", ispId);

      if (error) throw error;

      setSaved(true);
      toast({ title: "Perfil financeiro salvo com sucesso!" });
      setTimeout(onDismiss, 1500);
    } catch (err) {
      toast({
        title: "Erro ao salvar",
        description: String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3 mb-6">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
        <p className="text-sm text-green-800 font-medium">Perfil financeiro salvo com sucesso!</p>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 mb-1">
              Complete seu perfil financeiro
            </p>
            <p className="text-xs text-amber-700 mb-3">
              Informe o e-mail e responsável financeiro para garantir que faturas e notificações cheguem à pessoa certa.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="fin-email" className="text-xs text-amber-900">
                  E-mail financeiro *
                </Label>
                <Input
                  id="fin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="financeiro@seuprovedor.com.br"
                  className="mt-1 h-8 text-sm bg-white border-amber-300"
                />
              </div>
              <div>
                <Label htmlFor="fin-name" className="text-xs text-amber-900">
                  Responsável financeiro
                </Label>
                <Input
                  id="fin-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do responsável"
                  className="mt-1 h-8 text-sm bg-white border-amber-300"
                />
              </div>
            </div>

            <Button
              onClick={handleSave}
              disabled={!email.trim() || saving}
              size="sm"
              className="mt-3 gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="text-amber-500 hover:text-amber-700 transition-colors shrink-0"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
