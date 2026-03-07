-- ============================================================================
-- MIGRATION: ISP "uniforce" — Ambiente de Desenvolvimento Completo v2
-- Projeto: yqdqmudsnjhixtxldqwi | Data: 2026-03-07
-- ============================================================================

-- STEP 1: Configuração do ISP uniforce
UPDATE public.isps SET
  isp_nome                = 'Uniforce [DEV]',
  ativo                   = true,
  stripe_billing_source   = 'stripe',
  stripe_test_customer_id = 'cus_U6QGkUiy7W7ZMg',
  stripe_test_mode_enabled = true,
  onboarding_status       = 'complete',
  nps_config              = '{"ativo": true}'::jsonb
WHERE isp_id = 'uniforce';

-- STEP 2: nps_config
INSERT INTO public.nps_config (
  isp_id, contrato_meses_disparo, os_horas_apos_fechamento,
  atendimento_horas_apos_fechamento, filtrar_inadimplentes, filtrar_inativos,
  filtrar_cancelados, limite_envios_diarios, horario_inicio, horario_fim,
  template_contrato_pf, template_contrato_pj,
  template_os_pf, template_os_pj, template_atendimento_pf, template_atendimento_pj,
  ativo
) VALUES (
  'uniforce', ARRAY[3,6,12], 24, 48, true, true, false, 100,
  '08:00', '20:00',
  'Olá {nome}! Como avalia a Uniforce? Nota de 0 a 10:',
  'Olá {empresa}! Como avalia nosso serviço? Nota de 0 a 10:',
  'Olá {nome}! OS concluída. Como avalia o suporte? Nota de 0 a 10:',
  'Olá {empresa}! OS concluída. Avalie de 0 a 10:',
  'Olá {nome}! Atendimento encerrado. Qual sua nota? De 0 a 10:',
  'Olá {empresa}! Atendimento concluído. Avalie de 0 a 10:',
  true
) ON CONFLICT (isp_id) DO UPDATE SET ativo = true;

-- STEP 3: risk_bucket_config
INSERT INTO public.risk_bucket_config (isp_id, ok_max, alert_min, alert_max, critical_min)
VALUES ('uniforce', 30, 31, 64, 65)
ON CONFLICT (isp_id) DO UPDATE SET ok_max=30, alert_min=31, alert_max=64, critical_min=65;

-- STEP 4: Limpeza (idempotente)
DELETE FROM public.churn_history   WHERE isp_id = 'uniforce';
DELETE FROM public.churn_status    WHERE isp_id = 'uniforce';
DELETE FROM public.churn_events    WHERE isp_id = 'uniforce';
DELETE FROM public.nps_check       WHERE isp_id = 'uniforce';
DELETE FROM public.chamados        WHERE isp_id = 'uniforce';
DELETE FROM public.credit_recovery WHERE isp_id = 'uniforce';
DELETE FROM public.crm_comments    WHERE isp_id = 'uniforce';
DELETE FROM public.crm_tags        WHERE isp_id = 'uniforce';
DELETE FROM public.crm_workflow    WHERE isp_id = 'uniforce';
DELETE FROM public.eventos         WHERE isp_id = 'uniforce';

-- STEP 5: Seed via DO block (tipo-seguro)
DO $$
DECLARE
  i        INT;
  cid      INT;  -- cliente_id
  plano_i  INT;
  cidade_i INT;
  bairro_i INT;
  nomes    TEXT[] := ARRAY[
    'Joao Silva','Maria Santos','Pedro Oliveira','Ana Costa','Carlos Souza',
    'Fernanda Lima','Roberto Alves','Juliana Ferreira','Marcos Rodrigues','Patricia Barbosa',
    'Lucas Martins','Camila Pereira','Diego Nunes','Amanda Castro','Felipe Cardoso',
    'Isabela Gomes','Thiago Ribeiro','Leticia Araujo','Bruno Mendes','Rafaela Torres',
    'Gustavo Freitas','Natalia Campos','Rodrigo Moura','Vanessa Correia','Eduardo Pinto',
    'Larissa Teixeira','Vinicius Monteiro','Bianca Carvalho','Matheus Dias','Stephanie Rocha',
    'Gabriel Machado','Priscila Azevedo','Leonardo Ramos','Tatiane Vieira','Henrique Farias',
    'Monique Lopes','Anderson Melo','Cristiane Nascimento','Renato Cunha','Simone Batista',
    'Victor Soares','Aline Medeiros','Fabio Cavalcante','Rosana Andrade','Sergio Moreira',
    'Viviane Duarte','Alex Leite','Gisele Peixoto','Paulo Bastos','Elaine Borges'
  ];
  empresas TEXT[] := ARRAY[
    'TechCom Ltda','Fibra Net Comercial','Redes e Dados ME','InfoSul Comunicacoes',
    'DataLink Telecom','NetBrasil Solucoes','Conecta Digital','Alfa Tecnologia',
    'Beta Sistemas','Gamma Networks','Delta Internet','Epsilon Telecom',
    'Omega Conectividade','Sigma Data','Lambda Tech'
  ];
  planos   TEXT[] := ARRAY[
    'Fibra 100 Mega','Fibra 200 Mega','Fibra 300 Mega','Fibra 500 Mega','Fibra 1 Giga',
    'Fibra Residencial 50M','Fibra Essencial 100M','Fibra Plus 200M',
    'Empresarial 100M','Empresarial 200M','Empresarial 500M'
  ];
  precos   NUMERIC[] := ARRAY[
    69.90,89.90,109.90,149.90,199.90,
    59.90,79.90,119.90,129.90,179.90,299.90
  ];
  downs    INT[] := ARRAY[100,200,300,500,1000,50,100,200,100,200,500];
  ups      INT[] := ARRAY[50,100,150,250,500,25,50,100,50,100,250];
  cidades  TEXT[] := ARRAY[
    'Sao Paulo','Rio de Janeiro','Belo Horizonte','Curitiba','Porto Alegre',
    'Fortaleza','Salvador','Recife','Manaus','Belem',
    'Goiania','Florianopolis','Natal','Campinas','Sao Luis',
    'Maceio','Joao Pessoa','Teresina','Campo Grande','Macapa'
  ];
  estados  TEXT[] := ARRAY[
    'SP','RJ','MG','PR','RS','CE','BA','PE','AM','PA',
    'GO','SC','RN','SP','MA','AL','PB','PI','MS','AP'
  ];
  bairros  TEXT[] := ARRAY[
    'Centro','Jardim America','Vila Nova','Boa Vista','Sao Joao',
    'Parque Industrial','Jardim das Flores','Santa Maria','Bela Vista','Alto da Serra',
    'Residencial Park','Novo Horizonte','Monte Verde','Ipiranga','Mooca'
  ];
  setores     TEXT[] := ARRAY['Suporte Tecnico','Financeiro','Comercial','NOC','Administrativo'];
  categorias  TEXT[] := ARRAY['Sem conexao','Lentidao','Instabilidade','Duvida sobre fatura','Cancelamento','Mudanca de plano','Instalacao','Manutencao','Reclamacao','Solicitacao'];
  motivos     TEXT[] := ARRAY['Sem internet','Velocidade baixa','Conexao instavel','Fatura incorreta','Solicita cancelamento','Upgrade de plano','Nova instalacao','Troca equipamento','Insatisfacao','Informacao planos'];

  -- Cliente vars
  nome     TEXT;
  is_pj    BOOLEAN;
  vmens    NUMERIC;
  stcontrato TEXT;
  stint    TEXT;
  datraso  INT;
  cscore   INT;
  cbucket  TEXT;
  nps      INT;
  dinst    TIMESTAMP WITH TIME ZONE;
  devt     TIMESTAMP WITH TIME ZONE;
  rx_v     NUMERIC;
  tx_v     NUMERIC;
  snr_v    NUMERIC;
  lat_v    NUMERIC;
  s_fin    INT;
  s_sup    INT;
  s_qual   INT;
  s_nps    INT;
  s_comp   INT;
  m_risco  TEXT;
  n_cham   INT;
  d_risco  INT;
  vdia     INT;
  d_cancel TIMESTAMP WITH TIME ZONE;
  fid_str  TEXT;
  j        INT;
  doc_str  TEXT;
  email_str TEXT;
  tel_str  TEXT;
  lat_geo  NUMERIC;
  lng_geo  NUMERIC;
BEGIN
  FOR i IN 1..300 LOOP
    cid      := 70000 + i;
    is_pj    := (random() < 0.25);
    plano_i  := 1 + (random() * 10)::INT;
    IF plano_i > 11 THEN plano_i := 11; END IF;
    vmens    := precos[plano_i];
    cidade_i := 1 + (random() * 19)::INT;
    IF cidade_i > 20 THEN cidade_i := 20; END IF;
    bairro_i := 1 + (random() * 14)::INT;
    IF bairro_i > 15 THEN bairro_i := 15; END IF;

    -- Nome
    IF is_pj THEN
      nome := empresas[1 + (random() * 14)::INT];
    ELSE
      nome := nomes[1 + (random() * 49)::INT];
    END IF;
    IF nome IS NULL THEN nome := 'Cliente ' || cid::TEXT; END IF;

    -- Status contrato/internet
    IF i <= 240 THEN
      stcontrato := 'A';
      stint := CASE WHEN random() < 0.15 THEN 'D' ELSE 'A' END;
    ELSIF i <= 270 THEN
      stcontrato := 'CA';
      stint := 'D';
    ELSE
      stcontrato := 'A';
      stint := 'D';
    END IF;

    -- Atraso
    IF stcontrato = 'CA' THEN
      datraso := 30 + (random() * 120)::INT;
    ELSIF stint = 'D' AND stcontrato = 'A' THEN
      datraso := 5 + (random() * 45)::INT;
    ELSIF random() < 0.3 THEN
      datraso := 1 + (random() * 20)::INT;
    ELSE
      datraso := 0;
    END IF;

    -- Churn score
    IF stcontrato = 'CA' THEN
      cscore  := 80 + (random() * 20)::INT;
      cbucket := 'Crítico';
    ELSIF datraso > 30 THEN
      cscore  := 65 + (random() * 20)::INT;
      cbucket := CASE WHEN cscore >= 80 THEN 'Crítico' ELSE 'Alto' END;
    ELSIF random() < 0.25 THEN
      cscore  := 45 + (random() * 20)::INT;
      cbucket := 'Alto';
    ELSE
      cscore  := (random() * 40)::INT;
      cbucket := 'Baixo';
    END IF;
    IF cscore > 100 THEN cscore := 100; END IF;

    -- NPS
    nps := CASE cbucket
      WHEN 'Baixo'      THEN 8  + (random() * 2)::INT
      WHEN 'Alto'  THEN 5  + (random() * 4)::INT
      WHEN 'Crítico' THEN 1  + (random() * 6)::INT
      ELSE 3 + (random() * 5)::INT
    END;
    IF nps > 10 THEN nps := 10; END IF;
    IF nps < 0  THEN nps := 0;  END IF;

    -- Datas
    dinst := NOW() - make_interval(days := (180 + (random() * 1650)::INT));
    devt  := NOW() - make_interval(days := (random() * 30)::INT);

    -- Sinal ONU
    rx_v  := CASE cbucket WHEN 'Baixo' THEN -18.0 - random()*8 WHEN 'Alto' THEN -22.0 - random()*8 ELSE -26.0 - random()*8 END;
    tx_v  := rx_v + 2 + random() * 3;
    snr_v := CASE cbucket WHEN 'Baixo' THEN 32.0 + random()*8 WHEN 'Alto' THEN 24.0 + random()*8 ELSE 16.0 + random()*8 END;
    lat_v := CASE cbucket WHEN 'Baixo' THEN 5.0 + random()*15 WHEN 'Alto' THEN 20.0 + random()*40 ELSE 80.0 + random()*200 END;

    -- Scores individuais
    s_fin  := CASE WHEN datraso = 0 THEN 0 WHEN datraso <= 7 THEN 8 WHEN datraso <= 30 THEN 18 WHEN datraso <= 60 THEN 25 ELSE 30 END;
    s_sup  := LEAST(25, (random() * 25)::INT);
    s_qual := CASE cbucket WHEN 'Baixo' THEN (random()*15)::INT WHEN 'Alto' THEN 10+(random()*15)::INT ELSE 15+(random()*10)::INT END;
    s_nps  := CASE WHEN nps >= 9 THEN 0 WHEN nps >= 7 THEN 8 WHEN nps >= 5 THEN 14 ELSE 20 END;
    s_comp := (random() * 20)::INT;

    m_risco := CASE cbucket
      WHEN 'Crítico' THEN CASE (random()*3)::INT WHEN 0 THEN 'Alto indice de inadimplencia' WHEN 1 THEN 'Qualidade de sinal degradada' ELSE 'NPS muito baixo' END
      WHEN 'Alto'  THEN CASE (random()*2)::INT WHEN 0 THEN 'Pagamento em atraso' ELSE 'Chamados recorrentes' END
      ELSE NULL
    END;

    n_cham  := CASE cbucket WHEN 'Crítico' THEN 3+(random()*8)::INT WHEN 'Alto' THEN 1+(random()*4)::INT ELSE (random()*2)::INT END;
    d_risco := CASE cbucket WHEN 'Crítico' THEN 15+(random()*60)::INT WHEN 'Alto' THEN 3+(random()*20)::INT ELSE 0 END;
    vdia    := 5 + ((i-1) % 25);

    d_cancel := CASE WHEN stcontrato = 'CA' THEN NOW() - make_interval(days := (random()*90)::INT) ELSE NULL END;
    fid_str  := CASE WHEN random() < 0.4 THEN '12' WHEN random() < 0.5 THEN '24' ELSE NULL END;

    doc_str   := CASE WHEN is_pj THEN lpad((random()*99999999999999)::BIGINT::TEXT, 14, '0')
                                  ELSE lpad((random()*99999999999)::BIGINT::TEXT, 11, '0') END;
    email_str := lower(replace(nome, ' ', '.')) || cid::TEXT || '@email.com.br';
    tel_str   := '(11) 9' || lpad((10000 + (random()*89999)::INT)::TEXT, 5, '0') || '-' || lpad((random()*9999)::INT::TEXT, 4, '0');
    lat_geo   := -23.0 - (random() * 10);
    lng_geo   := -43.0 - (random() * 10);

    -- ── eventos ──────────────────────────────────────────────────────────
    INSERT INTO public.eventos (
      isp_id, instancia_isp, event_id, event_type, event_datetime,
      cliente_id, cliente_nome, cliente_tipo_pessoa, cliente_documento,
      cliente_email, cliente_celular, cliente_cidade, cliente_uf, cliente_bairro,
      cliente_segmento, cliente_data_cadastro,
      servico_id, tipo_servico, plano_nome,
      velocidade_down_mbps, velocidade_up_mbps, valor_mensalidade, dia_vencimento,
      servico_status_codigo, servico_status,
      data_instalacao, status_contrato, status_internet,
      cobranca_id, cobranca_status_codigo, cobranca_status,
      data_vencimento, data_pagamento, valor_cobranca, valor_pago, metodo_cobranca,
      dias_atraso, vencido,
      rx_dbm, tx_dbm, snr_db, latency_ms, jitter_ms, packet_loss_pct, downtime_min_24h,
      nps_score, nps_comment,
      churn_risk_score, churn_risk_bucket,
      inadimplencia_risk_score, inadimplencia_bucket,
      alerta_tipo, acao_recomendada_1, acao_recomendada_2, acao_recomendada_3,
      ltv_meses_estimado, ltv_reais_estimado,
      geo_lat, geo_lng, fidelidade, id_contrato,
      mes_referencia, dia_referencia, data_cancelamento, desbloqueio_confianca
    ) VALUES (
      'uniforce', 'uniforce',
      (9000000 + i)::BIGINT,
      CASE WHEN stcontrato='CA' THEN 'cancelamento' WHEN datraso>0 THEN 'inadimplencia' ELSE 'atualizacao' END,
      devt, cid, nome,
      CASE WHEN is_pj THEN 'J' ELSE 'F' END,
      doc_str, email_str, tel_str,
      cidades[cidade_i], estados[cidade_i], bairros[bairro_i],
      CASE WHEN is_pj THEN 'Empresarial' WHEN vmens > 150 THEN 'Premium' ELSE 'Residencial' END,
      dinst::DATE,
      (90000 + i)::INT,
      CASE WHEN is_pj THEN 'Empresarial' ELSE 'Residencial' END,
      planos[plano_i], downs[plano_i], ups[plano_i],
      vmens, vdia,
      CASE WHEN stint='A' THEN 1 ELSE 2 END,
      CASE WHEN stint='A' THEN 'Ativo' ELSE 'Bloqueado' END,
      dinst, stcontrato, stint,
      (80000 + i)::NUMERIC,
      CASE WHEN datraso=0 THEN 1 WHEN datraso<=7 THEN 2 ELSE 3 END,
      CASE WHEN datraso=0 THEN 'Pago' WHEN datraso<=7 THEN 'Vencendo' ELSE 'Vencido' END,
      (NOW() - make_interval(days := datraso))::DATE,
      CASE WHEN datraso=0 THEN (NOW() - make_interval(days := 5))::DATE ELSE NULL END,
      vmens,
      CASE WHEN datraso=0 THEN vmens ELSE 0::NUMERIC END,
      CASE WHEN random()>0.5 THEN 'PIX' ELSE 'Boleto' END,
      datraso, datraso>0,
      rx_v, tx_v, snr_v, lat_v, lat_v*0.3,
      CASE cbucket WHEN 'Baixo' THEN 0::NUMERIC WHEN 'Alto' THEN (random()*2)::NUMERIC ELSE (random()*10)::NUMERIC END,
      CASE cbucket WHEN 'Baixo' THEN 0::NUMERIC WHEN 'Alto' THEN (random()*30)::NUMERIC ELSE (random()*120)::NUMERIC END,
      nps,
      CASE nps WHEN 10 THEN 'Excelente, muito satisfeito!' WHEN 9 THEN 'Otimo atendimento.'
               WHEN 8 THEN 'Bom, poucas quedas.' WHEN 7 THEN 'Satisfatorio, pode melhorar.'
               WHEN 6 THEN 'As vezes a internet fica lenta.' WHEN 5 THEN 'Muitas quedas.'
               WHEN 4 THEN 'Atendimento demorado e instavel.' WHEN 3 THEN 'Pensando em cancelar.'
               WHEN 2 THEN 'Pessimo. Vou cancelar.' ELSE 'Cancelei. Internet horrivel.' END,
      cscore, cbucket,
      CASE WHEN datraso>0 THEN LEAST(100, datraso*2) ELSE 0 END,
      CASE WHEN datraso=0 THEN '0-0' WHEN datraso<=7 THEN '1-7' WHEN datraso<=15 THEN '8-15' WHEN datraso<=30 THEN '16-30' ELSE '30+' END,
      CASE cbucket WHEN 'Crítico' THEN 'CHURN_IMINENTE' WHEN 'Alto' THEN 'ALERTA_CHURN' ELSE NULL END,
      CASE cbucket WHEN 'Crítico' THEN 'Ligar para o cliente urgente' WHEN 'Alto' THEN 'Enviar oferta retencao' ELSE NULL END,
      CASE cbucket WHEN 'Crítico' THEN 'Oferecer desconto fidelizacao' WHEN 'Alto' THEN 'Verificar sinal ONU' ELSE NULL END,
      CASE cbucket WHEN 'Crítico' THEN 'Agendar visita tecnica' ELSE NULL END,
      GREATEST(6, (EXTRACT(EPOCH FROM (NOW()-dinst))/2592000)::INT),
      vmens * GREATEST(6, (EXTRACT(EPOCH FROM (NOW()-dinst))/2592000)::INT),
      lat_geo, lng_geo, fid_str, 'CTR-'||cid::TEXT,
      DATE_TRUNC('month', devt)::DATE,
      devt::DATE, d_cancel::DATE,
      CASE WHEN stint='D' AND stcontrato='A' THEN 'Possivel' ELSE 'Nao Elegivel' END
    );

    -- ── churn_status ─────────────────────────────────────────────────────
    INSERT INTO public.churn_status (
      isp_id, instancia_isp, cliente_id, id_contrato,
      status_churn, churn_risk_score, churn_risk_bucket,
      score_financeiro, score_suporte, score_qualidade, score_nps, score_comportamental,
      dias_em_risco, motivo_risco_principal,
      ultimo_pagamento_data, dias_atraso, faixa_atraso,
      ultimo_atendimento_data, qtd_chamados_30d, qtd_chamados_90d,
      resolvido_primeiro_contato_pct, fcr_30d,
      nps_ultimo_score, nps_classificacao, nps_data,
      qualidade_media_30d, latency_media_30d, packet_loss_media_30d, downtime_30d,
      variacao_velocidade_pct, fidelidade, fidelidade_expiracao,
      tempo_cliente_meses, data_instalacao, ltv_estimado, ltv_meses_estimado,
      valor_mensalidade, plano_nome, status_contrato, status_internet,
      desbloqueio_confianca, cliente_nome, cliente_cidade, cliente_bairro,
      data_cancelamento
    ) VALUES (
      'uniforce', 'uniforce', cid, 'CTR-'||cid::TEXT,
      CASE WHEN stcontrato='CA' THEN 'cancelado' WHEN cscore>=65 THEN 'risco' ELSE 'ativo' END,
      cscore, cbucket, s_fin, s_sup, s_qual, s_nps, s_comp,
      d_risco, m_risco,
      CASE WHEN datraso=0 THEN (NOW()-make_interval(days:=5))::DATE ELSE (NOW()-make_interval(days:=datraso+30))::DATE END,
      datraso,
      CASE WHEN datraso=0 THEN '0-0' WHEN datraso<=7 THEN '1-7' WHEN datraso<=15 THEN '8-15' WHEN datraso<=30 THEN '16-30' ELSE '30+' END,
      CASE WHEN n_cham>0 THEN (NOW()-make_interval(days:=(random()*20)::INT))::DATE ELSE NULL END,
      n_cham, n_cham*3,
      CASE WHEN n_cham>0 THEN (60+(random()*40)::INT)::NUMERIC ELSE 100::NUMERIC END,
      CASE WHEN n_cham>0 THEN (random() > 0.3) ELSE TRUE END,
      nps,
      CASE WHEN nps>=9 THEN 'PROMOTOR' WHEN nps>=7 THEN 'NEUTRO' ELSE 'DETRATOR' END,
      (NOW()-make_interval(days:=(random()*90)::INT))::DATE,
      snr_v, lat_v, 0::NUMERIC, 0::NUMERIC, 0::NUMERIC,
      fid_str,
      CASE WHEN fid_str IS NOT NULL THEN (dinst + make_interval(months:=fid_str::INT))::DATE ELSE NULL END,
      GREATEST(1, (EXTRACT(EPOCH FROM (NOW()-dinst))/2592000)::INT),
      dinst::DATE,
      vmens * GREATEST(6, (EXTRACT(EPOCH FROM (NOW()-dinst))/2592000)::INT),
      GREATEST(6, (EXTRACT(EPOCH FROM (NOW()-dinst))/2592000)::INT),
      vmens, planos[plano_i], stcontrato, stint,
      CASE WHEN stint='D' AND stcontrato='A' THEN 'Possivel' ELSE 'Nao Elegivel' END,
      nome, cidades[cidade_i], bairros[bairro_i],
      d_cancel::DATE
    );

    -- ── churn_history (30 snapshots) ──────────────────────────────────────
    FOR j IN 0..29 LOOP
      INSERT INTO public.churn_history (
        isp_id, cliente_id, id_contrato, data_referencia,
        churn_risk_score, churn_risk_bucket, status_churn, motivo_risco,
        status_contrato, status_internet,
        score_financeiro, score_suporte, score_qualidade, score_nps, score_comportamental,
        dias_atraso, qtd_chamados_30d, nps_score, ltv_estimado, data_cancelamento, fcr_30d
      ) VALUES (
        'uniforce', cid, 'CTR-'||cid::TEXT,
        (NOW() - make_interval(days := j*3))::DATE,
        GREATEST(0, LEAST(100, cscore + (-20+(random()*40))::INT)),
        cbucket,
        CASE WHEN stcontrato='CA' THEN 'cancelado' WHEN cscore>=65 THEN 'risco' ELSE 'ativo' END,
        m_risco, stcontrato, stint,
        s_fin, s_sup, s_qual, s_nps, s_comp,
        GREATEST(0, datraso + (-3+(random()*6))::INT),
        n_cham,
        GREATEST(0, LEAST(10, nps + (-1+(random()*2))::INT)),
        vmens * GREATEST(6, (EXTRACT(EPOCH FROM (NOW()-dinst))/2592000)::INT),
        d_cancel::DATE,
        CASE WHEN n_cham>0 THEN (random() > 0.3) ELSE TRUE END
      );
    END LOOP;

    -- ── chamados ─────────────────────────────────────────────────────────
    FOR j IN 1..GREATEST(1, n_cham) LOOP
      INSERT INTO public.chamados (
        isp_id, instancia_isp, id_cliente, qtd_chamados,
        protocolo, data_abertura, ultima_atualizacao,
        responsavel, setor, categoria, motivo_contato, origem, solicitante,
        urgencia, status, dias_desde_ultimo, tempo_atendimento,
        classificacao, insight, chamados_anteriores
      ) VALUES (
        'uniforce', 'uniforce', cid, n_cham,
        'PROT-'||cid::TEXT||'-'||j::TEXT||'-'||i::TEXT,
        TO_CHAR(NOW()-make_interval(days:=(random()*30)::INT), 'DD/MM/YYYY HH24:MI'),
        TO_CHAR(NOW()-make_interval(days:=(random()*5)::INT),  'DD/MM/YYYY HH24:MI'),
        'Atendente '||(1+(random()*9)::INT)::TEXT,
        setores[1+(random()*4)::INT],
        categorias[1+(random()*9)::INT],
        motivos[1+(random()*9)::INT],
        CASE (random()*3)::INT WHEN 0 THEN 'WhatsApp' WHEN 1 THEN 'Telefone' WHEN 2 THEN 'App' ELSE 'Site' END,
        nome,
        CASE WHEN cscore>200 THEN 'Alta' WHEN cscore>100 THEN 'Media' ELSE 'Baixa' END,
        CASE WHEN random()<0.7 THEN 'Fechado' ELSE 'Aberto' END,
        (random()*20)::INT,
        (1+(random()*60)::INT)::TEXT||' minutos',
        CASE WHEN random()<0.7 THEN 'Resolvido' ELSE 'Pendente' END,
        CASE cbucket WHEN 'Crítico' THEN 'Cliente em risco critico - prioridade maxima' WHEN 'Alto' THEN 'Verificar satisfacao' ELSE 'Atendimento padrao' END,
        CASE WHEN j>1 THEN (j-1)::TEXT||' chamados anteriores nos ultimos 90 dias' ELSE '0' END
      );
    END LOOP;

    -- ── nps_check (40% dos clientes) ──────────────────────────────────────
    IF random() < 0.4 THEN
      FOR j IN 1..GREATEST(1, (random()*3)::INT) LOOP
        INSERT INTO public.nps_check (
          isp_id, instancia_isp, id_pesquisa, nps_type,
          id_cliente, telefone, nome, tipo_pessoa,
          data_envio, data_resposta, dia, mes, ano,
          nota, classificacao_nps, nota_numerica, mensagem_melhoria,
          contexto, status_processamento, origem,
          cpf_cnpj, id_contrato, plano_nome
        ) VALUES (
          'uniforce', 'uniforce',
          'NPS-DEV-'||cid::TEXT||'-'||j::TEXT,
          CASE (j%3) WHEN 0 THEN 'contrato' WHEN 1 THEN 'atendimento' ELSE 'ordem_servico' END,
          cid, tel_str, nome,
          CASE WHEN is_pj THEN 'J' ELSE 'F' END,
          NOW() - make_interval(days := j*30 + (random()*15)::INT),
          NOW() - make_interval(days := j*30 + (random()*3)::INT),
          EXTRACT(DAY   FROM NOW()-make_interval(days:=j*30))::INT,
          EXTRACT(MONTH FROM NOW()-make_interval(days:=j*30))::INT,
          EXTRACT(YEAR  FROM NOW()-make_interval(days:=j*30))::INT,
          nps::TEXT,
          CASE WHEN nps>=9 THEN 'PROMOTOR' WHEN nps>=7 THEN 'NEUTRO' ELSE 'DETRATOR' END,
          nps,
          CASE nps WHEN 10 THEN 'Continue assim!' WHEN 9 THEN 'Otimo servico.'
                   WHEN 8 THEN 'Bom, mas velocidade poderia ser melhor.' WHEN 7 THEN 'Ok, tive alguns problemas.'
                   WHEN 6 THEN 'Servico mediano.' WHEN 5 THEN 'Muitas quedas.' WHEN 4 THEN 'Atendimento lento.'
                   WHEN 3 THEN 'Avaliando outras operadoras.' ELSE 'Muito insatisfeito.' END,
          jsonb_build_object('nps_type', CASE (j%3) WHEN 0 THEN 'contrato' WHEN 1 THEN 'atendimento' ELSE 'ordem_servico' END, 'bucket', cbucket),
          'Concluido', 'sistema',
          doc_str, 'CTR-'||cid::TEXT, planos[plano_i]
        );
      END LOOP;
    END IF;

    -- ── credit_recovery (clientes em atraso) ─────────────────────────────
    IF datraso > 0 AND random() < 0.7 THEN
      INSERT INTO public.credit_recovery (
        isp_id, instancia_isp, id_cobranca_externa, id_documento,
        id_contrato, id_conta, id_cliente_externo,
        nome, primeiro_nome, cpf_cnpj, tipo_pessoa,
        email, celular, cidade, uf, bairro,
        valor_cobranca, data_vencimento, data_vencimento_formatada,
        dias_vencido, faixa_atraso, cobranca_status, metodo_pagamento,
        plano_nome, plano_valor, tipo, canal, sequencia, data_envio, status,
        status_internet, contrato_suspenso, cliente_ativo
      ) VALUES (
        'uniforce', 'uniforce',
        'COB-EXT-'||cid::TEXT, 'DOC-'||cid::TEXT,
        'CTR-'||cid::TEXT, 'ACC-'||cid::TEXT, cid::TEXT,
        nome, split_part(nome,' ',1), doc_str,
        CASE WHEN is_pj THEN 'J' ELSE 'F' END,
        email_str, tel_str,
        cidades[cidade_i], estados[cidade_i], bairros[bairro_i],
        vmens,
        (NOW()-make_interval(days:=datraso))::DATE,
        TO_CHAR(NOW()-make_interval(days:=datraso),'DD/MM/YYYY'),
        datraso,
        CASE WHEN datraso<=15 THEN 'leve' WHEN datraso<=30 THEN 'moderado' WHEN datraso<=60 THEN 'grave' ELSE 'critico' END,
        'vencido',
        CASE WHEN random()>0.5 THEN 'PIX' ELSE 'Boleto' END,
        planos[plano_i], vmens, 'mensalidade', 'whatsapp',
        LEAST(3, (datraso/15)+1),
        NOW()-make_interval(days:=(random()*5)::INT),
        CASE WHEN random()<0.7 THEN 'enviado' ELSE 'pendente' END,
        stint='A', CASE WHEN stint='D' THEN 'S' ELSE 'N' END, stcontrato='A'
      );
    END IF;

  END LOOP; -- fim 300 clientes

  -- ── crm_comments para clientes em risco ──────────────────────────────
  INSERT INTO public.crm_comments (isp_id, cliente_id, created_by, body, type, meta)
  SELECT
    'uniforce', cs.cliente_id, '99063f50-1c9d-4676-8090-cb6eddf49b00'::UUID,
    CASE cs.churn_risk_bucket
      WHEN 'Crítico' THEN 'Cliente em risco critico. Ligacao realizada. Reclamou de instabilidade.'
      WHEN 'Alto'  THEN 'Oferta de fidelizacao enviada via WhatsApp. Aguardando retorno.'
      ELSE 'Follow-up realizado. Cliente satisfeito.'
    END,
    'nota',
    jsonb_build_object('bucket', cs.churn_risk_bucket, 'score', cs.churn_risk_score)
  FROM public.churn_status cs
  WHERE cs.isp_id = 'uniforce'
    AND cs.churn_risk_bucket IN ('Crítico','Alto')
    AND random() < 0.6;

  RAISE NOTICE 'Seed uniforce DEV ISP concluido!';
END $$;

-- STEP 6: Indices
CREATE INDEX IF NOT EXISTS idx_eventos_uniforce      ON public.eventos      (isp_id, event_datetime DESC);
CREATE INDEX IF NOT EXISTS idx_churn_status_uniforce ON public.churn_status (isp_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_nps_check_uniforce    ON public.nps_check    (isp_id, data_resposta DESC);
CREATE INDEX IF NOT EXISTS idx_chamados_uniforce     ON public.chamados     (isp_id, created_at DESC);

-- STEP 7: Validacao
DO $$
DECLARE
  e INT; cs INT; ch INT; nps INT; cam INT; cr INT; cc INT;
BEGIN
  SELECT COUNT(*) INTO e   FROM public.eventos         WHERE isp_id='uniforce';
  SELECT COUNT(*) INTO cs  FROM public.churn_status    WHERE isp_id='uniforce';
  SELECT COUNT(*) INTO ch  FROM public.churn_history   WHERE isp_id='uniforce';
  SELECT COUNT(*) INTO nps FROM public.nps_check       WHERE isp_id='uniforce';
  SELECT COUNT(*) INTO cam FROM public.chamados        WHERE isp_id='uniforce';
  SELECT COUNT(*) INTO cr  FROM public.credit_recovery WHERE isp_id='uniforce';
  SELECT COUNT(*) INTO cc  FROM public.crm_comments    WHERE isp_id='uniforce';
  RAISE NOTICE 'RESULTADO: eventos=% | churn_status=% | churn_history=% | nps=% | chamados=% | credit_recovery=% | crm_comments=%',
    e, cs, ch, nps, cam, cr, cc;
  IF e < 280 THEN RAISE EXCEPTION 'SEED FALHOU: eventos=%, esperado>=280', e; END IF;
  RAISE NOTICE 'SEED OK - ISP uniforce pronto para desenvolvimento!';
END $$;
