-- RPC public: customer calls waiter
-- Creates an alert visible to the kiosk owner
CREATE OR REPLACE FUNCTION public.call_waiter(
  _kiosk_user_id UUID,
  _table_number TEXT,
  _customer_name TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _alert_id UUID;
BEGIN
  IF _table_number IS NULL OR length(trim(_table_number)) = 0 THEN
    RAISE EXCEPTION 'Número da mesa obrigatório';
  END IF;

  INSERT INTO public.alerts (user_id, title, type, priority)
  VALUES (
    _kiosk_user_id,
    'Mesa ' || _table_number || CASE WHEN _customer_name IS NOT NULL AND length(trim(_customer_name)) > 0 
      THEN ' — ' || trim(_customer_name) || ' precisa de atendimento'
      ELSE ' precisa de atendimento'
    END,
    'waiter_call',
    'high'
  )
  RETURNING id INTO _alert_id;

  RETURN _alert_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.call_waiter(UUID, TEXT, TEXT) TO anon, authenticated;

-- RPC public: customer gets their order status
CREATE OR REPLACE FUNCTION public.get_order_status(
  _kiosk_user_id UUID,
  _table_number TEXT,
  _customer_name TEXT
) RETURNS TABLE (
  order_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id as order_id,
    o.status,
    o.created_at,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'name', oi.name,
          'quantity', oi.quantity,
          'status', o.status
        )
      ) FILTER (WHERE oi.id IS NOT NULL),
      '[]'::jsonb
    ) as items
  FROM public.orders o
  LEFT JOIN public.order_items oi ON oi.order_id = o.id
  WHERE o.user_id = _kiosk_user_id
    AND o.table_number = _table_number
    AND o.customer_name ILIKE _customer_name
    AND o.status IN ('novo', 'preparando', 'pronto')
    AND o.created_at > (now() - interval '12 hours')
  GROUP BY o.id, o.status, o.created_at
  ORDER BY o.created_at DESC
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_status(UUID, TEXT, TEXT) TO anon, authenticated;