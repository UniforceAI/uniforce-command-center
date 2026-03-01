import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chamado } from "@/types/chamado";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { ArrowUpDown, BarChart3, Clock, Users } from "lucide-react";

interface PerformanceChartsProps {
  chamados: Chamado[];
}

export const PerformanceCharts = memo(({ chamados }: PerformanceChartsProps) => {
  const [ordemCrescente, setOrdemCrescente] = useState(true);

  const { motivosData, responsaveisDataBase, setorData } = useMemo(() => {
    // Motivos
    const motivosMap = new Map<string, number>();
    chamados.forEach((chamado) => {
      const motivo = chamado["Motivo do Contato"];
      motivosMap.set(motivo, (motivosMap.get(motivo) || 0) + 1);
    });
    const motivosData = Array.from(motivosMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Responsáveis
    const responsaveisMap = new Map<string, { total: number; count: number }>();
    chamados.forEach((chamado) => {
      const responsavelRaw = chamado.Responsável;
      if (!responsavelRaw) return;
      const responsavel = responsavelRaw.split(" ")[0];
      const tempo = chamado["Tempo de Atendimento"];
      let horas = 0;
      if (typeof tempo === 'number') {
        horas = tempo;
      } else if (typeof tempo === 'string' && tempo.trim() !== '') {
        const abertoMatch = tempo.match(/Aberto há ([\d.]+)d/i);
        if (abertoMatch) { horas = parseFloat(abertoMatch[1]) * 24; }
        else if (tempo.includes("d")) { const m = tempo.match(/([\d.]+)d/); if (m) horas = parseFloat(m[1]) * 24; }
        else if (tempo.includes("h")) { const m = tempo.match(/([\d.]+)h/); if (m) horas = parseFloat(m[1]); }
        else if (tempo.includes("min")) { const m = tempo.match(/([\d.]+)min/); if (m) horas = parseFloat(m[1]) / 60; }
        else { const p = parseFloat(tempo); if (!isNaN(p)) horas = p; }
      }
      if (horas > 0 && !isNaN(horas)) {
        if (!responsaveisMap.has(responsavel)) responsaveisMap.set(responsavel, { total: 0, count: 0 });
        const current = responsaveisMap.get(responsavel)!;
        current.total += horas;
        current.count += 1;
      }
    });
    const responsaveisDataBase = Array.from(responsaveisMap.entries())
      .map(([nome, data]) => ({
        nome,
        media: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
        count: data.count,
      }))
      .filter(item => item.media > 0 && item.count >= 3);

    // Setor
    const setorClassificacaoMap = new Map<string, Record<string, number>>();
    chamados.forEach((chamado) => {
      const setor = chamado.Setor;
      const classificacao = chamado.Classificação;
      if (!setorClassificacaoMap.has(setor)) {
        setorClassificacaoMap.set(setor, { "Rápido": 0, Normal: 0, Lento: 0, Reincidente: 0 });
      }
      setorClassificacaoMap.get(setor)![classificacao] += 1;
    });
    const setorData = Array.from(setorClassificacaoMap.entries()).map(([setor, data]) => ({
      setor,
      ...data,
    }));

    return { motivosData, responsaveisDataBase, setorData };
  }, [chamados]);

  const responsaveisData = useMemo(() => {
    return [...responsaveisDataBase]
      .filter(r => r.media > 0)
      .sort((a, b) => ordemCrescente ? a.media - b.media : b.media - a.media);
  }, [responsaveisDataBase, ordemCrescente]);

  // Color function for time bars: fast=blue, mid=orange, slow=red
  const getTimeBarColor = (media: number) => {
    if (media <= 2) return "hsl(217, 91%, 60%)";       // blue — fast
    if (media <= 8) return "hsl(var(--primary))";        // primary — good
    if (media <= 24) return "hsl(38, 92%, 50%)";         // orange — mid
    return "hsl(var(--destructive))";                     // red — slow
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Principais Motivos — Horizontal Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Principais Motivos de Chamados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {motivosData.length > 0 ? (
            <div className="overflow-y-auto max-h-[340px]">
              <div style={{ height: Math.max(280, motivosData.length * 36) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={motivosData} layout="vertical" margin={{ right: 50, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" fontSize={11} orientation="top" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={140}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(v) => v.length > 22 ? `${v.substring(0, 20)}...` : v}
                    />
                    <Tooltip formatter={(v: number) => [v, "Chamados"]} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Chamados">
                      <Cell />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">Dados insuficientes</p>
          )}
        </CardContent>
      </Card>

      {/* Ranking de Atendimento por Atendente */}
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Ranking de Atendimento
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOrdemCrescente(!ordemCrescente)}
            className="h-8 gap-1 text-xs"
          >
            <ArrowUpDown className="h-3 w-3" />
            {ordemCrescente ? "Mais rápidos" : "Mais lentos"}
          </Button>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 flex flex-col">
          <div className="overflow-y-auto flex-1 max-h-[340px]">
            <div className="space-y-2">
              {responsaveisData.map((entry, index) => {
                const maxMedia = Math.max(...responsaveisData.map(e => e.media), 1);
                const pct = Math.min((entry.media / maxMedia) * 100, 100);
                const color = getTimeBarColor(entry.media);
                const formattedTime = entry.media >= 24
                  ? `${(entry.media / 24).toFixed(1)}d`
                  : entry.media < 1
                    ? `${Math.round(entry.media * 60)}min`
                    : `${entry.media.toFixed(1)}h`;
                return (
                  <div key={entry.nome} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-5 text-right font-mono">{index + 1}.</span>
                    <span className="text-xs font-medium w-[100px] truncate" title={entry.nome}>{entry.nome}</span>
                    <div className="flex-1 h-6 bg-muted/50 rounded-md overflow-hidden relative">
                      <div
                        className="h-full rounded-md transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold" style={{ color }}>
                        {formattedTime}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground w-[50px] text-right">{entry.count} ch.</span>
                  </div>
                );
              })}
              {responsaveisData.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">Dados insuficientes</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classificação por Setor */}
      <Card className="md:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Classificação por Setor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={setorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="setor" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Rápido" stackId="a" fill="hsl(142, 76%, 36%)" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Normal" stackId="a" fill="hsl(217, 91%, 60%)" />
              <Bar dataKey="Lento" stackId="a" fill="hsl(38, 92%, 50%)" />
              <Bar dataKey="Reincidente" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
});
