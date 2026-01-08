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
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  MoreHorizontal,
  Phone,
  MessageSquare,
  CreditCard,
  FileText,
  PlusCircle,
  Pencil,
  Send,
  CheckCircle,
  Loader2,
} from "lucide-react";

export type ActionType =
  | "call"
  | "whatsapp"
  | "pix_sent"
  | "payment_promise"
  | "task_created"
  | "manual_note"
  | "os_opened";

interface ActionMenuProps {
  clientId: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  variant?: "cobranca" | "risco" | "suporte";
  onActionLogged?: (action: ActionType) => void;
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
  os_opened: { label: "Abrir OS", icon: FileText, channel: "system" },
};

export function ActionMenu({
  clientId,
  clientName,
  clientPhone,
  clientEmail,
  variant = "cobranca",
  onActionLogged,
}: ActionMenuProps) {
  const { toast } = useToast();
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
      const { data: session } = await supabase.auth.getSession();
      
      const { error } = await supabase.from("actions_log").insert({
        client_id: clientId,
        action_type: actionType,
        channel: actionConfig[actionType].channel,
        status: "completed",
        notes: extraNotes || null,
        metadata: {
          client_name: clientName,
          client_phone: clientPhone,
          client_email: clientEmail,
          ...metadata,
        },
        created_by: session?.session?.user?.id,
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
        setNoteDialogOpen(true);
        break;
      case "payment_promise":
        setPendingAction(actionType);
        setPromiseDialogOpen(true);
        break;
      case "whatsapp":
        if (clientPhone) {
          const phone = clientPhone.replace(/\D/g, "");
          window.open(`https://wa.me/55${phone}`, "_blank");
        }
        await logAction(actionType);
        break;
      case "call":
        if (clientPhone) {
          window.open(`tel:${clientPhone}`, "_self");
        }
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
        return ["call", "whatsapp", "pix_sent", "payment_promise", "manual_note"];
      case "risco":
        return ["call", "whatsapp", "os_opened", "task_created", "manual_note"];
      case "suporte":
        return ["call", "whatsapp", "os_opened", "task_created", "manual_note"];
      default:
        return ["call", "whatsapp", "manual_note"];
    }
  };

  const actions = getActionsForVariant();

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Ações</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-48">
          {actions.map((actionType, index) => {
            const config = actionConfig[actionType];
            const Icon = config.icon;
            return (
              <DropdownMenuItem
                key={actionType}
                onClick={() => handleAction(actionType)}
                className="cursor-pointer"
              >
                <Icon className="h-4 w-4 mr-2" />
                {config.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

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
 * Botões de ação rápida (sem menu dropdown)
 */
export function QuickActions({
  clientId,
  clientName,
  clientPhone,
  onActionLogged,
}: Omit<ActionMenuProps, "variant">) {
  const { toast } = useToast();

  const handleWhatsApp = async () => {
    if (clientPhone) {
      const phone = clientPhone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      await supabase.from("actions_log").insert({
        client_id: clientId,
        action_type: "whatsapp",
        channel: "whatsapp",
        status: "completed",
        metadata: { client_name: clientName, client_phone: clientPhone },
        created_by: session?.session?.user?.id,
      });
      onActionLogged?.("whatsapp");
    } catch (error) {
      console.error("Erro ao registrar ação:", error);
    }
  };

  const handleCall = async () => {
    if (clientPhone) {
      window.open(`tel:${clientPhone}`, "_self");
    }

    try {
      const { data: session } = await supabase.auth.getSession();
      await supabase.from("actions_log").insert({
        client_id: clientId,
        action_type: "call",
        channel: "phone",
        status: "completed",
        metadata: { client_name: clientName, client_phone: clientPhone },
        created_by: session?.session?.user?.id,
      });
      onActionLogged?.("call");
    } catch (error) {
      console.error("Erro ao registrar ação:", error);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleCall}
            disabled={!clientPhone}
          >
            <Phone className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Ligar</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleWhatsApp}
            disabled={!clientPhone}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>WhatsApp</TooltipContent>
      </Tooltip>
    </div>
  );
}
