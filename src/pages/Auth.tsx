import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { useAuth } from "@/contexts/AuthContext";
import { validateEmailDomain } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import uniforceLogo from "@/assets/uniforce-logo.png";

export default function Auth() {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user && profile) {
      navigate("/");
    }
  }, [user, profile, isLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const domainResult = await validateEmailDomain(email);
      if (!domainResult.valid) {
        toast.error(domainResult.error || "Domínio não autorizado.");
        setLoading(false);
        return;
      }

      // Login via Supabase EXTERNO (backend oficial)
      const { data, error } = await externalSupabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        // Garantir que profile existe no banco externo
        const { data: existingProfile } = await externalSupabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!existingProfile) {
          const { createUserProfileInExternal } = await import("@/lib/authUtils");
          await createUserProfileInExternal(
            data.user.id,
            email,
            data.user.user_metadata?.full_name || email.split("@")[0],
            domainResult.isp_id!
          );
        }
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, hsl(210 100% 6%) 0%, hsl(213 81% 20%) 100%)' }}>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={uniforceLogo} alt="Uniforce" className="h-12 mx-auto mb-2" />
          <CardDescription>
            Acesse sua conta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@provedor.com.br"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-[hsl(213,81%,54%)] to-[hsl(126,91%,65%)] hover:opacity-90 text-white font-semibold" disabled={loading}>
              {loading ? "Carregando..." : "Entrar"}
            </Button>

            <div className="text-center">
              <Link
                to="/esqueci-senha"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Esqueceu a senha?
              </Link>
            </div>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-6">
            © {new Date().getFullYear()} Uniforce
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
