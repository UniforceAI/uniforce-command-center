
Diagnóstico aprofundado feito no código atual aponta que o problema **não está mais** no card/subtítulo em si (ambos já usam `filtered.length`), e sim em inconsistências de base temporal + cache que podem fazer o ambiente parecer “travado” no comportamento antigo.

## O que está acontecendo (explicação direta)

1) O plano anterior corrigiu a unificação principal (all-or-nothing), mas ainda restaram pontos de inconsistência no fluxo de Cancelamentos.

2) Há sinais de **cache persistido com versão já “consumida”**:
- O app hoje está com `buster: "v2"`.
- Se o navegador já hidratou dados incorretos dentro da versão v2, novas alterações sem novo versionamento podem continuar mostrando comportamento inesperado por até 24h.
- O `CACHE_KEY` ainda está fixo em `"uf-cache-v1"` no persister, o que dificulta controle operacional do ciclo de invalidação.

3) Há inconsistências técnicas na própria página:
- `churnPorDimensao` não aplica `periodo` (usa `cancelados`, não `filtered`).
- Dependências de `useMemo` de `churnPorDimensao` estão incompletas (faltam `cancelados`, `eventos`, `churnDimension`, `periodo`), causando risco de dado “stale” em UI.
- Filtro de período usa parsing `new Date(c.data_cancelamento + "T00:00:00")`, que pode ser frágil se o campo já vier como timestamp completo.

Isso explica o cenário “antes funcionava / agora não”: parte da correção entrou, parte não, e o cache persistente mascara mudanças.

## Correção definitiva proposta (produção-safe)

### Etapa 1 — Fechar inconsistência de cálculo na página de Cancelamentos
- Garantir que **todo bloco analítico sensível a período** derive de `filtered` (não de `cancelados` bruto).
- Ajustar `churnPorDimensao` para respeitar `periodo`.
- Corrigir dependências do `useMemo` de `churnPorDimensao` para evitar stale render.

Resultado esperado: troca 7d/30d/90d reflete imediatamente em KPI e blocos correlatos.

### Etapa 2 — Normalização robusta de datas de cancelamento
- Criar helper único de parse seguro para `data_cancelamento` (date-only e datetime).
- Remover concatenações ad-hoc de `"T00:00:00"` onde já houver timestamp completo.
- Aplicar helper em:
  - filtro de período;
  - ordenação por data;
  - cálculo de séries temporais.

Resultado esperado: janela temporal consistente para qualquer formato retornado pelo backend.

### Etapa 3 — Estratégia de invalidação de cache “à prova de regressão”
- Introduzir `QUERY_CACHE_VERSION` centralizada (ex.: `"v3"`).
- Usar essa versão tanto no `buster` quanto no `CACHE_KEY` (ex.: `uf-cache-v3`).
- Implementar limpeza de chaves legadas (`uf-cache-v1`, `uf-cache-v2`) na inicialização.
- Manter TTL 24h (compatível com refresh diário), mas com invalidação explícita por versão de release.

Resultado esperado: produção não reaproveita snapshot incompatível após mudanças de lógica.

### Etapa 4 — Telemetria de validação controlada (temporária)
- Adicionar logs estruturados (guardados por flag debug) para:
  - `periodo`, `maxDate`, `limite`;
  - `cancelados.length`, `filtered.length`;
  - contagem por origem (eventos/churn_status) após unificação.
- Remover automaticamente no final da validação.

Resultado esperado: rastreabilidade objetiva sem poluir produção permanentemente.

### Etapa 5 — Protocolo de validação final em produção
Checklist obrigatório por tenant (igp-fibra, zen-telecom, d-kiros):
1. Abrir Cancelamentos e validar 7d/30d/90d.
2. Confirmar igualdade entre subtítulo e KPI “Total Cancelados”.
3. Confirmar coerência com Visão Geral no mesmo período/filtros.
4. Hard reload + nova sessão para validar hidratação de cache após version bump.
5. Repetir em janela anônima (garante ausência de estado residual).

## Ordem de implementação (sequenciamento)

1. Ajustes de cálculo e dependências (Etapa 1).
2. Normalização de data (Etapa 2).
3. Versionamento/invalidação cache (Etapa 3).
4. Instrumentação de validação (Etapa 4).
5. Teste cruzado e aceite de produção (Etapa 5).

## Critério de aceite (definitivo)

- KPI “Total Cancelados” varia corretamente em 7d/30d/90d.
- Subtítulo = KPI em todos os períodos.
- Números de Cancelamentos e Visão Geral permanecem consistentes para o mesmo tenant/período/filtros.
- Sem regressão em d-kiros.
- Sem efeito de cache antigo após deploy (nova versão limpa e hidrata corretamente).

## Seção técnica (resumo das causas prováveis remanescentes)

- Inconsistência residual de derivação (`cancelados` vs `filtered`) em blocos da página.
- `useMemo` com dependências incompletas (estado antigo reutilizado).
- Parsing de data não padronizado.
- Política de cache sem rotação robusta por release de lógica.

Com isso, a correção deixa de ser pontual e passa a ser **estrutural**, cobrindo cálculo, temporalidade e persistência de dados em produção.
