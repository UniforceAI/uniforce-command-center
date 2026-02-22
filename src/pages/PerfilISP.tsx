import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Save, Mail, Phone, FileText, User, Globe, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { supabase } from "@/integrations/supabase/client";

interface IspProfileData {
  nome_fantasia: string;
  cnpj: string;
  email_oficial: string;
  email_financeiro: string;
  contato_oficial_nome: string;
  contato_oficial_telefone: string;
  area: string;
  atendentes: string;
}

const EMPTY_FORM: IspProfileData = {
  nome_fantasia: "",
  cnpj: "",
  email_oficial: "",
  email_financeiro: "",
  contato_oficial_nome: "",
  contato_oficial_telefone: "",
  area: "",
  atendentes: "",
};

export default function PerfilISP() {
  const { ispNome } = useActiveIsp();
  const { toast } = useToast();
  const [form, setForm] = useState<IspProfileData>(EMPTY_FORM);
  const [originalForm, setOriginalForm] = useState<IspProfileData>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const hasChanges = JSON.stringify(form) !== JSON.stringify(originalForm);

  // Load profile from Notion on mount
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setNotFound(false);
      try {
        const { data, error } = await supabase.functions.invoke("notion-isp-profile", {
          body: { action: "read", isp_nome: ispNome },
        });
        if (error) throw error;
        if (data?.data) {
          const loaded = { ...EMPTY_FORM, ...data.data };
          setForm(loaded);
          setOriginalForm(loaded);
        } else {
          setNotFound(true);
          setForm({ ...EMPTY_FORM, nome_fantasia: ispNome });
          setOriginalForm({ ...EMPTY_FORM, nome_fantasia: ispNome });
        }
      } catch (err) {
        console.error("Failed to load profile from Notion:", err);
        toast({
          title: "Erro ao carregar perfil",
          description: "Não foi possível buscar os dados do Notion.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
    if (ispNome) loadProfile();
  }, [ispNome]);

  const handleChange = (key: keyof IspProfileData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("notion-isp-profile", {
        body: { action: "write", isp_nome: ispNome, data: form },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOriginalForm({ ...form });
      toast({
        title: "Perfil salvo",
        description: "Os dados foram atualizados no Notion com sucesso.",
      });
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível atualizar os dados no Notion.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({
    label,
    icon: Icon,
    fieldKey,
    placeholder,
    type = "text",
    colSpan = false,
  }: {
    label: string;
    icon: React.ElementType;
    fieldKey: keyof IspProfileData;
    placeholder: string;
    type?: string;
    colSpan?: boolean;
  }) => (
    <div className={colSpan ? "md:col-span-2" : ""}>
      <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Label>
      {loading ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <Input
          type={type}
          value={form[fieldKey]}
          onChange={(e) => handleChange(fieldKey, e.target.value)}
          placeholder={placeholder}
          className="h-9"
        />
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Perfil do ISP
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Dados sincronizados com o Notion
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs">
              {ispNome}
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 max-w-3xl space-y-6">
        {notFound && !loading && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
            ISP "{ispNome}" não encontrado na tabela do Notion. Os dados não serão salvos até que o registro seja criado.
          </div>
        )}

        {/* Dados da empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Dados da Empresa
            </CardTitle>
            <CardDescription>Informações comerciais do provedor.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Nome Fantasia (Cliente)" icon={Building2} fieldKey="nome_fantasia" placeholder="Meu Provedor" colSpan />
              <Field label="CNPJ" icon={FileText} fieldKey="cnpj" placeholder="00.000.000/0001-00" />
              <Field label="Área de Atuação" icon={Globe} fieldKey="area" placeholder="Região / Estado" />
              <Field label="Atendentes" icon={User} fieldKey="atendentes" placeholder="Nº de atendentes" />
            </div>
          </CardContent>
        </Card>

        {/* Contatos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Contatos
            </CardTitle>
            <CardDescription>Contatos oficiais e financeiros do provedor.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Representante Legal" icon={User} fieldKey="contato_oficial_nome" placeholder="Nome do responsável" />
              <Field label="Telefone" icon={Phone} fieldKey="contato_oficial_telefone" placeholder="(00) 00000-0000" />
              <Field label="E-mail Oficial" icon={Mail} fieldKey="email_oficial" placeholder="contato@provedor.com.br" colSpan />
              <Field label="E-mail Financeiro / Cobrança" icon={Mail} fieldKey="email_financeiro" placeholder="financeiro@provedor.com.br" colSpan />
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={!hasChanges || saving || notFound} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </div>
      </main>
    </div>
  );
}
