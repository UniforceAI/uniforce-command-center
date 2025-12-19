#!/usr/bin/env node

/**
 * Script para testar conexão com GitHub API
 */

import { githubAPI } from './lib/api/index.js';
import dotenv from 'dotenv';

dotenv.config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testGitHubConnection() {
  log('\n═══════════════════════════════════════════════════', 'bright');
  log('  🐙 TESTE DE CONEXÃO - GITHUB API', 'bright');
  log('═══════════════════════════════════════════════════', 'bright');

  try {
    // Verificar se o token está configurado
    if (!process.env.GITHUB_TOKEN) {
      log('\n❌ GITHUB_TOKEN não encontrada no .env', 'red');
      log('\n📝 Como obter o token:', 'yellow');
      log('   1. Acesse: https://github.com/settings/tokens', 'cyan');
      log('   2. Clique em "Generate new token" → "Fine-grained token" (recomendado)', 'cyan');
      log('   3. Configure:', 'cyan');
      log('      - Nome: "Uniforce Integration"', 'cyan');
      log('      - Expiração: 90 dias (ou conforme política)', 'cyan');
      log('      - Permissões:', 'cyan');
      log('        • Repository access: All repositories (ou específicos)', 'cyan');
      log('        • Permissions:', 'cyan');
      log('          - Contents: Read', 'cyan');
      log('          - Metadata: Read', 'cyan');
      log('          - Pull requests: Read and write', 'cyan');
      log('          - Issues: Read and write', 'cyan');
      log('   4. Copie o token e adicione ao .env', 'cyan');
      return false;
    }

    const org = process.env.GITHUB_ORG || 'uniforce';
    log('\n✅ GitHub Token configurado', 'green');
    log(`   Token: ${process.env.GITHUB_TOKEN.substring(0, 20)}...`, 'cyan');
    log(`   Organização: ${org}`, 'cyan');

    // Teste 1: Verificar usuário autenticado
    log('\n👤 Teste 1: Verificando usuário autenticado...', 'blue');
    const user = await githubAPI.getAuthenticatedUser();
    log(`✅ Autenticado como: ${user.login}`, 'green');
    log(`   Nome: ${user.name || 'N/A'}`, 'cyan');
    log(`   Email: ${user.email || 'N/A'}`, 'cyan');
    log(`   Tipo: ${user.type}`, 'cyan');
    log(`   Perfil: ${user.html_url}`, 'magenta');

    // Teste 2: Listar repositórios da organização
    log(`\n📂 Teste 2: Listando repositórios da organização "${org}"...`, 'blue');
    try {
      const orgRepos = await githubAPI.getOrgRepos(org);
      log(`✅ ${orgRepos.length} repositório(s) encontrado(s) na organização`, 'green');

      if (orgRepos.length > 0) {
        log('\n   Repositórios recentes:', 'yellow');
        orgRepos.slice(0, 10).forEach((repo, index) => {
          log(`   ${index + 1}. ${repo.name}`, 'cyan');
          log(`      Visibilidade: ${repo.private ? '🔒 Privado' : '🌍 Público'}`, 'yellow');
          log(`      Linguagem: ${repo.language || 'N/A'}`, 'yellow');
          log(`      Atualizado: ${new Date(repo.updated_at).toLocaleString('pt-BR')}`, 'yellow');
          if (repo.description) {
            log(`      Descrição: ${repo.description.substring(0, 80)}${repo.description.length > 80 ? '...' : ''}`, 'yellow');
          }
        });

        if (orgRepos.length > 10) {
          log(`   ... e mais ${orgRepos.length - 10} repositório(s)`, 'cyan');
        }

        // Teste 3: Detalhes de um repositório específico (usar o primeiro)
        const firstRepo = orgRepos[0];
        log(`\n📖 Teste 3: Obtendo detalhes do repositório "${firstRepo.name}"...`, 'blue');
        const repoDetails = await githubAPI.getRepo(firstRepo.owner.login, firstRepo.name);

        log(`✅ Detalhes do repositório:`, 'green');
        log(`   Nome completo: ${repoDetails.full_name}`, 'cyan');
        log(`   URL: ${repoDetails.html_url}`, 'magenta');
        log(`   Stars: ⭐ ${repoDetails.stargazers_count}`, 'yellow');
        log(`   Forks: 🍴 ${repoDetails.forks_count}`, 'yellow');
        log(`   Branches: ${repoDetails.default_branch} (padrão)`, 'yellow');
        log(`   Tamanho: ${(repoDetails.size / 1024).toFixed(2)} MB`, 'yellow');

        // Teste 4: Listar branches
        log(`\n🌿 Teste 4: Listando branches do repositório...`, 'blue');
        const branches = await githubAPI.getBranches(firstRepo.owner.login, firstRepo.name);
        log(`✅ ${branches.length} branch(es) encontrada(s)`, 'green');

        if (branches.length > 0) {
          branches.slice(0, 5).forEach((branch, index) => {
            log(`   ${index + 1}. ${branch.name}${branch.name === repoDetails.default_branch ? ' (padrão)' : ''}`, 'cyan');
          });
        }

        // Teste 5: Listar commits recentes
        log(`\n💾 Teste 5: Listando commits recentes...`, 'blue');
        const commits = await githubAPI.getCommits(firstRepo.owner.login, firstRepo.name, { limit: 5 });
        log(`✅ ${commits.length} commit(s) recente(s)`, 'green');

        if (commits.length > 0) {
          commits.forEach((commit, index) => {
            log(`   ${index + 1}. ${commit.sha.substring(0, 7)} - ${commit.commit.message.split('\n')[0]}`, 'cyan');
            log(`      Autor: ${commit.commit.author.name} (${new Date(commit.commit.author.date).toLocaleString('pt-BR')})`, 'yellow');
          });
        }

      } else {
        log(`\n⚠️  Nenhum repositório encontrado na organização "${org}"`, 'yellow');
        log('   Verifique se:', 'yellow');
        log('   - O nome da organização está correto', 'cyan');
        log('   - O token tem permissão para acessar a organização', 'cyan');
        log('   - Você é membro da organização', 'cyan');
      }
    } catch (orgError) {
      if (orgError.response?.status === 404) {
        log(`\n⚠️  Organização "${org}" não encontrada ou sem acesso`, 'yellow');
        log('\n📂 Teste alternativo: Listando seus repositórios pessoais...', 'blue');

        const userRepos = await githubAPI.getUserRepos();
        log(`✅ ${userRepos.length} repositório(s) pessoal(is) encontrado(s)`, 'green');

        if (userRepos.length > 0) {
          log('\n   Seus repositórios:', 'yellow');
          userRepos.slice(0, 5).forEach((repo, index) => {
            log(`   ${index + 1}. ${repo.name}`, 'cyan');
            log(`      Visibilidade: ${repo.private ? '🔒 Privado' : '🌍 Público'}`, 'yellow');
            log(`      URL: ${repo.html_url}`, 'magenta');
          });

          if (userRepos.length > 5) {
            log(`   ... e mais ${userRepos.length - 5} repositório(s)`, 'cyan');
          }
        }
      } else {
        throw orgError;
      }
    }

    // Teste 6: Informações da organização (se disponível)
    try {
      log(`\n🏢 Teste 6: Informações da organização...`, 'blue');
      const orgInfo = await githubAPI.getOrganization(org);
      log(`✅ Organização encontrada:`, 'green');
      log(`   Nome: ${orgInfo.name || orgInfo.login}`, 'cyan');
      log(`   Login: ${orgInfo.login}`, 'cyan');
      log(`   URL: ${orgInfo.html_url}`, 'magenta');
      log(`   Repositórios públicos: ${orgInfo.public_repos}`, 'yellow');
      if (orgInfo.description) {
        log(`   Descrição: ${orgInfo.description}`, 'yellow');
      }
    } catch (err) {
      // Silenciosamente ignorar se não tiver acesso
      if (err.response?.status !== 404 && err.response?.status !== 403) {
        throw err;
      }
    }

    return true;
  } catch (error) {
    log(`\n❌ Erro ao conectar com GitHub API:`, 'red');
    log(`   ${error.message}`, 'red');

    if (error.response) {
      log(`\n   Status HTTP: ${error.response.status}`, 'yellow');
      log(`   Mensagem: ${error.response.data?.message || error.response.statusText}`, 'yellow');

      if (error.response.status === 401) {
        log(`\n   ⚠️  Token inválido ou expirado`, 'yellow');
        log('   Gere um novo token em: https://github.com/settings/tokens', 'cyan');
      } else if (error.response.status === 403) {
        log(`\n   ⚠️  Permissões insuficientes`, 'yellow');
        log('   Verifique se o token tem as permissões necessárias:', 'cyan');
        log('   - repo (acesso a repositórios)', 'cyan');
        log('   - read:org (ler organização)', 'cyan');
      } else if (error.response.status === 404) {
        log(`\n   ⚠️  Recurso não encontrado`, 'yellow');
        log('   Verifique se o nome da organização está correto', 'cyan');
      }
    }

    return false;
  }
}

async function runTest() {
  const result = await testGitHubConnection();

  log('\n═══════════════════════════════════════════════════', 'bright');
  log('  📊 RESULTADO DO TESTE', 'bright');
  log('═══════════════════════════════════════════════════', 'bright');

  log(`\nGitHub API: ${result ? '✅ Conectado e Funcional' : '❌ Falhou'}`, result ? 'green' : 'red');

  log('\n═══════════════════════════════════════════════════\n', 'bright');

  process.exit(result ? 0 : 1);
}

// Executar teste
runTest().catch(error => {
  log(`\n❌ Erro fatal: ${error.message}`, 'red');
  process.exit(1);
});
