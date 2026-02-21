import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Building2, Save, Mail, Phone, MapPin, FileText, User, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveIsp } from "@/hooks/useActiveIsp";

interface IspProfileData {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  email_oficial: string;
  email_financeiro: string;
  contato_oficial_nome: string;
  contato_oficial_telefone: string;
  contato_financeiro_nome: string;
  contato_financeiro_telefone: string;
  website: string;
}

const INITIAL_DATA: IspProfileData = {
  razao_social: "",
  nome_fantasia: "",
  cnpj: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  email_oficial: "",
  email_financeiro: "",
  contato_oficial_nome: "",
  contato_oficial_telefone: "",
  contato_financeiro_nome: "",
  contato_financeiro_telefone: "",
  website: "",
};

export default function PerfilISP() {
  const { ispNome } = useActiveIsp();
  const { toast } = useToast();
  const [form, setForm] = useState<IspProfileData>({
    ...INITIAL_DATA,
    nome_fantasia: ispNome,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (key: keyof IspProfileData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    // TODO: Conectar ao backend externo para persistir dados
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setHasChanges(false);
    toast({
      title: "Perfil salvo",
      description: "Os dados do ISP foram atualizados com sucesso.",
    });
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
      <Input
        type={type}
        value={form[fieldKey]}
        onChange={(e) => handleChange(fieldKey, e.target.value)}
        placeholder={placeholder}
        className="h-9"
      />
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
                  Gerencie os dados cadastrais do seu provedor
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
        {/* Dados da empresa */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Dados da Empresa
            </CardTitle>
            <CardDescription>Informações jurídicas e comerciais do provedor.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Razão Social" icon={FileText} fieldKey="razao_social" placeholder="Razão Social Ltda" colSpan />
              <Field label="Nome Fantasia" icon={Building2} fieldKey="nome_fantasia" placeholder="Meu Provedor" />
              <Field label="CNPJ" icon={FileText} fieldKey="cnpj" placeholder="00.000.000/0001-00" />
              <Field label="Website" icon={Globe} fieldKey="website" placeholder="https://meuprovedor.com.br" colSpan />
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Endereço
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Endereço" icon={MapPin} fieldKey="endereco" placeholder="Rua, número, complemento" colSpan />
              <Field label="Cidade" icon={MapPin} fieldKey="cidade" placeholder="Cidade" />
              <Field label="Estado" icon={MapPin} fieldKey="estado" placeholder="UF" />
              <Field label="CEP" icon={MapPin} fieldKey="cep" placeholder="00000-000" />
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
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-3">Contato Oficial</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome" icon={User} fieldKey="contato_oficial_nome" placeholder="Nome do responsável" />
                <Field label="Telefone" icon={Phone} fieldKey="contato_oficial_telefone" placeholder="(00) 00000-0000" />
                <Field label="E-mail Oficial" icon={Mail} fieldKey="email_oficial" placeholder="contato@provedor.com.br" colSpan />
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-3">Contato Financeiro</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Nome" icon={User} fieldKey="contato_financeiro_nome" placeholder="Nome do responsável" />
                <Field label="Telefone" icon={Phone} fieldKey="contato_financeiro_telefone" placeholder="(00) 00000-0000" />
                <Field label="E-mail Financeiro" icon={Mail} fieldKey="email_financeiro" placeholder="financeiro@provedor.com.br" colSpan />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ações */}
        <div className="flex justify-end pb-6">
          <Button onClick={handleSave} disabled={!hasChanges || saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar perfil"}
          </Button>
        </div>
      </main>
    </div>
  );
}
