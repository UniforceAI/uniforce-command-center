import { useEffect, useState } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";

const EventosDebug = () => {
  const [data, setData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEventos = async () => {
      try {
        console.log("🔍 Buscando dados da tabela 'eventos' para isp_id='d-kiros'...");
        
        const { data: eventosData, error: eventosError } = await externalSupabase
          .from("eventos")
          .select("*")
          .eq("isp_id", "d-kiros")
          .limit(10);

        if (eventosError) {
          console.error("❌ Erro:", eventosError);
          setError(eventosError.message);
          return;
        }

        console.log("✅ Dados recebidos:", eventosData);
        
        if (eventosData && eventosData.length > 0) {
          setColumns(Object.keys(eventosData[0]));
          setData(eventosData);
          
          // Log detalhado das colunas
          console.log("📋 COLUNAS DA TABELA EVENTOS:");
          Object.keys(eventosData[0]).forEach((col, i) => {
            console.log(`  ${i + 1}. ${col}: ${typeof eventosData[0][col]} -> exemplo: ${JSON.stringify(eventosData[0][col])}`);
          });
        } else {
          console.log("⚠️ Nenhum dado encontrado para d-kiros");
        }
      } catch (err: any) {
        console.error("❌ Erro catch:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEventos();
  }, []);

  if (loading) return <div className="p-8">Carregando...</div>;
  if (error) return <div className="p-8 text-red-500">Erro: {error}</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Debug: Tabela Eventos (d-kiros)</h1>
      
      <div className="bg-card p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Colunas encontradas ({columns.length}):</h2>
        <ul className="list-disc pl-6 space-y-1">
          {columns.map((col) => (
            <li key={col} className="font-mono text-sm">{col}</li>
          ))}
        </ul>
      </div>

      <div className="bg-card p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Dados de exemplo ({data.length} registros):</h2>
        <pre className="text-xs overflow-auto max-h-96 bg-muted p-4 rounded">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default EventosDebug;
