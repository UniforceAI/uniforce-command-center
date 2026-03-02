
# Correção definitiva: Espaçamento do Card, Ações na Tabela de Chamados, e Ordenação Global por Churn Score

## 1. Espaçamento do Card CRM (CrmDrawer.tsx)

**Causa raiz identificada:** O `DialogHeader` usa `space-y-0`, anulando qualquer espaçamento automático entre filhos. Os `Separator` e blocos usam margens pequenas (`mt-5`, `mt-6`) que se acumulam visualmente como "colados".

**Correção:**
- Remover `space-y-0` do `DialogHeader` e substituir por um wrapper interno com `space-y-6` envolvendo todos os blocos (A ate E)
- Remover as margens manuais (`mt-5`, `mt-6`) dos `Separator` e dos blocos de conteudo
- Cada `Separator` fica naturalmente espaçado pelo `space-y-6` do wrapper pai (24px antes e depois)
- Aumentar o padding inferior do header de `pb-6` para `pb-8`

Resultado: separacao visual forte e uniforme entre TODOS os blocos sem depender de micro-ajustes de margem.

## 2. Icones de Acao na Tabela "Clientes em Risco" (pagina Chamados)

**Problema:** Na coluna "Acoes" da `ClientesTable.tsx`, tanto o icone de perfil (User via ActionMenu) quanto o icone do olho (Eye) chamam `onClienteClick(chamado)`, que abre o `ClienteDetailsSheet` (side panel de detalhes do chamado). Nenhum dos dois abre o CrmDrawer (card de perfil CRM).

**Correção:**
- O icone **User** (perfil) deve abrir o **CrmDrawer** (card do cliente CRM). Para isso, a pagina `Index.tsx` precisa integrar o CrmDrawer e passar um handler diferente para o ActionMenu.
- O icone **Eye** (olho) continua abrindo o **ClienteDetailsSheet** (side panel lateral de detalhes do chamado), como ja faz.

**Implementacao tecnica:**
- Em `Index.tsx`, importar e montar o `CrmDrawer` (como ja feito em VisaoGeral, Financeiro, etc.)
- Criar estado para `selectedCrmCliente` separado do `selectedCliente` (sheet)
- Passar para `ClientesTable` dois callbacks: `onOpenProfile` (abre CrmDrawer) e `onClienteClick` (abre Sheet)
- Na `ClientesTable`, o `ActionMenu.onOpenProfile` chama o callback de perfil CRM, e o `Eye` chama o callback de detalhes do chamado

## 3. Ordenacao padrao por Churn Score (todas as tabelas)

**Problema:** Cada tabela tem ordenacao padrao diferente (Data de Abertura, atraso, etc.). O objetivo do dashboard e deixar problemas visiveis, entao o Churn Score deve ser o criterio primario.

**Tabelas a ajustar:**
- `ClientesTable.tsx` (Chamados): mudar de `{ id: 'Data de Abertura', desc: true }` para `{ id: 'score-risco', desc: true }` - porem essa coluna tem `enableSorting: false`, entao precisa habilitar sorting nela tambem com accessorFn que retorna o score do churnMap
- `RiskClientsTable.tsx` (Visao Geral): ja usa `score` como default `desc` - OK
- `ExpandableCobrancaTable.tsx` (Financeiro): mudar default de `"atraso"` para `"score"` (campo de churn score)
- `NPSTable.tsx` (NPS): mudar de `[]` (sem sort) para sort por score desc
- `DataTable.tsx` (Churn/Retencao): verificar se aceita default sort, ajustar se necessario

**Detalhes tecnicos por arquivo:**

### ClientesTable.tsx
- Adicionar `accessorFn` na coluna `score-risco` que retorna `churnMap.get(clienteId)?.score ?? -1`
- Habilitar `enableSorting: true`
- Mudar sorting inicial para `[{ id: 'score-risco', desc: true }]`

### ExpandableCobrancaTable.tsx
- Verificar se ha coluna de score e ajustar `sortField` default

### NPSTable.tsx
- Verificar se ha coluna de churn score, adicionar se necessario, e definir como sort default

## Arquivos a editar
1. `src/components/crm/CrmDrawer.tsx` - espacamento
2. `src/components/dashboard/ClientesTable.tsx` - acoes + sort
3. `src/pages/Index.tsx` - integrar CrmDrawer + separar callbacks
4. `src/components/dashboard/RiskClientsTable.tsx` - ja OK (sort por score)
5. `src/components/shared/ExpandableCobrancaTable.tsx` - sort default
6. `src/components/nps/NPSTable.tsx` - sort default
7. `src/components/shared/DataTable.tsx` - sort default

## Sequencia
1. Espacamento do card (correcao visual imediata)
2. Acoes da tabela de chamados (funcionalidade correta)
3. Ordenacao global por churn score (consistencia)
