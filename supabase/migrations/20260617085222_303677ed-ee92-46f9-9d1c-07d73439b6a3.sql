
-- Public read for menu items (cardápio via QR Code)
CREATE POLICY "Menu public read available" ON public.menu_items
  FOR SELECT TO anon
  USING (is_available = true);
GRANT SELECT ON public.menu_items TO anon;

-- Public read minimal profile info for kiosk name
CREATE POLICY "Profiles public read kiosk info" ON public.profiles
  FOR SELECT TO anon
  USING (true);
GRANT SELECT ON public.profiles TO anon;
