/**
 * API Clients - Centralized access to external services
 *
 * Usage:
 * import { supabase1API, supabase2API, postmanAPI, githubAPI } from './lib/api'
 *
 * Or:
 * import api from './lib/api'
 * api.supabase1.query('table_name')
 * api.github.getOrgRepos()
 */

import supabaseClients, { supabase1API, supabase2API, supabase1, supabase2 } from './supabase-client.js';
import postmanAPI from './postman-client.js';
import githubAPI from './github-client.js';

export {
  // Supabase Project 1 (bqljfrferpzkzwoxlnya)
  supabase1,
  supabase1API,

  // Supabase Project 2 (yqdqmudsnjhixtxldqwi)
  supabase2,
  supabase2API,

  // Postman API
  postmanAPI,

  // GitHub API
  githubAPI
};

// Default export com todos os clients
export default {
  supabase: {
    project1: {
      client: supabase1,
      api: supabase1API
    },
    project2: {
      client: supabase2,
      api: supabase2API
    }
  },
  postman: postmanAPI,
  github: githubAPI
};
