import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const POSTMAN_API_KEY = process.env.POSTMAN_API_KEY;
const POSTMAN_BASE_URL = 'https://api.getpostman.com';

if (!POSTMAN_API_KEY) {
  console.warn('⚠️ POSTMAN_API_KEY não encontrada no .env. Adicione para usar a API do Postman.');
}

// Cliente HTTP com autenticação
const postmanClient = axios.create({
  baseURL: POSTMAN_BASE_URL,
  headers: {
    'X-Api-Key': POSTMAN_API_KEY,
    'Content-Type': 'application/json'
  }
});

export const postmanAPI = {
  // Listar todas as collections
  async getCollections() {
    try {
      const response = await postmanClient.get('/collections');
      return response.data.collections;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Obter detalhes de uma collection específica
  async getCollection(collectionId) {
    try {
      const response = await postmanClient.get(`/collections/${collectionId}`);
      return response.data.collection;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Criar uma nova collection
  async createCollection(collectionData) {
    try {
      const response = await postmanClient.post('/collections', {
        collection: collectionData
      });
      return response.data.collection;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Atualizar uma collection
  async updateCollection(collectionId, collectionData) {
    try {
      const response = await postmanClient.put(`/collections/${collectionId}`, {
        collection: collectionData
      });
      return response.data.collection;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Deletar uma collection
  async deleteCollection(collectionId) {
    try {
      const response = await postmanClient.delete(`/collections/${collectionId}`);
      return response.data;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Listar environments
  async getEnvironments() {
    try {
      const response = await postmanClient.get('/environments');
      return response.data.environments;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Obter detalhes de um environment
  async getEnvironment(environmentId) {
    try {
      const response = await postmanClient.get(`/environments/${environmentId}`);
      return response.data.environment;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Criar um novo environment
  async createEnvironment(environmentData) {
    try {
      const response = await postmanClient.post('/environments', {
        environment: environmentData
      });
      return response.data.environment;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Atualizar um environment
  async updateEnvironment(environmentId, environmentData) {
    try {
      const response = await postmanClient.put(`/environments/${environmentId}`, {
        environment: environmentData
      });
      return response.data.environment;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Deletar um environment
  async deleteEnvironment(environmentId) {
    try {
      const response = await postmanClient.delete(`/environments/${environmentId}`);
      return response.data;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Listar workspaces
  async getWorkspaces() {
    try {
      const response = await postmanClient.get('/workspaces');
      return response.data.workspaces;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Obter detalhes de um workspace
  async getWorkspace(workspaceId) {
    try {
      const response = await postmanClient.get(`/workspaces/${workspaceId}`);
      return response.data.workspace;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Executar uma request (via Newman)
  async runCollection(collectionId, environmentId = null) {
    try {
      const payload = {
        collection: collectionId
      };

      if (environmentId) {
        payload.environment = environmentId;
      }

      const response = await postmanClient.post('/collections/run', payload);
      return response.data;
    } catch (error) {
      console.error('Postman API error:', error.response?.data || error.message);
      throw error;
    }
  }
};

export default postmanAPI;
