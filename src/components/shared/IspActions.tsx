import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, RefreshCcw, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface IspActionsProps {
  className?: string;
}

/**
 * Componente padronizado exibido em todos os headers:
 * - Logo + Badge com nome do ISP
 * - Botão "Trocar Cliente" (apenas super admins)
 * - Botão "Sair"
 */
export function IspActions({ className }: IspActionsProps) {
  const navigate = useNavigate();
  const { signOut, isSuperAdmin, clearSelectedIsp } = useAuth();
  const { ispNome } = useActiveIsp();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!ispNome) return;
    const slug = ispNome.toLowerCase().replace(/\s+/g, "-");
    const { data } = supabase.storage.from("cliente-logos").getPublicUrl(`${slug}/logo`);
    fetch(data.publicUrl, { method: "HEAD" })
      .then((res) => {
        if (res.ok) setLogoUrl(data.publicUrl + `?t=${Date.now()}`);
      })
      .catch(() => {});
  }, [ispNome]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const handleTrocarCliente = () => {
    clearSelectedIsp();
    navigate("/selecionar-cliente");
  };

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <Badge variant="outline" className="text-xs font-medium px-2 py-0.5 border-primary/30 text-primary gap-1.5">
        <Avatar className="h-4 w-4">
          {logoUrl ? <AvatarImage src={logoUrl} alt={ispNome} /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-[8px] font-bold">
            {ispNome?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        {ispNome}
      </Badge>

      {isSuperAdmin && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTrocarCliente}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Trocar Cliente
        </Button>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair
      </Button>
    </div>
  );
}
