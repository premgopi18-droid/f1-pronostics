# Déploiement & configuration des crons

Guide opérationnel pour déployer l'application et configurer les tâches planifiées.

---

## Mise en place des notifications Web Push

### Qu'est-ce que VAPID ?

VAPID (Voluntary Application Server Identification) est un standard W3C — une paire de clés cryptographiques générée une fois qui prouve au navigateur que les notifications viennent bien de ton serveur. Aucun service tiers, aucun coût, les données passent directement de ton serveur Vercel au navigateur de l'utilisateur.

Comparaison des alternatives :

| Option | Coût | Tiers | Adapté PWA | Migration future |
|---|---|---|---|---|
| **Web Push + VAPID** (notre choix) | Gratuit | Aucun | ✅ | Ajouter FCM/APNs en parallèle si app native |
| Firebase Cloud Messaging | Gratuit | Google | ✅ | Dépendance Google |
| OneSignal / Pusher Beams | Freemium | Leurs serveurs | ✅ | Données chez eux |

Si on ajoute une app native Expo plus tard, on ajoute FCM/APNs *en complément* — le code Web Push actuel reste intact.

### Étapes pour activer les notifications (à faire une seule fois)

#### Étape 1 — Générer les clés VAPID

```bash
npx web-push generate-vapid-keys
```

Sortie :
```
Public Key:  Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
Private Key: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

> Ces clés ne changent jamais (ou alors tous les abonnés doivent se réabonner). Les noter dans un endroit sûr.

#### Étape 2 — Configurer les variables d'environnement

Dans `.env.local` (dev local) :

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=Bxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_PRIVATE_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VAPID_SUBJECT=mailto:ton-email@example.com
```

Sur Vercel (prod) : Settings → Environment Variables → ajouter les 3 variables ci-dessus.

> `VAPID_SUBJECT` : un email ou une URL qui identifie le serveur push. En cas de problème, les services push peuvent contacter à cette adresse. N'a pas besoin d'être fonctionnel.

> `NEXT_PUBLIC_VAPID_PUBLIC_KEY` est envoyée au navigateur (normale). `VAPID_PRIVATE_KEY` ne doit **jamais** être exposée côté client.

#### Étape 3 — Vérifier la migration Supabase

S'assurer que ces colonnes existent sur `grands_prix` :
- `notified_open_at TIMESTAMPTZ` — pose NULL, mis à jour lors de l'envoi
- `notified_scores_at TIMESTAMPTZ` — idem

Et que `push_subscriptions` a une contrainte `UNIQUE (endpoint)`.

Ces changements sont définis dans la migration `supabase/migrations/20260617160000_push_notifications.sql` (PR #15) — idempotente. L'appliquer (`supabase db push`) puis vérifier via Supabase Dashboard → Table Editor.

#### Étape 4 — Déployer sur Vercel (HTTPS obligatoire)

Le navigateur refuse d'activer le Push API sur HTTP. En local, les notifications ne fonctionneront pas sauf via ngrok ou similaire. Tester directement sur une Vercel preview URL.

#### Étape 5 — Tester l'abonnement

1. Ouvrir l'app sur la preview URL Vercel.
2. Cliquer "Activer les notifications" sur la home.
3. Autoriser dans la popup navigateur.
4. Vérifier dans Supabase Dashboard → Table `push_subscriptions` qu'une ligne apparaît.

#### Étape 6 — Tester un envoi manuel

```bash
# Déclenche la notif "résultats disponibles" si un GP est finalisé sans notif
curl -X POST https://votre-domaine.vercel.app/api/scores/trigger \
  -H "x-cron-secret: <CRON_SECRET>"

# Déclenche la notif "pronostics ouverts" si un GP démarre dans < 48h
curl -X POST https://votre-domaine.vercel.app/api/f1/sync \
  -H "x-cron-secret: <CRON_SECRET>"
```

Vérifier les colonnes `notified_open_at` / `notified_scores_at` dans Supabase pour confirmer l'envoi.

#### Envoi de test à la demande (`/api/dev/test-push`)

Pour vérifier la livraison Web Push **immédiatement**, sans dépendre des crons ni de la dédup (ces déclencheurs ne repartent pas une fois leur flag posé) :

```bash
# Push de test à TOUS les abonnements
curl -H "x-cron-secret: <CRON_SECRET>" https://votre-domaine.vercel.app/api/dev/test-push

# Cibler un seul utilisateur (éviter de notifier les autres)
curl -H "x-cron-secret: <CRON_SECRET>" \
  "https://votre-domaine.vercel.app/api/dev/test-push?userId=<uuid>"
```

La réponse JSON renvoie `subscriptionsTargeted` (0 ⇒ personne d'abonné) et le `payload` envoyé. Contrairement aux autres routes `/api/dev/*`, celle-ci **fonctionne en production** (c'est là que VAPID et les abonnements existent) ; elle reste protégée par `CRON_SECRET`. Sans clés VAPID, elle renvoie un `503` explicite plutôt qu'un no-op silencieux.

### Comportement si les clés VAPID ne sont pas configurées

`sendPushToAll()` détecte l'absence de clés et **skip silencieusement** sans crasher. Les crons continuent de fonctionner normalement — les notifications sont juste désactivées. Pas de 500, pas d'alerte.

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
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | clé publique VAPID | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | clé privée VAPID | idem (ne jamais exposer côté client) |
| `VAPID_SUBJECT` | `mailto:admin@boxbox.app` | Identifiant du serveur push (email ou URL) |

> **`SUPABASE_SECRET_KEY` bypasse le RLS.** Ne jamais la préfixer `NEXT_PUBLIC_` ni l'exposer côté client.

---

## Premier déploiement

1. Pusher la branche `main` sur GitHub (déjà fait si le repo existe).
2. Importer le projet sur [vercel.com](https://vercel.com) → New Project → sélectionner le repo.
3. Renseigner toutes les variables ci-dessus dans l'écran de configuration avant de cliquer Deploy.
4. Vérifier que la migration Supabase est bien appliquée (toutes les tables existent).
5. Générer les clés VAPID si pas encore fait : `npx web-push generate-vapid-keys` — copier les deux valeurs dans Vercel + `.env.local`.
6. Tester les routes cron manuellement (voir section **Test manuel** ci-dessous).

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

### Sync des essais libres (EL1/EL2/EL3) — **toutes les 10 min**

Les résultats d'essais libres (informatifs, non scorés — cf. specs §3.3) proviennent d'OpenF1. Décision : **toute la sync tourne à 10 min**, EL incluses (pas de cadence dégradée). Ajouter des fenêtres `/api/f1/sync` couvrant les séances d'EL :
- **Vendredi ~matin/midi UTC** — EL1 puis EL2 (horaires variables selon le fuseau du circuit ; se caler sur `FirstPractice`/`SecondPractice` du calendrier Jolpica)
- **Samedi matin UTC** — EL3 (week-end classique uniquement)

Les EL n'ont pas besoin de `/api/scores/trigger` (rien à scorer).

### Notif « Session imminente » (10 min avant) — couverture cron

Cette notif (cf. specs §3.6) est émise par `/api/f1/sync` quand une session démarre dans ≤ 10 min. Elle n'est envoyée **que si le cron tourne dans la fenêtre `[T-10min, T]`** de chaque session concernée. Conséquence opérationnelle : les fenêtres `/api/f1/sync` ci-dessus doivent **commencer suffisamment tôt** pour couvrir le T-10 de la **première** session de chaque jour (y compris EL1 le vendredi). Avec un cron à 10 min, élargir la borne basse de chaque fenêtre de ~15 min avant la première session du jour.

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
