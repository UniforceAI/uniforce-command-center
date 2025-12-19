import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ORG = process.env.GITHUB_ORG || 'uniforce'; // Nome da organização
const GITHUB_BASE_URL = 'https://api.github.com';

if (!GITHUB_TOKEN) {
  console.warn('⚠️ GITHUB_TOKEN não encontrada no .env. Adicione para usar a API do GitHub.');
}

// Cliente HTTP com autenticação
const githubClient = axios.create({
  baseURL: GITHUB_BASE_URL,
  headers: {
    'Authorization': `Bearer ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }
});

export const githubAPI = {
  // ============================================
  // REPOSITÓRIOS
  // ============================================

  // Listar todos os repositórios da organização
  async getOrgRepos(org = GITHUB_ORG) {
    try {
      const response = await githubClient.get(`/orgs/${org}/repos`, {
        params: {
          type: 'all', // all, public, private, forks, sources, member
          sort: 'updated', // created, updated, pushed, full_name
          per_page: 100
        }
      });
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Obter detalhes de um repositório específico
  async getRepo(owner, repo) {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}`);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Criar um novo repositório na organização
  async createOrgRepo(org = GITHUB_ORG, repoData) {
    try {
      const response = await githubClient.post(`/orgs/${org}/repos`, repoData);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================
  // BRANCHES
  // ============================================

  // Listar branches de um repositório
  async getBranches(owner, repo) {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/branches`);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Obter branch específica
  async getBranch(owner, repo, branch) {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/branches/${branch}`);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================
  // COMMITS
  // ============================================

  // Listar commits de um repositório
  async getCommits(owner, repo, options = {}) {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/commits`, {
        params: {
          sha: options.branch || 'main', // branch name
          per_page: options.limit || 30,
          page: options.page || 1
        }
      });
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Obter commit específico
  async getCommit(owner, repo, sha) {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/commits/${sha}`);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================
  // CONTEÚDO DE ARQUIVOS
  // ============================================

  // Obter conteúdo de um arquivo
  async getFileContent(owner, repo, path, branch = 'main') {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/contents/${path}`, {
        params: { ref: branch }
      });

      // Decodificar conteúdo base64
      if (response.data.encoding === 'base64') {
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return {
          ...response.data,
          decodedContent: content
        };
      }

      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Listar conteúdo de um diretório
  async getDirectoryContent(owner, repo, path = '', branch = 'main') {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/contents/${path}`, {
        params: { ref: branch }
      });
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================
  // PULL REQUESTS
  // ============================================

  // Listar Pull Requests
  async getPullRequests(owner, repo, state = 'open') {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/pulls`, {
        params: {
          state, // open, closed, all
          per_page: 100
        }
      });
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Obter Pull Request específico
  async getPullRequest(owner, repo, prNumber) {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/pulls/${prNumber}`);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Criar Pull Request
  async createPullRequest(owner, repo, prData) {
    try {
      const response = await githubClient.post(`/repos/${owner}/${repo}/pulls`, prData);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================
  // ISSUES
  // ============================================

  // Listar Issues
  async getIssues(owner, repo, state = 'open') {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/issues`, {
        params: {
          state, // open, closed, all
          per_page: 100
        }
      });
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Obter Issue específica
  async getIssue(owner, repo, issueNumber) {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/issues/${issueNumber}`);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Criar Issue
  async createIssue(owner, repo, issueData) {
    try {
      const response = await githubClient.post(`/repos/${owner}/${repo}/issues`, issueData);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================
  // ORGANIZAÇÕES
  // ============================================

  // Obter informações da organização
  async getOrganization(org = GITHUB_ORG) {
    try {
      const response = await githubClient.get(`/orgs/${org}`);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Listar membros da organização
  async getOrgMembers(org = GITHUB_ORG) {
    try {
      const response = await githubClient.get(`/orgs/${org}/members`, {
        params: { per_page: 100 }
      });
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================
  // USUÁRIO AUTENTICADO
  // ============================================

  // Obter informações do usuário autenticado
  async getAuthenticatedUser() {
    try {
      const response = await githubClient.get('/user');
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Listar repositórios do usuário autenticado
  async getUserRepos() {
    try {
      const response = await githubClient.get('/user/repos', {
        params: {
          per_page: 100,
          sort: 'updated'
        }
      });
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================
  // ACTIONS (CI/CD)
  // ============================================

  // Listar workflow runs
  async getWorkflowRuns(owner, repo, workflowId = null) {
    try {
      const endpoint = workflowId
        ? `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs`
        : `/repos/${owner}/${repo}/actions/runs`;

      const response = await githubClient.get(endpoint, {
        params: { per_page: 30 }
      });
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================
  // RELEASES
  // ============================================

  // Listar releases
  async getReleases(owner, repo) {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/releases`, {
        params: { per_page: 30 }
      });
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Obter última release
  async getLatestRelease(owner, repo) {
    try {
      const response = await githubClient.get(`/repos/${owner}/${repo}/releases/latest`);
      return response.data;
    } catch (error) {
      console.error('GitHub API error:', error.response?.data || error.message);
      throw error;
    }
  }
};

export default githubAPI;
