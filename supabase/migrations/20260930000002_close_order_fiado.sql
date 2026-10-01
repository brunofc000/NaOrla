-- ============================================================
-- Fechar conta de mesa no FIADO para cliente fiel (somente dono)
-- A venda fica PENDENTE até o dono marcar como paga em /clientes
-- ============================================================
CREATE OR REPLACE FUNCTION public.close_order_fiado(
  _order_id uuid,
  _customer_id uuid,
  _service_charge numeric DEFAULT 0,
  _notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  _order RECORD;
  _owner_id uuid;
  _customer_name text;
  _owner_name text;
  _item RECORD;
  _product RECORD;
  _new_quantity integer;
  _final_total numeric(10,2);
  _tx_id uuid;
BEGIN
  SELECT * INTO _order FROM public.orders WHERE id = _order_id;
  IF _order.id IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  _owner_id := auth.uid();
  IF _owner_id IS NULL OR _owner_id != _order.user_id THEN
    RAISE EXCEPTION 'Apenas o dono pode fechar pedidos';
  END IF;

  IF _order.status = 'entregue' THEN
    RAISE EXCEPTION 'Esta mesa já foi fechada';
  END IF;

  -- Cliente fiel é obrigatório no fiado
  SELECT name INTO _customer_name FROM public.customers
   WHERE id = _customer_id AND user_id = _owner_id;
  IF _customer_name IS NULL THEN
    RAISE EXCEPTION 'Cliente fiel não encontrado';
  END IF;

  SELECT COALESCE(display_name, kiosk_name, 'Dono') INTO _owner_name
    FROM public.profiles WHERE id = _owner_id;

  _final_total := _order.total + COALESCE(_service_charge, 0);

  UPDATE public.orders
  SET status = 'entregue',
      payment_method = 'fiado',
      service_charge = COALESCE(_service_charge, 0),
      closed_at = now(),
      closed_by = _owner_name
  WHERE id = _order_id;

  -- Transação fiada: fica pendente (fiado_paid_at NULL) até o dono marcar como paga
  INSERT INTO public.transactions
    (user_id, type, amount, description, category, payment_method, customer_id, is_fiado)
  VALUES
    (_owner_id, 'income', _final_total,
     'Mesa ' || _order.table_number || ' - Pedido #' || substring(_order_id::text from 1 for 8) ||
       ' — fiado para ' || _customer_name ||
       CASE WHEN _service_charge > 0 THEN ' (inclui 10%: ' || _service_charge || ')' ELSE '' END ||
       COALESCE(' — ' || NULLIF(trim(_notes), ''), ''),
     'venda', 'fiado', _customer_id, true)
  RETURNING id INTO _tx_id;

  -- Itens consumidos (controle do fiado) + baixa de estoque
  FOR _item IN
    SELECT oi.name, oi.quantity, oi.price
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
  LOOP
    SELECT * INTO _product
    FROM public.products
    WHERE user_id = _owner_id
      AND lower(name) = lower(_item.name)
      AND is_active = true
    LIMIT 1;

    INSERT INTO public.sale_items
      (transaction_id, user_id, product_id, product_name, quantity, unit_price, total_price)
    VALUES
      (_tx_id, _owner_id, _product.id, _item.name, _item.quantity, _item.price, _item.price * _item.quantity);

    IF _product.id IS NOT NULL THEN
      _new_quantity := _product.quantity - _item.quantity;
      UPDATE public.products SET quantity = _new_quantity WHERE id = _product.id;

      INSERT INTO public.stock_history
        (product_id, user_id, quantity_change, previous_quantity, new_quantity, reason, order_id, notes)
      VALUES
        (_product.id, _owner_id, -_item.quantity, _product.quantity, _new_quantity, 'sale', _order_id,
         'Fiado — Mesa ' || _order.table_number);
    END IF;
  END LOOP;

  RETURN _tx_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.close_order_fiado(uuid, uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_order_fiado(uuid, uuid, numeric, text) TO authenticated;