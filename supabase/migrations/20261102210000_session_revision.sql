-- Révision des classements après confirmation (#259).
--
-- Les commissaires sanctionnent souvent après l'arrivée (GP du Mexique 2026 :
-- pénalités de course dans la nuit, disqualification de Lawson en qualifs).
-- Tant que le GP n'est pas finalisé, le cron de sync compare le classement
-- stocké des séances scorées au classement officiel OpenF1 et applique les
-- différences via apply_session_revision.

-- Claim de la notif « scores corrigés » : un seul push par séance révisée.
alter table public.sessions add column if not exists revision_notified_at timestamptz;

-- p_positions : [{ driver_id, position }] — seuls les pilotes qui changent.
-- Classement ET suppression des scores de la séance dans la même transaction :
-- un classement révisé avec des scores périmés ne serait plus jamais recalculé
-- (le cron ne verrait plus de différence). Les scores supprimés sont recalculés
-- par le cron de scoring au passage suivant (phase 1, GP non finalisé).
-- Jamais après finalisation : les items ont été résolus sur l'ancien
-- classement (verrou sur le GP, sérialisé avec la finalisation).
create or replace function public.apply_session_revision(p_session_id uuid, p_positions jsonb)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_finalized_at timestamptz;
begin
  select g.scoring_finalized_at into v_finalized_at
  from public.sessions s
  join public.grands_prix g on g.id = s.gp_id
  where s.id = p_session_id
  for update of g;

  if not found or v_finalized_at is not null then
    return false;
  end if;

  update public.session_results r
  set position = p.position
  from jsonb_to_recordset(p_positions) as p(driver_id uuid, position integer)
  where r.session_id = p_session_id
    and r.driver_id = p.driver_id;

  delete from public.scores where session_id = p_session_id;

  return true;
end;
$$;

-- Appelée uniquement par le cron de sync (service role) — même politique que
-- mark_items_resolved.
revoke all on function public.apply_session_revision(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_session_revision(uuid, jsonb) to service_role;
