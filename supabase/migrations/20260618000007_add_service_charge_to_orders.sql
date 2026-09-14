-- Adicionar coluna service_charge (10% do garçom) na tabela orders
ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS service_charge NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Atualizar employee_close_order_v2 para aceitar taxa de serviço
CREATE OR REPLACE FUNCTION public.employee_close_order_v2(
  _token uuid, 
  _order_id uuid, 
  _payment_method text,
  _service_charge numeric DEFAULT 0
)
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
  _final_total numeric(10,2);
BEGIN
  -- Verify employee and get info
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

  -- Calcular total final com taxa de serviço
  _final_total := _total + COALESCE(_service_charge, 0);

  UPDATE public.orders
     SET status = 'entregue',
         payment_method = _payment_method,
         service_charge = COALESCE(_service_charge, 0),
         closed_at = now(),
         closed_by = COALESCE(_employee_name, 'Funcionário')
   WHERE id = _order_id AND user_id = _owner;

  INSERT INTO public.transactions (user_id, type, amount, description, category, payment_method)
  VALUES (
    _owner, 'income', _final_total, 
    'Mesa ' || _table || ' — ' || _payment_method ||
      CASE WHEN _service_charge > 0 THEN ' (inclui 10%: ' || _service_charge || ')' ELSE '' END,
    'venda', _payment_method
  );
END;
$$;

-- Atualizar close_order (dono) para aceitar taxa de serviço
CREATE OR REPLACE FUNCTION public.close_order(
  _order_id uuid, 
  _payment_method text,
  _service_charge numeric DEFAULT 0
)
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
  _final_total numeric(10,2);
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
  
  _owner_id := auth.uid();
  IF _owner_id IS NULL OR _owner_id != _order.user_id THEN
    RAISE EXCEPTION 'Apenas o dono pode fechar pedidos';
  END IF;
  
  SELECT COALESCE(display_name, kiosk_name, 'Dono') INTO _owner_name
    FROM public.profiles WHERE id = _owner_id;
  
  -- Calcular total final com taxa de serviço
  _final_total := _order.total + COALESCE(_service_charge, 0);

  UPDATE public.orders 
  SET status = 'entregue', 
      payment_method = _payment_method,
      service_charge = COALESCE(_service_charge, 0),
      closed_at = now(),
      closed_by = _owner_name
  WHERE id = _order_id;
  
  INSERT INTO public.transactions (user_id, type, amount, description, category, payment_method)
  VALUES (_order.user_id, 'income', _final_total, 
          'Mesa ' || _order.table_number || ' - Pedido #' || substring(_order_id::text from 1 for 8) ||
            CASE WHEN _service_charge > 0 THEN ' (inclui 10%: ' || _service_charge || ')' ELSE '' END,
          'venda', _payment_method);
  
  FOR _item IN 
    SELECT oi.name, oi.quantity, mi.id as menu_item_id
    FROM public.order_items oi
    LEFT JOIN public.menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = _order_id
  LOOP
    SELECT * INTO _product 
    FROM public.products 
    WHERE user_id = _order.user_id 
      AND lower(name) = lower(_item.name) 
      AND is_active = true
    LIMIT 1;
    
    IF _product.id IS NOT NULL THEN
      _new_quantity := _product.quantity - _item.quantity;
      
      UPDATE public.products 
      SET quantity = _new_quantity 
      WHERE id = _product.id;
      
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

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.employee_close_order_v2(uuid, uuid, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_order(uuid, text, numeric) TO authenticated;