
REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, kiosk_name, avatar_url) ON public.profiles TO anon;
