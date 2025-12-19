# Guia de Configuração - GitHub API

Este guia mostra como configurar o acesso à API do GitHub da Uniforce via REST API.

---

## 🎯 Objetivo

Acessar repositórios, Pull Requests, Issues e outros recursos do GitHub da organização Uniforce, incluindo projetos desenvolvidos no Lovable ou outras plataformas.

---

## 📋 Pré-requisito: Obter Personal Access Token

O GitHub usa **Personal Access Tokens (PAT)** para autenticação via API REST.

### Tipos de Tokens:

1. **Fine-grained tokens** (Recomendado)
   - Mais seguro e granular
   - Permissões específicas por repositório
   - Expiração obrigatória
   - Melhor para organizações

2. **Classic tokens**
   - Permissões mais amplas
   - Mais simples de configurar
   - Expiração opcional

---

## 🔑 Como Obter o Personal Access Token

### Opção 1: Fine-Grained Token (Recomendado)

1. **Acesse a página de tokens:**
   - https://github.com/settings/tokens

2. **Clique em "Generate new token" → "Fine-grained token"**

3. **Configure o token:**

   **Nome do Token:**
   ```
   Uniforce Integration - Produção
   ```

   **Expiração:**
   ```
   90 dias (ou conforme política da empresa)
   ```

   **Descrição (opcional):**
   ```
   Token para integração com APIs da Uniforce
   Permite acesso a repositórios, PRs e Issues
   ```

   **Resource owner:**
   ```
   Selecione: uniforce (organização)
   ```

   **Repository access:**
   ```
   Opção 1: All repositories (acesso a todos os repos)
   Opção 2: Only select repositories (escolha repos específicos)
   ```

   **Permissions:**

   **Repository permissions (acesso a repositórios):**
   - ✅ **Contents**: `Read and write` (ler/escrever código)
   - ✅ **Metadata**: `Read-only` (obrigatório)
   - ✅ **Pull requests**: `Read and write` (gerenciar PRs)
   - ✅ **Issues**: `Read and write` (gerenciar Issues)
   - ✅ **Commit statuses**: `Read-only` (ver status de commits)
   - ✅ **Deployments**: `Read-only` (ver deployments)
   - ✅ **Workflows**: `Read and write` (acessar GitHub Actions)

   **Organization permissions (acesso à organização):**
   - ✅ **Members**: `Read-only` (ler membros da org)

4. **Clique em "Generate token"**

5. **⚠️ IMPORTANTE: Copie o token IMEDIATAMENTE**
   ```
   Formato: github_pat_xxxxxxxxxxxxxxxxxxxxx
   ```
   Você NÃO poderá vê-lo novamente!

---

### Opção 2: Classic Token (Alternativa)

1. **Acesse:**
   - https://github.com/settings/tokens

2. **Clique em "Generate new token" → "Generate new token (classic)"**

3. **Configure:**

   **Note (Nome):**
   ```
   Uniforce Integration - Produção
   ```

   **Expiration:**
   ```
   90 days (ou conforme política)
   ```

   **Select scopes (Permissões):**
   - ✅ `repo` (Full control of private repositories)
     - [x] repo:status
     - [x] repo_deployment
     - [x] public_repo
     - [x] repo:invite
     - [x] security_events
   - ✅ `read:org` (Read org and team membership)
   - ✅ `read:user` (Read user profile data)
   - ✅ `user:email` (Access user email addresses)

4. **Gere e copie o token**
   ```
   Formato: ghp_xxxxxxxxxxxxxxxxxxxxx
   ```

---

## ⚙️ Configuração no Projeto

### 1. Adicionar Token ao .env

```bash
# Abra o arquivo .env
nano .env
```

Adicione as seguintes linhas:

```env
# GitHub API
GITHUB_TOKEN=seu_token_aqui
GITHUB_ORG=uniforce
```

**Exemplo:**
```env
GITHUB_TOKEN=github_pat_11AABBCCDD...xxxxxxxxxxxxx
GITHUB_ORG=uniforce
```

### 2. Salvar e Testar

```bash
# Teste a conexão
node test-github-connection.js
```

ou

```bash
# Teste todas as APIs
npm run test:api
```

---

## 🧪 Validar Configuração

### Teste Completo:

```bash
$ node test-github-connection.js

═══════════════════════════════════════════════════
  🐙 TESTE DE CONEXÃO - GITHUB API
═══════════════════════════════════════════════════

✅ GitHub Token configurado
   Token: github_pat_11AABBCC...
   Organização: uniforce

👤 Teste 1: Verificando usuário autenticado...
✅ Autenticado como: seu-usuario
   Nome: Seu Nome
   Email: email@example.com
   Tipo: User

📂 Teste 2: Listando repositórios da organização "uniforce"...
✅ 15 repositório(s) encontrado(s) na organização

   Repositórios recentes:
   1. lovable-project-alpha
      Visibilidade: 🔒 Privado
      Linguagem: TypeScript
      Atualizado: 19/12/2025 14:30:00

✅ GitHub API: Conectado e Funcional
```

---

## 💻 Uso no Código

### Importar Cliente

```javascript
import { githubAPI } from './lib/api/index.js';
```

### Exemplos de Uso

#### 1. Listar Repositórios da Organização

```javascript
// Listar todos os repos da org Uniforce
const repos = await githubAPI.getOrgRepos('uniforce');

console.log(`Encontrados ${repos.length} repositórios:`);
repos.forEach(repo => {
  console.log(`- ${repo.name} (${repo.private ? 'Privado' : 'Público'})`);
  console.log(`  URL: ${repo.html_url}`);
  console.log(`  Linguagem: ${repo.language}`);
});
```

#### 2. Acessar Repositório Específico do Lovable

```javascript
// Obter detalhes de um projeto Lovable
const repo = await githubAPI.getRepo('uniforce', 'lovable-project-alpha');

console.log(`Projeto: ${repo.name}`);
console.log(`Descrição: ${repo.description}`);
console.log(`Stars: ${repo.stargazers_count}`);
console.log(`Branch padrão: ${repo.default_branch}`);
```

#### 3. Listar Branches

```javascript
// Ver todas as branches de um projeto
const branches = await githubAPI.getBranches('uniforce', 'lovable-project-alpha');

console.log('Branches disponíveis:');
branches.forEach(branch => {
  console.log(`- ${branch.name}`);
});
```

#### 4. Ver Commits Recentes

```javascript
// Últimos commits do projeto
const commits = await githubAPI.getCommits('uniforce', 'lovable-project-alpha', {
  limit: 10
});

console.log('Commits recentes:');
commits.forEach(commit => {
  console.log(`${commit.sha.substring(0, 7)} - ${commit.commit.message}`);
  console.log(`  Por: ${commit.commit.author.name} em ${commit.commit.author.date}`);
});
```

#### 5. Ler Arquivo do Repositório

```javascript
// Ler conteúdo de um arquivo
const file = await githubAPI.getFileContent(
  'uniforce',
  'lovable-project-alpha',
  'src/App.tsx',
  'main'
);

console.log('Conteúdo do arquivo:');
console.log(file.decodedContent);
```

#### 6. Listar Pull Requests

```javascript
// PRs abertos
const openPRs = await githubAPI.getPullRequests('uniforce', 'lovable-project-alpha', 'open');

console.log(`${openPRs.length} PRs abertos:`);
openPRs.forEach(pr => {
  console.log(`#${pr.number} - ${pr.title}`);
  console.log(`  Por: ${pr.user.login}`);
  console.log(`  ${pr.head.ref} → ${pr.base.ref}`);
});
```

#### 7. Listar Issues

```javascript
// Issues abertas
const issues = await githubAPI.getIssues('uniforce', 'lovable-project-alpha', 'open');

console.log(`${issues.length} issues abertas:`);
issues.forEach(issue => {
  console.log(`#${issue.number} - ${issue.title}`);
  console.log(`  Labels: ${issue.labels.map(l => l.name).join(', ')}`);
});
```

#### 8. Listar Diretórios e Arquivos

```javascript
// Listar conteúdo de um diretório
const contents = await githubAPI.getDirectoryContent(
  'uniforce',
  'lovable-project-alpha',
  'src'
);

console.log('Arquivos e pastas:');
contents.forEach(item => {
  console.log(`${item.type === 'dir' ? '📁' : '📄'} ${item.name}`);
});
```

---

## 🔐 Segurança e Boas Práticas

### ✅ Fazer:

1. **Usar fine-grained tokens** quando possível
2. **Definir expiração** (recomendado: 90 dias)
3. **Dar apenas as permissões necessárias**
4. **Armazenar token no .env** (nunca no código)
5. **Rotacionar tokens periodicamente**
6. **Revogar tokens não utilizados**
7. **Usar tokens diferentes** para ambientes diferentes (dev/prod)

### ❌ Não Fazer:

1. ❌ Commitar o token no Git
2. ❌ Compartilhar tokens por email/chat
3. ❌ Usar o mesmo token para múltiplos propósitos
4. ❌ Deixar tokens sem expiração
5. ❌ Dar permissões em excesso
6. ❌ Logar tokens no console

---

## 🔄 Rotação de Tokens

### Quando Rotacionar:

- ✅ A cada 90 dias (recomendado)
- ✅ Quando alguém sai da equipe
- ✅ Após suspeita de exposição
- ✅ Mudança de ambiente

### Como Rotacionar:

1. Gere um novo token no GitHub
2. Atualize o `.env` com o novo token
3. Teste: `node test-github-connection.js`
4. Revogue o token antigo no GitHub

---

## 🚨 Solução de Problemas

### Erro: "401 Unauthorized"

**Causa:** Token inválido ou expirado

**Solução:**
1. Verifique se o token está correto no .env
2. Gere um novo token
3. Atualize o .env

### Erro: "403 Forbidden"

**Causa:** Permissões insuficientes

**Solução:**
1. Verifique se o token tem as permissões necessárias:
   - repo (para repositórios privados)
   - read:org (para organizações)
2. Gere um novo token com as permissões corretas

### Erro: "404 Not Found"

**Causa:** Organização/repositório não encontrado ou sem acesso

**Solução:**
1. Verifique se o nome da org está correto: `GITHUB_ORG=uniforce`
2. Confirme que você tem acesso à organização
3. Verifique se o repositório existe

### Não vê repositórios da org

**Causa:** Token não tem acesso à organização

**Solução:**
1. No GitHub, configure o token para acessar a org:
   - Settings → Tokens → [seu token]
   - Resource owner: uniforce
   - Salve as mudanças

---

## 📚 Funções Disponíveis

### Repositórios
- `getOrgRepos(org)` - Lista repos da organização
- `getRepo(owner, repo)` - Detalhes de um repo
- `createOrgRepo(org, data)` - Cria novo repo
- `getUserRepos()` - Lista seus repos

### Branches
- `getBranches(owner, repo)` - Lista branches
- `getBranch(owner, repo, branch)` - Detalhes de uma branch

### Commits
- `getCommits(owner, repo, options)` - Lista commits
- `getCommit(owner, repo, sha)` - Detalhes de um commit

### Arquivos
- `getFileContent(owner, repo, path, branch)` - Lê arquivo
- `getDirectoryContent(owner, repo, path, branch)` - Lista diretório

### Pull Requests
- `getPullRequests(owner, repo, state)` - Lista PRs
- `getPullRequest(owner, repo, number)` - Detalhes de PR
- `createPullRequest(owner, repo, data)` - Cria PR

### Issues
- `getIssues(owner, repo, state)` - Lista issues
- `getIssue(owner, repo, number)` - Detalhes de issue
- `createIssue(owner, repo, data)` - Cria issue

### Organização
- `getOrganization(org)` - Info da org
- `getOrgMembers(org)` - Lista membros

### GitHub Actions
- `getWorkflowRuns(owner, repo)` - Lista execuções de workflows

### Releases
- `getReleases(owner, repo)` - Lista releases
- `getLatestRelease(owner, repo)` - Última release

---

## 📞 Suporte

### Documentação Oficial:
- **GitHub API**: https://docs.github.com/rest
- **Personal Access Tokens**: https://docs.github.com/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens

### Testes:
```bash
# Teste GitHub isolado
node test-github-connection.js

# Teste todas as APIs
npm run test:api
```

---

**Última Atualização:** 19/12/2025
**Versão da API GitHub:** 2022-11-28
