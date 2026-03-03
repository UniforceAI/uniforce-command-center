
Objetivo imediato
- Eliminar de forma definitiva a divergência de churn entre “Visão Geral” e “Cancelamentos”.
- Restaurar comportamento correto para d-kiros.
- Garantir que filtros (especialmente 7 dias) alterem números e visualizações de forma consistente em todas as telas críticas.

Diagnóstico aprofundado (causa raiz)
1) As duas telas ainda usam fontes/lógicas diferentes para churn
- Visão Geral:
  - Numerador (cancelados no período): prioriza `eventos.data_cancelamento`, com fallback para `churn_status`.
  - Denominador: clientes únicos da base de `eventos` filtrada (cidade/bairro/plano/filial), com deduplicação por cliente.
- Cancelamentos:
  - Numerador: usa apenas `churn_status` com `status_churn === "cancelado"` e `data_cancelamento`.
  - Denominador: `totalClientesBase` de `eventos + churn_status`, sem aplicar os mesmos filtros da mesma forma.
- Resultado: discrepância estrutural inevitável mesmo com o mesmo período.

2) Problema crítico de paginação/truncamento em churn_status
- `useChurnData` pagina `churn_status` em lotes de 1000, mas com `MAX_BATCHES = 10` (limite de 10k).
- Além disso, ordena por `churn_risk_score` (não por data).
- Em bases maiores, “fatia” os registros de forma não temporal, distorcendo cálculo por período.
- Isso afeta fortemente Cancelamentos, que hoje depende desse dataset para churn.

3) Por que d-kiros “parou”
- A regressão é compatível com a mudança da tela Cancelamentos para depender de `churn_status` para o churn principal.
- d-kiros historicamente é sensível à fonte `eventos` para cancelamento; quando a tela passa a depender de `churn_status` truncado/menos aderente, os números quebram ou “somem”.

4) Fontes atuais de dados (resposta direta)
- Tabela `eventos` (externa): usada em Visão Geral como fonte primária de cancelamento por período (`data_cancelamento`).
- Tabela `churn_status` (externa): usada em Cancelamentos como base de cancelados e em várias métricas de score.
- Tabela `churn_events` (externa): usada para timeline/motivos auxiliares.
- Tabela `chamados` (externa): suporte/tempo/chamados correlatos.
- O problema não é “falta de dados”, é “inconsistência de regra + truncamento + fonte divergente”.

Solução definitiva (single source of truth)
Princípio
- Definir uma única regra de churn para o produto:
  - Cancelados no período: fonte primária `eventos.data_cancelamento` (deduplicado por `cliente_id`, pegando o cancelamento mais recente no período).
  - Fallback por cliente: `churn_status` apenas quando não houver registro confiável em eventos para aquele cliente.
  - Denominador: mesma base de clientes únicos utilizada em Visão Geral, com os mesmos filtros aplicados antes do cálculo.
- `churn_status` passa a ser fonte de enriquecimento (score, motivo, buckets), não de contagem principal de churn.

Implementação proposta (arquitetura)
1) Criar um agregador compartilhado de churn
- Novo módulo/hook central (ex.: `src/lib/churnUnified.ts` ou `src/hooks/useUnifiedChurnMetrics.ts`) para:
  - Normalizar dataset de clientes elegíveis.
  - Calcular cancelados por período com deduplicação por cliente.
  - Calcular denominador usando a mesma população filtrada.
  - Retornar estrutura única para Visão Geral e Cancelamentos.
- Isso remove lógica duplicada entre páginas e elimina drift futuro.

2) Refatorar Visão Geral para consumir o agregador
- Trocar cálculo local de `canceladosPeriodo`/`churnPct` por retorno do agregador.
- Manter comportamento visual atual, mas com fonte única compartilhada.

3) Refatorar Cancelamentos para consumir o mesmo agregador
- KPI “Taxa Churn” passa a usar exatamente o mesmo resultado da Visão Geral.
- Lista de cancelados:
  - Base em cancelamentos unificados (eventos + fallback churn_status por cliente).
  - Enriquecimento com dados de `churn_status` (motivo, score etc.) quando existir.
- Com isso, d-kiros volta a funcionar pelo caminho primário de eventos.

4) Corrigir paginação para evitar truncamento silencioso
- Em `useChurnData` e `useEventos`, remover cap fixo que causa corte indevido para métricas críticas.
- Estratégia segura:
  - Paginação contínua até fim real (`data.length < batch`) com guarda de segurança por volume total.
  - Para métricas de período curto, suportar consulta incremental por janela temporal.
- Prioridade: impedir que churn por período seja calculado sobre amostra parcial.

5) Sincronizar filtros entre telas
- Garantir que os mesmos filtros (período/plano/cidade/bairro/filial quando aplicável) alimentem o mesmo pipeline antes do cálculo.
- Evitar filtros aplicados “depois” do cálculo em uma tela e “antes” na outra.

Plano de execução (sequência)
Fase 1 — Instrumentação e comparação
- Adicionar logs temporários de auditoria (dev-only) em ambas telas:
  - fonte usada, total base, cancelados, IDs deduplicados, período efetivo.
- Confirmar divergência por tenant: igp-fibra, zen-telecom, d-kiros.

Fase 2 — Construção da fonte única
- Implementar agregador unificado com API clara:
  - `getUnifiedChurn({eventos, churnStatus, filters, periodo})`.
- Cobrir deduplicação por `cliente_id` e fallback por cliente.

Fase 3 — Migração das telas
- Visão Geral passa a consumir agregador.
- Cancelamentos passa a consumir agregador para KPI e população base.

Fase 4 — Robustez de carga
- Ajustar paginação em hooks críticos para não truncar silentemente.
- Validar impacto com cache existente (React Query + persistência).

Fase 5 — Validação de aceite (obrigatória antes de entrega)
- Testar end-to-end com os 3 tenants:
  - Visão Geral vs Cancelamentos devem exibir mesma taxa/churn (com mesmo filtro e escopo).
  - d-kiros deve voltar a apresentar dados coerentes.
  - Filtro padrão de 7 dias deve alterar todos os blocos afetados.
- Conferir manualmente 5 clientes por tenant (amostragem) para confirmar data_cancelamento e contagem.
- Validar que “Tempo Médio” continua correto após refactor.

Riscos e mitigação
- Risco: queda de performance com paginação maior.
  - Mitigação: cache persistido + memoização + carga incremental por período.
- Risco: diferenças históricas em `data_cancelamento` entre tabelas.
  - Mitigação: regra explícita de precedência (eventos > churn_status fallback), documentada no código.
- Risco: regressão em gráficos secundários.
  - Mitigação: manter enriquecimento por `churn_status` apenas para campos não essenciais ao KPI principal.

Critérios de sucesso (definitivos)
- A taxa de churn (mesmo tenant + mesmo período + mesmos filtros) é idêntica em Visão Geral e Cancelamentos.
- d-kiros volta a apresentar churn e lista de cancelados sem “sumir”.
- Não há truncamento silencioso para tenants grandes.
- Filtros refletem fielmente os números exibidos em ambas as telas.
- Pipeline de churn fica centralizado, auditável e sustentável para produção.

Observação importante
- O problema não foi “um bug visual”; foi uma regressão de regra de negócio + fonte de dados + paginação. A correção definitiva exige centralizar cálculo (single source of truth), não apenas ajustar fórmulas localmente em uma página.
