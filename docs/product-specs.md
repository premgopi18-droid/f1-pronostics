# Spécifications Produit — Application de Pronostics F1

> Version : 0.1 — Brouillon initial
> Dernière mise à jour : Juin 2026
> Auteurs : à compléter

---

## 1. Vue d'ensemble

### Description

Application web (PWA) de pronostics Formula 1 entre amis. Les utilisateurs rejoignent des ligues privées, soumettent leurs pronostics avant chaque week-end de Grand Prix et s'affrontent via un système de points. Un système d'items stratégiques permet d'interagir avec les autres joueurs de la ligue.

### Philosophie produit

- **Simple à prendre en main** — un ami doit pouvoir rejoindre une ligue et soumettre son premier pronostic en moins de 3 minutes
- **Mobile-first** — l'essentiel de l'usage se fait sur téléphone, autour des week-ends de course
- **Stratégique** — les items ajoutent une couche de jeu au-delà du simple pronostic
- **Accessible** — pas d'installation requise, partage via lien URL

---

## 2. Utilisateurs cibles

- Fans de Formule 1 souhaitant animer leur groupe d'amis autour des courses
- Groupes de 3 à 20 personnes
- Usage principalement mobile, autour des week-ends de Grand Prix

---

## 3. Fonctionnalités principales

### 3.1 Authentification & Profil

- Connexion via Google OAuth uniquement (v1 — décision juin 2026)
- Email/password et Apple Sign In ajoutables facilement via Supabase Auth si besoin ultérieur
- Profil utilisateur : pseudo, avatar
- Historique personnel des pronostics et scores
- **Pseudo** : modifiable (sous réserve de disponibilité)
- **Email** : non modifiable après inscription
- **Avatar** : choix parmi une sélection d'avatars prédéfinis (v1) — upload d'image personnalisée en v2
- **Suppression de compte** : possible à tout moment (conformité RGPD). Si une ligue est en cours : le joueur apparaît anonymisé avec un état visuel "compte supprimé" (pseudo grisé ou marqueur distinct), trié en dernier dans le classement. Ses scores passés sont conservés anonymisés pour l'intégrité du classement.

### 3.2 Ligues

- Création d'une ligue privée avec nom personnalisé
- Invitation de membres via lien unique
- Un utilisateur peut appartenir à plusieurs ligues

#### Périmètre multi-ligue

| Élément | Portée | Raison |
|---|---|---|
| **Prédictions** | Globale — une prédiction par session, scorée dans toutes les ligues | On prénostique la course une fois, pas une fois par ligue |
| **Items** | Par ligue par saison — 1 exemplaire de chaque item par ligue | Les items ciblent des membres d'une ligue spécifique |
| **Scores** | Par ligue — chaque ligue a son propre classement | Chaque ligue est une compétition indépendante |
- Classement général de la ligue sur la saison (cumulatif)
- Score du week-end : affichage des points marqués par chaque membre sur le GP (informatif, pas un classement formel)

#### Rôles & administration

- Le créateur de la ligue est automatiquement **admin**
- L'admin peut **régénérer le lien d'invitation** ou **fermer les inscriptions** (toggle ouvert/fermé) pour empêcher de nouveaux membres de rejoindre
- L'admin ne peut pas exclure un membre — si besoin, l'alternative est de créer une nouvelle ligue
- L'admin définit le **nombre maximum de membres** à la création (entre 3 et 20)
- **Hard cap absolu : 20 joueurs** — cohérent avec le groupe d'amis visé et le nombre de pilotes sur la grille
- L'admin peut **nommer un autre membre admin** à tout moment (transfert de rôle)

#### Quitter une ligue (v1)

- **En cours de saison** : impossible de quitter ou de supprimer une ligue — la saison doit aller à son terme

### 3.3 Pronostics

#### Week-end classique (3 pronostics)

| Pronostic | Description | Verrouillage |
|---|---|---|
| Top 10 Qualifications | Ordre exact des 10 premiers (Q1/Q2/Q3) | Début des qualifications (Q1) |
| Top 10 Course | Ordre exact des 10 premiers | Départ de la course |
| Meilleur tour en course | 1 pilote parmi les 20 | Départ de la course |

#### Week-end sprint (5 pronostics)

Format 2026 : Sprint Qualifying (vendredi) → Sprint Race (samedi matin) → Qualifications GP (samedi après-midi) → Course (dimanche).

| Pronostic | Description | Verrouillage |
|---|---|---|
| Top 10 Sprint Qualifying | Ordre exact des 10 premiers | Début de la Sprint Qualifying (vendredi) |
| Top 8 Sprint Race | Ordre exact des 8 premiers (seuls les top 8 marquent des points en sprint) | Départ du Sprint (samedi matin) |
| Top 10 Qualifications | Ordre exact des 10 premiers (Q1/Q2/Q3) | Début des qualifications GP (samedi après-midi) |
| Top 10 Course | Ordre exact des 10 premiers | Départ de la course (dimanche) |
| Meilleur tour en course | 1 pilote parmi les 20 | Départ de la course (dimanche) |

**Règle générale** : chaque pronostic peut être modifié librement jusqu'au début de la session correspondante. Le verrouillage est par session, pas par week-end.

**Fuseaux horaires** : toutes les heures de session sont stockées en UTC en base de données et converties en heure locale de l'utilisateur dans l'UI. Les deadlines, comptes à rebours et notifications respectent le fuseau horaire de l'appareil.

**Visibilité des pronostics** : les pronostics des autres membres de la ligue sont invisibles jusqu'au verrouillage de la session. Une fois verrouillés, ils deviennent visibles par tous les membres. Raison : autoriser la lecture avant le verrou donnerait un avantage informationnel injuste puisque les pronostics sont encore modifiables.

**Résultats F1 pendant le weekend** : les résultats officiels des sessions (qualifications, sprints) sont affichés dans l'app dès leur confirmation par Jolpica — les utilisateurs s'en servent pour ajuster leurs pronostics de course jusqu'au dimanche.

**Visibilité des scores pendant le weekend (Option B)** : les scores de prédiction sont affichés session par session au fil du weekend, mais marqués **"provisoire"** jusqu'à la fin de la course. Les items sont résolus uniquement après la course du dimanche — le score définitif (avec items) est révélé à ce moment-là. Un indicateur visuel clair distingue "score provisoire" et "score définitif". Exemple : un joueur voit "22 pts en qualif (provisoire)" le samedi — un Wild Card peut réduire ce score dimanche.

> Raison : afficher les scores progressifs crée de l'engagement tout le weekend et permet aux joueurs de situer leur position avant la course. La révélation des items reste un moment fort du dimanche.

#### Sur la saison (modifiable jusqu'aux qualifications du premier GP)

| Pronostic | Description | Verrouillage |
|---|---|---|
| Classement pilotes (WDC) | Ordre du top 10 pilotes en fin de saison (sur 22) | Début des qualifications du premier GP de la saison |
| Classement constructeurs (WCC) | Ordre complet des 11 écuries en fin de saison | Début des qualifications du premier GP de la saison |

### 3.4 Système de scoring

Système **Option B** retenu — exact + crédit partiel. Valeurs des points ajustables, structure verrouillée.

#### Barème qualifications principales et course (inchangé)

| Résultat | Points |
|---|---|
| Position exacte | 5 pts |
| Écart de ±1 position | 2 pts |
| Écart de ±2 positions | 1 pt |
| Écart > 2 ou pilote absent du classement | 0 pt |

#### Barème Sprint Qualifying et Sprint Race (réduit)

Sessions secondaires — barème volontairement plus faible pour refléter leur poids moindre.

| Résultat | Points |
|---|---|
| Position exacte | 3 pts |
| Écart de ±1 position | 1 pt |
| Tout le reste | 0 pt |

#### Bonus course uniquement

| Bonus | Points |
|---|---|
| Meilleur tour en course correct | +1 pt |

> Pas de bonus pole position — déjà récompensée par le score exact de P1 en qualifications.

#### Pronostics saison — WDC (top 10 pilotes) et WCC (11 écuries) — attribués en fin de saison

Même barème pour WDC et WCC :

| Résultat | Points |
|---|---|
| Position exacte | 8 pts |
| Écart de ±1 position | 3 pts |
| Écart de ±2 positions | 1 pt |
| Écart > 2 | 0 pt |

**Bonus podium** : si les positions P1, P2 et P3 sont toutes les trois exactes → +15 pts supplémentaires (applicable indépendamment pour WDC et WCC).

#### Pondération qualifications vs course

Même barème pour les qualifications et la course — l'effort de prédiction est équivalent.

#### Gestion des saisons

**V1 : reset annuel** — scores, classements et items repartent à zéro à chaque saison.

**Passage à une nouvelle saison (report automatique)** : la ligue est une entité persistante. Au démarrage d'une nouvelle saison, chaque ligue existante reconduit automatiquement ses membres — un job crée de nouvelles lignes `league_members` pour la nouvelle saison (admin conservé) et réinitialise le stock d'items (`user_items` : 1 par item, 3 pour le bouclier). Les données des saisons passées (scores, pronostics, items joués) ne sont jamais écrasées. Aucune action requise des joueurs.

**Objectif long terme : cumul multi-saisons** avec palmarès par ligue, historique des pronostics, stats personnelles sur plusieurs saisons. Le schéma de données doit anticiper cela dès le départ (colonne `season` sur toutes les tables concernées, jamais d'écrasement de données passées) même si l'UI v1 n'expose que la saison en cours.

#### Pronostic non soumis ou incomplet

- Chaque session est indépendante — oublier les qualifications n'empêche pas de soumettre pour la course
- Un top 10 incomplet (moins de 10 positions remplies) est **invalide** — traité comme une non-soumission
- Score = **0 point** pour la session concernée
- Un statut spécifique est affiché dans le classement pour signaler la non-participation (libellé humoristique à définir dans l'UI)

#### Changements de pilotes / écuries en cours de saison

- **Listes de pilotes pour les pronostics GP** : synchronisées depuis Jolpica avant chaque session — les remplaçants apparaissent automatiquement, aucun impact utilisateur
- **Pronostics saison WDC/WCC** : scorés contre le classement officiel final en fin de saison, quels que soient les changements de line-up en cours d'année
- **Item joué sur un pilote qui ne prend finalement pas le départ** : l'item est **consommé sans effet** (cas rarissime en F1) + notification envoyée à l'utilisateur pour l'informer

#### Annulation ou report d'un GP

- **GP reporté** : les pronostics soumis restent valides et éditables jusqu'au début des sessions à la nouvelle date (règle de verrouillage habituelle)
- **GP annulé** : les pronostics sont annulés (rien à scorer) et les items joués sur ce GP sont **restitués** à l'utilisateur
- **Exception** : si le GP annulé est le dernier de la saison, les items ne sont pas restitués (fin de saison — inutile)
- Cas rarissime en F1, mais la règle est posée pour éviter toute ambiguïté

#### Cas particuliers (DNF, voiture de sécurité, drapeaux rouges)

Le résultat officiel FIA (via Jolpica API) fait foi, sans ajustement. Les abandons et perturbations de course font partie du jeu. À reconsidérer si les retours joueurs montrent que c'est trop frustrant.

#### Départage (égalité de points en fin de saison)

1. Plus grand nombre de positions exactes sur la saison

> Tiebreaker #2 (tête-à-tête dernière course) non retenu pour l'instant — cas trop improbable en pratique.

### 3.5 Système d'items

Les items sont des actions stratégiques qu'un utilisateur peut jouer contre (ou pour se protéger de) d'autres membres de sa ligue.

#### Règles générales

- Chaque utilisateur reçoit **1 exemplaire de chaque item par ligue par saison** (règle par défaut pour tout nouvel item, offensif ou non)
- Exception : le **bouclier est utilisable 3 fois par ligue par saison**
- Maximum **1 item joué par ligue par week-end de GP** par utilisateur (chaque ligue est indépendante — un joueur dans plusieurs ligues peut agir dans chacune)
- Plusieurs utilisateurs peuvent cibler le même utilisateur sur un même week-end (1 item par attaquant)
- **Deadline items GP** : tout item GP (offensif ou défensif) doit être joué avant le début des qualifications (Q1) — ou avant la Sprint Qualifying sur les week-ends sprint. Même verrouillage que les pronostics de première session.
- **Items saison** (Coup de clé à molette, Boost turbo) : ne consomment PAS le slot hebdomadaire — ils ont leur propre deadline (avant le dernier GP). Un joueur peut jouer un item GP ET un item saison sur le même week-end.

#### Items disponibles

##### Items de base

| Item | Type | Utilisations/saison | Effet |
|---|---|---|---|
| **Bloquer un pilote** | Offensif | 1 | L'utilisateur choisit un pilote ET une session (Sprint Qualifying, Sprint Race, Qualifications ou Course). Ce pilote ne rapporte aucun point de **position** à l'utilisateur visé pour cette session. Le bonus meilleur tour (prédiction séparée) n'est pas affecté. Impossible de couvrir plusieurs sessions avec un seul item. En pratique, cibler une session sprint est peu intéressant vu le barème réduit. |
| **Bouclier** | Défensif | 3 | Annule tous les items offensifs reçus pour ce week-end de GP |

##### Bonus de prédiction (points si pronostic correct)

| Item | Utilisations/saison | Effet | Points |
|---|---|---|---|
| **On va trancher dans le vif !** | 1 | Choisir un pilote qui ne finira pas la course (DNF). Vérifié sur résultat officiel. DNS (pilote qui n'a pas pris le départ) ne compte pas — item wasted. | +8 pts |
| **Il est de retour !** | 1 | Choisir un pilote dont la position en grille (qualifications) est > 10, et qui finira dans le top 5 de la course. Si le pilote n'a pas de position en qualif (pit lane start, DNS qualif) → éligible par défaut. | +8 pts |
| **"It must be the water !"** | 1 | Choisir une écurie dont les 2 pilotes ne marquent aucun point en course | +12 pts |
| **Move de la FIA** ⚠️ | 1 | Choisir un pilote qui recevra une pénalité en course — vérifié via OpenF1 race control messages | +10 pts |

> ⚠️ **Move de la FIA** — *Nice to have*. Faisable via les messages race control OpenF1, mais nécessite du parsing de texte (pas une donnée structurée). À implémenter uniquement si une source propre et fiable est trouvée.

##### Modificateurs de score

| Item | Type | Utilisations/saison | Effet |
|---|---|---|---|
| **Dernier tour de magie** | Personnel | 1 | Double les points de ta course OU de tes qualifications pour un GP (au choix) |
| **Wild Card** | Offensif | 1 | Transfère la moitié des points d'un adversaire (sur sa course ou ses qualifications) vers son propre score — vol réel (`floor(points / 2)`, arrondi à l'entier inférieur), pas suppression |

##### Modificateurs de pronostic saison (utilisables avant le dernier GP)

| Item | Utilisations/saison | Effet |
|---|---|---|
| **Coup de clé à molette** | 1 | Extraire 1 pilote de sa position actuelle dans ton pronostic WDC et le réinsérer à une nouvelle position — les autres se décalent (pull & shift, pas swap) |
| **Boost turbo** | 1 | Extraire 1 écurie de sa position actuelle dans ton pronostic WCC et la réinsérer à une nouvelle position — les autres se décalent (pull & shift, pas swap) |

#### Résolution des items

Ordre strict d'application pour chaque GP :

1. **Collecte** — tous les items joués pour ce GP sont rassemblés
2. **Boucliers** — annulation de tous les items offensifs entrants pour les joueurs protégés
3. **Bloquer un pilote** — le pilote ciblé est mis à 0 pts pour la session visée dans le score de la victime
4. **Wild Card** — la moitié des points de la session ciblée est **transférée** de la victime à l'attaquant (vol réel, pas suppression). Montant volé = `floor(points / 2)`, appliqué symétriquement : la victime perd ce montant, l'attaquant le gagne (ex: 17 pts → vol de 8 ; victime garde 9, attaquant reçoit 8). Conséquence : **tous les scores restent entiers** — aucune demi-unité possible
5. **Dernier tour de magie** — ×2 appliqué en dernier sur le score résultant du joueur
6. **Score final** calculé et enregistré

> **Ordre** : le Wild Card vole sur le score déjà réduit par le bloc éventuel. Le Dernier tour de magie s'applique toujours en dernier.
>
> **Wild Cards simultanés** : si plusieurs joueurs se volent mutuellement sur le même GP, chaque vol est calculé sur le score original de la victime (avant que celle-ci n'ait encaissé ses propres gains). Résolution en parallèle, pas en cascade.
>
> **Interaction Wild Card + Dernier tour de magie** : si une victime joue ×2 sur une session et se fait voler dessus, l'ordre steal-then-double la remet quasi entière (elle double ce qui lui reste), mais l'attaquant conserve quand même sa moitié volée. Comportement intentionnel — légèrement favorable à la victime, et amusant.

> Le bouclier se joue **en aveugle** — avant de savoir si on est ciblé. Les attaques ne sont révélées qu'après la course, en même temps que les résultats. Le bouclier peut donc échouer si personne ne t'a ciblé — c'est une part du jeu.

### 3.6 Notifications

Les notifications sont envoyées via Web Push (standard ouvert, compatible iOS 16.4+ et Android).

| Notification | Déclencheur |
|---|---|
| Week-end de GP approche | J-2 avant `grands_prix.weekend_starts_at` (heure FP1, fournie par Jolpica) |
| Deadline pronostic qualifications | 1h avant le début des qualifications |
| Deadline pronostic course | 1h avant le départ |
| Scores provisoires disponibles | Après chaque session (qualif, sprint) — scores de base sans items |
| Résultats définitifs publiés | Après la course du dimanche — scores finaux avec items résolus |
| Item joué contre vous | Après la course, en même temps que les résultats définitifs — surprise révélée avec les scores |
| Classement mis à jour | Après chaque calcul de score (provisoire ou définitif) |

---

## 4. Données F1

Stratégie double API — sources complémentaires, toutes deux gratuites et sans authentification requise.

| API | Rôle | Quand |
|---|---|---|
| **Jolpica API** (successeur d'Ergast) | Calendrier, résultats officiels finaux, pilotes, écuries | Source principale — déclenche le calcul des scores |
| **OpenF1 API** | Résultats préliminaires en temps réel pendant/juste après une session | Fallback pour afficher les résultats plus rapidement avant confirmation officielle |

- Synchronisation automatique du calendrier en début de saison (Jolpica)
- Mise à jour des résultats après chaque session (Jolpica en source principale, OpenF1 en fallback rapide)
- Déclenchement automatique du calcul des scores après résultats officiels Jolpica

---

## 5. Stack technique (résumé)

| Composant | Technologie | Licence |
|---|---|---|
| Frontend | Next.js App Router + Tailwind CSS + shadcn/ui | MIT |
| Backend API | Next.js Route Handlers (dans le même projet) | MIT |
| Tâches planifiées | Cron externe gratuit (cron-job.org) toutes les 10 min — automatique. Trigger manuel admin en backup. Vercel Hobby cron 1×/jour en filet de sécurité | — |
| Base de données | PostgreSQL (via Supabase) | Apache 2.0 |
| Authentification | Supabase Auth | Apache 2.0 |
| Temps réel | Supabase Realtime | Apache 2.0 |
| Notifications push | Web Push API | Standard ouvert |
| Hébergement | Vercel | — |
| Données F1 | Jolpica API (principal) + OpenF1 API (fallback) | Open |

> **Philosophie portabilité** : Supabase = couche données uniquement (PostgreSQL standard + Auth + Realtime). Toute la logique métier est dans Next.js — déplaçable sur n'importe quel hébergeur Node.js. Pas de lock-in sur les Edge Functions Supabase.

> **Décision (juin 2026) — deux clients Supabase, frontière de sécurité.** La couche `/lib/data/` est appelée par le cron (scoring + sync F1) sans utilisateur connecté ; elle utilise donc un client **service-role** (`createServiceClient()`, clé `SUPABASE_SECRET_KEY`) qui **bypasse le RLS** pour lire/écrire les données de tous les joueurs. Toute lecture/écriture **déclenchée par une action utilisateur** (soumettre/voir ses pronos, afficher les pronos de la ligue après deadline, leaderboard à l'écran) passe au contraire par le client **cookie/RLS** (`createClient()`) et **jamais** par `/lib/data/`, pour que les policies (secret des pronos avant deadline, restriction co-membre de ligue) s'appliquent. Détail dans [architecture.md](architecture.md) (« Frontière des clients Supabase »).

### Architecture du projet Next.js

Voir [docs/architecture.md](architecture.md) pour le détail complet des couches, patterns et règles d'import.

```
/app
  /page.tsx                        → page d'accueil
  /leagues/[id]/                   → pages ligue
  /predictions/                    → formulaires de pronostics
  /leaderboard/                    → classements
  /api/
    /f1/sync/route.ts              → synchronisation calendrier + résultats Jolpica (cron)
    /scores/trigger/route.ts       → déclenchement scoring (cron 1×/heure + admin manuel)
    /predictions/route.ts
    /leagues/route.ts
    /notifications/route.ts
/components/
/lib/
  /scoring/                        → moteur de scoring PUR (zéro Supabase)
    constants.ts, types.ts, base-score.ts, resolve-items.ts, season-score.ts
  /data/                           → persistance (seul endroit qui touche Supabase)
  /f1/jolpica.ts, openf1.ts
  supabase.ts
```

---

## 6. Évolutions futures envisagées

### Suivi en direct des courses (v2)

Affichage des positions en temps réel pendant le déroulement d'un GP, permettant aux utilisateurs de suivre l'évolution de leurs pronostics en cours de course.

Architecture prévue :
- Supabase Edge Function poll OpenF1 toutes les 3 secondes pendant la session live
- Mise à jour d'une table `live_positions` dans Supabase
- Supabase Realtime diffuse les changements à tous les clients connectés

> Décision : non inclus dans la v1 — les pronostics étant verrouillés avant la course, le suivi live est un bonus et non un élément core.

### Palmarès & stats multi-saisons

Objectif explicite post-v1 : suivi cumulatif sur plusieurs saisons dans une même ligue.
- Palmarès : champion de ligue par saison, records, séries
- Historique complet des pronostics et scores
- Stats personnelles (taux de positions exactes, pilotes les mieux prédits, etc.)

> **Contrainte architecture (à respecter dès la v1)** : toutes les tables `predictions`, `scores`, `user_items`, `items_played`, `league_members` doivent avoir une colonne `season` (ex. `2026`). Ne jamais écraser les données d'une saison passée — créer de nouvelles lignes.

### Application native (iOS / Android)

Migration possible vers Expo (React Native) en réutilisant le même backend Supabase. Le frontend web et l'application native peuvent coexister simultanément.

### Assistant IA de pronostics

Un assistant basé sur Claude (Anthropic) pourrait aider les utilisateurs à affiner leurs pronostics avant chaque GP :
- Analyse des performances récentes des pilotes
- Historique de la piste
- Météo prévue
- Prise en compte des habitudes de pronostic de l'utilisateur

### Nouveaux items stratégiques

- D'autres types d'items pourront être ajoutés selon les retours des joueurs
- Le système est conçu pour être extensible sans refonte

### Commercialisation

- Le stack choisi est production-ready et scalable
- Point d'attention : vérifier la licence d'utilisation des données F1 avant toute commercialisation

---

## 7. Ce qui reste à définir (TBD)

- [x] Nom de l'application : **BoxBox** — nom affiché dans l'UI et le PWA manifest. Le projet Supabase et les noms d'infrastructure utilisent un nom générique (`f1-pronostics`) pour ne pas être couplés au nom de marque.

## 8. Points UX à traiter pendant le développement

Ces sujets ne bloquent pas le démarrage mais doivent être adressés avant le lancement :

- [ ] **Onboarding & états vides** — premier lancement sans ligue, ligue sans pronostics encore soumis, classement avant la première course. La promesse "3 minutes pour rejoindre et pronostiquer" se joue ici.
- [ ] **Transparence du scoring** — afficher le détail point par point de comment le score a été calculé (essentiel pour la confiance dans un jeu entre amis)
- [ ] **Historique des pronostics des autres** — visibilité des pronostics verrouillés passés des autres membres, pas seulement les siens
- [ ] **Statut "forfait"** — libellé humoristique à définir pour les joueurs qui n'ont pas soumis de pronostic
- [ ] **Légal** — CGU, politique de confidentialité, mention âge minimum (prévoir avant ouverture publique)
- [ ] **Unicité et modération des pseudos** — règles de validation (longueur, caractères autorisés, mots interdits)
