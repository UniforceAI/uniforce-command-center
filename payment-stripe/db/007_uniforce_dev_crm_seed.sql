-- ============================================================================
-- SEED 007: uniforce DEV ISP - CRM Workflow + Tags + Churn Events
-- Complemento do seed 006 — tabelas faltantes para ambiente completo
-- ============================================================================

DO $$
DECLARE
  eric_id  UUID := '99063f50-1c9d-4676-8090-cb6eddf49b00';
  cid      INT;
  tag_ids  UUID[];
  t1 UUID; t2 UUID; t3 UUID; t4 UUID; t5 UUID;
  w_status public.workflow_status;
  cs_row   RECORD;
BEGIN

  -- ── LIMPEZA ───────────────────────────────────────────────────────────────
  DELETE FROM public.crm_workflow  WHERE isp_id = 'uniforce';
  DELETE FROM public.crm_tags      WHERE isp_id = 'uniforce';
  DELETE FROM public.churn_events  WHERE isp_id = 'uniforce';

  -- ── STEP 1: crm_tags ─────────────────────────────────────────────────────
  INSERT INTO public.crm_tags (isp_id, name, color) VALUES
    ('uniforce', 'Crítico',          '#ef4444'),
    ('uniforce', 'Alto Ticket',      '#f97316'),
    ('uniforce', 'NPS Detrator',     '#eab308'),
    ('uniforce', 'Inadimplente',     '#dc2626'),
    ('uniforce', 'Em Negociação',    '#3b82f6');

  SELECT ARRAY_AGG(id ORDER BY name) INTO tag_ids FROM public.crm_tags WHERE isp_id='uniforce';
  t1 := tag_ids[1]; -- Crítico
  t2 := tag_ids[2]; -- Alto Ticket
  t3 := tag_ids[3]; -- NPS Detrator
  t4 := tag_ids[4]; -- Inadimplente
  t5 := tag_ids[5]; -- Em Negociação

  -- ── STEP 2: crm_workflow (clientes Alto/Crítico → workflow ativo) ─────────
  FOR cs_row IN
    SELECT cliente_id, churn_risk_bucket, churn_risk_score, valor_mensalidade,
           score_financeiro, score_suporte, score_qualidade, score_nps, score_comportamental
    FROM public.churn_status
    WHERE isp_id = 'uniforce'
      AND churn_risk_bucket IN ('Alto', 'Crítico')
  LOOP
    -- Status baseado no bucket e aleatoriedade
    w_status := CASE
      WHEN cs_row.churn_risk_bucket = 'Crítico' THEN
        CASE (random()*10)::INT
          WHEN 0 THEN 'perdido'::public.workflow_status
          WHEN 1 THEN 'resolvido'::public.workflow_status
          ELSE 'em_tratamento'::public.workflow_status
        END
      ELSE -- Alto
        CASE (random()*4)::INT
          WHEN 0 THEN 'resolvido'::public.workflow_status
          ELSE 'em_tratamento'::public.workflow_status
        END
    END;

    INSERT INTO public.crm_workflow (
      isp_id, cliente_id, status_workflow, owner_user_id,
      tags, entered_workflow_at, last_action_at,
      archived, archived_at, status_entered_at,
      score_snapshot
    ) VALUES (
      'uniforce',
      cs_row.cliente_id,
      w_status,
      eric_id,
      CASE cs_row.churn_risk_bucket
        WHEN 'Crítico' THEN ARRAY[t1, t4]
        ELSE ARRAY[t2]
      END,
      NOW() - make_interval(days := (random()*30)::INT),
      NOW() - make_interval(days := (random()*5)::INT),
      w_status IN ('resolvido','perdido'),
      CASE WHEN w_status IN ('resolvido','perdido')
           THEN NOW() - make_interval(days := (random()*3)::INT)
           ELSE NULL END,
      NOW() - make_interval(days := (random()*30)::INT),
      jsonb_build_object(
        'score',     cs_row.churn_risk_score,
        'bucket',    cs_row.churn_risk_bucket,
        'fin',       cs_row.score_financeiro,
        'sup',       cs_row.score_suporte,
        'qual',      cs_row.score_qualidade,
        'nps',       cs_row.score_nps,
        'comp',      cs_row.score_comportamental,
        'mensalidade', cs_row.valor_mensalidade
      )
    );
  END LOOP;

  -- ── STEP 3: churn_events (eventos de churn para análise temporal) ────────
  FOR cs_row IN
    SELECT cliente_id, id_contrato, churn_risk_bucket, churn_risk_score,
           score_financeiro, score_suporte, dias_em_risco
    FROM public.churn_status
    WHERE isp_id = 'uniforce'
      AND churn_risk_bucket IN ('Alto', 'Crítico')
  LOOP
    -- Evento financeiro
    IF cs_row.score_financeiro > 10 THEN
      INSERT INTO public.churn_events (isp_id, cliente_id, id_contrato, tipo_evento, peso_evento, impacto_score, descricao, dados_evento, data_evento)
      VALUES (
        'uniforce', cs_row.cliente_id, cs_row.id_contrato,
        'inadimplencia_iniciou', 3, cs_row.score_financeiro,
        'Fatura em atraso detectada',
        jsonb_build_object('dias_atraso', cs_row.score_financeiro, 'fonte', 'erp'),
        NOW() - make_interval(days := (random()*60)::INT)
      );
    END IF;
    -- Evento de suporte
    IF cs_row.score_suporte > 8 THEN
      INSERT INTO public.churn_events (isp_id, cliente_id, id_contrato, tipo_evento, peso_evento, impacto_score, descricao, dados_evento, data_evento)
      VALUES (
        'uniforce', cs_row.cliente_id, cs_row.id_contrato,
        'chamado_reincidente', 2, cs_row.score_suporte,
        'Volume de chamados acima do normal nos últimos 30 dias',
        jsonb_build_object('qtd_chamados', (cs_row.score_suporte/3)::INT, 'fonte', 'crm'),
        NOW() - make_interval(days := (random()*30)::INT)
      );
    END IF;
    -- Evento de score alto
    IF cs_row.churn_risk_score >= 70 THEN
      INSERT INTO public.churn_events (isp_id, cliente_id, id_contrato, tipo_evento, peso_evento, impacto_score, descricao, dados_evento, data_evento)
      VALUES (
        'uniforce', cs_row.cliente_id, cs_row.id_contrato,
        'score_critico', 5, cs_row.churn_risk_score,
        'Score de risco atingiu nível crítico',
        jsonb_build_object('score', cs_row.churn_risk_score, 'bucket', cs_row.churn_risk_bucket),
        NOW() - make_interval(days := (random()*7)::INT)
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'CRM/Events seed concluido!';
END $$;

-- Stripe: garantir que uniforce usa test mode (sem cobrar real)
UPDATE public.isps SET
  stripe_billing_source = 'stripe',
  stripe_subscription_status = 'trialing',
  stripe_product_name = 'Uniforce Pro [DEV]',
  stripe_monthly_amount = 0,
  stripe_trial_end = NOW() + make_interval(years := 10)
WHERE isp_id = 'uniforce';

-- Validação
DO $$
DECLARE
  wf INT; tg INT; ce INT;
BEGIN
  SELECT COUNT(*) INTO wf FROM public.crm_workflow  WHERE isp_id='uniforce';
  SELECT COUNT(*) INTO tg FROM public.crm_tags      WHERE isp_id='uniforce';
  SELECT COUNT(*) INTO ce FROM public.churn_events  WHERE isp_id='uniforce';
  RAISE NOTICE 'crm_workflow=% | crm_tags=% | churn_events=%', wf, tg, ce;
  IF tg < 5 THEN RAISE EXCEPTION 'FALHOU: tags=%', tg; END IF;
  RAISE NOTICE 'SEED 007 OK - ambiente de desenvolvimento completo!';
END $$;
