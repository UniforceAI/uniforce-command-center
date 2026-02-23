import { useState, useEffect } from "react";
import { useChurnScoreConfig, CHURN_SCORE_DEFAULTS, ChurnScoreConfig } from "@/contexts/ChurnScoreConfigContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings2, RotateCcw, Save, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GatilhoField {
  key: keyof ChurnScoreConfig;
  label: string;
  description: string;
  example: string;
  defaultVal: number;
  min: number;
  max: number;
  color: string;
}

const GATILHOS: GatilhoField[] = [
  {
    key: "chamados30dBase",
    label: "+2 Chamados em 30 dias",
    description: "Pontuação base quando o cliente acumula 2 ou mais chamados nos últimos 30 dias.",
    example: "Ex: 2 chamados = 25pts (padrão)",
    defaultVal: 25,
    min: 0,
    max: 50,
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    key: "chamadoAdicional",
    label: "Chamado adicional (acima de 2)",
    description: "Pontos extras somados por cada chamado acima de 2 nos últimos 30 dias.",
    example: "Ex: 3 chamados = base + 5pts · 4 chamados = base + 10pts",
    defaultVal: 5,
    min: 0,
    max: 30,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  {
    key: "faturaAtrasada",
    label: "Fatura atrasada",
    description: "Peso máximo do pilar Financeiro — ativado quando o cliente possui faturas em atraso.",
    example: "Ex: cliente inadimplente = até 25pts (padrão). Escalonado conforme dias de atraso.",
    defaultVal: 25,
    min: 0,
    max: 50,
    color: "bg-red-100 text-red-800 border-red-200",
  },
  {
    key: "npsDetrator",
    label: "NPS Detrator",
    description: "Pontuação adicionada quando o cliente possui avaliação NPS como Detrator (nota ≤ 6).",
    example: "Ex: NPS nota 3 = +30pts (padrão)",
    defaultVal: 30,
    min: 0,
    max: 50,
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    key: "qualidade",
    label: "Qualidade",
    description: "Peso máximo do pilar de Qualidade de sinal/serviço no score de risco.",
    example: "Ex: problemas técnicos recorrentes = até 20pts (padrão)",
    defaultVal: 20,
    min: 0,
    max: 40,
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  {
    key: "comportamental",
    label: "Comportamental",
    description: "Peso máximo do pilar Comportamental (padrão de uso e engajamento) no score de risco.",
    example: "Ex: baixo engajamento = até 20pts (padrão)",
    defaultVal: 20,
    min: 0,
    max: 40,
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
];

export default function ConfiguracaoChurnScore() {
  const { config, setConfig, resetToDefaults } = useChurnScoreConfig();
  const { toast } = useToast();
  const [form, setForm] = useState<ChurnScoreConfig>({ ...config });
  const [hasChanges, setHasChanges] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const handleChange = (key: keyof ChurnScoreConfig, raw: string) => {
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    const updated = { ...form, [key]: val };
    setForm(updated);
    setHasChanges(true);
  };

  const handleSave = () => {
    setConfig(form);
    setHasChanges(false);
    toast({
      title: "Configurações salvas",
      description: "Os pesos do Churn Risk Score foram atualizados com sucesso.",
    });
  };

  const handleReset = () => {
    setForm({ ...CHURN_SCORE_DEFAULTS });
    resetToDefaults();
    setHasChanges(false);
    toast({
      title: "Padrões restaurados",
      description: "Os pesos voltaram para os valores padrão do sistema.",
    });
  };

  const exampleScore30d2 = form.chamados30dBase;
  const exampleScore30d3 = form.chamados30dBase + form.chamadoAdicional;
  const exampleScore30d4 = form.chamados30dBase + form.chamadoAdicional * 2;
  const totalMax = form.chamados30dBase + form.chamadoAdicional * 4 + form.npsDetrator + form.qualidade + form.comportamental + form.faturaAtrasada;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Ajustar Churn Risk Score</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Configure os pesos de cada gatilho de risco — o sistema recalculará os scores automaticamente
              </p>
            </div>
          </div>
        </div>
      </header>

      {pageLoading ? (
        <main className="container mx-auto px-6 py-6 max-w-3xl">
          <div className="flex flex-col items-center justify-center min-h-[40vh]">
            <div className="w-48">
              <div className="h-[2px] bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full animate-pulse"
                  style={{
                    width: "60%",
                    background: "linear-gradient(90deg, hsl(213 81% 54%), hsl(126 91% 65%))",
                  }}
                />
              </div>
            </div>
          </div>
        </main>
      ) : (
      <main className="container mx-auto px-6 py-6 max-w-3xl space-y-6">

        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/80">
            As pontuações definidas aqui substituem os valores padrão do sistema e são aplicadas em tempo real em toda a plataforma (Clientes em Risco, Churn Analytics, etc.). As configurações ficam salvas no seu navegador.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gatilhos e Pesos</CardTitle>
            <CardDescription>Defina a pontuação de cada fator de risco conforme a realidade do seu negócio.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {GATILHOS.map((g, idx) => (
              <div key={g.key}>
                {idx > 0 && <Separator className="mb-6" />}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-semibold">{g.label}</Label>
                      <Badge className={`${g.color} border text-[10px] font-mono`}>
                        padrão: {g.defaultVal}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{g.description}</p>
                    <p className="text-xs text-muted-foreground/70 italic">{g.example}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={g.min}
                        max={g.max}
                        value={form[g.key]}
                        onChange={(e) => handleChange(g.key, e.target.value)}
                        className="w-20 h-9 text-center font-mono font-bold text-base"
                      />
                      <span className="text-xs text-muted-foreground">pts</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview — Exemplo de Cálculo</CardTitle>
            <CardDescription>Como o sistema calcularia com os valores acima:</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Fatura atrasada (pilar financeiro)</span>
                <span className="font-mono font-bold">até {form.faturaAtrasada} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">2 chamados em 30 dias</span>
                <span className="font-mono font-bold">+{exampleScore30d2} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">3 chamados em 30 dias</span>
                <span className="font-mono font-bold">+{exampleScore30d3} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">4 chamados em 30 dias</span>
                <span className="font-mono font-bold">+{exampleScore30d4} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">NPS Detrator (nota ≤ 6)</span>
                <span className="font-mono font-bold">+{form.npsDetrator} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">Qualidade (máx)</span>
                <span className="font-mono font-bold">+{form.qualidade} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5">
                <span className="text-muted-foreground">Comportamental (máx)</span>
                <span className="font-mono font-bold">+{form.comportamental} pts</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t-2 mt-2">
                <span className="font-semibold">Score máximo possível (estimado)</span>
                <span className="font-mono font-bold text-lg text-destructive">{totalMax}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between pb-6">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restaurar padrões
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar configurações
          </Button>
        </div>
      </main>
      )}
    </div>
  );
}
