CREATE OR REPLACE FUNCTION public.revoke_employee_sessions_on_password_clear()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.employee_password IS NULL AND OLD.employee_password IS NOT NULL THEN
    DELETE FROM public.employee_sessions WHERE kiosk_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_employee_sessions ON public.profiles;
CREATE TRIGGER trg_revoke_employee_sessions
AFTER UPDATE OF employee_password ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.revoke_employee_sessions_on_password_clear();