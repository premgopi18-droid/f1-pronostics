-- Bucket Storage des photos d'avatar — cf. specs §Avatar (#167).
--
-- Lecture PUBLIQUE (URL directe + cache CDN ; un avatar n'est pas une donnée
-- sensible). Écriture réservée par RLS au propriétaire de son dossier
-- `{user_id}/…`. `file_size_limit` = backstop serveur si le client (qui
-- compresse en ~256px) est contourné ; les types MIME sont restreints aux
-- formats produits côté client (WebP, sinon repli JPEG ; PNG toléré).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  1048576, -- 1 Mo : très au-dessus d'un avatar compressé, bloque les abus
  array['image/webp', 'image/jpeg', 'image/png']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- RLS est déjà activé sur storage.objects par défaut. On ajoute uniquement les
-- policies d'écriture scopées au dossier de l'utilisateur. La lecture passe par
-- le endpoint public du bucket (pas besoin de policy select).

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
