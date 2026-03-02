
## Diagnóstico consolidado (com base no código atual)

Você está certo: os 3 problemas têm causa técnica concreta e hoje não estão “fechados” de forma robusta.

### 1) Card do cliente: por que o espaçamento “não parece mudar”
No `CrmDrawer.tsx` os espaçamentos foram alterados, mas o ganho visual ficou pequeno porque:
- o aumento foi incremental (`mt-6`→`mt-8`, `gap-y-4`→`gap-y-5`);
- não houve separação estrutural entre blocos (infos, métricas, score, etiquetas);
- o header continua muito denso visualmente para a quantidade de informação.

Resultado: tecnicamente mudou, mas perceptivamente ainda parece “colado”.

### 2) WhatsApp: por que ainda falha mesmo com `wa.me`
A documentação oficial foi seguida parcialmente (formato `wa.me`, número sem símbolos, `text` codificado), porém há um ponto de execução:
- em contexto de iframe/navegador, `window.open` pode ser bloqueado por política de popup;
- o fallback atual (`window.location.assign`) pode não resolver no preview em alguns cenários de navegação embutida;
- ainda falta estratégia de abertura “browser-safe” mais resiliente.

Ou seja: o problema não é só URL, é **mecânica de abertura do link** no ambiente real.

### 3) Mapa com poucos quadrantes (2 células com milhares de registros)
No `AlertasMapa.tsx`:
- a grade só renderiza células **ocupadas**;
- muitos clientes compartilham coordenadas iguais (ou quase iguais), então mesmo com `gridCount=40` colapsa em poucas células;
- quando a origem não tem geocoordenada, usa fallback por bairro (coordenadas centrais), o que também concentra.

Conclusão: aumentar apenas `gridCount` não garante 10x mais quadrantes se os pontos de origem são repetidos.

---

## Confirmação sobre “feature única” do card

Sim: o **card principal de perfil CRM** é único (`CrmDrawer`) e é reutilizado em:
- `VisaoGeral`
- `Financeiro`
- `ClientesEmRisco`
- `Cancelamentos`
- `NPS`

Portanto, corrigindo `CrmDrawer`, corrige para essas áreas.  
(`Index`/`Chamados` ainda usa um `ClienteDetailsSheet` separado, que não é o mesmo componente.)

---

## Plano de implementação (correção definitiva)

## Etapa 1 — Espaçamento do card com mudança visual clara (não incremental)
**Arquivo:** `src/components/crm/CrmDrawer.tsx`

1. Reestruturar header em blocos com wrappers dedicados:
- Bloco A: identidade do cliente
- Bloco B: dados cadastrais
- Bloco C: métricas rápidas
- Bloco D: score breakdown
- Bloco E: etiquetas

2. Substituir apenas `mt-*` por separação forte:
- `space-y-6` / `space-y-7` por bloco
- inserir `Separator` entre blocos principais
- aumentar paddings internos dos cards de métrica (`p-2` → `p-3`)
- manter responsividade sem “estourar” mobile

3. Ajustar densidade de texto:
- labels com `leading-relaxed`
- badges com `py-1` e `gap-2` consistentes

**Resultado esperado:** diferença visual evidente e consistente em todas as páginas que usam `CrmDrawer`.

---

## Etapa 2 — WhatsApp robusto (alinhado à documentação oficial + anti-bloqueio real)
**Arquivo:** `src/components/crm/CrmDrawer.tsx`

1. Normalização final do telefone:
- remover não dígitos
- remover zeros à esquerda
- prefixar `55` quando necessário
- validar formato final (12–13 dígitos)

2. Link oficial:
- `https://wa.me/<numero>?text=<urlencoded>`

3. Estratégia de abertura em camadas (mais robusta que atual):
- tentativa A: abrir via elemento `<a target="_blank" rel="noopener noreferrer">` com clique programático no gesto do usuário;
- tentativa B: `window.open` tradicional;
- tentativa C: `window.top.location.href` (quando permitido) / `window.location.href` como fallback final.

4. Instrumentação de erro:
- `toast` específico para cada falha (número inválido, bloqueio, navegação impedida)
- log técnico para facilitar diagnóstico se ainda bloquear em ambiente específico

**Resultado esperado:** sai do ciclo “aba bloqueada” em preview e produção com fallback previsível.

---

## Etapa 3 — Quadrantes 10x mais granulares para cidades pequenas
**Arquivo:** `src/components/map/AlertasMapa.tsx`  
**Ajuste complementar:** `src/pages/VisaoGeral.tsx`

1. Tornar a grade configurável:
- adicionar prop `gridDensity` (ex.: 40 padrão, 120/160 para alta resolução).

2. Implementar subdivisão adaptativa por densidade:
- para células com alta concentração, subdividir internamente (subgrid local) ao invés de manter célula única.

3. Tratar coordenadas idênticas (causa principal do colapso):
- aplicar jitter determinístico mínimo por `cliente_id` (somente para renderização de grid, sem alterar dado base),
- evita “milhares de registros no mesmo pixel”.

4. Controle na UI:
- seletor “Granularidade do mapa”: Normal / Alta / Muito Alta
- manter performance com limite de células renderizadas e simplificação progressiva.

**Resultado esperado:** mapa deixa de mostrar 2 quadrados e passa a exibir distribuição útil para operação local.

---

## Sequência recomendada (para reduzir retrabalho)

1. Corrigir WhatsApp (impacto direto em operação diária)  
2. Corrigir espaçamento estrutural do card (visível em todo CRM)  
3. Entregar granularidade do mapa com controle de densidade

---

## Verificação objetiva (aceite)

1. **Card CRM**
- Abrir perfil em `/visao-geral`, `/financeiro`, `/clientes-em-risco`.
- Confirmar separação visível entre blocos (não só micro-ajuste).

2. **WhatsApp**
- Testar com telefone em formatos diferentes: `(47) 99999-9999`, `5547999999999`, `047999999999`.
- Confirmar abertura em pelo menos uma das estratégias sem “aba bloqueada”.

3. **Mapa**
- Em IGP Telecom, alternar granularidade para “Muito Alta”.
- Confirmar aumento real de quadrantes e melhor leitura espacial (sem concentrar tudo em 2 células).

---

## Riscos e mitigação

- **Bloqueio de navegação externa no ambiente embutido:** fallback em múltiplas camadas + mensagens claras.
- **Mapa pesado em densidade alta:** teto de renderização + modo progressivo.
- **Jitter mascarar precisão:** jitter mínimo, determinístico e apenas para visualização agregada.
