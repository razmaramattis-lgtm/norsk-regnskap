CREATE POLICY "bilag read members" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'bilag' AND public.is_member(((storage.foldername(name))[1])::uuid));
CREATE POLICY "bilag upload writers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bilag' AND public.can_write(((storage.foldername(name))[1])::uuid));