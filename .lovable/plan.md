

## Plano: Migrar fonte de dados de Churn para tabelas dedicadas (churn_*)

### Contexto

Atualmente, a lógica de cancelamentos usa a tabela `eventos` como fonte primária de `data_cancelamento`, com fallback para `churn_status`. Isso causa inconsistências entre tenants (d-kiros sem dados, zen-telecom com datas fixas). Após a normalização feita via Claude Code, os dados corretos agora residem nas tabelas `churn_status`, `churn_history`, `churn_events` e `churn_ixc_confirmados` do Supabase externo.

O objetivo é simplificar: **dados de churn vêm sempre e exclusivamente das tabelas churn_***.

### Mudanças necessárias

#### 1. Refatorar `useChurnData.ts` — adicionar total de clientes da base

O hook já busca `churn_status` e `churn_events`. Precisamos:
- Adicionar query para contar o **total de clientes ativos** (denominador da taxa de churn) diretamente de `churn_status` (clientes com `status_churn != 'cancelado'` + cancelados = total)
- Expor `totalClientesBase` como contagem de clientes únicos (deduplicated por `cliente_id`)

#### 2. Reescrever `churnUnified.ts` — eliminar dependência de `eventos`

- Remover import de `Evento`
- Remover `eventoToChurnStatus()` 
- Remover `buildUnifiedCancelados()` (não mais necessária — cancelados vêm direto de `churn_status` filtrado por `status_churn === 'cancelado'`)
- Reescrever `getTotalClientesBase()` para receber `ChurnStatus[]` em vez de `Evento[]`
- A nova lógica: cancelados = `churn_status.filter(s => s.status_churn === 'cancelado' && s.data_cancelamento != null)`
- Total base = todos os clientes únicos em `churn_status` (deduplicated por `cliente_id`)

#### 3. Refatorar `Cancelamentos.tsx`

- Remover `useEventos()` — não mais necessário para esta página
- Remover `buildUnifiedCancelados(eventos, churnStatus)` 
- Cancelados = `churnStatus.filter(c => c.status_churn === 'cancelado' && c.data_cancelamento)`
- `totalClientesBase` = contagem de `cliente_id` únicos em `churnStatus`
- Os filtros de período (7d/30d/90d) continuam usando `new Date()` como referência e `data_cancelamento` de `churn_status`
- O cohort por dimensão usa `churnStatus` para o denominador total por plano/cidade/bairro em vez de `eventos`

#### 4. Refatorar `VisaoGeral.tsx` — bloco de Taxa de Churn

- No bloco `saudeAtual` (linhas ~280-315), substituir a lógica que itera `filteredEventos` buscando `data_cancelamento` por uma iteração direta em `churnStatus`
- Remover o fallback condicional (if cancelados via eventos === 0, use churn_status) — agora é sempre `churn_status`
- O denominador `totalClientes` pode continuar vindo de `eventos` (para os demais KPIs da Visão Geral), mas a taxa de churn usará `churnStatus` como numerador

#### 5. Cleanup

- Remover `eventoToChurnStatus` e `buildUnifiedCancelados` de `churnUnified.ts`
- Remover import de `useEventos` em `Cancelamentos.tsx`
- Atualizar imports em ambas as páginas

### Resultado esperado

- **Cancelamentos.tsx**: dados vêm 100% de `churn_status` (cancelados + scores + datas)
- **VisaoGeral.tsx**: taxa de churn vem de `churn_status`, demais KPIs continuam via `eventos`
- **Consistência total**: mesma fonte, mesma contagem, para todos os tenants (igp-fibra, zen-telecom, d-kiros)
- **Sem divergências**: eliminada a lógica all-or-nothing de eventos vs churn_status

### Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/lib/churnUnified.ts` | Reescrita — remover lógica de eventos, simplificar para churn_status only |
| `src/pages/Cancelamentos.tsx` | Refatorar — remover useEventos, usar churnStatus direto |
| `src/pages/VisaoGeral.tsx` | Ajustar bloco saudeAtual — churn vem de churn_status |
| `src/hooks/useChurnData.ts` | Opcional: expor contagem de base se necessário |

