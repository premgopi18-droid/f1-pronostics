-- Onboarding obligatoire : un nouveau compte doit choisir pseudo + casque avant
-- d'accéder à l'app. Le gating (proxy) redirige vers /onboarding tant que false.
alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false;

-- Les comptes existants (créés avant l'onboarding) sont considérés finalisés,
-- pour ne pas les renvoyer dans le flux. Les nouveaux profils (trigger
-- handle_new_user) héritent du défaut `false`.
update public.profiles set onboarding_completed = true where onboarding_completed = false;
