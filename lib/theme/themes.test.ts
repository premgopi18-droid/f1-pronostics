import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { THEMES } from './themes'

// Garde-fou contraste : chaque thème DOIT définir `--primary-text` (variante du
// primaire lisible en texte sur fond sombre). Le défaut vit dans `:root` (= boxbox) ;
// un thème qui oublierait de le surcharger hériterait silencieusement du rouge boxbox,
// illisible sur une autre teinte — sans aucune erreur au build. Ce test ferme la porte.
// On retire les commentaires `/* … */` : ils contiennent des exemples de sélecteurs
// `[data-theme="…"]` qui fausseraient le parsing des vrais blocs.
const css = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

function blockFor(selector: string): string {
  // Capture le contenu `{ … }` du premier bloc dont le sélecteur commence par `selector`
  // suivi de `{` (donc pas le sélecteur groupé `[data-theme="x"], [data-theme="y"] {`).
  const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`)
  return css.match(re)?.[1] ?? ''
}

describe('tokens de thème — --primary-text (garde-fou a11y)', () => {
  it(':root définit --primary-text (défaut = boxbox)', () => {
    expect(blockFor(':root')).toMatch(/--primary-text\s*:/)
  })

  for (const { id } of THEMES) {
    if (id === 'boxbox') continue // boxbox = :root, couvert ci-dessus
    it(`le thème "${id}" surcharge --primary-text`, () => {
      const block = blockFor(`\\[data-theme="${id}"\\]`)
      expect(block).toMatch(/--primary-text\s*:/)
    })
  }
})
