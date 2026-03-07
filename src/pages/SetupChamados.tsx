import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Settings2, Save, RotateCcw, Info, Plus, Trash2, GripVertical,
  ArrowRight, Search, X, Ban,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { getCategoriaName } from "@/lib/categoriasMap";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OsSequence {
  id: string;
  name: string;
  categories: string[];
}

interface CategoryInfo {
  code: string;
  name: string;
  count: number;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

const SEQUENCES_KEY = "chamados_os_sequences_v1";
const EXCLUSIONS_KEY = "chamados_exclusions_v1";

function storageGet<T>(key: string, ispId: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`${key}_${ispId}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function storageSet(key: string, ispId: string, value: unknown) {
  localStorage.setItem(`${key}_${ispId}`, JSON.stringify(value));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SetupChamados({ inline = false }: { inline?: boolean }) {
  const { toast } = useToast();
  const { ispId, ispNome } = useActiveIsp();

  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [sequences, setSequences] = useState<OsSequence[]>([]);
  const [exclusions, setExclusions] = useState<string[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [seqSearch, setSeqSearch] = useState("");
  const [exclSearch, setExclSearch] = useState("");

  // ── Load ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        const BATCH = 1000;
        let all: any[] = [];
        let offset = 0;
        let hasMore = true;
        while (hasMore) {
          const { data, error } = await externalSupabase
            .from("chamados")
            .select("categoria")
            .eq("isp_id", ispId)
            .range(offset, offset + BATCH - 1);
          if (error) throw error;
          if (data?.length) {
            all = [...all, ...data];
            offset += BATCH;
            if (data.length < BATCH) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        const catMap = new Map<string, number>();
        all.forEach((item) => {
          const cat = item.categoria || "";
          if (cat) catMap.set(cat, (catMap.get(cat) || 0) + 1);
        });

        const catList: CategoryInfo[] = Array.from(catMap.entries())
          .map(([code, count]) => ({ code, name: getCategoriaName(code, ispId), count }))
          .sort((a, b) => b.count - a.count);

        if (!cancelled) {
          setCategories(catList);
          setSequences(storageGet<OsSequence[]>(SEQUENCES_KEY, ispId, []));
          setExclusions(storageGet<string[]>(EXCLUSIONS_KEY, ispId, []));
        }
      } catch (err: any) {
        console.error("Erro ao buscar categorias:", err);
        if (!cancelled) toast({ title: "Erro", description: "Não foi possível carregar categorias.", variant: "destructive" });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    fetchCategories();
    return () => { cancelled = true; };
  }, [ispId, toast]);

  // ── Sequences ─────────────────────────────────────────────────────────────

  const addSequence = useCallback(() => {
    setSequences((prev) => [...prev, { id: crypto.randomUUID(), name: `Sequência ${prev.length + 1}`, categories: [] }]);
    setHasChanges(true);
  }, []);

  const removeSequence = useCallback((id: string) => {
    setSequences((prev) => prev.filter((s) => s.id !== id));
    setHasChanges(true);
  }, []);

  const updateSequenceName = useCallback((id: string, name: string) => {
    setSequences((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
    setHasChanges(true);
  }, []);

  const addCategoryToSequence = useCallback((seqId: string, catCode: string) => {
    setSequences((prev) => prev.map((s) => {
      if (s.id !== seqId || s.categories.includes(catCode)) return s;
      return { ...s, categories: [...s.categories, catCode] };
    }));
    setHasChanges(true);
  }, []);

  const removeCategoryFromSequence = useCallback((seqId: string, catCode: string) => {
    setSequences((prev) => prev.map((s) =>
      s.id === seqId ? { ...s, categories: s.categories.filter((c) => c !== catCode) } : s
    ));
    setHasChanges(true);
  }, []);

  // ── Exclusions — auto-save on toggle ─────────────────────────────────────

  const toggleExclusion = useCallback((catCode: string) => {
    setExclusions((prev) => {
      const next = prev.includes(catCode) ? prev.filter((c) => c !== catCode) : [...prev, catCode];
      storageSet(EXCLUSIONS_KEY, ispId, next);
      return next;
    });
  }, [ispId]);

  const clearAllExclusions = useCallback(() => {
    setExclusions([]);
    storageSet(EXCLUSIONS_KEY, ispId, []);
    toast({ title: "Exclusões removidas", description: "Todos os tipos de OS voltarão a ser analisados." });
  }, [ispId, toast]);

  // ── Save sequences ────────────────────────────────────────────────────────

  const handleSave = () => {
    storageSet(SEQUENCES_KEY, ispId, sequences);
    setHasChanges(false);
    toast({ title: "Configuração salva", description: "O mapeamento de sequências foi atualizado." });
  };

  const handleResetSequences = () => {
    setSequences([]);
    localStorage.removeItem(`${SEQUENCES_KEY}_${ispId}`);
    setHasChanges(false);
    toast({ title: "Sequências removidas", description: "Todos os mapeamentos foram resetados." });
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  const assignedInSequences = useMemo(() => {
    const set = new Set<string>();
    sequences.forEach((s) => s.categories.forEach((c) => set.add(c)));
    return set;
  }, [sequences]);

  const filteredSeqCategories = useMemo(() => {
    const q = seqSearch.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [categories, seqSearch]);

  const filteredExclCategories = useMemo(() => {
    const q = exclSearch.toLowerCase().trim();
    if (!q) return categories;
    return categories.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [categories, exclSearch]);

  // ── Content ───────────────────────────────────────────────────────────────

  const content = isLoading ? (
    <LoadingScreen />
  ) : (
    <div className="space-y-6">

      {/* Info */}
      <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-foreground/80 space-y-1">
          <p>
            Configure como os chamados são agrupados e filtrados na análise.{" "}
            <strong>Sequências</strong> agrupam tipos de OS que se sucedem como um único atendimento.{" "}
            <strong>Exclusões</strong> removem tipos irrelevantes da contagem de chamados recorrentes.
          </p>
          <p className="text-xs text-muted-foreground">Configurações salvas localmente por provedor e aplicadas em tempo real.</p>
        </div>
      </div>

      {/* ── Exclusões da Análise ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4 text-destructive/70" />
                Exclusões da Análise
              </CardTitle>
              <CardDescription className="mt-1">
                Tipos de OS <strong>ignorados</strong> na contagem de chamados recorrentes, CRM e Churn Score.
                {exclusions.length > 0 && (
                  <span className="ml-1 font-medium text-foreground">{exclusions.length} tipo{exclusions.length > 1 ? "s" : ""} excluído{exclusions.length > 1 ? "s" : ""}.</span>
                )}
              </CardDescription>
            </div>
            {exclusions.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearAllExclusions} className="gap-1.5 text-destructive hover:text-destructive shrink-0">
                <RotateCcw className="h-3.5 w-3.5" />
                Limpar tudo
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Active exclusions */}
          {exclusions.length > 0 && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Excluídos atualmente</p>
              <div className="flex flex-wrap gap-1.5">
                {exclusions.map((code) => {
                  const info = categories.find((c) => c.code === code);
                  return (
                    <Badge
                      key={code}
                      variant="outline"
                      className="gap-1 cursor-pointer border-destructive/30 text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors pr-1"
                      onClick={() => toggleExclusion(code)}
                    >
                      <span className="font-mono text-[10px]">{code}</span>
                      <span className="text-xs">{info?.name || code}</span>
                      <X className="h-3 w-3 ml-0.5" />
                    </Badge>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground">Clique em um tipo para reincluí-lo na análise.</p>
            </div>
          )}

          {/* Search + category list */}
          <div className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tipo de OS..."
                value={exclSearch}
                onChange={(e) => setExclSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="max-h-52 overflow-y-auto rounded-md border p-3">
              <div className="flex flex-wrap gap-2">
                {filteredExclCategories.map((cat) => {
                  const isExcluded = exclusions.includes(cat.code);
                  return (
                    <Badge
                      key={cat.code}
                      variant={isExcluded ? "outline" : "secondary"}
                      className={`cursor-pointer text-xs transition-colors ${
                        isExcluded
                          ? "border-destructive/30 text-destructive bg-destructive/10 hover:bg-destructive/20"
                          : "hover:bg-destructive/10 hover:text-destructive"
                      }`}
                      onClick={() => toggleExclusion(cat.code)}
                    >
                      {isExcluded && <Ban className="h-3 w-3 mr-1" />}
                      <span className="font-mono text-[10px] text-muted-foreground mr-1">{cat.code}</span>
                      {cat.name}
                      <span className="ml-1 text-[10px] text-muted-foreground">({cat.count})</span>
                    </Badge>
                  );
                })}
                {filteredExclCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 w-full text-center">Nenhuma categoria encontrada.</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ── Sequências de OS ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Sequências de OS</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Grupos de tipos de OS tratados como um único atendimento composto.</p>
          </div>
          <div className="flex items-center gap-2">
            {sequences.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleResetSequences} className="gap-1.5 text-destructive hover:text-destructive">
                <RotateCcw className="h-3.5 w-3.5" />
                Resetar
              </Button>
            )}
            <Button size="sm" onClick={addSequence} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nova Sequência
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges} variant="outline" className="gap-1.5">
              <Save className="h-4 w-4" />
              Salvar
            </Button>
          </div>
        </div>

        {sequences.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <GripVertical className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium">Nenhuma sequência mapeada</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Crie sequências para que o sistema trate tipos de OS relacionados como um único atendimento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sequences.map((seq, idx) => (
              <Card key={seq.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono text-xs shrink-0">#{idx + 1}</Badge>
                    <Input
                      value={seq.name}
                      onChange={(e) => updateSequenceName(seq.id, e.target.value)}
                      className="h-8 text-sm font-semibold border-none shadow-none p-0 focus-visible:ring-0"
                      placeholder="Nome da sequência..."
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0" onClick={() => removeSequence(seq.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {seq.categories.length === 0 ? (
                    <div className="border border-dashed rounded-md p-3 text-center text-xs text-muted-foreground">
                      Nenhum tipo adicionado. Clique nas categorias abaixo para vincular.
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {seq.categories.map((catCode, catIdx) => {
                        const info = categories.find((c) => c.code === catCode);
                        return (
                          <div key={catCode} className="flex items-center gap-1">
                            {catIdx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                            <Badge
                              variant="secondary"
                              className="gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors pr-1"
                              onClick={() => removeCategoryFromSequence(seq.id, catCode)}
                            >
                              <span className="font-mono text-[10px] text-muted-foreground">{catCode}</span>
                              <span className="text-xs">{info?.name || catCode}</span>
                              <X className="h-3 w-3 ml-0.5" />
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Available categories for sequences */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tipos de OS Disponíveis</CardTitle>
            <CardDescription className="text-xs">
              Clique para adicionar à última sequência.
              {categories.length > 0 && ` ${categories.length} tipos encontrados.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tipo..."
                value={seqSearch}
                onChange={(e) => setSeqSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border p-3">
              <div className="flex flex-wrap gap-2">
                {filteredSeqCategories.map((cat) => {
                  const isAssigned = assignedInSequences.has(cat.code);
                  return (
                    <Badge
                      key={cat.code}
                      variant={isAssigned ? "outline" : "secondary"}
                      className={`cursor-pointer text-xs transition-colors ${
                        isAssigned ? "opacity-40 cursor-not-allowed" : "hover:bg-primary/10 hover:text-primary"
                      }`}
                      onClick={() => {
                        if (isAssigned) return;
                        if (sequences.length > 0) {
                          addCategoryToSequence(sequences[sequences.length - 1].id, cat.code);
                        } else {
                          toast({ title: "Crie uma sequência primeiro", description: "Clique em 'Nova Sequência' antes de adicionar tipos." });
                        }
                      }}
                    >
                      <span className="font-mono text-[10px] text-muted-foreground mr-1">{cat.code}</span>
                      {cat.name}
                      <span className="ml-1 text-[10px] text-muted-foreground">({cat.count})</span>
                    </Badge>
                  );
                })}
                {filteredSeqCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 w-full text-center">Nenhum tipo encontrado.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        {sequences.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Resumo das Sequências</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {sequences.map((seq, idx) => (
                  <div key={seq.id} className="flex items-center gap-3 text-sm">
                    <Badge variant="outline" className="font-mono text-[10px] shrink-0">#{idx + 1}</Badge>
                    <span className="font-medium">{seq.name}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-xs text-muted-foreground">
                      {seq.categories.length === 0 ? "Sem tipos" : seq.categories.map((c) => {
                        const info = categories.find((cat) => cat.code === c);
                        return info?.name || c;
                      }).join(" → ")}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (inline) return content;

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
                  Setup de Chamados
                </h1>
                <p className="text-muted-foreground text-sm mt-0.5">
                  Configure sequências e exclusões para análise de chamados · {ispNome}
                </p>
              </div>
            </div>
            <IspActions />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-6 py-6 max-w-4xl">{content}</main>
    </div>
  );
}
