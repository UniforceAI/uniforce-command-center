# API Clients - Uniforce

Este diretório contém wrappers REST API para integração com serviços externos.

## Serviços Configurados

### 1. n8n (via MCP)
- **Tipo**: MCP Server
- **Configuração**: `~/.config/claude-code/mcp_settings.json`
- **Autenticação**: Cloudflare Access + API Key
- **Ferramentas disponíveis**:
  - `mcp__n8n-cloudflare__list_workflows`
  - `mcp__n8n-cloudflare__get_workflow`
  - `mcp__n8n-cloudflare__execute_workflow`
  - `mcp__n8n-cloudflare__update_workflow`
  - `mcp__n8n-cloudflare__list_executions`
  - `mcp__n8n-cloudflare__get_execution`

### 2. Supabase (via REST API)
Dois projetos configurados:

#### Projeto 1: bqljfrferpzkzwoxlnya
- **URL**: https://bqljfrferpzkzwoxlnya.supabase.co
- **Tipo**: Service Role Key (acesso completo)
- **Cliente**: `supabase1` ou `supabase1API`

#### Projeto 2: yqdqmudsnjhixtxldqwi
- **URL**: https://yqdqmudsnjhixtxldqwi.supabase.co
- **Tipo**: Anon Key (acesso público)
- **Cliente**: `supabase2` ou `supabase2API`
- **Configuração**: `.env` (SUPABASE_URL, SUPABASE_KEY)

### 3. Postman (via REST API)
- **Tipo**: REST API
- **Configuração**: `.env` (POSTMAN_API_KEY)
- **Status**: Opcional - adicione POSTMAN_API_KEY ao .env para usar

## Instalação

```bash
npm install
```

## Teste de Conexões

Execute o script de teste para verificar se todas as integrações estão funcionando:

```bash
npm run test:api
```

## Uso

### Importar APIs

```javascript
// Importar todas as APIs
import { supabase1API, supabase2API, postmanAPI } from './lib/api/index.js';

// Ou importar o objeto default
import api from './lib/api/index.js';
```

### Supabase - Exemplos de Uso

#### Query (SELECT)
```javascript
// Projeto 1
const users = await supabase1API.query('users', {
  select: 'id, name, email',
  filter: { active: true },
  limit: 10,
  order: { column: 'created_at', ascending: false }
});

// Projeto 2
const logs = await supabase2API.query('logs', {
  filter: { level: 'error' },
  limit: 50
});
```

#### Insert
```javascript
const newUser = await supabase1API.insert('users', {
  name: 'João Silva',
  email: 'joao@example.com',
  active: true
});
```

#### Update
```javascript
const updated = await supabase1API.update(
  'users',
  { id: 123 },
  { name: 'João Silva Jr.' }
);
```

#### Delete
```javascript
const deleted = await supabase1API.delete('users', { id: 123 });
```

### Postman - Exemplos de Uso

```javascript
import { postmanAPI } from './lib/api/index.js';

// Listar collections
const collections = await postmanAPI.getCollections();

// Obter detalhes de uma collection
const collection = await postmanAPI.getCollection('collection-id');

// Criar nova collection
const newCollection = await postmanAPI.createCollection({
  info: {
    name: 'My API Collection',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: []
});

// Listar workspaces
const workspaces = await postmanAPI.getWorkspaces();

// Listar environments
const environments = await postmanAPI.getEnvironments();
```

## Estrutura de Arquivos

```
lib/api/
├── index.js              # Exports centralizados
├── supabase-client.js    # Cliente Supabase (ambos projetos)
├── postman-client.js     # Cliente Postman
├── test-connections.js   # Script de teste
└── README.md            # Esta documentação
```

## Configuração do Postman

Para usar a API do Postman:

1. Acesse https://go.postman.co/settings/me/api-keys
2. Crie uma nova API key
3. Adicione ao `.env`:
   ```
   POSTMAN_API_KEY=PMAK-xxxxxxxxxxxxxxxxxx
   ```
4. Execute `npm run test:api` para verificar

## Suporte

Para problemas ou dúvidas sobre as integrações, execute primeiro:
```bash
npm run test:api
```

Isso mostrará o status de cada integração e possíveis erros de configuração.
