# Déploiement & configuration des crons

Guide opérationnel pour déployer l'application et configurer les tâches planifiées.

---

## Variables d'environnement

À configurer dans Vercel → Project Settings → Environment Variables.

| Variable | Valeur | Où la trouver |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` | Supabase Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Supabase Dashboard → Project Settings → API → anon/public |
| `NEXT_PUBLIC_SITE_URL` | `https://votre-domaine.vercel.app` | URL du projet Vercel |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | Supabase Dashboard → Project Settings → API → service_role |
| `CRON_SECRET` | chaîne aléatoire forte | Générer avec `openssl rand -base64 32` |
| `F1_SEASON` | `2025` (ou année en cours) | Manuel — à mettre à jour chaque saison |

> **`SUPABASE_SECRET_KEY` bypasse le RLS.** Ne jamais la préfixer `NEXT_PUBLIC_` ni l'exposer côté client.

---

## Premier déploiement

1. Pusher la branche `main` sur GitHub (déjà fait si le repo existe).
2. Importer le projet sur [vercel.com](https://vercel.com) → New Project → sélectionner le repo.
3. Renseigner toutes les variables ci-dessus dans l'écran de configuration avant de cliquer Deploy.
4. Vérifier que la migration Supabase est bien appliquée (toutes les tables existent).
5. Tester les routes cron manuellement (voir section **Test manuel** ci-dessous).

---

## Crons Vercel Hobby (filet de sécurité, 1×/jour)

### Ce que fait `vercel.json`

```json
{
  "crons": [
    { "path": "/api/f1/sync",        "schedule": "0 23 * * *"  },
    { "path": "/api/scores/trigger", "schedule": "30 23 * * *" }
  ]
}
```

- **23:00 UTC** — synchronise le calendrier F1 et les résultats de sessions du jour.
- **23:30 UTC** — déclenche le scoring (calcule les points, résout les items).

Les deux s'enchaînent : sync d'abord, trigger ensuite. Si Jolpica n'a pas encore publié les résultats à 23:00, le trigger de 23:30 détectera l'absence et ne fera rien — les données arriveront lors du prochain appel (cron-job.org le lendemain, ou trigger manuel).

### Limitations du plan Hobby

- Maximum **2 jobs** par projet.
- Fréquence minimale : **1×/jour** (pas de toutes-les-10-min sur Hobby).
- Délai potentiel : jusqu'à 24h avant qu'un résultat soit scoré.
- C'est pour ça que cron-job.org est le système **primaire** (voir ci-dessous).

### Authentification Vercel → route

Vercel déclenche ses cron jobs avec une requête **GET** et injecte automatiquement `Authorization: Bearer <CRON_SECRET>`, à condition que `CRON_SECRET` soit défini comme variable d'environnement dans le projet. Les deux routes exportent un handler `GET` **et** `POST` (cron-job.org et les exemples curl ci-dessous utilisent POST) ; `isCronAuthorized()` accepte aussi bien le header Bearer que `x-cron-secret`.

> Sans `CRON_SECRET` défini sur Vercel, toutes les requêtes cron retournent 401 et sont ignorées silencieusement par Vercel (pas d'alerte). **Vérifier que la variable est bien configurée.**

> Le `maxDuration` des deux routes est porté à 60 s dans `vercel.json` (la valeur par défaut Hobby ~10 s est trop courte pour `/api/f1/sync`, qui enchaîne plusieurs appels Jolpica/OpenF1 sur tout le calendrier).

---

## Crons cron-job.org (primaire, toutes les 10 min)

cron-job.org permet des jobs gratuits illimités avec fréquence jusqu'à toutes les 5 min. On l'utilise pour réduire le délai de scoring à ~10-20 min après chaque session.

### Créer un compte

→ [cron-job.org](https://cron-job.org) → Sign up (gratuit).

### Jobs à créer

Créer **4 jobs** (2 routes × 2 fenêtres temporelles).

#### Job 1 — Sync qualifications (samedi)

| Champ | Valeur |
|---|---|
| URL | `https://votre-domaine.vercel.app/api/f1/sync` |
| Méthode | POST |
| Header | `x-cron-secret: <votre CRON_SECRET>` |
| Schedule | Toutes les 10 min |
| Jours | Samedi uniquement |
| Heures | 14:00 → 17:30 UTC |

#### Job 2 — Trigger scoring qualifications (samedi)

| Champ | Valeur |
|---|---|
| URL | `https://votre-domaine.vercel.app/api/scores/trigger` |
| Méthode | POST |
| Header | `x-cron-secret: <votre CRON_SECRET>` |
| Schedule | Toutes les 10 min |
| Jours | Samedi uniquement |
| Heures | 14:10 → 17:30 UTC (décalé de 10 min par rapport au sync) |

#### Job 3 — Sync course (dimanche)

| Champ | Valeur |
|---|---|
| URL | `https://votre-domaine.vercel.app/api/f1/sync` |
| Méthode | POST |
| Header | `x-cron-secret: <votre CRON_SECRET>` |
| Schedule | Toutes les 10 min |
| Jours | Dimanche uniquement |
| Heures | 14:00 → 18:00 UTC |

#### Job 4 — Trigger scoring course (dimanche)

| Champ | Valeur |
|---|---|
| URL | `https://votre-domaine.vercel.app/api/scores/trigger` |
| Méthode | POST |
| Header | `x-cron-secret: <votre CRON_SECRET>` |
| Schedule | Toutes les 10 min |
| Jours | Dimanche uniquement |
| Heures | 14:10 → 18:00 UTC |

### Semaines sprint

Pour les week-ends avec sprint race (environ 6 par saison), ajouter 2 jobs supplémentaires sur le modèle ci-dessus :
- **Vendredi 11:00–14:00 UTC** — sync + trigger (sprint qualifying)
- **Samedi 10:00–13:00 UTC** — sync + trigger (sprint race)

Ces jobs peuvent être activés/désactivés manuellement sur cron-job.org selon le calendrier.

### Pourquoi décaler sync et trigger ?

`/api/f1/sync` récupère et stocke les résultats depuis Jolpica. `/api/scores/trigger` calcule les scores à partir de ce qui est en base. Si les deux tournent en même temps, le trigger pourrait scorer des données incomplètes. Le décalage de 10 min garantit que sync termine avant trigger.

---

## Ce que font les trois routes

### `POST /api/f1/sync`

1. Récupère depuis Jolpica : calendrier, pilotes, constructeurs, résultats de toutes les sessions passées non confirmées.
2. Fait des upserts en base : `grands_prix`, `drivers`, `constructors`, `sessions`, `session_results`.
3. Marque une session `results_confirmed_at = now()` quand les résultats sont disponibles et stockés.

**Idempotent** : peut être appelé N fois sans effet de bord.

### `POST /api/scores/trigger`

**Phase 1 — Base scores** : pour chaque session confirmée non encore scorée (par ligue), calcule les points de position + fastest lap pour chaque joueur et stocke dans `base_scores`.

**Phase 2 — Items** : pour chaque GP dont toutes les sessions sont scorées mais les items non résolus, applique les effets (`applyItemEffects`), met à jour `final_scores`, marque les items `effect_applied`, pose `scoring_finalized_at` sur le GP.

**Idempotent** : les UPSERT et les checks `IS NULL` sur `results_confirmed_at` / `scoring_finalized_at` rendent chaque appel safe.

### `POST /api/scores/season`

Calcule les scores WDC/WCC de fin de saison pour tous les membres de toutes les ligues actives.

1. Récupère les classements officiels WDC et WCC depuis Jolpica (`/driverStandings`, `/constructorStandings`).
2. Récupère toutes les prédictions saison des utilisateurs (`season_predictions`).
3. Pour chaque ligue et chaque membre : applique `computeSeasonScore` (barème Δ=0→8, Δ=1→3, Δ=2→1, bonus podium +15).
4. Upsert dans `season_scores` — le total s'ajoute automatiquement au classement de la ligue.

**À déclencher manuellement une seule fois**, après publication des résultats officiels WDC/WCC en fin de saison (généralement le lendemain du dernier GP).

**Idempotent** : peut être rappelé sans effet de bord (UPSERT sur `user_id, league_id, season`).

Retourne : `{ "leaguesScored": 3, "totalWdcPredictions": 18, "totalWccPredictions": 15 }` (compteurs de prédictions globaux, toutes ligues confondues).

Renvoie `503` si les classements officiels sont indisponibles (mauvaise année, saison non terminée, incident Jolpica) — évite d'écraser `season_scores` avec des zéros.

---

## Test manuel

Pour déclencher les routes sans attendre le cron :

```bash
# Sync F1 (calendrier + résultats)
curl -X POST https://votre-domaine.vercel.app/api/f1/sync \
  -H "x-cron-secret: <CRON_SECRET>"

# Trigger scoring GP
curl -X POST https://votre-domaine.vercel.app/api/scores/trigger \
  -H "x-cron-secret: <CRON_SECRET>"

# Scoring saison WDC/WCC (une seule fois en fin de saison)
curl -X POST https://votre-domaine.vercel.app/api/scores/season \
  -H "x-cron-secret: <CRON_SECRET>"
```

En local (dev) :

```bash
# Ajouter CRON_SECRET dans .env.local, puis :
curl -X POST http://localhost:3000/api/f1/sync \
  -H "x-cron-secret: <valeur depuis .env.local>"
```

Les routes retournent un JSON avec le nombre d'opérations effectuées :
- Sync : `{ "gps": 24, "sessionsConfirmed": 2 }`
- Trigger : `{ "sessionsScored": 1, "gpsFinalized": 0 }`
- Season : `{ "leaguesScored": 3, "totalWdcPredictions": 18, "totalWccPredictions": 15 }`

---

## Cycle de vie d'un week-end GP

```
Jeudi                  → rien (pas de session scorée)
Vendredi (sprint WE)   → sync détecte sprint_qualifying → trigger score sprint_qualifying
Samedi                 → sync confirme qualifying results → trigger score qualifying (base_scores)
                         (sprint WE) → sync confirme sprint_race → trigger score sprint_race
Dimanche               → sync confirme race results → trigger score race (base_scores)
                       → toutes les sessions du GP scorées → Phase 2 : items résolus
                       → scoring_finalized_at posé → UI bascule en mode "définitif"
```

---

## Checklist de mise en prod

- [ ] Variables d'environnement renseignées sur Vercel
- [ ] `CRON_SECRET` identique sur Vercel ET dans la config cron-job.org
- [ ] Migration Supabase à jour (`supabase db push` ou appliquer les fichiers dans `supabase/migrations/`)
- [ ] Test manuel des deux routes via curl → réponse 200 avec JSON attendu
- [ ] 4 jobs cron-job.org créés (+ 2 optionnels pour semaines sprint)
- [ ] Vérifier les logs Vercel après le premier GP pour confirmer le bon déroulement
