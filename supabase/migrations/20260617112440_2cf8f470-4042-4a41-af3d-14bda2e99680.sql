
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.employee_close_order_v2(_token uuid, _order_id uuid, _payment_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _owner uuid; _total numeric(10,2); _table text;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF _payment_method NOT IN ('dinheiro','pix','cartao','outro') THEN
    RAISE EXCEPTION 'Forma de pagamento inválida';
  END IF;
  SELECT total, table_number INTO _total, _table
    FROM public.orders WHERE id = _order_id AND user_id = _owner;
  IF _total IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;

  UPDATE public.orders
     SET status = 'entregue',
         payment_method = _payment_method,
         closed_at = now()
   WHERE id = _order_id AND user_id = _owner;

  INSERT INTO public.transactions (user_id, type, amount, description, category)
  VALUES (_owner, 'income', _total, 'Mesa ' || _table || ' — ' || _payment_method, 'venda');
END;
$$;
