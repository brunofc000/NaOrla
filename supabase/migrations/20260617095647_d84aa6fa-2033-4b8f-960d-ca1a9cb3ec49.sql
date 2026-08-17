
-- 1. Schema additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS kiosk_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS employee_password TEXT;

-- Backfill kiosk_code for existing rows
UPDATE public.profiles
SET kiosk_code = 'NA-' || upper(substring(replace(id::text,'-',''),1,6))
WHERE kiosk_code IS NULL;

-- Update trigger to auto-generate kiosk_code on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, kiosk_name, phone, kiosk_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'kiosk_name', 'Meu Quiosque'),
    NEW.raw_user_meta_data->>'phone',
    'NA-' || upper(substring(replace(NEW.id::text,'-',''),1,6))
  );
  RETURN NEW;
END; $$;

-- 2. Employee login: validate credentials, return kiosk info
CREATE OR REPLACE FUNCTION public.employee_login(_kiosk_code TEXT, _password TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row RECORD;
BEGIN
  SELECT id, kiosk_name, kiosk_code, employee_password
    INTO _row
    FROM public.profiles
    WHERE upper(kiosk_code) = upper(_kiosk_code);
  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Quiosque não encontrado';
  END IF;
  IF _row.employee_password IS NULL OR length(_row.employee_password) = 0 THEN
    RAISE EXCEPTION 'O dono ainda não definiu a senha de funcionário';
  END IF;
  IF _row.employee_password <> _password THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;
  RETURN jsonb_build_object(
    'kiosk_user_id', _row.id,
    'kiosk_name', _row.kiosk_name,
    'kiosk_code', _row.kiosk_code
  );
END; $$;

-- Internal helper: verify credentials, return owner user_id
CREATE OR REPLACE FUNCTION public._verify_employee(_kiosk_code TEXT, _password TEXT)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _id uuid;
  _pwd TEXT;
BEGIN
  SELECT id, employee_password INTO _id, _pwd
    FROM public.profiles
    WHERE upper(kiosk_code) = upper(_kiosk_code);
  IF _id IS NULL OR _pwd IS NULL OR _pwd <> _password THEN
    RAISE EXCEPTION 'Credenciais inválidas';
  END IF;
  RETURN _id;
END; $$;

-- 3. Employee: read menu
CREATE OR REPLACE FUNCTION public.employee_get_menu(_kiosk_code TEXT, _password TEXT)
RETURNS SETOF public.menu_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee(_kiosk_code, _password);
  RETURN QUERY SELECT * FROM public.menu_items WHERE user_id = _owner ORDER BY category, name;
END; $$;

-- 4. Employee: get kitchen orders with items
CREATE OR REPLACE FUNCTION public.employee_get_kitchen_orders(_kiosk_code TEXT, _password TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _result jsonb;
BEGIN
  _owner := public._verify_employee(_kiosk_code, _password);
  SELECT COALESCE(jsonb_agg(row_to_json(o) ORDER BY o.created_at), '[]'::jsonb)
    INTO _result
  FROM (
    SELECT
      o.id, o.table_number, o.customer_name, o.customer_phone,
      o.status, o.total, o.notes, o.created_at,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id, 'name', oi.name, 'quantity', oi.quantity,
          'price', oi.price, 'notes', oi.notes
        ))
        FROM public.order_items oi WHERE oi.order_id = o.id
      ), '[]'::jsonb) AS order_items
    FROM public.orders o
    WHERE o.user_id = _owner
      AND o.status IN ('novo','preparando','pronto')
  ) o;
  RETURN _result;
END; $$;

-- 5. Employee: update order status
CREATE OR REPLACE FUNCTION public.employee_update_order_status(
  _kiosk_code TEXT, _password TEXT, _order_id uuid, _status TEXT
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee(_kiosk_code, _password);
  IF _status NOT IN ('novo','preparando','pronto','entregue','cancelado') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  UPDATE public.orders SET status = _status
    WHERE id = _order_id AND user_id = _owner;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;
END; $$;

-- Grants: callable by anon (employees aren't authenticated)
GRANT EXECUTE ON FUNCTION public.employee_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_get_menu(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_get_kitchen_orders(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_update_order_status(TEXT, TEXT, uuid, TEXT) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._verify_employee(TEXT, TEXT) FROM anon, authenticated;
