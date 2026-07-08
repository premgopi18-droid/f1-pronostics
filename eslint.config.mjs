import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // A11y stricte — fige le niveau atteint (#184). eslint-config-next enregistre
  // déjà le plugin jsx-a11y (sous-ensemble de règles) : re-déclarer le plugin via
  // flatConfigs.strict ferait un "Cannot redefine plugin". On n'applique donc que
  // les RÈGLES de la config strict — placées après Next, elles priment.
  { rules: jsxA11y.flatConfigs.strict.rules },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
]);

export default eslintConfig;
