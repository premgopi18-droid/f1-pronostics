import Link from "next/link";
import { headers } from "next/headers";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { getCurrentSeason } from "@/lib/api/cron";
import { t } from "@/lib/i18n";
import { GP_ITEM_TYPES, computeMyRank, computeMyPoints, type GpItemType, type LeagueSummary } from "@/lib/leagues/league-list";
import { LeagueCard, AddLeagueCard } from "@/app/components/league-card";

export default async function LeaguesPage() {
  const season = getCurrentSeason();
  const supabase = await createClient();
  const userId = (await headers()).get("x-user-id")!;

  // Ligues de l'utilisateur, triées par date d'adhésion (la plus ancienne en premier)
  const { data: rawMemberships } = await supabase
    .from("league_members")
    .select("league_id, is_admin, joined_at, leagues!league_id(name)")
    .eq("user_id", userId)
    .eq("season", season)
    .order("joined_at", { ascending: true });

  const memberships = rawMemberships ?? [];
  const leagueIds = memberships.map((m) => m.league_id);

  let summaries: LeagueSummary[] = [];

  if (leagueIds.length > 0) {
    // Toutes les données liées à ces ligues en parallèle
    const [
      { data: allMembers },
      { data: allScores },
      { data: allSeasonScores },
      { data: myItems },
    ] = await Promise.all([
      supabase
        .from("league_members")
        .select("user_id, league_id")
        .in("league_id", leagueIds)
        .eq("season", season),
      supabase
        .from("scores")
        .select("user_id, league_id, final_score, exact_positions")
        .in("league_id", leagueIds)
        .eq("season", season),
      supabase
        .from("season_scores")
        .select("user_id, league_id, total")
        .in("league_id", leagueIds)
        .eq("season", season),
      supabase
        .from("user_items")
        .select("league_id, item_type, uses_remaining")
        .eq("user_id", userId)
        .in("league_id", leagueIds)
        .eq("season", season),
    ]);

    // Pré-indexation : compte de membres par ligue
    const memberCountByLeague = new Map<string, number>();
    for (const m of allMembers ?? []) {
      const lid = m.league_id;
      memberCountByLeague.set(lid, (memberCountByLeague.get(lid) ?? 0) + 1);
    }

    // Items indexés par ligue
    const itemsByLeague = new Map<string, Map<GpItemType, number>>();
    for (const item of myItems ?? []) {
      const lid = item.league_id;
      if (!itemsByLeague.has(lid)) itemsByLeague.set(lid, new Map());
      itemsByLeague.get(lid)!.set(item.item_type as GpItemType, item.uses_remaining);
    }

    summaries = memberships.map((membership) => {
      const lid = membership.league_id;
      const league = membership.leagues;

      // Scores filtrés sur cette ligue
      const leagueScores = (allScores ?? [])
        .filter((s) => s.league_id === lid)
        .map((s) => ({
          user_id: s.user_id,
          final_score: s.final_score,
          exact_positions: s.exact_positions,
        }));
      const leagueSeasonScores = (allSeasonScores ?? [])
        .filter((s) => s.league_id === lid)
        // `total` est nullable en DB (colonne calculée en fin de saison) — 0 tant qu'absent.
        .map((s) => ({ user_id: s.user_id, total: s.total ?? 0 }));

      const leagueItems = itemsByLeague.get(lid) ?? new Map<GpItemType, number>();

      return {
        leagueId: lid,
        name: league?.name ?? "—",
        isAdmin: membership.is_admin,
        joinedAt: membership.joined_at,
        memberCount: memberCountByLeague.get(lid) ?? 1,
        myRank: computeMyRank(leagueScores, leagueSeasonScores, userId),
        myPoints: computeMyPoints(leagueScores, leagueSeasonScores, userId),
        items: GP_ITEM_TYPES.map((itemType) => ({
          itemType,
          usesRemaining: leagueItems.get(itemType) ?? 0,
        })),
      };
    });
  }

  return (
    <main className="flex flex-1 flex-col px-page pt-2 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between py-2">
        <h1 className="font-display text-2xl font-bold text-foreground">
          {t("leagues.title")}
        </h1>
        <Link
          href="/leagues/new"
          aria-label={t("leagues.create")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-foreground transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus size={18} aria-hidden />
        </Link>
      </div>

      {summaries.length === 0 ? (
        /* État vide — CTA plein écran */
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <span className="text-5xl" aria-hidden>
            🏁
          </span>
          <p className="text-center text-sm text-text-secondary">
            {t("leagues.emptyText")}
          </p>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <Link
              href="/leagues/new"
              className="flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold text-foreground transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("leagues.create")}
            </Link>
            <Link
              href="/leagues/join"
              className="flex h-11 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {t("leagues.join")}
            </Link>
          </div>
        </div>
      ) : (
        /* Liste des ligues + card CTA en bas */
        <div className="flex flex-col gap-3 mt-2">
          {summaries.map((league) => (
            <LeagueCard key={league.leagueId} league={league} />
          ))}
          <AddLeagueCard />
        </div>
      )}
    </main>
  );
}
