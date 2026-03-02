## Diagnóstico objetivo do que está acontecendo

Você está certo em cobrar: os dois pontos que você citou (espaçamento do card e WhatsApp) ainda não estão robustos no código atual.

### 1) Espaçamento do card “sem efeito”

No arquivo `src/components/crm/CrmDrawer.tsx`, os espaçamentos ainda estão com valores curtos nos pontos críticos:

- infos do cliente: `mt-6` + `gap-y-4`
- boxes de informação: `mt-8` + `gap-2`
- badges de score: `mt-7`
- etiquetas: `mt-7`

Ou seja, a lógica de espaçamento “mais respirada” não foi aplicada de forma consistente no bloco inteiro do header. Por isso visualmente continua “grudado”.

### 2) Botão WhatsApp “aba bloqueada”

Você confirmou que o erro é **aba bloqueada**.  
No código atual, o handler usa:

- `window.open(link, "_blank", "noopener,noreferrer")`

Mesmo estando correto em vários cenários, em algumas combinações de navegador + iframe + política de popup, isso pode ser bloqueado.

Também há fragilidades no número:

- sanitiza `\D`, mas não remove zeros à esquerda
- não valida tamanho mínimo/máximo antes de abrir
- pode montar URL inválida em casos específicos do dado

---

## Conferência com a documentação oficial (clique para conversa)

Com base na doc oficial que você enviou, as regras corretas são:

1. Formato: `https://wa.me/<numero>`
2. Número em formato internacional completo, só dígitos
3. Sem `+`, `()`, `-`, espaços
4. Mensagem em `?text=` com `encodeURIComponent`
5. No seu caso: se não começar com `55`, prefixar `55`

### Situação atual vs doc

- **Correto no código atual:** usa `wa.me`, remove não-numéricos, usa `encodeURIComponent`.
- **Incompleto:** não trata zeros à esquerda e não tem fallback anti-bloqueio de popup.
- **Resultado prático:** comportamento intermitente (aba bloqueada), exatamente o que você está vendo.

---

## Do I know what the issue is?

Sim.  
O problema principal do WhatsApp não é “URL errada”, e sim **abertura da aba em contexto bloqueável + normalização incompleta do telefone**.  
No card, o problema é **escala de spacing aplicada parcialmente**, não de forma sistêmica no header inteiro.

---

## Plano de implementação (correção definitiva)

### Etapa 1 — Corrigir espaçamento do card de forma uniforme

**Arquivo:** `src/components/crm/CrmDrawer.tsx`

Aplicar uma escala única de espaçamento vertical para todas as seções do topo do card:

- Bloco infos cliente: subir para `mt-8` e `gap-y-5`
- Bloco boxes: `mt-10` e `gap-3` (ou `gap-4` se necessário após teste)
- Bloco badges de score: `mt-8` com `gap-2`
- Bloco etiquetas: `mt-8`, título com `mb-2` explícito para não “colar”
- Garantir `pb` no header para não encostar nas tabs

Objetivo: o mesmo “respiro” da última linha de infos (telefone/vencimento) replicado para boxes, badges e etiquetas.

---

### Etapa 2 — Corrigir WhatsApp com robustez anti-bloqueio

**Arquivo:** `src/components/crm/CrmDrawer.tsx`

Refatorar `handleWhatsApp` com 3 camadas:

1. **Normalização forte do número**
  - converter para string
  - remover não-numéricos
  - remover zeros à esquerda
  - prefixar `55` quando necessário
  - validar comprimento esperado antes de abrir
2. **Montagem do link oficial**
  - `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
  - mensagem padrão configurável (mantendo padrão comercial definido)
3. **Abertura com fallback anti-popup**
  - abrir `about:blank` imediatamente no clique do usuário
  - setar `popup.location.href = waMeUrl`
  - se `popup` vier nulo (bloqueio), fallback para `window.location.assign(waMeUrl)` (mesma aba)

Também registrar ação no CRM somente após tentar abrir, e exibir toast claro em caso de número inválido.

---

### Etapa 3 — Evitar novo retrabalho (validação guiada)

Após implementar:

1. Testar com número formatado `(11) 97691-9401` e com número já internacional
2. Validar em preview que não ocorre “aba bloqueada”
3. Conferir visual do topo do card com foco em:
  - distância entre infos → boxes
  - distância boxes → badges churn score
  - distância badges → título “Etiquetas”
4. Testar o mesmo card nas páginas principais que o usam (`/`, `/financeiro`, `/chamados`, `/cancelamentos`, `/nps`) para garantir consistência visual global

---

## Arquivos impactados

- `src/components/crm/CrmDrawer.tsx` (único arquivo necessário para os dois problemas relatados)

---

## Riscos e mitigação

- **Risco:** popup continuar bloqueado em algum navegador muito restritivo  
**Mitigação:** abrir eu uma nova aba.
- **Risco:** dados de celular com qualidade ruim no backend  
**Mitigação:** validação forte + toast explicativo (não tentar abrir URL quebrada).
- **Risco:** espaçamento ficar excessivo em telas menores  
**Mitigação:** ajustar com classes responsivas (`sm:`) após validação visual.