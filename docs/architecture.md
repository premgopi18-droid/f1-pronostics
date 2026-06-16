# Architecture technique — BoxBox

> Version : 0.1
> Dernière mise à jour : Juin 2026
> Ce document décrit les choix d'architecture du code. À lire avant d'écrire la première ligne.

---

## 1. Principes directeurs

| Principe | Règle concrète |
|---|---|
| **Logique pure** | Le moteur de scoring ne fait aucun I/O — données en entrée, données en sortie |
| **Couches séparées** | Seul `/lib/data/` touche Supabase. Jamais de requête dans `/lib/scoring/` |
| **Route handlers fins** | Une route = autorisation + fetch (data) + compute (scoring) + persist (data). ~15 lignes max |
| **Valeurs configurables** | Zéro magic number dans la logique — tout dans `constants.ts` |
| **Idempotence** | Le scoring peut être relancé N fois sur le même GP : même résultat, UPSERT sur les clés uniques |
| **Portabilité** | Toute la logique métier dans Next.js. Aucune logique dans Supabase Edge Functions |

---

## 2. Structure du projet

```
/app
  /page.tsx
  /leagues/[id]/
  /predictions/
  /leaderboard/
  /api/
    /f1/sync/route.ts          → synchronisation calendrier + résultats Jolpica
    /scores/trigger/route.ts   → déclenchement du scoring (cron + admin manuel)
    /predictions/route.ts
    /leagues/route.ts
    /notifications/route.ts

/lib
  /scoring/                    ← DOMAINE PUR — zéro import Supabase, zéro I/O
    constants.ts               → barèmes, points items, limites (source de vérité unique)
    types.ts                   → types domaine + discriminated unions
    base-score.ts              → computeBaseScore, computeFastestLap, computeSessionBaseScore
    resolve-items.ts           → pipeline §3 (shield → block → wildcard → double → bonus)
    season-score.ts            → computeSeasonScore (WDC/WCC)
    leaderboard.ts             → agrégation leaderboard (si logique custom nécessaire)

  /data/                       ← PERSISTANCE — le seul endroit qui touche Supabase
    predictions.ts             → getPredictionsForSession, getFastestLapPrediction
    session-results.ts         → getResultsForSession, getResultsForGP
    items.ts                   → getItemsForGP, markItemsResolved, restoreItems
    scores.ts                  → upsertSessionScores, upsertSeasonScores
    leagues.ts                 → getActiveLeaguesForGP, getLeagueMembers

  /f1/
    jolpica.ts                 → client Jolpica API + mappers → types domaine
    openf1.ts                  → client OpenF1 API (fallback résultats rapides)

  supabase.ts                  → 2 clients : createClient() (cookie/RLS) + createServiceClient() (service-role)
```

> **Règle d'import** : `/lib/scoring/` peut importer depuis lui-même et depuis `/lib/scoring/types`. Il ne peut **jamais** importer depuis `/lib/data/`, `/lib/f1/`, ou Supabase. Si tu te surprends à importer Supabase dans `/lib/scoring/`, la logique est au mauvais endroit.

> **Frontière des clients Supabase** — il y a **deux** clients, et la confusion entre les deux est une faille de sécurité :
>
> | Client | RLS | Pour | Exemples |
> |---|---|---|---|
> | `createClient()` (cookie/RLS) | **appliqué** (`auth.uid()`) | toute lecture/écriture **déclenchée par une action utilisateur** | soumettre/voir ses pronos, afficher les pronos de la ligue après deadline, leaderboard affiché à l'écran |
> | `createServiceClient()` (service-role) | **bypassé** | batch **cron/sync de confiance** (protégés par `CRON_SECRET`), sans utilisateur connecté | tout `/lib/data/`, appelé par le scoring et la sync F1 |
>
> **`/lib/data/` utilise exclusivement `createServiceClient()`** : le cron note tous les joueurs sans `auth.uid()`, donc le RLS le filtrerait à vide. En contrepartie, **aucune lecture issue d'une action utilisateur ne doit passer par `/lib/data/`** — elle bypasserait les policies (ex. secret des pronos avant deadline, restriction co-membre de ligue). Ces lectures UI passent par `createClient()` et leur propre requête, où le RLS décide ce que l'utilisateur a le droit de voir. Le futur leaderboard affiché à l'utilisateur en est l'exemple type : RLS, pas `/lib/data/`.

---

## 3. Types domaine — discriminated union sur les payloads

Le JSONB de `items_played.payload` n'a pas de type DB. On compense en TypeScript. C'est la décision de typing la plus importante du projet.

```typescript
// /lib/scoring/types.ts

export type SessionType = 'qualifying' | 'race' | 'sprint_qualifying' | 'sprint_race'

// Un payload par item_type — le compilateur détecte les champs manquants
export type ItemPayload =
  | { type: 'shield' }
  | { type: 'block_driver';    targetUserId: string; sessionType: SessionType; driverCode: string }
  | { type: 'wild_card';       targetUserId: string; sessionType: SessionType; pointsStolen?: number }
  | { type: 'double_points';   sessionType: SessionType }
  | { type: 'dnf_prediction';  driverCode: string }
  | { type: 'underdog_top5';   driverCode: string }
  | { type: 'no_points_team';  constructorCode: string }
  | { type: 'fia_penalty';     driverCode: string }        // nice-to-have — voir product-specs §3.5
  | { type: 'wdc_move';        code: string; fromPosition: number; toPosition: number }
  | { type: 'wcc_move';        code: string; fromPosition: number; toPosition: number }

export type GPItemType = Exclude<ItemPayload['type'], 'wdc_move' | 'wcc_move'>

export type DriverResult = { position: number | null; fastestLap: boolean }
export type ScoreKey = `${string}:${string}`  // `${userId}:${sessionType}`

export interface SessionScore {
  baseScore: number
  finalScore: number
  exactPositions: number
  breakdown: BreakdownEntry[]
}

export interface BreakdownEntry {
  code: string
  predictedPos: number
  actualPos: number | null
  pts: number
}
```

---

## 4. Valeurs configurables — constants.ts

Tous les points sont ici. Une PR pour ajuster les barèmes = une ligne, pas une chasse aux magic numbers.

```typescript
// /lib/scoring/constants.ts

export const SCORE_TABLES = {
  qualifying:        { 0: 5, 1: 2, 2: 1 },
  race:              { 0: 5, 1: 2, 2: 1 },
  sprint_qualifying: { 0: 3, 1: 1 },
  sprint_race:       { 0: 3, 1: 1 },
} as const

export const SEASON_SCORE_TABLE = { 0: 8, 1: 3, 2: 1 } as const
export const SEASON_PODIUM_BONUS = 15
export const FASTEST_LAP_BONUS  = 7

export const ITEM_BONUS_POINTS = {
  dnf_prediction:  8,
  underdog_top5:   8,
  no_points_team:  12,
  fia_penalty:     10,  // nice-to-have
} as const

export const ITEM_USES_PER_SEASON: Record<string, number> = {
  shield:          3,
  block_driver:    1,
  wild_card:       1,
  double_points:   1,
  dnf_prediction:  1,
  underdog_top5:   1,
  no_points_team:  1,
  fia_penalty:     1,  // nice-to-have — voir product-specs §3.5
  wdc_move:        1,
  wcc_move:        1,
}
```

---

## 5. Pattern de résolution — handler map

La résolution des items utilise une map de handlers plutôt qu'un switch. Ajouter un item = ajouter une entrée dans la map. Le pipeline ordonné reste intact.

```typescript
// /lib/scoring/resolve-items.ts

type ItemResolver = (item: PlayedItem, scores: Map<ScoreKey, SessionScore>, ctx: ResolutionContext) => void

// Shield est exclu de la map — il opère sur la liste d'items (pas sur les scores)
// et a une signature différente (voir resolveShields ci-dessous)
const RESOLVERS: Record<Exclude<GPItemType, 'shield'>, ItemResolver> = {
  block_driver:    resolveBlock,
  wild_card:       resolveWildCard,      // utilisé dans resolveWildCards uniquement (snapshot parallèle)
  double_points:   resolveDouble,
  dnf_prediction:  resolveDnfPrediction,
  underdog_top5:   resolveUnderdogTop5,
  no_points_team:  resolveNoPointsTeam,
}

// Fonction PURE — prend des données, retourne des données. Zéro I/O.
// À ne pas confondre avec runItemResolution(gpId) dans /lib/data/ qui orchestre le tout.
export function applyItemEffects(
  items: PlayedItem[],
  scores: Map<ScoreKey, SessionScore>,
  ctx: ResolutionContext,   // { raceResults, qualifyingResults, leagueId, gpId }
): Map<ScoreKey, SessionScore> {
  const active = (type: GPItemType) => items.filter(i => i.type === type && !i.wasShielded)

  // Étape 2 — boucliers : modifie wasShielded sur les items offensifs in-place
  resolveShields(items)

  // Étape 3 — bloquer un pilote
  active('block_driver').forEach(i => RESOLVERS.block_driver(i, scores, ctx))

  // Étape 4 — Wild Card : résolution parallèle via snapshot (voir scoring-spec.md §3.2)
  resolveWildCards(active('wild_card'), scores)

  // Étape 5 — Dernier tour de magie (après wild_card — intentionnel, voir Monaco example)
  active('double_points').forEach(i => RESOLVERS.double_points(i, scores, ctx))

  // Étape 6 — Bonus items : après le ×2, non doublables
  for (const type of ['dnf_prediction', 'underdog_top5', 'no_points_team'] as const) {
    active(type).forEach(i => RESOLVERS[type](i, scores, ctx))
  }

  return scores
}
```

---

## 6. Modèle d'exécution du scoring

### Modèle en deux phases

**Phase 1 — score de base par session** (après chaque session du weekend)
```
Déclencheur : session confirmée par Jolpica (qualif samedi, course dimanche, etc.)
  │
  ├─ fetchSessionResults(sessionId)       → session_results de cette session
  ├─ fetchPredictionsForSession(sessionId)
  │
  ├─ Pour chaque utilisateur ayant prédit cette session :
  │    baseScore = computeSessionBaseScore(userId, session, results)  ← global
  │
  └─ Pour chaque ligue active :
       └─ upsertScore({ baseScore, finalScore: baseScore, ... })  ← finalScore = base pour l'instant
```

**Phase 2 — résolution items** (après la course du dimanche uniquement)
```
Déclencheur : course du dimanche confirmée ET Phase 1 complète pour toutes les sessions du GP
  │
  ├─ Pour chaque ligue active ce GP :
  │    ├─ fetchLeagueItems(gpId, leagueId)
  │    ├─ scores = loadCurrentScores(gpId, leagueId)  ← les base_scores déjà calculés
  │    ├─ scores = applyItemEffects(items, scores, ctx)  ← fonction pure §5
  │    └─ upsertSessionScores(scores, leagueId)       ← met à jour final_score uniquement
  │
  └─ UPDATE grands_prix SET scoring_finalized_at = now() WHERE id = :gpId
```

**Avantages :**
- Scores provisoires visibles dès samedi → engagement weekend
- Items révélés dimanche → moment fort préservé
- Batch queries : 1 requête par type de données, pas 1 par utilisateur
- Idempotent : les deux phases sont safe à re-lancer via UPSERT
- `scoring_finalized_at` = signal unique pour l'UI (provisoire vs définitif)

### Déclenchement — stratégie cron (deux phases)

```typescript
// /app/api/scores/trigger/route.ts — protégé par CRON_SECRET ou admin auth
// Un seul endpoint gère les deux phases : il détecte ce qui est en attente et agit

export async function POST(req: Request) {
  // Phase 1 : base_scores manquants, par ligue. Le scoping par ligue permet le
  // catch-up d'une ligue créée en cours de saison et la rejouabilité si le cron
  // plante à mi-chemin (les base_scores sont stockés par (session, league)).
  const leagues = await data.getActiveLeagues()
  let sessionsScored = 0
  for (const league of leagues) {
    const pendingSessions = await data.getPendingSessionScores(league.id)
    for (const session of pendingSessions) {
      await computeAndStoreBaseScores(session.id, league.id)
      sessionsScored++
    }
  }

  // Phase 2 : GPs dont toutes les sessions sont scorées mais items non résolus
  const pendingResolutions = await data.getPendingItemResolutions()
  for (const gp of pendingResolutions) {
    await runItemResolution(gp.id)     // orchestration dans /lib/data/ — fetche, appelle applyItemEffects(), persiste
    await data.markGPFinalized(gp.id)  // scoring_finalized_at = now()
  }

  return Response.json({ sessions: sessionsScored, resolutions: pendingResolutions.length })
}
```

**Fréquence de polling — ciblée par fenêtre de session**

Le cron ne sert à rien entre les sessions. On le fait tourner uniquement dans les fenêtres où Jolpica publie des résultats (typiquement 30-90 min après la fin d'une session).

| Option | Fréquence | Coût | Délai après session | Statut |
|---|---|---|---|---|
| **Cron externe ciblé** (cron-job.org) | Toutes les 10 min dans les fenêtres session | Gratuit | ~10-20 min | ✅ Préféré |
| Trigger manuel admin | À la demande | Gratuit | < 1 min | ✅ Backup / dev |
| Vercel Hobby cron | 1×/jour | Gratuit | Jusqu'à 24h | Filet de sécurité uniquement |

**Stratégie v1 :** cron-job.org configure plusieurs jobs — un par type de session (qualif samedi, course dimanche). Chaque job tourne toutes les 10 min pendant ~3h autour de l'heure de session. En dehors de ces fenêtres : aucun polling. L'endpoint est idempotent — appelable N fois sans effet de bord.

> À valider lors des tests : latence réelle de Jolpica après chaque type de session. Le trigger manuel reste disponible en permanence comme backup.

---

## 7. Requêtes — règle anti N+1

Le scoring batch-fetche tout avant de calculer. Jamais de requête dans une boucle par utilisateur.

```typescript
// ✅ Correct — 3 requêtes pour tout le GP
const [allPredictions, allResults, allItems] = await Promise.all([
  data.getPredictionsForGP(gpId),
  data.getResultsForGP(gpId),
  data.getItemsForGP(gpId, leagueId),
])

// ❌ Interdit — N requêtes pour N utilisateurs
for (const userId of userIds) {
  const pred = await supabase.from('predictions').select(...).eq('user_id', userId)  // NON
}
```

---

## 8. Testabilité

Les fonctions pures dans `/lib/scoring/` se testent sans mock Supabase ni serveur. Le travail de l'exemple Monaco (scoring-spec.md §6) devient exactement le premier test d'intégration du moteur.

```typescript
// Pattern de test — entrées/sorties directes, zéro mock
describe('computeBaseScore', () => {
  it('Monaco race example — Alice', () => {
    const results = new Map([
      ['VER', { position: 1,    fastestLap: false }],
      ['PER', { position: null, fastestLap: false }],  // DNF
      ['LEC', { position: 2,    fastestLap: false }],
      // ...
      ['NOR', { position: 3,    fastestLap: true }],
    ])
    const entries = ['VER','PER','LEC','NOR','PIA','RUS','ALO','SAI','HAM','STR']
    const { score, exactPositions } = computeBaseScore(entries, results, 'race')

    expect(score).toBe(21)           // positions seulement (sans FL)
    expect(exactPositions).toBe(1)   // VER P1 exact
  })
})
```

---

## 10. Politique de tests

**Framework :** Vitest (meilleur support ESM, plus rapide que Jest, compatible Next.js sans config complexe).

| Couche | Stratégie | Règle |
|---|---|---|
| `/lib/scoring/` | **Tests unitaires — couverture maximale** | Fonctions pures, zéro mock. Le cas Monaco (§6) est le premier test. |
| `/lib/data/` | **Tests d'intégration — Supabase réel** | Ne jamais mocker la DB. Utiliser Supabase CLI local pour les tests. |
| `/app/api/` | **Pas de tests unitaires** | Route handlers trop fins (~15 lignes). Couverts par E2E si besoin. |
| UI | **Pas de tests unitaires** | Playwright pour les flows critiques (soumission prédiction, leaderboard) — v2. |

**Règle absolue :** ne jamais mocker Supabase dans les tests de `/lib/data/`. Toute divergence mock/prod est un bug silencieux.

**Script :** `npm test` (one-shot CI) / `npm run test:watch` (dev).

---

## 9. Ce qu'on ne fait pas (et pourquoi)

| Pattern évité | Raison |
|---|---|
| Logique scoring dans les route handlers | Non testable, non réutilisable |
| Requêtes dans `/lib/scoring/` | Couplage caché, impossible à tester unitairement |
| Supabase Edge Functions pour la logique métier | Lock-in, plus difficile à déboguer localement |
| Recalcul du breakdown JSONB pour le tiebreaker | `exact_positions` est precomputé sur `scores` — O(1) vs O(N) |
| Table dénormalisée pour le leaderboard | Inutile à ≤20 joueurs/ligue — requête suffit |
| Révéler les effets des items avant la course du dimanche | Les scores provisoires (base) sont visibles dès samedi — mais les items (attaques, doublements) restent secrets jusqu'au dimanche. `scoring_finalized_at` porte ce signal. |
