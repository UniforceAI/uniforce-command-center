// src/components/perfil/tabs/ImplementacaoTab.tsx
// Aba "Implementação" — status de implementação da plataforma

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Circle, Rocket } from "lucide-react";

const STEP_LABELS = ["Não iniciado", "Em implantação", "Concluído"];
const STEP_PROGRESS = [0, 50, 100];

function statusToStep(status: string): number {
  const s = status?.toLowerCase().trim() || "";
  if (s === "concluído" || s === "concluido") return 2;
  if (s === "em andamento") return 1;
  return 0;
}

interface ImplementacaoTabProps {
  leadStatus: string;
  loading: boolean;
}

export function ImplementacaoTab({ leadStatus, loading }: ImplementacaoTabProps) {
  const step = statusToStep(leadStatus);

  const milestones = [
    { label: "Onboarding inicial", done: step >= 1 },
    { label: "Configuração de integrações ERP", done: step >= 1 },
    { label: "Implantação dos workflows", done: step >= 1 },
    { label: "Treinamento da equipe", done: step >= 2 },
    { label: "Go-live e suporte ativo", done: step >= 2 },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Status principal */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-primary" />
              Status de Implementação
            </CardTitle>
            {!loading && (
              <Badge
                variant="outline"
                className={
                  step === 2
                    ? "bg-green-500/15 text-green-700 border-green-200"
                    : step === 1
                    ? "bg-blue-500/15 text-blue-700 border-blue-200"
                    : "bg-gray-500/15 text-gray-600 border-gray-200"
                }
              >
                {STEP_LABELS[step]}
              </Badge>
            )}
          </div>
          <CardDescription>
            Acompanhe o progresso da sua implementação com a equipe Uniforce.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <>
              <div className="flex justify-between text-xs text-muted-foreground">
                {STEP_LABELS.map((label, i) => (
                  <span key={label} className={i <= step ? "text-primary font-semibold" : ""}>
                    {label}
                  </span>
                ))}
              </div>
              <Progress value={STEP_PROGRESS[step]} className="h-2.5" />
              <p className="text-sm text-muted-foreground">
                {step === 0 && "A implementação ainda não foi iniciada. Entre em contato com seu gerente de sucesso."}
                {step === 1 && "Implementação em andamento — acompanhe o progresso com seu gerente de sucesso."}
                {step === 2 && "Implementação concluída — serviço entregue e estável."}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Milestones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Etapas do Processo</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <ul className="space-y-3">
              {milestones.map((milestone, i) => (
                <li key={i} className="flex items-center gap-3">
                  {milestone.done ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : step === 1 && i < 3 ? (
                    <Clock className="h-4 w-4 text-blue-400 shrink-0 animate-pulse" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  )}
                  <span
                    className={`text-sm ${
                      milestone.done
                        ? "text-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {milestone.label}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
