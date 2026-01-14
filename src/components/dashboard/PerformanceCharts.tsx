import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Chamado } from "@/types/chamado";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface PerformanceChartsProps {
  chamados: Chamado[];
}

export const PerformanceCharts = memo(({ chamados }: PerformanceChartsProps) => {
  // Memoizar dados de gráficos
  const { motivosData, responsaveisData, setorData } = useMemo(() => {
    // Dados para principais motivos de chamados
    const motivosMap = new Map<string, number>();
    chamados.forEach((chamado) => {
      const motivo = chamado["Motivo do Contato"];
      motivosMap.set(motivo, (motivosMap.get(motivo) || 0) + 1);
    });

    const motivosData = Array.from(motivosMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Dados para tempo de atendimento por responsável
    const responsaveisMap = new Map<string, { total: number; count: number }>();
    chamados.forEach((chamado) => {
      // Null check para Responsável
      const responsavelRaw = chamado.Responsável;
      if (!responsavelRaw) return; // Skip se não tem responsável
      
      const responsavel = responsavelRaw.split(" ")[0];
      const tempo = chamado["Tempo de Atendimento"];
      
      let horas = 0;
      if (typeof tempo === 'number') {
        horas = tempo;
      } else if (typeof tempo === 'string' && tempo.trim() !== '') {
        // Formato "Aberto há X.Xd" - extrair dias e converter para horas
        const abertoMatch = tempo.match(/Aberto há ([\d.]+)d/i);
        if (abertoMatch) {
          const dias = parseFloat(abertoMatch[1]);
          if (!isNaN(dias)) {
            horas = dias * 24;
          }
        }
        // Formato com "d" para dias
        else if (tempo.includes("d")) {
          const match = tempo.match(/([\d.]+)d/);
          if (match) {
            horas = parseFloat(match[1]) * 24;
          }
        }
        // Formato com "h" para horas
        else if (tempo.includes("h")) {
          const match = tempo.match(/([\d.]+)h/);
          if (match) {
            horas = parseFloat(match[1]);
          }
        }
        // Formato com "min" para minutos
        else if (tempo.includes("min")) {
          const match = tempo.match(/([\d.]+)min/);
          if (match) {
            horas = parseFloat(match[1]) / 60;
          }
        }
        // Número puro
        else {
          const parsed = parseFloat(tempo);
          if (!isNaN(parsed)) {
            horas = parsed;
          }
        }
      }

      // Só adicionar se tiver horas válidas
      if (horas > 0 && !isNaN(horas)) {
        if (!responsaveisMap.has(responsavel)) {
          responsaveisMap.set(responsavel, { total: 0, count: 0 });
        }
        const current = responsaveisMap.get(responsavel)!;
        current.total += horas;
        current.count += 1;
      }
    });

    const responsaveisData = Array.from(responsaveisMap.entries())
      .map(([nome, data]) => ({
        nome,
        media: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
      }))
      .filter(item => item.media > 0)
      .sort((a, b) => b.media - a.media)
      .slice(0, 6);

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

    return { motivosData, responsaveisData, setorData };
  }, [chamados]);

  const coresMotivos = [
    "hsl(var(--destructive))",
    "hsl(var(--warning))",
    "hsl(var(--success))",
    "hsl(var(--primary))",
    "hsl(var(--secondary))",
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Gráfico de Principais Motivos (Rosca) */}
      <Card>
        <CardHeader>
          <CardTitle>Principais Motivos de Chamados</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={motivosData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {motivosData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={coresMotivos[index % coresMotivos.length]} />
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
          <CardTitle>Tempo Médio de Atendimento</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={responsaveisData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number" 
                tickFormatter={(value) => {
                  if (value >= 24) {
                    return `${(value / 24).toFixed(1)}d`;
                  }
                  return `${value.toFixed(1)}h`;
                }}
              />
              <YAxis dataKey="nome" type="category" width={100} />
              <Tooltip 
                formatter={(value: number) => {
                  if (value >= 24) {
                    const dias = (value / 24).toFixed(1);
                    return [`${dias} dias`, 'Tempo Médio'];
                  }
                  if (value < 1) {
                    const min = Math.round(value * 60);
                    return [`${min} min`, 'Tempo Médio'];
                  }
                  return [`${value.toFixed(1)}h`, 'Tempo Médio'];
                }}
              />
              <Bar 
                dataKey="media" 
                fill="hsl(var(--primary))" 
                radius={[0, 8, 8, 0]}
                label={({ x, y, width, value }) => (
                  <text 
                    x={x + width + 5} 
                    y={y + 12} 
                    fill="hsl(var(--foreground))" 
                    fontSize={12}
                  >
                    {value >= 24 ? `${(value / 24).toFixed(1)}d` : value < 1 ? `${Math.round(value * 60)}min` : `${value.toFixed(1)}h`}
                  </text>
                )}
              />
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
});
