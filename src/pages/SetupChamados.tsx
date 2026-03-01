import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings2, Save, RotateCcw, Info, Plus, Trash2, GripVertical, ArrowRight, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useActiveIsp } from "@/hooks/useActiveIsp";
import { externalSupabase } from "@/integrations/supabase/external-client";
import { getCategoriaName } from "@/lib/categoriasMap";
import { IspActions } from "@/components/shared/IspActions";
import { LoadingScreen } from "@/components/shared/LoadingScreen";

// A "sequence" is a group of category codes that the ISP considers as one composite service flow
interface OsSequence {
  id: string;
  name: string;
  categories: string[]; // category codes that form this sequence
}

const STORAGE_KEY = "chamados_os_sequences_v1";

function loadSequences(ispId: string): OsSequence[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${ispId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function saveSequences(ispId: string, sequences: OsSequence[]) {
  localStorage.setItem(`${STORAGE_KEY}_${ispId}`, JSON.stringify(sequences));
}

export default function SetupChamados() {
  const { toast } = useToast();
  const { ispId, ispNome } = useActiveIsp();
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<{ code: string; name: string; count: number }[]>([]);
  const [sequences, setSequences] = useState<OsSequence[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Load category data from chamados table
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      try {
        // Fetch all unique categories with counts
        const BATCH_SIZE = 1000;
        let allData: any[] = [];
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await externalSupabase
            .from("chamados")
            .select("categoria")
            .eq("isp_id", ispId)
            .range(offset, offset + BATCH_SIZE - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += BATCH_SIZE;
            if (data.length < BATCH_SIZE) hasMore = false;
          } else {
            hasMore = false;
          }
        }

        // Count by category
        const catMap = new Map<string, number>();
        allData.forEach((item: any) => {
          const cat = item.categoria || "";
          if (cat) catMap.set(cat, (catMap.get(cat) || 0) + 1);
        });

        const catList = Array.from(catMap.entries())
          .map(([code, count]) => ({
            code,
            name: getCategoriaName(code, ispId),
            count,
          }))
          .sort((a, b) => b.count - a.count);

        setCategories(catList);
        setSequences(loadSequences(ispId));
      } catch (err: any) {
        console.error("Erro ao buscar categorias:", err);
        toast({ title: "Erro", description: "Não foi possível carregar categorias.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [ispId, toast]);

  const addSequence = useCallback(() => {
    const newSeq: OsSequence = {
      id: crypto.randomUUID(),
      name: `Sequência ${sequences.length + 1}`,
      categories: [],
    };
    setSequences(prev => [...prev, newSeq]);
    setHasChanges(true);
  }, [sequences.length]);

  const removeSequence = useCallback((id: string) => {
    setSequences(prev => prev.filter(s => s.id !== id));
    setHasChanges(true);
  }, []);

  const updateSequenceName = useCallback((id: string, name: string) => {
    setSequences(prev => prev.map(s => s.id === id ? { ...s, name } : s));
    setHasChanges(true);
  }, []);

  const addCategoryToSequence = useCallback((seqId: string, catCode: string) => {
    setSequences(prev => prev.map(s => {
      if (s.id !== seqId) return s;
      if (s.categories.includes(catCode)) return s;
      return { ...s, categories: [...s.categories, catCode] };
    }));
    setHasChanges(true);
  }, []);

  const removeCategoryFromSequence = useCallback((seqId: string, catCode: string) => {
    setSequences(prev => prev.map(s => {
      if (s.id !== seqId) return s;
      return { ...s, categories: s.categories.filter(c => c !== catCode) };
    }));
    setHasChanges(true);
  }, []);

  const handleSave = () => {
    saveSequences(ispId, sequences);
    setHasChanges(false);
    toast({ title: "Configuração salva", description: "O mapeamento de ordens de serviço sequenciais foi atualizado." });
  };

  const handleReset = () => {
    setSequences([]);
    localStorage.removeItem(`${STORAGE_KEY}_${ispId}`);
    setHasChanges(false);
    toast({ title: "Configuração resetada", description: "Todos os mapeamentos foram removidos." });
  };

  // Categories already assigned to any sequence
  const assignedCategories = useMemo(() => {
    const set = new Set<string>();
    sequences.forEach(s => s.categories.forEach(c => set.add(c)));
    return set;
  }, [sequences]);

  // Filtered available categories
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const lower = searchTerm.toLowerCase();
    return categories.filter(c =>
      c.code.toLowerCase().includes(lower) ||
      c.name.toLowerCase().includes(lower)
    );
  }, [categories, searchTerm]);

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
                  Mapeie sequências de ordens de serviço para análise precisa de chamados recorrentes · {ispNome}
                </p>
              </div>
            </div>
            <IspActions />
          </div>
        </div>
      </header>

      {isLoading ? (
        <main className="container mx-auto px-6 py-6 max-w-4xl">
          <LoadingScreen />
        </main>
      ) : (
        <main className="container mx-auto px-6 py-6 max-w-4xl space-y-6">

          {/* Info banner */}
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-foreground/80 space-y-1">
              <p>
                Provedores possuem processos internos onde uma ordem de serviço leva à abertura de outra.
                Mapeie essas sequências para que o sistema trate-as como um <strong>único atendimento composto</strong>,
                melhorando a assertividade na detecção de chamados realmente recorrentes.
              </p>
              <p className="text-muted-foreground text-xs">
                As configurações ficam salvas no seu navegador e são aplicadas na análise de chamados frequentes.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Button onClick={addSequence} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Sequência
            </Button>
            <div className="ml-auto flex items-center gap-2">
              {sequences.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 text-destructive hover:text-destructive">
                  <RotateCcw className="h-4 w-4" />
                  Resetar
                </Button>
              )}
              <Button onClick={handleSave} disabled={!hasChanges} className="gap-2">
                <Save className="h-4 w-4" />
                Salvar Configuração
              </Button>
            </div>
          </div>

          {/* Sequences */}
          {sequences.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <GripVertical className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <h3 className="text-base font-semibold">Nenhuma sequência mapeada</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">
                  Clique em "Nova Sequência" para criar o primeiro mapeamento de ordens de serviço sequenciais do seu provedor.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {sequences.map((seq, idx) => (
                <Card key={seq.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono text-xs shrink-0">#{idx + 1}</Badge>
                      <Input
                        value={seq.name}
                        onChange={e => updateSequenceName(seq.id, e.target.value)}
                        className="h-8 text-sm font-semibold border-none shadow-none p-0 focus-visible:ring-0"
                        placeholder="Nome da sequência..."
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive shrink-0" onClick={() => removeSequence(seq.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription className="text-xs">
                      Arraste categorias da lista abaixo para definir a ordem de serviço sequencial
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {seq.categories.length === 0 ? (
                      <div className="border border-dashed rounded-md p-4 text-center text-sm text-muted-foreground">
                        Nenhuma categoria adicionada. Clique nas categorias abaixo para vincular.
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {seq.categories.map((catCode, catIdx) => {
                          const catInfo = categories.find(c => c.code === catCode);
                          return (
                            <div key={catCode} className="flex items-center gap-1">
                              {catIdx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />}
                              <Badge
                                variant="secondary"
                                className="gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors pr-1"
                                onClick={() => removeCategoryFromSequence(seq.id, catCode)}
                              >
                                <span className="font-mono text-[10px] text-muted-foreground">{catCode}</span>
                                <span className="text-xs">{catInfo?.name || catCode}</span>
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

          {/* Available categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Categorias Disponíveis</CardTitle>
              <CardDescription>
                Clique em uma categoria para adicioná-la à sequência selecionada.
                {categories.length > 0 && ` ${categories.length} categorias encontradas.`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar categoria..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <div className="max-h-[400px] overflow-y-auto rounded-md border p-3">
                <div className="flex flex-wrap gap-2">
                  {filteredCategories.map(cat => {
                    const isAssigned = assignedCategories.has(cat.code);
                    return (
                      <Badge
                        key={cat.code}
                        variant={isAssigned ? "outline" : "secondary"}
                        className={`cursor-pointer text-xs transition-colors ${
                          isAssigned
                            ? "opacity-40 cursor-not-allowed"
                            : "hover:bg-primary/10 hover:text-primary"
                        }`}
                        onClick={() => {
                          if (isAssigned) return;
                          // Add to last sequence if exists
                          if (sequences.length > 0) {
                            addCategoryToSequence(sequences[sequences.length - 1].id, cat.code);
                          } else {
                            toast({ title: "Crie uma sequência primeiro", description: "Clique em 'Nova Sequência' antes de adicionar categorias." });
                          }
                        }}
                      >
                        <span className="font-mono text-[10px] text-muted-foreground mr-1">{cat.code}</span>
                        {cat.name}
                        <span className="ml-1 text-[10px] text-muted-foreground">({cat.count})</span>
                      </Badge>
                    );
                  })}
                  {filteredCategories.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 w-full text-center">Nenhuma categoria encontrada.</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          {sequences.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo do Mapeamento</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sequences.map((seq, idx) => (
                    <div key={seq.id} className="flex items-center gap-3 text-sm">
                      <Badge variant="outline" className="font-mono text-[10px] shrink-0">#{idx + 1}</Badge>
                      <span className="font-medium">{seq.name}</span>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-xs text-muted-foreground">
                        {seq.categories.length === 0
                          ? "Sem categorias"
                          : seq.categories.map(c => {
                              const info = categories.find(cat => cat.code === c);
                              return info?.name || c;
                            }).join(" → ")}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

        </main>
      )}
    </div>
  );
}
