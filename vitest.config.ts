import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// ⚠️ vitest est volontairement épinglé en 3.x (cf. package.json). La 4.1.9 crashe
// au bootstrap des workers en file-parallelism (le défaut) sur Windows/Node 24 —
// « Cannot read properties of undefined (reading 'config') », 0 test exécuté.
// Ne pas re-bumper en 4.x sans avoir vérifié que `npx vitest run` passe en parallèle. Cf. PR #4.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
})
