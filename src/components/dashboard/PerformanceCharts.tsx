import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chamado } from "@/types/chamado";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowUpDown } from "lucide-react";

interface PerformanceChartsProps {
  chamados: Chamado[];
}

export const PerformanceCharts = memo(({ chamados }: PerformanceChartsProps) => {
  const [ordemCrescente, setOrdemCrescente] = useState(true);
  
  // Memoizar dados de gráficos
  const { motivosData, responsaveisDataBase, setorData } = useMemo(() => {
    // Dados para principais motivos de chamados
    const motivosMap = new Map<string, number>();
    chamados.forEach((chamado) => {
      const motivo = chamado["Motivo do Contato"];
      motivosMap.set(motivo, (motivosMap.get(motivo) || 0) + 1);
    });

    const motivosData = Array.from(motivosMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

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

    const responsaveisDataBase = Array.from(responsaveisMap.entries())
      .map(([nome, data]) => ({
        nome,
        media: data.count > 0 ? parseFloat((data.total / data.count).toFixed(1)) : 0,
        count: data.count,
      }))
      .filter(item => item.media > 0 && item.count >= 3); // Mínimo 3 chamados para ser relevante

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

    return { motivosData, responsaveisDataBase, setorData };
  }, [chamados]);

  // Ordenar responsáveis com base no estado (filtra itens com media > 0)
  const responsaveisData = useMemo(() => {
    return [...responsaveisDataBase]
      .filter(r => r.media > 0)
      .sort((a, b) => 
        ordemCrescente ? a.media - b.media : b.media - a.media
      );
  }, [responsaveisDataBase, ordemCrescente]);

  const coresMotivos = [
    "hsl(var(--destructive))",
    "hsl(142, 76%, 36%)",
    "hsl(var(--warning))",
    "hsl(var(--primary))",
    "hsl(217, 91%, 60%)",
    "hsl(280, 65%, 60%)",
    "hsl(var(--secondary))",
    "hsl(25, 95%, 53%)",
    "hsl(173, 58%, 39%)",
    "hsl(47, 96%, 53%)",
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
                innerRadius={50}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, value, percent }) => {
                  const shortName = name.length > 25 ? name.substring(0, 22) + "..." : name;
                  return percent > 0.05 ? `${shortName}: ${value}` : "";
                }}
                labelLine={{ strokeWidth: 1 }}
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
      <Card className="flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-shrink-0">
          <CardTitle className="text-base font-medium">Tempo Médio de Atendimento</CardTitle>
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
          <div className="overflow-y-auto flex-1 max-h-[280px]">
            <div style={{ height: Math.max(280, responsaveisData.length * 36) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={responsaveisData} layout="vertical" margin={{ right: 60, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    type="number"
                    fontSize={11}
                    orientation="top"
                    tickFormatter={(value) => {
                      if (value >= 24) {
                        return `${(value / 24).toFixed(1)}d`;
                      }
                      return `${value.toFixed(1)}h`;
                    }}
                  />
                  <YAxis 
                    dataKey="nome" 
                    type="category" 
                    width={80} 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.length > 12 ? `${value.substring(0, 12)}...` : value}
                  />
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
                    labelFormatter={(label) => label}
                  />
                  <Bar 
                    dataKey="media" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
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
