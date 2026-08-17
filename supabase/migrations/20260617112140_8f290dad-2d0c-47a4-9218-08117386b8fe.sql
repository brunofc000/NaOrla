
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS delivered BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.employee_set_item_delivered_v2(_token uuid, _item_id uuid, _delivered boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee_token(_token);
  UPDATE public.order_items oi
     SET delivered = _delivered
   FROM public.orders o
   WHERE oi.id = _item_id
     AND oi.order_id = o.id
     AND o.user_id = _owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
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
          'price', oi.price, 'notes', oi.notes, 'delivered', oi.delivered
        ))
        FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb) AS order_items
    FROM public.orders o
    WHERE o.user_id = _owner
      AND o.status IN ('novo','preparando','pronto')
  ) o;
  RETURN _result;
END;
$$;
