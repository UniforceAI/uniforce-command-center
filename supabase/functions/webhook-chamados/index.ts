import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📥 Recebendo requisição do webhook...');
    
    // Validar autenticação via secret
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    const authHeader = req.headers.get('x-webhook-secret');
    
    if (!authHeader || authHeader !== webhookSecret) {
      console.error('❌ Autenticação falhou - secret inválido ou ausente');
      return new Response(
        JSON.stringify({ error: 'Não autorizado. Secret inválido ou ausente.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('✅ Autenticação validada');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const requestData = await req.json();
    console.log(`📊 Total de chamados recebidos: ${requestData?.length || 0}`);

    if (!requestData || !Array.isArray(requestData)) {
      console.error('❌ Formato de dados inválido');
      return new Response(
        JSON.stringify({ error: 'Formato de dados inválido. Esperado: array de chamados' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limpar tabela antes de inserir novos dados
    console.log('🗑️ Limpando dados antigos...');
    const { error: deleteError } = await supabase
      .from('chamados')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.error('❌ Erro ao limpar dados:', deleteError);
      throw deleteError;
    }

    // Validar e transformar dados do formato do n8n para o formato do banco
    const chamadosParaInserir = requestData.map((item: any, index: number) => {
      // Validação de campos obrigatórios
      if (!item["ID Cliente"] || typeof item["ID Cliente"] !== 'string') {
        throw new Error(`Chamado ${index + 1}: Campo "ID Cliente" é obrigatório e deve ser texto`);
      }
      
      if (!item["Protocolo"] || typeof item["Protocolo"] !== 'string') {
        throw new Error(`Chamado ${index + 1}: Campo "Protocolo" é obrigatório e deve ser texto`);
      }
      
      // Validar campos numéricos
      const qtdChamados = item["Qtd. Chamados"];
      if (qtdChamados !== null && qtdChamados !== undefined && typeof qtdChamados !== 'number') {
        throw new Error(`Chamado ${index + 1}: Campo "Qtd. Chamados" deve ser numérico`);
      }
      
      const diasDesdeUltimo = item["Dias desde Último Chamado"];
      if (diasDesdeUltimo !== null && diasDesdeUltimo !== undefined && typeof diasDesdeUltimo !== 'number') {
        throw new Error(`Chamado ${index + 1}: Campo "Dias desde Último Chamado" deve ser numérico`);
      }
      
      const tempoAtendimento = item["Tempo de Atendimento"];
      if (tempoAtendimento !== null && tempoAtendimento !== undefined && typeof tempoAtendimento !== 'number') {
        throw new Error(`Chamado ${index + 1}: Campo "Tempo de Atendimento" deve ser numérico`);
      }
      
      // Limitar tamanho de strings para prevenir ataques
      const maxStringLength = 1000;
      const truncateString = (str: any) => {
        if (typeof str !== 'string') return str;
        return str.length > maxStringLength ? str.substring(0, maxStringLength) : str;
      };
      
      return {
        id_cliente: truncateString(item["ID Cliente"]),
        qtd_chamados: qtdChamados,
        protocolo: truncateString(item["Protocolo"]),
        data_abertura: item["Data de Abertura"] || null,
        ultima_atualizacao: item["Última Atualização"] || null,
        responsavel: truncateString(item["Responsável"]) || null,
        setor: truncateString(item["Setor"]) || null,
        categoria: truncateString(item["Categoria"]) || null,
        motivo_contato: truncateString(item["Motivo do Contato"]) || null,
        origem: truncateString(item["Origem"]) || null,
        solicitante: truncateString(item["Solicitante"]) || null,
        urgencia: truncateString(item["Urgência"]) || null,
        status: truncateString(item["Status"]) || null,
        dias_desde_ultimo: diasDesdeUltimo,
        tempo_atendimento: tempoAtendimento,
        classificacao: truncateString(item["Classificação"]) || null,
        insight: truncateString(item["Insight"]) || null,
        chamados_anteriores: item["Chamados Anteriores"] || null,
      };
    });

    console.log('💾 Inserindo novos dados...');
    const { data: insertedData, error: insertError } = await supabase
      .from('chamados')
      .insert(chamadosParaInserir)
      .select();

    if (insertError) {
      console.error('❌ Erro ao inserir dados:', insertError);
      throw insertError;
    }

    console.log(`✅ ${insertedData?.length || 0} chamados inseridos com sucesso`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `${insertedData?.length || 0} chamados processados com sucesso`,
        totalRecebidos: requestData.length,
        totalInseridos: insertedData?.length || 0
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro no webhook:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.details || 'Erro ao processar dados'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});