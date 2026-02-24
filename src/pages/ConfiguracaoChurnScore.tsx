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
  group?: string;
}

const GATILHOS_SUPORTE: GatilhoField[] = [
  {
    key: "chamados30dBase",
    label: "+2 Chamados em 30 dias",
    description: "Pontuação base quando o cliente acumula 2 ou mais chamados nos últimos 30 dias.",
    example: "Ex: 2 chamados = 25pts (padrão)",
    defaultVal: 25, min: 0, max: 50,
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    key: "chamadoAdicional",
    label: "Chamado adicional (acima de 2)",
    description: "Pontos extras somados por cada chamado acima de 2 nos últimos 30 dias.",
    example: "Ex: 3 chamados = base + 5pts · 4 chamados = base + 10pts",
    defaultVal: 5, min: 0, max: 30,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
];

const GATILHOS_FINANCEIRO: GatilhoField[] = [
  {
    key: "finAtraso1a5",
    label: "1–5 dias em atraso",
    description: "Pontuação quando o cliente possui fatura com 1 a 5 dias de atraso.",
    example: "Ex: 3 dias em atraso = 5pts (padrão)",
    defaultVal: 5, min: 0, max: 30,
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  {
    key: "finAtraso6a15",
    label: "6–15 dias em atraso",
    description: "Pontuação quando o atraso está entre 6 e 15 dias.",
    example: "Ex: 10 dias em atraso = 10pts (padrão)",
    defaultVal: 10, min: 0, max: 40,
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    key: "finAtraso16a30",
    label: "16–30 dias em atraso",
    description: "Pontuação quando o atraso está entre 16 e 30 dias.",
    example: "Ex: 20 dias em atraso = 15pts (padrão)",
    defaultVal: 15, min: 0, max: 40,
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    key: "finAtraso31a60",
    label: "31–60 dias em atraso",
    description: "Pontuação quando o atraso está entre 31 e 60 dias.",
    example: "Ex: 45 dias em atraso = 20pts (padrão)",
    defaultVal: 20, min: 0, max: 50,
    color: "bg-red-100 text-red-800 border-red-200",
  },
  {
    key: "finAtraso60plus",
    label: "60+ dias em atraso",
    description: "Pontuação quando o atraso ultrapassa 60 dias.",
    example: "Ex: 90 dias em atraso = 25pts (padrão)",
    defaultVal: 25, min: 0, max: 50,
    color: "bg-red-100 text-red-800 border-red-200",
  },
  {
    key: "financeiroTeto",
    label: "Teto máximo do pilar Financeiro",
    description: "Limite máximo de pontos que o pilar financeiro pode contribuir ao score total.",
    example: "Independente da faixa, nunca ultrapassará este valor.",
    defaultVal: 30, min: 0, max: 60,
    color: "bg-destructive/10 text-destructive border-destructive/20",
  },
];

const GATILHOS_OUTROS: GatilhoField[] = [
  {
    key: "npsDetrator",
    label: "NPS Detrator",
    description: "Pontuação adicionada quando o cliente possui avaliação NPS como Detrator (nota ≤ 6).",
    example: "Ex: NPS nota 3 = +30pts (padrão)",
    defaultVal: 30, min: 0, max: 50,
    color: "bg-orange-100 text-orange-800 border-orange-200",
  },
  {
    key: "qualidade",
    label: "Qualidade",
    description: "Peso máximo do pilar de Qualidade de sinal/serviço no score de risco.",
    example: "Ex: problemas técnicos recorrentes = até 20pts (padrão)",
    defaultVal: 20, min: 0, max: 40,
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  {
    key: "comportamental",
    label: "Comportamental",
    description: "Peso máximo do pilar Comportamental (padrão de uso e engajamento) no score de risco.",
    example: "Ex: baixo engajamento = até 20pts (padrão)",
    defaultVal: 20, min: 0, max: 40,
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
];

function GatilhoRow({ g, value, onChange }: { g: GatilhoField; value: number; onChange: (key: keyof ChurnScoreConfig, raw: string) => void }) {
  return (
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
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number"
          min={g.min}
          max={g.max}
          value={value}
          onChange={(e) => onChange(g.key, e.target.value)}
          className="w-20 h-9 text-center font-mono font-bold text-base"
        />
        <span className="text-xs text-muted-foreground">pts</span>
      </div>
    </div>
  );
}

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
    setForm((prev) => ({ ...prev, [key]: val }));
    setHasChanges(true);
  };

  const handleSave = () => {
    setConfig(form);
    setHasChanges(false);
    toast({ title: "Configurações salvas", description: "Os pesos do Churn Risk Score foram atualizados com sucesso." });
  };

  const handleReset = () => {
    setForm({ ...CHURN_SCORE_DEFAULTS });
    resetToDefaults();
    setHasChanges(false);
    toast({ title: "Padrões restaurados", description: "Os pesos voltaram para os valores padrão do sistema." });
  };

  const exampleScore30d2 = form.chamados30dBase;
  const exampleScore30d3 = form.chamados30dBase + form.chamadoAdicional;
  const exampleScore30d4 = form.chamados30dBase + form.chamadoAdicional * 2;
  const totalMax = form.chamados30dBase + form.chamadoAdicional * 4 + form.npsDetrator + form.qualidade + form.comportamental + form.financeiroTeto;

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
                <div className="h-full rounded-full animate-pulse" style={{ width: "60%", background: "linear-gradient(90deg, hsl(213 81% 54%), hsl(126 91% 65%))" }} />
              </div>
            </div>
          </div>
        </main>
      ) : (
      <main className="container mx-auto px-6 py-6 max-w-3xl space-y-6">

        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-sm text-foreground/80">
            As pontuações definidas aqui substituem os valores padrão do sistema e são aplicadas em tempo real em toda a plataforma. As configurações ficam salvas no seu navegador.
          </p>
        </div>

        {/* Pilar Financeiro */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">💰 Pilar Financeiro — Faixas por Dias em Atraso</CardTitle>
            <CardDescription>O score financeiro é determinado exclusivamente pela faixa de dias em atraso do cliente. Modelo progressivo sem sobreposição.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {GATILHOS_FINANCEIRO.map((g, idx) => (
              <div key={g.key}>
                {idx > 0 && <Separator className="mb-6" />}
                <GatilhoRow g={g} value={form[g.key]} onChange={handleChange} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Pilar Suporte */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🎧 Pilar Suporte — Chamados</CardTitle>
            <CardDescription>Pontuação baseada na quantidade de chamados abertos pelo cliente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {GATILHOS_SUPORTE.map((g, idx) => (
              <div key={g.key}>
                {idx > 0 && <Separator className="mb-6" />}
                <GatilhoRow g={g} value={form[g.key]} onChange={handleChange} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Outros pilares */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 Outros Pilares</CardTitle>
            <CardDescription>NPS, Qualidade e Comportamental.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {GATILHOS_OUTROS.map((g, idx) => (
              <div key={g.key}>
                {idx > 0 && <Separator className="mb-6" />}
                <GatilhoRow g={g} value={form[g.key]} onChange={handleChange} />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview — Exemplo de Cálculo</CardTitle>
            <CardDescription>Como o sistema calcularia com os valores acima:</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-1">Financeiro (por faixa)</div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">1–5 dias em atraso</span>
                <span className="font-mono font-bold">+{form.finAtraso1a5} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">6–15 dias em atraso</span>
                <span className="font-mono font-bold">+{form.finAtraso6a15} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">16–30 dias em atraso</span>
                <span className="font-mono font-bold">+{form.finAtraso16a30} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">31–60 dias em atraso</span>
                <span className="font-mono font-bold">+{form.finAtraso31a60} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b">
                <span className="text-muted-foreground">60+ dias em atraso</span>
                <span className="font-mono font-bold">+{form.finAtraso60plus} pts</span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b text-destructive">
                <span>Teto Financeiro</span>
                <span className="font-mono font-bold">máx {form.financeiroTeto} pts</span>
              </div>

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-3 pb-1">Suporte</div>
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

              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-3 pb-1">Outros</div>
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
