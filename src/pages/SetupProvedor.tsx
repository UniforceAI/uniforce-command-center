import { useState, useMemo, useEffect } from "react";
import { useChurnScoreConfig, CHURN_SCORE_DEFAULTS, ChurnScoreConfig } from "@/contexts/ChurnScoreConfigContext";
import { useRiskBucketConfig } from "@/hooks/useRiskBucketConfig";
import { useChurnData } from "@/hooks/useChurnData";
import { useChurnScore } from "@/hooks/useChurnScore";
import { getCancelados } from "@/lib/churnUnified";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { IspActions } from "@/components/shared/IspActions";
import SetupChamados from "./SetupChamados";
import {
  Settings2, RotateCcw, Save, Info, ChevronRight, ChevronLeft,
  Sparkles, CheckCircle, AlertTriangle, Lightbulb, Pencil,
  ShieldAlert, SlidersHorizontal, Headphones,
} from "lucide-react";

// ─── Types & Constants ────────────────────────────────────────────────────────

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

const GATILHOS_FINANCEIRO: GatilhoField[] = [
  { key: "finAtraso1a5",   label: "1–5 dias em atraso",    description: "Pontuação quando o cliente possui fatura com 1 a 5 dias de atraso.",    example: "Ex: 3 dias em atraso = 5pts (padrão)",    defaultVal: 5,  min: 0, max: 30, color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { key: "finAtraso6a15",  label: "6–15 dias em atraso",   description: "Pontuação quando o atraso está entre 6 e 15 dias.",                       example: "Ex: 10 dias em atraso = 10pts (padrão)",  defaultVal: 10, min: 0, max: 40, color: "bg-orange-100 text-orange-800 border-orange-200" },
  { key: "finAtraso16a30", label: "16–30 dias em atraso",  description: "Pontuação quando o atraso está entre 16 e 30 dias.",                       example: "Ex: 20 dias em atraso = 15pts (padrão)",  defaultVal: 15, min: 0, max: 40, color: "bg-orange-100 text-orange-800 border-orange-200" },
  { key: "finAtraso31a60", label: "31–60 dias em atraso",  description: "Pontuação quando o atraso está entre 31 e 60 dias.",                       example: "Ex: 45 dias em atraso = 20pts (padrão)",  defaultVal: 20, min: 0, max: 50, color: "bg-red-100 text-red-800 border-red-200" },
  { key: "finAtraso60plus",label: "60+ dias em atraso",    description: "Pontuação quando o atraso ultrapassa 60 dias.",                            example: "Ex: 90 dias em atraso = 25pts (padrão)",  defaultVal: 25, min: 0, max: 50, color: "bg-red-100 text-red-800 border-red-200" },
  { key: "financeiroTeto", label: "Teto máximo do pilar Financeiro", description: "Limite máximo de pontos que o pilar financeiro pode contribuir ao Churn Score.", example: "Independente da faixa, nunca ultrapassará este valor.", defaultVal: 30, min: 0, max: 60, color: "bg-destructive/10 text-destructive border-destructive/20" },
];

const GATILHOS_SUPORTE: GatilhoField[] = [
  { key: "chamados30dBase",  label: "+2 Chamados em 30 dias",        description: "Pontuação base quando o cliente acumula 2 ou mais chamados nos últimos 30 dias.", example: "Ex: 2 chamados = 25pts (padrão)", defaultVal: 25, min: 0, max: 50, color: "bg-orange-100 text-orange-800 border-orange-200" },
  { key: "chamadoAdicional", label: "Chamado adicional (acima de 2)", description: "Pontos extras somados por cada chamado acima de 2 nos últimos 30 dias.",           example: "Ex: 3 chamados = base + 5pts · 4 chamados = base + 10pts", defaultVal: 5, min: 0, max: 30, color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
];

const GATILHOS_OUTROS: GatilhoField[] = [
  { key: "npsDetrator",   label: "NPS Detrator",         description: "Pontuação adicionada quando o cliente possui avaliação NPS como Detrator (nota ≤ 6).",        example: "Ex: NPS nota 3 = +30pts (padrão)",              defaultVal: 30, min: 0, max: 50, color: "bg-orange-100 text-orange-800 border-orange-200" },
  { key: "qualidade",     label: "Qualidade de Sinal",   description: "Peso máximo do pilar de Qualidade de sinal/serviço no Churn Score.",                            example: "Ex: problemas técnicos recorrentes = até 20pts", defaultVal: 20, min: 0, max: 40, color: "bg-purple-100 text-purple-800 border-purple-200" },
  { key: "comportamental",label: "Comportamental",       description: "Peso máximo do pilar Comportamental (padrão de uso e engajamento) no Churn Score.",              example: "Ex: baixo engajamento = até 20pts (padrão)",     defaultVal: 20, min: 0, max: 40, color: "bg-blue-100 text-blue-800 border-blue-200" },
];

type BucketForm = { ok_max: number; alert_min: number; alert_max: number; critical_min: number };

// ─── GatilhoRow ──────────────────────────────────────────────────────────────

function GatilhoRow({ g, value, onChange }: {
  g: GatilhoField;
  value: number;
  onChange: (key: keyof ChurnScoreConfig, raw: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">{g.label}</Label>
          <Badge className={`${g.color} border text-[10px] font-mono`}>padrão: {g.defaultVal}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{g.description}</p>
        <p className="text-xs text-muted-foreground/70 italic">{g.example}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Input
          type="number" min={g.min} max={g.max} value={value}
          onChange={(e) => onChange(g.key, e.target.value)}
          className="w-20 h-9 text-center font-mono font-bold text-base"
        />
        <span className="text-xs text-muted-foreground">pts</span>
      </div>
    </div>
  );
}

// ─── ConfigRow (view mode display) ───────────────────────────────────────────

function ConfigRow({ label, value, dotColor }: { label: string; value: number; dotColor: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="font-mono font-semibold">{value} pts</span>
    </div>
  );
}

// ─── EfficiencyCard ───────────────────────────────────────────────────────────

function EfficiencyCard() {
  const { churnStatus, isLoading } = useChurnData();
  const { getScoreTotalReal } = useChurnScore();
  const { getBucket } = useRiskBucketConfig();

  const cancelados = useMemo(() => {
    return getCancelados(churnStatus).map((c) => ({
      ...c,
      churn_risk_score: getScoreTotalReal(c),
    }));
  }, [churnStatus, getScoreTotalReal]);

  const dist = useMemo(() => {
    const counts: Record<string, number> = { "CRÍTICO": 0, "ALERTA": 0, "OK": 0 };
    cancelados.forEach((c) => { counts[getBucket(c.churn_risk_score)]++; });
    const total = cancelados.length;
    return {
      critico: { qtd: counts["CRÍTICO"], pct: total > 0 ? Math.round((counts["CRÍTICO"] / total) * 100) : 0 },
      alerta:  { qtd: counts["ALERTA"],  pct: total > 0 ? Math.round((counts["ALERTA"]  / total) * 100) : 0 },
      total,
    };
  }, [cancelados, getBucket]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 flex items-center justify-center">
          <div className="h-[2px] w-24 bg-muted rounded-full overflow-hidden">
            <div className="h-full w-3/5 animate-pulse rounded-full bg-primary/40" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const alertados = dist.critico.qtd + dist.alerta.qtd;
  const eficiencia = dist.total > 0 ? Math.round((alertados / dist.total) * 100) : 0;

  const getLevel = (pct: number) => {
    if (pct >= 60) return { label: "Excelente",     color: "hsl(142 71% 45%)",        icon: Sparkles,       tip: null };
    if (pct >= 40) return { label: "Muito Bom",     color: "hsl(var(--primary))",     icon: CheckCircle,    tip: null };
    if (pct >= 20) return { label: "Bom",           color: "hsl(38 92% 50%)",         icon: CheckCircle,    tip: "Ajuste os pesos dos pilares para capturar mais sinais de risco." };
    return          { label: "Pode Melhorar", color: "hsl(var(--destructive))",  icon: AlertTriangle,  tip: "Recomendamos ativar os agentes NPS Check e/ou Smart Cobrança para clientes com deficiência acima de 50%." };
  };

  const level = getLevel(eficiencia);
  const LevelIcon = level.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" />
          Eficiência do Setup de Churn
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">% de cancelados alertados (Crítico + Alerta) — todos os períodos</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LevelIcon className="h-5 w-5" style={{ color: level.color }} />
            <span className="text-2xl font-bold">{eficiencia}%</span>
          </div>
          <Badge className="border text-xs" style={{ borderColor: level.color, color: level.color, background: `${level.color}15` }}>
            {level.label}
          </Badge>
        </div>
        <Progress value={eficiencia} className="h-3" style={{ ["--progress-color" as any]: level.color }} />
        <div className="space-y-1.5 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Crítico</span><span className="font-semibold text-foreground">{dist.critico.qtd} ({dist.critico.pct}%)</span></div>
          <div className="flex justify-between"><span>Alerta</span><span className="font-semibold text-foreground">{dist.alerta.qtd} ({dist.alerta.pct}%)</span></div>
          <div className="flex justify-between"><span>OK (não alertados)</span><span className="font-semibold text-foreground">{dist.total - alertados}</span></div>
        </div>
        {level.tip && (
          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <Lightbulb className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-yellow-800 dark:text-yellow-200 leading-relaxed">{level.tip}</p>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          {alertados} de {dist.total} cancelados foram alertados
        </p>
      </CardContent>
    </Card>
  );
}

// ─── View Mode ────────────────────────────────────────────────────────────────

function ChurnViewMode({ config, bucketForm, onEdit }: {
  config: ChurnScoreConfig;
  bucketForm: BucketForm;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Setup vigente</h2>
          <p className="text-sm text-muted-foreground">Configuração atual aplicada em todo o sistema em tempo real.</p>
        </div>
        <Button onClick={onEdit} className="gap-2 shrink-0">
          <Pencil className="h-4 w-4" />
          Customizar Experiência
        </Button>
      </div>

      <EfficiencyCard />

      {/* Pillar summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💰 Financeiro</CardTitle>
            <CardDescription className="text-xs">Faixas por dias em atraso · Teto: {config.financeiroTeto} pts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ConfigRow label="1–5 dias"   value={config.finAtraso1a5}   dotColor="bg-yellow-400" />
            <ConfigRow label="6–15 dias"  value={config.finAtraso6a15}  dotColor="bg-orange-400" />
            <ConfigRow label="16–30 dias" value={config.finAtraso16a30} dotColor="bg-orange-500" />
            <ConfigRow label="31–60 dias" value={config.finAtraso31a60} dotColor="bg-red-400" />
            <ConfigRow label="60+ dias"   value={config.finAtraso60plus} dotColor="bg-red-600" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🎧 Suporte</CardTitle>
            <CardDescription className="text-xs">Chamados recorrentes nos últimos 30 dias</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ConfigRow label="2+ chamados (base)"  value={config.chamados30dBase}  dotColor="bg-orange-400" />
            <ConfigRow label="Por chamado extra"   value={config.chamadoAdicional} dotColor="bg-yellow-400" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📊 NPS, Sinal e Comportamento</CardTitle>
            <CardDescription className="text-xs">Pesos máximos por pilar</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ConfigRow label="NPS Detrator"     value={config.npsDetrator}    dotColor="bg-orange-400" />
            <ConfigRow label="Qualidade Sinal"  value={config.qualidade}      dotColor="bg-purple-400" />
            <ConfigRow label="Comportamental"   value={config.comportamental} dotColor="bg-blue-400" />
          </CardContent>
        </Card>
      </div>

      {/* Risk bucket visualization */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🎯 Classificação de Risco</CardTitle>
          <CardDescription className="text-xs">Faixas de pontuação que determinam OK, Alerta ou Crítico</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0 h-7 rounded-full overflow-hidden text-[10px] font-bold text-center">
            <div className="bg-green-400 h-full flex items-center justify-center px-2" style={{ flex: bucketForm.ok_max }}>
              OK ≤{bucketForm.ok_max}
            </div>
            <div className="bg-yellow-400 h-full flex items-center justify-center px-2" style={{ flex: Math.max(1, bucketForm.alert_max - bucketForm.alert_min + 1) }}>
              Alerta {bucketForm.alert_min}–{bucketForm.alert_max}
            </div>
            <div className="bg-red-400 text-white h-full flex items-center justify-center px-2" style={{ flex: 100 }}>
              Crítico ≥{bucketForm.critical_min}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

interface WizardProps {
  step: 1 | 2 | 3;
  form: ChurnScoreConfig;
  bucketForm: BucketForm;
  onChangeForm: (key: keyof ChurnScoreConfig, raw: string) => void;
  onChangeBucket: (key: keyof BucketForm, raw: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const STEP_LABELS = [
  "Financeiro — Faixas por Dias em Atraso",
  "Suporte — Chamados",
  "NPS, Sinal e Comportamento",
];

function ChurnWizard({ step, form, bucketForm, onChangeForm, onChangeBucket, onNext, onBack, onSave, onCancel }: WizardProps) {
  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Passo {step} de 3 — {STEP_LABELS[step - 1]}
          </span>
          <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Cancelar
          </button>
        </div>
        <div className="flex gap-1.5">
          {([1, 2, 3] as const).map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      {/* Step 1 — Financeiro */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">💰 Financeiro — Faixas por Dias em Atraso</CardTitle>
            <CardDescription>Score financeiro determinado pela faixa de dias em atraso. Modelo progressivo sem sobreposição.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {GATILHOS_FINANCEIRO.map((g, idx) => (
              <div key={g.key}>
                {idx > 0 && <Separator className="mb-6" />}
                <GatilhoRow g={g} value={form[g.key]} onChange={onChangeForm} />
              </div>
            ))}

            <Separator />

            {/* Risk bucket thresholds */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Classificação de Risco — Pontos de Corte</Label>
                <p className="text-xs text-muted-foreground mt-1">Defina os limites que determinam se um cliente é OK, Alerta ou Crítico.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border-2 border-green-200 bg-green-50 dark:bg-green-900/10 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                    <Label className="text-xs font-bold text-green-800 dark:text-green-400">OK</Label>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>0 –</span>
                    <Input type="number" min={0} max={499} value={bucketForm.ok_max}
                      onChange={(e) => onChangeBucket("ok_max", e.target.value)}
                      className="w-16 h-8 text-center font-mono font-bold text-sm" />
                    <span>pts</span>
                  </div>
                </div>
                <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <Label className="text-xs font-bold text-yellow-800 dark:text-yellow-400">Alerta</Label>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Input type="number" min={1} max={499} value={bucketForm.alert_min}
                      onChange={(e) => onChangeBucket("alert_min", e.target.value)}
                      className="w-14 h-8 text-center font-mono text-xs" />
                    <span>a</span>
                    <Input type="number" min={1} max={499} value={bucketForm.alert_max}
                      onChange={(e) => onChangeBucket("alert_max", e.target.value)}
                      className="w-14 h-8 text-center font-mono text-xs" />
                  </div>
                </div>
                <div className="rounded-lg border-2 border-red-200 bg-red-50 dark:bg-red-900/10 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <Label className="text-xs font-bold text-red-800 dark:text-red-400">Crítico</Label>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>≥</span>
                    <Input type="number" min={1} max={500} value={bucketForm.critical_min}
                      onChange={(e) => onChangeBucket("critical_min", e.target.value)}
                      className="w-16 h-8 text-center font-mono font-bold text-sm" />
                    <span>pts</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2 — Suporte */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">🎧 Suporte — Chamados</CardTitle>
            <CardDescription>Pontuação baseada na quantidade de chamados abertos pelo cliente nos últimos 30 dias.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {GATILHOS_SUPORTE.map((g, idx) => (
              <div key={g.key}>
                {idx > 0 && <Separator className="mb-6" />}
                <GatilhoRow g={g} value={form[g.key]} onChange={onChangeForm} />
              </div>
            ))}
            <Separator />
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">2 chamados em 30 dias</span><span className="font-mono font-bold">+{form.chamados30dBase} pts</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">3 chamados em 30 dias</span><span className="font-mono font-bold">+{form.chamados30dBase + form.chamadoAdicional} pts</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">4 chamados em 30 dias</span><span className="font-mono font-bold">+{form.chamados30dBase + form.chamadoAdicional * 2} pts</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3 — NPS, Sinal e Comportamento */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">📊 NPS, Sinal e Comportamento</CardTitle>
            <CardDescription>Pesos máximos de cada pilar qualitativo no Churn Score do cliente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {GATILHOS_OUTROS.map((g, idx) => (
              <div key={g.key}>
                {idx > 0 && <Separator className="mb-6" />}
                <GatilhoRow g={g} value={form[g.key]} onChange={onChangeForm} />
              </div>
            ))}
            <Separator />
            <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Churn Score máximo estimado</p>
              <p className="text-2xl font-bold font-mono text-destructive">
                {form.chamados30dBase + form.chamadoAdicional * 4 + form.npsDetrator + form.qualidade + form.comportamental + form.financeiroTeto} pts
              </p>
              <p className="text-xs text-muted-foreground">Soma de todos os pilares no pior cenário possível.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2 pb-2">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Cancelar
          </Button>
          {step > 1 && (
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
          )}
        </div>
        {step < 3 ? (
          <Button onClick={onNext} className="gap-2">
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={onSave} className="gap-2">
            <Save className="h-4 w-4" />
            Salvar Configuração
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── ChurnSetupTab ────────────────────────────────────────────────────────────

function ChurnSetupTab() {
  const { config, setConfig, resetToDefaults } = useChurnScoreConfig();
  const { config: bucketConfig, saveConfig: saveBucketConfig, isLoading: bucketLoading } = useRiskBucketConfig();
  const { toast } = useToast();

  const [mode, setMode] = useState<"view" | "wizard">("view");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<ChurnScoreConfig>({ ...config });
  const [bucketForm, setBucketForm] = useState<BucketForm>({
    ok_max: bucketConfig.ok_max, alert_min: bucketConfig.alert_min,
    alert_max: bucketConfig.alert_max, critical_min: bucketConfig.critical_min,
  });

  useEffect(() => { setForm({ ...config }); }, [config]);
  useEffect(() => {
    if (!bucketLoading) {
      setBucketForm({ ok_max: bucketConfig.ok_max, alert_min: bucketConfig.alert_min, alert_max: bucketConfig.alert_max, critical_min: bucketConfig.critical_min });
    }
  }, [bucketLoading, bucketConfig]);

  const handleChangeForm = (key: keyof ChurnScoreConfig, raw: string) => {
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleChangeBucket = (key: keyof BucketForm, raw: string) => {
    const val = parseInt(raw, 10);
    if (isNaN(val) || val < 0 || val > 500) return;
    setBucketForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSaveAll = async () => {
    setConfig(form);
    const fixed = { ...bucketForm };
    if (fixed.alert_min <= fixed.ok_max)       fixed.alert_min   = fixed.ok_max + 1;
    if (fixed.alert_max < fixed.alert_min)      fixed.alert_max   = fixed.alert_min;
    if (fixed.critical_min <= fixed.alert_max)  fixed.critical_min = fixed.alert_max + 1;
    try {
      await saveBucketConfig(fixed);
      setBucketForm(fixed);
      toast({ title: "Configuração salva", description: "O Churn Score foi atualizado com sucesso em todo o sistema." });
      setMode("view");
      setStep(1);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleCancel = () => {
    setForm({ ...config });
    setBucketForm({ ok_max: bucketConfig.ok_max, alert_min: bucketConfig.alert_min, alert_max: bucketConfig.alert_max, critical_min: bucketConfig.critical_min });
    setMode("view");
    setStep(1);
  };

  if (mode === "view") {
    return <ChurnViewMode config={form} bucketForm={bucketForm} onEdit={() => setMode("wizard")} />;
  }

  return (
    <ChurnWizard
      step={step}
      form={form}
      bucketForm={bucketForm}
      onChangeForm={handleChangeForm}
      onChangeBucket={handleChangeBucket}
      onNext={() => setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)}
      onBack={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
      onSave={handleSaveAll}
      onCancel={handleCancel}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SetupProvedor() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Setup do Provedor
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Personalize as métricas e experiências de monitoramento do seu provedor
                </p>
              </div>
            </div>
            <IspActions />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6 max-w-4xl">
        <Tabs defaultValue="churn">
          <TabsList className="mb-6">
            <TabsTrigger value="churn" className="gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Setup de Churn
            </TabsTrigger>
            <TabsTrigger value="chamados" className="gap-2">
              <Headphones className="h-4 w-4" />
              Setup de Chamados
            </TabsTrigger>
          </TabsList>

          <TabsContent value="churn">
            <ChurnSetupTab />
          </TabsContent>

          <TabsContent value="chamados">
            <SetupChamados inline />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
