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

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await externalSupabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) {
        toast.error("Erro ao conectar com Google: " + error.message);
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

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Entrar com Google
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
