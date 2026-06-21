# Design — référence visuelle BoxBox

Copie stable du prototype **BoxBox** (source de vérité visuelle, voir [product-specs.md §7](../product-specs.md)).
Conservée ici pour ne pas dépendre de l'accès à Claude Design.

## Source

Projet « Boxbox » sur Claude Design — [claude.ai/design](https://claude.ai/design/p/33e383a1-a58e-441f-a3c4-3c5d3920fb31?file=BoxBox.dc.html).

## Contenu

| Fichier | Quoi | Rendu |
|---|---|---|
| `BoxBox-shareable.html` | Prototype autonome compilé | ✅ s'ouvre dans n'importe quel navigateur |
| `screenshots/*.png` | 30 captures — tous les écrans + états | aperçu instantané |

> Ne **pas** committer `BoxBox.dc.html` : il dépend du runtime propriétaire `support.js` et ne s'affiche pas seul.

## Index des screenshots

**Navigation principale (5 tabs)**
`01-accueil` · `02-ligues` · `03-mes-pronos` · `04-resultats` · `05-profil`

**États de la Home** — `24-accueil-etat1-entre-gp` · `25-…weekend-ouvert` · `26-…live` · `27-…calcul` · `28-…resultats`

**Onboarding & accès** — `21-login` · `22-onboarding-pseudo` · `23-onboarding-avatar` · `11-rejoindre` · `12-invitation` · `13-ligue-complete` · `14-ligue-fermee`

**Pronostics** — `07-pronostic-course` · `29-pronostic-qualifs` · `08-recap-gp` · `16-pronos-compares` · `30-pronos-tete-a-tete`

**Ligues** — `06-detail-ligue` · `09-creer-ligue` · `10-admin-ligue` · `20-tableau-saison`

**Résultats & classements saison** — `15-resultats-gp` · `17-wcc` · `18-wdc`

**Autres** — `19-notifications`

## Statut

Maquette = cible visuelle. Les écrans restent à implémenter en React/shadcn — ce dossier est une **référence**, pas du code de prod.
