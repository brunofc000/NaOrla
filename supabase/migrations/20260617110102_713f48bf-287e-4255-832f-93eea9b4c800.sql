CREATE OR REPLACE FUNCTION public.employee_place_order_v2(
  _token uuid,
  _table_number text,
  _customer_name text,
  _items jsonb,
  _notes text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _order_id uuid;
  _total numeric(10,2) := 0;
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

  INSERT INTO public.orders (user_id, table_number, customer_name, notes)
  VALUES (_owner, _table_number, COALESCE(NULLIF(trim(_customer_name),''), 'Mesa ' || _table_number), _notes)
  RETURNING id INTO _order_id;

  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    SELECT price, name INTO _price, _name FROM public.menu_items
      WHERE id = (_it->>'menu_item_id')::uuid AND user_id = _owner AND is_available = true;
    IF _price IS NULL THEN
      RAISE EXCEPTION 'Item indisponível';
    END IF;
    INSERT INTO public.order_items (order_id, menu_item_id, name, price, quantity, notes)
    VALUES (_order_id, (_it->>'menu_item_id')::uuid, _name, _price, (_it->>'quantity')::int, _it->>'notes');
    _total := _total + _price * (_it->>'quantity')::int;
  END LOOP;

  UPDATE public.orders SET total = _total WHERE id = _order_id;
  RETURN _order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.employee_place_order_v2(uuid, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.employee_place_order_v2(uuid, text, text, jsonb, text) TO anon, authenticated;