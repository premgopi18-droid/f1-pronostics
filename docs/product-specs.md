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
- Groupes de 2 à 20 personnes
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
- **Avatar** : choix parmi une sélection d'avatars prédéfinis (casques F1) — **upload d'image personnalisée optionnelle** (les casques restent le défaut/fallback), cf. §Avatar
- **Suppression de compte** : possible à tout moment (conformité RGPD). **L'utilisateur est immédiatement retiré de toutes ses ligues** (toutes saisons confondues) — son slot est libéré et un nouveau membre peut rejoindre. Ses scores et pronostics passés sont conservés en base (liés à l'UUID anonymisé) pour l'intégrité des calculs passés, mais il n'apparaît plus dans les classements actifs. **Anonymisation** : le pseudo est écrasé par une valeur neutre (et l'avatar retiré), et toutes les données d'authentification (email, identité Google, métadonnées OAuth) sont effacées — il n'y a pas de hard-delete du compte car les scores conservés y référencent encore. L'email d'origine est libéré : l'utilisateur peut se ré-inscrire avec la même adresse (nouveau compte, repartant de zéro) et rejoindre de nouveau les mêmes ligues sans conflit. Si le joueur supprimé était admin, le rôle est automatiquement transféré au membre le plus ancien (par date d'entrée dans la ligue) dont le compte est encore actif ; si aucun membre actif n'existe, la ligue reste sans admin actif jusqu'à la fin de saison.

### 3.2 Ligues

- Création d'une ligue privée avec nom personnalisé
- Invitation de membres via lien unique
- Un utilisateur peut appartenir à plusieurs ligues

#### Périmètre multi-ligue

| Élément | Portée | Raison |
|---|---|---|
| **Prédictions** | Globale — une prédiction par session, scorée dans toutes les ligues | On prénostique la course une fois, pas une fois par ligue |
| **Items GP** (shield, block_driver, wild_card, double_points…) | Par ligue par saison — 1 exemplaire de chaque item par ligue | Les items ciblent des membres d'une ligue spécifique |
| **Items saison** (wdc_move, wcc_move) | Globaux — 1 par user par saison, toutes ligues confondues | La prédiction saison est globale ; avoir plusieurs ligues ne doit pas donner plus d'utilisations |
| **Scores** | Par ligue — chaque ligue a son propre classement | Chaque ligue est une compétition indépendante |
- Classement général de la ligue sur la saison (cumulatif)
- Score du week-end : affichage des points marqués par chaque membre sur le GP (informatif, pas un classement formel)

#### Rôles & administration

- Le créateur de la ligue est automatiquement **admin**
- L'admin peut **régénérer le lien d'invitation** ou **fermer les inscriptions** (toggle ouvert/fermé) pour empêcher de nouveaux membres de rejoindre
- L'admin ne peut pas exclure un membre — si besoin, l'alternative est de créer une nouvelle ligue
- L'admin définit le **nombre maximum de membres** à la création (entre 2 et 20)
- **Hard cap absolu : 20 joueurs** — cohérent avec le groupe d'amis visé et le nombre de pilotes sur la grille
- L'admin peut **nommer un autre membre admin** à tout moment (transfert de rôle)

#### Quitter une ligue (v1)

- **En cours de saison** : autorisé à tout moment.
  - Les scores et pronostics passés sont **conservés** et restent dans l'historique de la ligue (intégrité des données)
  - Le joueur apparaît en "Ancien membre" grisé dans le classement — il n'est plus actif
  - Son slot est libéré — un nouveau membre peut rejoindre si les inscriptions sont ouvertes
  - **Retour** : possible via le lien d'invitation si les inscriptions sont ouvertes et une place disponible. Ses scores passés sont récupérés — pas de pénalité, pas de remise à zéro. Le retour est décidé par l'admin via le toggle inscriptions (pas de réinvitation explicite requise).
  - **Si l'admin quitte** : le rôle est automatiquement transféré au membre actif le plus ancien (par date d'entrée dans la ligue) — même règle que pour la suppression de compte.
- **Suppression d'une ligue** : non disponible en cours de saison

### 3.3 Pronostics

#### Week-end classique (3 pronostics)

| Pronostic | Description | Verrouillage |
|---|---|---|
| Top 10 Qualifications | Ordre exact des 10 premiers (Q1/Q2/Q3) | Début des qualifications (Q1) |
| Ordre complet Course | Ordre exact de toute la grille engagée (nombre de pilotes au départ — 22 en 2026) | Départ de la course |
| Meilleur tour en course | 1 pilote parmi les 22 | Départ de la course |

#### Week-end sprint (5 pronostics)

Format 2026 : Sprint Qualifying (vendredi) → Sprint Race (samedi matin) → Qualifications GP (samedi après-midi) → Course (dimanche).

| Pronostic | Description | Verrouillage |
|---|---|---|
| Top 5 Sprint Qualifying | Ordre exact des 5 premiers | Début de la Sprint Qualifying (vendredi) |
| Top 8 Sprint Race | Ordre exact des 8 premiers (seuls les top 8 marquent des points en sprint) | Départ du Sprint (samedi matin) |
| Top 10 Qualifications | Ordre exact des 10 premiers (Q1/Q2/Q3) | Début des qualifications GP (samedi après-midi) |
| Ordre complet Course | Ordre exact de toute la grille engagée (nombre de pilotes au départ — 22 en 2026) | Départ de la course (dimanche) |
| Meilleur tour en course | 1 pilote parmi les 22 | Départ de la course (dimanche) |

**Règle générale** : chaque pronostic peut être modifié librement jusqu'au début de la session correspondante. Le verrouillage est par session, pas par week-end.

**Fuseaux horaires** : toutes les heures de session sont stockées en UTC en base de données et converties en heure locale de l'utilisateur dans l'UI. Les deadlines, comptes à rebours et notifications respectent le fuseau horaire de l'appareil.

**Visibilité des pronostics** : les pronostics des autres membres de la ligue sont invisibles jusqu'au verrouillage de la session. Une fois verrouillés, ils deviennent visibles par tous les membres. Raison : autoriser la lecture avant le verrou donnerait un avantage informationnel injuste puisque les pronostics sont encore modifiables.

**Résultats F1 pendant le weekend** : les résultats officiels des sessions (qualifications, sprints) sont affichés dans l'app dès leur confirmation par Jolpica — les utilisateurs s'en servent pour ajuster leurs pronostics de course jusqu'au dimanche.

**Résultats des essais libres (informatifs, non scorés)** : les classements des trois séances d'essais libres (EL1, EL2, EL3) sont affichés dans la page résultats du GP. Objectif : aider l'utilisateur à ajuster son pronostic **Top 10 Qualifications**, qui reste modifiable jusqu'au début de la Q1 — les EL3 (samedi matin) se terminent avant ce verrou. Ces résultats sont **purement informatifs** : aucun pronostic ni score ne porte dessus.

> **Isolation des sessions EL** : les essais libres sont stockés dans la table `sessions` (types `practice_1/2/3`) mais doivent être **exclus de toutes les requêtes hors page résultats** — pronostics, scoring, items, home, vues ligue — via le filtre `.in('type', SCOREABLE_SESSION_TYPES)`. Sans ce filtre, une session EL traitée comme une session scorée fait planter le rendu (`SESSION_LABEL[type]` undefined → `t(undefined)`) et décale la deadline items sur l'EL1. Seule la page résultats lit explicitement les types EL.

> **Source de données** : Jolpica **n'expose pas** les résultats d'essais libres (seulement leurs horaires via `FirstPractice`/`SecondPractice`/`ThirdPractice`) — vérifié, l'endpoint résultats renvoie 404. La donnée provient donc du **fallback OpenF1**, qui fournit les sessions de practice et les temps au tour. Sur les week-ends sprint, seule l'EL1 précède la Sprint Qualifying (format 2026) : le bénéfice y est plus marginal.
>
> **Rapprochement de session OpenF1 — par date, pas par nom de circuit** : le `circuit_short_name` OpenF1 (« Catalunya », « Interlagos »…) ne correspond pas toujours à la locality Jolpica (« Montmeló », « São Paulo »…). On ne filtre donc plus par circuit (ça renvoyait des EL vides) : on récupère toutes les sessions OpenF1 de l'année pour le nom de séance, puis on retient celle dont la date est la plus proche de l'horaire Jolpica (fenêtre de 2 j — les GP sont espacés d'au moins ~6 j). Même mécanique pour la Sprint Qualifying.
>
> **Accès OpenF1 pendant une session live** : OpenF1 restreint désormais l'accès global (y compris à l'historique) aux utilisateurs **authentifiés** *tant qu'une session est en cours* (offre payante). Sans clé API, l'accès se rouvre dès la fin du live. Conséquence : les jours de piste, les EL ne sont pas récupérées en direct mais **backfillées au prochain créneau hors-live** par le cron (qui retente tant que le résultat est vide). Acceptable car les EL sont **informatives et non scorées** — aucune deadline n'en dépend. Une clé API OpenF1 (payante) ne serait nécessaire que si l'on voulait garantir le live.
>
> **Résilience de `/api/f1/sync`** : la confirmation de chaque session est **isolée** (try/catch par session). Un échec de source — OpenF1 bloqué pendant un live (403), réseau, etc. — est logué et la session est sautée, sans avorter le reste de la sync ni les notifications (même classe de bug que la contrainte EL de #121). Le cron retente au passage suivant.

**Visibilité des scores pendant le weekend (Option B)** : les scores de prédiction sont affichés session par session au fil du weekend, mais marqués **"provisoire"** jusqu'à la fin de la course. Les items sont résolus uniquement après la course du dimanche — le score définitif (avec items) est révélé à ce moment-là. Un indicateur visuel clair distingue "score provisoire" et "score définitif". Exemple : un joueur voit "22 pts en qualif (provisoire)" le samedi — un Wild Card peut réduire ce score dimanche.

> Raison : afficher les scores progressifs crée de l'engagement tout le weekend et permet aux joueurs de situer leur position avant la course. La révélation des items reste un moment fort du dimanche.

#### Sur la saison (modifiable jusqu'aux qualifications du premier GP suivant l'inscription)

| Pronostic | Description | Verrouillage |
|---|---|---|
| Classement pilotes (WDC) | Ordre du top 10 pilotes en fin de saison (sur 22) | Début des qualifications du **premier GP suivant la date d'inscription** de l'utilisateur (per-user) |
| Classement constructeurs (WCC) | Ordre complet des 11 écuries en fin de saison | Début des qualifications du **premier GP suivant la date d'inscription** de l'utilisateur (per-user) |

> **Deadline per-user** (décidé en review PR #88) : la deadline de soumission est calculée par utilisateur — les qualifications du premier GP **strictement postérieur** à sa date d'inscription. Un utilisateur présent avant le début de saison garde la deadline Q1 GP1 (comportement historique). Un utilisateur inscrit mi-saison peut donc soumettre son pronostic WDC/WCC jusqu'aux qualifs du prochain GP.
>
> Compromis assumé : un inscrit mi-saison connaît déjà une partie du classement au moment de prédire — c'est acceptable car les pronostics saison sont scorés contre le **classement officiel final** (cf. §3.4), identique pour tous quelle que soit la date de soumission. Cohérent avec la règle « GPs finalisés ignorés pour les nouvelles ligues mi-saison » (PR #74).

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
| Meilleur tour en course correct | +7 pts |

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

Même barème **par position** (5/2/1) pour les qualifications et la course. En revanche, le **poids total de la course est volontairement plus élevé** : on y pronostique l'ordre complet de la grille (~22 positions) contre le top 10 en qualifications, et le bonus meilleur tour (+7) ne s'applique qu'à la course. La course est donc la session la plus déterminante du week-end — c'est assumé.

#### Gestion des saisons

**V1 : reset annuel** — scores, classements et items repartent à zéro à chaque saison.

**Passage à une nouvelle saison (report automatique)** : la ligue est une entité persistante. Au démarrage d'une nouvelle saison, chaque ligue existante reconduit automatiquement ses membres — un job crée de nouvelles lignes `league_members` pour la nouvelle saison (admin conservé) et réinitialise le stock d'items (`user_items` : 1 par item, 3 pour le bouclier). Les données des saisons passées (scores, pronostics, items joués) ne sont jamais écrasées. Aucune action requise des joueurs.

**Objectif long terme : cumul multi-saisons** avec palmarès par ligue, historique des pronostics, stats personnelles sur plusieurs saisons. Le schéma de données doit anticiper cela dès le départ (colonne `season` sur toutes les tables concernées, jamais d'écrasement de données passées) même si l'UI v1 n'expose que la saison en cours.

#### Pronostic non soumis ou incomplet

- Chaque session est indépendante — oublier les qualifications n'empêche pas de soumettre pour la course
- Un pronostic incomplet (moins de positions remplies que la longueur attendue de la session : 10 en qualif, toute la grille engagée en course, 5 en sprint qualif, 8 en sprint race) est **invalide** — traité comme une non-soumission
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
>
> **Wild Card sur une victime à 0 point** : si la victime a 0 point sur la session ciblée, le vol est de 0 — mais la Wild Card est quand même **consommée**. Jouer une Wild Card sur quelqu'un sans score est un coup raté ; c'est un risque assumé par l'attaquant.

> Le bouclier se joue **en aveugle** — avant de savoir si on est ciblé. Les attaques ne sont révélées qu'après la course, en même temps que les résultats. Le bouclier peut donc échouer si personne ne t'a ciblé — c'est une part du jeu.

### 3.6 Notifications

Les notifications sont envoyées via Web Push (standard ouvert, compatible iOS 16.4+ et Android).

| Notification | Déclencheur |
|---|---|
| Week-end de GP approche | J-2 avant `grands_prix.weekend_starts_at` (= **début du GP** = 1ère session de compétition : sprint qualif en week-end sprint, sinon qualif — **hors essais libres**) |
| Rappel pronos J-1 | 24h avant le début de la **première session qui verrouille pronos + items** du week-end (Sprint Qualifying sur week-end sprint, Qualifications sinon) — une seule notif par GP. Calé sur la session-deadline, pas sur la qualif principale, pour rester pertinent en week-end sprint où la deadline tombe le vendredi. |
| Deadline pronostic qualifications | 1h avant le début des qualifications |
| Deadline pronostic course | 1h avant le départ |
| Rappel « tu peux encore ajuster » | 2h après le début de **chaque session non-finale** du week-end (SQ, SR, Qualif), pour rappeler que le prono de la **session suivante** est toujours modifiable (ex. ajuster sa course avec la grille de qualif). Une seule notif par session via claim atomique ; envoyée uniquement si la session suivante n'a pas encore démarré. Un prono se verrouille au *début* de sa session (`sessionLockState`), donc la fenêtre d'ajustement reste ouverte. |
| Session imminente (« ça va commencer ») | **10 min avant le début de chaque session** (essais libres inclus), pour ne pas la louper. Une seule notif par session (dédup atomique par session). **Configurable par l'utilisateur** — voir la préférence ci-dessous. |
| Rattrapage à l'activation des push | **Au moment où l'utilisateur active les notifications**, s'il existe une session-deadline scorable (pronos + items) dans les **2h** à venir. Couvre le cas où l'on s'abonne en plein week-end, après le passage des crons de rappel (J-1, 1h). Envoyée au seul utilisateur qui vient de s'abonner (`sendPushToUser`), best-effort (n'échoue jamais l'abonnement), pas de dédup (one-shot par abonnement). **Pas de filtre par ligue** — aligné sur les autres rappels qui notifient tous les abonnés ; la fenêtre de 2h est ajustable (`CATCH_UP_DEADLINE_WINDOW_MS`). |
| Scores provisoires disponibles | Après chaque session (qualif, sprint) — scores de base sans items |
| Résultats définitifs publiés | Après la course du dimanche — scores finaux avec items résolus |
| Item joué contre vous | Après la course, en même temps que les résultats définitifs — surprise révélée avec les scores |
| Classement mis à jour | Après chaque calcul de score (provisoire ou définitif) — fusionné dans la catégorie "Résultats & scores" dans les réglages utilisateur |
| Annonce produit / nouvelle feature | **Envoi manuel** (admin) — annonce d'une nouvelle feature, d'un correctif notable ou d'un message produit. Opt-in dédié, indépendant du calendrier F1 — voir §Annonces produit ci-dessous. |

> **Préférence « Session imminente »** : l'utilisateur choisit le périmètre de cette notif dans ses réglages — **toutes les sessions** / **sessions à enjeu uniquement** (Sprint Qualifying, Qualifications, Sprint Race, Course — celles où un prono/item se verrouille) / **aucune**. Par défaut : sessions à enjeu. Raison : une notif avant *chaque* session (EL1/2/3 inclus) peut atteindre 6 notifs/week-end dont 3 purement informatives — le choix évite la fatigue tout en couvrant ceux qui veulent tout suivre.
>
> ⚠️ **Prérequis infra** : la page de préférences notif actuelle est un MVP à **toggle global** (tous les types partagent un seul interrupteur d'abonnement, cf. `app/profile/notifications/page.tsx`). Cette préférence par-périmètre suppose un **vrai stockage de préférences notif par utilisateur** (colonne/table dédiée + lecture côté envoi). À construire avec cette feature, ou à mutualiser avec un futur chantier « préférences notif par catégorie ».

#### Annonces produit (« Nouveautés ») — décision 2026-07-01

Canal **manuel** pour annoncer une nouvelle feature, un correctif notable ou un message produit à l'ensemble des utilisateurs — **push Web Push + surface in-app**. Distinct des notifs automatiques du calendrier F1 : c'est l'équipe qui décide quand et quoi envoyer.

**Périmètre v1** :

- **Opt-in dédié** — nouvelle préférence `profiles.notif_announcements` (bool, défaut `true`), **indépendante** de `notif_imminence_scope`. Un utilisateur qui a coupé les rappels de session peut garder (ou couper) les annonces produit, et inversement. Réglable dans la page notifications du profil.
- **Push + page « Nouveautés »** — chaque annonce est poussée en Web Push **et** listée sur une page in-app `/whats-new`, alimentée par la même source. La page rattrape ceux qui n'ont pas reçu le push (iOS non installé, opt-out, appareil hors ligne). Le push ouvre l'`url` de l'annonce (feature concernée ou `/whats-new`).
- **Historique & dédup** — table `announcements` (source de vérité) : chaque annonce y est enregistrée **une fois** puis diffusée. L'envoi est **idempotent par annonce** (un flag `sent_at` empêche le double broadcast si le déclencheur est rejoué), même principe que les colonnes `notified_*` de `grands_prix`.
- **Déclenchement manuel** — endpoint admin protégé par le secret `CRON_SECRET` (même modèle que `/api/dev/test-push`), prenant `title` / `body` / `url` : il crée la ligne `announcements` puis broadcast via un nouveau `sendAnnouncement()` filtrant sur `notif_announcements = true`. **Pas d'UI de composition en v1** (un `curl` suffit).
- **Forme** — titre court + une phrase ; emoji ludique pour une feature (🆕 / 🏁), ton sobre pour un correctif ; **toujours** une `url` interne cliquable. Regrouper les petits correctifs pour éviter le spam.

**Hors v1 (différé)** : UI admin de composition/programmation, ciblage par ligue, badge « non lu » sur l'entrée Nouveautés, catégorisation des annonces.

> **Cohérence infra** : `sendAnnouncement()` suit le patron de `sendImminencePush` (`lib/push/send.ts`) — sélection des `profiles` filtrés sur la préférence, puis jointure `push_subscriptions`. La colonne `notif_announcements` **mutualise** le chantier « vrai stockage de préférences notif par utilisateur » déjà noté pour la préférence « Session imminente » ci-dessus. L'endpoint `/api/dev/test-push` (déjà actif en prod, broadcast à tous via `sendPushToAll`) reste le **fallback niveau 0** pour un envoi ponctuel avant la livraison de ce chantier.

### 3.7 Installation (PWA)

L'app est installable sur l'écran d'accueil. Prérequis techniques : Web App Manifest (`app/manifest.ts`), `apple-touch-icon` pour iOS (les icônes du manifest sont ignorées par iOS), et un service worker doté d'un handler `fetch` — sa présence est exigée par Chrome pour juger l'app installable et émettre `beforeinstallprompt`.

⚠️ **`/manifest.webmanifest` et `/sw.js` doivent être servis publiquement** (exclus du proxy d'auth, cf. `proxy.ts`). Le navigateur récupère le manifest **sans cookies** (lien non-crédentialé) : si le proxy le redirige vers `/login`, le manifest n'est jamais chargé et l'app n'est **jamais installable**, même connecté. C'était la cause d'un blocage complet de l'installabilité.

Deux surfaces incitent à installer :

| Surface | Visibilité | Comportement par plateforme |
|---|---|---|
| **Bannière sticky** (haut de page, fermable, persistée en localStorage) | Réservée aux cas **réellement installables** : prompt Android capté ou iOS Safari. Volontairement peu intrusive. | Android : bouton « Installer » (prompt natif). iOS Safari : consigne Partager → « Sur l'écran d'accueil ». |
| **Entrée « Installer l'app »** (réglages profil) | **Permanente** tant que l'app n'est pas installée, sur toutes les plateformes (pas de gating sur la détection du moteur : des navigateurs comme Brave neutralisent `beforeinstallprompt` mais installent via leur menu). Indépendante du dismiss de la bannière. | Android/desktop avec prompt capté : bouton (install en un tap). iOS Safari : consigne Partager. Sinon (Brave, Chromium avant capture du prompt, etc.) : renvoi vers le menu du navigateur. |

iOS n'expose pas de prompt programmatique (`beforeinstallprompt`) : l'installation y est manuelle via Safari. Les autres navigateurs iOS (Chrome/Firefox/Edge) sont exclus de la détection « iOS » car ils ne peuvent pas ajouter à l'écran d'accueil. La fin d'installation (event `appinstalled`) masque immédiatement les deux surfaces, sans attendre un rechargement. Sur iOS 16.4+, les push notifications **n'arrivent que si l'app est installée** — l'incitation à l'installation conditionne donc l'activation des notifs.

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

## 7. Design & UX (décisions juin 2026)

> **Source de vérité visuelle** : prototype interactif **BoxBox** sur Claude Design — projet « Boxbox », fichier `BoxBox.dc.html` ([claude.ai/design](https://claude.ai/design/p/33e383a1-a58e-441f-a3c4-3c5d3920fb31?file=BoxBox.dc.html)). Copie stable dans le repo : [`docs/design/`](design/) (`BoxBox-shareable.html` ouvrable hors-ligne + screenshots). Couvre tous les écrans (login, onboarding, home, ligues, pronos, résultats, profil, predict, recap, WDC/WCC, création/join de ligue, league-detail, gp-results, compare, admin, notifications). Tokens et polices déjà câblés dans [`app/globals.css`](../app/globals.css) et [`app/layout.tsx`](../app/layout.tsx). Le prototype est une maquette HTML (runtime propriétaire) — les écrans restent à implémenter en React/shadcn.

### Identité visuelle

- **Dark theme uniquement** — pas de light mode. Cohérent avec l'esthétique F1 moderne.
- **Palette couleurs** :
  - Fond principal : `#15151E` (near-black bleuté, fond officiel site F1)
  - Surface (cards, modals) : `#1E1E2A`
  - Bordures : `#2A2A3A`
  - Accent : `#FF1801` (F1 Red officiel)
  - Accent transparent : `#FF18011A` (badges, états)
  - Gold : `#F2C94C` (scores & points — omniprésent dans l'UI)
  - Gold transparent : `#F2C94C24` (fonds de badges « meilleur score »)
  - Texte primaire : `#FFFFFF`
  - Texte secondaire : `#A0A0B0`
  - Texte muted : `#606070`
  - Succès : `#22C55E`
  - Warning : `#F59E0B`
  - Danger : `#EF4444`
- **Typographie** :
  - **Titres** : Titillium Web (proche de la police officielle F1 TV)
  - **Chiffres** (scores, positions, points, countdown) : Rajdhani — condensée et anguleuse, donne le punch « racing » là où les chiffres sont omniprésents (classements, points)
  - **Corps / labels** : Inter (neutre, lisibilité mobile)
  - Toutes gratuites (Google Fonts)
- **Pas de texture fibre carbone** — esthétique flat, accents rouges sparingly

### Internationalisation (i18n)

- **Cible** : l'app vise l'international, mais **lance en français uniquement**.
- **Approche A — « i18n-ready »** (décidée 2026-06-22) : toute chaîne UI passe par une clé de catalogue (`lib/i18n/fr.ts`, accès `t('…')`), **aucun texte affiché en dur**. Une seule locale active (FR), **pas de routing `/[locale]` ni de switcher** pour l'instant.
- **Évolution** : ajouter une langue = ajouter un catalogue de même forme ; l'implémentation de `t()` pourra être remplacée (ex. next-intl) sans toucher aux écrans.

### Theming (multi-thème)

- **Cible** : thèmes **couleur par écurie** (Ferrari, Mercedes, McLaren…) en priorité, mais l'archi est prête pour des **skins complets** (couleurs + polices + rayons).
- **Approche « theme-ready »** (décidée 2026-06-22) : tout est en **tokens CSS sémantiques** (`--primary`, `--surface-2`, `--radius*`, `--font-*`) dans `app/globals.css`. `:root` = thème par défaut (BoxBox). Un thème = surcharge des tokens dans un scope `[data-theme="…"]`.
- **Règle absolue** : les composants n'utilisent **jamais de couleur brute** (pas de `bg-red-600`, pas de `rgba()` de marque) — uniquement des tokens → re-thème automatique.
- **Différé** : le switcher (UI de sélection + persistance cookie/profil + application SSR sans flash) sera construit plus tard, sans réécrire les écrans.

### Navigation principale (bottom nav — 5 tabs)

La bottom nav est présente sur **toutes les pages** de l'app authentifiée. Exceptions (pré-authentification uniquement) : page de login, onboarding étape 1 & 2, `/join/[token]` non connecté.

```
🏠 Home  |  🏆 Ligues  |  📋 Mes Pronos  |  🏁 GP Résultats  |  👤 Profil
```

| Tab | Contenu |
|---|---|
| **Home** | Card GP précédent (résultats rapides) + Card prochain GP (CTA pronostic + countdown) + CTAs "Créer une ligue" / "Rejoindre" |
| **Ligues** | Liste des ligues, classements, items par ligue |
| **Mes Pronos** | Tous mes pronostics : GPs (session par session) + saison (WDC/WCC) |
| **GP Résultats** | Calendrier de la saison + résultats officiels de chaque GP |
| **Profil** | Pseudo, avatar, notifications, accessibilité, gestion du compte |

### Page d'accueil (Home) — structure

- **GP-centric** : le GP en cours / prochain est l'élément central, pas la ligue
- **2 cards GP** toujours visibles : résultats du précédent GP + pronostic du prochain GP
- **Card GP précédent = podium officiel + score brut global** (décision 2026-06-22, affinée) : la Home étant GP-centric, elle affiche le podium officiel + le **score brut de l'utilisateur** (`base_score`, **global** car identique quelle que soit la ligue — il ne dépend que de la prédiction vs le résultat) + un lien « voir mon recap ». Elle n'affiche **pas** le **score final ni les items**, qui sont **spécifiques à chaque ligue** → ceux-ci restent dans la page de ligue.
- **2 CTAs** toujours visibles : "Créer une ligue" + "Rejoindre via lien" (pour inviter ou rejoindre)
- L'avatar de l'utilisateur est affiché dans la nav et dans tous les écrans sociaux (classement, révélation items, comparaison pronos)

### Onboarding

**Page de login** : fond `#15151E` avec glow rouge radial centré derrière le logo (option C — sobre et premium). Un seul CTA "Continuer avec Google". Pas de light mode.

**Workflow onboarding en 2 étapes** (premier lancement uniquement, obligatoire — pas de skip) :

```
Login Google
    ↓
Étape 1 — Pseudo
  → Champ texte + validation temps réel (disponibilité via API)
  → "Suivant" désactivé tant que pseudo invalide ou déjà pris
    ↓
Étape 2 — Avatar
  → Grille d'avatars prédéfinis (casques F1 stylisés flat)
  → "C'est parti !" pour confirmer
    ↓
  Si token d'invitation en attente → auto-join ligue → /leagues/[id]
  Sinon → Home (état vide) → CTA "Créer une ligue" ou "Rejoindre via lien"
```

**Parcours invité (parcours le plus critique)** : le token d'invitation est sauvegardé avant le Google OAuth et survit à l'onboarding. Après completion des 2 étapes, la ligue est rejointe automatiquement et l'utilisateur atterrit sur `/leagues/[id]` — jamais sur une Home vide.

**Pronostics sans ligue** : un utilisateur peut soumettre ses pronostics sans appartenir à une ligue (les pronos sont globaux). Ses scores seront calculés rétroactivement dans toutes les ligues qu'il rejoindra ensuite.

### Avatar

- **Style** : casques F1 stylisés (illustration flat) — ~12-16 options en v1
- **Implémentation** (décision 2026-06-22, remplace l'ancien système d'emojis) : `avatar_key` stocke l'`id` d'un casque du catalogue `lib/profile/avatars.ts` (couleur). Rendu via `AvatarHelmet` / `UserAvatar`. Sélection via `HelmetPicker` (partagé onboarding + profil).
- **Casque = couleur obligatoire** (décision 2026-07-01) : le choix d'un casque est **toujours requis** (onboarding + profil) → `avatar_key` est **toujours renseigné** (plus de `null`). La couleur du casque est l'**identité couleur du joueur** (cf. page GP Résultats, « couleur de l'avatar = couleur du joueur ») → garantie pour 100 % des joueurs, même ceux qui mettent une photo.
- **Upload perso** (décision 2026-07-01) : photo personnalisée **optionnelle**, posée **par-dessus** la couleur — l'avatar est **circulaire avec un anneau de la couleur du casque**. Ordre de rendu résolu par `UserAvatar` (source unique) : si `avatar_url` → photo circulaire + anneau `avatar_key` ; sinon → casque `avatar_key`. La photo est un habillage, jamais un remplacement de la couleur.
  - **Anneau toujours présent** (décision 2026-07-01, homogénéité) : l'avatar porte **toujours** l'anneau, même sans photo — dans ce cas l'anneau prend la couleur du casque (raccord invisible). Résultat : diamètre et structure identiques pour tous les avatars d'une liste (classement), qu'ils aient une photo ou non.
  - **Avec photo, la forme du casque (visière/reflet) n'est pas affichée** — seule la **couleur** subsiste, via l'anneau (compromis validé explicitement le 2026-07-01 : l'identité joueur = la couleur, pas la forme). Le casque complet reste visible pour les utilisateurs sans photo.
  - **Anneau proportionnel à la taille** (ratio, comme les ombres de `AvatarHelmet`) : lisible aussi bien en nav (~40px) que sur le profil (~96px).
  - **Nouvelle colonne** `profiles.avatar_url` (TEXT, nullable) — chemin/URL de la photo dans Storage ; `avatar_key` toujours présent en parallèle (couleur/anneau + fallback si la photo est retirée).
  - **Traitement 100 % côté client** avant upload (zéro coût serveur, zéro impact perf) : rejet à l'input des non-images ou fichiers **> 5 Mo** → **crop carré interactif** (`react-easy-crop`, glisser/zoomer) → **resize 256×256** → **compression** (`canvas.toBlob`). Résultat : quelques dizaines de Ko max quelle que soit la photo d'origine.
  - **Format de sortie WebP, repli JPEG** (cross-browser) : l'encodage WebP via `canvas.toBlob` n'est pas garanti sur les anciens Safari/iOS (repli silencieux en PNG = plus lourd). **Détecter le support WebP et retomber sur JPEG** sinon. Adapter aussi l'extension du fichier stocké au format réellement produit.
  - **UI d'édition** : sélecteur de couleur (`HelmetPicker`, choix de base toujours visible) + zone photo optionnelle par-dessus (upload + preview + « retirer la photo »). Disponible **onboarding (étape 2) ET profil** (décision 2026-07-01) → l'éditeur photo (upload + crop + compression) est un **composant réutilisable partagé** entre les deux, jamais dupliqué.
  - **`UserAvatar` = vraie source unique d'affichage** (décision 2026-07-01) : constat d'archi — aujourd'hui plusieurs écrans (leaderboard, admin, GP résultats) rendent `AvatarHelmet` **en direct** et ne passeraient donc jamais par la photo. Le ticket #167 doit **migrer ces écrans sur `UserAvatar`** (qui reçoit `avatarKey` + `avatarUrl` et arbitre photo+anneau | casque). `AvatarHelmet` reste la **primitive « casque coloré » pure** (couleur/taille), `UserAvatar` la compose. Là où la **couleur joueur** est utilisée pour autre chose que l'avatar (barres d'accent GP résultats), on continue de la dériver via `getHelmet`.
  - **Flux d'upload** : le navigateur compresse puis **upload le blob dans Storage** (client browser, RLS) sous un **nom unique** (`{user_id}/<uuid>.<ext>`) → cache-busting gratuit (l'URL change à chaque photo, pas de CDN périmé) → l'action serveur persiste l'URL dans `avatar_url` (+ authz) → **l'ancien fichier est supprimé** (au remplacement comme au « retirer »).
  - **Préservation croisée pseudo/avatar** : `updateProfile` écrit pseudo **et** avatar ensemble ; chaque formulaire doit **réémettre les champs qu'il ne modifie pas** (edit-pseudo réémet `avatar_key` **et** `avatar_url` ; edit-avatar réémet `pseudo`) — sinon modifier le pseudo effacerait la photo.
  - **Marqueur « moi » vs anneau couleur** : l'avatar portant désormais toujours un anneau de couleur, le marqueur « moi » ne doit **pas** ajouter un 2e anneau (`ring-primary`) autour de l'avatar → distinguer « moi » via le fond teinté + `pseudo (moi)` déjà en place (cf. §GP résultats), pas via un anneau redondant. **Point de départ retenu (2026-07-01)** ; à réévaluer après coup si la distinction « moi » manque de force (autre canal possible : liseré externe avec offset).
  - **Cross-browser** : le proto et l'implémentation doivent fonctionner sur tous les navigateurs, **Safari/WebKit inclus** (repli JPEG ci-dessus ; jamais de `var(--x)` dans un attribut SVG `fill`/`stroke`).
  - **Proto de référence** : `docs/mockups/avatar-upload.html` (onboarding étape 2 + édition profil, crop + compression fonctionnels, aperçu nav/classement).
- **Stockage** : Supabase Storage — bucket dédié `avatars`, chemin `{user_id}/…`, **écriture protégée par RLS** (chaque utilisateur n'écrit/écrase/supprime que son propre fichier). **Lecture publique** (décision 2026-07-01 : URL directe + cache CDN, simple et rapide ; un avatar n'est pas une donnée sensible). **Limite de taille au niveau du bucket** en backstop serveur si le client est contourné. Plan **free** suffisant (avatars de quelques dizaines de Ko). Migrable sans lock-in (Storage open source + compatible S3).
  - **Suppression de compte** : l'anonymisation doit aussi effacer le fichier Storage + remettre `avatar_url` à null (cf. RPC `delete_own_account`).
- **Règle pseudo** : modifiable 1 fois par mois, maximum 5 fois par saison
- **Validation pseudo** : 3-20 caractères, lettres/chiffres/underscore uniquement
- L'avatar est affiché : dans la nav, dans les classements de ligue, dans la révélation des items, dans la comparaison des pronostics

**Header Profil — stat "pts cette saison"** (décision 2026-06-23) : affiche le **score brut** de la saison = somme de `base_score` **dédoublonnée par session** (même logique que la Home, cf. *Card GP précédent*). `base_score` est identique quelle que soit la ligue → on ne le compte qu'une fois par session, sinon un membre multi-ligues verrait ses points multipliés. Le score final/les items (spécifiques à chaque ligue) restent dans la page de ligue.

### Tab Ligues

**Card de ligue** (une par ligue) :
- Nom de la ligue + badge admin si applicable
- Position dans la ligue / nombre de membres + points saison
- Ligne items GP disponibles : icônes avec compteur restant, épuisés grisés (items saison exclus des cards)
- Pas de "X membres ont pronostiqué" en v1

**Comportements** :
- Pas d'alerte deadline sur les cards — bannière sticky en haut du tab pendant le race weekend
- Ordre : chronologique (date d'adhésion, plus ancienne d'abord) ; ligues avec deadline active remontent pendant le race weekend ; ligues terminées/inactives en bas
- CTA "+" dans le header pour créer ou rejoindre une ligue
- État vide (aucune ligue) : CTA plein écran

**Détail d'une ligue** (page scrollable, pas de tabs internes) :

```
Classement saison (membres + badge admin fusionnés — pas de tab Membres séparé)
  ↓
Scores du dernier GP / GP en cours
  ↓
Mes items disponibles + [Jouer un item] → bottom sheet multi-étapes
  ↓
Aperçu saison (3 derniers GPs en mini tableau) + [Voir tous les GPs →]
  ↓
Palmarès (vide en v1, structure en place)
```

- `/leagues/[id]/saison` : page dédiée avec tous les GPs de la saison et points par membre
- Responsive desktop : layout 2 colonnes (sidebar classement + contenu principal)
- Partager le lien d'invitation : accessible à tous les membres (pas admin only)
- ⚙️ admin : régénérer lien, ouvrir/fermer inscriptions, transférer rôle admin

**Flow "Jouer un item"** (bottom sheet, étapes) :
1. Sélectionner l'item
2. Configurer (cible membre si offensif / session / pilote selon l'item)
3. Récap + confirmation irréversible

### Tab Mes Pronos

**Structure de la page** (scrollable) :
- Pronostics saison (WDC/WCC) + items saison (Coup de clé à molette, Boost turbo)
- GP en cours / prochain avec sessions et statuts
- Historique des GPs passés avec scores

**Page de soumission d'un pronostic** — plein écran par session :

| Élément | Décision |
|---|---|
| Format | Page plein écran (pas modal) |
| Navigation | Flèche retour haut gauche → Mes Pronos |
| Sélecteur sessions | Pills horizontales scrollables avec état (✓ soumis / ● actif / ○ vide / 🔒 verrouillé) |
| Sauvegarde | Auto-save continu + statut dans le header (Incomplet / Sauvegardé ✓) |

**Pré-remplissage intelligent** :

| Session | Pré-remplissage si pas encore soumis |
|---|---|
| Qualifications | Classement championnat pilotes (top 10) |
| Course | Résultats qualifications si dispo, sinon classement championnat |
| Sprint Qualifying | Classement championnat (top 5) |
| Sprint Race | Résultats Sprint Qualifying si dispo, sinon classement championnat |

- **Bouton "Repartir de l'ordre des qualifs"** : affiché sur la page Course uniquement si qualifs terminées ET prédiction déjà sauvegardée avant qualifs

**Composant de saisie** — liste unique scrollable :
- Course (22 pilotes) : tous classés, drag & drop, pas de section "Non classés"
- Qualifications (top 10) / Sprint Race (top 8) / Sprint Qualifying (top 5) : section "Mon classement" en haut + section "Non classés" en bas, séparées par un diviseur
- Poignée de drag `⠿` visible à droite de chaque pilote
- Couleur écurie sur badge pilote
- **Interactions** : hold `⠿` → drag & drop (principal) ; tap n'importe où sur la ligne → sélectionne le pilote (surlignage), tap sur une autre ligne → place le pilote (secondaire, sans UI supplémentaire, disponible pour tous)

**Meilleur tour** — intégré en bas de la page Course, **pas une pill séparée dans le sélecteur de sessions** :
- Le sélecteur de sessions affiche uniquement les sessions dédiées : `[Qualif]` `[Course]` (classique) ou `[SQ]` `[SR]` `[Qualif]` `[Course]` (sprint) — jamais de pill `[M.Tour]`
- Section "Meilleur tour 🏆" affichée après la liste des 22 pilotes sur la page Course
- CTA "Choisir un pilote →" → bottom sheet avec barre de recherche + liste scrollable
- La pill `[Course]` passe à ✓ uniquement quand les 22 positions ET le meilleur tour sont soumis

**Longueur des pronostics** :

| Session | Longueur |
|---|---|
| Qualifications | Top 10 uniquement |
| Course | Ordre complet (~22 pilotes) |
| Sprint Qualifying | Top 5 |
| Sprint Race | Top 8 |
| Meilleur tour | 1 pilote |

### Tab Mes Pronos — Pronostics saison WDC/WCC

**Accès** :
- Tab "Mes Pronos" → section "Pronostics saison" en haut (point d'entrée principal)
- Tab "GP Résultats" → standings WDC/WCC → lien contextuel "Voir mon pronostic →" (point d'entrée secondaire)

**Page WDC/WCC** — 3 états selon le moment de la saison :

| État | Comportement |
|---|---|
| Avant verrouillage (avant Q1 premier GP) | Page éditable — utilise le même composant `PredictionRankList` (deux zones : Mon Top 10 / Non classés) — les interactions accessibilité (tap-pour-sélectionner, ↑↓ en mode accessibilité) sont donc couvertes automatiquement |
| Après verrouillage | Lecture seule + colonne officielle actuelle pour comparaison + bouton item si disponible |
| Fin de saison | Comparaison finale + score WDC/WCC révélé |

**Vue comparaison (post-verrouillage)** :
```
Mon prono        Officiel actuel   Écart
P1 Verstappen ✓  Verstappen         0
P2 Leclerc    ~  Norris            ↕1
P3 Norris     ~  Leclerc           ↕1
P4 Russell    ✓  Russell            0
```

**Items saison** :
- Icônes en lecture seule dans la section "Pronostics saison" de Mes Pronos (awareness)
- Bouton d'action "Utiliser 🔧" directement dans la page WDC/WCC (contextuel)
- Deadline non affichée dans l'UI — gérée via notification push quand le dernier GP approche
- Item utilisé → grisé + "Utilisé ✓"

### Home — états de la page d'accueil

La home change de visage selon le moment de la saison.

**État 1 — Entre deux GP** (état de repos)
- Card GP précédent : podium officiel (P1/P2/P3) + score brut de prédiction (`base_score`, **global**, sans items) + lien « voir mon recap » (le score final + items, spécifiques à une ligue, restent dans la ligue)
- Card prochain GP : nom + date + countdown + CTA "Je pronostique →"
- CTAs toujours visibles : "Créer une ligue" / "Rejoindre"

**État 2 — Race weekend, sessions ouvertes**
- Card GP en cours avec liste des sessions + statut par session (✓ verrouillé / ⚠️ ouvert avec deadline / ○ à venir)
- CTA "Modifier mes pronos →"
- Deadline en rouge si < 24h

**État 3 — Session live**
- Indicateur "🔴 LIVE · [Session] en cours"
- "Les pronostics sont fermés — résultats disponibles après la session"
- Sobre — pas de suivi temps réel en v1

**État 4 — Résultats en cours de traitement** (dimanche soir)
- "⏳ Calcul des scores en cours — items en cours de résolution"

**État 5 — Résultats définitifs disponibles**
- Card résultats : podium + score brut + révélation items reçus ("🃏 Wild Card reçue — -8 pts")
- Card prochain GP déjà visible en dessous
- Moment fort : la révélation des items coïncide avec les scores finaux

### Page /gp/[id]/recap — Mon recap GP

Accessible depuis : card Home résultats + historique Mes Pronos.

Structure complète (page scrollable) :

```
Podium officiel (course + sprint si sprint weekend)
Score de prédiction global (par session + total brut)
Détail par session (résumé ✓/~/·/✗ + liste dépliable)
Dans mes ligues (cards : score brut → items → score final → évolution classement)
[Voir les résultats F1 officiels →]  ← en bas
```

**Détail scoring** (code couleur) :
- ✓ vert = position exacte
- ↑↓ orange = écart ±1
- · jaune = écart ±2
- ✗ gris = hors portée (0 pt)
- Résumé en haut (ex: "4 exactes 40pts · 3 à ±1 6pts") + liste dépliable

**Cards "Dans mes ligues"** :
- Score brut → items appliqués (reçus ou joués) → score final
- Évolution de position (↑ ↓ =)
- Plusieurs ligues : dans le flux de page (pas de scroll imbriqué)

**Week-end sprint** : deux podiums (course + sprint) + 5 sections de détail dépliables.

**Lien résultats officiels** : en bas de page (pas en haut — on garde l'utilisateur sur son recap d'abord).

### Desktop

- **< 1024px** (mobile + tablette) → bottom nav
- **≥ 1024px** (desktop) → sidebar gauche fixe (~220px, icônes + labels, avatar + pseudo en bas)
- Design desktop détaillé différé — à affiner une fois la version mobile fonctionnelle
- Drag & drop sur desktop : natif avec la souris, aucune adaptation nécessaire

### Marqueur provisoire / définitif

À afficher sur tous les écrans exposant des scores en cours de week-end :
- Home (état race weekend / résultats) ✅
- `/gp/[id]/recap` → badge sur chaque score de session + sur les cards "Dans mes ligues"
- Détail ligue section "Scores du GP" → badge sur les scores affichés
- Règle : badge "Provisoire" tant que la course du dimanche n'est pas scorée, badge "Définitif" après

### Deadline items dans l'UI

La deadline des items GP est la même que celle des pronostics (Q1 ou Sprint Qualifying sur week-end sprint).
- **Bannière sticky tab Ligues** : "⏱️ Deadline pronos & items · sam. 15h00 (Q1)"
- **Flow "Jouer un item" (bottom sheet)** : deadline affichée dès l'étape 1 avec countdown

### Pronos verrouillés des autres membres

Page `/leagues/[id]/gp/[gp-id]/compare` — accessible depuis : détail ligue → Scores du GP → "Voir les pronos →"

**Vue groupe (défaut)** — par session, tous les membres :
- Sélecteur de sessions en haut (pills)
- Pour chaque position : qui a prédit quoi avec indicateur ✓/✗ par membre
- Insights automatiques : "Personne n'a prédit Norris en P1"

**Vue tête-à-tête** — tap sur l'avatar d'un membre :
- Toi vs [membre] côte à côte, position par position
- Navigation `< >` pour switcher entre membres sans revenir en arrière

Règle d'accès : visible uniquement après verrouillage de chaque session.

### Pages manquantes — mappées

#### `/join/[token]` — Page d'invitation

Première page vue par un nouvel utilisateur arrivant via lien ou code d'invitation. Affiche le nom de la ligue, l'admin, le nombre de membres, et une courte accroche sur l'app.

**6 états :**

| État | Comportement |
|---|---|
| Non connecté | CTA "Se connecter" → Google OAuth → retour sur la page → rejoint automatiquement |
| Connecté, pas encore membre | CTA "Rejoindre la ligue" |
| Déjà membre | "Tu fais déjà partie de cette ligue" → redirect vers `/leagues/[id]` |
| Ligue complète | Message "La ligue est complète (12/12)" — pas de CTA |
| Inscriptions fermées | Message "L'admin a fermé les inscriptions" — pas de CTA |
| Token invalide/expiré | "Ce lien n'est plus valide — demande un nouveau à l'admin" |

#### `/leagues/create` — Créer une ligue

Formulaire simple : nom de la ligue + nombre maximum de membres (2-20). Après création → redirect vers `/leagues/[id]` avec lien d'invitation affiché immédiatement pour partage.

#### `/leagues/[id]/admin` — Paramètres admin

Accessible uniquement à l'admin (redirect sinon). Contenu :
- **Code d'invitation** : code court (ex: `ABC123`) + bouton "Copier le code"
- **Lien complet** : URL complète + bouton "Copier le lien" + bouton "Régénérer" (invalide l'ancien)
- **Inscriptions** : toggle ouvert/fermé
- **Liste des membres** : avec badge admin sur soi-même
- **Transférer l'admin** : choisir un membre + confirmation avec avertissement

#### Flow "Rejoindre une ligue"

Depuis le CTA "Rejoindre" (Home ou tab Ligues) → page ou bottom sheet avec deux options :
- Saisir un **code court** (ex: `ABC123`)
- Coller un **lien complet** (`boxbox.app/join/…`)

Les deux mènent à `/join/[token]`.

**Code = lien** : le code est simplement les derniers caractères du token du lien. Aucune logique backend supplémentaire.

### Tab GP Résultats

Segmented control en haut (3 vues) :

```
[ Calendrier ]  [ Pilotes WDC ]  [ Écuries WCC ]
```

**Vue Calendrier** :
- Prochain GP mis en avant (horaires sessions) + CTA "Pronostiquer" tant que les qualifications ne sont pas commencées, **et** un lien "Résultats" vers `/results/[gp-id]` — pour consulter les essais libres du week-end en cours (puis quali/course) et ajuster ses pronostics avant le verrou Q1. Le lien "Résultats" n'apparaît que si le GP a **au moins une session aux résultats confirmés** (`hasResults`, EL comprises) — sinon il mènerait à une page vide. Même lien (gaté pareil) sur la card du prochain GP de la **Home** (countdown + card week-end).
- Liste chronologique : GP passés (vainqueur + lien recap) / GP en cours / GP futurs
- GP futurs cliquables → page de prédiction `/predictions/[gp-id]`

> **Statut "terminé" (lien Résultats officiels)** : un GP est considéré terminé dès que les **résultats officiels de la course sont confirmés** (`sessions.results_confirmed_at` de la session course, dimanche soir) — **pas** quand le scoring de ligue est finalisé (`scoring_finalized_at`, après résolution des items lundi). La page affiche des résultats F1 officiels, indépendants du traitement de ligue : ils doivent être consultables dès leur confirmation.

**Vue Pilotes WDC / Écuries WCC** :
- Classement officiel complet
- Lien "Voir mon pronostic →" vers la page WDC/WCC de Mes Pronos

**Page résultats officiels GP** (`/gp/[id]/results`) :
- Segmented control [Course | Qualifications | Sprint*] selon le type de weekend
- Résultats officiels complets par session

### Notifications

4 catégories, toutes activées par défaut :
- **Deadline pronos & items** — 1h avant chaque session (pronos) + rappel deadline items GP (même verrou Q1)
- **Résultats & scores** — scores provisoires après chaque session + résultats définitifs dimanche + classement mis à jour
- **Items reçus** — révélation après la course
- **GP approche** — J-2 avant le week-end
- Notification dédiée : "Tu as un item saison non utilisé — dernier GP dans X jours" (deadline items saison)

### Accessibilité

**Niveau WCAG cible** :
- Mode normal : WCAG AA
- Mode accessibilité : WCAG AAA
- `prefers-reduced-motion` (préférence système) : appliqué automatiquement via CSS (`@media`) — pas de toggle nécessaire
- **Implémentation** (décision 2026-06-23) : le toggle manuel pose une classe `.reduce-motion` sur `<html>` (persistée en `localStorage`, réappliquée avant le 1er paint par un script anti-FOUC dans le layout). L'override est **additif** : il peut activer la réduction quand l'OS ne la demande pas, mais ne peut pas désactiver le `prefers-reduced-motion` système (toujours respecté). Source unique : `lib/hooks/use-prefers-reduced-motion.ts` (`resolveReducedMotion`), partagée par le hook JS, le toggle profil et le script de boot.

**Mode accessibilité** — toggle disponible dans :
- Page Profil → section "Accessibilité"
- Tooltip contextuel au premier lancement de `PredictionRankList` : "Difficultés avec le drag & drop ? [Activer le mode accessibilité]" — pas en onboarding pour ne pas alourdir le flow

**Ce que le mode accessibilité modifie** :

| Élément | Mode normal | Mode accessibilité |
|---|---|---|
| `PredictionRankList` | Drag & drop | Tap-pour-sélectionner + tap-pour-placer + boutons ↑↓ |
| Animations | Activées | Réduites |
| Taille de texte | Standard | +2px sur les éléments clés |
| Contraste | WCAG AA | WCAG AAA |

**Interactions `PredictionRankList`** :

| Mode | Interactions disponibles |
|---|---|
| **Normal** | Drag & drop (hold `⠿`) + tap-pour-sélectionner/placer (secondaire, pas d'UI supplémentaire) |
| **Accessibilité** | Tap-pour-sélectionner/placer (principal) + boutons ↑↓ (secondaire, pour ajustements ±1) |

- Tap-pour-sélectionner : 2 taps pour déplacer n'importe quel pilote n'importe où — efficace même sur 22 pilotes
- ↑↓ uniquement en mode accessibilité — évite de surcharger l'interface en mode normal
- Drag & drop disponible en parallèle même en mode accessibilité

### Splash screen animé (décision 2026-06-27)

Animation de lancement **in-app** (le splash système du manifest PWA reste statique — limite du standard).

- **Format** : Lottie JSON (`public/animations/splash.json`, portrait 1080×1920, 3.2 s à 30 fps, sans dépendance de font). Lecture via `lottie-react`, fetché au runtime (hors bundle). Composant `app/ui/splash-screen.tsx`, monté dans le layout.
- **Anti-flash** : l'overlay est rendu en SSR mais masqué par défaut ; un **boot script** dans le layout pose `.splash-play` sur `<html>` **avant le 1er paint** quand le splash doit jouer (même pattern anti-FOUC que le thème / mode réduit). L'écran est couvert **immédiatement**, sans flash de la Home avant l'animation. Constantes partagées dans `lib/splash/splash.ts` (module **non**-`'use client'`, sinon le boot script serveur recevrait `undefined`). Filet de sécurité : le boot script retire la classe après `SPLASH_FAILSAFE_MS` si React ne tourne pas.
- **Splash système (PWA installée)** : l'icône sur fond, rendue par l'OS **avant** notre code, reste incontournable (limite du standard). Atténuée en **fondu** : le `background_color` du manifest et le fond de l'overlay partagent la même couleur (`SPLASH_BACKGROUND_COLOR`), donc icône système → animation in-app s'enchaînent sans cassure de couleur.
- **Fréquence** : joué **une seule fois par session** d'onglet (`sessionStorage`, posé par le boot script) — pas rejoué lors des navigations client.
- **`prefers-reduced-motion`** : splash **skippé** (système ou override manuel) — décidé dans le boot script (mutualise la clé d'override du mode accessibilité).
- **Son** : moteur F1 synthétisé en Web Audio API (Doppler + panning L→R), porté du proto `docs/design/boxbox-splash.html` vers `lib/audio/engine-flyby.ts`. **Activé par défaut, désactivable** depuis le profil (toggle « Son au lancement », opt-out). Contrainte navigateur assumée : au **lancement à froid** l'`AudioContext` est suspendu faute de geste utilisateur → son **muet à ce moment-là** quelle que soit la préférence (dégradation silencieuse) ; il devient effectif une fois l'audio débloqué par un geste (ex. activation du toggle).

---

## 8. Ce qui reste à définir (TBD)

- [x] Nom de l'application : **BoxBox** — nom affiché dans l'UI et le PWA manifest. Le projet Supabase et les noms d'infrastructure utilisent un nom générique (`f1-pronostics`) pour ne pas être couplés au nom de marque.

## 9. Points UX à traiter pendant le développement

Ces sujets ne bloquent pas le démarrage mais doivent être adressés avant le lancement :

- [ ] **Onboarding & états vides** — premier lancement sans ligue, ligue sans pronostics encore soumis, classement avant la première course. La promesse "3 minutes pour rejoindre et pronostiquer" se joue ici.
- [ ] **Transparence du scoring** — largement couvert par le détail scoring de `/gp/[id]/recap` (résumé ✓/~/·/✗ + liste dépliable). À finaliser : s'assurer que le détail est suffisamment lisible et pédagogique pour un nouvel utilisateur.
- [x] **Transparence des items + différenciation visuelle dans les résultats** ([issue #151](https://github.com/premgopi18-droid/f1-pronostics/issues/151), implémenté) — la page GP de ligue (`/leagues/[id]/gp/[gp-id]`, [`app/leagues/[id]/gp/[gpId]/page.tsx`](../app/leagues/[id]/gp/[gpId]/page.tsx)) n'explique pas le rôle des items dans les scores et manque de différenciation visuelle. Maquette de référence : [`docs/mockups/gp-results-items.html`](mockups/gp-results-items.html). Décisions :
  - **Surface 1 — « Faits marquants du GP »** : section listant tous les items joués par les membres (acteur, cible, session, effet bonus/malus/annulé), en respectant l'ordre de résolution §3.5 et en explicitant le **cheminement** (ex. blocage annulé par un bouclier, vol Wild Card chiffré). Révélée seulement après la course / items résolus (`resolved_at`).
  - **Surface 2 — détail par joueur en master-détail** : **un seul panneau** sous le classement, piloté par la ligne sélectionnée (**moi par défaut**), avec **onglets de session** (Qualifs + Course en week-end classique ; + Sprint Q. + Sprint en week-end sprint). Affiche positions, Meilleur tour, et impact chiffré des items joués/subis (`base ± items = final`). **Consultable pour chaque membre** (transparence totale). Chargement du détail au clic (lazy).
  - **Identité joueur** : avatar **casque F1** (composant `AvatarHelmet`) + **sa couleur = couleur du joueur** (option retenue : couleur de l'avatar, pas de couleur de ligue séparée ; collisions tolérées car le **pseudo** reste la clé). « Moi » distingué sur un **canal séparé** de la couleur casque (barre d'accent + fond teinté + `pseudo (moi)`).
  - **Lisibilité du score** : podium rang 1/2/3 en or/argent/bronze ; dans le **classement**, pastilles **`●N` (exactes, vert)** / **`◐N` (approchées, ambre)** — plein/demi-cercle ; dans le **détail**, marqueur par position **`●` exact / `±N` écart (ambre) / `✗` raté**. Le `±N` (écart) ne sert qu'au détail, le `◐` (compte) qu'au classement → pas d'ambiguïté de symbole.
  - **Meilleur tour** : ligne **séparée visuellement** du bloc positions (trait fin `border-t` + libellé « Meilleur tour ») pour qu'elle se lise comme un bonus distinct (+10), course uniquement.
  - **Donnée à persister** : **deux colonnes** sur `items_played` — `points_delta_actor` (effet sur le joueur qui a joué l'item) et `points_delta_target` (effet sur la cible, nullable) — écrites par le moteur de résolution ([`lib/scoring/resolve-items.ts`](../lib/scoring/resolve-items.ts) + `markItemsResolved`). Ex : ×2/bonus = `actor:+N, target:null` ; Wild Card = `actor:+S, target:−S` ; Bloquer = `actor:0, target:−X` ; Bouclier/annulé = `0/0`. Choix de deux colonnes (vs une seule signée) : auto-documenté, pas de règle implicite « à qui s'applique le chiffre », robuste aux futurs items asymétriques. **Couvre les items touchant 0 ou 1 cible** (tous les items actuels). ⚠️ **Évolution** : un futur item **multi-cibles** (« touche tout le monde ») ne tiendra pas dans 2 colonnes → passera par une **table d'effets dédiée** (1 ligne par joueur affecté) ; ajout propre, pas de réécriture des items existants. Migration `supabase/migrations/` → appliquer sur prod **avant merge**.
  - **Contraintes** : i18n approche A (`lib/i18n/fr.ts`), mobile-first, a11y (ne pas reposer sur la couleur seule), tokens de thème plutôt que zinc hardcodé.
  - **Réalisation** : libellés d'items centralisés dans [`lib/items/catalog.ts`](../lib/items/catalog.ts) (source unique réutilisée par « Jouer un item » et les bulles d'items — l'ancien `leagues.items` i18n a été supprimé) ; narratif « Faits marquants » dans [`lib/items/facts.ts`](../lib/items/facts.ts) et détail positions/items dans [`lib/scoring/gp-detail.ts`](../lib/scoring/gp-detail.ts) (fonctions pures) ; règle exact/partial/miss et libellés de session partagés (`lib/scoring/position-mark.ts`, `lib/scoring/session-label.ts`, avec `/compare`) ; ordre des faits dérivé de `ITEM_RESOLUTION_ORDER` (source unique du moteur) ; `t()` accepte désormais l'interpolation `{placeholder}` ; tokens `silver`/`bronze` ajoutés au thème ; canal « moi » = token `accent` du thème.
  - **Écart assumé sur le lazy-load** : le détail n'est pas chargé au clic mais calculé côté serveur pour tous les membres — les pastilles `●N`/`◐N` du classement exigent de toute façon les pronos de **tous** les membres (le compte des approchées n'est pas stocké), donc un fetch par clic serait redondant. Volume identique à `/compare` (≤20 membres × ≤4 sessions).
  - **Cas limites traités** : impact d'un item (Wild Card subi, bonus…) affiché même quand le membre n'a pas pronostiqué la session ; meilleur tour « Non joué » distingué d'un meilleur tour raté ; items résolus avant la migration (deltas null) exclus des faits marquants pour ne pas afficher de faux « 0 ».
  - **Section « Faits marquants » jamais masquée quand il y a des scores** (décision UX, consciente de la révélation) : faits si items résolus ; sinon GP révélé sans item → message fun (« Pas un seul item joué… vous attendiez une invitation ? ») ; GP encore provisoire → teaser (« Les coups fourrés seront révélés après la course »). Avant tout score, la page entière reste masquée. **Important** : ne jamais afficher « aucun item joué » tant que le GP n'est pas révélé — des items peuvent exister sans être encore visibles (`resolved_at` null), donc le message « calme » est réservé à l'état révélé.
  - **Boutons d'action de la page GP** (décision UX) — traitement par cycle de vie, pas de règle uniforme : **« Jouer un item »** reste toujours navigable (la page items reste utile après la deadline pour consulter son item joué) mais **change de libellé** → « Items du week-end » une fois la deadline passée (départ de la 1ʳᵉ séance). **« Pronos comparés »** est **désactivé + hint** (« Dispo après le départ de la 1ʳᵉ séance ») tant qu'aucune séance n'est verrouillée (la page /compare serait vide), puis activé. Principe : désactiver+expliquer pour un « pas encore » tourné vers le futur ; garder+relibeller quand la destination reste utile ; ne masquer que si la destination est définitivement vide.
- [x] **Historique des pronostics des autres** — couvert par la page `/leagues/[id]/gp/[gp-id]/compare` (vue groupe par session + vue tête-à-tête)
- [ ] **Statut "forfait"** — libellé humoristique à définir pour les joueurs qui n'ont pas soumis de pronostic
- [ ] **Légal** — CGU, politique de confidentialité, mention âge minimum (prévoir avant ouverture publique)
- [ ] **Unicité et modération des pseudos** — règles de validation (longueur, caractères autorisés, mots interdits)

## 10. Dette technique & sujets engineering différés

À traiter quand le schéma de données est stabilisé (plus aucune migration en cours), avant les premiers vrais utilisateurs.

- [ ] **Tests d'intégration — étape dédiée, une fois le code stable et le produit plus avancé.** Regrouper l'ensemble des tests d'intégration en un seul lot plutôt que de les ajouter au fil de l'eau (décidé en review PR #14). Périmètre :
  - **Couche data (`lib/data/`)** : monter `supabase start` + fixtures de seed et couvrir les fonctions Supabase (`upsertSessions`, `getPendingSessionScores`, `upsertSessionResults`, etc.). Les mocks Supabase ne valent rien — seule une vraie DB valide les requêtes PostgREST (embeds, filtres, upsert conflicts).
  - **Route handlers (`app/api/**`)** : tester les routes cron de bout en bout (auth `isCronAuthorized`, garde-fous comme le `503` de `/api/scores/season` sur classements vides, idempotence des UPSERT) en mockant la couche data ou contre la DB locale. En attendant, on couvre le **contrat de parsing/scoring** par des tests unitaires (mappers Jolpica mockés, `computeSeasonScore`).
  - Bloquer tant que le schéma bouge encore.
- [ ] **Durcissement sécurité DB (advisor Supabase)** — à traiter **avant ouverture publique**. Warnings remontés sur les fonctions des migrations fondation (PR #7 a déjà corrigé `create_league`) :
  - `search_path` mutable sur `enforce_min_one_admin`, `enforce_max_members`, `handle_new_user` → ajouter `set search_path = ''` (ou schéma explicite).
  - Fonctions `SECURITY DEFINER` exécutables par `anon`/`authenticated` via `/rest/v1/rpc/...` : `handle_new_user`, `is_member_of_league`, `shared_league` → `REVOKE EXECUTE` (ou passer en `SECURITY INVOKER` si pertinent) pour qu'elles ne soient pas appelables depuis l'API publique.
  - **Leaked password protection** désactivée côté Supabase Auth → l'activer (vérification HaveIBeenPwned).
  - Vérifier via `get_advisors(security)` que la liste est vide après coup.
