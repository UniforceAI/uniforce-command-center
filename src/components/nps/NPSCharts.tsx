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

  // Evolução da média no tempo
  const evolucaoData = useMemo(() => {
    const byDate: Record<string, { 
      contrato: { soma: number; total: number };
      os: { soma: number; total: number };
      atendimento: { soma: number; total: number };
      geral: { soma: number; total: number };
    }> = {};

    respostas.forEach((r) => {
      if (!byDate[r.data_resposta]) {
        byDate[r.data_resposta] = {
          contrato: { soma: 0, total: 0 },
          os: { soma: 0, total: 0 },
          atendimento: { soma: 0, total: 0 },
          geral: { soma: 0, total: 0 },
        };
      }
      
      const tipo = r.tipo_nps as keyof typeof byDate[string];
      byDate[r.data_resposta][tipo].soma += r.nota;
      byDate[r.data_resposta][tipo].total++;
      byDate[r.data_resposta].geral.soma += r.nota;
      byDate[r.data_resposta].geral.total++;
    });

    const calcMedia = (data: { soma: number; total: number }) => 
      data.total > 0 ? Number((data.soma / data.total).toFixed(1)) : null;

    return Object.entries(byDate)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        dateSort: date,
        geral: calcMedia(data.geral),
        contrato: calcMedia(data.contrato),
        os: calcMedia(data.os),
        atendimento: calcMedia(data.atendimento),
      }))
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort));
  }, [respostas]);

  // Comparação entre tipos - Média das notas
  const comparacaoData = useMemo(() => {
    const tipos = [
      { id: "contrato", name: "Contrato", color: COLORS.contrato },
      { id: "os", name: "Pós-O.S", color: COLORS.os },
      { id: "atendimento", name: "Atendimento", color: COLORS.atendimento },
    ];
    return tipos.map((tipo) => {
      const filtradas = respostas.filter((r) => r.tipo_nps === tipo.id);
      const soma = filtradas.reduce((acc, r) => acc + r.nota, 0);
      const total = filtradas.length;
      
      return {
        name: tipo.name,
        media: total > 0 ? Number((soma / total).toFixed(1)) : 0,
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-base">📈 Evolução do NPS</CardTitle>
            <div className="flex flex-wrap gap-2">
              {FILTER_OPTIONS.map((option) => {
                const isSelected = selectedFilters.includes(option.id);
                return (
                  <button
                    key={option.id}
                    onClick={() => toggleFilter(option.id)}
                    className={`
                      text-xs px-3 py-1.5 rounded-full font-medium transition-all duration-200
                      ${isSelected 
                        ? 'text-white shadow-md' 
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted'
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
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={evolucaoData}>
              <defs>
                <linearGradient id="gradientGeral" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.geral} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={COLORS.geral} stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="gradientContrato" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.contrato} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={COLORS.contrato} stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="gradientOs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.os} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={COLORS.os} stopOpacity={0.05}/>
                </linearGradient>
                <linearGradient id="gradientAtendimento" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.atendimento} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={COLORS.atendimento} stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
              <XAxis dataKey="date" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 10]} fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              />
              {selectedFilters.includes("geral") && (
                <Area 
                  type="monotone" 
                  dataKey="geral" 
                  name="Geral"
                  stroke={COLORS.geral}
                  strokeWidth={2}
                  fill="url(#gradientGeral)"
                  connectNulls
                />
              )}
              {selectedFilters.includes("contrato") && (
                <Area 
                  type="monotone" 
                  dataKey="contrato" 
                  name="Contrato"
                  stroke={COLORS.contrato}
                  strokeWidth={2}
                  fill="url(#gradientContrato)"
                  connectNulls
                />
              )}
              {selectedFilters.includes("os") && (
                <Area 
                  type="monotone" 
                  dataKey="os" 
                  name="Pós-O.S"
                  stroke={COLORS.os}
                  strokeWidth={2}
                  fill="url(#gradientOs)"
                  connectNulls
                />
              )}
              {selectedFilters.includes("atendimento") && (
                <Area 
                  type="monotone" 
                  dataKey="atendimento" 
                  name="Atendimento"
                  stroke={COLORS.atendimento}
                  strokeWidth={2}
                  fill="url(#gradientAtendimento)"
                  connectNulls
                />
              )}
              {selectedFilters.length > 1 && (
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gráficos 2 e 3 lado a lado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Gráfico 2 - Comparação */}
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

        {/* Gráfico 3 - Distribuição */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">📉 Distribuição de Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={distribuicaoData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ percent }) => `${Math.round(percent * 100)}%`}
                  labelLine={false}
                >
                  {distribuicaoData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  formatter={(value) => <span className="text-xs">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

NPSCharts.displayName = "NPSCharts";
