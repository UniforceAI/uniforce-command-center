// Cliente para conexão com Supabase externo multi-tenant
import { createClient } from '@supabase/supabase-js';

// Credenciais do Supabase externo
const EXTERNAL_SUPABASE_URL = "https://yqdqmudsnjhixtxldqwi.supabase.co";
const EXTERNAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxZHFtdWRzbmpoaXh0eGxkcXdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0MjEwMzEsImV4cCI6MjA3MTk5NzAzMX0.UsrIuEgtJVdhZ0b76VLOjT1zVn2-OWeORGFoy487MfY";

// ISP ID para filtro multi-tenant
export const ISP_ID = "agy-telecom";

// Cliente do Supabase externo para dados
export const externalSupabase = createClient(
  EXTERNAL_SUPABASE_URL,
  EXTERNAL_SUPABASE_ANON_KEY
);
