# Algorithme de scoring — BoxBox

> Version : 0.1
> Dernière mise à jour : Juin 2026
> Référence technique pour l'implémentation du moteur de scoring.

---

## 1. Vue d'ensemble

### Modèle en deux phases

| Phase | Déclencheur | Ce qui se passe | Scores visibles |
|---|---|---|---|
| **Phase 1 — par session** | Après chaque session confirmée (qualif, sprint, course) | base_score calculé et écrit. `final_score = base_score` (pas d'items encore) | ✅ Provisoires |
| **Phase 2 — résolution items** | Après la course du dimanche uniquement | Items résolus, final_score mis à jour, `grands_prix.scoring_finalized_at` renseigné | ✅ Définitifs |

**Pourquoi deux phases :** les utilisateurs voient les résultats F1 officiels des qualifications dans l'app pour ajuster leur pronostic de course jusqu'au dimanche. Afficher les scores provisoires dès samedi crée de l'engagement. Les items (attaques/défenses) restent secrets jusqu'à la course — leur révélation est un moment fort du dimanche.

**Signal UI :** `grands_prix.scoring_finalized_at IS NULL` → scores provisoires. `IS NOT NULL` → scores définitifs avec items.

| Flux | Déclencheur | Table cible |
|---|---|---|
| Score de session (Phase 1) | Après chaque session confirmée par Jolpica | `scores` (base_score = final_score) |
| Résolution items (Phase 2) | Après la course du dimanche | `scores` (final_score mis à jour) + `grands_prix.scoring_finalized_at` |
| Score saison | Une fois en fin de saison (WDC/WCC officiels) | `season_scores` |

---

## 2. Score de session

### 2.1 Barèmes

| Session | Exact (Δ=0) | Δ=±1 | Δ=±2 | Autre |
|---|---|---|---|---|
| `qualifying` | 5 | 2 | 1 | 0 |
| `race` | 5 | 2 | 1 | 0 |
| `sprint_qualifying` | 3 | 1 | — | 0 |
| `sprint_race` | 3 | 1 | — | 0 |

Longueur à scorer : **10 positions** pour `qualifying`, `race`, `sprint_qualifying` — **8 positions** pour `sprint_race`.

Bonus fastest lap (`race` uniquement) : **+1 pt** si le pilote prédit dans `fastest_lap_predictions` correspond au `fastest_lap = true` dans `session_results`.

### 2.2 Algorithme — score brut

```typescript
// Type unifié — une seule Map couvre les deux fonctions ci-dessous
type DriverResult = { position: number | null; fastestLap: boolean }

const SCORE_TABLES = {
  qualifying:        { 0: 5, 1: 2, 2: 1 },
  race:              { 0: 5, 1: 2, 2: 1 },
  sprint_qualifying: { 0: 3, 1: 1 },
  sprint_race:       { 0: 3, 1: 1 },
} as const

function computeBaseScore(
  entries: string[],
  results: Map<string, DriverResult>,  // session_results (position null = DNF/DNS)
  sessionType: SessionType,
): { score: number; exactPositions: number; breakdown: BreakdownEntry[] } {
  const table = SCORE_TABLES[sessionType]
  const n = sessionType === 'sprint_race' ? 8 : 10
  let score = 0
  let exactPositions = 0
  const breakdown: BreakdownEntry[] = []

  for (let i = 0; i < n; i++) {
    const code = entries[i]
    const predictedPos = i + 1
    const actualPos = results.get(code)?.position ?? null

    let pts = 0
    if (actualPos !== null) {
      const delta = Math.abs(predictedPos - actualPos)
      pts = table[delta as keyof typeof table] ?? 0
    }

    if (actualPos === predictedPos) exactPositions++
    score += pts
    breakdown.push({ code, predictedPos, actualPos, pts })
  }

  return { score, exactPositions, breakdown }
}

function computeFastestLap(
  predictedCode: string | null,
  results: Map<string, DriverResult>,
): number {
  if (!predictedCode) return 0
  const actual = [...results.entries()].find(([, r]) => r.fastestLap)?.[0]
  return actual === predictedCode ? 1 : 0
}
```

### 2.3 Orchestration — base_score total

```typescript
// Appelé après confirmation des résultats de chaque session
function computeSessionBaseScore(userId: string, session: Session, results: Map<string, DriverResult>): number {
  const prediction = getPrediction(userId, session.id)
  if (!prediction?.is_valid) return 0

  const { score } = computeBaseScore(prediction.entries, results, session.type)
  const flPts = session.type === 'race'
    ? computeFastestLap(getFastestLapPrediction(userId, session.id), results)
    : 0

  return score + flPts  // base_score = positions + fastest_lap (race uniquement)
}
```

---

## 3. Résolution des items GP

### Périmètre d'exécution — global vs par-ligue

Le score brut (§2) est calculé **une seule fois** par `(user, session)` — identique dans toutes les ligues de l'utilisateur. La résolution des items tourne **une fois par `(GP × ligue)`** — chaque ligue a ses propres `items_played` et écrit ses propres lignes `scores`.

```
Pour chaque session confirmée du GP :
  ① Calculer base_score une seule fois par utilisateur (§2 — global, league-agnostic)

  Pour chaque ligue active ce GP :
    ② Créer un scores row par (user, league, session) avec finalScore = base_score
    ③ Résoudre les items de cette ligue (étapes 0–7 ci-dessous)
    ④ Écrire scores rows finaux + marquer items_played résolus
```

> Les items d'une ligue n'affectent jamais les scores d'une autre ligue. Un joueur dans 3 ligues peut avoir 3 Wild Cards différents qui le ciblent — chaque ligue résout indépendamment.

### 3.1 Ordre strict (par ligue)

```
0. INIT              → pour chaque scores row de la ligue : finalScore = base_score
1. COLLECTE          → items_played WHERE gp_id = :gp AND league_id = :league AND resolved_at IS NULL
2. BOUCLIERS         → annuler les items offensifs entrants des joueurs protégés
3. BLOQUER UN PILOTE → mettre le driver ciblé à 0 pts dans la session visée (positions uniquement)
4. WILD CARD         → snapshot scores, puis transférer floor(score/2) victime → attaquant (parallèle)
5. DERNIER TOUR      → ×2 sur le finalScore résultant de la session choisie
6. BONUS ITEMS       → vérifier conditions des items de prédiction bonus (DNF, underdog, écurie)
7. ÉCRITURE          → INSERT INTO scores + UPDATE items_played (resolved_at, effect_applied)
```

### 3.2 Détail étape par étape

#### Étape 2 — Boucliers

```typescript
for (const shield of items.filter(i => i.type === 'shield')) {
  const offensiveItems = items.filter(i =>
    i.targetUserId === shield.userId &&
    ['block_driver', 'wild_card'].includes(i.type)
  )
  offensiveItems.forEach(i => {
    i.wasShielded = true
    i.effectApplied = false
  })
}
```

#### Étape 3 — Bloquer un pilote

Pour chaque `block_driver` non annulé : le pilote ciblé rapporte 0 pt de **position** à la victime pour la session visée. Le bonus fastest lap (prédiction séparée) n'est **pas** affecté par le block — il concerne une autre table (`fastest_lap_predictions`).

```typescript
// Clé composite pour accéder aux scores en O(1) — utilisée partout dans §3
type ScoreKey = `${string}:${string}`  // `${userId}:${sessionType}`

for (const block of activeItems('block_driver')) {
  const key: ScoreKey = `${block.targetUserId}:${block.sessionType}`
  const victimScore = scores.get(key)
  const driverPts = victimScore.breakdown.find(e => e.code === block.driverCode)?.pts ?? 0
  victimScore.finalScore -= driverPts
  block.effectApplied = driverPts > 0  // false si le pilote avait 0 pt de toute façon (DNF, etc.)
}
```

#### Étape 4 — Wild Card (résolution parallèle)

> **Parallèle** : chaque vol est calculé sur le score **original** de la session (avant que la victime n'ait reçu ses propres gains éventuels). Le snapshot doit être pris **avant** la boucle — pas dedans.

```typescript
// Snapshot AVANT la boucle — copie les finalScores courants (post-block, pre-wildcard)
const snapshot = new Map<ScoreKey, number>()
for (const [key, sessionScore] of scores) {
  snapshot.set(key, sessionScore.finalScore)
}

for (const wc of activeItems('wild_card')) {
  const victimKey: ScoreKey = `${wc.targetUserId}:${wc.sessionType}`
  const attackerKey: ScoreKey = `${wc.userId}:${wc.sessionType}`

  const originalScore = snapshot.get(victimKey) ?? 0
  const stolen = Math.floor(originalScore / 2)  // floor — scores toujours entiers

  scores.get(victimKey)!.finalScore -= stolen
  scores.get(attackerKey)!.finalScore += stolen
  wc.payload.pointsStolen = stolen
  wc.effectApplied = true
}
```

#### Étape 5 — Dernier tour de magie

```typescript
for (const dbl of activeItems('double_points')) {
  const key: ScoreKey = `${dbl.userId}:${dbl.sessionType}`
  scores.get(key)!.finalScore *= 2
  dbl.effectApplied = true
}
```

#### Étape 6 — Items de prédiction bonus

Évalués sur les résultats de la **course** uniquement. Points ajoutés au `final_score` de la course **après** le ×2, non doublables.

| Item | Condition | Bonus |
|---|---|---|
| `dnf_prediction` | `payload.driver_code` a `dnf = true` dans `session_results` de la course. DNS (pilote qui n'a pas pris le départ) = item wasted (`effect_applied = false`) | +8 pts |
| `underdog_top5` | `qualifying.position > 10` ET `race.position ≤ 5`. Si le pilote n'a pas de position en qualif (DNS qualif, pit lane start) → considéré hors top 10 par défaut. Nécessite les résultats des deux sessions | +8 pts |
| `no_points_team` | Aucun des 2 pilotes du `payload.constructor_code` n'a `race.position ≤ 10` (DNF, DNS et positions > 10 tous comptent comme "sans points") | +12 pts |

```typescript
for (const bonus of activeItems(['dnf_prediction', 'underdog_top5', 'no_points_team'])) {
  const pts = evaluateBonusItem(bonus, raceResults)
  const raceKey: ScoreKey = `${bonus.userId}:race`
  scores.get(raceKey)!.finalScore += pts
  bonus.effectApplied = pts > 0
}
```

---

## 4. Score saison (WDC / WCC)

Calculé **une seule fois** en fin de saison, après publication des résultats officiels.

### 4.1 Barème

| Delta | Points |
|---|---|
| 0 | 8 |
| ±1 | 3 |
| ±2 | 1 |
| > 2 | 0 |

**Bonus podium** : +15 pts si les positions P1, P2 et P3 sont toutes les trois exactes (Δ=0).
Applicable indépendamment pour WDC et WCC.

### 4.2 Algorithme

```typescript
function computeSeasonScore(
  entries: string[],                       // codes ordonnés (season_predictions.entries)
  officialResults: Map<string, number>,    // code → position finale officielle
): { score: number; bonus: number } {
  let score = 0
  let podiumExact = 0

  for (let i = 0; i < entries.length; i++) {
    const code = entries[i]
    const predictedPos = i + 1
    const actualPos = officialResults.get(code) ?? null

    if (actualPos === null) continue  // pilote absent du classement final (blessure, etc.)

    const delta = Math.abs(predictedPos - actualPos)
    const pts = ({ 0: 8, 1: 3, 2: 1 } as Record<number, number>)[delta] ?? 0

    if (delta === 0 && predictedPos <= 3) podiumExact++
    score += pts
  }

  return { score, bonus: podiumExact === 3 ? 15 : 0 }
}
```

> **WDC** : `entries` contient 10 codes pilotes (sur 22). Les 12 pilotes non prédits ne comptent pas.
> **WCC** : `entries` contient les 11 codes écuries dans l'ordre prédit.

---

## 5. Classement (Leaderboard)

```sql
SELECT
  p.pseudo,
  p.avatar_key,
  p.is_deleted,
  COALESCE(SUM(s.final_score), 0) + COALESCE(ss.total, 0)  AS total_season,
  COALESCE(SUM(s.exact_positions), 0)                       AS total_exact_positions
FROM league_members lm
JOIN profiles p ON p.id = lm.user_id
LEFT JOIN scores s
  ON s.user_id = lm.user_id AND s.league_id = lm.league_id AND s.season = lm.season
LEFT JOIN season_scores ss
  ON ss.user_id = lm.user_id AND ss.league_id = lm.league_id AND ss.season = lm.season
WHERE lm.league_id = $1 AND lm.season = $2
GROUP BY p.id, p.pseudo, p.avatar_key, p.is_deleted, ss.total
ORDER BY p.is_deleted ASC, total_season DESC, total_exact_positions DESC
```

`exact_positions` est lu depuis la colonne précomputée sur `scores`, pas recalculé depuis le JSONB.

---

## 6. Exemple complet — GP de Monaco 2026 (session Race)

### 6.1 Résultats officiels

| Position | Pilote | Note |
|---|---|---|
| 1 | VER | |
| 2 | LEC | |
| 3 | NOR | Fastest lap |
| 4 | PIA | |
| 5 | RUS | |
| 6 | ALO | |
| 7 | SAI | |
| 8 | HAM | |
| 9 | STR | |
| 10 | OCO | |
| DNF | PER | |

### 6.2 Pronostics

**Alice** — entries : `["VER","PER","LEC","NOR","PIA","RUS","ALO","SAI","HAM","STR"]`, fastest lap : NOR
**Bob** — entries : `["LEC","VER","NOR","PIA","RUS","ALO","SAI","HAM","STR","OCO"]`, fastest lap : VER

### 6.3 Calcul des scores bruts

**Alice :**

| Pos. prédite | Pilote | Pos. réelle | Δ | Points |
|---|---|---|---|---|
| 1 | VER | 1 | 0 | **5** ✓ |
| 2 | PER | DNF | — | 0 |
| 3 | LEC | 2 | 1 | 2 |
| 4 | NOR | 3 | 1 | 2 |
| 5 | PIA | 4 | 1 | 2 |
| 6 | RUS | 5 | 1 | 2 |
| 7 | ALO | 6 | 1 | 2 |
| 8 | SAI | 7 | 1 | 2 |
| 9 | HAM | 8 | 1 | 2 |
| 10 | STR | 9 | 1 | 2 |
| FL | NOR | NOR ✓ | | **+1** |

Alice : **base_score = 22 pts**, exact_positions = 1

**Bob :**

| Pos. prédite | Pilote | Pos. réelle | Δ | Points |
|---|---|---|---|---|
| 1 | LEC | 2 | 1 | 2 |
| 2 | VER | 1 | 1 | 2 |
| 3 | NOR | 3 | 0 | **5** ✓ |
| 4 | PIA | 4 | 0 | **5** ✓ |
| 5 | RUS | 5 | 0 | **5** ✓ |
| 6 | ALO | 6 | 0 | **5** ✓ |
| 7 | SAI | 7 | 0 | **5** ✓ |
| 8 | HAM | 8 | 0 | **5** ✓ |
| 9 | STR | 9 | 0 | **5** ✓ |
| 10 | OCO | 10 | 0 | **5** ✓ |
| FL | VER | NOR ✗ | | 0 |

Bob : **base_score = 44 pts**, exact_positions = 8

### 6.4 Items joués

| Joueur | Item | Cible | Session |
|---|---|---|---|
| Bob | Wild Card | Alice | race |
| Alice | Dernier tour de magie | — | race (×2) |

### 6.5 Résolution

**Étape 1 — Collecte :** wild_card (Bob→Alice, race), double_points (Alice, race)

**Étape 2 — Boucliers :** aucun

**Étape 3 — Bloquer un pilote :** aucun

**Étape 4 — Wild Card :**
- Snapshot Alice race score = 22
- Stolen = floor(22 / 2) = **11**
- Alice : 22 − 11 = **11**
- Bob : 44 + 11 = **55**

**Étape 5 — Dernier tour de magie (Alice, race) :**
- Alice : 11 × 2 = **22**

**Étape 6 — Bonus items :** aucun

### 6.6 Résultats finaux

| Joueur | base_score | Items | final_score | exact_positions |
|---|---|---|---|---|
| Alice | 22 | −11 (wild card) × 2 (double) | **22** | 1 |
| Bob | 44 | +11 (wild card) | **55** | 8 |

> **Comportement intentionnel** : Bob vole 11 pts à Alice, mais Alice double ce qui lui reste — elle retrouve son score de départ. Bob conserve les 11 pts volés en plus de son propre score. Le ×2 joué par la victime atténue considérablement le Wild Card adverse.

---

## 7. Cas limites

| Cas | Comportement |
|---|---|
| Prédiction non soumise ou invalide | `base_score = 0`, `final_score = 0`, `exact_positions = 0` pour la session |
| Pilote DNF/DNS dans la prédiction (top 10) | Ce pilote rapporte 0 pt (position = null dans session_results) |
| Block driver sur un pilote DNS/DNF | L'item est consommé sans effet (`effect_applied = false`) — notification envoyée |
| Block driver sur le pilote prédit en fastest lap | Block ne zero que les points de position. Le +1 FL survit — c'est une prédiction séparée dans `fastest_lap_predictions` |
| Wild Card sur un joueur avec 0 pt | `floor(0/2) = 0` — item joué, aucun effet (`effect_applied = true`, `points_stolen = 0`) |
| Wild Cards mutuels (A vole B et B vole A) | Snapshot pris avant résolution — chaque vol calculé sur le score original. Résolution parallèle, pas en cascade |
| `dnf_prediction` sur un pilote DNS (n'a pas pris le départ) | Item wasted (`effect_applied = false`) — seul `dnf = true` dans session_results déclenche le bonus |
| `exact_positions` sur une position bloquée | Comptabilisée dans le tiebreaker — calculée depuis le pronostic brut avant items. La précision de prédiction est indépendante du score final |
| GP annulé | Items joués restitués (`uses_remaining` restauré), sauf si dernier GP de la saison |
| Pilote absent du classement final WDC/WCC | 0 pt pour cette position (ex : pilote retraité en cours de saison) |
