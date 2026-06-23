# Scripts utilitaires BoxBox

## `setup-cronjobs.mjs` — Configurer les crons sur cron-job.org

Ce script crée ou met à jour les deux jobs cron de l'application sur
[cron-job.org](https://cron-job.org). Il est **idempotent** : tu peux le relancer
autant de fois que tu veux, il ne crée pas de doublons.

### Quand le lancer ?

- **Première fois** : pour créer les deux jobs après un nouveau déploiement
- **Si tu changes de domaine** : pour pointer les jobs vers la nouvelle URL
- **Si tu modifies un schedule** : pour appliquer le nouveau rythme

En dehors de ces cas, les jobs tournent seuls indéfiniment — pas besoin d'y
retoucher.

---

### Prérequis

- Node.js 18 ou plus (`node --version`)
- Un compte sur [cron-job.org](https://cron-job.org) (gratuit)
- Avoir déployé l'app sur Vercel au moins une fois

---

### Étape 1 — Récupérer la clé API cron-job.org

1. Connecte-toi sur [cron-job.org](https://cron-job.org)
2. Va dans **Settings → API**
3. Clique sur **Generate API Key**
4. Copie la clé générée

---

### Étape 2 — Stocker la clé API en local (jamais dans le repo)

Le fichier `.env.local` est déjà ignoré par git (`.gitignore` contient `.env*`).
Ajoute-y la ligne suivante :

```
CRONJOB_API_KEY=ta-clé-ici
```

> **Règle absolue : ne jamais coller la clé API dans un fichier versionné
> (scripts, config, README avec valeur réelle, etc.).**
> Si tu la commites par accident, régénère-la immédiatement sur cron-job.org.

---

### Étape 3 — Lancer le script

**PowerShell (Windows) :**

```powershell
# Charge les variables depuis .env.local
Get-Content .env.local | ForEach-Object {
  if ($_ -match '^([^#][^=]+)=(.+)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
  }
}

# Lance le script
node scripts/setup-cronjobs.mjs
```

**Ou en passant les variables directement (sans .env.local) :**

```powershell
$env:CRONJOB_API_KEY = "ta-clé-ici"
$env:CRON_SECRET     = "ton-cron-secret-vercel"
$env:SITE_URL        = "https://boxbox-silk.vercel.app"
node scripts/setup-cronjobs.mjs
```

**bash/macOS/Linux :**

```bash
CRONJOB_API_KEY=ta-clé-ici \
CRON_SECRET=ton-cron-secret-vercel \
SITE_URL=https://boxbox-silk.vercel.app \
node scripts/setup-cronjobs.mjs
```

---

### Ce que le script crée

| Job | URL appelée | Schedule |
|---|---|---|
| `BoxBox — F1 Sync` | `/api/f1/sync` | Toutes les heures à `:00` |
| `BoxBox — Scoring & Notifications` | `/api/scores/trigger` | Toutes les heures à `:30` |

Les deux jobs envoient le header `x-cron-secret` avec la valeur de `CRON_SECRET`
pour authentifier les appels (même valeur que la variable d'env Vercel).

---

### Variables d'environnement nécessaires

| Variable | Où la trouver |
|---|---|
| `CRONJOB_API_KEY` | cron-job.org → Settings → API |
| `CRON_SECRET` | Vercel → Settings → Environment Variables |
| `SITE_URL` | URL de prod Vercel (ex. `https://boxbox-silk.vercel.app`) |

---

### Vérifier que les jobs sont actifs

Après le script, va sur
[cron-job.org → Jobs](https://cron-job.org/en/members/jobs/) pour confirmer
que les deux jobs sont bien créés et activés. Tu peux aussi les déclencher
manuellement depuis l'interface pour tester.
