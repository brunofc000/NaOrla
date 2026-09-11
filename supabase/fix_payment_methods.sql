-- =====================================================
-- Atualizar função close_order para aceitar cartao_debito e cartao_credito
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
  
  -- Validar método de pagamento
  IF _payment_method NOT IN ('dinheiro','pix','cartao_debito','cartao_credito','outro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
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
    -- Encontrar o produto correspondente no estoque pelo nome
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