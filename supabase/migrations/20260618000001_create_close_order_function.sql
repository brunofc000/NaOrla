-- Function for owner to close orders directly (without employee token)
CREATE OR REPLACE FUNCTION public.close_order(_order_id uuid, _payment_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _order RECORD;
  _owner_id uuid;
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
END;
$$;

-- Grant execute to authenticated users (owners)
GRANT EXECUTE ON FUNCTION public.close_order(uuid, text) TO authenticated;