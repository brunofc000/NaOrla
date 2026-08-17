
-- 1) pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Tighten profiles column exposure to anon
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, display_name, kiosk_name) ON public.profiles TO anon;

-- Replace overly broad public-read policy with a column-agnostic one (column grants now enforce safety)
DROP POLICY IF EXISTS "Profiles public read kiosk info" ON public.profiles;
CREATE POLICY "Profiles public read minimal" ON public.profiles
  FOR SELECT TO anon USING (true);

-- 3) Drop realtime publication for sensitive tables
ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
ALTER PUBLICATION supabase_realtime DROP TABLE public.order_items;

-- 4) Hash existing employee passwords (clear plaintext; owners must reset)
UPDATE public.profiles SET employee_password = NULL WHERE employee_password IS NOT NULL;

-- Trigger to hash any plaintext on write
CREATE OR REPLACE FUNCTION public.hash_employee_password()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.employee_password IS NOT NULL
     AND NEW.employee_password <> ''
     AND (TG_OP = 'INSERT' OR NEW.employee_password IS DISTINCT FROM OLD.employee_password)
     AND NEW.employee_password NOT LIKE '$2%$%' THEN
    NEW.employee_password := crypt(NEW.employee_password, gen_salt('bf'));
  END IF;
  IF NEW.employee_password = '' THEN NEW.employee_password := NULL; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_employee_password ON public.profiles;
CREATE TRIGGER trg_hash_employee_password
  BEFORE INSERT OR UPDATE OF employee_password ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.hash_employee_password();

-- 5) Employee session tokens
CREATE TABLE IF NOT EXISTS public.employee_sessions (
  token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kiosk_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '12 hours')
);
GRANT ALL ON public.employee_sessions TO service_role;
ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;
-- No policies: only SECURITY DEFINER functions touch this table.

-- 6) Replace verification helper to use token + bcrypt
CREATE OR REPLACE FUNCTION public._verify_employee_token(_token uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  SELECT kiosk_user_id INTO _owner
    FROM public.employee_sessions
    WHERE token = _token AND expires_at > now();
  IF _owner IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada';
  END IF;
  RETURN _owner;
END;
$$;
REVOKE ALL ON FUNCTION public._verify_employee_token(uuid) FROM PUBLIC, anon, authenticated;

-- Old helper: lock down
REVOKE ALL ON FUNCTION public._verify_employee(text, text) FROM PUBLIC, anon, authenticated;

-- 7) New employee_login: returns session token, uses bcrypt compare
CREATE OR REPLACE FUNCTION public.employee_login(_kiosk_code text, _password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _row RECORD;
  _token uuid;
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
  IF _row.employee_password <> crypt(_password, _row.employee_password) THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;
  INSERT INTO public.employee_sessions (kiosk_user_id) VALUES (_row.id) RETURNING token INTO _token;
  -- opportunistic cleanup
  DELETE FROM public.employee_sessions WHERE expires_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'token', _token,
    'kiosk_user_id', _row.id,
    'kiosk_name', _row.kiosk_name,
    'kiosk_code', _row.kiosk_code
  );
END;
$$;
REVOKE ALL ON FUNCTION public.employee_login(text, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_login(text, text) TO anon;

-- 8) Token-based RPCs replacing the password-based ones
CREATE OR REPLACE FUNCTION public.employee_logout(_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.employee_sessions WHERE token = _token;
$$;
REVOKE ALL ON FUNCTION public.employee_logout(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_logout(uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_get_menu_v2(_token uuid)
RETURNS SETOF public.menu_items LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee_token(_token);
  RETURN QUERY SELECT * FROM public.menu_items WHERE user_id = _owner ORDER BY category, name;
END;
$$;
REVOKE ALL ON FUNCTION public.employee_get_menu_v2(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_get_menu_v2(uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_get_kitchen_orders_v2(_token uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
          'price', oi.price, 'notes', oi.notes
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
REVOKE ALL ON FUNCTION public.employee_get_kitchen_orders_v2(uuid) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_get_kitchen_orders_v2(uuid) TO anon;

CREATE OR REPLACE FUNCTION public.employee_update_order_status_v2(_token uuid, _order_id uuid, _status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _owner uuid;
BEGIN
  _owner := public._verify_employee_token(_token);
  IF _status NOT IN ('novo','preparando','pronto','entregue','cancelado') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  UPDATE public.orders SET status = _status WHERE id = _order_id AND user_id = _owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.employee_update_order_status_v2(uuid, uuid, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.employee_update_order_status_v2(uuid, uuid, text) TO anon;

-- 9) Drop legacy password-based RPCs
DROP FUNCTION IF EXISTS public.employee_get_menu(text, text);
DROP FUNCTION IF EXISTS public.employee_get_kitchen_orders(text, text);
DROP FUNCTION IF EXISTS public.employee_update_order_status(text, text, uuid, text);

-- 10) place_order stays callable by anon (public ordering); make explicit
REVOKE ALL ON FUNCTION public.place_order(uuid, text, text, text, text, text, jsonb, text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(uuid, text, text, text, text, text, jsonb, text) TO anon;
