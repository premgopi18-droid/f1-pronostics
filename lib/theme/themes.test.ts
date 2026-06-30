import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { THEMES } from './themes'

// Garde-fou contraste a11y : pour chaque thème, `--primary-text` (variante du primaire
// lisible en texte sur fond sombre) DOIT atteindre WCAG AA (≥ 4.5:1) sur les trois fonds
// réels de l'app. Le défaut vit dans `:root` (= boxbox) ; un thème qui oublierait de le
// surcharger hériterait silencieusement du rouge boxbox, illisible sur une autre teinte —
// sans aucune erreur au build. Ce test ferme la porte (présence ET ratio réel).
// On retire les commentaires `/* … */` : ils contiennent des exemples de sélecteurs
// `[data-theme="…"]` qui fausseraient le parsing des vrais blocs.
const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

const AA_MIN_RATIO = 4.5

function blockFor(selector: string): string {
  // Capture le contenu `{ … }` du premier bloc dont le sélecteur est suivi de `{`
  // (donc pas le sélecteur groupé `[data-theme="x"], [data-theme="y"] {`).
  return css.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`))?.[1] ?? ''
}

function tokenHex(block: string, token: string): string | null {
  return block.match(new RegExp(`--${token}\\s*:\\s*(#[0-9a-fA-F]{6})`))?.[1] ?? null
}

// Fonds réels de l'app, lus depuis :root (pas codés en dur → suivent toute évolution).
const root = blockFor(':root')
const BACKGROUNDS = ['background', 'card', 'surface-2'].map((t) => {
  const hex = tokenHex(root, t)
  if (!hex) throw new Error(`Fond --${t} introuvable dans :root`)
  return { token: t, hex }
})

function relativeLuminance(hex: string): number {
  const channels = [0, 2, 4]
    .map((i) => parseInt(hex.slice(1 + i, 3 + i), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)))
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// Résout `--primary-text` d'un bloc en hex : valeur directe, ou `var(--primary)` →
// le `--primary` du même bloc (ou de :root en dernier recours pour le défaut boxbox).
function resolvePrimaryText(block: string): string | null {
  const raw = block.match(/--primary-text\s*:\s*([^;]+);/)?.[1]?.trim()
  if (!raw) return null
  if (raw.startsWith('#')) return raw
  if (raw.includes('var(--primary)')) return tokenHex(block, 'primary') ?? tokenHex(root, 'primary')
  return null
}

describe('tokens de thème — --primary-text (garde-fou contraste a11y)', () => {
  for (const { id } of THEMES) {
    // boxbox = thème par défaut, défini dans :root (pas de bloc [data-theme]).
    // ⚠️ Si le thème par défaut change un jour, mettre à jour ce mapping.
    const block = id === 'boxbox' ? root : blockFor(`\\[data-theme="${id}"\\]`)

    it(`le thème "${id}" définit --primary-text`, () => {
      expect(resolvePrimaryText(block)).not.toBeNull()
    })

    it(`le thème "${id}" tient ≥ ${AA_MIN_RATIO}:1 sur les trois fonds`, () => {
      const primaryText = resolvePrimaryText(block)!
      for (const bg of BACKGROUNDS) {
        const ratio = contrastRatio(primaryText, bg.hex)
        expect(
          ratio,
          `${id} : ${primaryText} sur --${bg.token} (${bg.hex}) = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(AA_MIN_RATIO)
      }
    })
  }
})
