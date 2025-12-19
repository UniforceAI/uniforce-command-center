import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Chamado } from "@/types/chamado";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { KPICard } from "@/components/dashboard/KPICard";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { ClientesTable } from "@/components/dashboard/ClientesTable";
import { ClienteDetailsSheet } from "@/components/dashboard/ClienteDetailsSheet";
import { PerformanceCharts } from "@/components/dashboard/PerformanceCharts";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { Phone, Clock, RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Chamado | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [periodo, setPeriodo] = useState("7");
  const [status, setStatus] = useState("todos");
  const [urgencia, setUrgencia] = useState("todas");
  const [setor, setSetor] = useState("todos");

  // Verificar autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Buscar dados do banco - em batches para superar limite de 1000
  useEffect(() => {
    if (!user) return;
    
    const fetchChamados = async () => {
      try {
        setIsLoading(true);
        console.log("🔄 Buscando chamados do banco...");

        // Primeiro, obter a contagem total
        const { count: totalCount, error: countError } = await supabase
          .from("chamados")
          .select("*", { count: "exact", head: true });

        if (countError) throw countError;

        console.log(`📊 Total de registros no banco: ${totalCount}`);

        // Buscar em batches de 1000
        const BATCH_SIZE = 1000;
        const totalBatches = Math.ceil((totalCount || 0) / BATCH_SIZE);
        let allData: any[] = [];

        for (let i = 0; i < totalBatches; i++) {
          const start = i * BATCH_SIZE;
          const end = start + BATCH_SIZE - 1;
          
          console.log(`📥 Buscando batch ${i + 1}/${totalBatches} (${start}-${end})...`);
          
          const { data, error } = await supabase
            .from("chamados")
            .select("*")
            .order("data_abertura", { ascending: false })
            .range(start, end);

          if (error) throw error;
          
          if (data) {
            allData = [...allData, ...data];
          }
        }

        console.log(`✅ Total de registros buscados: ${allData.length}`);

        // Transformar dados do banco para o formato esperado
        const chamadosTransformados: Chamado[] = allData.map((item: any) => ({
          "ID Cliente": item.id_cliente,
          "Qtd. Chamados": item.qtd_chamados,
          Protocolo: item.protocolo,
          "Data de Abertura": item.data_abertura,
          "Última Atualização": item.ultima_atualizacao,
          Responsável: item.responsavel,
          Setor: item.setor,
          Categoria: item.categoria,
          "Motivo do Contato": item.motivo_contato,
          Origem: item.origem,
          Solicitante: item.solicitante,
          Urgência: item.urgencia,
          Status: item.status,
          "Dias ultimo chamado": item.dias_desde_ultimo,
          "Tempo de Atendimento": item.tempo_atendimento,
          Classificação: item.classificacao,
          Insight: item.insight,
          "Chamados Anteriores": item.chamados_anteriores,
          _id: item.id, // ID único do banco
        }));

        console.log(`✅ ${chamadosTransformados.length} chamados transformados`);

        // Log de debug: contar chamados por cliente ALLAN
        const allanChamados = chamadosTransformados.filter(c => 
          c.Solicitante?.toLowerCase().includes('allan')
        );
        console.log(`🔍 Chamados do ALLAN encontrados: ${allanChamados.length}`, allanChamados);

        setChamados(chamadosTransformados);
      } catch (error: any) {
        console.error("❌ Erro ao buscar chamados:", error);
        toast({
          title: "Erro ao carregar dados",
          description: "Não foi possível carregar os chamados. Tente novamente.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchChamados();

  }, [user, toast]);

  // Aplicar filtros com useMemo
  const filteredChamados = useMemo(() => {
    let filtered = [...chamados];

    // Filtro por período baseado na data de abertura
    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const agora = new Date();
      // SEMPRE zerar horas para comparação correta de datas
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
      let dataLimite: Date;
      
      if (diasAtras === 0) {
        // Hoje: desde 00:00 de hoje
        dataLimite = hoje;
      } else if (diasAtras === 1) {
        // Ontem: desde 00:00 de ontem
        dataLimite = new Date(hoje);
        dataLimite.setDate(dataLimite.getDate() - 1);
      } else {
        // X dias atrás - IMPORTANTE: zerar horas
        dataLimite = new Date(hoje);
        dataLimite.setDate(dataLimite.getDate() - diasAtras);
      }

      filtered = filtered.filter((c) => {
        try {
          // Converter string DD/MM/YYYY HH:MM:SS para Date
          const dataString = c["Data de Abertura"];
          const [datePart] = dataString.split(" "); // Separar data de hora
          const [dia, mes, ano] = datePart.split("/");
          // Criar data zerada (sem horas) para comparação justa
          const dataAbertura = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 0, 0, 0);
          return dataAbertura >= dataLimite;
        } catch (e) {
          console.error("Erro ao parsear data:", c["Data de Abertura"], e);
          return true; // Incluir em caso de erro
        }
      });
    }

    if (status !== "todos") {
      filtered = filtered.filter((c) => c.Status === status);
    }

    if (urgencia !== "todas") {
      filtered = filtered.filter((c) => c.Urgência === urgencia);
    }

    if (setor !== "todos") {
      filtered = filtered.filter((c) => {
        const setorChamado = c.Setor?.trim() || "";
        const setorFiltro = setor.trim();
        return setorChamado === setorFiltro;
      });
    }

    return filtered;
  }, [chamados, status, urgencia, setor, periodo]);

  // Calcular KPIs com useMemo
  const kpis = useMemo(() => {
    const totalChamados = filteredChamados.length;
    const chamadosResolvidos = filteredChamados.filter(
      (c) => c.Status === "Resolvido" || c.Status === "Fechado",
    ).length;
    const chamadosAbertos = filteredChamados.filter((c) => c.Status === "Novo" || c.Status === "Em Andamento").length;
    const reincidentes = filteredChamados.filter((c) => c.Classificação === "Reincidente").length;
    const percentualReincidentes = totalChamados > 0 ? ((reincidentes / totalChamados) * 100).toFixed(1) : "0";

    // Calcular tempo médio
    let totalHoras = 0;
    let count = 0;

    filteredChamados.forEach((chamado) => {
      const tempo = chamado["Tempo de Atendimento"];
      
      // Converter para número se for string ou número
      let horas = 0;
      
      if (typeof tempo === 'number') {
        horas = tempo;
      } else if (typeof tempo === 'string') {
        if (tempo.includes("d")) {
          const dias = parseFloat(tempo.split("d")[0]);
          horas = dias * 24;
        } else if (tempo.includes("h")) {
          horas = parseFloat(tempo.split("h")[0]);
        } else if (tempo.includes("min")) {
          horas = parseFloat(tempo.split("min")[0]) / 60;
        } else {
          // Tentar parsear como número
          const parsed = parseFloat(tempo);
          if (!isNaN(parsed)) {
            horas = parsed;
          }
        }
      }
      
      if (horas > 0) {
        totalHoras += horas;
        count++;
      }
    });

    const tempoMedio = count > 0 ? (totalHoras / count).toFixed(1) : "0";
    const percentualAbertos = totalChamados > 0 ? ((chamadosAbertos / totalChamados) * 100).toFixed(0) : "0";

    // Urgência
    const urgenciaAlta = filteredChamados.filter((c) => c.Urgência === "Alta").length;
    const urgenciaMedia = filteredChamados.filter((c) => c.Urgência === "Média").length;
    const urgenciaBaixa = filteredChamados.filter((c) => c.Urgência === "Baixa").length;

    return {
      totalChamados,
      chamadosResolvidos,
      chamadosAbertos,
      reincidentes,
      percentualReincidentes,
      tempoMedio,
      percentualAbertos,
      urgenciaAlta,
      urgenciaMedia,
      urgenciaBaixa,
    };
  }, [filteredChamados]);

  const handleClienteClick = useCallback((chamado: Chamado) => {
    setSelectedCliente(chamado);
    setSheetOpen(true);
  }, []);

  // Função auxiliar para parsear data
  const parseData = (dataStr: string) => {
    try {
      const [datePart, timePart] = dataStr.split(" ");
      const [dia, mes, ano] = datePart.split("/");
      const [hora, min, seg] = (timePart || "00:00:00").split(":");
      return new Date(
        parseInt(ano),
        parseInt(mes) - 1,
        parseInt(dia),
        parseInt(hora || "0"),
        parseInt(min || "0"),
        parseInt(seg || "0"),
      ).getTime();
    } catch (e) {
      console.error("Erro ao parsear data:", dataStr, e);
      return 0;
    }
  };

  // Agrupar e processar clientes com useMemo
  const clientesCriticos = useMemo(() => {
    // Agrupar TODOS os chamados por ID Cliente
    const todosChamadosPorCliente = chamados.reduce(
      (acc, chamado) => {
        const idCliente = Number(chamado["ID Cliente"]);

        if (isNaN(idCliente)) {
          console.warn("ID Cliente inválido:", chamado["ID Cliente"], chamado);
          return acc;
        }

        if (!acc[idCliente]) {
          acc[idCliente] = {
            principal: chamado,
            todos: [chamado],
          };
        } else {
          acc[idCliente].todos.push(chamado);

          const dataAtual = parseData(acc[idCliente].principal["Data de Abertura"]);
          const dataNovo = parseData(chamado["Data de Abertura"]);

          if (dataNovo > dataAtual) {
            acc[idCliente].principal = chamado;
          }
        }

        return acc;
      },
      {} as Record<number, { principal: Chamado; todos: Chamado[] }>,
    );

    // Corrigir a quantidade real de chamados
    Object.entries(todosChamadosPorCliente).forEach(([idCliente, { principal, todos }]) => {
      const qtdReal = todos.length;
      principal["Qtd. Chamados"] = qtdReal;
    });

    // Aplicar filtros para decidir quais CLIENTES mostrar
    let clientesParaMostrar = Object.values(todosChamadosPorCliente);

    // Filtrar por período baseado no chamado mais recente
    if (periodo !== "todos") {
      const diasAtras = parseInt(periodo);
      const agora = new Date();
      // SEMPRE zerar horas para comparação correta
      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0);
      let dataLimite: Date;
      
      if (diasAtras === 0) {
        // Hoje: desde 00:00 de hoje
        dataLimite = hoje;
      } else if (diasAtras === 1) {
        // Ontem: desde 00:00 de ontem
        dataLimite = new Date(hoje);
        dataLimite.setDate(dataLimite.getDate() - 1);
      } else {
        // X dias atrás - IMPORTANTE: zerar horas
        dataLimite = new Date(hoje);
        dataLimite.setDate(dataLimite.getDate() - diasAtras);
      }

      clientesParaMostrar = clientesParaMostrar.filter(({ principal }) => {
        try {
          const dataString = principal["Data de Abertura"];
          const [datePart] = dataString.split(" ");
          const [dia, mes, ano] = datePart.split("/");
          // Criar data zerada para comparação justa
          const dataAbertura = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia), 0, 0, 0);
          return dataAbertura >= dataLimite;
        } catch (e) {
          return true;
        }
      });
    }

    // Filtrar por status, urgência e setor no chamado principal
    if (status !== "todos") {
      clientesParaMostrar = clientesParaMostrar.filter(({ principal }) => principal.Status === status);
    }

    if (urgencia !== "todas") {
      clientesParaMostrar = clientesParaMostrar.filter(({ principal }) => principal.Urgência === urgencia);
    }

    if (setor !== "todos") {
      clientesParaMostrar = clientesParaMostrar.filter(({ principal }) => {
        const setorChamado = principal.Setor?.trim() || "";
        const setorFiltro = setor.trim();
        return setorChamado === setorFiltro;
      });
    }

    // Converter para array com chamados anteriores e ordenar
    return clientesParaMostrar
      .map(({ principal, todos }) => {
        const ordenados = [...todos].sort((a, b) => {
          return parseData(b["Data de Abertura"]) - parseData(a["Data de Abertura"]);
        });

        const chamadosAnteriores = ordenados.slice(1);

        return {
          ...principal,
          "Qtd. Chamados": todos.length,
          _chamadosAnteriores: chamadosAnteriores,
        };
      })
      .sort((a, b) => b["Qtd. Chamados"] - a["Qtd. Chamados"]);
  }, [chamados, periodo, status, urgencia, setor]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Monitor de Atendimento e Reincidência
              </h1>
              <p className="text-muted-foreground mt-1">Agy Telecom</p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Carregando dados...</p>
            </div>
          </div>
        ) : chamados.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Nenhum chamado encontrado</h3>
                <p className="text-muted-foreground">Aguardando dados do n8n...</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Filtros */}
            <DashboardFilters
              periodo={periodo}
              status={status}
              urgencia={urgencia}
              setor={setor}
              onPeriodoChange={setPeriodo}
              onStatusChange={setStatus}
              onUrgenciaChange={setUrgencia}
              onSetorChange={setSetor}
            />

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              <KPICard
                title="Total de Chamados"
                value={kpis.totalChamados}
                subtitle="no período"
                icon={Phone}
                variant="default"
              />
              <KPICard
                title="Tempo Médio"
                value={`${kpis.tempoMedio}h`}
                subtitle="de atendimento"
                icon={Clock}
                variant="default"
              />
              <KPICard
                title="Reincidentes"
                value={`${kpis.percentualReincidentes}%`}
                subtitle={`${kpis.reincidentes} chamados`}
                icon={RefreshCcw}
                variant="destructive"
                detalhes={filteredChamados
                  .filter((c) => c.Classificação === "Reincidente")
                  .map((c) => ({ id: c["ID Cliente"], label: c["Motivo do Contato"] }))}
              />
              <KPICard
                title="Resolvidos < 24h"
                value={`${((kpis.chamadosResolvidos / kpis.totalChamados) * 100).toFixed(0)}%`}
                subtitle={`${kpis.chamadosResolvidos} chamados`}
                icon={CheckCircle2}
                variant="success"
              />
              <KPICard
                title="Chamados Abertos"
                value={`${kpis.percentualAbertos}%`}
                subtitle={`${kpis.chamadosAbertos} ativos`}
                icon={AlertCircle}
                variant="warning"
                detalhes={filteredChamados
                  .filter((c) => c.Status === "Novo" || c.Status === "Em Andamento")
                  .map((c) => ({ id: c["ID Cliente"], label: c.Status }))}
              />
              <KPICard
                title="Urgência"
                value={kpis.urgenciaAlta}
                subtitle={`Alta | ${kpis.urgenciaMedia} Média | ${kpis.urgenciaBaixa} Baixa`}
                icon={AlertCircle}
                variant={kpis.urgenciaAlta > 0 ? "destructive" : "default"}
                detalhes={filteredChamados
                  .filter((c) => c.Urgência === "Alta")
                  .map((c) => ({ id: c["ID Cliente"], label: c["Motivo do Contato"] }))}
              />
            </div>

            {/* Gráficos de Performance */}
            <div>
              <h2 className="text-2xl font-bold mb-4">📊 Performance e Tendências</h2>
              <PerformanceCharts chamados={filteredChamados} />
            </div>

            {/* Clientes Críticos */}
            <div>
              <h2 className="text-2xl font-bold mb-4">🔴 Clientes Críticos</h2>
              <ClientesTable chamados={clientesCriticos} onClienteClick={handleClienteClick} />
            </div>

            {/* Insights */}
            <div>
              <h2 className="text-2xl font-bold mb-4">💡 Insights Automáticos</h2>
              <InsightsPanel chamados={filteredChamados} />
            </div>
          </>
        )}
      </main>

      {/* Sheet de Detalhes */}
      <ClienteDetailsSheet chamado={selectedCliente} open={sheetOpen} onOpenChange={setSheetOpen} />
    </div>
  );
};

export default Index;
