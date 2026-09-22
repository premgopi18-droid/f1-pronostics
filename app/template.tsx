import { PageTransition } from '@/app/components/page-transition'

// Template racine (#242) : contrairement au layout, il est ré-instancié à chaque
// navigation. Le <ViewTransition> qu'il porte est donc DÉMONTÉ (exit) avec l'ancienne
// page et MONTÉ (enter) avec la nouvelle — sémantique enter/exit par écran, jamais
// « update » : les mutations à l'intérieur d'une page (switch optimiste, refresh,
// révélation d'un skeleton) n'animent pas l'écran entier.
export default function RootTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
