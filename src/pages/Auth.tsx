import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { validateEmailDomain, createUserProfileInExternal } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function Auth() {
  const navigate = useNavigate();
  const { user, profile, isLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if already authenticated with profile
  useEffect(() => {
    if (!isLoading && user && profile) {
      navigate("/");
    }
  }, [user, profile, isLoading, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Validar domínio contra tabela isps
      const domainResult = await validateEmailDomain(email);
      if (!domainResult.valid) {
        toast.error(domainResult.error || "Domínio não autorizado.");
        setLoading(false);
        return;
      }

      // 2. Criar conta no Supabase Auth (Lovable Cloud)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
            isp_id: domainResult.isp_id,
          },
        },
      });

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      // 3. Se o usuário foi criado e confirmado imediatamente (auto-confirm),
      //    criar profile no banco externo
      if (data.user && data.session) {
        await createUserProfileInExternal(
          data.user.id,
          email,
          fullName,
          domainResult.isp_id!
        );
        toast.success(`Bem-vindo ao ${domainResult.isp_nome}!`);
      } else {
        // Email de confirmação será enviado
        toast.success("Verifique seu email para confirmar a conta!");
      }
    } catch (err: any) {
      toast.error("Erro inesperado: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Validar domínio antes de tentar login
      const domainResult = await validateEmailDomain(email);
      if (!domainResult.valid) {
        toast.error(domainResult.error || "Domínio não autorizado.");
        setLoading(false);
        return;
      }

      // 2. Login no Supabase Auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      // 3. Verificar se o profile existe no banco externo, senão criar
      if (data.user) {
        const { externalSupabase } = await import("@/integrations/supabase/external-client");
        const { data: existingProfile } = await externalSupabase
          .from("profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();

        if (!existingProfile) {
          // Profile não existe, criar
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">
            {isLogin ? "Uniforce Ops" : "Criar Conta"}
          </CardTitle>
          <CardDescription>
            {isLogin
              ? "Entre com suas credenciais corporativas"
              : "Apenas domínios autorizados podem criar conta"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={isLogin ? handleSignIn : handleSignUp} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Corporativo</Label>
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

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar Conta"}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? "Não tem conta? Criar agora" : "Já tem conta? Fazer login"}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Apenas emails de domínios autorizados são aceitos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
