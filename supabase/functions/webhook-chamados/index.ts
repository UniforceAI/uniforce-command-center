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
    console.log('📥 Recebendo dados do n8n...');
    
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

    // Transformar dados do formato do n8n para o formato do banco
    const chamadosParaInserir = requestData.map((item: any) => ({
      id_cliente: item["ID Cliente"],
      qtd_chamados: item["Qtd. Chamados"],
      protocolo: item["Protocolo"],
      data_abertura: item["Data de Abertura"],
      ultima_atualizacao: item["Última Atualização"],
      responsavel: item["Responsável"],
      setor: item["Setor"],
      categoria: item["Categoria"],
      motivo_contato: item["Motivo do Contato"],
      origem: item["Origem"],
      solicitante: item["Solicitante"],
      urgencia: item["Urgência"],
      status: item["Status"],
      dias_desde_ultimo: item["Dias desde Último Chamado"],
      tempo_atendimento: item["Tempo de Atendimento"],
      classificacao: item["Classificação"],
      insight: item["Insight"],
      chamados_anteriores: item["Chamados Anteriores"],
    }));

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