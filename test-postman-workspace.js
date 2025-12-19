#!/usr/bin/env node

/**
 * Script para testar conexão com Postman API e workspace específico
 */

import { postmanAPI } from './lib/api/index.js';
import dotenv from 'dotenv';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testPostmanConnection() {
  log('\n═══════════════════════════════════════════════════', 'bright');
  log('  🧪 TESTE DE CONEXÃO - POSTMAN API', 'bright');
  log('═══════════════════════════════════════════════════', 'bright');

  try {
    // Verificar se a API Key está configurada
    if (!process.env.POSTMAN_API_KEY) {
      log('\n❌ POSTMAN_API_KEY não encontrada no .env', 'red');
      return false;
    }

    log('\n✅ API Key configurada', 'green');
    log(`   Key: ${process.env.POSTMAN_API_KEY.substring(0, 20)}...`, 'cyan');

    // Teste 1: Listar Workspaces
    log('\n📋 Teste 1: Listando workspaces...', 'blue');
    const workspaces = await postmanAPI.getWorkspaces();
    log(`✅ ${workspaces.length} workspace(s) encontrado(s)`, 'green');

    workspaces.forEach((ws, index) => {
      log(`   ${index + 1}. ${ws.name} (${ws.type})`, 'cyan');
      log(`      ID: ${ws.id}`, 'yellow');
    });

    // Teste 2: Buscar workspace específico
    const targetWorkspaceId = process.env.POSTMAN_WORKSPACE_ID || '46f8007d-550c-46e6-8a9d-729577ee3329';
    log(`\n📂 Teste 2: Buscando workspace específico...`, 'blue');
    log(`   ID: ${targetWorkspaceId}`, 'cyan');

    const workspace = await postmanAPI.getWorkspace(targetWorkspaceId);
    log('\n✅ Workspace encontrado:', 'green');
    log(`   Nome: ${workspace.name}`, 'cyan');
    log(`   Tipo: ${workspace.type}`, 'cyan');
    log(`   ID: ${workspace.id}`, 'cyan');
    log(`   Visibilidade: ${workspace.visibility}`, 'cyan');

    if (workspace.collections && workspace.collections.length > 0) {
      log(`\n   📦 Collections (${workspace.collections.length}):`, 'yellow');
      workspace.collections.forEach((col, index) => {
        log(`      ${index + 1}. ${col.name}`, 'cyan');
        log(`         UID: ${col.uid}`, 'yellow');
      });
    } else {
      log(`\n   📦 Nenhuma collection encontrada neste workspace`, 'yellow');
    }

    if (workspace.environments && workspace.environments.length > 0) {
      log(`\n   🌍 Environments (${workspace.environments.length}):`, 'yellow');
      workspace.environments.forEach((env, index) => {
        log(`      ${index + 1}. ${env.name}`, 'cyan');
        log(`         UID: ${env.uid}`, 'yellow');
      });
    } else {
      log(`\n   🌍 Nenhum environment encontrado neste workspace`, 'yellow');
    }

    // Teste 3: Listar todas as collections
    log('\n📚 Teste 3: Listando todas as collections...', 'blue');
    const collections = await postmanAPI.getCollections();
    log(`✅ ${collections.length} collection(s) encontrada(s)`, 'green');

    if (collections.length > 0) {
      collections.slice(0, 5).forEach((col, index) => {
        log(`   ${index + 1}. ${col.name}`, 'cyan');
        log(`      UID: ${col.uid}`, 'yellow');
      });

      if (collections.length > 5) {
        log(`   ... e mais ${collections.length - 5} collection(s)`, 'cyan');
      }
    }

    // Teste 4: Listar environments
    log('\n🌐 Teste 4: Listando environments...', 'blue');
    const environments = await postmanAPI.getEnvironments();
    log(`✅ ${environments.length} environment(s) encontrado(s)`, 'green');

    if (environments.length > 0) {
      environments.slice(0, 5).forEach((env, index) => {
        log(`   ${index + 1}. ${env.name}`, 'cyan');
        log(`      UID: ${env.uid}`, 'yellow');
      });

      if (environments.length > 5) {
        log(`   ... e mais ${environments.length - 5} environment(s)`, 'cyan');
      }
    }

    return true;
  } catch (error) {
    log(`\n❌ Erro ao conectar com Postman API:`, 'red');
    log(`   ${error.message}`, 'red');

    if (error.response) {
      log(`\n   Status HTTP: ${error.response.status}`, 'yellow');
      log(`   Mensagem: ${error.response.data?.error?.message || error.response.statusText}`, 'yellow');

      if (error.response.status === 401) {
        log(`\n   ⚠️  A API Key pode estar inválida ou expirada`, 'yellow');
      }
    }

    return false;
  }
}

async function runTest() {
  const result = await testPostmanConnection();

  log('\n═══════════════════════════════════════════════════', 'bright');
  log('  📊 RESULTADO DO TESTE', 'bright');
  log('═══════════════════════════════════════════════════', 'bright');

  log(`\nPostman API: ${result ? '✅ Conectado e Funcional' : '❌ Falhou'}`, result ? 'green' : 'red');

  log('\n═══════════════════════════════════════════════════\n', 'bright');

  process.exit(result ? 0 : 1);
}

// Executar teste
runTest().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});
