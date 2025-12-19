import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  LineChart,
  Line,
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
  geral: "hsl(var(--primary))",
  pos_instalacao: "hsl(221, 83%, 53%)",
  pos_os: "hsl(262, 83%, 58%)",
  pos_atendimento: "hsl(142, 71%, 45%)",
};

const FILTER_OPTIONS = [
  { id: "geral", label: "Geral", color: COLORS.geral },
  { id: "pos_instalacao", label: "Pós-Instalação", color: COLORS.pos_instalacao },
  { id: "pos_os", label: "Pós-O.S", color: COLORS.pos_os },
  { id: "pos_atendimento", label: "Pós-Atendimento", color: COLORS.pos_atendimento },
];

export const NPSCharts = memo(({ respostas }: NPSChartsProps) => {
  const [selectedFilters, setSelectedFilters] = useState<string[]>(["geral"]);

  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev => {
      if (prev.includes(filterId)) {
        // Don't allow deselecting all
        if (prev.length === 1) return prev;
        return prev.filter(f => f !== filterId);
      }
      return [...prev, filterId];
    });
  };

  // Evolução do NPS no tempo
  const evolucaoData = useMemo(() => {
    const byDate: Record<string, { 
      pos_instalacao: { promotores: number; detratores: number; total: number };
      pos_os: { promotores: number; detratores: number; total: number };
      pos_atendimento: { promotores: number; detratores: number; total: number };
      geral: { promotores: number; detratores: number; total: number };
    }> = {};

    respostas.forEach((r) => {
      if (!byDate[r.data_resposta]) {
        byDate[r.data_resposta] = {
          pos_instalacao: { promotores: 0, detratores: 0, total: 0 },
          pos_os: { promotores: 0, detratores: 0, total: 0 },
          pos_atendimento: { promotores: 0, detratores: 0, total: 0 },
          geral: { promotores: 0, detratores: 0, total: 0 },
        };
      }
      
      const tipo = r.tipo_nps as keyof typeof byDate[string];
      byDate[r.data_resposta][tipo].total++;
      byDate[r.data_resposta].geral.total++;
      
      if (r.classificacao === "Promotor") {
        byDate[r.data_resposta][tipo].promotores++;
        byDate[r.data_resposta].geral.promotores++;
      }
      if (r.classificacao === "Detrator") {
        byDate[r.data_resposta][tipo].detratores++;
        byDate[r.data_resposta].geral.detratores++;
      }
    });

    const calcNPS = (data: { promotores: number; detratores: number; total: number }) => 
      data.total > 0 ? Math.round(((data.promotores - data.detratores) / data.total) * 100) : null;

    return Object.entries(byDate)
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        dateSort: date,
        geral: calcNPS(data.geral),
        pos_instalacao: calcNPS(data.pos_instalacao),
        pos_os: calcNPS(data.pos_os),
        pos_atendimento: calcNPS(data.pos_atendimento),
      }))
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort));
  }, [respostas]);

  // Comparação entre tipos
  const comparacaoData = useMemo(() => {
    const tipos = ["pos_instalacao", "pos_os", "pos_atendimento"];
    return tipos.map((tipo) => {
      const filtradas = respostas.filter((r) => r.tipo_nps === tipo);
      const promotores = filtradas.filter((r) => r.classificacao === "Promotor").length;
      const detratores = filtradas.filter((r) => r.classificacao === "Detrator").length;
      const total = filtradas.length;
      
      return {
        name: tipo === "pos_instalacao" ? "Pós-Instalação" 
            : tipo === "pos_os" ? "Pós-O.S" 
            : "Pós-Atendimento",
        nps: total > 0 ? Math.round(((promotores - detratores) / total) * 100) : 0,
      };
    });
  }, [respostas]);

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
            <div className="flex flex-wrap gap-4">
              {FILTER_OPTIONS.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                  <Checkbox
                    id={option.id}
                    checked={selectedFilters.includes(option.id)}
                    onCheckedChange={() => toggleFilter(option.id)}
                  />
                  <Label 
                    htmlFor={option.id} 
                    className="text-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: option.color }}
                    />
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={evolucaoData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis domain={[-100, 100]} fontSize={11} />
              <Tooltip />
              {selectedFilters.includes("geral") && (
                <Line 
                  type="monotone" 
                  dataKey="geral" 
                  name="Geral"
                  stroke={COLORS.geral}
                  strokeWidth={2}
                  dot={{ fill: COLORS.geral, r: 3 }}
                  connectNulls
                />
              )}
              {selectedFilters.includes("pos_instalacao") && (
                <Line 
                  type="monotone" 
                  dataKey="pos_instalacao" 
                  name="Pós-Instalação"
                  stroke={COLORS.pos_instalacao}
                  strokeWidth={2}
                  dot={{ fill: COLORS.pos_instalacao, r: 3 }}
                  connectNulls
                />
              )}
              {selectedFilters.includes("pos_os") && (
                <Line 
                  type="monotone" 
                  dataKey="pos_os" 
                  name="Pós-O.S"
                  stroke={COLORS.pos_os}
                  strokeWidth={2}
                  dot={{ fill: COLORS.pos_os, r: 3 }}
                  connectNulls
                />
              )}
              {selectedFilters.includes("pos_atendimento") && (
                <Line 
                  type="monotone" 
                  dataKey="pos_atendimento" 
                  name="Pós-Atendimento"
                  stroke={COLORS.pos_atendimento}
                  strokeWidth={2}
                  dot={{ fill: COLORS.pos_atendimento, r: 3 }}
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
            </LineChart>
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
                <YAxis domain={[-100, 100]} fontSize={11} />
                <Tooltip />
                <Bar dataKey="nps" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
                  label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
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
