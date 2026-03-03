import { useEffect, useState } from "react";
import { externalSupabase } from "@/integrations/supabase/external-client";

const EventosDebug = () => {
  const [results, setResults] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const analyze = async () => {
      const isps = ["igp-fibra", "zen-telecom", "d-kiros"];
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();
      const d90 = new Date(now.getTime() - 90 * 86400000).toISOString();

      const out: Record<string, any> = {};

      for (const isp of isps) {
        // Total with data_cancelamento
        const { data: allCancel, error: e1 } = await externalSupabase
          .from("eventos")
          .select("id, cliente_id, data_cancelamento, event_datetime", { count: "exact" })
          .eq("isp_id", isp)
          .not("data_cancelamento", "is", null)
          .order("data_cancelamento", { ascending: false })
          .limit(20);

        // Count with cancelamento in last 7d
        const { count: c7 } = await externalSupabase
          .from("eventos")
          .select("id", { count: "exact", head: true })
          .eq("isp_id", isp)
          .not("data_cancelamento", "is", null)
          .gte("data_cancelamento", d7);

        // Count with cancelamento in last 30d
        const { count: c30 } = await externalSupabase
          .from("eventos")
          .select("id", { count: "exact", head: true })
          .eq("isp_id", isp)
          .not("data_cancelamento", "is", null)
          .gte("data_cancelamento", d30);

        // Count with cancelamento in last 90d
        const { count: c90 } = await externalSupabase
          .from("eventos")
          .select("id", { count: "exact", head: true })
          .eq("isp_id", isp)
          .not("data_cancelamento", "is", null)
          .gte("data_cancelamento", d90);

        // Total eventos for this ISP
        const { count: totalEventos } = await externalSupabase
          .from("eventos")
          .select("id", { count: "exact", head: true })
          .eq("isp_id", isp);

        // Unique cliente_ids with cancelamento
        const uniqueClientes = allCancel 
          ? new Set(allCancel.map(e => e.cliente_id)).size 
          : 0;

        out[isp] = {
          totalEventos,
          totalComCancelamento: allCancel?.length ?? 0,
          clientesUnicosCancelados: uniqueClientes,
          cancelamentos7d: c7,
          cancelamentos30d: c30,
          cancelamentos90d: c90,
          exemplos: allCancel?.slice(0, 5).map(e => ({
            cliente_id: e.cliente_id,
            data_cancelamento: e.data_cancelamento,
          })),
          error: e1?.message,
        };

        console.log(`📊 ${isp}:`, out[isp]);
      }

      console.log("📅 Referência now():", now.toISOString());
      console.log("📅 Limite 7d:", d7);
      console.log("📅 Limite 30d:", d30);
      console.log("📅 Limite 90d:", d90);

      setResults(out);
      setLoading(false);
    };

    analyze();
  }, []);

  if (loading) return <div className="p-8">Analisando dados de cancelamento...</div>;

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Debug: Cancelamentos por ISP</h1>
      <p className="text-sm text-muted-foreground">
        Data referência: {new Date().toISOString()}
      </p>
      
      {Object.entries(results).map(([isp, data]) => (
        <div key={isp} className="bg-card p-4 rounded-lg border">
          <h2 className="font-semibold text-lg mb-2">{isp}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div><span className="text-muted-foreground text-sm">Total eventos:</span> <strong>{data.totalEventos}</strong></div>
            <div><span className="text-muted-foreground text-sm">Com cancelamento:</span> <strong>{data.totalComCancelamento}</strong></div>
            <div><span className="text-muted-foreground text-sm">Cancelamentos 7d:</span> <strong>{data.cancelamentos7d}</strong></div>
            <div><span className="text-muted-foreground text-sm">Cancelamentos 30d:</span> <strong>{data.cancelamentos30d}</strong></div>
            <div><span className="text-muted-foreground text-sm">Cancelamentos 90d:</span> <strong>{data.cancelamentos90d}</strong></div>
          </div>
          {data.exemplos && data.exemplos.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-1">Últimas datas de cancelamento:</h3>
              <pre className="text-xs bg-muted p-2 rounded">{JSON.stringify(data.exemplos, null, 2)}</pre>
            </div>
          )}
          {data.error && <p className="text-destructive text-sm">Erro: {data.error}</p>}
        </div>
      ))}
    </div>
  );
};

export default EventosDebug;
