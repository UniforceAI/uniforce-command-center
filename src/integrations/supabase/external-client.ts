// Cliente para conexão com Supabase externo (backend oficial Uniforce)
// Este é o auth provider principal e a fonte de dados de negócio
import { createClient } from '@supabase/supabase-js';

// Credenciais do Supabase externo
const EXTERNAL_SUPABASE_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

// Cliente do Supabase externo — auth principal + dados de negócio
// storageKey diferente para evitar conflito com o cliente Lovable Cloud
export const externalSupabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_ANON_KEY,
  {
    auth: {
      storageKey: "uniforce-auth",
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
