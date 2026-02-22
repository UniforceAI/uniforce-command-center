import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

interface IspActionsProps {
  className?: string;
}

/**
 * Componente padronizado exibido em todos os headers:
 * - Logo grande + nome do ISP abaixo
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
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      {/* Logo + Nome do ISP */}
      <div className="flex flex-col items-center gap-0.5">
        <Avatar className="h-9 w-9 border-2 border-primary/20 shadow-sm">
          {logoUrl ? <AvatarImage src={logoUrl} alt={ispNome} className="object-cover scale-[1.4]" /> : null}
          <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
            {ispNome?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        <span className="text-[10px] font-semibold text-foreground leading-none max-w-[80px] truncate text-center">
          {ispNome}
        </span>
      </div>

      {isSuperAdmin && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleTrocarCliente}
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Trocar
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
