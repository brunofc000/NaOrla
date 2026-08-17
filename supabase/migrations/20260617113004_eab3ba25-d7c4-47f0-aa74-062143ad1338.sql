
CREATE OR REPLACE FUNCTION public.employee_place_order_v2(_token uuid, _table_number text, _customer_name text, _items jsonb, _notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
  _order_id uuid;
  _total numeric(10,2) := 0;
  _added numeric(10,2) := 0;
  _it jsonb;
  _price numeric(10,2);
  _name text;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF _table_number IS NULL OR length(trim(_table_number)) = 0 THEN
    RAISE EXCEPTION 'Mesa obrigatória';
  END IF;
  IF jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Pedido vazio';
  END IF;

  -- Reusa pedido em aberto da mesma mesa, se houver
  SELECT id, total INTO _order_id, _total
    FROM public.orders
   WHERE user_id = _owner
     AND table_number = _table_number
     AND status IN ('novo','preparando','pronto')
   ORDER BY created_at DESC
   LIMIT 1;

  IF _order_id IS NULL THEN
    INSERT INTO public.orders (user_id, table_number, customer_name, notes)
    VALUES (_owner, _table_number, COALESCE(NULLIF(trim(_customer_name),''), 'Mesa ' || _table_number), _notes)
    RETURNING id INTO _order_id;
    _total := 0;
  ELSIF _notes IS NOT NULL AND length(trim(_notes)) > 0 THEN
    UPDATE public.orders
       SET notes = CASE WHEN notes IS NULL OR notes = '' THEN _notes ELSE notes || E'\n' || _notes END
     WHERE id = _order_id;
  END IF;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT price, name INTO _price, _name FROM public.menu_items
      WHERE id = (_it->>'menu_item_id')::uuid AND user_id = _owner AND is_available = true;
    IF _price IS NULL THEN
      RAISE EXCEPTION 'Item indisponível';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity, notes)
    VALUES (_order_id, (_it->>'menu_item_id')::uuid, _name, _price, (_it->>'quantity')::int, _it->>'notes');
    _added := _added + _price * (_it->>'quantity')::int;
  END LOOP;

  -- Volta a mesa para 'novo' se já estava pronta/preparando, para a cozinha ver os novos itens
  UPDATE public.orders SET total = _total + _added, status = 'novo' WHERE id = _order_id;
  RETURN _order_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_get_kitchen_orders_v2(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE _owner uuid; _result jsonb;
BEGIN
  _owner := public._verify_employee_token(_token);
  SELECT COALESCE(jsonb_agg(row_to_json(o) ORDER BY o.created_at), '[]'::jsonb)
    INTO _result
  FROM (
    SELECT
      o.id, o.table_number, o.customer_name, o.customer_phone,
      o.status, o.total, o.notes, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id, 'name', oi.name, 'quantity', oi.quantity,
          'price', oi.price, 'notes', oi.notes, 'delivered', oi.delivered,
          'created_at', oi.created_at
        ) ORDER BY oi.created_at)
        FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb) AS order_items
    FROM public.orders o
    WHERE o.user_id = _owner
      AND o.status IN ('novo','preparando','pronto')
  ) o;
  RETURN _result;
END;
$$;
