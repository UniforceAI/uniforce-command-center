// src/components/perfil/tabs/MeuProvedorTab.tsx
// Aba "Meu Provedor" — dados da empresa, logotipo e contatos
// Extraído do PerfilISP.tsx original (sem alterações de lógica)

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Building2, Save, Mail, Phone, FileText, User,
  Loader2, Upload, Camera, Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { supabase } from "@/integrations/supabase/client";
import { externalSupabase } from "@/integrations/supabase/external-client";

interface IspProfileData {
  nome_fantasia: string;
  cnpj: string;
  email_oficial: string;
  email_financeiro: string;
  contato_oficial_nome: string;
  contato_oficial_telefone: string;
  area: string;
  atendentes: string;
  produto: string;
  data_pagamento: string;
  link_contrato: string;
  lead_status: string;
}

const EMPTY_FORM: IspProfileData = {
  nome_fantasia: "", cnpj: "", email_oficial: "", email_financeiro: "",
  contato_oficial_nome: "", contato_oficial_telefone: "", area: "",
  atendentes: "", produto: "", data_pagamento: "", link_contrato: "", lead_status: "",
};

interface MeuProvedorTabProps {
  onProfileLoaded?: (data: { leadStatus: string }) => void;
}

export function MeuProvedorTab({ onProfileLoaded }: MeuProvedorTabProps) {
  const { ispId, ispNome } = useActiveIsp();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<IspProfileData>(EMPTY_FORM);
  const [originalForm, setOriginalForm] = useState<IspProfileData>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [profileCount, setProfileCount] = useState<number | null>(null);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);

  useEffect(() => {
    if (!ispNome) return;

    async function loadProfile() {
      setLoading(true);
      setNotFound(false);
      try {
        const { data: sessData } = await externalSupabase.auth.refreshSession();
        const extToken =
          sessData?.session?.access_token ??
          (await externalSupabase.auth.getSession()).data.session?.access_token;

        const { data, error } = await supabase.functions.invoke("notion-isp-profile", {
          body: { action: "read", isp_nome: ispNome },
          headers: extToken ? { Authorization: `Bearer ${extToken}` } : {},
        });
        if (error) throw error;
        if (data?.data) {
          const loaded = { ...EMPTY_FORM, ...data.data };
          setForm(loaded);
          setOriginalForm(loaded);
          onProfileLoaded?.({ leadStatus: loaded.lead_status });
        } else {
          setNotFound(true);
          setForm({ ...EMPTY_FORM, nome_fantasia: ispNome });
          setOriginalForm({ ...EMPTY_FORM, nome_fantasia: ispNome });
        }
      } catch (err) {
        console.error("Failed to load profile from Notion:", err);
        toast({ title: "Erro ao carregar perfil", description: "Não foi possível buscar os dados.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    async function loadLogo() {
      const slug = ispNome.toLowerCase().replace(/\s+/g, "-");
      const { data } = supabase.storage.from("cliente-logos").getPublicUrl(`${slug}/logo`);
      try {
        const res = await fetch(data.publicUrl, { method: "HEAD" });
        if (res.ok) setLogoUrl(data.publicUrl + `?t=${Date.now()}`);
      } catch { /* sem logo */ }
    }

    async function loadProfileCount() {
      try {
        const { count } = await externalSupabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("isp_id", ispId);
        if (count !== null) setProfileCount(count);
      } catch { /* ignore */ }
    }

    loadProfile();
    loadLogo();
    loadProfileCount();
  }, [ispNome, ispId]);

  const handleChange = (key: keyof IspProfileData, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: sessData } = await externalSupabase.auth.refreshSession();
      const extToken =
        sessData?.session?.access_token ??
        (await externalSupabase.auth.getSession()).data.session?.access_token;

      const { data, error } = await supabase.functions.invoke("notion-isp-profile", {
        body: { action: "write", isp_nome: ispNome, data: form },
        headers: extToken ? { Authorization: `Bearer ${extToken}` } : {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOriginalForm({ ...form });
      toast({ title: "Perfil salvo", description: "Os dados foram atualizados com sucesso." });
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast({ title: "Erro ao salvar", description: "Não foi possível atualizar os dados.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Arquivo inválido", description: "Selecione uma imagem (PNG, JPG, SVG).", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "O logo deve ter no máximo 2MB.", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    try {
      const slug = ispNome.toLowerCase().replace(/\s+/g, "-");
      const path = `${slug}/logo`;
      const { error } = await supabase.storage.from("cliente-logos").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("cliente-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl + `?t=${Date.now()}`);
      toast({ title: "Logo atualizado", description: "O logotipo foi salvo com sucesso." });
    } catch (err) {
      console.error("Logo upload failed:", err);
      toast({ title: "Erro no upload", description: "Não foi possível enviar o logotipo.", variant: "destructive" });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {notFound && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          ISP "{ispNome}" não encontrado na tabela do Notion. Os dados não serão salvos até que o registro seja criado.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dados da Empresa */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Dados da Empresa
            </CardTitle>
            <CardDescription>Informações comerciais do provedor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 pb-3 border-b border-border/50">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="relative group shrink-0"
                disabled={uploadingLogo}
                title="Alterar logotipo"
              >
                <Avatar className="h-16 w-16 border-2 border-border shadow-sm">
                  {logoUrl ? <AvatarImage src={logoUrl} alt={ispNome} /> : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                    {ispNome?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploadingLogo ? (
                    <Loader2 className="h-4 w-4 text-primary-foreground animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 text-primary-foreground" />
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground">Logotipo</h3>
                <p className="text-xs text-muted-foreground">PNG, JPG ou SVG (máx. 2MB)</p>
                <Button variant="outline" size="sm" className="mt-1.5 gap-1.5 text-xs h-7"
                  onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}>
                  {uploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {uploadingLogo ? "Enviando..." : "Alterar"}
                </Button>
              </div>
            </div>

            <FormField label="Nome Fantasia" icon={Building2} loading={loading}>
              <Input value={form.nome_fantasia} onChange={(e) => handleChange("nome_fantasia", e.target.value)} placeholder="Meu Provedor" className="h-9" />
            </FormField>
            <FormField label="CNPJ" icon={FileText} loading={loading}>
              <Input value={form.cnpj} onChange={(e) => handleChange("cnpj", e.target.value)} placeholder="00.000.000/0001-00" className="h-9" />
            </FormField>
            <div>
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
                <Users className="h-3.5 w-3.5" />
                Contas de Acesso
              </Label>
              {loading || profileCount === null ? (
                <Skeleton className="h-9 w-full" />
              ) : (
                <div className="flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-muted/50">
                  <span className="text-sm font-medium text-foreground">{profileCount}</span>
                  <span className="text-xs text-muted-foreground">usuários ativos</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contatos */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Contatos
            </CardTitle>
            <CardDescription>Contatos oficiais e financeiros do provedor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField label="Representante Legal" icon={User} loading={loading}>
              <Input value={form.contato_oficial_nome} onChange={(e) => handleChange("contato_oficial_nome", e.target.value)} placeholder="Nome do responsável" className="h-9" />
            </FormField>
            <FormField label="Telefone" icon={Phone} loading={loading}>
              <Input value={form.contato_oficial_telefone} onChange={(e) => handleChange("contato_oficial_telefone", e.target.value)} placeholder="(00) 00000-0000" className="h-9" />
            </FormField>
            <FormField label="E-mail Oficial" icon={Mail} loading={loading}>
              <Input type="email" value={form.email_oficial} onChange={(e) => handleChange("email_oficial", e.target.value)} placeholder="contato@provedor.com.br" className="h-9" />
            </FormField>
            <FormField label="E-mail Financeiro / Cobrança" icon={Mail} loading={loading}>
              <Input type="email" value={form.email_financeiro} onChange={(e) => handleChange("email_financeiro", e.target.value)} placeholder="financeiro@provedor.com.br" className="h-9" />
            </FormField>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end pb-2">
        <Button onClick={handleSave} disabled={!hasChanges || saving || notFound} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

function FormField({ label, icon: Icon, loading, children }: {
  label: string;
  icon: React.ElementType;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      {loading ? <Skeleton className="h-9 w-full" /> : children}
    </div>
  );
}
