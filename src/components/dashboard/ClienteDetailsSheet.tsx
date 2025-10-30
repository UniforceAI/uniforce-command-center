import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Chamado } from "@/types/chamado";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Calendar, Clock, User, Building2, Tag, MapPin, AlertCircle, TrendingUp } from "lucide-react";

interface ClienteDetailsSheetProps {
  chamado: Chamado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ClienteDetailsSheet({ chamado, open, onOpenChange }: ClienteDetailsSheetProps) {
  if (!chamado) return null;

  const getUrgenciaVariant = (urgencia: string) => {
    switch (urgencia) {
      case "Alta":
        return "destructive";
      case "Média":
        return "warning";
      default:
        return "secondary";
    }
  };

  const chamadosAnteriores = chamado["Chamados Anteriores"]
    ? chamado["Chamados Anteriores"].split("\n").filter(Boolean)
    : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Detalhes do Cliente</SheetTitle>
          <SheetDescription>
            ID: {chamado["ID Cliente"]} | Protocolo: {chamado.Protocolo}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status e Urgência */}
          <div className="flex gap-2">
            <Badge variant="outline">{chamado.Status}</Badge>
            <Badge className={getUrgenciaVariant(chamado.Urgência) === "destructive" ? "bg-destructive" : getUrgenciaVariant(chamado.Urgência) === "warning" ? "bg-warning" : ""}>
              {chamado.Urgência}
            </Badge>
            <Badge variant="secondary">{chamado.Classificação}</Badge>
          </div>

          {/* Informações Principais */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Solicitante</p>
                <p className="text-sm text-muted-foreground">{chamado.Solicitante}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <User className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Responsável</p>
                <p className="text-sm text-muted-foreground">{chamado.Responsável}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Setor</p>
                <p className="text-sm text-muted-foreground">{chamado.Setor}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Tag className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Categoria</p>
                <p className="text-sm text-muted-foreground">{chamado.Categoria}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Origem</p>
                <p className="text-sm text-muted-foreground">{chamado.Origem}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Motivo do Contato</p>
                <p className="text-sm text-muted-foreground">{chamado["Motivo do Contato"]}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Datas e Tempos */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Data de Abertura</p>
                <p className="text-sm text-muted-foreground">{chamado["Data de Abertura"]}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Última Atualização</p>
                <p className="text-sm text-muted-foreground">{chamado["Última Atualização"]}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Tempo de Atendimento</p>
                <p className="text-sm text-muted-foreground">{chamado["Tempo de Atendimento"]}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">Dias desde Último Chamado</p>
                <p className="text-sm text-muted-foreground">{chamado["Dias desde Último Chamado"]} dias</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Insights */}
          <div>
            <h4 className="text-sm font-medium mb-2">💡 Insights</h4>
            <p className="text-sm text-muted-foreground">{chamado.Insight}</p>
          </div>

          {/* Chamados Anteriores */}
          {chamadosAnteriores.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">📋 Histórico de Chamados</h4>
                <div className="space-y-2">
                  {chamadosAnteriores.map((item, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
