

# Ajustes Finais de UI e Correções

## 1. Mapa padrão em pins (Visão Geral)
**Arquivo:** `src/pages/VisaoGeral.tsx` (linha 159)
- O estado `mapViewMode` já está como `"markers"` — isso está correto e não precisa de alteração.
- Validarei se há algum outro local que sobrescreve esse valor.

## 2. Remover totalizador "Clientes a Vencer" (Financeiro)
**Arquivo:** `src/pages/Financeiro.tsx` (linhas 488-494)
- O KPI "Clientes a Vencer" já não possui `subtitle`. Está correto — sem alteração necessária.

## 3. Remover totalizador do box "Taxa Churn" (Cancelamentos)
**Arquivo:** `src/pages/Cancelamentos.tsx` (linha 649)
- Remover a linha: `{kpis.totalCancelados} de {totalClientesBase.toLocaleString()} clientes`
- Manter apenas o percentual no card.

## 4. Tab "Abrir Chamado" — botão desabilitado com "Em Breve"
**Arquivo:** `src/components/crm/CrmDrawer.tsx` (linhas 725-733)
- Trocar o texto do botão de "Abrir Chamado (OS)" para "Em Breve"
- Adicionar `disabled` ao botão
- Remover o onClick que simula abertura de chamado

## 5. Tabelas ordenadas por Churn Score (desc) como padrão
**Arquivos afetados:**
- `src/pages/Cancelamentos.tsx` (linha 103): trocar default de `"data_cancelamento"` para `"churn_risk_score"`
- `src/pages/Financeiro.tsx` (linha 104): trocar default de `"diasAtraso"` para `"churnScore"` (a coluna já existe no type `SortColumn`)

## 6. Corrigir WhatsApp (erro na abertura da tab)
**Arquivo:** `src/components/crm/CrmDrawer.tsx` (linhas 252-292)
- O problema é que dentro de um iframe (preview do Lovable), `window.open` e links `_blank` são bloqueados.
- Solução: usar `window.open` com fallback para `window.location.href` na mesma aba como último recurso, removendo a tentativa de `window.top` que causa erro de cross-origin.
- Melhorar a mensagem padrão do WhatsApp de "Oi" para algo mais contextual: "Olá, gostaria de saber como está a qualidade do seu serviço."
- Garantir normalização robusta: remover não-numéricos, prefixo 55 obrigatório, e `encodeURIComponent` na mensagem.

## Detalhes Técnicos

### Cancelamentos.tsx — linha 649
```
ANTES: <p className="text-[10px]...">{kpis.totalCancelados} de {totalClientesBase.toLocaleString()} clientes</p>
DEPOIS: (remover a linha inteira)
```

### CrmDrawer.tsx — Tab Chamado (linhas 730-733)
```
ANTES:  <Button variant="outline" ... onClick={...}>
          <Wrench .../>Abrir Chamado (OS)
        </Button>
DEPOIS: <Button variant="outline" ... disabled>
          <Wrench .../>Em Breve
        </Button>
```

### CrmDrawer.tsx — WhatsApp (linhas 252-292)
- Simplificar a lógica de abertura para: `window.open(waUrl, "_blank") || (window.location.href = waUrl)`
- Remover referência a `window.top` que causa erro cross-origin no iframe
- Mensagem default: "Olá, gostaria de saber como está a qualidade do seu serviço."

### Cancelamentos.tsx — sort default (linha 103)
```
ANTES:  useState<SortField>("data_cancelamento")
DEPOIS: useState<SortField>("churn_risk_score")
```

### Financeiro.tsx — sort default (linha 104)
```
ANTES:  useState<SortColumn>("diasAtraso")
DEPOIS: useState<SortColumn>("churnScore")
```
