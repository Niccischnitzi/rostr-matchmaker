DROP POLICY IF EXISTS "Users can read public profile voice snippet files" ON storage.objects;
CREATE POLICY "Users can read public profile voice snippet files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'media-clips'
  AND EXISTS (
    SELECT 1
    FROM public.voice_snippets vs
    JOIN public.profiles p ON p.id = vs.user_id
    WHERE vs.storage_path = storage.objects.name
      AND vs.is_public = true
      AND coalesce(p.is_public, true) = true
  )
);