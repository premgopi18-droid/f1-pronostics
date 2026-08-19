-- Résolution d'items en UN SEUL UPDATE transactionnel (#206). L'ancien chemin
-- (Promise.all de N UPDATE) pouvait échouer partiellement : des items marqués
-- resolved_at pendant que d'autres restaient null. Au run suivant du trigger,
-- les items non marqués étaient ré-appliqués sur des scores qui contenaient
-- déjà leur effet → double comptage (+12 re-crédité, Wild Card re-volée…).
-- Un seul statement SQL = tout ou rien.
--
-- p_items : tableau JSONB [{ id, was_shielded, effect_applied,
--   points_delta_actor, points_delta_target, payload }]. `payload` ne remplace
-- l'existant que s'il est non null (Wild Card : points_stolen ajouté à la
-- résolution — cf. lib/items/resolution.ts).
--
-- Le garde `resolved_at is null` rend l'appel idempotent : un re-run ne
-- réécrit jamais un item déjà résolu.

create or replace function public.mark_items_resolved(p_items jsonb)
returns void
language sql
set search_path = ''
as $$
  update public.items_played ip
  set was_shielded        = r.was_shielded,
      effect_applied      = r.effect_applied,
      points_delta_actor  = r.points_delta_actor,
      points_delta_target = r.points_delta_target,
      payload             = coalesce(r.payload, ip.payload),
      resolved_at         = now()
  from jsonb_to_recordset(p_items) as r(
    id                  uuid,
    was_shielded        boolean,
    effect_applied      boolean,
    points_delta_actor  integer,
    points_delta_target integer,
    payload             jsonb
  )
  where ip.id = r.id
    and ip.resolved_at is null;
$$;

-- Appelée uniquement côté serveur (cron de scoring, service role) — même
-- politique que play_item.
revoke all on function public.mark_items_resolved(jsonb) from public, anon, authenticated;
grant execute on function public.mark_items_resolved(jsonb) to service_role;
