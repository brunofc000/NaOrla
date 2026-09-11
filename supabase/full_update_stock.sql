-- =====================================================
-- PASSO 1: Adicionar coluna initial_quantity na tabela products
-- =====================================================
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS initial_quantity INTEGER;

-- Atualizar produtos existentes (definir initial_quantity = quantity)
UPDATE public.products SET initial_quantity = quantity WHERE initial_quantity IS NULL;

-- =====================================================
-- PASSO 2: Criar tabela de histórico de estoque
-- =====================================================
CREATE TABLE IF NOT EXISTS public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL,
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON public.stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_user ON public.stock_history(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created ON public.stock_history(created_at);

-- Permissões
GRANT SELECT, INSERT ON public.stock_history TO authenticated;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
DROP POLICY IF EXISTS "Users can view own stock history" ON public.stock_history;
CREATE POLICY "Users can view own stock history" ON public.stock_history
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own stock history" ON public.stock_history;
CREATE POLICY "Users can insert own stock history" ON public.stock_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- PASSO 3: Atualizar função close_order para reduzir estoque
-- =====================================================
CREATE OR REPLACE FUNCTION public.close_order(_order_id uuid, _payment_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order RECORD;
  _owner_id uuid;
  _item RECORD;
  _product RECORD;
  _new_quantity integer;
  _owner_name text;
BEGIN
  -- Buscar o pedido
  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  
  -- Verificar ownership
  _owner_id := auth.uid();
  IF _owner_id IS NULL OR _owner_id != _order.user_id THEN
    RAISE EXCEPTION 'Apenas o dono pode fechar pedidos';
  END IF;
  
  -- Buscar nome do dono
  SELECT COALESCE(display_name, kiosk_name, 'Dono') INTO _owner_name
    FROM public.profiles WHERE id = _owner_id;
  
  -- Atualizar status do pedido
  UPDATE public.orders 
  SET status = 'entregue', 
      payment_method = _payment_method,
      closed_at = now(),
      closed_by = _owner_name
  WHERE id = _order_id;
  
  -- Criar transação de entrada
  INSERT INTO public.transactions (user_id, type, amount, description, category, payment_method)
  VALUES (_order.user_id, 'income', _order.total, 
          'Mesa ' || _order.table_number || ' - Pedido #' || substring(_order_id::text from 1 for 8),
          'venda', _payment_method);
  
  -- Reduzir estoque para cada item do pedido
  FOR _item IN 
    SELECT oi.name, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
  LOOP
    -- Encontrar o produto correspondente no estoque pelo nome (case insensitive)
    SELECT * INTO _product 
    FROM public.products 
    WHERE user_id = _order.user_id 
      AND lower(trim(name)) = lower(trim(_item.name)) 
      AND is_active = true
    LIMIT 1;
    
    IF _product.id IS NOT NULL THEN
      _new_quantity := _product.quantity - _item.quantity;
      
      -- Atualizar quantidade do produto
      UPDATE public.products 
      SET quantity = _new_quantity 
      WHERE id = _product.id;
      
      -- Registrar no histórico
      INSERT INTO public.stock_history (
        product_id, user_id, quantity_change, 
        previous_quantity, new_quantity, 
        reason, order_id, notes
      ) VALUES (
        _product.id, _order.user_id, -_item.quantity,
        _product.quantity, _new_quantity,
        'sale', _order_id, 
        'Venda - Mesa ' || _order.table_number
      );
    END IF;
  END LOOP;
END;
$$;

-- Permissão
GRANT EXECUTE ON FUNCTION public.close_order(uuid, text) TO authenticated;