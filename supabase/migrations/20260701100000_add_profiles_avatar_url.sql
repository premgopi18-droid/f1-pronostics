-- Photo d'avatar personnalisée (optionnelle) — cf. specs §Avatar (#167).
-- `avatar_key` (couleur du casque) reste la source d'identité couleur et le
-- fallback ; `avatar_url` porte le chemin public de la photo dans Storage quand
-- l'utilisateur en a choisi une. Null = pas de photo (on affiche le casque).

alter table public.profiles
  add column if not exists avatar_url text;
