-- Add employee_name to employee_sessions
ALTER TABLE public.employee_sessions ADD COLUMN IF NOT EXISTS employee_name TEXT;

-- Update employee_login to accept and store employee_name
CREATE OR REPLACE FUNCTION public.employee_login(_kiosk_code text, _password text, _role text DEFAULT 'garcom', _employee_name text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _row RECORD;
  _token uuid;
  _hash text;
BEGIN
  IF _role NOT IN ('garcom','cozinha') THEN
    RAISE EXCEPTION 'Cargo inválido';
  END IF;
  SELECT id, kiosk_name, kiosk_code, employee_password, kitchen_password
    INTO _row
    FROM public.profiles
    WHERE upper(kiosk_code) = upper(_kiosk_code);
  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Quiosque não encontrado';
  END IF;
  _hash := CASE WHEN _role = 'cozinha' THEN _row.kitchen_password ELSE _row.employee_password END;
  IF _hash IS NULL OR length(_hash) = 0 THEN
    RAISE EXCEPTION 'O dono ainda não definiu a senha para este cargo';
  END IF;
  IF _hash <> extensions.crypt(_password, _hash) THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;
  INSERT INTO public.employee_sessions (kiosk_user_id, role, employee_name) VALUES (_row.id, _role, _employee_name) RETURNING token INTO _token;
  DELETE FROM public.employee_sessions WHERE expires_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'token', _token,
    'kiosk_user_id', _row.id,
    'kiosk_name', _row.kiosk_name,
    'kiosk_code', _row.kiosk_code,
    'role', _role,
    'employee_name', _employee_name
  );
END;
$$;