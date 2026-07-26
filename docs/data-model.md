# Modèle de données — BoxBox

> Version : 0.2 — fixes post-review Opus
> Dernière mise à jour : Juin 2026

---

## Principes

- **UUIDs** pour tous les IDs (défaut Supabase)
- **UTC** pour tous les timestamps — conversion en heure locale côté client
- **Colonne `season`** (INTEGER, ex: 2026) sur toutes les tables pertinentes — prépare le multi-saisons v2. Exception : `leagues` est une entité persistante sans saison.
- **JSONB** pour les listes ordonnées (prediction entries) — 1 ligne par prédiction, pas de JOIN
- **Pas d'écrasement** — les données de jeu passées (`scores`, `predictions`, `items_played`) ne sont jamais supprimées ou modifiées. **Exception : suppression de compte (RGPD)** — `delete_own_account` retire les adhésions (`league_members`) et l'inventaire d'items non joués (`user_items`) de l'utilisateur, toutes saisons confondues, pour libérer les slots de ligue. Les données de jeu ci-dessus restent (liées à l'UUID anonymisé), donc les calculs de points passés restent intègres.
- **RLS Supabase** sur toutes les tables exposées au client. Convention perf : dans les policies, toujours écrire `(select auth.uid())` — jamais `auth.uid()` nu, ré-évalué par ligne (advisor `auth_rls_initplan`). Éviter aussi deux policies permissives sur le même couple rôle/commande : une policy « own » en `FOR ALL` + une policy SELECT co-membres se scindent en INSERT/UPDATE/DELETE + un SELECT fusionné par `OR` (migration `20260708120000_perf_rls_and_indexes`).
- **Codes pilotes/écuries** (ex: "VER", "RED_BULL") dans les JSONB de prédictions — trade-off délibéré : lisibilité > intégrité référentielle sur ces champs. Le moteur de scoring mappe code → UUID au moment du calcul.
- **Types TypeScript générés** — `lib/database.types.ts` est généré depuis le schéma prod (jamais édité à la main) et branché sur les trois fabriques de client (`createClient<Database>`). **À régénérer après chaque migration qui change le schéma** : outil MCP `generate_typescript_types` ou `npx supabase gen types typescript --project-id oegnropofqlzkuwleqtt`, en conservant le bandeau d'en-tête. Les colonnes JSONB (`payload`, `breakdown`, `geojson`, `entries`) sont typées `Json` : leur forme applicative est castée aux frontières de lecture/écriture, avec un commentaire justificatif à chaque site.

---

## 1. Données F1 (synchronisées via Jolpica)

### `drivers`

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| season | INTEGER | ex: 2026 |
| code | TEXT | "VER", "NOR" |
| first_name | TEXT | |
| last_name | TEXT | |
| number | INTEGER | |
| constructor_id | UUID FK → constructors | |
| created_at | TIMESTAMPTZ | |

**RLS :** lecture publique

**Index :** `(constructor_id)`

---

### `constructors`

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| season | INTEGER | |
| code | TEXT | "RED_BULL", "FERRARI" |
| name | TEXT | |
| created_at | TIMESTAMPTZ | |

**RLS :** lecture publique

---

### `grands_prix`

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| season | INTEGER | |
| round | INTEGER | numéro dans la saison |
| name | TEXT | "Grand Prix de Monaco" |
| circuit | TEXT | |
| country | TEXT | |
| is_sprint_weekend | BOOLEAN | |
| is_cancelled | BOOLEAN | défaut false |
| weekend_starts_at | TIMESTAMPTZ | UTC — **début du GP** = 1ère session de compétition (sprint qualif en week-end sprint, sinon qualif), **hors essais libres**. Fourni par Jolpica. Ancre commune : countdown Home, phase week-end, « prochain GP » des ligues, notif "J-2 avant le GP". |
| scoring_finalized_at | TIMESTAMPTZ | null jusqu'à la résolution des items après la course du dimanche. L'UI utilise ce champ pour distinguer scores provisoires (null) et définitifs (non null). |
| notified_open_at | TIMESTAMPTZ | null jusqu'à l'envoi de la notif push "pronostics ouverts" (J-2). Garantit une seule notif par GP. |
| notified_scores_at | TIMESTAMPTZ | null jusqu'à l'envoi de la notif push "résultats disponibles". Garantit une seule notif par GP. |
| notified_reminder_24h_at | TIMESTAMPTZ | null jusqu'à l'envoi du rappel push "pronos J-1" (24h avant la 1ʳᵉ session-deadline du week-end). Garantit une seule notif par GP. |
| race_laps | INTEGER | null jusqu'à la course. Nombre de tours de la course = tours du vainqueur, dérivé des résultats F1 par le cron `/api/f1/sync` à la confirmation (`fetchRaceLaps` → `setRaceLaps`). Alimente la stat « tours » du tracé de circuit (§3.3, #174) — lu sur la dernière édition disputée du circuit. |
| created_at | TIMESTAMPTZ | |

**RLS :** lecture publique

---

### `sessions`

Uniquement les sessions avec des pronostics. Les FP ne sont pas stockées.
Seuls les résultats officiels Jolpica sont stockés — pas de flag `is_official` nécessaire.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| gp_id | UUID FK → grands_prix | |
| season | INTEGER | |
| type | TEXT | `qualifying` \| `race` \| `sprint_qualifying` \| `sprint_race` \| `practice_1` \| `practice_2` \| `practice_3` (EL informatifs, non scorés) |
| starts_at | TIMESTAMPTZ | UTC — sert de deadline de verrouillage |
| results_confirmed_at | TIMESTAMPTZ | null jusqu'aux résultats officiels Jolpica |
| notified_deadline_at | TIMESTAMPTZ | null jusqu'à l'envoi de la notif "deadline dans 1h" |
| notified_provisional_at | TIMESTAMPTZ | null jusqu'à l'envoi de la notif "scores provisoires" |
| notified_post_session_at | TIMESTAMPTZ | null jusqu'à l'envoi du rappel "tu peux encore ajuster" (2h après le début de cette session, invite à ajuster le prono de la session suivante) |
| created_at | TIMESTAMPTZ | |

**RLS :** lecture publique

**Index :** `(gp_id, type)`, `(season, starts_at)`

---

### `session_results`

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → sessions | |
| season | INTEGER | |
| driver_id | UUID FK → drivers | |
| position | INTEGER | null si DNF |
| dnf | BOOLEAN | défaut false |
| fastest_lap | BOOLEAN | défaut false |
| created_at | TIMESTAMPTZ | |

**Contrainte :** UNIQUE (session_id, driver_id)

**RLS :** lecture publique

**Index :** `(driver_id)`

---

### `starting_grids`

Grille de départ réelle (pénalités et pit lane inclus), importée d'OpenF1 (`/starting_grid`) par le cron de sync entre la confirmation des qualifications et le départ, puis re-synchronisée à chaque passage jusqu'au départ (pénalités tardives). Sert au pré-remplissage du pronostic course ([product-specs §3.3](product-specs.md)). `session_id` référence la session **course** (`race` / `sprint_race`), pas la qualification qui a produit la grille.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| session_id | UUID FK → sessions | ON DELETE CASCADE — session course |
| season | INTEGER | |
| driver_id | UUID FK → drivers | |
| position | INTEGER | position de grille (les départs pit lane, sans position, ne sont pas stockés) |
| created_at | TIMESTAMPTZ | |

**Contrainte :** UNIQUE (session_id, driver_id)

**RLS :** lecture publique. Écriture réservée au service-role (cron de sync).

**Index :** `(driver_id)`

---

### `circuit_tracks`

Tracés SVG des circuits (source `bacinger/f1-circuits`, indépendante de Jolpica). Alimentée par `POST /api/admin/sync-circuits`. Voir [product-specs §3.3](product-specs.md).

| Colonne | Type | Notes |
|---|---|---|
| id | TEXT PK | id bacinger, ex. `mc-1929` |
| circuit_name | TEXT UNIQUE | `Name` bacinger, ex. `Circuit de Monaco` |
| geojson | JSONB | *Feature* GeoJSON complète (geometry + properties : coordonnées, `length`…) |
| updated_at | TIMESTAMPTZ | |

**RLS :** lecture publique. Écriture réservée au service-role (endpoint sync, `CRON_SECRET`). Jointure avec `grands_prix.circuit` via le mapping `lib/f1/circuit-mapping.ts` (nom Jolpica → id bacinger).

---

## 2. Utilisateurs

### `profiles`

Extension de `auth.users` Supabase. Créée automatiquement à l'inscription via trigger.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | = auth.users.id |
| pseudo | TEXT UNIQUE | |
| avatar_key | TEXT | identifiant de l'avatar prédéfini |
| notif_imminence_scope | TEXT | `'all'` / `'stakes-only'` / `'none'` — défaut `'stakes-only'` |
| notif_announcements | BOOLEAN | opt-in annonces produit (« Nouveautés ») — défaut `true`, opt-out par l'utilisateur |
| is_deleted | BOOLEAN | défaut false |
| deleted_at | TIMESTAMPTZ | null si actif |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

**RLS :**
- L'utilisateur lit et modifie son propre profil
- Les membres d'une même ligue voient le pseudo et l'avatar
- `is_deleted = true` → l'anonymisation est faite **au niveau DB** (le `pseudo` est écrasé par « Compte supprimé … »). Le flag sert de marqueur d'audit ; un compte supprimé n'apparaît plus dans les listes de membres (ses `league_members` sont retirées).

> **Suppression de compte (RGPD)** : tout passe par le RPC `delete_own_account` (cf. §RPC). L'utilisateur est **retiré de toutes ses ligues** — `league_members` et `user_items` supprimés (toutes saisons) pour libérer les slots et permettre le re-join. La ligne `profiles` et les données de jeu (`scores`, `predictions`, `items_played`, FK → `auth.users.id`) sont conservées mais anonymisées — `pseudo` écrasé par une valeur neutre (libère la contrainte `UNIQUE`), `avatar_key` à null, `is_deleted = true`. Côté auth : `auth.users.email` + `raw_user_meta_data` + `raw_app_meta_data` neutralisés, les lignes `auth.identities` et `push_subscriptions` supprimées. Pas de hard-delete de `auth.users` (la cascade `profiles → auth.users` serait bloquée par les FK `NO ACTION` des `scores`), mais sans identité ni métadonnées la ligne devient non-connectable et l'email d'origine est libéré → une reconnexion Google recrée un compte neuf.

---

### `push_subscriptions`

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| endpoint | TEXT | URL unique par appareil — contrainte `UNIQUE (endpoint)` (requise par l'upsert ON CONFLICT) |
| p256dh | TEXT | clé publique Web Push |
| auth_key | TEXT | clé d'authentification Web Push |
| created_at | TIMESTAMPTZ | |

**RLS :** accessible uniquement par le propriétaire

**Index :** `(user_id)`

> Pas de table `notifications` en v1 — envoi cron fire-and-forget via push_subscriptions. Décision consciente. (Les **annonces produit** font exception : elles ont une table `announcements` dédiée, car éditoriales et rejouables — voir ci-dessous.)

---

### `announcements`

Canal d'annonces produit (« Nouveautés ») — source de vérité éditoriale + historique alimentant `/whats-new`. Voir [product-specs §3.6](product-specs.md).

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| title | TEXT | titre du push / de l'entrée Nouveautés |
| body | TEXT | corps (une phrase) |
| url | TEXT | chemin **interne** ouvert au clic — défaut `/whats-new` |
| dedup_key | TEXT UNIQUE | clé d'idempotence optionnelle (retry de l'envoi sans doublon) |
| created_at | TIMESTAMPTZ | |
| sent_at | TIMESTAMPTZ | renseigné à la diffusion ; `NULL` = brouillon jamais poussé |

**RLS :**
- **Lecture** : tout utilisateur authentifié voit les annonces **déjà diffusées** (`sent_at IS NOT NULL`) — alimente `/whats-new`.
- **Écriture** : aucune policy → réservée au **service-role** (endpoint `/api/admin/announce`, protégé par `CRON_SECRET`).

> **Envoi idempotent** : l'endpoint crée la ligne puis **claim atomique** de `sent_at` (`UPDATE … WHERE sent_at IS NULL`) avant de pousser — une même annonce n'est jamais diffusée deux fois (même principe que les colonnes `notified_*`). Un retry réseau peut fournir la même `dedup_key` pour retomber sur la même ligne. Diffusion filtrée sur `profiles.notif_announcements = true`.

---

## 3. Ligues

### `leagues`

Une ligue est une entité **persistante** — pas de colonne `season`. La même ligue joue plusieurs saisons ; c'est `league_members` et `scores` qui sont saisonniers.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | TEXT | |
| invite_code | TEXT UNIQUE | token aléatoire régénérable |
| invite_open | BOOLEAN | défaut true |
| max_members | INTEGER | CHECK (max_members BETWEEN 2 AND 20) |
| created_at | TIMESTAMPTZ | |

**Contrainte :** `CHECK (max_members BETWEEN 2 AND 20)`

**RLS :**
- Lecture : membres de la ligue uniquement (via league_members)
- Modification (invite_code, invite_open, max_members) : admin uniquement

---

### `league_members`

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| league_id | UUID FK → leagues | |
| user_id | UUID FK → profiles | |
| season | INTEGER | |
| is_admin | BOOLEAN | |
| joined_at | TIMESTAMPTZ | |

**Contrainte :** UNIQUE (league_id, user_id, season)

**Trigger :** garantit qu'une ligue a toujours au moins 1 admin (`is_admin = true`) — empêche de retirer le dernier admin sans en nommer un autre.

**Trigger :** à l'insertion d'un nouveau membre, vérifie que `COUNT(league_members WHERE league_id = NEW.league_id AND season = NEW.season) < leagues.max_members` — empêche de dépasser la capacité même si quelqu'un rejoindrait via un lien direct.

**RLS :**
- Lisible par tous les membres de la même ligue
- `is_admin` modifiable uniquement par un admin

**Index :** `(league_id, season)`, `(user_id, season)`

> **Rollover de saison (report automatique)** : au passage à une nouvelle saison, un job batch crée de nouvelles lignes `league_members` pour tous les membres de chaque ligue (admin conservé) et réinitialise `user_items` (1 par item, 3 pour le bouclier). Les lignes des saisons précédentes — ici comme dans `scores`, `predictions`, `items_played` — ne sont jamais modifiées.

---

## 4. Prédictions (globales par user, scorées par ligue)

### `predictions`

Une ligne par user par session. L'ordre prédit est stocké en JSONB — pas de table séparée. La longueur dépend de la session (voir `is_valid`).

> **Trade-off codes vs UUIDs** : `entries` stocke des codes pilotes (`"VER"`) plutôt que des UUIDs. Choix délibéré pour la lisibilité et la simplicité du JSONB. Le moteur de scoring mappe code → UUID via la table `drivers` au moment du calcul. Pas d'intégrité référentielle sur ce champ — acceptable à cette échelle.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| session_id | UUID FK → sessions | |
| season | INTEGER | |
| entries | JSONB | `["VER","NOR","LEC","HAM","RUS","ALO","SAI","PIA","STR","OCO"]` — ordre = classement prédit |
| submitted_at | TIMESTAMPTZ | |
| is_valid | BOOLEAN | false si prédiction incomplète ou non soumise. Longueur attendue : 10 pour `qualifying`, 5 pour `sprint_qualifying`, 8 pour `sprint_race` ; pour `race` = **nombre de pilotes engagés** pour la session (toute la grille au départ — 22 en 2026, mais suit le line-up réel en cas de forfait). La validation est session-type-dépendante. |

**Contrainte :** UNIQUE (user_id, session_id)

**RLS :**
- Lecture propre : toujours
- Lecture des autres : uniquement si `sessions.starts_at < now()` ET `EXISTS (SELECT 1 FROM league_members lm1 JOIN league_members lm2 ON lm1.league_id = lm2.league_id AND lm1.season = lm2.season WHERE lm1.user_id = auth.uid() AND lm2.user_id = predictions.user_id)` — restreint aux co-membres d'une ligue

**Index :** `(user_id, session_id)`, `(session_id)`

---

### `fastest_lap_predictions`

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| session_id | UUID FK → sessions | uniquement sessions de type `race` |
| season | INTEGER | |
| driver_id | UUID FK → drivers | |
| submitted_at | TIMESTAMPTZ | |

**Contrainte :** UNIQUE (user_id, session_id)

**RLS :** même règle que `predictions` (lock + co-membre de ligue)

**Index :** `(user_id, session_id)`, `(session_id)`, `(driver_id)`

---

### `season_predictions`

WDC et WCC stockés en JSONB. Une ligne par user par type par saison.

> **Note** : les items `wdc_move` et `wcc_move` mutent `entries` en place. La modification est auditable via `items_played` (from/to position enregistrés dans le payload). Tension acceptée avec le principe "pas d'écrasement" — l'audit est dans `items_played`, pas dans `season_predictions`.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| season | INTEGER | |
| type | TEXT | `wdc` \| `wcc` |
| entries | JSONB | WDC: `["VER","NOR","LEC",...]` (top 10) — WCC: `["RED_BULL","FERRARI",...]` (11 écuries) |
| submitted_at | TIMESTAMPTZ | |
| locked_at | TIMESTAMPTZ | null jusqu'au verrouillage au 1er GP |

**Contrainte :** UNIQUE (user_id, season, type)

**RLS :**
- Lecture propre : toujours
- Lecture des autres : uniquement après `locked_at` ET co-membre d'une ligue (même condition que `predictions`)

---

## 5. Items

> **Portée** : les **items GP** sont par ligue par saison (`user_items`) ; les **items saison** (`wdc_move`, `wcc_move`) sont globaux (`user_season_items`) — 1 par user par saison, toutes ligues confondues, car la prédiction saison est globale. Cf. `product-specs.md`.

### `user_items`

Stock d'items GP de chaque joueur par ligue. Initialisé en début de saison.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| league_id | UUID FK → leagues | |
| season | INTEGER | |
| item_type | TEXT | voir liste ci-dessous |
| uses_remaining | INTEGER | décrémenté à chaque utilisation |

**Types d'items :** `shield`, `block_driver`, `wild_card`, `double_points`, `dnf_prediction`, `underdog_top5`, `no_points_team`, `fia_penalty`

**Contrainte :** UNIQUE (user_id, league_id, season, item_type)

**RLS :** accessible uniquement par le propriétaire

**Index :** `(user_id, league_id, season)`, `(league_id)`

---

### `user_season_items`

Stock d'items saison (`wdc_move`, `wcc_move`), **global** — 1 par user par saison, indépendant des ligues. Si aucune ligne n'existe encore, l'item est considéré disponible (1 usage par défaut) ; la RPC `apply_season_item` crée la ligne à la première utilisation.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → auth.users (ON DELETE CASCADE) | |
| season | INTEGER | |
| item_type | TEXT | `wdc_move` \| `wcc_move` (CHECK) |
| uses_remaining | INTEGER | default 1, CHECK ≥ 0 |
| created_at | TIMESTAMPTZ | default now() |

**Contrainte :** UNIQUE (user_id, season, item_type)

**RLS :** lecture par le propriétaire uniquement ; les écritures passent par la RPC `apply_season_item` (service role).

Migration : `20260617140000_season_items_and_apply_rpc.sql`.

---

### `items_played`

Historique de chaque item joué. Le champ `payload` stocke les données spécifiques à chaque type.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| league_id | UUID FK → leagues | **nullable** — null pour items saison globaux (wdc_move, wcc_move) |
| season | INTEGER | |
| item_type | TEXT | |
| gp_id | UUID FK → grands_prix | null pour items saison (wdc_move, wcc_move) |
| payload | JSONB | données spécifiques à l'item (voir exemples) |
| played_at | TIMESTAMPTZ | |
| resolved_at | TIMESTAMPTZ | null jusqu'après la course |
| was_shielded | BOOLEAN | null pour items non offensifs |
| effect_applied | BOOLEAN | false si annulé (bouclier actif, pilote DNS) |
| points_delta_actor | INTEGER | nullable — effet en points sur le joueur qui a joué l'item (écrit par le moteur de résolution) |
| points_delta_target | INTEGER | nullable — effet sur la cible (null pour items non offensifs ; historique pré-#151 à null) |

**Contrainte :** `UNIQUE (user_id, league_id, gp_id) WHERE gp_id IS NOT NULL` — enforce "1 item GP par ligue par week-end". Les items saison (gp_id NULL) sont exclus de cette contrainte.

**Exemples de payload :**
```json
// block_driver
{ "target_user_id": "uuid", "session_type": "race", "driver_code": "VER" }

// wild_card
{ "target_user_id": "uuid", "session_type": "qualifying", "points_stolen": 12 }

// shield
{}

// double_points
{ "session_type": "race" }

// dnf_prediction / underdog_top5 / fia_penalty
{ "driver_code": "ALO" }

// no_points_team
{ "constructor_code": "HAAS" }

// wdc_move / wcc_move (item saison — gp_id NULL, hors slot hebdo)
{ "code": "NOR", "from_position": 4, "to_position": 2 }
```

**RLS :**
- Lecture par le joueur qui l'a joué : toujours
- Lecture par les autres membres de la ligue : uniquement après `resolved_at`

**Index :** `(league_id, gp_id, season)`, `(gp_id)`

---

## 6. Scores (par ligue)

### `scores`

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| league_id | UUID FK → leagues | |
| session_id | UUID FK → sessions | |
| season | INTEGER | |
| base_score | INTEGER | avant application des items |
| final_score | INTEGER | après items. Tous les scores sont entiers : le Wild Card vole `floor(points / 2)`, transféré symétriquement (victime perd = attaquant gagne). Aucune décimale possible |
| exact_positions | INTEGER | nombre de positions exactes cette session — utilisé pour le départage |
| breakdown | JSONB | détail position par position — alimente la transparence du scoring |
| computed_at | TIMESTAMPTZ | |

**Contrainte :** UNIQUE (user_id, league_id, session_id)

**RLS :** lisible par tous les membres de la ligue

**Index :** `(league_id, season)`, `(user_id, league_id, season)`, `(session_id)`

**Forme du breakdown :** tableau JSON de `BreakdownEntry` (cf. `lib/scoring/types.ts`), une entrée par position scorée, écrit tel quel par `upsertBaseScores`. Il ne contient **que** les points de position — ni le bonus fastest lap, ni l'effet des items (ceux-ci vivent dans `final_score` ; le FL est une prédiction séparée dans `fastest_lap_predictions`).

```json
[
  { "code": "VER", "predictedPos": 1, "actualPos": 1, "pts": 5 },
  { "code": "NOR", "predictedPos": 2, "actualPos": 3, "pts": 2 },
  { "code": "LEC", "predictedPos": 3, "actualPos": 5, "pts": 1 },
  { "code": "PER", "predictedPos": 4, "actualPos": null, "pts": 0 }
]
```

> `actualPos: null` = pilote sans position en `session_results` (DNF/DNS) → `pts: 0`.

---

### `season_scores`

Calculé en fin de saison une fois les résultats WDC/WCC officiels.

| Colonne | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → profiles | |
| league_id | UUID FK → leagues | |
| season | INTEGER | |
| wdc_score | INTEGER | points position par position WDC |
| wdc_bonus | INTEGER | +15 si podium WDC exact |
| wcc_score | INTEGER | points position par position WCC |
| wcc_bonus | INTEGER | +15 si podium WCC exact |
| total | INTEGER | somme des quatre colonnes |
| computed_at | TIMESTAMPTZ | |

**Contrainte :** UNIQUE (user_id, league_id, season)

**RLS :** lisible par tous les membres de la ligue

**Index :** `(league_id)`

---

## Leaderboard (requête, pas de table)

Le classement est calculé à la volée. `exact_positions` est lu depuis la colonne dédiée sur `scores` — pas de recalcul depuis le breakdown JSONB.

```sql
SELECT
  p.pseudo,
  p.avatar_key,
  COALESCE(SUM(s.final_score), 0) + COALESCE(ss.total, 0) AS total_season,
  COALESCE(SUM(s.exact_positions), 0)                      AS total_exact_positions
FROM league_members lm
JOIN profiles p ON p.id = lm.user_id
LEFT JOIN scores s ON s.user_id = lm.user_id
  AND s.league_id = lm.league_id
  AND s.season = lm.season
LEFT JOIN season_scores ss ON ss.user_id = lm.user_id
  AND ss.league_id = lm.league_id
  AND ss.season = lm.season
WHERE lm.league_id = $1 AND lm.season = $2
GROUP BY p.id, p.pseudo, p.avatar_key, ss.total
ORDER BY total_season DESC, total_exact_positions DESC
```

---

## Index principaux

| Table | Index |
|---|---|
| `sessions` | `(gp_id, type)`, `(season, starts_at)` |
| `predictions` | `(user_id, session_id)` UNIQUE, `(session_id)` |
| `scores` | `(league_id, season)`, `(user_id, league_id, season)` |
| `league_members` | `(league_id, season)`, `(user_id, season)` |
| `items_played` | `(league_id, gp_id, season)`, UNIQUE `(user_id, league_id, gp_id) WHERE gp_id IS NOT NULL` |
| `user_items` | `(user_id, league_id, season)` |
| `user_season_items` | UNIQUE `(user_id, season, item_type)` |

---

## Note d'implémentation RLS — récursion infinie

Les politiques RLS sur `predictions` et `season_predictions` vérifient l'appartenance à une ligue commune via `league_members`. Ce type de self-join déclenche la protection anti-récursion infinie de PostgreSQL si les tables impliquées ont elles-mêmes des politiques RLS actives.

**Fix :** encapsuler le check dans une fonction `SECURITY DEFINER` qui bypass les RLS le temps de la vérification :

```sql
CREATE OR REPLACE FUNCTION shared_league(other_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members lm1
    JOIN league_members lm2
      ON lm1.league_id = lm2.league_id
      AND lm1.season = lm2.season
    WHERE lm1.user_id = auth.uid()
      AND lm2.user_id = other_user_id
  );
$$;
```

Puis utiliser `shared_league(predictions.user_id)` dans les policies. À implémenter au moment d'écrire les migrations Supabase.

---

## Fonctions transactionnelles (RPC)

Les écritures multi-tables sont encapsulées dans des fonctions Postgres appelées **uniquement côté serveur** via le client service-role. L'exécution directe par les clients (`anon` / `authenticated`) est révoquée pour ne pas contourner la validation des Server Actions (`revoke all … ; grant execute … to service_role`).

### `create_league(p_name, p_max_members, p_user_id, p_season, p_items)`

Crée une ligue, sa ligne admin (`league_members`) et l'inventaire d'items du créateur (`user_items`) en une seule transaction — évite la ligue orpheline sans admin qu'un enchaînement de 3 inserts côté client pouvait laisser. Génère le code d'invitation avec retry sur collision `UNIQUE`. Retourne `(league_id, invite_code)`. Migration : `20260616120000_create_league_function.sql`.

### `play_item(p_user_id, p_league_id, p_gp_id, p_season, p_item_type, p_payload)`

Joue un item GP en une seule transaction :

1. **Décrément gardé** de `user_items.uses_remaining` (mis à jour uniquement si `> 0`) ; si aucune ligne n'est touchée → `raise exception 'item_exhausted'`.
2. **Insert** dans `items_played`. La contrainte `UNIQUE (user_id, league_id, gp_id) WHERE gp_id IS NOT NULL` fait échouer l'insert si un item GP a déjà été joué ce week-end → toute la transaction (décrément compris) est annulée.

Garantit l'atomicité (jamais d'item joué sans décrément) et l'absence de sur-dépense en cas de concurrence. Appelée par `insertPlayedItem` (`lib/data/items.ts`). Migration : `20260617120000_create_play_item_function.sql`.

### `apply_season_item(p_user_id, p_season, p_item_type, p_from, p_to)`

Applique un item saison (`wdc_move` / `wcc_move`) en une seule transaction :

1. **Décrément gardé** de `user_season_items.uses_remaining` (crée la ligne avec `uses_remaining = 1` si absente, via `on conflict do nothing`, puis décrémente uniquement si `> 0`) ; si rien n'est touché → `item_exhausted` (`P0001`).
2. **Pull-and-shift** de `season_predictions.entries` (retire l'entrée en `p_from`, la réinsère en `p_to`, 1-based). Prédiction absente → `no_prediction` (`P0002`) ; positions hors plage ou égales → `position_out_of_range` (`P0003`).
3. **Insert** du log auditable dans `items_played` (`league_id` NULL, `gp_id` NULL, payload `{ code, from_position, to_position }`).

Remplace l'enchaînement upsert → insert → upsert côté serveur, qui pouvait laisser la prédiction mutée sans décrément (échec partiel) ou sur-dépenser en concurrence. Appelée par `applySeasonItemAction` (`app/actions/season-predictions.ts`). Migration : `20260617140000_season_items_and_apply_rpc.sql`.

### `delete_own_account()`

Supprime le compte de l'appelant en une seule transaction, **scopée sur `auth.uid()`** (aucun id n'est passé par le client → pas d'IDOR) :

1. **Transfert d'admin** : pour **chaque `(ligue, saison)`** où l'utilisateur est admin, nomme le plus ancien membre encore actif de cette saison (`joined_at`, `is_deleted = false`) puis se retire — dans cet ordre, pour respecter le trigger « ≥1 admin » (qui ne se déclenche que sur UPDATE, pas sur le DELETE de l'étape 2).
2. **Retrait des ligues** : supprime `league_members` + `user_items` de l'utilisateur, **toutes saisons confondues** — libère les slots (`enforce_max_members`) et permet le re-join après ré-inscription.
3. **Anonymisation du profil** : `pseudo` neutre, `avatar_key` null, `is_deleted = true`, `deleted_at`.
4. **Effacement des données d'auth** : neutralise `auth.users.email` + `raw_user_meta_data` + `raw_app_meta_data` (coupe le lien provider résiduel côté Gotrue) et supprime les `auth.identities`.
5. **Effacement des `push_subscriptions`** : sinon `sendPushToAll` continuerait de notifier l'appareil d'un compte supprimé.

`SECURITY DEFINER` (owner `postgres`, qui a les droits d'écriture sur le schéma `auth`) avec `search_path = ''` et objets pleinement qualifiés. Sans paramètre (entièrement toutes-saisons). `execute` accordé à `authenticated` uniquement. Appelée par `deleteAccount` (`app/actions/profile.ts`). Migrations : `20260619110000_delete_own_account_rpc.sql`, `20260620130000_delete_account_league_cleanup.sql`, `20260620140000_delete_account_admin_transfer_all_seasons.sql`.

### `toggle_invites(p_league_id)`

Bascule `leagues.invite_open` en un seul statement (`set invite_open = not invite_open … returning invite_open`) et retourne le nouvel état. Atomique → remplace le read-modify-write côté Server Action (deux admins concurrents ne se neutralisent plus) et supprime la divergence UI quand l'onglet est périmé : le client applique l'état renvoyé au lieu de l'inférer.

Contrairement aux autres RPC, **`SECURITY INVOKER`** (défaut) : l'écriture est gouvernée par la policy RLS « admins update league » — un non-admin touche 0 ligne, la fonction renvoie `NULL`. `assertAdmin` (`app/actions/league-admin.ts`) reste le garde-fou principal (défense en profondeur). `execute` accordé à `authenticated` uniquement. Appelée par `toggleInvites`. Migration : `20260620150000_toggle_invites_rpc.sql`.

---

## Récapitulatif des 20 tables

| # | Table | Domaine |
|---|---|---|
| 1 | `drivers` | F1 Data |
| 2 | `constructors` | F1 Data |
| 3 | `grands_prix` | F1 Data |
| 4 | `sessions` | F1 Data |
| 5 | `session_results` | F1 Data |
| 6 | `starting_grids` | F1 Data |
| 7 | `circuit_tracks` | F1 Data |
| 8 | `profiles` | Utilisateurs |
| 9 | `push_subscriptions` | Utilisateurs |
| 10 | `announcements` | Utilisateurs |
| 11 | `leagues` | Ligues |
| 12 | `league_members` | Ligues |
| 13 | `predictions` | Prédictions |
| 14 | `fastest_lap_predictions` | Prédictions |
| 15 | `season_predictions` | Prédictions |
| 16 | `user_items` | Items |
| 17 | `user_season_items` | Items |
| 18 | `items_played` | Items |
| 19 | `scores` | Scores |
| 20 | `season_scores` | Scores |
