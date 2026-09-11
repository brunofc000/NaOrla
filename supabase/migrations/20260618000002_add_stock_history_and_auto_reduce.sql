-- Tabela de histórico de estoque
CREATE TABLE IF NOT EXISTS public.stock_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantity_change INTEGER NOT NULL, -- positivo = entrada, negativo = saída
  previous_quantity INTEGER NOT NULL,
  new_quantity INTEGER NOT NULL,
  reason TEXT NOT NULL, -- 'manual_add', 'manual_remove', 'sale', 'adjustment'
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_stock_history_product ON public.stock_history(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_user ON public.stock_history(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_history_created ON public.stock_history(created_at);

-- Permissões
GRANT SELECT, INSERT ON public.stock_history TO authenticated;
ALTER TABLE public.stock_history ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view own stock history" ON public.stock_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stock history" ON public.stock_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Atualizar função close_order para reduzir estoque
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
BEGIN
  -- Get the order
  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  
  -- Verify ownership (the authenticated user must be the owner)
  _owner_id := auth.uid();
  IF _owner_id IS NULL OR _owner_id != _order.user_id THEN
    RAISE EXCEPTION 'Apenas o dono pode fechar pedidos';
  END IF;
  
  -- Update order status
  UPDATE public.orders 
  SET status = 'entregue', 
      payment_method = _payment_method,
      closed_at = now()
  WHERE id = _order_id;
  
  -- Create income transaction
  INSERT INTO public.transactions (user_id, type, amount, description, category, payment_method)
  VALUES (_order.user_id, 'income', _order.total, 
          'Mesa ' || _order.table_number || ' - Pedido #' || substring(_order_id::text from 1 for 8),
          'venda', _payment_method);
  
  -- Reduzir estoque para cada item do pedido
  FOR _item IN 
    SELECT oi.name, oi.quantity, mi.id as menu_item_id
    FROM public.order_items oi
    LEFT JOIN public.menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = _order_id
  LOOP
    -- Encontrar o produto correspondente no estoque pelo nome
    SELECT * INTO _product 
    FROM public.products 
    WHERE user_id = _order.user_id 
      AND lower(name) = lower(_item.name) 
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

-- Grant execute to authenticated users (owners)
GRANT EXECUTE ON FUNCTION public.close_order(uuid, text) TO authenticated;