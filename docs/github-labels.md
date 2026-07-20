# Convention de labels GitHub

> Tous les tickets (issues) doivent porter au minimum **1 label `type:*`** et **1 label `area:*`**.
> Les préfixes rendent les labels requêtables (`gh issue list --label "type:bug"`) et exploitables
> pour du suivi qualité, du monitoring ou des dashboards de stats.

## `type:*` — nature du ticket (obligatoire, exactement 1)

| Label | Usage |
|---|---|
| `type:bug` | Quelque chose ne fonctionne pas |
| `type:feature` | Nouvelle fonctionnalité |
| `type:enhancement` | Amélioration d'un existant |
| `type:refactor` | Refactor / dette technique, sans changement fonctionnel |
| `type:perf` | Performance |
| `type:a11y` | Accessibilité |
| `type:security` | Sécurité (headers, RLS, durcissement) |
| `type:docs` | Documentation |
| `type:chore` | Deps, config, tâches outillage |

Les issues `epic` sont exemptées (le label `epic` suffit, `area:*` optionnelle).

## `area:*` — domaine fonctionnel (obligatoire, au moins 1)

`area:items`, `area:scoring`, `area:predictions`, `area:leagues`, `area:results`,
`area:ui`, `area:theme`, `area:profile`, `area:data`, `area:auth`, `area:notifications`,
`area:pwa`, `area:infra`, `area:app` (transversal applicatif : Server Actions, erreurs, i18n).

Créer une nouvelle `area:*` (couleur `#1d76db`) plutôt que de laisser un ticket sans domaine.

## `prio:*` — priorité (optionnel)

| Label | Usage |
|---|---|
| `prio:haute` | À traiter en premier — meilleur ratio effort/gain ou sécurité |
| `prio:moyenne` | À traiter ensuite |
| `prio:basse` | Polish — quand les prios hautes/moyennes sont passées |

## `sev:*` — sévérité (bugs uniquement, exactement 1 par `type:bug`)

| Label | Usage |
|---|---|
| `sev:critique` | Bloquant — feature inutilisable ou données faussées |
| `sev:majeur` | Gênant — contournement possible mais pénible |
| `sev:mineur` | Cosmétique ou cas limite rare |

## Labels de suivi

| Label | Usage |
|---|---|
| `found-in-prod` | Bug découvert en prod par un utilisateur (vs attrapé en dev/review) — métrique qualité clé : le ratio `found-in-prod` / total bugs mesure ce qui échappe aux tests et aux reviews |
| `epic` | Issue chapeau regroupant des tickets |

## Exemples de requêtes

```bash
# Bugs prod ouverts, les plus graves d'abord
gh issue list --label "type:bug" --label "found-in-prod" --state open

# Volume de bugs par domaine (base d'un dashboard)
gh issue list --label "type:bug" --state all --limit 500 --json labels

# Tout ce qui touche aux items
gh issue list --label "area:items" --state all
```
