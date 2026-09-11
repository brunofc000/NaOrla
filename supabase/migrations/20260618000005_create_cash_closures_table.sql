-- Tabela de fechamentos de caixa
CREATE TABLE IF NOT EXISTS public.cash_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_income NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_expense NUMERIC(10,2) NOT NULL DEFAULT 0,
  profit NUMERIC(10,2) NOT NULL DEFAULT 0,
  sales_count INTEGER NOT NULL DEFAULT 0,
  ticket_avg NUMERIC(10,2) NOT NULL DEFAULT 0,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cash_closures_user ON public.cash_closures(user_id);
CREATE INDEX IF NOT EXISTS idx_cash_closures_date ON public.cash_closures(closed_at);

-- Permissões
GRANT SELECT, INSERT ON public.cash_closures TO authenticated;
ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view own cash closures" ON public.cash_closures
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cash closures" ON public.cash_closures
  FOR INSERT WITH CHECK (auth.uid() = user_id);