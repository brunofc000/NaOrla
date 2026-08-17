-- 1. New column for kitchen password
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS kitchen_password text;

-- 2. Role column on sessions
ALTER TABLE public.employee_sessions ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'garcom';
ALTER TABLE public.employee_sessions DROP CONSTRAINT IF EXISTS employee_sessions_role_check;
ALTER TABLE public.employee_sessions ADD CONSTRAINT employee_sessions_role_check CHECK (role IN ('garcom','cozinha'));

-- 3. Hash trigger updated to also hash kitchen_password
CREATE OR REPLACE FUNCTION public.hash_employee_password()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.employee_password IS NOT NULL
     AND NEW.employee_password <> ''
     AND (TG_OP = 'INSERT' OR NEW.employee_password IS DISTINCT FROM OLD.employee_password)
     AND NEW.employee_password NOT LIKE '$2%$%' THEN
    NEW.employee_password := extensions.crypt(NEW.employee_password, extensions.gen_salt('bf'));
  END IF;
  IF NEW.employee_password = '' THEN NEW.employee_password := NULL; END IF;

  IF NEW.kitchen_password IS NOT NULL
     AND NEW.kitchen_password <> ''
     AND (TG_OP = 'INSERT' OR NEW.kitchen_password IS DISTINCT FROM OLD.kitchen_password)
     AND NEW.kitchen_password NOT LIKE '$2%$%' THEN
    NEW.kitchen_password := extensions.crypt(NEW.kitchen_password, extensions.gen_salt('bf'));
  END IF;
  IF NEW.kitchen_password = '' THEN NEW.kitchen_password := NULL; END IF;

  RETURN NEW;
END;
$$;

-- 4. Revoke trigger handles both passwords
CREATE OR REPLACE FUNCTION public.revoke_employee_sessions_on_password_clear()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_password IS NULL AND OLD.employee_password IS NOT NULL THEN
    DELETE FROM public.employee_sessions WHERE kiosk_user_id = NEW.id AND role = 'garcom';
  END IF;
  IF NEW.kitchen_password IS NULL AND OLD.kitchen_password IS NOT NULL THEN
    DELETE FROM public.employee_sessions WHERE kiosk_user_id = NEW.id AND role = 'cozinha';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_employee_sessions ON public.profiles;
CREATE TRIGGER trg_revoke_employee_sessions
AFTER UPDATE OF employee_password, kitchen_password ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.revoke_employee_sessions_on_password_clear();

-- 5. New login with role
CREATE OR REPLACE FUNCTION public.employee_login(_kiosk_code text, _password text, _role text DEFAULT 'garcom')
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
  INSERT INTO public.employee_sessions (kiosk_user_id, role) VALUES (_row.id, _role) RETURNING token INTO _token;
  DELETE FROM public.employee_sessions WHERE expires_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'token', _token,
    'kiosk_user_id', _row.id,
    'kiosk_name', _row.kiosk_name,
    'kiosk_code', _row.kiosk_code,
    'role', _role
  );
END;
$$;