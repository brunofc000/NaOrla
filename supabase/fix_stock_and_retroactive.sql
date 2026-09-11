-- =====================================================
-- CORREÇÃO: Atualizar employee_close_order_v2 para reduzir estoque
-- (Essa é a função que o GARÇOM usa)
-- =====================================================
CREATE OR REPLACE FUNCTION public.employee_close_order_v2(_token uuid, _order_id uuid, _payment_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  _owner uuid; 
  _total numeric(10,2); 
  _table text;
  _employee_name text;
  _role text;
  _item RECORD;
  _product RECORD;
  _new_quantity integer;
BEGIN
  -- Verificar funcionário e buscar info
  SELECT es.kiosk_user_id, es.employee_name, es.role 
    INTO _owner, _employee_name, _role
    FROM public.employee_sessions es
    WHERE es.token = _token AND es.expires_at > now();
  
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida ou expirada';
  END IF;
  
  IF _payment_method NOT IN ('dinheiro','pix','cartao','outro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;
  
  SELECT total, table_number INTO _total, _table
    FROM public.orders WHERE id = _order_id AND user_id = _owner;
  IF _total IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  -- Atualizar status do pedido
  UPDATE public.orders
     SET status = 'entregue',
         payment_method = _payment_method,
         closed_at = now(),
         closed_by = COALESCE(_employee_name, 'Funcionário')
   WHERE id = _order_id AND user_id = _owner;

  -- Criar transação de entrada
  INSERT INTO public.transactions (user_id, type, amount, description, category, payment_method)
  VALUES (_owner, 'income', _total, 'Mesa ' || _table || ' — ' || _payment_method, 'venda', _payment_method);
  
  -- Reduzir estoque para cada item do pedido
  FOR _item IN 
    SELECT oi.name, oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
  LOOP
    -- Encontrar o produto correspondente no estoque pelo nome
    SELECT * INTO _product 
    FROM public.products 
    WHERE user_id = _owner 
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
        _product.id, _owner, -_item.quantity,
        _product.quantity, _new_quantity,
        'sale', _order_id, 
        'Venda - Mesa ' || _table || ' (Garçom: ' || COALESCE(_employee_name, 'N/A') || ')'
      );
    END IF;
  END LOOP;
END;
$$;

-- Permissão
GRANT EXECUTE ON FUNCTION public.employee_close_order_v2(uuid, uuid, text) TO anon, authenticated;

-- =====================================================
-- CORREÇÃO: Atualizar estoque das vendas já feitas
-- (Ajustar quantidade dos produtos que já foram vendidos)
-- =====================================================
DO $$
DECLARE
  _order RECORD;
  _item RECORD;
  _product RECORD;
  _total_sold integer;
BEGIN
  -- Para cada pedido entregue hoje
  FOR _order IN 
    SELECT id, user_id, table_number 
    FROM public.orders 
    WHERE status = 'entregue' 
      AND created_at >= CURRENT_DATE
  LOOP
    -- Para cada item do pedido
    FOR _item IN 
      SELECT oi.name, oi.quantity
      FROM public.order_items oi
      WHERE oi.order_id = _order.id
    LOOP
      -- Encontrar o produto no estoque
      SELECT * INTO _product 
      FROM public.products 
      WHERE user_id = _order.user_id 
        AND lower(trim(name)) = lower(trim(_item.name)) 
        AND is_active = true
      LIMIT 1;
      
      IF _product.id IS NOT NULL THEN
        -- Verificar se já existe registro no histórico para este pedido
        IF NOT EXISTS (
          SELECT 1 FROM public.stock_history 
          WHERE order_id = _order.id AND product_id = _product.id
        ) THEN
          -- Atualizar quantidade do produto
          UPDATE public.products 
          SET quantity = quantity - _item.quantity 
          WHERE id = _product.id;
          
          -- Registrar no histórico
          INSERT INTO public.stock_history (
            product_id, user_id, quantity_change, 
            previous_quantity, new_quantity, 
            reason, order_id, notes
          ) VALUES (
            _product.id, _order.user_id, -_item.quantity,
            _product.quantity, _product.quantity - _item.quantity,
            'sale', _order.id, 
            'Venda (ajuste retroativo) - Mesa ' || _order.table_number
          );
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;