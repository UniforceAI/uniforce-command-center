import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  pos_instalacao: "hsl(221, 83%, 53%)",
  pos_os: "hsl(262, 83%, 58%)",
  pos_atendimento: "hsl(142, 71%, 45%)",
};

export const NPSCharts = memo(({ respostas }: NPSChartsProps) => {
  const [chartFilter, setChartFilter] = useState("todos");

  // Evolução do NPS no tempo - agora suporta múltiplas linhas
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
        nps_instalacao: calcNPS(data.pos_instalacao),
        nps_os: calcNPS(data.pos_os),
        nps_atendimento: calcNPS(data.pos_atendimento),
        nps_geral: calcNPS(data.geral),
      }))
      .sort((a, b) => a.dateSort.localeCompare(b.dateSort));
  }, [respostas]);

  // Dados filtrados para gráfico de linha única
  const evolucaoDataFiltered = useMemo(() => {
    if (chartFilter === "todos") return evolucaoData;
    
    const keyMap: Record<string, string> = {
      geral: "nps_geral",
      pos_instalacao: "nps_instalacao",
      pos_os: "nps_os",
      pos_atendimento: "nps_atendimento",
    };
    
    return evolucaoData.map(d => ({
      ...d,
      nps: d[keyMap[chartFilter] as keyof typeof d],
    }));
  }, [evolucaoData, chartFilter]);

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
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
      {/* Gráfico 1 - Evolução */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">📈 Evolução do NPS</CardTitle>
            <Select value={chartFilter} onValueChange={setChartFilter}>
              <SelectTrigger className="w-[140px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="geral">Geral</SelectItem>
                <SelectItem value="pos_instalacao">Pós-Instalação</SelectItem>
                <SelectItem value="pos_os">Pós-O.S</SelectItem>
                <SelectItem value="pos_atendimento">Pós-Atendimento</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartFilter === "todos" ? evolucaoData : evolucaoDataFiltered}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" fontSize={11} />
              <YAxis domain={[-100, 100]} fontSize={11} />
              <Tooltip />
              {chartFilter === "todos" ? (
                <>
                  <Line 
                    type="monotone" 
                    dataKey="nps_instalacao" 
                    name="Pós-Instalação"
                    stroke={COLORS.pos_instalacao}
                    strokeWidth={2}
                    dot={{ fill: COLORS.pos_instalacao, r: 3 }}
                    connectNulls
                  />
                  <Line 
                    type="monotone" 
                    dataKey="nps_os" 
                    name="Pós-O.S"
                    stroke={COLORS.pos_os}
                    strokeWidth={2}
                    dot={{ fill: COLORS.pos_os, r: 3 }}
                    connectNulls
                  />
                  <Line 
                    type="monotone" 
                    dataKey="nps_atendimento" 
                    name="Pós-Atendimento"
                    stroke={COLORS.pos_atendimento}
                    strokeWidth={2}
                    dot={{ fill: COLORS.pos_atendimento, r: 3 }}
                    connectNulls
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    formatter={(value) => <span className="text-xs">{value}</span>}
                  />
                </>
              ) : (
                <Line 
                  type="monotone" 
                  dataKey="nps" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

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
  );
});

NPSCharts.displayName = "NPSCharts";
