
CREATE POLICY "Kiosk photos read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'kiosk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Kiosk photos insert own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kiosk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Kiosk photos update own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'kiosk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Kiosk photos delete own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'kiosk-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
