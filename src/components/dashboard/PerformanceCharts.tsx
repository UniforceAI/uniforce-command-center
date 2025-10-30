import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chamado } from "@/types/chamado";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface PerformanceChartsProps {
  chamados: Chamado[];
}

export function PerformanceCharts({ chamados }: PerformanceChartsProps) {
  // Dados para gráfico de urgência (rosca)
  const urgenciaData = [
    {
      name: "Alta",
      value: chamados.filter((c) => c.Urgência === "Alta").length,
      color: "hsl(var(--destructive))",
    },
    {
      name: "Média",
      value: chamados.filter((c) => c.Urgência === "Média").length,
      color: "hsl(var(--warning))",
    },
    {
      name: "Baixa",
      value: chamados.filter((c) => c.Urgência === "Baixa").length,
      color: "hsl(var(--success))",
    },
  ];

  // Dados para tempo de atendimento por responsável
  const responsaveisMap = new Map<string, { total: number; count: number }>();
  chamados.forEach((chamado) => {
    const responsavel = chamado.Responsável.split(" ")[0]; // Pega primeiro nome
    const tempo = chamado["Tempo de Atendimento"];
    
    // Converter tempo para horas (simplificado)
    let horas = 0;
    if (tempo.includes("h")) {
      horas = parseInt(tempo.split("h")[0]);
    } else if (tempo.includes("min")) {
      horas = parseInt(tempo.split("min")[0]) / 60;
    }

    if (!responsaveisMap.has(responsavel)) {
      responsaveisMap.set(responsavel, { total: 0, count: 0 });
    }
    const current = responsaveisMap.get(responsavel)!;
    current.total += horas;
    current.count += 1;
  });

  const responsaveisData = Array.from(responsaveisMap.entries())
    .map(([nome, data]) => ({
      nome,
      media: data.count > 0 ? (data.total / data.count).toFixed(1) : 0,
    }))
    .slice(0, 6); // Top 6 responsáveis

  // Dados de classificação por setor
  const setorClassificacaoMap = new Map<string, Record<string, number>>();
  chamados.forEach((chamado) => {
    const setor = chamado.Setor;
    const classificacao = chamado.Classificação;

    if (!setorClassificacaoMap.has(setor)) {
      setorClassificacaoMap.set(setor, {
        Rápido: 0,
        Normal: 0,
        Lento: 0,
        Reincidente: 0,
      });
    }
    setorClassificacaoMap.get(setor)![classificacao] += 1;
  });

  const setorData = Array.from(setorClassificacaoMap.entries()).map(([setor, data]) => ({
    setor,
    ...data,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Gráfico de Urgência (Rosca) */}
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de Urgência</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={urgenciaData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {urgenciaData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tempo Médio por Responsável */}
      <Card>
        <CardHeader>
          <CardTitle>Tempo Médio de Atendimento (horas)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={responsaveisData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="nome" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="media" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Classificação por Setor */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Classificação por Setor</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={setorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="setor" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Rápido" stackId="a" fill="hsl(var(--success))" />
              <Bar dataKey="Normal" stackId="a" fill="hsl(var(--primary))" />
              <Bar dataKey="Lento" stackId="a" fill="hsl(var(--warning))" />
              <Bar dataKey="Reincidente" stackId="a" fill="hsl(var(--destructive))" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
