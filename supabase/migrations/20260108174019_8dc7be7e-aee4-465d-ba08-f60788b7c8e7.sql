-- Tabela para log de ações (cobrança, contato, etc)
CREATE TABLE public.actions_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id INTEGER NOT NULL,
  action_type TEXT NOT NULL, -- 'call', 'whatsapp', 'pix_sent', 'payment_promise', 'task_created', 'manual_note'
  channel TEXT, -- 'phone', 'whatsapp', 'email', 'sms', 'system'
  status TEXT DEFAULT 'completed', -- 'completed', 'pending', 'failed'
  notes TEXT,
  metadata JSONB, -- dados adicionais como valor, vencimento, etc
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index para buscar por cliente
CREATE INDEX idx_actions_log_client ON public.actions_log(client_id);

-- Index para buscar por tipo de ação
CREATE INDEX idx_actions_log_type ON public.actions_log(action_type);

-- Index para buscar por data
CREATE INDEX idx_actions_log_created ON public.actions_log(created_at DESC);

-- Enable RLS
ALTER TABLE public.actions_log ENABLE ROW LEVEL SECURITY;

-- Policy: usuários autenticados podem ver todos os logs
CREATE POLICY "Authenticated users can view action logs"
ON public.actions_log
FOR SELECT
TO authenticated
USING (true);

-- Policy: usuários autenticados podem inserir logs
CREATE POLICY "Authenticated users can insert action logs"
ON public.actions_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: usuários autenticados podem atualizar logs
CREATE POLICY "Authenticated users can update action logs"
ON public.actions_log
FOR UPDATE
TO authenticated
USING (true);

-- Comentários para documentação
COMMENT ON TABLE public.actions_log IS 'Log de ações tomadas em clientes (cobrança, contato, etc)';
COMMENT ON COLUMN public.actions_log.action_type IS 'Tipo: call, whatsapp, pix_sent, payment_promise, task_created, manual_note';
COMMENT ON COLUMN public.actions_log.channel IS 'Canal: phone, whatsapp, email, sms, system';