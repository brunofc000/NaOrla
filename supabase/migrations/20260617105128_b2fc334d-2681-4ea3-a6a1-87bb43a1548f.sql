
CREATE OR REPLACE FUNCTION public.hash_employee_password()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, extensions AS $$
BEGIN
  IF NEW.employee_password IS NOT NULL
     AND NEW.employee_password <> ''
     AND (TG_OP = 'INSERT' OR NEW.employee_password IS DISTINCT FROM OLD.employee_password)
     AND NEW.employee_password NOT LIKE '$2%$%' THEN
    NEW.employee_password := extensions.crypt(NEW.employee_password, extensions.gen_salt('bf'));
  END IF;
  IF NEW.employee_password = '' THEN NEW.employee_password := NULL; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.employee_login(_kiosk_code text, _password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
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
  IF _row.employee_password <> extensions.crypt(_password, _row.employee_password) THEN
    RAISE EXCEPTION 'Senha incorreta';
  END IF;
  INSERT INTO public.employee_sessions (kiosk_user_id) VALUES (_row.id) RETURNING token INTO _token;
  DELETE FROM public.employee_sessions WHERE expires_at < now() - interval '1 day';
  RETURN jsonb_build_object(
    'token', _token,
    'kiosk_user_id', _row.id,
    'kiosk_name', _row.kiosk_name,
    'kiosk_code', _row.kiosk_code
  );
END;
$$;
