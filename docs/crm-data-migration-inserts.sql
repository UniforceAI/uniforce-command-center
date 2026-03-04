-- ============================================================
-- MIGRAÇÃO DE DADOS CRM: ohvddptghpcrenxdpyxm → yqdqmudsnjhixtxldqwi
-- Gerado em: 2026-03-04
-- Executar no projeto yqdqmudsnjhixtxldqwi via SQL Editor
-- ============================================================

-- ── risk_bucket_config (1 registro) ──
INSERT INTO public.risk_bucket_config (id, isp_id, ok_max, alert_min, alert_max, critical_min, created_at, updated_at)
VALUES
  ('f877f283-db78-43ae-8129-387593ce741f', 'zen-telecom', 30, 31, 64, 65, '2026-02-26 14:49:18.316389+00', '2026-03-03 03:25:16.804201+00')
ON CONFLICT (isp_id) DO NOTHING;

-- ── crm_tags (2 registros) ──
INSERT INTO public.crm_tags (id, isp_id, name, color, created_at)
VALUES
  ('e8ce0006-f28d-4ffa-88a2-b5fa8f169398', 'zen-telecom', 'teste2', '#6366f1', '2026-02-26 14:16:30.816873+00'),
  ('d29cf00a-2a9d-4f62-a892-4cc24c399112', 'zen-telecom', 'teste3', '#eab308', '2026-02-26 14:16:37.422999+00')
ON CONFLICT (isp_id, name) DO NOTHING;

-- ── crm_workflow (40 registros) ──
INSERT INTO public.crm_workflow (id, isp_id, cliente_id, status_workflow, owner_user_id, tags, entered_workflow_at, last_action_at, created_at, updated_at)
VALUES
  -- agy-telecom (4)
  ('c529c080-b7c7-4df8-8a3b-d2625d1bac59', 'agy-telecom', 12345, 'em_tratamento', NULL, ARRAY['Teste'], '2026-02-23 22:00:00+00', '2026-02-23 22:36:33.041+00', '2026-02-23 22:36:33.191993+00', '2026-02-23 22:36:33.191993+00'),
  ('3204062c-bd5f-475a-b565-e8f1562b110d', 'agy-telecom', 310498, 'em_tratamento', NULL, ARRAY['Crítico','Financeiro'], '2026-03-01 20:40:05.941+00', '2026-03-01 20:40:05.941+00', '2026-03-01 20:40:06.040591+00', '2026-03-01 20:40:06.040591+00'),
  ('2c461862-d7e7-4e2d-9256-2ef1e4f5e520', 'agy-telecom', 312795, 'em_tratamento', NULL, ARRAY[]::TEXT[], '2026-02-24 00:20:54.789+00', '2026-02-24 00:20:54.789+00', '2026-02-24 00:20:54.956603+00', '2026-02-24 00:20:54.956603+00'),
  ('28b8827a-2f94-47f4-9979-e1d4cbea6f2b', 'agy-telecom', 318230, 'em_tratamento', NULL, ARRAY[]::TEXT[], '2026-02-24 01:08:31.141+00', '2026-02-24 01:08:31.141+00', '2026-02-24 01:08:31.491497+00', '2026-02-24 01:08:31.491497+00'),
  -- d-kiros (12)
  ('908c68d0-39e1-4bbc-a52f-45bfef156826', 'd-kiros', 3503, 'em_tratamento', NULL, ARRAY['Crítico'], '2026-02-26 18:21:42.425+00', '2026-03-02 15:38:58.951+00', '2026-02-26 18:21:42.513876+00', '2026-03-02 15:38:59.0452+00'),
  ('71183d58-1fae-425e-9051-6278e58e2269', 'd-kiros', 10459, 'em_tratamento', NULL, ARRAY['Crítico','Financeiro'], '2026-02-27 20:47:01.775+00', '2026-02-27 20:47:01.775+00', '2026-02-27 20:47:01.924837+00', '2026-02-27 20:47:01.924837+00'),
  ('487fd62f-72d1-45da-86f7-6c3a6e33a2d7', 'd-kiros', 16225, 'em_tratamento', NULL, ARRAY['Crítico','Alto Ticket','Financeiro'], '2026-02-24 13:04:13.31+00', '2026-02-24 13:04:13.31+00', '2026-02-24 13:04:13.404779+00', '2026-02-24 13:04:13.404779+00'),
  ('628a2f27-e812-4871-9ead-92993aa496b4', 'd-kiros', 28145, 'em_tratamento', NULL, ARRAY['Crítico','Financeiro'], '2026-02-24 13:04:16.585+00', '2026-02-26 00:46:14.273+00', '2026-02-24 13:04:16.684571+00', '2026-02-26 00:46:14.375324+00'),
  ('a4dafbd6-6426-4593-8341-d1dc403d99b3', 'd-kiros', 32080, 'em_tratamento', NULL, ARRAY['Crítico','Alto Ticket','Financeiro'], '2026-02-24 15:10:59.332+00', '2026-02-24 15:10:59.332+00', '2026-02-24 15:10:59.427126+00', '2026-02-24 15:10:59.427126+00'),
  ('f511c0cb-a80e-47fa-a58c-27b0ebd99be9', 'd-kiros', 35393, 'em_tratamento', '99063f50-1c9d-4676-8090-cb6eddf49b00', ARRAY['Crítico','Financeiro'], '2026-02-23 22:34:34.651+00', '2026-02-26 18:21:33.957+00', '2026-02-23 22:34:36.52461+00', '2026-02-26 18:21:34.048262+00'),
  ('61d2d46f-5e1f-49c6-8625-e917348aff9c', 'd-kiros', 35534, 'em_tratamento', NULL, ARRAY['Crítico','Financeiro'], '2026-02-23 23:02:35.862+00', '2026-02-23 23:02:35.862+00', '2026-02-23 23:02:35.962102+00', '2026-02-23 23:02:35.962102+00'),
  ('c84d6c58-504f-427d-ad65-5af86f2f69a2', 'd-kiros', 36036, 'em_tratamento', NULL, ARRAY['Crítico','Alto Ticket','Financeiro'], '2026-02-24 13:04:11.217+00', '2026-02-24 13:04:11.217+00', '2026-02-24 13:04:11.305427+00', '2026-02-24 13:04:11.305427+00'),
  ('2581abcb-ceaf-4418-9bc3-db779e91831b', 'd-kiros', 36074, 'em_tratamento', NULL, ARRAY['Crítico','Alto Ticket','Financeiro'], '2026-02-24 00:48:18.272+00', '2026-02-26 18:21:30.213+00', '2026-02-24 00:48:18.359509+00', '2026-02-26 18:21:30.315017+00'),
  ('f3a84621-bb8d-4fc7-955d-b35418e7f139', 'd-kiros', 36720, 'em_tratamento', NULL, ARRAY['Crítico','Alto Ticket','Financeiro'], '2026-02-24 13:04:14.745+00', '2026-02-24 13:04:14.745+00', '2026-02-24 13:04:14.836941+00', '2026-02-24 13:04:14.836941+00'),
  ('1823ba87-f0f1-44e8-af78-53efa909cdf7', 'd-kiros', 36820, 'em_tratamento', NULL, ARRAY['Crítico','Alto Ticket','Financeiro'], '2026-02-24 00:48:17.464+00', '2026-02-26 18:21:31.853+00', '2026-02-24 00:48:17.551768+00', '2026-02-26 18:21:31.947536+00'),
  ('ef23e886-6cdb-47cf-827b-ecf392b3b741', 'd-kiros', 37553, 'em_tratamento', NULL, ARRAY['Crítico'], '2026-02-24 13:04:17.883+00', '2026-03-02 01:07:52.774+00', '2026-02-24 13:04:17.975155+00', '2026-03-02 01:07:52.87207+00'),
  -- igp-fibra (7)
  ('b1659d1b-ad1b-4904-8fa1-6411a97a4116', 'igp-fibra', 1578, 'em_tratamento', NULL, ARRAY[]::TEXT[], '2026-03-02 17:33:17.943+00', '2026-03-02 17:33:17.943+00', '2026-03-02 17:33:18.04225+00', '2026-03-02 17:33:18.04225+00'),
  ('3ce6f736-092f-4d8d-8413-64d6795bd6d0', 'igp-fibra', 7764, 'em_tratamento', NULL, ARRAY[]::TEXT[], '2026-03-02 13:18:19.759+00', '2026-03-02 13:18:27.075+00', '2026-03-02 13:18:19.935296+00', '2026-03-02 13:18:27.544508+00'),
  ('e51ff782-72cb-4af2-9a8e-95a253668940', 'igp-fibra', 11533, 'em_tratamento', NULL, ARRAY['Financeiro'], '2026-02-24 13:58:45.938+00', '2026-02-24 14:34:46.956+00', '2026-02-24 13:58:46.03448+00', '2026-02-24 14:34:47.166439+00'),
  ('d0fd7d4a-1aaf-45c8-a4c8-a165fca224ca', 'igp-fibra', 14127, 'em_tratamento', NULL, ARRAY['Crítico'], '2026-03-02 12:32:45.845+00', '2026-03-02 12:32:45.845+00', '2026-03-02 12:32:45.940385+00', '2026-03-02 12:32:45.940385+00'),
  ('1ed0879f-75ea-4010-b191-0df4a51b97c3', 'igp-fibra', 15213, 'em_tratamento', '99063f50-1c9d-4676-8090-cb6eddf49b00', ARRAY['Crítico'], '2026-02-24 13:19:28.671+00', '2026-03-03 03:11:18.563+00', '2026-02-24 13:19:28.766893+00', '2026-03-03 03:11:18.68878+00'),
  ('0c3e71c9-5cde-4d95-ab1c-707a6be7da43', 'igp-fibra', 18074, 'em_tratamento', 'f81b3ddf-bc51-4d3b-87ba-8fe386462a27', ARRAY['Crítico'], '2026-02-27 14:45:42.137+00', '2026-03-03 14:29:44.286+00', '2026-02-27 14:45:42.233884+00', '2026-03-03 14:29:44.731487+00'),
  ('8a4975a0-0122-4591-9f17-c868f3a88d5e', 'igp-fibra', 18108, 'em_tratamento', NULL, ARRAY[]::TEXT[], '2026-02-27 14:28:43.609+00', '2026-02-27 14:28:43.609+00', '2026-02-27 14:28:43.70768+00', '2026-02-27 14:28:43.70768+00'),
  -- zen-telecom (17)
  ('019f49d0-7597-47e1-acf1-2cced905cf25', 'zen-telecom', 3209, 'em_tratamento', NULL, ARRAY['Financeiro'], '2026-03-04 13:50:09.635+00', '2026-03-04 14:17:52.844+00', '2026-03-04 13:50:09.751919+00', '2026-03-04 14:17:52.93879+00'),
  ('f71286b3-b4cc-41a1-8ef0-dcab714eff3c', 'zen-telecom', 7662, 'resolvido', '9a48b486-a672-41ec-8994-60513aa53bd8', ARRAY['Financeiro'], '2026-03-04 12:30:05.227+00', '2026-03-04 14:41:53.404+00', '2026-03-04 12:30:05.325971+00', '2026-03-04 14:41:53.495689+00'),
  ('b2cc516b-547d-440c-849d-4d3b93d9ed19', 'zen-telecom', 8822, 'resolvido', NULL, ARRAY['Alto Ticket'], '2026-03-04 13:39:17.929+00', '2026-03-04 14:16:25.803+00', '2026-03-04 13:39:18.026589+00', '2026-03-04 14:16:25.89183+00'),
  ('1cf98283-dd43-4d45-89c7-8101b2d1b4af', 'zen-telecom', 9673, 'em_tratamento', NULL, ARRAY['Financeiro'], '2026-03-04 13:26:26.59+00', '2026-03-04 14:20:30.487+00', '2026-03-04 13:26:27.029676+00', '2026-03-04 14:20:30.629837+00'),
  ('a4cd9c84-6a4a-4766-977e-7ea8994db081', 'zen-telecom', 10110, 'resolvido', NULL, ARRAY['Financeiro'], '2026-03-04 13:00:36.715+00', '2026-03-04 14:23:43.094+00', '2026-03-04 13:00:37.165816+00', '2026-03-04 14:23:43.189652+00'),
  ('3f626e3f-b2d0-49bf-adec-99056f62375e', 'zen-telecom', 10200, 'em_tratamento', NULL, ARRAY['Financeiro'], '2026-03-04 13:40:45.844+00', '2026-03-04 14:18:02.354+00', '2026-03-04 13:40:45.951284+00', '2026-03-04 14:18:02.458429+00'),
  ('23901bc9-1a85-4621-a32e-55085b06cfc2', 'zen-telecom', 10282, 'em_tratamento', NULL, ARRAY['Financeiro'], '2026-03-04 13:36:17.886+00', '2026-03-04 14:20:18.254+00', '2026-03-04 13:36:18.399693+00', '2026-03-04 14:20:18.501648+00'),
  ('0619f25b-2acb-4575-94ef-f99316a27a50', 'zen-telecom', 10794, 'em_tratamento', NULL, ARRAY[]::TEXT[], '2026-03-04 12:28:14.996+00', '2026-03-04 14:22:11.087+00', '2026-03-04 12:28:15.093722+00', '2026-03-04 14:22:11.200848+00'),
  ('077ab312-1e96-44ac-a180-e453e7433694', 'zen-telecom', 10903, 'em_tratamento', NULL, ARRAY['Financeiro'], '2026-03-04 17:38:31.122+00', '2026-03-04 17:38:31.122+00', '2026-03-04 17:38:31.639862+00', '2026-03-04 17:38:31.639862+00'),
  ('7b107e16-ea1f-4e83-8337-ff934a12f5a4', 'zen-telecom', 10946, 'resolvido', 'f81b3ddf-bc51-4d3b-87ba-8fe386462a27', ARRAY['Financeiro'], '2026-03-03 12:16:39.169+00', '2026-03-04 12:23:54.065+00', '2026-03-03 12:16:39.287539+00', '2026-03-04 12:23:54.152725+00'),
  ('f531163e-7a25-49f7-8785-37b1b02ac1c8', 'zen-telecom', 11077, 'em_tratamento', NULL, ARRAY['Financeiro'], '2026-03-04 13:34:02.969+00', '2026-03-04 14:21:15.675+00', '2026-03-04 13:34:03.077184+00', '2026-03-04 14:21:15.803575+00'),
  ('d7725379-1fd0-4783-bbf8-b30f4b0bbcc6', 'zen-telecom', 11687, 'resolvido', NULL, ARRAY[]::TEXT[], '2026-03-04 14:09:38.785+00', '2026-03-04 14:09:48.413+00', '2026-03-04 14:09:38.885418+00', '2026-03-04 14:09:48.509916+00'),
  ('ab7ae94a-fe6d-46f3-9d66-8dee87373133', 'zen-telecom', 12026, 'em_tratamento', NULL, ARRAY['Financeiro'], '2026-03-04 13:53:27.971+00', '2026-03-04 14:17:41.973+00', '2026-03-04 13:53:28.108025+00', '2026-03-04 14:17:42.065941+00'),
  ('075ba591-c47a-415d-affb-71325ad57b7a', 'zen-telecom', 12161, 'resolvido', NULL, ARRAY[]::TEXT[], '2026-03-04 12:29:58.478+00', '2026-03-04 14:15:20.147+00', '2026-03-04 12:29:58.580012+00', '2026-03-04 14:15:20.368148+00'),
  ('b4c7c433-d11c-4739-840f-0f88551fcb7a', 'zen-telecom', 13422, 'em_tratamento', NULL, ARRAY['Financeiro'], '2026-03-04 13:47:25.556+00', '2026-03-04 14:17:34.374+00', '2026-03-04 13:47:25.986254+00', '2026-03-04 14:17:34.482615+00'),
  ('62ada314-b9c1-4580-9c00-6404fd703809', 'zen-telecom', 14065, 'em_tratamento', '99063f50-1c9d-4676-8090-cb6eddf49b00', ARRAY['Financeiro'], '2026-02-25 18:50:10.295+00', '2026-03-03 18:32:08.32+00', '2026-02-25 18:50:10.723449+00', '2026-03-03 18:32:08.430235+00'),
  ('1cfa7460-1c75-4915-b820-a4d98c29f2ed', 'zen-telecom', 14355, 'resolvido', NULL, ARRAY[]::TEXT[], '2026-03-04 13:27:10.08+00', '2026-03-04 14:22:57.76+00', '2026-03-04 13:27:10.182783+00', '2026-03-04 14:22:57.870071+00')
ON CONFLICT (isp_id, cliente_id) DO NOTHING;

-- ── crm_comments (27 registros) ──
INSERT INTO public.crm_comments (id, isp_id, cliente_id, created_by, created_at, body, type, meta)
VALUES
  -- d-kiros
  ('125ab305-1443-4c23-8b76-6e9258ac8be6', 'd-kiros', 35393, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-02-23 22:47:08.325506+00', 'Ação: WhatsApp enviado', 'action', '{"action_type":"whatsapp"}'),
  ('c038ca3f-f19c-4167-bcd1-6895fa49a8fc', 'd-kiros', 35393, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-02-23 22:48:29.488002+00', 'teste interno', 'comment', NULL),
  ('45b2d673-642f-4ac3-b311-6eab62ee05e0', 'd-kiros', 35393, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-02-24 00:46:23.299104+00', 'Ação: Acordo de pagamento', 'action', '{"action_type":"acordo"}'),
  ('a5975fb0-b84b-4314-8202-8c6518849485', 'd-kiros', 35393, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-02-24 13:01:42.573609+00', 'cliente nao respondeu x', 'comment', NULL),
  ('d4523a15-b5a2-4d94-a0dc-3892b25e8722', 'd-kiros', 35393, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-02-24 13:01:53.592665+00', 'Ação: Ligação realizada', 'action', '{"action_type":"ligacao"}'),
  ('df78c600-961b-4474-a549-f4ca647db3be', 'd-kiros', 37553, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-03-02 01:07:52.195808+00', 'Ação: Boleto copiado', 'action', '{"action_type":"copy_boleto"}'),
  -- igp-fibra
  ('afb162c0-7790-41ab-8e6a-b3934e68dccb', 'igp-fibra', 1996, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-03-02 14:58:03.545933+00', 'Ação: WhatsApp enviado', 'action', '{"action_type":"whatsapp"}'),
  ('cb6b78d2-cba2-4e50-865a-989bf76c9e2c', 'igp-fibra', 1996, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-03-02 20:18:52.045432+00', 'Ação: WhatsApp enviado', 'action', '{"action_type":"whatsapp"}'),
  ('11482c61-ea9b-44d7-933d-0d33af5897ae', 'igp-fibra', 15213, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-02-24 13:21:49.909672+00', 'teste teste', 'comment', NULL),
  ('33720dad-2f8f-4622-ad02-9192b72f9259', 'igp-fibra', 17906, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-03-02 12:37:11.349577+00', 'Ação: PIX copiado', 'action', '{"action_type":"copy_pix"}'),
  ('e6eaa4d1-b430-4d06-8a04-8d7e32e3e0eb', 'igp-fibra', 17906, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-03-02 12:37:15.663348+00', 'Ação: QR Code PIX copiado', 'action', '{"action_type":"copy_pix_qrcode"}'),
  ('8fdafd92-81c5-4fc4-bc80-5d890dbf6e01', 'igp-fibra', 18074, 'f81b3ddf-bc51-4d3b-87ba-8fe386462a27', '2026-03-03 04:00:45.992552+00', 'Ação: WhatsApp enviado', 'action', '{"action_type":"whatsapp"}'),
  ('26b25bf0-b10f-4d23-8ff9-74cd67ba74a4', 'igp-fibra', 18074, 'f81b3ddf-bc51-4d3b-87ba-8fe386462a27', '2026-03-03 14:29:41.967151+00', 'Ação: WhatsApp enviado', 'action', '{"action_type":"whatsapp"}'),
  -- zen-telecom
  ('fd681bd1-f520-4ddb-a192-dbec25251a0e', 'zen-telecom', 7662, '9a48b486-a672-41ec-8994-60513aa53bd8', '2026-03-04 12:47:56.110441+00', 'Ação: PIX copiado', 'action', '{"action_type":"copy_pix"}'),
  ('589d4d2a-3e0d-437b-b417-5b9e6969fdcc', 'zen-telecom', 7662, '9a48b486-a672-41ec-8994-60513aa53bd8', '2026-03-04 12:56:52.733112+00', 'Cliente estava inadimplente e com OS de retirada em aberto. Realizado negociação com cliente. Pagou o boleto mais antigo e o acesso foi normalizado.', 'comment', NULL),
  ('00c1e77f-91e9-4626-b1c5-390d917a9db6', 'zen-telecom', 8822, '9a48b486-a672-41ec-8994-60513aa53bd8', '2026-03-04 13:39:09.298876+00', 'Cliente possui histórico recente de 3 atendimentos. Porém é uma manutenção com cobrança e dois suporte aos apps. Realizado contato com a cliente para entender a satisfação da mesma. E cliente bem satisfeita com o serviço.', 'comment', NULL),
  ('b60c2209-df91-45ba-b646-d6206e7950da', 'zen-telecom', 10110, '9a48b486-a672-41ec-8994-60513aa53bd8', '2026-03-04 13:02:56.730259+00', E'Cliente teve chamado relacionado a lentidão recentemente. Foi enviado um técnico ao endereço da cliente e resolveu o problema.\nRelatório do problema: Corrigido o sinal da cliente, refeito os dois conectores, realizado os testes de velocidade e estão de acordo com o contratado, corrigido algumas configurações da ont que não estavam dentro do padrão, cliente tbm testou a internet em seus dispositivos.', 'comment', NULL),
  ('02bc308a-5806-4b45-b9ba-66dba201953a', 'zen-telecom', 10683, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-03-03 03:55:02.381359+00', 'Ação: WhatsApp enviado', 'action', '{"action_type":"whatsapp"}'),
  ('828b0b15-4219-45ad-85ef-37a0dcad9bb5', 'zen-telecom', 10946, '9a48b486-a672-41ec-8994-60513aa53bd8', '2026-03-04 12:23:40.038615+00', 'Cliente já cancelado, possuí último boleto em aberto. Equipamento já recolhido.', 'comment', NULL),
  ('487d4a81-3fb5-459e-ba59-cade44d649f6', 'zen-telecom', 11687, '9a48b486-a672-41ec-8994-60513aa53bd8', '2026-03-04 14:09:33.00286+00', 'Cliente estava em aberto valor da multa, fez um novo contrato e esta pagando o valor da multa parcelado com os boletos do novo contrato.', 'comment', NULL),
  ('34c1a389-a85b-452a-8e54-fbe58b90d1fa', 'zen-telecom', 12161, '9a48b486-a672-41ec-8994-60513aa53bd8', '2026-03-04 12:42:44.547274+00', 'Cancelado o contrato de evento já concluído.', 'comment', NULL),
  ('36d1c425-58f0-4677-baa4-baec8109a0f4', 'zen-telecom', 14065, '99063f50-1c9d-4676-8090-cb6eddf49b00', '2026-03-03 03:04:28.301888+00', 'Ação: WhatsApp enviado', 'action', '{"action_type":"whatsapp"}'),
  ('777250c9-f289-4f46-bc08-639da178733d', 'zen-telecom', 14065, 'f81b3ddf-bc51-4d3b-87ba-8fe386462a27', '2026-03-03 18:31:37.956031+00', 'envir cobrança', 'comment', NULL),
  ('a5d48b27-862b-4f76-b4c2-472d358386af', 'zen-telecom', 14065, 'f81b3ddf-bc51-4d3b-87ba-8fe386462a27', '2026-03-03 18:31:43.155585+00', 'Ação: Boleto copiado', 'action', '{"action_type":"copy_boleto"}'),
  ('ce72956f-baf1-482e-a067-7dcf63bc3f6a', 'zen-telecom', 14065, 'f81b3ddf-bc51-4d3b-87ba-8fe386462a27', '2026-03-03 18:31:48.383233+00', 'Ação: PIX copiado', 'action', '{"action_type":"copy_pix"}'),
  ('e2d2ecb9-5f7b-4253-8089-b4877b207ca2', 'zen-telecom', 14065, 'f81b3ddf-bc51-4d3b-87ba-8fe386462a27', '2026-03-03 18:31:59.606156+00', 'Ação: WhatsApp enviado', 'action', '{"action_type":"whatsapp"}'),
  ('af3ff8a4-a464-4183-b4a6-be416d3d5d3d', 'zen-telecom', 14355, '9a48b486-a672-41ec-8994-60513aa53bd8', '2026-03-04 13:28:08.009217+00', 'Tudo ok com a cliente, possui duas OS recentes. Mas é a instalação da internet e a segunda a instalação da tv box.', 'comment', NULL)
ON CONFLICT (id) DO NOTHING;
