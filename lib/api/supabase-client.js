import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Projeto 1: bqljfrferpzkzwoxlnya (Service Role Key)
const SUPABASE_URL_1 = 'https://bqljfrferpzkzwoxlnya.supabase.co';
const SUPABASE_KEY_1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbGpmcmZlcnB6a3p3b3hsbnlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg5Nzc1MywiZXhwIjoyMDc0NDczNzUzfQ.SOHOZAPajPFR_opFN9ossLCZZhCOnHCgSTQOLemHz3A';

// Projeto 2: yqdqmudsnjhixtxldqwi (do .env)
const SUPABASE_URL_2 = process.env.SUPABASE_URL;
const SUPABASE_KEY_2 = process.env.SUPABASE_KEY;

// Criar clientes para ambos os projetos
export const supabase1 = createClient(SUPABASE_URL_1, SUPABASE_KEY_1);
export const supabase2 = createClient(SUPABASE_URL_2, SUPABASE_KEY_2);

// Funções auxiliares para projeto 1
export const supabase1API = {
  // Query genérica
  async query(table, options = {}) {
    try {
      let query = supabase1.from(table).select(options.select || '*');

      if (options.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (options.limit) query = query.limit(options.limit);
      if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending ?? true });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Supabase 1 query error:', error);
      throw error;
    }
  },

  // Insert
  async insert(table, data) {
    try {
      const { data: result, error } = await supabase1.from(table).insert(data).select();
      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Supabase 1 insert error:', error);
      throw error;
    }
  },

  // Update
  async update(table, filter, data) {
    try {
      let query = supabase1.from(table).update(data);

      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: result, error } = await query.select();
      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Supabase 1 update error:', error);
      throw error;
    }
  },

  // Delete
  async delete(table, filter) {
    try {
      let query = supabase1.from(table).delete();

      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: result, error } = await query.select();
      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Supabase 1 delete error:', error);
      throw error;
    }
  }
};

// Funções auxiliares para projeto 2
export const supabase2API = {
  // Query genérica
  async query(table, options = {}) {
    try {
      let query = supabase2.from(table).select(options.select || '*');

      if (options.filter) {
        Object.entries(options.filter).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      if (options.limit) query = query.limit(options.limit);
      if (options.order) query = query.order(options.order.column, { ascending: options.order.ascending ?? true });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Supabase 2 query error:', error);
      throw error;
    }
  },

  // Insert
  async insert(table, data) {
    try {
      const { data: result, error } = await supabase2.from(table).insert(data).select();
      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Supabase 2 insert error:', error);
      throw error;
    }
  },

  // Update
  async update(table, filter, data) {
    try {
      let query = supabase2.from(table).update(data);

      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: result, error } = await query.select();
      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Supabase 2 update error:', error);
      throw error;
    }
  },

  // Delete
  async delete(table, filter) {
    try {
      let query = supabase2.from(table).delete();

      Object.entries(filter).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { data: result, error } = await query.select();
      if (error) throw error;
      return result;
    } catch (error) {
      console.error('Supabase 2 delete error:', error);
      throw error;
    }
  }
};

// Exportar clientes diretos também
export default {
  project1: supabase1,
  project2: supabase2,
  api1: supabase1API,
  api2: supabase2API
};
