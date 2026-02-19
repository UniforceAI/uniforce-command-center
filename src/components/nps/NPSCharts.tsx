import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { RespostaNPS } from "@/types/nps";

interface NPSChartsProps {
  respostas: RespostaNPS[];
}

const COLORS = {
  promotor: "hsl(142, 71%, 45%)",
  neutro: "hsl(38, 92%, 50%)",
  detrator: "hsl(0, 84%, 60%)",
  geral: "hsl(221, 83%, 53%)",           // Azul
  contrato: "hsl(142, 71%, 45%)",        // Verde
  os: "hsl(280, 87%, 60%)",              // Roxo
  atendimento: "hsl(38, 92%, 50%)",      // Amarelo
};

const FILTER_OPTIONS = [
  { id: "geral", label: "Geral", color: COLORS.geral },
  { id: "contrato", label: "Contrato", color: COLORS.contrato },
  { id: "os", label: "Pós-O.S", color: COLORS.os },
  { id: "atendimento", label: "Atendimento", color: COLORS.atendimento },
];

export const NPSCharts = memo(({ respostas }: NPSChartsProps) => {
  const [selectedFilters, setSelectedFilters] = useState<string[]>(["geral"]);

  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev => {
      if (prev.includes(filterId)) {
        if (prev.length === 1) return prev;
        return prev.filter(f => f !== filterId);
      }
      return [...prev, filterId];
    });
  };

  // Evolução da média no tempo - agregado por semana para UX clean
  const evolucaoData = useMemo(() => {
    const byWeek: Record<string, { 
      contrato: { soma: number; total: number };
      os: { soma: number; total: number };
      atendimento: { soma: number; total: number };
      geral: { soma: number; total: number };
      weekStart: Date;
    }> = {};

    respostas.forEach((r) => {
      const date = new Date(r.data_resposta);
      // Agrupar por semana (início da semana = segunda-feira)
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(date);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      const weekKey = weekStart.toISOString().split('T')[0];

      if (!byWeek[weekKey]) {
        byWeek[weekKey] = {
          contrato: { soma: 0, total: 0 },
          os: { soma: 0, total: 0 },
          atendimento: { soma: 0, total: 0 },
          geral: { soma: 0, total: 0 },
          weekStart,
        };
      }
      
      const tipo = r.tipo_nps as keyof Omit<typeof byWeek[string], 'weekStart'>;
      if (byWeek[weekKey][tipo]) {
        byWeek[weekKey][tipo].soma += r.nota;
        byWeek[weekKey][tipo].total++;
      }
      byWeek[weekKey].geral.soma += r.nota;
      byWeek[weekKey].geral.total++;
    });

    const calcMedia = (data: { soma: number; total: number }) => 
      data.total > 0 ? Number((data.soma / data.total).toFixed(1)) : null;

    return Object.entries(byWeek)
      .map(([key, data]) => ({
        date: data.weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
        dateSort: key,
        geral: calcMedia(data.geral),
        contrato: calcMedia(data.contrato),
        os: calcMedia(data.os),
        atendimento: calcMedia(data.atendimento),
        respostas: data.geral.total,
      }))
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort));
  }, [respostas]);

  // Comparação entre tipos - Média das notas
  const comparacaoData = useMemo(() => {
    const tipos = [
      { id: "contrato", name: "Contrato", color: COLORS.contrato },
      { id: "os", name: "Pós-O.S", color: COLORS.os },
    ];
    return tipos.map((tipo) => {
      const filtradas = respostas.filter((r) => r.tipo_nps === tipo.id);
      const soma = filtradas.reduce((acc, r) => acc + r.nota, 0);
      const total = filtradas.length;
      
      return {
        name: tipo.name,
        media: total > 0 ? Number((soma / total).toFixed(1)) : 0,
        total,
        fill: tipo.color,
      };
    });
  }, [respostas]);

  // Distribuição de notas
  // Distribuição de notas
  const distribuicaoData = useMemo(() => {
    const promotores = respostas.filter((r) => r.classificacao === "Promotor").length;
    const neutros = respostas.filter((r) => r.classificacao === "Neutro").length;
    const detratores = respostas.filter((r) => r.classificacao === "Detrator").length;
    
    return [
      { name: "Promotores (9-10)", value: promotores, color: COLORS.promotor },
      { name: "Neutros (7-8)", value: neutros, color: COLORS.neutro },
      { name: "Detratores (0-6)", value: detratores, color: COLORS.detrator },
    ];
  }, [respostas]);

  return (
    <div className="space-y-4">
      {/* Gráfico 1 - Evolução (Full Width) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">Evolução do NPS (semanal)</CardTitle>
            <div className="flex gap-1.5">
              {FILTER_OPTIONS.map((option) => {
                const isSelected = selectedFilters.includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => toggleFilter(option.id)}
                    className={`
                      text-xs px-3 py-1 rounded-full font-medium transition-all
                      ${isSelected 
                        ? 'text-white shadow-sm' 
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }
                    `}
                    style={{
                      backgroundColor: isSelected ? option.color : undefined,
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={evolucaoData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradientGeral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.geral} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.geral} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradientContrato" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.contrato} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.contrato} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradientOs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.os} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.os} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="gradientAtendimento" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.atendimento} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={COLORS.atendimento} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis 
                dataKey="date" 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                interval="preserveStartEnd"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                domain={[0, 10]} 
                fontSize={10} 
                tickLine={false} 
                axisLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                ticks={[0, 2.5, 5, 7.5, 10]}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelFormatter={(label) => `Semana de ${label}`}
              />
              {selectedFilters.includes("geral") && (
                <Area type="monotone" dataKey="geral" name="Geral" stroke={COLORS.geral} strokeWidth={2} fill="url(#gradientGeral)" connectNulls dot={false} />
              )}
              {selectedFilters.includes("contrato") && (
                <Area type="monotone" dataKey="contrato" name="Contrato" stroke={COLORS.contrato} strokeWidth={2} fill="url(#gradientContrato)" connectNulls dot={false} />
              )}
              {selectedFilters.includes("os") && (
                <Area type="monotone" dataKey="os" name="Pós-O.S" stroke={COLORS.os} strokeWidth={2} fill="url(#gradientOs)" connectNulls dot={false} />
              )}
              {selectedFilters.includes("atendimento") && (
                <Area type="monotone" dataKey="atendimento" name="Atendimento" stroke={COLORS.atendimento} strokeWidth={2} fill="url(#gradientAtendimento)" connectNulls dot={false} />
              )}
              {selectedFilters.length > 1 && (
                <Legend verticalAlign="bottom" height={30} formatter={(value) => <span className="text-xs">{value}</span>} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráficos 2 e 3 lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Comparação por Tipo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📊 Comparação por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={comparacaoData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis domain={[0, 10]} fontSize={11} />
                <Tooltip />
                <Bar dataKey="media" name="Média" radius={[4, 4, 0, 0]}>
                  {comparacaoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição de Notas - layout horizontal clean */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📉 Distribuição de Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {distribuicaoData.map((item) => {
                const total = distribuicaoData.reduce((acc, d) => acc + d.value, 0);
                const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{item.name}</span>
                      <span className="font-medium">{item.value} ({percent}%)</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${percent}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

NPSCharts.displayName = "NPSCharts";
