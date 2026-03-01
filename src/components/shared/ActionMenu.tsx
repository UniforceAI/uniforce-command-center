import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getScopedClient } from "@/integrations/supabase/scoped-client";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { useToast } from "@/hooks/use-toast";
import {
  User,
  Plus,
  Phone,
  MessageSquare,
  CreditCard,
  FileText,
  PlusCircle,
  Pencil,
  Send,
  CheckCircle,
  Loader2,
  Copy,
  Kanban,
} from "lucide-react";

export type ActionType =
  | "call"
  | "whatsapp"
  | "pix_sent"
  | "payment_promise"
  | "task_created"
  | "manual_note"
  | "os_opened"
  | "copy_pix"
  | "copy_boleto"
  | "send_treatment";

interface ActionMenuProps {
  clientId: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  variant?: "cobranca" | "risco" | "suporte";
  onActionLogged?: (action: ActionType) => void;
  onSendToTreatment?: () => void;
}

const actionConfig: Record<
  ActionType,
  { label: string; icon: React.ElementType; channel: string }
> = {
  call: { label: "Registrar Ligação", icon: Phone, channel: "phone" },
  whatsapp: { label: "Enviar WhatsApp", icon: MessageSquare, channel: "whatsapp" },
  pix_sent: { label: "Enviar PIX/2ª via", icon: CreditCard, channel: "system" },
  payment_promise: { label: "Registrar Promessa", icon: CheckCircle, channel: "phone" },
  task_created: { label: "Criar Tarefa", icon: PlusCircle, channel: "system" },
  manual_note: { label: "Anotar Observação", icon: Pencil, channel: "system" },
  os_opened: { label: "Abrir OS (ERP)", icon: FileText, channel: "system" },
  copy_pix: { label: "Copiar PIX", icon: Copy, channel: "system" },
  copy_boleto: { label: "Copiar Boleto", icon: Copy, channel: "system" },
  send_treatment: { label: "Enviar para Tratamento", icon: Kanban, channel: "system" },
};

export function ActionMenu({
  clientId,
  clientName,
  clientPhone,
  clientEmail,
  variant = "cobranca",
  onActionLogged,
  onSendToTreatment,
}: ActionMenuProps) {
  const { toast } = useToast();
  const { ispId } = useActiveIsp();
  const [isOpen, setIsOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [promiseDialogOpen, setPromiseDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<ActionType | null>(null);

  const logAction = async (
    actionType: ActionType,
    extraNotes?: string,
    metadata?: Record<string, any>
  ) => {
    setIsLoading(true);
    try {
      const client = getScopedClient(ispId);
      
      const { error } = await client.from("actions_log").insert({
        client_id: clientId,
        action_type: actionType,
        channel: actionConfig[actionType].channel,
        status: "completed",
        notes: extraNotes || null,
        isp_id: ispId,
        metadata: {
          client_name: clientName,
          client_phone: clientPhone,
          client_email: clientEmail,
          ...metadata,
        },
        created_by: null,
      });

      if (error) throw error;

      toast({
        title: "Ação registrada",
        description: `${actionConfig[actionType].label} para ${clientName || `Cliente #${clientId}`}`,
      });

      onActionLogged?.(actionType);
    } catch (error) {
      console.error("Erro ao registrar ação:", error);
      toast({
        title: "Erro ao registrar ação",
        description: "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (actionType: ActionType) => {
    setIsOpen(false);
    
    switch (actionType) {
      case "manual_note":
        setPendingAction(actionType);
        setNotes("");
        setNoteDialogOpen(true);
        break;
      case "payment_promise":
        setPendingAction(actionType);
        setNotes("");
        setPromiseDialogOpen(true);
        break;
      case "whatsapp": {
        if (clientPhone) {
          const phone = clientPhone.replace(/\D/g, "");
          const name = clientName?.split(" ")[0] || "cliente";
          const msg = variant === "suporte"
            ? encodeURIComponent(`Olá ${name}, tudo bem?\nPercebemos que estamos tendo muitos problemas. Mas fique tranquilo, estou aqui para resolvê-los de uma vez por todas. Gostaria encarecidamente de saber se o seu problema foi resolvido?`)
            : encodeURIComponent(`Olá ${name}, tudo bem? Segue seu link para pagamento via PIX. Qualquer dúvida estou à disposição!`);
          window.open(`https://wa.me/55${phone}?text=${msg}`, "_blank");
        }
        await logAction(actionType);
        break;
      }
      case "call":
        if (clientPhone) {
          window.open(`tel:${clientPhone}`, "_self");
        }
        await logAction(actionType, "Ligação registrada");
        break;
      case "copy_pix":
        toast({ title: "PIX copiado", description: "Chave PIX copiada para a área de transferência." });
        await logAction(actionType);
        break;
      case "copy_boleto":
        toast({ title: "Boleto copiado", description: "Link do boleto copiado para a área de transferência." });
        await logAction(actionType);
        break;
      case "send_treatment":
        onSendToTreatment?.();
        await logAction(actionType);
        break;
      case "os_opened":
        toast({ title: "OS aberta", description: "Ordem de serviço criada via ERP." });
        await logAction(actionType);
        break;
      default:
        await logAction(actionType);
    }
  };

  const handleNoteSubmit = async () => {
    if (pendingAction && notes.trim()) {
      await logAction(pendingAction, notes);
      setNotes("");
      setNoteDialogOpen(false);
      setPromiseDialogOpen(false);
      setPendingAction(null);
    }
  };

  const getActionsForVariant = (): ActionType[] => {
    switch (variant) {
      case "cobranca":
        return ["call", "whatsapp", "pix_sent", "copy_pix", "copy_boleto", "payment_promise", "manual_note"];
      case "risco":
        return ["call", "whatsapp", "send_treatment", "os_opened", "copy_pix", "copy_boleto", "manual_note"];
      case "suporte":
        return ["call", "whatsapp", "os_opened", "task_created", "manual_note"];
      default:
        return ["call", "whatsapp", "manual_note"];
    }
  };

  const actions = getActionsForVariant();

  return (
    <>
      <div className="flex items-center gap-0.5">
        {/* Profile button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <User className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Ver perfil</TooltipContent>
        </Tooltip>

        {/* Actions "+" dropdown */}
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary">
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Ações</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-52">
            {actions.map((actionType, index) => {
              const config = actionConfig[actionType];
              const Icon = config.icon;
              const isSeparator = actionType === "manual_note" || actionType === "send_treatment";
              return (
                <div key={actionType}>
                  {isSeparator && index > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onClick={() => handleAction(actionType)}
                    className="cursor-pointer text-xs"
                  >
                    <Icon className="h-3.5 w-3.5 mr-2" />
                    {config.label}
                  </DropdownMenuItem>
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Dialog para anotação */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Observação</DialogTitle>
            <DialogDescription>
              Cliente: {clientName || `#${clientId}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Observação</Label>
              <Textarea
                id="notes"
                placeholder="Digite sua observação..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleNoteSubmit} disabled={!notes.trim() || isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para promessa de pagamento */}
      <Dialog open={promiseDialogOpen} onOpenChange={setPromiseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Promessa de Pagamento</DialogTitle>
            <DialogDescription>
              Cliente: {clientName || `#${clientId}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="promise-notes">Detalhes da promessa</Label>
              <Textarea
                id="promise-notes"
                placeholder="Ex: Cliente prometeu pagar dia 15/01, valor R$ 200..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromiseDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleNoteSubmit} disabled={!notes.trim() || isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Registrar Promessa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Botões de ação rápida (sem menu dropdown) — DEPRECATED, use ActionMenu instead
 */
export function QuickActions({
  clientId,
  clientName,
  clientPhone,
  onActionLogged,
}: Omit<ActionMenuProps, "variant">) {
  return null; // Deprecated — use the unified ActionMenu with profile icon + "+" button
}
